# Cleanup Plan — discord-worker + packages dead-code audit (2026-08-18)

Executes the four waves of `DEAD_CODE_REPORT.md`. The **spec** for every task is the finding files under `findings/` — each task names the ones it implements; read them first, they carry the exact symbols, files and line ranges. This plan only sequences and clusters them by deploy unit.

## Global Constraints (bind every task)

1. **Repo root is `xivdyetools/`** (the git root); branch `monorepo-2.0-prep`. Work in place. Commit at the end of your task with a conventional message (`chore(<scope>): dead-code cleanup <wave/task> — …`) and end the message with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. **Stage only the paths you changed** (`git add <paths>`, never `git add -A`/`-u`, never `git stash`) — another session may edit this checkout.
2. **Never publish, deploy, or push.** Version bumps and CHANGELOG entries only. Never run `pnpm publish` / `wrangler deploy` (a `--dry-run` is fine).
3. **Verify before deleting.** For every symbol/file you remove, re-run `git grep -nw <symbol> -- 'apps/*' 'packages/*'` first (use `git grep`, never `grep -r` — `apps/web-app/e2e-coverage/*.json` and `apps/*/coverage/` embed source and poison results). If a symbol has gained a live consumer since the audit, keep it and say so in your report.
4. **KEEP list — do not remove:** anything the finding files mark KEEP / LIVE / DOCUMENTED-PUBLIC-API / INTERNAL-ONLY (svg frame primitives and `*Options`/`*Labels` types, bot-logic `*Input`/`*Result` types, logger `BaseLogger`/adapters/`createBrowserLogger`, auth root `/encoding` re-exports and option types, worker-kit option types + preserved subpaths, core companion types, `facewearColors`/`LEGACY_FACEWEAR_ITEM_IDS`/`LEGACY_MATCHING_METHOD_MAP`, `RATIO_BANDS` (stays exported), the 9 svg panel glyphs (DEAD-016 KEEP), the discord-worker KV read-side migrations in DEAD-010's KEEP register, `resetRateLimiterInstance`, `registryCommandNames`).
5. **Tests must be green** for every workspace you touch: `pnpm turbo run test type-check lint --filter=<name>` (names: `xivdyetools-discord-worker`, `xivdyetools-moderation-worker`, `xivdyetools-oauth`, `xivdyetools-og-worker`, `xivdyetools-web-app`, `@xivdyetools/<pkg>`). When you change a **package's** exports, also run `pnpm turbo run build type-check --filter='./apps/*'` (or the whole workspace) so ripples surface. Delete or rewrite the tests that only exercised removed code — a test that cannot fail is dead too.
6. **Prettier:** run `pnpm prettier --write <touched files>` before committing (CI lint went red once from drift left by a cleanup wave).
7. **Docs travel with code:** when a finding lists stale docs (CLAUDE.md lines, README rows, CHANGELOG sentences), fix them in the same task.
8. **CHANGELOG / versions.** `@xivdyetools/{core 4.0.0, svg 2.0.0, bot-logic 2.0.0, types 2.0.0, auth 1.3.0, worker-kit 1.0.0}` are **unpublished** (npm has 2.7.0 / 1.2.1 / 1.3.0 / 1.15.0 / 1.2.0 / none) — add removals to the existing top (unreleased) CHANGELOG entry of that version under a `### Removed (2026-08-18 dead-code audit)` sub-heading; **no version bump**. `@xivdyetools/logger 1.3.0` **is published** — bump it to **2.0.0** and write a new entry (removing a public export is a major). `test-utils` is workspace-private: CHANGELOG entry, no bump. `apps/discord-worker` 5.0.0 is unreleased: add a `### Removed (2026-08-18 dead-code audit)` sub-section to its 5.0.0 entry.
9. Windows host: use `pnpm`, forward slashes, and the repo's existing scripts. Node ≥22.
10. Report file: write the full report to the path given in your dispatch; return only status, commits, one-line test summary, concerns.

---

## Task 1: Wave 1a — discord-worker whole-module removals (DEAD-001, DEAD-002, DEAD-003, DEAD-008)

Findings: `findings/DEAD-001.md`, `DEAD-002.md`, `DEAD-003.md`, `DEAD-008.md`.

Steps:
1. DEAD-008: `git rm apps/discord-worker/fonts-src/NotoSansSC-Regular.ttf`; update `fonts-src/README.md` and the comment block in `scripts/subset-cjk-fonts.py:71-75` so neither refers to the deleted file as present.
2. DEAD-003: delete `src/services/svg/index.ts`, `src/types/image.ts`, `src/handlers/modals/index.ts`, `src/handlers/modals/index.test.ts`. Remove any now-dangling `vitest.config.ts` coverage-exclude line for these paths.
3. DEAD-001: delete `src/services/component-context.ts`, `component-context.test.ts`, `component-context.storage.test.ts`; fix the three docs (`docs/projects/discord-worker/interactions.md:35`, `overview.md:84`, `apps/discord-worker/CLAUDE.md:111`) so they no longer describe it as live (a one-line "removed 2026-08-18; pagination context never shipped" is enough).
4. DEAD-002: in `src/services/preset-api.ts` delete `getFeaturedPresets`, `deletePreset`, `getCategories`, `getPendingPresets`, `approvePreset`, `rejectPreset`, `flagPreset`, `getModerationStats`, `getModerationHistory`, `revertPreset` and their `describe` blocks in `preset-api.test.ts`; then drop `ModerationStats`, `ModerationLogEntry`, `CategoryMeta` from `src/types/preset.ts` re-exports **only if** `git grep` shows no remaining discord-worker importer.
5. Add a `### Removed (2026-08-18 dead-code audit)` sub-section to `apps/discord-worker/CHANGELOG.md` 5.0.0 listing the above (Tasks 2–3 will append to it).
6. Verify: `pnpm turbo run test type-check lint --filter=xivdyetools-discord-worker`. Commit.

## Task 2: Wave 1b — discord-worker scattered exports, shims, duplicates, comments (DEAD-004, DEAD-005 part, DEAD-006, DEAD-009, DEAD-010)

Findings: `findings/DEAD-004.md`, `DEAD-005.md` (only the "4 dead factories" part — the consolidation is Task 5), `DEAD-006.md`, `DEAD-009.md`, `DEAD-010.md`.

Steps:
1. DEAD-004: remove every symbol in its table (+ dedicated test cases). Keep `resetRateLimiterInstance` and `registryCommandNames`.
2. DEAD-005: delete `createMockExecutionContext`, `createMockDye`, `createMockDyes`, `createMockPreset` from `src/test-utils.ts` (leave `createMockEnv` + its helpers for Task 5).
3. DEAD-006: trim the redundant barrel lines (`services/budget/index.ts`, `handlers/buttons/index.ts` preview re-exports, `bot-i18n.ts` `LocaleCode`, `types/preset.ts` `PresetSortOption`/`PresetStatus`); retire the two shims: rewrite the 11 `from './utils/color.js'` imports to `@xivdyetools/bot-logic` and `index.ts`'s `from './utils/verify.js'` to `@xivdyetools/auth`, update `vi.mock` targets (`index.test.ts` ~30 sites, `contrast.test.ts`), delete `utils/color.ts`, `utils/verify.ts`, `utils/verify.test.ts`.
4. DEAD-009: replace the local `DiscordInteraction` in `index.ts:1028-1092` with the exported one from `./types/env.js` (reconcile `type`/`values` differences minimally).
5. DEAD-010: delete the stale "Legacy commands (deprecated in v4…)" comments (`handlers/commands/index.ts:6-10,24`, `index.ts:28`) and the unreachable `ENVIRONMENT === 'development'` branch at `index.ts:~1107`. **Ruling from the controller:** also fix the surfaced defect — `handlers/commands/stats.ts:462` must test the `UNIVERSALIS_PROXY` service binding (as `services/budget/universalis-client.ts` `isUniversalisEnabled` does), not `UNIVERSALIS_PROXY_URL`; adjust its test. In `scripts/cleanup-v4-kv.ts` add a comment (do NOT add a deletion) noting that `budget:world:v1:*` has no cleanup step and that `migrateLegacyPreferences` reads it — the deletion is a product decision. Leave every KEEP row untouched.
6. Append to the discord-worker CHANGELOG sub-section. Verify: `pnpm turbo run test type-check lint --filter=xivdyetools-discord-worker`. Commit.

## Task 3: Wave 1c — discord-worker dead config (DEAD-007)

Finding: `findings/DEAD-007.md`.

Steps:
1. `wrangler.toml`: remove both `[[d1_databases]]` blocks (top-level and `[env.production]`) and the wrangler comment about D1; `types/env.ts`: remove `DB`, `IMAGES`, `ASSETS`; `utils/env-validation.ts:76`: remove the `DB` check (+ its test case); `src/test-utils.ts`: drop `createMockD1` and the `DB` field from `createMockEnv` (adjust callers).
2. `vitest.config.ts`: prune the stale coverage excludes (`src/locales/**`, `svg/dye-info-card.ts`, `svg/random-dyes-grid.ts`, `svg/budget-comparison.ts` and any left dangling by Task 1); change the include glob so `*.integration.test.ts` is not matched by the unit config (`vitest.integration.config.ts` owns it).
3. Remove the `@/*` alias from `tsconfig.json`, `vitest.config.ts`, `vitest.integration.config.ts`; remove the 3 stale `vi.mock` calls (`dye.test.ts:16-22`, `preset.test.ts:76-78`).
4. Verify: `pnpm turbo run test type-check lint --filter=xivdyetools-discord-worker`; `pnpm --filter xivdyetools-discord-worker exec wrangler deploy --dry-run` and `… --dry-run --env production` both succeed. Append to CHANGELOG. Commit. **This ends Wave 1** — put "Wave 1 complete" in the commit body.

## Task 4: Wave 2a — bot-logic locale orphans + orphan-key gate (DEAD-011)

Finding: `findings/DEAD-011.md`; raw list `evidence/bot-i18n-orphan-keys.txt`; scanner `evidence/scripts/i18n_orphans.py`.

Steps:
1. **Ruling from the controller:** `stats.*` (31 keys) is dropped, not localised — `/stats` keeps its hard-coded English.
2. Remove the 211 orphan keys AND the 38 test-only keys from all six `packages/bot-logic/src/i18n/locales/*.json` (keep the six files' key sets identical; keep `meta.flag`/`meta.nativeName` for now — Task 7 removes them with `getMeta()`). Remove the matching entries from the test mock tables (`about.test.ts`, the 14 `accessibility.*` mocks) so those tests assert on live keys only. Re-run the scanner logic to confirm 0 orphans remain (a key referenced only by a template prefix counts as live — see the finding's enumerated prefixes).
3. Add a vitest gate in bot-logic (e.g. `src/i18n/__tests__/locale-orphans.test.ts`) that enumerates `en.json` leaf keys and fails if any key is neither a string literal in a non-test `.ts` under `packages/bot-logic/src`, `packages/svg/src`, `apps/discord-worker/src`, `apps/stoat-worker/src`, nor covered by an explicit allowlist of dynamic prefixes (`preferences.keys.`, `manual5.topics.`, `accessibility.`, plus `meta.` until Task 7). Also assert key-set parity across the six locales. Mirror the web-app's i18n orphan gate style (`apps/web-app` — grep for its orphan test) but keep it self-contained.
4. Verify: `pnpm turbo run test type-check lint --filter=@xivdyetools/bot-logic --filter=xivdyetools-discord-worker`. Add the removal to bot-logic's CHANGELOG 2.0.0 entry (`### Removed (2026-08-18 dead-code audit)`). Commit.

## Task 5: Wave 2b — test-utils prune + discord-worker mock consolidation (DEAD-026, DEAD-027, DEAD-005 consolidation)

Findings: `findings/DEAD-026.md`, `DEAD-027.md`, `DEAD-005.md` (the REFACTOR FIRST part).

Steps:
1. DEAD-026: delete the eight files/dirs (`src/dom/*` + the `/dom` export + README section, `src/assertions/*` + `/assertions` export, `src/cloudflare/analytics.ts`, `src/factories/user.ts`, `src/factories/vote.ts`, `src/constants/secrets.ts`, `src/auth/context.ts`, `src/auth/signature.ts`) with their tests and barrel lines; remove `@testing-library/dom` from test-utils devDependencies (`pnpm install`); trim the nine chain-dead re-exports from `apps/presets-api/tests/test-utils.ts`.
2. DEAD-027: remove the listed extras from `factories/{dye,preset,category}.ts`, `constants/pkce.ts`, `auth/{headers,jwt}.ts`; delete `utils/crypto.ts` (internal callers import `@xivdyetools/auth/encoding` directly; ensure test-utils depends on `@xivdyetools/auth`); drop the duplicate `randomId`/`randomStringId` re-export from `factories/index.ts`.
3. DEAD-005 consolidation: make discord-worker's `src/test-utils.ts` `createMockEnv` compose `createMockKV` / `createMockAnalyticsEngine` (and whatever else it still needs) from `@xivdyetools/test-utils`; replace the nine local `createMockKV` definitions (about, stats, analytics, bot-i18n, i18n, preferences, preset-favorites, rate-limiter tests — component-context is gone) with the shared one **where behaviour matches**; if a local mock relies on a behaviour the shared one lacks, keep the local one and list it in the report.
4. Verify: `pnpm turbo run build test type-check --filter=@xivdyetools/test-utils --filter=xivdyetools-discord-worker --filter=xivdyetools-presets-api --filter=xivdyetools-moderation-worker --filter=xivdyetools-oauth --filter=xivdyetools-api-worker --filter=@xivdyetools/svg`. test-utils CHANGELOG entry (no bump). Commit.

## Task 6: Wave 2c — core data orphan, dependency lines, svg test/doc hygiene (DEAD-028, DEAD-022, DEAD-017)

Findings: `findings/DEAD-028.md`, `DEAD-022.md`, `DEAD-017.md`.

Steps:
1. DEAD-028: `git rm packages/core/src/data/character_colors.json`; fix `packages/core/CLAUDE.md:52`. Confirm `pnpm turbo run build test --filter=@xivdyetools/core` still passes.
2. DEAD-022: remove `@xivdyetools/logger` from `apps/{api-worker,oauth,presets-api}/package.json`; `@xivdyetools/test-utils` devDep from `packages/bot-logic` and `apps/stoat-worker`; `typedoc-plugin-markdown` from core (Task 11 removes `typedoc` itself); `@xivdyetools/svg` from `apps/stoat-worker` (also `@xivdyetools/core` / `@xivdyetools/worker-kit` there **only if** `git grep` confirms zero imports); move `@cloudflare/workers-types` in discord-worker from `dependencies` to `devDependencies`. `pnpm install`; `pnpm turbo run type-check --filter='./apps/*' --filter='./packages/*'`.
3. DEAD-017: delete the duplicated `describe('estimateTextWidth')` block (472-502) in `packages/svg/src/base.test.ts` (Task 8 deletes both `truncateText` blocks); fix `packages/svg/README.md` + `CLAUDE.md` consumer lists (stoat-worker is not a consumer).
4. Verify as above. Commit. **This ends Wave 2** — say so in the commit body.

## Task 7: Wave 3a — `@xivdyetools/bot-logic` API tightening (DEAD-012, DEAD-013)

Findings: `findings/DEAD-012.md`, `DEAD-013.md`.

Steps:
1. DEAD-012: delete `src/color-math.ts` + `color-math.test.ts` + the 3 barrel lines; update `packages/bot-logic/CLAUDE.md` §"Shared types & helpers". Then in `apps/discord-worker/src/handlers/commands/gradient.ts:176-180` replace the inline quality ladder with core's `classifyMatchDistance` (import from `@xivdyetools/core`; keep the displayed wording keyed off the returned tier — check `quality.*` locale keys stay live), adjusting `gradient.test.ts` expectations if thresholds change.
2. DEAD-013: remove the `matches`/`count` plumbing from `executeMixer` (`MixerInput.count`, `MixerResult.matches`, `MixerMatch`, `blendedHex`/`inputDyes`/`sweep` **only if** neither discord-worker `mixer-v4.ts` nor stoat-worker reads them — verify each); update `mixer.test.ts`; update discord-worker's `count` resolution for `/mixer` if it only fed this. Delete `Translator.getMeta()` and now the `meta.flag`/`meta.nativeName` keys ×6 (and drop `meta.` from the Task 4 gate allowlist). Remove the `MatchingMethod`/`BlendingMode`/`HarmonyColorSpace` re-exports from `src/index.ts` (and `commands/harmony.ts:347` pass-through) after confirming every consumer imports them from `@xivdyetools/core`.
3. bot-logic CHANGELOG 2.0.0 `### Removed (2026-08-18 dead-code audit)`. Verify: `pnpm turbo run build test type-check lint --filter=@xivdyetools/bot-logic --filter=xivdyetools-discord-worker --filter=xivdyetools-stoat-worker --filter=xivdyetools-moderation-worker`. Commit.

## Task 8: Wave 3b — `@xivdyetools/svg` API tightening (DEAD-014, DEAD-015, DEAD-018; adopt `CATEGORY_DISPLAY`)

Findings: `findings/DEAD-014.md`, `DEAD-015.md`, `DEAD-018.md`.

Steps:
1. DEAD-014: remove `arcPath`, `truncateText` (+ both `describe` blocks 368-384 and 450-470), `rgbToHsv`, `DisplayOptions` + `DEFAULT_DISPLAY_OPTIONS`, `AllVisionTypes`; remove og-worker's `services/svg/base.ts` re-export of `truncateText`. **`CATEGORY_DISPLAY` — adopt, not delete (controller ruling):** make `apps/discord-worker/src/types/preset.ts:165` and `apps/moderation-worker/src/types/preset.ts:62` import svg's `CATEGORY_DISPLAY` and delete their local copies (svg is already a dependency of discord-worker; add it to moderation-worker only if not present — check package.json — otherwise fall back to deleting svg's copy and record why).
2. DEAD-015: remove `interpolateColor`, `generateGradientColors`, `rgbToHex` (+ og-worker re-export line + tests), the `LEDGER_GROUP_H`/`LEDGER_ROW_H`/`GLYPH_SETS` barrel lines (+ their `index.test.ts`/`tool-icons.test.ts` assertions). Optional barrel trim of `placeGlyph`, `appIcon`, `formatMeasure`, `bandSlices`, `ACCENT`, `NUMFMT` — do it only if `git grep` shows no external importer.
3. DEAD-018: replace the hard-coded `#CE2222` in `packages/svg/src/frame.ts:305`, `apps/og-worker/src/services/svg/band.ts:140`, `apps/web-app/src/services/theme-service.ts:78` with `GLYPH_ACCENT_LIGHT` imported from `@xivdyetools/svg` (web-app already depends on svg for glyphs — verify; og-worker too).
4. Update svg README/CLAUDE (helper lists). svg CHANGELOG 2.0.0 `### Removed (2026-08-18 dead-code audit)`. Verify: `pnpm turbo run build test type-check lint --filter=@xivdyetools/svg --filter=xivdyetools-og-worker --filter=xivdyetools-web-app --filter=xivdyetools-discord-worker --filter=xivdyetools-moderation-worker`. Commit.

## Task 9: Wave 3c — `@xivdyetools/logger` 2.0.0 + `@xivdyetools/auth` (DEAD-021, DEAD-020, DEAD-019 adopt)

Findings: `findings/DEAD-021.md`, `DEAD-020.md`, `DEAD-019.md`.

Steps:
1. DEAD-021: remove `perf` (browser.ts:181-302 + tests + `apps/web-app/src/shared/logger.ts:17` re-export + its test section + the `__tests__/setup.ts` mock), `getRequestId(request)` (worker.ts + test), `createSimpleLogger` (+ test block). Correct the false DEAD-070 sentence in `packages/logger/CHANGELOG.md`; fix `presets/library.ts` doc examples (`xivdyetools-core` → `@xivdyetools/core`). Bump logger to **2.0.0** with a new CHANGELOG entry (BREAKING: `perf`, `getRequestId` removed; `createSimpleLogger` was `@internal`).
2. DEAD-020: remove `isJWTExpired`, `getJWTTimeToExpiry` (jwt.ts:275-297 + tests + README rows), `timingSafeEqualBytes` (timing.ts:65-86 + tests). Keep the root `/encoding` re-exports and all option types.
3. DEAD-019 **adopt (controller ruling):** replace `apps/discord-worker/src/services/preset-api.ts:47-70` and `apps/moderation-worker/src/services/preset-api.ts:67-92` `generateRequestSignature` with `hmacSignHex(message, secret)` from `@xivdyetools/auth`; `apps/discord-worker/src/utils/github-verify.ts:22-60` with `hmacVerifyHex`; `apps/oauth/src/services/jwt-service.ts:44-85` (`getSigningKey`/`signJwtData`/`verifyJwtData`) with `hmacSign`/`hmacVerify` — **only where the byte-for-byte output is identical** (same key derivation, same encoding, same timing-safe compare); prove it with the apps' existing tests plus one round-trip test per replaced site that pins a known vector before/after. If any site is not a drop-in (e.g. different key import params), leave that site, keep the auth helper, and record it. auth CHANGELOG 1.3.0 `### Removed (2026-08-18 dead-code audit)`.
4. Verify: `pnpm turbo run build test type-check lint --filter=@xivdyetools/logger --filter=@xivdyetools/auth --filter=xivdyetools-web-app --filter=xivdyetools-discord-worker --filter=xivdyetools-moderation-worker --filter=xivdyetools-oauth --filter=@xivdyetools/worker-kit`. Commit.

## Task 10: Wave 3d — `@xivdyetools/worker-kit` + `@xivdyetools/types` (DEAD-023 + adopt, DEAD-025, DEAD-024 adopt)

Findings: `findings/DEAD-023.md`, `DEAD-025.md`, `DEAD-024.md`.

Steps:
1. DEAD-023: remove `formatRateLimitMessage` (headers.ts:66-81 + tests + README), `UNIVERSALIS_PROXY_LIMITS` (+ tests), `EndpointRateLimitConfig`. **`MODERATION_LIMITS` — adopt (controller ruling):** add a `getModerationLimit` helper next to `getOAuthLimit`, and make `apps/moderation-worker/src/middleware/rate-limit.ts` derive its `RATE_LIMIT_CONFIGS` numbers from the preset (shape adapter allowed) — if the shapes cannot be reconciled without behaviour change, delete `MODERATION_LIMITS` instead and record why. worker-kit CHANGELOG 1.0.0 `### Removed…`.
2. DEAD-025: remove `createSnowflake`/`DiscordSnowflake` (+ tests), delete `src/dye/database.ts` + its `dye/index.ts` re-export (fix README:103), remove `PresetSortOption`, `ModerationResponse`, `CategoryListResponse`, `OAuthState`, `XIVAuthSocialIdentity` **and** their re-export lines in the app shims (`apps/oauth/src/types.ts`, `apps/presets-api/src/types.ts`, discord/moderation `types/preset.ts`) — verify each has no other importer first. Point bot-logic `isValidDiscordSnowflake` and moderation-worker's private copy (`preset-api.ts:258`) at `isValidSnowflake` from `@xivdyetools/types` if semantics match (both must accept the same inputs — compare regexes) — otherwise leave and record.
3. DEAD-024 **adopt (controller ruling):** derive `apps/discord-worker/src/types/preferences.ts:152` `CLANS_BY_RACE`, `apps/og-worker/src/services/svg/dye-helpers.ts:81` `ALL_SUBRACES`, and web-app `swatch-tool.ts:121` / `v4/config-sidebar.ts:98` lists from `RACE_SUBRACES`/`SUBRACE_TO_RACE` in `@xivdyetools/types` — a thin per-app adapter that maps keys → display names is fine; the game-data fact must have one source. If an app's table encodes something the shared one lacks (ordering, display strings), keep the app-specific presentation layer but source the race/clan *set* from types. `COLOR_GRID_DIMENSIONS`: adopt in `CharacterColorService`/web-app if it matches their grid constants, else remove it. types CHANGELOG 2.0.0 `### Removed…`.
4. Verify: `pnpm turbo run build test type-check lint` for worker-kit, types, and every app touched (moderation-worker, oauth, presets-api, api-worker, discord-worker, og-worker, web-app, bot-logic). Commit.

## Task 11: Wave 3e — `@xivdyetools/core` part 1 (DEAD-030, DEAD-031, DEAD-033, DEAD-029, DEAD-032, DEAD-036)

Findings: `findings/DEAD-030.md`, `DEAD-031.md`, `DEAD-033.md`, `DEAD-029.md`, `DEAD-032.md`, `DEAD-036.md`.

Steps:
1. DEAD-030: remove `VISION_TYPES`, `VISION_TYPE_LABELS`, `API_DEBOUNCE_DELAY`, `SEPARATION_TIER_KEYS`, `PATTERNS.RGB_COLOR`; drop `COLOR_DISTANCE_MAX` from the barrel (keep the constant). Leave the INTERNAL-ONLY/documented list alone.
2. DEAD-031: delete `test-build.mjs`; delete `typedoc.json`, the `docs` script, and the `typedoc` devDep (Task 6 removed the plugin); fix `CLAUDE.md:20`. **`VERSION` — remove (controller ruling):** delete `src/version.ts`, `scripts/generate-version.ts`, the `build:version` script and its place in `build`, the barrel line, README/CLAUDE mentions; if `version.ts` is gitignored/generated, remove the ignore entry too.
3. DEAD-033: remove `getBlendingModeDescription` and the `rgbToLab` re-export from `/blending` (+ tests).
4. DEAD-029: remove `lerp`, `distance`, `unique`, `groupBy`, `sortByProperty`, `filterNulls`, `isString`, `isNumber`, `isArray`, `isObject`, `isNullish` (+ their `utils.test.ts` blocks, README `lerp` example, CLAUDE.md:176 list) and `AsyncLRUCache` (+ tests). Keep the survivors listed in the finding.
5. DEAD-032: remove the calibration barrel exports (`index.ts:112-127`: `calibrateBandVocabulary`, `DE2000_GROUND_TRUTH`, `METHOD_DISPLAY_DP`, 4 types) — the script and parity test import the module path directly; add `"calibrate:bands": "tsx scripts/calibrate-bands.ts"` to package.json scripts; fold `METHOD_DISPLAY_DP` into `BAND_METHOD_DP` if the values agree (they should — verify). Keep `RATIO_BANDS` exported.
6. DEAD-036: remove `getMetallicDyeIds`/`getJobName`/`getGrandCompanyName` (+ tests), the `buildJobNames`/`buildGrandCompanyNames`/`identifyMetallicDyes` builders in `scripts/build-locales.ts`, `JobKey`/`GrandCompanyKey` in `@xivdyetools/types`; regenerate the six locale JSONs via the package's `build:locales` script (do not hand-edit them) and confirm only those three sections disappeared (`git diff --stat`).
7. core CHANGELOG 4.0.0 `### Removed (2026-08-18 dead-code audit)` (Task 12 appends). Verify: `pnpm turbo run build test type-check lint --filter=@xivdyetools/core --filter=@xivdyetools/types` then `pnpm turbo run build type-check --filter='./apps/*' --filter='./packages/*'`. Commit.

## Task 12: Wave 3f — `@xivdyetools/core` part 2: class members + legacy overloads (DEAD-034, DEAD-035)

Findings: `findings/DEAD-034.md`, `DEAD-035.md`.

Steps:
1. DEAD-034: remove every row of the table **facade-first** — delete the `DyeService`/`ColorService` facade method, then the delegate it alone called (`DyeDatabase.getDyesByIds/getDyesByStainIds/getLastLoadedTime`, `DyeSearch.getDyesSortedBy*`, `HarmonyGenerator.findCompoundDyes/findShadesDyes`, `SpectralMixer.mixMultiple/gradient/isAvailable`, …), `APIService.getPricesForItems/getPriceTrend/getCacheStats/resetMetrics` + `CacheMetrics` + the metrics bookkeeping that only they read, `ColorConverter.getDeltaE_HyAB` + the `'hyab'` member of `DeltaEFormula` + its `getDeltaE` case, the six `PresetService`, six `CharacterColorService` methods, `PaletteService.pixelDataToRGB`, `KDTree.getSize`. Re-verify each with `git grep -n "\.<method>(" -- 'apps/*' 'packages/*'` before deleting (mocks in web-app tests that stub a removed method should be dropped too). Delete the test blocks the finding lists. Update README/CLAUDE method lists. If `getVersion`/`getLastUpdated` go, `presets.json`'s `version`/`lastUpdated` fields may stay (data) — do not touch the JSON.
2. DEAD-035: migrate the legacy call shapes — `HarmonyGenerator.ts:128` → options object; `CharacterColorService.ts:387` → options object; core tests (`APIService*.test.ts` positional ctor, `CharacterColorService.test.ts:194,288,320`, `DyeSearch.test.ts:340-373,561-583`), web-app `dye-service.test.ts:171`, README examples (69,231,288,153,376) — then delete the legacy arms (`APIService` positional branch + `isOptionsObject`, the `number[]` / `number` / trailing-`limit` overloads). **Stale default:** fix `apps/discord-worker/src/handlers/commands/extractor.ts:121-124` to pass the user's `matchingMethod` explicitly (do NOT change core's `'rgb'` default in this task — record it as a follow-up in the report if you think it should change).
3. Append to core CHANGELOG 4.0.0 `### Removed…` (list every removed method). Verify: `pnpm turbo run build test type-check lint --filter=@xivdyetools/core` then the whole workspace `pnpm turbo run build test type-check`. Commit. **This ends Wave 3** — say so in the commit body.

## Task 13: Wave 4a — low-risk consolidations from DEAD-037

Finding: `findings/DEAD-037.md` (register).

Steps — do each **only if** behaviour is provably identical (tests green, no output change); otherwise skip it and record why:
1. `SUPPORTED_LOCALES`: `apps/web-app/src/shared/constants.ts:59` and `apps/moderation-worker/src/services/i18n.ts:34` → derive from `@xivdyetools/core` `SUPPORTED_LOCALES` (keep any richer per-app shape as a mapping over the core tuple).
2. `VISION_TYPES`: bot-logic `commands/accessibility.ts:30` and web-app `accessibility-tool.ts:110` — if both are the same 4-lens list as core's `VisionType` union, source the *set* from `@xivdyetools/types`/core; keep per-app labels local.
3. `MATCHING_METHODS`: discord-worker `types/preferences.ts:140` — assert (test) that its `value`s equal core's `MATCHING_METHODS` tuple, so the two cannot drift.
4. svg colour math: `hexToRgb`, `getLuminance`, `contrastRatio` in `packages/svg/src/base.ts` → thin re-exports/wrappers over `@xivdyetools/core` `ColorService.hexToRgb` / `getPerceivedLuminance` / `getContrastRatio` **only if** the numeric outputs are identical for the svg test vectors (svg's tests must stay green unchanged); keep svg's own signature.
5. Rec.709 luminance constants and inline clamps inside core: replace inline `Math.max(0, Math.min(255, …))` with the exported `clamp()` in `blending/conversions.ts`, `chara-parser.ts:165`, `chara-resolver.ts:123`, `ColorConverter.ts:1040` (pure refactor; tests unchanged).
6. Verify: `pnpm turbo run build test type-check lint` for every touched workspace. Commit.

## Task 14: Wave 4b — the two heavy consolidations (DeltaE spelling; `blending/conversions.ts` ↔ `ColorConverter`)

Finding: `findings/DEAD-037.md` "Inside core"; `DEPRECATIONS.md:244`.

**Controller ruling:** these are behaviour-sensitive; implement each only under the conditions below, otherwise leave a documented decision in `DEPRECATIONS.md` and report BLOCKED-by-design for that item (that is an acceptable outcome, not a failure).

1. **`'cie2000'` vs `'ciede2000'`.** Make `MatchingMethod`'s `'ciede2000'` the canonical spelling everywhere inside core: `DeltaEFormula` gains `'ciede2000'`, `'cie2000'` stays accepted as an alias (normalised at the `getDeltaE` entry — a public type member cannot vanish from an unreleased-but-documented major without a note), and the three mapping switches (`DyeSearch.ts:67-74`, `ColorService.ts:182-186`, `CharacterColorService.ts:294-305`) collapse to the alias normaliser. Every existing test must pass unchanged; add one test that `getDeltaE(a,b,'cie2000') === getDeltaE(a,b,'ciede2000')`.
2. **`blending/conversions.ts` → `ColorConverter`.** Only if, for the full dye table (125 hexes) and the blending tests' vectors, `blendColors()` output is **bit-identical** before and after switching each conversion helper (`hexToRgb`, `rgbToLab`, `labToRgb`, `rgbToOklab`, `oklabToRgb`, `rgbToHsl`, `hslToRgb`, ryb helpers) to `ColorConverter`/`RybColorMixer` — write that equivalence test first, run it against the current implementations; if any helper differs numerically, keep `conversions.ts` for that helper, keep the equivalence test as documentation of the delta, tick nothing in `DEPRECATIONS.md:244`, and record the exact deltas in the report. If all identical: switch, delete the duplicated helpers, tick the DEPRECATIONS.md checkbox with today's date.
3. Verify: `pnpm turbo run build test type-check lint --filter=@xivdyetools/core --filter=@xivdyetools/bot-logic --filter=xivdyetools-web-app --filter=xivdyetools-discord-worker`. Commit. **This ends Wave 4** — say so in the commit body.
