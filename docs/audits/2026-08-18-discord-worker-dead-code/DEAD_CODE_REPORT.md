# Dead Code Analysis Report — `apps/discord-worker` + its workspace packages

## Executive Summary

- **Project:** `xivdyetools-discord-worker` 5.0.0 and the seven packages it depends on — `@xivdyetools/{bot-logic, svg, core, worker-kit, auth, logger, types}` (+ the workspace-private `test-utils` devDependency) — at `monorepo-2.0-prep` `84b6cf1` (clean tree)
- **Analysis Date:** 2026-08-18
- **Analysis Depth:** standard — symbol-level. Tooling: knip 6.32 in monorepo mode (default **and** `--include-entry-exports`, cross-workspace resolution verified against raw grep), `tsc` with the repo's `noUnusedLocals`, legacy-marker and skipped-test greps, then **four parallel manual verification tracks** (A: the app · B: core · C: svg + bot-logic incl. a locale-key scan · D: logger/auth/worker-kit/types/test-utils) with every candidate grepped individually over **git-tracked** files and per-class public-method surveys where knip is blind. Headline claims of each track were re-verified independently before entering this report.
- **Total Findings:** 37 (DEAD-001 … DEAD-037)
- **Recommendations:** 21 REMOVE · 6 REMOVE WITH CAUTION (npm-published, README-documented API) · 8 REFACTOR FIRST (mostly *adopt-or-delete* decisions) · 2 KEEP registers
- **Estimated dead weight:** ~**5,400 source lines** (~11 % of the 48k in scope; ~7 % excluding `test-utils`) + ~**5,800 test lines** that only exercise dead code · **~11.4 MB of tracked files** (10.6 MB font, 798 KB JSON) · **249 of 621 bot locale keys** (~67 KB × 6 languages, statically bundled into the bot) · 3 core locale sections × 6 · 8 unused dependency declarations · 1 dead D1 binding in both deploy envs

Three things stand out:

> **1. The tool's blind spot is bigger than its report.** knip (test files as entries, `classMembers` off) found ~120 unused symbols; the manual tracks found the *larger* tier it cannot see — a 326-line service (`component-context.ts`), a 190-line moderation HTTP client, ~40 public class methods in core (~655 lines), `perf` in logger, `AsyncLRUCache`, the svg gradient helpers — all "used" only by their own tests. **Every TEST-ONLY item is a test that cannot fail.**

> **2. `@xivdyetools/test-utils` is ~87 % unconsumed** — 14 of ~134 exports are imported anywhere; eight whole files (1,565 src + 2,752 test lines) have zero external consumers, while discord-worker and nine of its test files keep their own local mocks (DEAD-005/026/027).

> **3. Shared packages carry helpers the apps re-implemented instead of importing** — HMAC signing (auth: dead; 4 app copies), race→clan tables (types: dead; 4 app tables), `MODERATION_LIMITS` (worker-kit: dead; moderation-worker re-declares it), `CATEGORY_DISPLAY` (svg: dead; 2 app copies). These are *adopt-or-delete* decisions (DEAD-019/023/024/014), and the consolidation register (DEAD-037) lists the live duplicates behind them.

Nothing here is a runtime bug hunt, but two defects surfaced: `/stats` always reports Universalis "Not configured" (`stats.ts:462` tests the wrong variable) and `extractor.ts:121` silently gets an RGB neighbourhood because of a stale `'rgb'` default in core (DEAD-010/035).

## Health Score

**Code Freshness: C** overall (weighted) — with very different grades per layer:

| Layer | Src lines | Dead / test-only | Grade | Dominant items |
|---|---|---|---|---|
| discord-worker TS | 15,278 | ~1,100 (7 %) + ~1,150 test | **C** | component-context, preset-api moderation client, 20 scattered exports |
| discord-worker config/assets | — | dead D1 binding ×2, 10.6 MB font, stale vitest/tsconfig | **D** | DEAD-007/008 |
| core TS | 13,511 | ~1,400 (10 %) + ~1,300 test; 798 KB data | **D** | 40 class methods, 11 utils, tooling |
| core locales | 6 files | 3 sections × 6 | **B** | DEAD-036 |
| svg TS | 5,201 | ~190 (3.6 %) | **B** | 6 helpers, 6 test-only exports |
| bot-logic TS | 2,975 | ~110 (3.7 %) | **B** | color-math.ts, mixer payload |
| **bot-logic locales** | 621 keys × 6 | **34 % orphan + 6 % test-only** | **F** | DEAD-011 |
| auth / logger / worker-kit / types | 7,412 | ~535 (7 %) | **C** | hmac family, `perf`, presets, contract types |
| **test-utils** | 3,797 | **~2,085 (55 %)** + 2,752 test | **F** | DEAD-026/027 |
| Dependencies | 8 package.json | 8 unused declarations | **B** | DEAD-022 |
| Test hygiene | ~55k lines | 0 skipped, 0 commented-out blocks; 1 test-of-a-mock file, ~50 duplicated lines, 3 inert `vi.mock`s | **B** | DEAD-006/007/017 |

The TypeScript layers are individually respectable for a monorepo one week past a major release; the C is earned by the two data layers nobody re-audited after 5.0 (bot locales, test-utils) and by core's SDK-shaped API being much wider than its three consumers use.

## Summary by Category

| Category | Count | Remove | Caution | Refactor first | Keep | Approx. size |
|----------|-------|--------|---------|----------------|------|--------------|
| Orphaned Files & Modules | 8 | 8 | — | — | — | ~2,700 src + ~3,300 test lines · 11.4 MB |
| Unused Exports / Types / Class members | 15 | 8 | 5 | 2 | — | ~2,300 src + ~1,900 test lines |
| Dead Code Paths / Legacy / Duplicates | 6 | 1 | — | 4 | 1 | ~110 lines now, ~105 after refactors |
| Dependencies / Config / i18n / Tests / Docs | 8 | 6 | 1 | — | 1 | 8 deps · ~35 config lines · 249 keys × 6 · 3 sections × 6 |

## Findings Catalog

### `apps/discord-worker` (Track A)

| ID | Title | Category | Conf. | Blast | Recommendation |
|----|-------|----------|-------|-------|----------------|
| [DEAD-001](findings/DEAD-001.md) | `services/component-context.ts` — 326-line service, 0 non-test consumers (+359 test); 3 docs call it live | Orphaned Module | HIGH | LOW | **REMOVE** (or re-park + fix docs) |
| [DEAD-002](findings/DEAD-002.md) | `services/preset-api.ts` moderation client (10 fns, ~191 + 260 test) — moved to moderation-worker | Unused Export | HIGH | LOW | **REMOVE** |
| [DEAD-003](findings/DEAD-003.md) | orphaned `services/svg/index.ts`, `types/image.ts`, `handlers/modals/index.ts` (+test) | Orphaned File | HIGH | NONE | **REMOVE** |
| [DEAD-004](findings/DEAD-004.md) | 20 dead/test-only exports across services & utils (~300 lines + tests) | Unused Export | HIGH | LOW | **REMOVE** |
| [DEAD-005](findings/DEAD-005.md) | `src/test-utils.ts` — 4 dead factories; duplicates `@xivdyetools/test-utils`; 9 local `createMockKV` | Stale Test / Duplicate | HIGH | LOW | **REMOVE** / REFACTOR FIRST |
| [DEAD-006](findings/DEAD-006.md) | re-export shims (`utils/color.ts`, `utils/verify.ts` + 220-line test of a mock), redundant barrel lines | Redundant re-export | HIGH | LOW–MED | **REMOVE** / REFACTOR FIRST |
| [DEAD-007](findings/DEAD-007.md) | dead D1 `DB` binding ×2 envs, `Env.IMAGES/ASSETS`, stale vitest excludes/mocks, `@/*` alias, unreachable branch | Dead Config | HIGH | LOW (deploy-visible) | **REMOVE** |
| [DEAD-008](findings/DEAD-008.md) | `fonts-src/NotoSansSC-Regular.ttf` — 10.6 MB tracked, script refuses to use it | Orphaned Asset | HIGH | NONE | **REMOVE** |
| [DEAD-009](findings/DEAD-009.md) | local `DiscordInteraction` in `index.ts` duplicates `types/env.ts` (65 lines) | Duplicate | HIGH | LOW | **REFACTOR FIRST** |
| [DEAD-010](findings/DEAD-010.md) | stale "legacy" comments + unreachable branch; **KEEP register** for KV migrations; `stats.ts` defect | Dead Path / Legacy | HIGH/MED | NONE | **REMOVE** / **KEEP** |

### `packages/bot-logic` + `packages/svg` (Track C)

| ID | Title | Category | Conf. | Blast | Recommendation |
|----|-------|----------|-------|-------|----------------|
| [DEAD-011](findings/DEAD-011.md) | **bot locales: 211/621 keys orphan (34 %) + 38 test-only, ~67 KB × 6, ships in the bot bundle** | i18n | HIGH | LOW | **REMOVE** + gate |
| [DEAD-012](findings/DEAD-012.md) | bot-logic `color-math.ts` whole module (72 + 63 test) — twin of the retired emoji ladder | Orphaned Module | HIGH | LOW | **REMOVE** |
| [DEAD-013](findings/DEAD-013.md) | `MixerResult.matches` dead runtime work, `getMeta()`, 3 core-type re-exports, unused test-utils devDep | Dead Path / Export | HIGH | LOW | **REMOVE** |
| [DEAD-014](findings/DEAD-014.md) | svg `arcPath`, `truncateText`, `rgbToHsv`, `DisplayOptions`, `AllVisionTypes`, `CATEGORY_DISPLAY` | Unused Export | HIGH | LOW | **REMOVE** / WITH CAUTION |
| [DEAD-015](findings/DEAD-015.md) | svg test-only `interpolateColor`, `generateGradientColors`, `rgbToHex`, `LEDGER_GROUP_H/ROW_H`, `GLYPH_SETS` | Unused Export | HIGH | LOW | **REMOVE WITH CAUTION** |
| [DEAD-016](findings/DEAD-016.md) | svg 9/20 panel glyphs never requested (1.5 KB in web-app bundle) | Dead Data | HIGH (usage) | NONE | **KEEP** / design call |
| [DEAD-017](findings/DEAD-017.md) | svg duplicated `describe` blocks, stale consumer docs, stoat-worker unused svg dep | Stale Test / Docs | HIGH | NONE | **REMOVE** |
| [DEAD-018](findings/DEAD-018.md) | `GLYPH_ACCENT_LIGHT` unused while `#CE2222` is hard-coded ×3 | Redundant token | MED | LOW | **REFACTOR FIRST** (wire it) |

### `packages/{auth, logger, worker-kit, types, test-utils}` (Track D)

| ID | Title | Category | Conf. | Blast | Recommendation |
|----|-------|----------|-------|-------|----------------|
| [DEAD-019](findings/DEAD-019.md) | auth `hmacSign`/`hmacVerify`/`hmacSignHex` dead — 4 apps hand-roll the same HMAC | Unused + Duplicate | HIGH | LOW | **REFACTOR FIRST** (adopt or delete) |
| [DEAD-020](findings/DEAD-020.md) | auth `isJWTExpired`, `getJWTTimeToExpiry`, `timingSafeEqualBytes` (documented, 0 callers) | Unused Export | HIGH | LOW | **REMOVE WITH CAUTION** |
| [DEAD-021](findings/DEAD-021.md) | logger `perf` (122, test-only), `getRequestId(request)` (dead; CHANGELOG claim false), `createSimpleLogger` | Unused Export | HIGH | LOW | **REMOVE** |
| [DEAD-022](findings/DEAD-022.md) | 8 unused dependency declarations (`logger` ×3 apps, `test-utils` ×2, `@testing-library/dom`, `typedoc-plugin-markdown`, stoat `svg`) | Unused Dependency | HIGH | NONE | **REMOVE** |
| [DEAD-023](findings/DEAD-023.md) | worker-kit `formatRateLimitMessage`, `MODERATION_LIMITS` (re-declared inline), `UNIVERSALIS_PROXY_LIMITS`, `EndpointRateLimitConfig` | Unused Export | HIGH | LOW | **REMOVE WITH CAUTION** / adopt |
| [DEAD-024](findings/DEAD-024.md) | types `RACE_SUBRACES`/`SUBRACE_TO_RACE`/`COLOR_GRID_DIMENSIONS` dead — 4 apps re-roll the tables | Unused + Duplicate | HIGH | LOW | **REFACTOR FIRST** (adopt or delete) |
| [DEAD-025](findings/DEAD-025.md) | types `createSnowflake`/`DiscordSnowflake`, `DyeDatabase` interface file, 5 chain-dead contract types | Unused Type | HIGH | LOW | **REMOVE** |
| [DEAD-026](findings/DEAD-026.md) | **test-utils: 8 whole files, 0 external consumers (1,565 src + 2,752 test)** | Orphaned Module | HIGH | LOW | **REMOVE** |
| [DEAD-027](findings/DEAD-027.md) | test-utils ~520 lines of unused extras + `utils/crypto.ts` pass-through + dup `randomId` path | Unused Export | HIGH | LOW | **REMOVE** |

### `packages/core` (Track B)

| ID | Title | Category | Conf. | Blast | Recommendation |
|----|-------|----------|-------|-------|----------------|
| [DEAD-028](findings/DEAD-028.md) | **`data/character_colors.json` — 798 KB orphan, still hand-maintained** | Orphaned File | HIGH | NONE | **REMOVE** |
| [DEAD-029](findings/DEAD-029.md) | `utils/index.ts` 11 documented helpers with 0 callers (~360) + test-only `AsyncLRUCache` (156) | Unused Export | HIGH | LOW | **REMOVE** / WITH CAUTION |
| [DEAD-030](findings/DEAD-030.md) | dead constants (`VISION_TYPES`, `VISION_TYPE_LABELS`, `API_DEBOUNCE_DELAY`, `SEPARATION_TIER_KEYS`) + `@internal` on barrel | Unused Export | HIGH | NONE | **REMOVE** |
| [DEAD-031](findings/DEAD-031.md) | orphan tooling: `test-build.mjs`, unwired TypeDoc (json + script + 2 devDeps), `VERSION` build step nobody reads | Orphaned / Config | HIGH | LOW | **REMOVE** (VERSION with caution) |
| [DEAD-032](findings/DEAD-032.md) | `band-calibration.ts` tooling on the runtime barrel; `RATIO_BANDS`; undiscoverable script | Barrel leak | HIGH | LOW | **REFACTOR FIRST** |
| [DEAD-033](findings/DEAD-033.md) | `/blending` `getBlendingModeDescription` (drifted strings), `rgbToLab` re-export — test-only | Unused Export | HIGH | LOW | **REMOVE** |
| [DEAD-034](findings/DEAD-034.md) | **~40 public class methods with 0 production callers (~655 + 790 test)** — APIService, DyeService chain, ColorService mix/spectral, PresetService, CharacterColorService, HyAB | Unused (class members) | HIGH | in-repo NONE | **REMOVE WITH CAUTION** |
| [DEAD-035](findings/DEAD-035.md) | 4 legacy dual-signature overloads with no production caller; stale `'rgb'` default `extractor.ts` relies on | Legacy | HIGH | LOW–MED | **REFACTOR FIRST** |
| [DEAD-036](findings/DEAD-036.md) | core locales `metallicDyeIds`/`jobNames`/`grandCompanyNames` × 6 with uncalled accessors | i18n | HIGH | LOW | **REMOVE WITH CAUTION** |
| [DEAD-037](findings/DEAD-037.md) | live duplicate implementations — consolidation register | Duplicate | — | — | **KEEP** / tickets |

## Quick Wins (High Confidence, Safe to Remove)

| ID | Description | Saves |
|----|-------------|-------|
| DEAD-008 | delete the 10.6 MB SC source font | 10.6 MB per clone |
| DEAD-028 | delete `character_colors.json` + fix CLAUDE.md:52 | 798 KB + a maintenance trap |
| DEAD-003 | 3 orphaned discord-worker modules | 72 + 17 lines |
| DEAD-022 | 8 unused dependency declarations | `pnpm install` + type-check only |
| DEAD-001 | `component-context.ts` + 2 tests (+ 3 doc fixes) | 685 lines |
| DEAD-002 | preset-api moderation client + tests | ~450 lines |
| DEAD-011 | 211 orphan bot locale keys (+ 38 test-only) | ~67 KB × 6 out of the bot bundle |
| DEAD-012 | bot-logic `color-math.ts` | 138 lines |
| DEAD-021 | logger `perf`, `getRequestId(request)`, `createSimpleLogger` | ~156 + 200 lines |
| DEAD-026 | 8 test-utils files | 1,565 + 2,752 lines |
| DEAD-030/031/033 | core dead constants, orphan tooling, blending test-only | ~230 lines + 2 devDeps |
| DEAD-007 | dead D1 binding, dead `Env` fields, stale vitest/tsconfig entries | config + a required-binding check that guards nothing |

## Recommended Removals (Documented API — remove with caution, one CHANGELOG entry each)

| ID | Description | Verify before removing |
|----|-------------|----------------------|
| DEAD-034 | ~40 core class methods | do it facade-first (`DyeService` → delegates, `ColorService` → `SpectralMixer`); `tsc` across the workspace catches ripples |
| DEAD-029 | 11 core utils helpers | README `lerp` example + CLAUDE.md:176 list |
| DEAD-014/015 | svg `arcPath`, `truncateText`, `rgbToHsv`, gradient helpers | og-worker `services/svg/base.ts` re-export lines go too |
| DEAD-020 | auth `isJWTExpired`, `getJWTTimeToExpiry`, `timingSafeEqualBytes` | README table |
| DEAD-023 | worker-kit rate-limit dead presets/helper | prefer adopting `MODERATION_LIMITS` in moderation-worker |
| DEAD-036 | 3 core locale sections | regenerate via `build-locales.ts` |

## Decisions the owner must make (REFACTOR FIRST)

| ID | Decision |
|----|----------|
| DEAD-019 | HMAC: adopt the auth helpers in 4 apps (recommended) **or** delete them |
| DEAD-024 | race→clan tables: derive 4 app tables from `@xivdyetools/types` (recommended) **or** delete the constants |
| DEAD-014 (`CATEGORY_DISPLAY`) / DEAD-023 (`MODERATION_LIMITS`) | same shape — adopt or delete |
| DEAD-005 / DEAD-006 | consolidate discord-worker's local mocks and retire the two re-export shims |
| DEAD-009 | one `DiscordInteraction` |
| DEAD-018 | wire `GLYPH_ACCENT_LIGHT` |
| DEAD-032 / DEAD-035 | core: un-barrel the calibration tooling; migrate then drop the legacy overloads; fix `extractor.ts:121` |
| DEAD-011 (`stats.*`) | localise `/stats` or drop its 31 keys |
| DEAD-016 | design owner: adopt the 9 panel glyphs in web-app or drop them |
| DEAD-031 (`VERSION`) | keep as deliberate public API or remove the build step |

## Keep / Monitor

| ID | Description | Reason to Keep |
|----|-------------|---------------|
| DEAD-010 | KV read-side migrations (`migrateLegacyPreferences`, `i18n:user:` fallback, favorites v1→v2), analytics old-data fallback, `about` "Removed in v5" | still load-bearing until the v5 KV cleanup / 5.1 — **and `cleanup-v4-kv.ts` has no `budget:world:v1:*` step, so add one** |
| DEAD-016 | 9 panel glyphs | designed set, 2026-08-07 |
| DEAD-037 | live duplicates | consolidation, not deletion |
| (various) | svg frame primitives, `*Options` types, logger adapters/`BaseLogger`, auth root `/encoding` alias, worker-kit preserved subpaths, core companion types, `LEGACY_FACEWEAR_ITEM_IDS` (frozen), `LEGACY_MATCHING_METHOD_MAP` | documented public API / structurally live / intentional compat |

## Dependency Cleanup

| Package | Where | Recommendation |
|---------|-------|---------------|
| `@xivdyetools/logger` | api-worker, oauth, presets-api (dep) | remove — reached only via worker-kit |
| `@xivdyetools/test-utils` | bot-logic, stoat-worker (devDep) | remove |
| `@testing-library/dom` | test-utils (devDep) | remove |
| `typedoc-plugin-markdown`, `typedoc` | core (devDep) | remove with the TypeDoc setup (DEAD-031) |
| `@xivdyetools/svg` (+ verify `core`, `worker-kit`) | stoat-worker (dep) | remove when the parked app is next touched |
| `@cloudflare/workers-types` | discord-worker `dependencies` | move to devDependencies (hygiene) |
| `@cloudflare/workers-types` peer `^4` vs dev `^5` | auth, worker-kit | align (hygiene) |

## Cleanup Execution Plan

Order chosen so each wave ends in one coordinated release and `tsc` catches every ripple.

### Wave 1 — Safe removals inside discord-worker (no package bumps)
1. DEAD-008 font · DEAD-003 orphans · DEAD-001 component-context (+ 3 docs) · DEAD-002 moderation client (+ 3 type re-exports) · DEAD-004 scattered exports · DEAD-005 dead factories · DEAD-006 barrel lines + `verify.test.ts` · DEAD-007 config (D1 binding, `Env` fields, vitest/tsconfig, stale mocks, unreachable branch) · DEAD-010 comments · DEAD-009 `DiscordInteraction`.
2. `pnpm turbo run test type-check lint --filter=xivdyetools-discord-worker`; `wrangler deploy --dry-run` for both envs.
3. File follow-ups: `stats.ts:462` defect; `budget:world:v1:*` cleanup step.

### Wave 2 — Data & test-utils (workspace-private, no npm impact)
1. DEAD-011 bot locale orphans (decide `stats.*` first) + orphan-key gate · DEAD-013 `getMeta` keys · DEAD-028 `character_colors.json` · DEAD-026 eight test-utils files · DEAD-027 test-utils extras · DEAD-022 dependency lines · DEAD-017 duplicated describes/docs.
2. `pnpm install && pnpm turbo run build test type-check`.

### Wave 3 — Package API tightening (one minor bump + CHANGELOG entry per package)
1. **bot-logic**: DEAD-012 color-math · DEAD-013 mixer payload/re-exports.
2. **svg**: DEAD-014/015 helpers · DEAD-018 accent token (wire it) · og-worker re-export lines.
3. **logger**: DEAD-021 (+ fix CHANGELOG DEAD-070). **auth**: DEAD-020 (+ DEAD-019 decision). **worker-kit**: DEAD-023 (+ adopt `MODERATION_LIMITS`). **types**: DEAD-025 (+ DEAD-024 decision).
4. **core**: DEAD-030 constants · DEAD-031 tooling · DEAD-033 blending · DEAD-029 utils · DEAD-032 un-barrel calibration · DEAD-036 locale sections · DEAD-034 class methods (facade-first) · DEAD-035 overload migration (+ `extractor.ts:121`).
5. Bump versions; publish through **Actions → "Publish Packages to npm"** (never from a local shell — see root CLAUDE.md); then bump the app deps.

### Wave 4 — Consolidation (optional, ticketed)
DEAD-037 register: adopt shared HMAC / race tables / `CATEGORY_DISPLAY` / `MODERATION_LIMITS`; unify `'cie2000'`/`'ciede2000'`; `blending/conversions.ts` ↔ `ColorConverter` (DEPRECATIONS.md:244).

## Post-Cleanup Verification
- [ ] `pnpm turbo run build test type-check lint` green across the workspace
- [ ] `wrangler deploy --dry-run` for discord-worker dev + production (D1 binding gone, nothing else changed)
- [ ] discord-worker gzip size re-measured (`check-bundle-size`-style) — expect a small drop from the locale prune (memory: 2,632 KiB vs 3,072 limit)
- [ ] `git count-objects -vH` / clone size down by ~11 MB
- [ ] Re-run knip with `evidence/knip.root.jsonc` — expect only the KEEP-register items and the `*Options`/frame-primitive types
- [ ] Docs listed in `by-category/dependencies-config-i18n-tests-docs.md` updated

## Recommendations (preventing regrowth)
1. **Add a knip gate to the packages and to discord-worker** like the web-app's `lint:dead` — the root config in `evidence/knip.root.jsonc` already resolves cross-workspace imports (knip source-maps `dist → src` via declaration maps, so no `paths` block is needed). Run `--include-entry-exports` in the packages so public-API drift is visible, and accept a curated ignore list for the documented-but-unconsumed frame/adapter surface.
2. **Turn on knip's `classMembers` rule for core** — the biggest tier this audit found by hand.
3. **Bot-logic locale orphan gate** (vitest) mirroring the web-app one; the scratchpad script `i18n_orphans.py` is the seed.
4. **Search hygiene for future audits:** restrict to `git ls-files` — `apps/web-app/e2e-coverage/*.json` embeds core's full source and makes every core symbol look live; `apps/*/coverage/**/*.html` does the same for the apps.
5. Tag legacy arms with `@deprecated` + a removal target (core has zero `@deprecated` tags today) and record removal triggers next to KV migrations.
6. When a helper lands in a shared package (HMAC, race tables, rate-limit presets), migrate the app copies in the same PR — three of this audit's "dead" package exports exist because that step was skipped.

## Out-of-scope observations (recorded, not audited)
- **web-app** redefines ~11 `@xivdyetools/types` contract types locally (`AuthUser`, `AuthResponse`, `JWTPayload`, `PrimaryCharacter`, `CommunityPreset`, `PresetListResponse`, `PresetFilters`, `VoteResponse`, `PresetSubmission`, `PresetEditRequest`, `PresetSortOption`×2, ~150 lines) — the real "shared types nobody shares" finding (Track D).
- **og-worker** `services/svg/base.ts` re-exports 14 svg symbols; 8 have zero non-test callers there (Track C).
- knip default mode also flagged unused exports/types in api-worker, oauth, presets-api, moderation-worker, og-worker — list in `evidence/knip-out-of-scope-apps.txt` (32 lines).
- svg `FONTS.cjk` stack has no Noto Sans JP although `packages/svg/CLAUDE.md` says JP must precede SC (observed by Track C, not audited).
- `apps/discord-worker/vitest.config.ts` runs the integration suite twice under `test:all` (DEAD-007) — a CI-time cost, not dead code.

## Evidence & method
See `evidence/README.md`. knip config + three raw outputs, `tsc`, legacy markers, skipped tests, and the four track notes (`track-A…D`, ~940 lines) with per-symbol commands. `--production` mode was abandoned (it failed to traverse discord-worker's handler tree even with `!`-marked entries); the "test-only" tier was recomputed by grep instead.

## Post-cleanup follow-ups (2026-08-18)

Items surfaced during cleanup that were deliberately left out of scope for this pass. Dispositions below as of the follow-ups plan (`FOLLOWUPS_PLAN.md`):

- **`/preferences set count` has zero production readers** since the `/mixer` `count` option was removed — it's now user-visible dead UI. **RESOLVED (`c52c5f42`)** — `count` now drives `/extractor color`'s default match count: explicit option › stored preference › default 1 (`PREFERENCE_DEFAULTS.count` changed 5→1).
- **`DyeSearch.findDyesWithinDistance`'s `'rgb'` default** — worth reconsidering now that `ciede2000` is the 5.0-wide default matching method elsewhere. **RESOLVED (`ff0a4631`/`100fa7fa`)** — the default is now `'ciede2000'`; unobservable in production since every caller already passes an explicit `matchingMethod`.
- **`hmacSignHex` adoption** (in `apps/discord-worker/src/services/preset-api.ts` and `apps/moderation-worker/src/services/preset-api.ts`) is blocked on giving `BOT_SIGNING_SECRET` / `GITHUB_WEBHOOK_SECRET` a ≥32-byte floor — `@xivdyetools/auth`'s `createHmacKey` (which `hmacSignHex` calls) enforces that minimum and today's secrets don't guarantee it. **RESOLVED (`517046b5`)** for both `preset-api.ts` sites — swapped in `hmacSignHex`, verified byte-identical against pinned vectors. `BOT_SIGNING_SECRET` ≥32 characters is now checked in both workers' `validateEnv` (log-only warning; production secrets were already ≥32 bytes in practice because presets-api verifies signatures via `@xivdyetools/auth`, which enforces the same floor). `github-verify.ts` deliberately stays hand-rolled — GitHub imposes no minimum webhook-secret length, so `GITHUB_WEBHOOK_SECRET` is **not** floored.
- **`blending/conversions.ts` ↔ `ColorConverter` unification declined**, with the deltas recorded in `DEPRECATIONS.md`. **Still DECLINED** — unchanged by the follow-ups plan.
- **web-app's ~11 local redefinitions of `@xivdyetools/types` contracts** (`AuthUser`, `AuthResponse`, `JWTPayload`, `PrimaryCharacter`, `CommunityPreset`, `PresetListResponse`, `PresetFilters`, `VoteResponse`, `PresetSubmission`, `PresetEditRequest`, `PresetSortOption`×2) remain out of scope for this cleanup. **RESOLVED (`a5d9e8b7`/`9a704911`)** — 10 of the 11 types are now imported from `@xivdyetools/types` (`PresetSortOption` was restored there to make the import possible); `VoteResponse` stays local because presets-api's HTTP 409 "already voted" response shape doesn't fit the shared `VoteErrorResponse` (see DEAD-025).
- **A knip gate for `packages/core` and `packages/svg`** is recommended, mirroring the web-app's `lint:dead` (see Recommendation 1 above) — not added in this pass. **RESOLVED (`9b709dfc`)** — root `knip.jsonc` plus `lint:dead` in `core`/`svg`/`bot-logic` with `includeEntryExports` and `@public` tags for deliberately-unconsumed exports; knip 6 does not offer a `classMembers` rule (see Recommendation 2 above, which assumed one did).

Follow-ups plan: `FOLLOWUPS_PLAN.md`.
