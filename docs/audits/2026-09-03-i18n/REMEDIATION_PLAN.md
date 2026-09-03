# Remediation Plan — 2026-09-03

**Sources:** `I18N_AUDIT_2026-09-03.md` (17 findings: 2 P1 + 1 P1 locale-independent, 6 P2, 9 P3) · **Status basis:** 18 total — 1 withdrawn (I18N-001, fixed upstream in `35914823`), 17 outstanding, 0 superseded, 0 KEEP, 0 need rotation
**Ordering:** 1. one deploy unit per sprint 2. no P0 exists — **Sprint 1 is a deliberate exception to "fonts last", explained below** 3. wrong text before missing text; fix the generator, not the artifact 4. terminal work last (re-cut the CJK subsets once every locale string is final)

## Sprint 0 — Decisions (no code)

Two findings cannot be scheduled until a human decides. Neither blocks the other sprints.

| ID | Source | Tier | Action |
|---|---|---|---|
| I18N-009 | i18n | P3 | **Is moderation-worker meant to be localized?** If no (the defensible answer — it is staff-only, inside a channel the worker itself restricts, and preset authors are notified by discord-worker instead): delete the six-entry `locales` map and the unused `preset.status.*` keys, add a line to that worker's `CLAUDE.md`. If yes: it becomes a sprint of its own, not a cleanup. |
| TERM-002 (row 3) | i18n | P3 | **`acquisitions.Crafting`: is `製作` or `制作` correct?** core says `製作`, the dictionary says `制作`. FFXIV JP uses `製作`, so the *dictionary* is probably wrong. Needs someone who can check the JP client; the other two rows of TERM-002 proceed regardless. |

## Sprint 1 — discord-worker + og-worker: make CJK weights real *(out-of-band)*

**Why this breaks the "fonts last" rule, deliberately.** That rule exists because a locale text change invalidates the *subsets*, so re-cutting early wastes work. FONT-001 is not a coverage problem — it is that `subset-cjk-fonts.py` emits **variable** fonts, so resvg draws every CJK glyph at the default Thin 100 and every `font-weight="600"/"700"` on a card is a no-op today, in ja/ko/zh only. Fixing the *script* (not the artifacts) is idempotent: Sprint 9 re-runs it and the instancing survives. Holding a P1 that degrades exactly the non-Latin locales behind five sprints of text work would be the wrong trade.

| ID | Sev/Pri | Locale(s) | Item |
|---|---|---|---|
| FONT-001 | P1 | ja ko zh | Make `apps/discord-worker/scripts/subset-cjk-fonts.py` instance each Noto subset to static Regular/SemiBold/Bold (follow `instance-latin-fonts.py` from PR #148), then re-cut. |
| FONT-001 | P1 | ja ko zh | Same change in `apps/og-worker/scripts/subset-cjk-fonts.py`; re-cut its three subsets. |
| FONT-001 | P1 | — | Replace the filename test in **both** `font-faces.test.ts` — `bundled.filter(f => /VariableFont/i.test(f))` — with an actual `fvar`-table check over every bundled face, and extend the weight loop past `['Space Grotesk','Onest']` to the CJK families. |

**Verify by rendering, never from the SVG string** — the string already says `font-weight="700"` today and draws thin.
**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker --filter=xivdyetools-og-worker` → merge → `deploy-discord-worker.yml` + `deploy-og-worker.yml` (both `deploy:production`; a bare `deploy` is the beta bot / the live beta site).

## Sprint 2 — core: fix the generator inputs *(publish)*

Everything here is generated data — the fix goes in `dyenames.csv`, `localize.yaml` or `build-locales.ts`, **never** in `src/data/locales/*.json`. One publish covers all five.

| ID | Sev/Pri | Locale(s) | Item |
|---|---|---|---|
| I18N-007 | **P1** | de | `dyenames.csv:114` — replace the truncated `Perlmutt-` with the real German name for Pearl White (take it from the JP/DE client or XIVAPI, not from this file). While there, scan for any other cell ending in a hyphen. |
| TERM-002 | P2 | ja | `build-locales.ts:283` `ニュートラル` → `無彩色系` (its eight sibling categories already use the 〜系 pattern); `:355` `染料販売業者` → `染色師`. Row 3 (`Crafting`) waits on Sprint 0. |
| I18N-008 | P2 | ja de fr ko zh | Add a slug-keyed source + a `facewearColors` namespace emitted by `build-locales.ts`, and a `getFacewearColorName(id, locale)` getter, so the 11 Facewear colours stop being English-only. Source names from the game's Facewear UI per locale. |
| I18N-003 | P3 | all | Decide `tools.*`: extend `ToolKey` + the table to all nine tools and adopt `getToolName()` in web-app/og-worker, or drop the namespace, getter and type. Removal is **MAJOR** (published API, no `@public` tag). |
| I18N-010 | P3 | all / fr | Delete (or wire up) the dead `General_Purpose` label; trim the French `Metallic` array to its one real value. |

**Ends with:** `pnpm --filter @xivdyetools/core run build:locales` → confirm the regenerated JSON is committed → `pnpm turbo run build type-check lint test --filter=@xivdyetools/core...` → bump `packages/core/package.json` → merge → Actions **"Publish Packages to npm"** (`@xivdyetools/core`).

## Sprint 3 — svg: stop drawing what no font can draw *(publish)*

| ID | Sev/Pri | Locale(s) | Item |
|---|---|---|---|
| FONT-002 | **P1** | all (locale-independent) | `preset-swatch.ts:226` — replace `${voteCount}★` with a localizable form (`12 votes`) or add U+2605 to the Latin subsets. Then make the gate structural: derive the emitted-glyph set by scanning `packages/svg/src/**` for non-ASCII literals *outside comments*, instead of the hand-maintained `CODE_GLYPHS = 'Δα·—…→↓–↔≈°÷♂♀#%'` that let `★` through. |
| I18N-011 | P3 | all / ja ko zh | Make `emptyLabel` and `authorLine` **required** parameters (a compile error beats a silent English default), and wrap `measuredRow`'s lead/sub in `fitText()`; add a ja/zh case to the widest card test. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/svg...` → bump `packages/svg/package.json` → merge → Actions publish. **Publish svg before bot-logic** (bot-logic depends on it).

## Sprint 4 — bot-logic: one vocabulary for the whole product *(publish)*

Depends on Sprint 2 (needs core's getters) and Sprint 3 (svg).

| ID | Sev/Pri | Locale(s) | Item |
|---|---|---|---|
| TERM-001 | P2 | ja ko zh de | Resolve harmony names via core `getHarmonyType()` (`commands/harmony.ts:103-112`) and vision names via `getVisionType()` (`commands/accessibility.ts:102`); delete the duplicated `harmony.*` / `accessibility.*` name keys from all six locale files. This is the naming half of PR #159's convergence — the same file already computes slots with core's `generateHarmonySlots`. |
| I18N-012 | P3 | ja zh fr | Normalize `：` vs `:` and the range dash in ja/zh; settle fr capitalization across `preferences.methods` / `blendingModes`. A pass by someone who reads each language, not a find/replace. Optional: a lint for half-width `:` ending a ja/zh label. |

**Ends with:** `pnpm --filter @xivdyetools/bot-logic exec vitest run src/i18n` (parity, orphan and **reverse key-existence** gates must stay green after the key deletions) → full gate → bump → merge → Actions publish.

## Sprint 5 — web-app: tokens and error codes *(deploy)*

| ID | Sev/Pri | Locale(s) | Item |
|---|---|---|---|
| FONT-003 | P2 | ja ko zh | Replace 75 hardcoded `font-family: 'Space Grotesk' / 'Fragment Mono' / 'Onest'` declarations across 22 files with `var(--font-display)` / `var(--font-mono)` / `var(--font-body)`, then extend `font-contract.test.ts` to fail on any `font-family:` in `src/**` naming a bundled family without a token. |
| I18N-005 | P2 | ja de fr ko zh | Carry presets-api's `error` code through `preset-submission-service.ts:325-326` instead of flattening to `submitFailed`, and add locale keys for the terminal codes — `USER_BANNED` first. Give the three server-only validation rules per-rule codes in `presets-api/src/services/validation-service.ts:377` so `presetValidationMessage()` can translate them. |
| TERM-003 | P3 | de | Render `colorPalette.metallic` from core (`getLabel('metallic')`) or align it to `Metallic`; its sibling `pastel` already matches core. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` + `pnpm --filter xivdyetools-web-app run validate:i18n` + `run build:check` (bundle budget) → merge → `deploy-web-app.yml`. Note I18N-005 spans two units — the presets-api half ships with its own `deploy:production`.

## Sprint 6 — discord-worker: localize the choice list *(deploy)*

Also picks up the new core / svg / bot-logic versions from Sprints 2–4.

| ID | Sev/Pri | Locale(s) | Item |
|---|---|---|---|
| I18N-006 | P2 | ja de fr ko zh | Add a `budget`/`preset` case to `choiceLocalizations()` (`commands/localize.ts:116-144`) resolving each of the 22 `QUICK_PICKS` ids to its core `dyeNames` entry per locale — copy the `dye`/`category` case's shape, keep the emoji prefix and the `v === value → undefined` fallback. Check the longest ja/de name against Discord's choice-name length cap. |

**Ends with:** full gate → merge → `deploy-discord-worker.yml` (`deploy:production`). **`register-commands` runs in CI on merge** — until it does, Discord still serves the old English choices.

## Sprint 7 — og-worker: carry the locale through the click *(deploy)*

| ID | Sev/Pri | Locale(s) | Item |
|---|---|---|---|
| I18N-002 | P2 | ja de fr ko zh | Wrap the `url:` sites in `withLang()` as the 17 `imageUrl` sites already are — at minimum the meta-refresh target (`og-data-generator.ts:654`) and the body link, which are the two a person actually follows. Decide `og:url` separately: carrying `?lang=` on a canonical URL is an SEO trade-off, not an obvious win. Add a test asserting `ogData.url` carries the locale. |

**Ends with:** full gate → merge → `deploy-og-worker.yml` (`deploy:production`; a bare `deploy` is the routed beta on `beta.xivdyetools.app`).

## Sprint 8 — housekeeping *(gate only)*

| ID | Sev/Pri | Locale(s) | Item |
|---|---|---|---|
| I18N-004 | P3 | all | Point api-worker's `VALID_LOCALES` and og-worker's inline list at one exported constant; decide whether bot-logic's `LOCALE_CODES` should re-export core's `SUPPORTED_LOCALES`; fix the JSDoc at `LocalizationService.ts:206`, wrong since ko/zh were added. |

**Ends with:** `pnpm turbo run build type-check lint test` across the graph. Rides along with whichever sprint touches these files rather than justifying its own release.

## Sprint 9 — TERMINAL: re-cut the CJK subsets

Runs **after every locale string above is final** — Sprints 2, 4 and 5 all change text, and TERM-002/I18N-008 add new Japanese glyphs (`無 彩 師` plus the Facewear names).

| Task | Detail |
|---|---|
| Re-cut | `python scripts/subset-cjk-fonts.py` in **both** og-worker and discord-worker. Sprint 1's script change means the re-cut stays statically instanced. |
| Verify | `font-coverage.test.ts` green in both (0 missing, and surplus back to 0); compare old vs new subsets **by cmap, never md5** — fonttools rewrites `head.modified` every run. |
| Re-verify weight | Render a ja and a ko card and confirm bold CJK actually looks bold. The SVG string is not evidence. |

**Ends with:** both workers' `deploy:production`.

## Superseded findings

None. I18N-001 was **withdrawn**, not superseded — the fix had already shipped in `35914823` (PR #161) before the audit's base was corrected.

## KEEP register

None — every finding is scheduled or is a Sprint 0 decision.

## Standing guidance

- **Verify each finding's evidence against the code before fixing — findings are leads.** This audit withdrew one finding and halved another's scope for exactly this reason.
- Confirm the working base against `origin/main` before starting a sprint; this checkout's local `main` habitually lags.
- One commit per task (or per sprint when tiny); run the gate at every sprint boundary; stage only your own paths (`git commit --only -- <paths>`) — another session shares this checkout.
- core, svg and bot-logic are **published**: a bump is required or the publish workflow no-ops, and publish order is svg → bot-logic.
- Never `d1 migrations apply`; no D1 work is in this plan.
- Re-run the audit's own gates after each sprint — `locale-diff.py`, `validate:i18n`, and both `font-coverage.test.ts` — and annotate executed sprints in the heading: **✅ COMPLETED &lt;date&gt; &lt;commits&gt;** + **Deploy needs:**.
