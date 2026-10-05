# Dead-code review: apps/presets-api (preview/integration-2026-10-04)

Read-only worker review. Unit version 2.4.0 (PR #224). No builds run; tracked files only.

## Module map

- Entry: `src/index.ts` (`default export Object.assign(app, { scheduled })`, wrangler `main`); cron `23 4 * * *` under `[env.production.triggers]` -> `src/retention-job.ts:scheduled`.
- Routers: presets.ts (12 routes), votes.ts (3), categories.ts (2), moderation.ts (10: pending, :id/status, :id/revert, :id/preview-image, :id/history, stats, failed-notifications, failed-notifications/:id/resolve, GET :id).
- Services: preset, moderation (profanity + Perspective), notification (dead letters), rate-limit, moderation-retention, identity-rekey, preview-image, category, validation.
- Scripts/migrations: `scripts/migrate-presets.ts` (package.json `db:seed`), `schema.sql` + `migrations/0002..0015` + `002_add_composite_indexes.sql` (package.json `db:migrate:indexes`).
- No classes in src (`grep "^export class|^class" src` -> none), so members.py not applicable.

## Commands run and results

1. `git ls-files apps/presets-api` -> 85 tracked files incl. 15 migrations, 52 test/helper files.
2. `symrefs.sh` over all 141 export names: far too slow on Windows (about 20 s per symbol, 3 rows per 3 min), stopped. Replaced with an equivalent node script (scratchpad `refs.mjs`) that reads `git ls-files` (minus docs/audits, CHANGELOG, coverage) and counts word-boundary hits per export in: other src files, tests, and everything else tracked. Result: 140 declarations scanned. `src=0 AND self=1` (defined, never referenced in src at all): only `_resetPatternsForTesting`, `_setTestPatterns` (both already `@testonly`). Every other src=0 name is referenced inside its own file (knip `ignoreExportsUsedInFile: true`, knip.jsonc:43) or by tests.
3. `other>0` hits inspected: all are name collisions in other apps (e.g. `errorResponse`, `ErrorCode`, `validateEnv`, `removeVote` in discord-worker) or docs; none is a real import of presets-api (private app, nothing imports it).
4. `grep -rn successResponse src tests` -> only definition (`src/utils/api-response.ts:108`) and `tests/utils/api-response.test.ts:11,50-75`. Zero production callers.
5. `grep -rn "BAD_REQUEST|DATABASE_ERROR" src tests` -> `ErrorCode.BAD_REQUEST`/`DATABASE_ERROR` (api-response.ts:33,47) never referenced as `ErrorCode.X`; body-validation.ts:73 emits the literal `'BAD_REQUEST'`; `DATABASE_ERROR` appears nowhere else. `grep -o "ErrorCode\.[A-Z_]+" src` -> 11 members used, 2 never.
6. Re-export audit of `src/types.ts` deprecated block (lines 17-38, 56-59): src importers of `PresetStatus`, `CategoryMeta`, `CommunityPreset`, `PresetFilters`, `PresetSubmission`, `PresetEditRequest`, `PresetPreviousValues`, `PresetListResponse`, `VoteResponse`, `ModerationResult`, `RateLimitResult` exist (handlers/*, services/*). `PresetCategory` and `AuthSource` have NO src importer; only `tests/types.test.ts:9,21`. `ModerationLogEntry` only `tests/handlers/moderation.test.ts:9`.
7. `grep it.skip|xit|describe.skip|it.todo|it.only` -> none (one comment at presets.test.ts:3393 describing removed skips; `process.exit` hit in scripts only).
8. Test helpers: `createMockSubmission` (4 files), `createMockCategoryRow` (1), `createExpiredJWT` (1), `authHeaders` (2), `createTestJWT` (5), `withPresetRereadRow` (2), `useCleanPerspective` (3), `createMockPresetRow` (5), `SqliteD1` (tests/sqlite-d1.ts, 6+ importers). All used.
9. Env/binding audit (grep -w per name in src minus types/env-validation): API_VERSION (index.ts), ENVIRONMENT, ADDITIONAL_CORS_ORIGINS, CORS_ORIGIN (index.ts), CACHE_PURGE_* (preview-image-service), TOKEN_BLACKLIST (auth.ts), DISCORD_WORKER + INTERNAL_WEBHOOK_SECRET (notification-service), RL_PUBLIC (rate-limit.ts), THUMBNAILS/IMAGE_WORKER (preview-image-service/presets.ts). All declared wrangler vars/bindings are read; all `Env` fields declared are read.
10. Package deps: `hono` (src), `@xivdyetools/auth` (middleware/auth.ts:16), `/types` (types.ts), `/worker-kit` (+ `/rate-limiter`, `/body-guards`, `/image-sniff`; worker-kit package.json exports both subpaths), `@xivdyetools/test-utils` (tests), `tsx` (db:seed script), `wrangler` (scripts), `@vitest/coverage-v8` (vitest.config.ts coverage), `@types/node`, `@cloudflare/workers-types`, `vitest`. None unused. `node:sqlite` used by tests/sqlite-d1.ts.
11. Routes with no in-repo client (grep `api/v1/moderation` in apps/*/src, packages/bot-logic/src): `GET /moderation/:id/history`, `GET /moderation/failed-notifications`, `PATCH /moderation/failed-notifications/:id/resolve`. The latter two are the documented operator dead-letter API (CLAUDE.md, README.md, docs/architecture/api-contracts.md); all other routes have a client (moderation-worker preset-api.ts:384-501, discord-worker preset-api.ts:429,461, web-app community-preset-service/auth-service).
12. Legacy markers `grep -i legacy|deprecated|TODO|compat|obsolete|HACK src`: types.ts re-exports (item 6), moderation-service.ts:131 (`_setTestPatterns` "legacy pattern array" converter), notification-service.ts:398-409 (legacy dead-letter `preset` shape), validation-service.ts:240-246 (legacy itemID >= 5000 guard; live input validation, keep).
13. Migrations vs code: no application SQL writes `content_revision` (src hits are reads/binds at preset-service.ts:461,485,716), consistent with the 0014 trigger. 0015 is hand-run post-deploy (header of migrations/0015_rewrite_legacy_dead_letters.sql), exercised by tests/services/failed-notifications-legacy-rewrite.test.ts.
14. `scripts/migrate-presets.ts:75` still `id !== 'community'` although `community` category was retired by migration 0007; script also re-declares `generateDyeSignature` (line 52) instead of the src one.
15. DEPRECATIONS.md (presets-api rows): only the Perspective API sunset (2026-12-31, external, still future; code is live, not a candidate yet).

## Candidates (summary; full list in structured return)

1. `successResponse` + `ApiSuccessResponse` + its test block: test-only helper, no handler uses it (all handlers use inline `c.json`).
2. `ErrorCode.BAD_REQUEST`, `ErrorCode.DATABASE_ERROR`: members never read.
3. `PresetCategory`, `AuthSource` deprecated re-exports (types.ts) with only types.test.ts consumer; `tests/types.test.ts` asserts only compile-time literals (no runtime behaviour).
4. `summarizeFailedNotification` legacy-shape branch (notification-service.ts:371-377,398-408) plus the `moderation_status ?? legacyPreset` fallback: dead once migration 0015 has run in production (hand-run; not yet applied as far as the repo shows). Trigger-based.
5. `resetCategoryCache` re-export in presets.ts:91: no src consumer, 5 test importers, not tagged `@testonly` (gate misses `export {x} from` form). Genuine reset hook: keep, but tag.
6. `_resetPatternsForTesting` / `_setTestPatterns` (@testonly): reasons hold (3 test files each, moderation-service.test.ts); both are real isolation/injection hooks over a memoized singleton. `_setTestPatterns` regex-extraction of words from RegExp sources is compat glue only tests exercise: borderline simplification.
7. `scripts/migrate-presets.ts` stale `'community'` branch and duplicated signature helper.
8. Routes `GET /moderation/:id/history`: no client anywhere; documented API.
9. `previewImagePublicUrl` (preview-image-service.ts:51): used once; preset-service.ts:122,543 duplicates the same template inline instead (not dead, redundant duplication).

## Positive controls

- Prior cleanups held: `requireNotBannedCheck` gone (grep none); `api-response.ts` -13 lines; `body-validation.ts` -130 lines moved to worker-kit/body-guards, leftovers `isPreviewImageUpload`/`PREVIEW_IMAGE_CONTENT_TYPES` still referenced.
- `runRetentionJob` has src=0 external callers but is called by `scheduled` (retention-job.ts:59-65), wired via `Object.assign(app,{scheduled})` and tested (tests/retention-job.test.ts, index.test.ts, wrangler-config.test.ts).
- `rekeyIdentity` called at presets.ts:378; `isUserBanned` at presets.ts:377 and ban-check.ts:147.
- `pruneModerationRecords` (moderation.ts write paths + retention-job); `toDeadLetterRecord` used by storeFailedNotification.
- No `it.skip`/orphan tests; every test helper has a consumer; every wrangler var/binding is read.

## Rejected (live)

- `selectPublicRateLimiter`/`selectUserRateLimiter` fallback to MemoryRateLimiter when `RL_PUBLIC` absent: DEAD-020 KEEP register; tests/middleware/rate-limit-binding.test.ts covers both. Trigger not met.
- `LIFTED_BAN_RETENTION_DAYS`, `USER_ACTION_LOG_RETENTION_MONTHS`, `FAILED_NOTIFICATION_*_RETENTION_DAYS`, `SUBMISSION_EVENT_RETENTION_DAYS`: used in-file, privacy commitments per CLAUDE.md.
- `validatePresetDyes` legacy itemID >= 5000 guard: live validation (documented).
- Migrations 0002-0013, 002_add_composite_indexes.sql: historical, applied by hand; `002_*` referenced by package.json.
- `getEffectiveSubmissionCountToday`, `getSubmissionCountToday`, `getEventCountToday`: used by rate-limit-service paths.
- `ModerationServiceLogger`, `DeadLetterRecord`, `FailedNotificationSummary`, `PresetImageState`, `SubmissionEventKind`, `PresetModerationMethod`, `EnvValidationLogger`, `CachePurgeResult`, `ApiErrorResponse`: exported but used only inside their own file; knip config ignores that, only an unnecessary `export`, not dead code.

## Prior KEEP register status

- DEAD-018 (core APIs), DEAD-019 (Stoat scaffolding): not in this unit.
- DEAD-020 (rate-limit native-binding fallbacks): applies to `src/middleware/rate-limit.ts`; trigger NOT met (no replacements, no operational evidence).
- DEAD-021: not in this unit.

## Files covered

All 85 tracked files under apps/presets-api (src 36 incl. 6 profanity lists, tests 36, migrations 16, scripts 1, config/docs 9) were reviewed at least by reference scan; delta files in pr-delta.txt (retention-job, moderation-retention-service, identity-rekey-service, notification-service, validation-service, moderation/presets handlers, types, env-validation, wrangler.toml, migration 0015) were read or grepped individually.
