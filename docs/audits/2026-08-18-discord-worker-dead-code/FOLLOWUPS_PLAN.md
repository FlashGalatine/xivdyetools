# Follow-ups Plan — post-cleanup items (2026-08-18)

Executes five of the six "Post-cleanup follow-ups" in `DEAD_CODE_REPORT.md` (item 4, the blending unification, is held as a product decision). Order: `'rgb'` default → HMAC adoption → `/preferences count` re-purpose → web-app shared contracts → knip gate.

## Global Constraints (bind every task)

Same as `CLEANUP_PLAN.md` — restated: repo/git root `xivdyetools/`, branch `monorepo-2.0-prep`, work in place, one commit per task with a conventional message + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, stage only touched paths (never `git add -A`, never stash); never publish/deploy/push; verify with `git grep` (not `grep -r`); tests/type-check/lint green for every touched workspace; prettier on touched files; docs travel with code; CHANGELOG rules: core/svg/bot-logic/types/auth/worker-kit are unpublished at their current versions → append to the existing top entry under `### Changed`/`### Removed`/`### Added` as fits (no bump); logger is at 2.0.0 (unreleased) → same; apps (discord-worker 5.0.0, moderation-worker, web-app 5.0.0) → append to their unreleased top entry. `@cloudflare/workers-types` etc. untouched. Report file per task; return only status/commits/tests/concerns/report path.

---

## Task 1: `DyeSearch.findDyesWithinDistance` default `'rgb'` → `'ciede2000'`

Facts: every external caller passes `matchingMethod` (`apps/api-worker/src/routes/match.ts`, `apps/discord-worker/src/handlers/commands/extractor.ts:125`, `apps/web-app/src/components/extractor-tool.ts` ×2); `findClosestDye` already defaults to `'ciede2000'`.

Steps:
1. `packages/core/src/services/dye/DyeSearch.ts` — `FindWithinDistanceOptions.matchingMethod` JSDoc + the destructuring default → `'ciede2000'`; drop the "for backwards compatibility" wording; mirror any duplicate default/JSDoc in `DyeService.ts`'s facade.
2. Core tests that relied on the RGB default with RGB-scaled `maxDistance` (`DyeSearch.test.ts`, `DyeService.test.ts` — find with `findDyesWithinDistance(` and no `matchingMethod`): pass `matchingMethod: 'rgb'` explicitly where the assertion depends on RGB scale, otherwise leave (assert the intent per test, don't blanket-add).
3. README/CLAUDE (`packages/core/README.md`, `CLAUDE.md`, `docs/projects/core/*.md`) — any sentence naming the `'rgb'` default.
4. Core CHANGELOG 4.0.0 `### Changed` line. Verify `pnpm turbo run test type-check lint --filter=@xivdyetools/core` + ripple `pnpm turbo run build type-check --filter='./apps/*'`. Commit `chore(core): findDyesWithinDistance defaults to ciede2000 (follow-up 2)`.

## Task 2: adopt `hmacSignHex` in the two `preset-api.ts` signing sites; secret-length floor in env-validation

Facts: `main`'s presets-api verifies with `@xivdyetools/auth` `verifyBotSignature` → `createHmacKey` throws for secrets < 32 bytes → production `BOT_SIGNING_SECRET` is already ≥ 32 bytes; only test fixtures (17–20 chars) are short. `github-verify.ts` stays hand-rolled (GitHub imposes no floor; keep its docblock, extend it to say "intentional; not on `@xivdyetools/auth` because…").

Steps:
1. Compute pinned vectors FIRST with the current code: for `apps/discord-worker/src/services/preset-api.ts` `generateRequestSignature(timestamp, userDiscordId, userName, secret)` and `apps/moderation-worker/src/services/preset-api.ts` (same shape) — one fixed input each with a ≥32-char secret; record the hex.
2. Replace both bodies with `hmacSignHex(\`${timestamp}:${userDiscordId || ''}:${userName || ''}\`, signingSecret)` from `@xivdyetools/auth` (keep the wrapper function + JSDoc, drop the hand-rolled importKey/sign/hex; remove the "kept as-is" docblock from Task 9 of the cleanup). Add a test per app asserting the pinned hex.
3. Bump the fixtures: every test in discord-worker / moderation-worker that sets `BOT_SIGNING_SECRET` (e.g. `'test-signing-secret'`) → a ≥32-char value; keep test intent identical.
4. `apps/discord-worker/src/utils/env-validation.ts` and `apps/moderation-worker/src/utils/env-validation.ts` — add `BOT_SIGNING_SECRET.length < 32` → error (mirror oauth's `JWT_SECRET` check at `apps/oauth/src/utils/env-validation.ts:54`); tests for it.
5. `github-verify.ts` docblock: state the keep decision in one sentence. Both apps' CHANGELOGs + auth CHANGELOG (adoption note; `hmacSignHex` now has consumers). Verify both workers + `@xivdyetools/auth`. Commit `chore(discord-worker,moderation-worker): adopt hmacSignHex; enforce ≥32-byte BOT_SIGNING_SECRET (follow-up 3)`.

## Task 3: re-purpose `/preferences set count` for `/extractor color`

Facts: `apps/discord-worker/src/handlers/commands/extractor.ts:220-231` reads the `count` option with `|| 1` and ignores prefs; `resolveCount(explicit, prefs)` (`services/preferences.ts:317`) has zero callers; `PREFERENCE_DEFAULTS.count = 5` (`types/preferences.ts:125`); schema `commands/schemas.ts:269` (`/extractor color count`, 1–10) and `:631` (`/preferences set count` "Default number of results (1-10)").

Steps:
1. `extractor.ts`: `matchCount = clamp(resolveCount(countOption?.value as number | undefined, prefs), MIN, MAX)` — explicit option › stored preference › default. Import `resolveCount`.
2. `types/preferences.ts`: `PREFERENCE_DEFAULTS.count` 5 → **1** so users who never set the preference see identical `/extractor color` output (default 1 match). Check `isValidCount` range still 1–10 and any test asserting the default of 5 (`preferences.test.ts`, `preferences.exhaustive.test.ts`) — update.
3. `commands/schemas.ts:631` description → "Default number of matches for /extractor color (1-10)"; `handlers/commands/preferences.ts` — if `/preferences show` renders a per-key hint, align; locale key `preferences.keys.count` value stays ("Result Count") unless a clearer label is trivial across all six locales — if you change it, change all six + keep the Task-4 gate green.
4. Tests: extractor test asserting (a) explicit option wins, (b) stored preference is used when option omitted, (c) default 1 when neither. discord-worker CHANGELOG (Changed) + note that `register-commands` picks up the description change. Verify discord-worker. Commit `feat(discord-worker): /preferences count now drives /extractor color default (follow-up 1)`.

## Task 4: web-app imports the shared `@xivdyetools/types` contracts; restore `PresetSortOption`

Facts (from the comparison): identical → swap verbatim: `AuthUser` (`services/auth-service.ts:33`), `PrimaryCharacter` (`:27`), `PresetFilters` (`services/community-preset-service.ts:60`), `PresetSubmission` (`services/preset-submission-service.ts:16`), `PresetEditRequest` (`:47`), `PresetListResponse` (`community-preset-service.ts:43`, once `CommunityPreset` is swapped). Divergent, shared is the wire truth → swap and keep runtime normalisation: `AuthResponse` (`auth-service.ts:84`, shared is the discriminated union `AuthSuccessResponse|AuthErrorResponse`), `JWTPayload` (`:60`, shared adds `jti?`, `orig_iat?`, required `auth_provider`), `CommunityPreset` (`community-preset-service.ts:17`, shared adds `dye_signature?`, `previous_values?`, requires `secondary_categories`/`preview_image_status`), `VoteResponse` (`:70`, shared union; keep the `?? 0` on `new_vote_count` reads). `PresetSortOption`: two local copies (`services/hybrid-preset-service.ts:73`, `shared/tool-config-types.ts:184`); the shared export was removed in the cleanup (DEAD-025) — restore it.

Steps:
1. `packages/types/src/preset/request.ts`: `export type PresetSortOption = 'popular' | 'recent' | 'name';` and use it in `PresetFilters.sort`; re-export from `preset/index.ts` + root `index.ts`; types CHANGELOG 2.0.0 (`### Added` — restored, now consumed by web-app); note in `docs/audits/2026-08-18-discord-worker-dead-code/findings/DEAD-025.md` (one line: restored 2026-08-18, adopted by web-app).
2. In web-app, replace each local definition with `import type { … } from '@xivdyetools/types'`; for the four divergent ones, narrow at use sites (`if (!res.success) …` discriminants; `data.new_vote_count ?? 0`; keep `presetsIdentity()` override) — **no runtime behaviour change**; `tsc` is the safety net. Collapse both `PresetSortOption` copies into the import.
3. `apps/web-app/src/__tests__/mocks/handlers.ts` preset literals: add `secondary_categories: []`, `preview_image_status: 'none'` (or the value the API defaults to — check `apps/presets-api/src/services/preset-service.ts:80-125`).
4. Verify `pnpm turbo run test type-check lint --filter=xivdyetools-web-app --filter=@xivdyetools/types` + `pnpm turbo run build type-check --filter='./apps/*'`. web-app CHANGELOG (Changed) + types CHANGELOG. Commit `refactor(web-app): use @xivdyetools/types contracts; restore PresetSortOption (follow-up 5)`.

## Task 5: knip dead-code gate for `packages/{core,svg,bot-logic}` (report-only first)

Facts: `docs/audits/2026-08-18-discord-worker-dead-code/evidence/knip.root.jsonc` resolved cross-workspace imports without `paths` (knip source-maps `dist→src`); web-app runs `"lint": "eslint src && knip"` with `apps/web-app/knip.jsonc`; CI: `pnpm turbo run lint --filter='...[HEAD^]'`; knip honours `@public`/`@internal` JSDoc tags and `--tags`.

Steps:
1. Add root `knip.jsonc` (monorepo mode; `ignoreExportsUsedInFile: true`; workspaces `packages/*` with `entry: ["src/index.ts!", "src/**/index.ts!", "src/**/*.test.ts", "src/**/__tests__/**", "scripts/**", "*.config.ts"]`, `project: ["src/**/*.ts", "scripts/**"]`, `includeEntryExports: true` for `packages/core`, `packages/svg`, `packages/bot-logic`; enable the `classMembers` rule for `packages/core`; `apps/web-app` keeps its own config — set the root workspace entry for it to defer to `apps/web-app/knip.jsonc` if knip supports per-workspace config files, otherwise leave web-app out of the root run and note it).
2. Tag deliberately-public-but-unconsumed exports with `/** @public */` (svg frame primitives + `*Options`/`*Labels`, logger `BaseLogger`/adapters/`createBrowserLogger`, core companion types + `facewearColors`/`LEGACY_FACEWEAR_ITEM_IDS`/`RATIO_BANDS`, auth root `/encoding` re-exports, worker-kit option types) so they are excluded on purpose, and configure knip to exclude `@public` (`"tags": ["-public"]` or knip's native handling — verify in `npx knip --help`/docs).
3. Package scripts: `packages/{core,svg,bot-logic}` `"lint:dead": "knip --workspace packages/<p>"` and add it to their `"lint"`; run it — the goal for this task is **zero findings after tagging** (anything left is either a new dead item to fix now if trivial, or a `@public` tag). If knip's runtime is too slow for `lint` (>60 s), keep `lint:dead` separate and add a root `"lint:dead": "knip"` script + a note in the root README/CLAUDE; do not wire it into CI as blocking in this task.
4. Root CLAUDE.md / package CLAUDE.md: one paragraph on the gate and the `@public` convention. Verify `pnpm turbo run lint --filter=@xivdyetools/core --filter=@xivdyetools/svg --filter=@xivdyetools/bot-logic`. Commit `chore(packages): knip dead-code gate for core/svg/bot-logic (follow-up 6)`.
