# Dead Code Analysis Report — `xivdyetools-og-worker`

## Cleanup executed — 2026-08-18

All four waves ran the same day, one commit each on `monorepo-2.0-prep` (not pushed):

| Wave | Commit | Findings | Result |
|---|---|---|---|
| 1 — safe removals | `a8201b32` | 002 003 004 005 006 007 008 009 013 015 016 017 | tsc clean **with** the base `noUnused*` flags; 294 → 231 tests (63 deleted with `base.test.ts` and the colour-sheet describes); coverage 98.7/92.3/99.1/99.2 |
| 2 — consolidations | `ebcac54c` | 011 012 014 021 023 024 026 027 | 111 generator/HTML snapshots byte-identical before/after; `services/svg/tokens.ts` created; 231/231 |
| 3 — the fixes | `f3ad612c` | 001 010 019 022 028 | 21 tests written red-first, then green; 252/252; beta workflow follows a `/budget/?dye=102` embed too |
| 4 — assets & docs | (this commit) | 018 020 025 | CJK subsets −45 KB (cmap-verified, +0 glyphs); `src/index.ts` back in the coverage gate (95.1/89.8/98/95); CLAUDE.md / README / CHANGELOG / overview / versions; og-worker **2.1.0** |

Deviations from the plan, all deliberate:
- **DEAD-001 product calls:** extractor — the image route and `generateExtractorOG` now accept bare `RRGGBB` (the web-app share grammar has no shares) and draw *equal, ranked* bands with no invented percentage; presets — the web app shares a preset as the **path** `/presets/<id>`, so a `/presets/:presetId` crawler route was added (curated slugs → card, `community-<uuid>` / unknown → presets default); budget — `?hex=` targets degrade to the budget default (the image route is stainID-keyed).
- **DEAD-022:** option (a) — forward `algo`, normalised; default/unknown values stay off the URL.
- **DEAD-019:** removed without a dashboard check (no Analytics access from this session). The double was a constant 0, so any saved query on `double2` was reading nothing.
- **DEAD-023:** `initRenderer` / `renderSvgToPng` / `X_STRIP_SCALE` un-exported; the `generate*OGData` ×6 and `detectCrawler` stay exported (tests).
- **DEAD-025:** un-excluding `src/index.ts` kept the gate green — left un-excluded.
- **Route ↔ emitter parity test** (recommended below) was added; swatch is exempted from its bare-URL half because a bare `/swatch/` has always rendered a white-target card (pre-5.0 behaviour, out of scope — worth its own decision).
- Wave 2's `wrangler deploy --dry-run` after: 4,367 KiB raw / 1,887 KiB gzip; a like-for-like "before" build could not be produced from a worktree (pnpm install), so the size delta is stated from the measured font files (−45 KB) rather than a bundle pair.

**Recommendations resolved (follow-up commit, same day):** knip wired as `pnpm lint` (both modes — see the correction in the evidence README: `--production` needs the `!` on the *project* glob too; it was never unusable), table-driven `?frame=x` test over all 12 image routes, `services/font-coverage.test.ts` (TTF `cmap` coverage of every runtime string, parser verified against fonttools' counts), the card-design sweep line in CLAUDE.md, and the bare `/swatch/` white-target card replaced by the swatch default (the parity-test exemption is gone).

## Executive Summary

- **Project:** `apps/og-worker` (`xivdyetools-og-worker` 2.0.0)
- **Analysis Date:** 2026-08-18 — branch `monorepo-2.0-prep` @ `e6eccf83`, clean tree, 294/294 tests green
- **Analysis Depth:** standard — symbol-level over 4,283 non-test TS lines / 24 files, plus `tests/`, `scripts/`, config, fonts, and the three docs
- **Total Findings:** 28
- **Recommended removals / refactors / updates:** 22 · **Keep-with-fix:** 3 (DEAD-001, 010, 025) · **Keep:** 3 (DEAD-023 mostly, 028)
- **Estimated dead lines:** ≈ 500 prod TS (11.7 % of src) + ≈ 15 Python + ≈ 520 test lines + ≈ 45 KB of font glyphs
- **Estimated dead files:** 2 (`services/svg/base.ts`, `services/svg/base.test.ts`)

## Health Score

**Code Freshness: D by the rubric (11.7 %) — but concentrated.** Two items account for two-thirds of it: the character-colour-sheet block left in `dye-helpers.ts` after the 15E rewrite (DEAD-002, 263 lines) and the pre-5.0 `base.ts` shim (DEAD-004, 77 lines + its 342-line test). Excluding those two, the worker sits around **4 % (B)** — the usual sediment of a big rewrite: dead options, duplicated helpers, comments that still say itemID and 1200×630.

The more important discoveries are not surplus but **holes wearing dead-code clothing**:

1. **DEAD-001** — the three 5.0 tools' image routes (`/og/extractor|presets|budget/*`, 276 lines of finished card code) are unreachable from any emitted `og:image` URL because `generateOGDataForTool` has no cases for them. Already a "known gap" in `overview.md`; `index.test.ts:433` *asserts* the gap. Web-app **does** produce extractor/budget share links.
2. **DEAD-010** — the comparison route forgets `frame`, so `twitter:image` for a comparison is a 1200×1050 card X will crop — the failure the X frame exists to prevent.
3. **DEAD-008** — og-worker opts out of the repo's `noUnusedLocals`, which is how DEAD-007's unused imports shipped.

## Summary by Category

| Category | Count | Remove / Refactor / Update | Keep (+fix) | Est. lines |
|----------|-------|----------------------------|-------------|-----------|
| Dead Code Paths | 8 | 5 + 1 refactor-first | 2 (fix) | ~325 src, ~180 test |
| Unused Exports | 4 | 3 | 1 | ~145 |
| Unused Imports | 1 | 1 | 0 | 5 |
| Unused Types | 3 | 3 | 0 | ~23 |
| Legacy / Duplication / Docs | 6 | 6 | 0 | ~60 + docs |
| Stale Tests | 2 | 1 | 1 (revisit) | 342 test |
| Stale Code (comments / assets) | 4 | 3 | 1 | ~25 comments, 45 KB |

Per-category tables: [`by-category/`](by-category/). Every finding: [`findings/DEAD-0NN.md`](findings/).

## Quick Wins (High Confidence, Safe to Remove)

| ID | Description | File(s) | Lines saved |
|----|-------------|---------|-------------|
| [DEAD-002](findings/DEAD-002.md) | Character-colour-sheet lookup block, prod-dead; `new CharacterColorService()` at module load | `services/svg/dye-helpers.ts` (+ test) | ~263 + ~180 test |
| [DEAD-004](findings/DEAD-004.md) | `base.ts`: indigo `THEME`, 1200×630 `OG_DIMENSIONS`, `linearGradient`, 10 unused re-exports | `services/svg/base.ts` | 77 (file) |
| [DEAD-005](findings/DEAD-005.md) | `base.test.ts` re-tests `@xivdyetools/svg` | `services/svg/base.test.ts` | 342 test |
| [DEAD-006](findings/DEAD-006.md) | `cjkStack`, `FONT_FAMILIES` | `services/fonts.ts` | 27 |
| [DEAD-007](findings/DEAD-007.md) | Unused imports (`normalizeMatchingMethod`, `ColorConverter`), duplicate import, 2× `beforeEach` | `index.ts`, `dye-helpers.ts`, 2 tests | 5 |
| [DEAD-009](findings/DEAD-009.md) | `Env.OG_CACHE`, `ShareParams`, `perceptual`, `SwatchParams.index` | `types.ts`, `og-data-generator.ts` | ~12 |
| [DEAD-013](findings/DEAD-013.md) | Barrel over-exports + `X_STRIP_SCALE` | `services/svg/index.ts`, `band.ts` | ~40 |
| [DEAD-015](findings/DEAD-015.md) | Dead `async` on `generateSwatchOG` | `swatch.ts`, `index.ts` | 3 |
| [DEAD-016](findings/DEAD-016.md) | Orphaned JSDoc blocks | `index.ts`, `og-data-generator.ts` | ~20 |
| [DEAD-021](findings/DEAD-021.md) | 13 impossible source-font fallback paths | `scripts/subset-cjk-fonts.py` | ~15 |

## Recommended Removals / Refactors (Medium effort — verify the noted point first)

| ID | Description | Verify before doing |
|----|-------------|--------------------|
| [DEAD-003](findings/DEAD-003.md) | Swatch `sheet/race/gender` on the image path + `og:image` URL | Keep the crawler-*description* use in `generateSwatchOGData`; only the image route / image URL / `SwatchOGOptions` go |
| [DEAD-011](findings/DEAD-011.md) | og-data-generator's private copies of translator helpers | Output must stay byte-identical (same regex, same provider calls) — the og-data-generator tests will tell |
| [DEAD-012](findings/DEAD-012.md) | harmony.ts inline NOT FOUND band → `notFoundBand`/`bandGlyph` | `harmony.test.ts` NOT FOUND assertion (deck/label are the same string) |
| [DEAD-014](findings/DEAD-014.md) | `renderOGImage` render-param defaults + 1200×630 comments | Make the 15E render the default (or required) so a forgotten arg can't silently ship 400×350 |
| [DEAD-019](findings/DEAD-019.md) | `cacheHit` always false | Analytics Engine `doubles` are positional — check saved queries for `double2` |
| [DEAD-024](findings/DEAD-024.md) | Local `PresetPalette` → `@xivdyetools/types` | `PresetData` shape vs `presets.json` |
| [DEAD-027](findings/DEAD-027.md) | Tokens re-typed (stacks ×3, ground ×5, stripes ×3, glyph ink ×5) | Pure refactor; snapshot a couple of SVG outputs before/after |
| [DEAD-020](findings/DEAD-020.md) | Regenerate CJK subsets (−99 glyphs, −45 KB) | Compare by cmap not md5; nothing is *added* so it can wait for the next string change |
| [DEAD-017](findings/DEAD-017.md), [DEAD-018](findings/DEAD-018.md) | Comment/docs drift (itemID, 1200×630, worker-middleware, README "own theme", CLAUDE.md deps table) | Docs only |
| [DEAD-026](findings/DEAD-026.md) | `VisionType` dup, `VALID_*` hand-copies | Cosmetic; only if the file is open |

## Keep / Monitor

| ID | Description | Reason to keep |
|----|-------------|----------------|
| [DEAD-001](findings/DEAD-001.md) | extractor / presets / budget image routes + generators unreachable from crawler flow | The generators are the product; **write the three missing `generate*OGData` cases**, flip the test that pins the gap, extend the beta e2e to a 5.0 tool. Deleting 276 lines of finished cards would be backwards. |
| [DEAD-010](findings/DEAD-010.md) | comparison X-frame branch unreachable | One-line route fix (`frame: frameFromQuery(c)`) + a route-level `?frame=x` test |
| [DEAD-022](findings/DEAD-022.md) | harmony/gradient/mixer `algo` parsed, not forwarded | Product call: forward it like swatch does (card matches page) or stop parsing it |
| [DEAD-023](findings/DEAD-023.md) | `generate*OGData` ×6, `detectCrawler` exported for tests | Testability; un-export only `initRenderer`, `renderSvgToPng`, `X_STRIP_SCALE` (zero consumers of any kind) |
| [DEAD-025](findings/DEAD-025.md) | `index.ts` excluded from coverage despite 471 test lines | Try un-excluding — the renderer mock should keep binaries out; if the gate drops, that's information |
| [DEAD-028](findings/DEAD-028.md) | Commented-out Googlebot | Deliberate SEO decision (CLAUDE.md) — keep the *decision*, drop the commented code, **add the missing test** |

## Dependency Cleanup

| Package | Status | Recommendation |
|---------|--------|---------------|
| `@xivdyetools/svg` | Used (`toolGlyph`, `GLYPH_ACCENT_LIGHT`, `escapeXml`, `estimateTextWidth`) | Keep — **add to CLAUDE.md's dependency table** (DEAD-018) |
| `@xivdyetools/core` | Used; `ColorConverter` import unused (DEAD-007); `CharacterColorService` import goes with DEAD-002 | Keep |
| `@xivdyetools/types` | Used; `RACE_SUBRACES`/`SubRace`/`Gender`/`Race` imports go with DEAD-002 | Keep |
| `@resvg/resvg-wasm`, `hono`, `@xivdyetools/worker-kit` | Used | Keep |
| `@cloudflare/workers-types` | Types-only, listed under `dependencies` (all 7 workers do this) | Consistent repo-wide; not og-worker's to fix alone |
| `@types/node` | Needed only by `tests/wrangler-env.test.ts` and `vitest.config.ts` (`path`); no Node API in `src/` (correct — no `nodejs_compat`) | Keep as devDependency |

No unused packages. `pnpm exec knip --production` is not trustworthy for this workspace (see `evidence/README.md`).

## Cleanup Execution Plan

Four commits, each leaving `pnpm type-check && pnpm test` green (baseline 294/294). Recommended order keeps the guardrail (DEAD-008) landing right after the imports it would flag.

### Wave 1 — Safe removals (no behaviour change)
1. **DEAD-007 + DEAD-016 + DEAD-017** — unused imports, orphaned JSDoc, itemID/1200×630 comments (touch `index.ts`, `types.ts`, `dye-helpers.ts`, `renderer.ts` once).
2. **DEAD-008** — delete the three tsconfig overrides → tsc now enforces it.
3. **DEAD-002 + DEAD-003 + DEAD-015** — the character-colour block, the swatch dead options (image path only), the dead `async`; trim `dye-helpers.test.ts`.
4. **DEAD-004 + DEAD-005 + DEAD-013 + DEAD-006** — delete `base.ts`/`base.test.ts`, import from `@xivdyetools/svg` directly, trim the barrel, drop `cjkStack`/`FONT_FAMILIES`.
5. **DEAD-009** — types.ts dead members (+ the `perceptual` parse line).
6. `pnpm type-check && pnpm test` — expect 294 − (removed describes) green; coverage still ≥ 85 %.

### Wave 2 — Refactors (small behaviour-neutral consolidations)
1. **DEAD-011** (translator helpers), **DEAD-012** (harmony NOT FOUND), **DEAD-024** (PresetPalette type), **DEAD-014** (renderer defaults), **DEAD-027** (tokens), **DEAD-026** (optional).
2. **DEAD-021** — Python script fallback paths.
3. Snapshot 2–3 generated SVGs before/after (harmony hit + miss, default card) to prove byte-identity.

### Wave 3 — The fixes (behaviour changes; each its own commit)
1. **DEAD-010** — comparison route `frame` + route-level test.
2. **DEAD-001** — `generateExtractorOGData` / `generatePresetsOGData` / `generateBudgetOGData` + cases; invert `index.test.ts:433`; extend `deploy-og-worker-beta.yml` to a 5.0 tool; drop the "known gap" line in `overview.md`. Decide the extractor share-grammar mismatch (`colors=` without shares vs `RRGGBB-share`) up front.
3. **DEAD-022** — decision + `algo` forwarding (or parse removal).
4. **DEAD-019** — after checking Analytics saved queries.
5. **DEAD-028** — Googlebot comment + the missing test.

### Wave 4 — Assets & docs
1. **DEAD-020** — regenerate the three CJK subsets, commit.
2. **DEAD-018** — README line 92, CLAUDE.md deps table + file map + bindings row + route-table swatch cell, index.ts `worker-middleware` comment; CHANGELOG entry; bump `package.json` (2.0.0 → 2.0.1 for waves 1–2, 2.1.0 if wave 3 ships).
3. **DEAD-025** — try un-excluding `src/index.ts` from coverage.

## Post-Cleanup Verification

- [ ] `pnpm --filter xivdyetools-og-worker run type-check` clean **with** the base `noUnused*` flags inherited
- [ ] `pnpm --filter xivdyetools-og-worker run test` — all remaining tests green; coverage ≥ 85/80/85/85
- [ ] `pnpm exec knip --config <evidence/knip.og.jsonc> --workspace apps/og-worker` — zero unused exports/types
- [ ] `wrangler deploy --dry-run --outdir /tmp/og` — bundle builds; size drops by ≥ 45 KB after DEAD-020
- [ ] Beta deploy: `og-beta.xivdyetools.app/og/harmony/1/tetradic.png` renders; after DEAD-001, a `/extractor/?colors=…` crawler fetch emits `/og/extractor/…` (or at least `/og/extractor/default.png`)
- [ ] After DEAD-010: `curl 'https://og-beta.xivdyetools.app/og/comparison/1,2,3.png?frame=x' | file -` → 1200×630

## Recommendations (preventing recurrence)

- **Inherit the base tsconfig flags** (DEAD-008). This one line would have caught DEAD-007 at commit time.
- **Add a knip step** to this worker (`lint:dead` like web-app) using `evidence/knip.og.jsonc` as the seed — but budget for its blind spot: anything a test imports looks alive, so pair it with a periodic `symrefs`-style prod-only count.
- **Route ↔ emitter parity test**: one test that, for every tool in `SUPPORTED_TOOLS`, `generateOGDataForTool` with a representative query emits an image URL under `/og/<tool>/` — this is the test that would have made DEAD-001 red instead of green.
- **Every image route passes `frame`**: a table-driven route test with `?frame=x` asserting `height="210"` in the SVG (DEAD-010's class).
- **Compare font subsets by cmap** in any future "are the subsets stale?" check; md5 lies.
- Quarterly sweep after each card-design revision — this worker's dead code is almost entirely rewrite sediment (v1 → 15E), so the trigger is "the cards changed", not the calendar.
