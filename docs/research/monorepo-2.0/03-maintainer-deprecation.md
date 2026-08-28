# 03 — Maintainer App Deprecation

> Part of [Monorepo 2.0 / Web-App 5.0 research](./README.md).
> **Decision (fixed input):** `apps/maintainer` is deprecated. New dyes are added via a documented, Claude-assisted workflow driven by game data instead of a bespoke editing UI.

## Summary

The audit strongly supports the decision. The app's scope is far narrower than its billing: it is an **append-only, one-dye-at-a-time** form (Vue 3 SPA on :5174 + an Express 5 sidecar on :3001 doing raw `fs` writes) that edits exactly two targets — `packages/core/src/data/colors_xiv.json` and the generated `locales/*.json`. It never touches `colors_xiv.csv`, `dyenames.csv`, `localize.yaml`, character colors, or presets, and invokes **no scripts** — the real pipeline (`build:locales`, version bump, publish) was always a documented manual follow-up (`apps/maintainer/CLAUDE.md:152`, `docs/maintainer/dye-maintainer-tool.md:127-149`).

More decisively: **its save path destroys data**. All three destructive-behavior findings below were independently verified by a second agent instructed to refute them, including empirical runs of the actual schemas against the real data files.

## 1. Verified Data-Destruction Bugs (deprecate before someone presses Save)

The server validates with `req.body = schema.parse(req.body)` (`server/middleware/validation.ts:21`); Zod 4's `z.object()` strips unknown keys; the handlers then write the **stripped** body to disk (`server/api.ts:142`, `:209`).

1. **`POST /api/colors` deletes three fields from all 136 dyes.** `DyeSchema` (`server/schemas.ts:29-43`) declares 13 fields — no `stainID`, no `isIshgardian`, **no `consolidationType`** (the third casualty was found during verification). Empirically: parsing the real array succeeds, and 0/136 entries retain any of the three. Every save round-trips the whole array through this schema (`src/services/fileService.ts:228-234`). Losing `stainID` silently breaks Glamourer/Mare interop (`DyeDatabase.ts:323-325` just skips the entry — no error, no default); losing `consolidationType` breaks the entire Patch 7.5 market resolution.
2. **`POST /api/locale/:code` deletes 8 translation groups per locale** (~80 entries each): `currencies, visions, tools, sheets, jobNames, grandCompanyNames, races, clans` — all absent from `LocaleDataSchema` (`server/schemas.ts:79-96`, which instead declares nonexistent `jobs`/`grandCompanies` keys). Verified empirically against `en.json`. *Mitigation:* `build:locales` regenerates these files, so this one is recoverable; the `colors_xiv.json` loss is not.
3. **A dye added through the tool is born incomplete.** The frontend `Dye` type and the assembled object (`src/types/index.ts:34-48`, `DyeForm.vue:87-101`) have no `stainID`/`isIshgardian`/`consolidationType`. At load, core silently defaults `isIshgardian: false` and `consolidationType: null` (`DyeDatabase.ts:253-258`) and leaves `stainID` undefined — the dye works everywhere *except* stain-based lookups, with no diagnostic. (Contrast: duplicate IDs *are* logged at `:308-312` — the silence is inconsistent even with the file's own standards.)

These bugs also shape the v2 schema work: validation must live in **core** as a single complete schema + tests (doc 01 §3), not in a satellite app that drifts.

## 2. What Must Be Preserved (re-homed before deletion)

The verification pass corrected the original audit here: the closed vocabularies (categories/acquisitions/currencies) are **not** exclusive to the maintainer — they are independently hardcoded in `build-locales.ts:289-423`, `DyeFilter.ts:20-23`, and (divergently) `dye-palette-drawer.ts:33-45`. Worse, the maintainer's copies are *wrong*: 8 of its 10 acquisition values appear in zero dyes (`Ixali Vendor`, `Crafting`, `Achievement`, `Retainer Venture`, `Mogstation`, …) while 3 real ones are missing, and its currency list can't express `Venture Coffer` or `Skybuilders' Scrips`. **So the preservation task is consolidation, not rescue**: define the enums once in core (doc 01's schema) and delete every duplicate.

Genuinely worth porting or documenting:

| Item | Source | Where it goes |
|------|--------|---------------|
| Required-field checklist + field derivation rules (RGB/HSV from hex, 2-dp rounding, hex lowercased/6-digit/`#`-prefixed) | `DyeForm.vue:83-101`, `src/services/colorService.ts:11-54` | Core schema + doc; v2 derives these at init anyway (doc 01) |
| Uniqueness checks (itemID today; **stainID was never checked**) | `server/api.ts:225-246` | Core unit test asserting stainID + legacyItemID uniqueness |
| Price/currency coupling per acquisition | `src/utils/constants.ts:91-103` | `ACQUISITION_META` in core (doc 01 §3) |
| XIVAPI recipe: `GET https://v2.xivapi.com/api/sheet/Item?rows={id}&language={lang}`, en/ja/de/fr only, 10 s timeout, `Promise.allSettled` fan-out | `src/services/xivapiService.ts:11-58` | The workflow doc (§3 below) |
| **Dye-prefix stripping incl. the U+FF1A full-width colon** (BUG-081) | `xivapiService.ts:94-117` | Largely **obsolete** under v2 — names come from the Stain sheet, which has no prefix (doc 01 §5). Keep the recipe in the workflow doc only as a fallback for Item-sheet lookups |

## 3. The Replacement Workflow (Claude-assisted dye addition)

`docs/maintainer/adding-dyes.md` (359 lines) already documents the manual procedure — it becomes canonical and gets amended, not rewritten. Target procedure once schema v2 lands:

1. **Discover the new stain(s).** After a patch, diff a fresh `Stain` sheet export (Dalamud/Lumina dump, e.g. via the cloned companion-plugin repos at `C:\dev\ClonedProjects\`, or XIVAPI v2 `sheet/Stain`) against the current `dyes.json` stainIDs. New rows give: stainID, name, packed BGR color → hex, gloss flag, shade/subOrder.
2. **Determine purchase resolution.** Check `StainTransient` for the new rows: dedicated item → `legacyItemID`; resolves to a Spectrum item (52254/52255/52256) or no item → `legacyItemID: null` + the matching `consolidationType`. Acquisition comes from patch notes/vendor data.
3. **Add the entry** to `dyes.json` (7 fields, doc 01 §3). Category is the one editorial judgment; everything else is mechanical.
4. **Names:** en/ja/de/fr from the Stain sheet via XIVAPI v2 (no prefix stripping needed); ko/zh manually sourced into `dyenames.csv` as today.
5. **Run the pipeline:** `build:locales` → `pnpm turbo run build test --filter=@xivdyetools/core`. The core schema test (§2) enforces uniqueness/enums/hex format — the maintainer's validation role, now in CI.
6. Version bump + publish per the standard flow.

This is exactly the shape of task the "open a Claude session and ask" model handles well: every input is a file diff or a sheet lookup, and every invariant is enforced by a test rather than a UI.

## 4. What Dies With the App

The Vue UI (color picker, preview card, toasts, validation panel); the entire Express sidecar and its local-loopback security scaffolding (session tokens, three rate limiters, path-traversal guard, CORS pin, production guard — all existing only so a browser could write local files); the destructive Zod schemas **as written** (do not port them — regenerate from `packages/types` + a fresh read of `en.json`); the locale-JSON write path (always a no-op at best, since `build:locales` regenerates); `meta.dyeCount`/`meta.generated` bumping (owned by `build-locales.ts`); the duplicate-check-as-network-call; its vitest suite, tailwind/postcss configs, and changelog.

**Dependency payoff:** `express`, `cors`, `express-rate-limit`, `concurrently`, `tsx`, `vue`, `@vitejs/plugin-vue`, and `vue-tsc` are unique to this app in the monorepo — deletion removes the whole family from the lockfile.

## 5. Cleanup Checklist

**Preserve first:**
- [ ] Core enums + `ACQUISITION_META` + schema/uniqueness tests (per §2; lands naturally with doc 01's v2 work)
- [ ] Amend `docs/maintainer/adding-dyes.md` into the canonical workflow (§3)

**Code/config:**
- [ ] `rm -rf apps/maintainer` (incl. stray `dist/`, `.turbo/`)
- [ ] `scripts/coverage-report.ts:236` — remove `skippedApps = ['maintainer']` and its guard block
- [ ] `pnpm install` to regenerate the lockfile (drops the express/vue dependency family; confirm nothing else pins the same tailwind/postcss majors first)
- [ ] No changes needed in `turbo.json`, `pnpm-workspace.yaml`, `eslint.config.js`, or any `.github/workflows/*` — the app is referenced only by glob and was never deployed or published

**Docs:**
- [ ] Remove rows/lines: root `README.md:42`, root `CLAUDE.md:37`, `docs/CLAUDE.md:39`, `docs/README.md:31,77`, `docs/maintainer/index.md:13`
- [ ] `docs/maintainer/dye-maintainer-tool.md` — replace with a tombstone pointing at `adding-dyes.md`
- [ ] `docs/architecture/dependency-graph.md:37,136,141,161,225-231` — remove `MAINT` node, rows, and deps subsection; `docs/architecture/overview.md:186` — drop from core's consumers
- [ ] `packages/core/CLAUDE.md:9,211` — remove both mentions
- [ ] `DEPRECATIONS.md` — add an entry linking here and to `adding-dyes.md`
- [ ] Leave untouched: all `CHANGELOG.md` history and `docs/audits/**` (historical record)
