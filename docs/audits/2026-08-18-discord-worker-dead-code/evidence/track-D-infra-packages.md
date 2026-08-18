# Track D — infrastructure packages (logger, auth, worker-kit, types, test-utils)

Verification notes for the knip 6.32 `--include-entry-exports` findings plus manual deep analysis.
Baseline: `monorepo-2.0-prep @ 84b6cf1`, clean tree. Read-only; nothing but this file was written.

Method: for every exported symbol of the five packages, `grep -rlw <symbol> apps packages` (ts/js/mjs, excluding
`node_modules`/`dist`/`coverage` and the owning package), then read the hits to separate real use from
re-export shims and doc comments. Named-import tallies per subpath were extracted with a small perl scan of
`import {…} from '@xivdyetools/<pkg>[/subpath]'` blocks.

Classification legend: DEAD / TEST-ONLY / INTERNAL-ONLY / REDUNDANT-RE-EXPORT / DOCUMENTED-PUBLIC-API / DUPLICATE / LIVE.

---

## 0. Headline observations (things the tool got wrong or missed)

1. **The "shared types nobody shares" premise is mostly wrong.** `apps/presets-api/src/types.ts`,
   `apps/discord-worker/src/types/preset.ts`, `apps/moderation-worker/src/types/preset.ts` and
   `apps/oauth/src/types.ts` are NOT local copies — they are `export type {…} from '@xivdyetools/types'`
   shims (three of the four are marked `@deprecated — import directly from '@xivdyetools/types'`). The
   apps genuinely consume the shared contract through them (discord-worker's `services/preset-api.ts`
   types every request with `PresetSubmitResponse`/`PresetEditResponse`/`VoteResponse`; oauth's
   `handlers/callback.ts` uses `c.json<AuthResponse>()` 9×). Same for `DiscordVerificationResult` /
   `DiscordVerifyOptions`: `apps/{discord,moderation}-worker/src/utils/verify.ts` are 18/20-line
   re-export shims of `@xivdyetools/auth`, not duplicate implementations.
   - The one app that *does* ignore the shared contract is **web-app**: it redefines `AuthUser`,
     `AuthResponse`, `JWTPayload`, `PrimaryCharacter` (`services/auth-service.ts`), `CommunityPreset`,
     `PresetListResponse`, `PresetFilters`, `VoteResponse` (`services/community-preset-service.ts`),
     `PresetSubmission`, `PresetEditRequest` (`services/preset-submission-service.ts`) and
     `PresetSortOption` twice (`services/hybrid-preset-service.ts:73`, `shared/tool-config-types.ts:184`)
     while already depending on `@xivdyetools/types` for `Dye`/`PresetCategory`. ~11 local definitions,
     ~150 lines. That belongs to the web-app track but is the real version of this finding.
   - What IS chain-dead: symbols the shims re-export that no file in the app then imports —
     `ModerationResponse`, `CategoryListResponse` (presets-api shim only), `OAuthState`,
     `XIVAuthSocialIdentity` (oauth shim only), `PresetSortOption` (discord/moderation shims only).
     Those five types-package exports have zero real consumers.
2. **The `hmac*` family in `@xivdyetools/auth` is dead in-repo, but four hand-rolled copies exist in apps.**
   `discord-worker/src/services/preset-api.ts:47-70` and `moderation-worker/src/services/preset-api.ts:67-92`
   each hand-roll `generateRequestSignature` (importKey + sign + hex-encode, ~24 lines) — that is exactly
   `hmacSignHex(message, secret)`. `discord-worker/src/utils/github-verify.ts:22-60` hand-rolls
   `hmacVerifyHex`. `oauth/src/services/jwt-service.ts:44-85` (`getSigningKey`/`signJwtData`/`verifyJwtData`)
   hand-rolls `hmacSign`/`hmacVerify` (base64url). Two valid remediations: adopt the shared helpers
   (removes ~90 app lines, gains the key cache) or delete the unused base64url pair. Not both.
3. **`@xivdyetools/logger` is an unused *direct* dependency of api-worker, oauth and presets-api** — confirmed:
   none of the three imports it; they only reach `ExtendedLogger` through `getLogger()` from
   `@xivdyetools/worker-kit`, which declares logger as its own dependency. Removable from those three
   package.json files (moderation-worker, discord-worker, web-app, stoat-worker do import it).
4. **`createWorkerLogger` has no real consumer.** The two "imports" knip/grep see in
   `packages/worker-kit/src/rate-limiter/types.ts:208,243` are inside JSDoc `@example` blocks. It is only
   called by `createRequestLogger` inside logger itself → INTERNAL-ONLY (README still documents it as the
   deprecated pattern).
5. **A logger CHANGELOG claim is false.** DEAD-070 says `getRequestId(request)` "remains in `worker.ts` for
   internal use by `createRequestLogger`". `createRequestLogger` (worker.ts:112-127) never calls it; the
   function is only reachable via the `/worker` subpath and only its own test exercises it → DEAD.
6. **test-utils is ~87 % unconsumed.** Of ~134 exports, exactly 14 are imported by anything outside the
   package (list in §5). Whole subpaths `/dom`, `/assertions`, `cloudflare/analytics.ts`,
   `factories/user.ts`, `factories/vote.ts`, `constants/secrets.ts`, `auth/context.ts`, `auth/signature.ts`
   have zero external consumers (1,565 src lines + 2,752 lines of their own tests). Nine more symbols are
   re-exported by `apps/presets-api/tests/test-utils.ts` and then never imported by any presets-api test.
7. Prior audits already saw several of these and chose "remove from barrel, keep the code":
   DEAD-059 (`createSnowflake`/`DiscordSnowflake`), DEAD-064 (`Matrix3x3`, `DyeDatabase`…),
   DEAD-068 (`createSimpleLogger` → `@internal`), DEAD-070 (`getRequestId`). This audit's numbers say the
   code is still at zero adoption one cycle later.

---

## 1. `packages/auth` (@xivdyetools/auth 1.3.0)

External import sites (all of them): discord-worker `utils/verify.ts` (shim), moderation-worker `utils/verify.ts`
(shim), oauth `services/jwt-service.ts` (+`/encoding`), presets-api `middleware/auth.ts`, test-utils
`utils/crypto.ts` (`/encoding` shim). Real consumption: `verifyJWT`, `verifyJWTSignatureOnly`, `decodeJWT`,
`isTokenRevoked`, `revokeToken`, `verifyBotSignature`, `timingSafeEqual`, `verifyDiscordRequest`,
`unauthorizedResponse`, `badRequestResponse`, `DiscordVerificationResult`, `DiscordVerifyOptions`,
`base64UrlEncode`, `base64UrlEncodeBytes`, `base64UrlDecode`, `base64UrlDecodeBytes`, `bytesToHex`
(via test-utils), `hexToBytes` (test-utils shim only → see §5).

| symbol | file:line | class | lines | evidence |
|---|---|---|---|---|
| `hmacSign`, `hmacVerify` | hmac.ts:124-141, 161-189 | DEAD (documented in README §HMAC + CHANGELOG 1.0) | ~47 (+~120 test) | zero callers anywhere; oauth `signJwtData`/`verifyJwtData` hand-roll the same base64url HMAC |
| `hmacSignHex` | hmac.ts:143-159 | DEAD (documented) | ~17 | zero callers; discord-worker + moderation-worker `generateRequestSignature` hand-roll it |
| `hmacVerifyHex` | hmac.ts:191-235 | INTERNAL-ONLY | — | called by `verifyBotSignature` (hmac.ts:276); no external import → could drop from barrel, keep code |
| `createHmacKey` | hmac.ts:88-122 | INTERNAL-ONLY | — | called by `getOrCreateHmacKey` (hmac.ts:62) which jwt.ts uses; no external import |
| `isJWTExpired`, `getJWTTimeToExpiry` | jwt.ts:275-297 | DEAD (documented in README table) | ~23 (+ tests in jwt.test.ts) | only hit outside the package is oauth jwt-service.ts:10 — a comment saying it was deleted from oauth |
| `timingSafeEqualBytes` | timing.ts:65-86 | DEAD (documented) | ~22 | zero callers; `timingSafeEqual` (string) is the one everybody uses |
| `JWTPayload`, `VerifyJWTOptions`, `RevocationStore`, `BotSignatureOptions` (types) | jwt.ts:27/59, revocation.ts:16, hmac.ts:20 | INTERNAL-ONLY / needed-for-signatures | — | parameter/return types of live functions; consumers cast to `@xivdyetools/types` `JWTPayload` instead. Exporting them is correct .d.ts hygiene — KEEP |
| `DiscordVerificationResult`, `DiscordVerifyOptions` | discord.ts:16/28 | LIVE | — | re-exported (and consumed) by both bot workers' `utils/verify.ts` shims |
| `base64Url*`, `hexToBytes`, `bytesToHex` on the root barrel | index.ts:63-72 | REDUNDANT-RE-EXPORT | 10 | every consumer imports from `/encoding`; root re-export is documented in DEPRECATIONS.md ("also re-exported from the auth package root") — KEEP for the crypto migration path or drop with the DEPRECATIONS entry |

Dependencies: `discord-interactions` used (discord.ts:11). devDep `@cloudflare/workers-types ^5` vs
peerDep `^4.0.0` — the same mismatch exists in worker-kit; harmless (peer optional) but stale.
No whole-file orphans. Tests: `hmac.test.ts` (339 lines) is ~⅓ coverage of code with no runtime caller.

## 2. `packages/logger` (@xivdyetools/logger 1.3.0)

Import tally outside the package: root `ExtendedLogger` ×43 (type only), root `createLibraryLogger` ×1
(stoat-worker), `/library` `Logger` ×6 + `NoOpLogger` ×5 + `ConsoleLogger` ×1 (all in packages/core +
web-app `api-service-wrapper.ts`), `/worker` `createRequestLogger` ×1 (worker-kit middleware),
`/browser` `browserLogger` ×1 + `perf` ×1 (web-app `shared/logger.ts`).

| symbol | class | lines | evidence |
|---|---|---|---|
| `perf` (presets/browser.ts:181-302) | TEST-ONLY | 122 (+ ~200 in browser.test.ts, + web-app `shared/__tests__/logger.test.ts` §perf) | web-app `shared/logger.ts:17` re-exports it, but the only importer of `perf` from `shared/logger` is that file's own test; `__tests__/setup.ts` mocks it. No production code calls `perf.*` |
| `getRequestId(request)` (presets/worker.ts:130-152) | DEAD (`@deprecated`, `@internal`) | ~22 (+ worker.test.ts:248-…) | not on any barrel; `createRequestLogger` does not call it despite the comment / DEAD-070 note; every worker uses worker-kit's `getRequestId(c)` |
| `createSimpleLogger` (core/base-logger.ts:392-403) | DEAD (`@internal` since DEAD-068) | 12 (+ base-logger.test.ts block) | zero callers |
| `createWorkerLogger` | INTERNAL-ONLY (documented as the deprecated pattern) | — | only real caller is `createRequestLogger`; the two grep hits in worker-kit are JSDoc examples |
| `createBrowserLogger` | INTERNAL-ONLY / DOCUMENTED-PUBLIC-API | — | only used to build the `browserLogger` singleton (browser.ts:303); web-app's `@deprecated` hints tell devs to call it — KEEP |
| `BaseLogger`, `ConsoleAdapter`, `JsonAdapter`, `NoopAdapter` | DOCUMENTED-PUBLIC-API (README "Custom Adapter", "Adapters" tables) | — | never imported outside; consumed internally by all three presets. KEEP as extension points, or drop from the root barrel |
| root re-exports of `browserLogger`, `perf`, `createRequestLogger`, `NoOpLogger`, `ConsoleLogger`, `createBrowserLogger` | REDUNDANT-RE-EXPORT | ~10 | all live consumers use the `/browser`, `/library`, `/worker` subpaths |
| types `LogLevel`, `LogContext`, `LogEntry`, `LoggerConfig`, `ErrorTracker`, `BrowserLoggerOptions`, `WorkerLoggerOptions` | INTERNAL-ONLY / public .d.ts surface | — | used by internal signatures; no external import. KEEP |
| `CORE_REDACT_FIELDS` / `DEFAULT_REDACT_FIELDS` (constants.ts:14/50) | LIVE (knip "duplicate export" is by design: alias) | — | `DEFAULT_REDACT_FIELDS` used by base-logger.ts:11,40,198; `WORKER_REDACT_FIELDS` by worker.ts:12 |
| `presets/library.ts` doc comments | stale docs | — | examples still say `from 'xivdyetools-core'` (pre-scope package name) |

Dependencies: none at runtime; correct. `types.test.ts` (207 lines) is a compile-time-only "test" of type
aliases — cannot fail at runtime except by tsc.

## 3. `packages/worker-kit` (@xivdyetools/worker-kit 1.0.0)

Import tally: root — `requestIdMiddleware` ×8, `loggerMiddleware` ×8, `getLogger` ×6, `getRequestId` ×4,
`MiddlewareVariables` ×5, `rateLimitMiddleware` ×2 (api-worker, presets-api); `/rate-limiter` —
`KVRateLimiter` ×4, `MemoryRateLimiter` ×3 (api-worker universalis, oauth, presets-api), `UpstashRateLimiter` ×1,
`getClientIp` ×4, `getRateLimitHeaders` ×0 external (api-worker has its own), `getOAuthLimit` ×1,
`getDiscordCommandLimit` ×1, `PUBLIC_API_LIMITS` ×1, `RateLimiter` type ×2. Nobody imports the
`/middleware`, `/rate-limiter/memory|kv|upstash|presets` subpaths (DEPRECATIONS.md says they were
"preserved" for the `@xivdyetools/rate-limiter` migration — DOCUMENTED-PUBLIC-API, package.json only).

| symbol | class | lines | evidence |
|---|---|---|---|
| `formatRateLimitMessage` (rate-limiter/headers.ts:66-81) | DEAD (README-documented) | 16 (+ ~40 headers.test.ts) | zero callers; discord-worker's `services/rate-limiter.ts:202` has a *different* message (Discord markdown, "You're using this command too quickly") — not a drop-in duplicate |
| `MODERATION_LIMITS` (presets/configs.ts:130-145) | DEAD / DUPLICATE | 25 (+ configs.test.ts) | moderation-worker `middleware/rate-limit.ts:69` defines its own `RATE_LIMIT_CONFIGS` with the same numbers (20+5 / 60+10) in a `requestsPerMinute` shape — the shared preset was never adopted |
| `UNIVERSALIS_PROXY_LIMITS` (configs.ts:170-173) | DEAD | 8 (+ tests) | api-worker universalis router builds its config from env vars (`RATE_LIMIT_REQUESTS`) |
| `OAUTH_LIMITS`, `DISCORD_COMMAND_LIMITS` | INTERNAL-ONLY / LIVE | — | consumed through `getOAuthLimit` / `getDiscordCommandLimit` (and discord-worker reads `DISCORD_COMMAND_LIMITS` directly) |
| `EndpointRateLimitConfig` (rate-limiter/types.ts:81-84) | DEAD type | 10 | defined, never referenced anywhere incl. inside the package |
| `ExtendedRateLimiter`, `MemoryRateLimiterOptions`, `KVRateLimiterOptions`, `UpstashRateLimiterOptions`, `RateLimiterLogger`, `GetClientIpOptions`, `RequestIdOptions`, `LoggerMiddlewareOptions`, `RateLimitMiddlewareOptions` | INTERNAL-ONLY (constructor/option types of live classes) | — | KEEP — needed in .d.ts |
| `MemoryRateLimiter` | LIVE | — | 3 production imports (not test-only) |
| `rateLimitMiddleware` | LIVE | — | api-worker `middleware/rate-limit.ts:14`, presets-api `middleware/rate-limit.ts` |
| `getRateLimitHeaders` | LIVE internal + DUPLICATE | — | used by worker-kit's own `rateLimitMiddleware`; api-worker `universalis/services/rate-limiter.ts:80` re-implements a seconds-based variant on top of `MemoryRateLimiter` |

Dependencies: `@upstash/redis` used (upstash.ts:29), `@xivdyetools/logger` used (middleware/logger.ts,
types.ts), `hono` peer used. Fine.

## 4. `packages/types` (@xivdyetools/types 2.0.0)

Import tally highlights: `Dye` ×91, `LocaleCode` ×28, `PresetCategory` ×20, `PriceData` ×16, `AppError` ×16,
`ErrorCode` ×14 … Full per-symbol external counts were computed for all 121 exports; the ones with zero
*real* (non-shim, non-comment) uses:

| symbol | class | lines | evidence |
|---|---|---|---|
| `RACE_SUBRACES`, `SUBRACE_TO_RACE`, `COLOR_GRID_DIMENSIONS` (character/index.ts) | DEAD / DUPLICATE (README + CLAUDE.md document them) | ~85 of 177 | zero importers; race→clan tables are hand-rolled again in discord-worker `types/preferences.ts:152` (`CLANS_BY_RACE`, display-name variant), og-worker `svg/dye-helpers.ts:81` (`ALL_SUBRACES`), web-app `swatch-tool.ts:121` and `v4/config-sidebar.ts:98` (`raceKey`+`subraces` lists) |
| `createSnowflake`, `DiscordSnowflake` (auth/discord-snowflake.ts:36,82) | DEAD (DEAD-059 already removed from root barrel; still on `/auth`) | ~36 (+ part of 99-line test) | zero adoption; `isValidSnowflake` is live (×5); bot-logic has its own `isValidDiscordSnowflake` (moderators.ts:18) — DUPLICATE of `isValidSnowflake` |
| `DyeDatabase` interface (dye/database.ts) | DEAD (whole file; `@internal` note says apps use core's class) | 27 | zero references; name collides with core's `DyeDatabase` class — README:103 still shows importing it |
| `MATCH_QUALITY_TIERS` | INTERNAL-ONLY (REFACTOR-004 documented) | — | only `classifyMatchDistance` reads it; bot-logic imports the function + `MatchQualityKey` — KEEP exported (single source of truth) or un-export |
| `Matrix3x3` | INTERNAL-ONLY | — | field type of `ColorblindMatrices` (used by core `BRETTEL_MATRICES`/`MACHADO_MATRICES`) — KEEP |
| `ErrorSeverity` | INTERNAL-ONLY | — | ctor param type of `AppError` — KEEP |
| `PresetSortOption` | chain-dead | 1 | only in discord/moderation shims; web-app defines its own twice |
| `ModerationResponse`, `CategoryListResponse` (preset/response.ts:177-209) | chain-dead | ~33 | only in presets-api shim; presets-api handlers don't type their responses |
| `OAuthState` (auth/jwt.ts:88-97), `XIVAuthSocialIdentity` (auth/xivauth.ts) | chain-dead | ~10 + ~15 | only in oauth shim; oauth's real state shape is `StateData` in `utils/state-signing.ts:17` (different fields: csrf/code_challenge/iat/exp) — the shared type is stale, not shared |
| `AuthUser` (auth/response.ts:15) | TEST-ONLY chain | — | only importer is test-utils `factories/user.ts` (itself unconsumed); web-app redefines it; still needed as the `user` field of the live `AuthSuccessResponse` |
| `PresetSubmit{Created,Duplicate,Error}Response`, `PresetEdit{DuplicateInfo,Success,Duplicate,Error}Response`, `Vote{Success,Error}Response`, `Moderation{Success,Error}Response`, `Auth{Success,Error}Response`, `Refresh{Success,Error}Response`, `UserInfo{Data,Success,Error}Response` | INTERNAL-ONLY (already `@internal` in JSDoc) | — | constituents of live unions (`PresetSubmitResponse`, `AuthResponse`, …); knip flags them because they sit on the barrel. Un-export or leave |
| `CharacterColorCategory` | INTERNAL-ONLY (not even on the barrel) | — | used by `COLOR_GRID_DIMENSIONS` only → dies with it |

Legacy markers (`legacy-markers.txt` lines 76-80): `auth/jwt.ts:48` (`jti` optional "for backward compat"),
`character/index.ts:29` (`hsv?` optional), `color/branded.ts:95` (doc example), `dye/dye.ts:41,52`
(`stainID: number | null` "null arm survives only for legacy fixture shapes" and `id` "kept for the pre-v2
contract") — all are documented, load-bearing compatibility notes on live types; nothing to remove here
without a schema-v3 decision. Dependencies: none; correct.

## 5. `packages/test-utils` (workspace-private 1.2.0)

Consumers: api-worker (2 files), discord-worker (1), moderation-worker (7), oauth (1), presets-api (4),
svg (3, via `/factories`). bot-logic and stoat-worker declare the devDependency but never import it (2 unused
devDeps). web-app does not depend on it at all — so `/dom` has no possible consumer today.

Symbols actually imported outside the package (14): `createMockKV`, `createMockD1Database`, `createMockR2Bucket`,
`MockR2Bucket` (type), `createMockFetcher`, `createMockDye`, `VALID_CODE_VERIFIER`, `VALID_CODE_CHALLENGE`,
`createTestJWT`, `createExpiredJWT`, `authHeaders`, `createMockPresetRow`, `createMockSubmission`,
`createMockCategoryRow`. Re-exported by `apps/presets-api/tests/test-utils.ts` but then imported by no
presets-api test (chain-dead, 9): `createBotSignature`, `authHeadersWithSignature`, `createAuthContext`,
`createModeratorContext`, `createUnauthenticatedContext`, `createMockPreset`, `createMockVoteRow`,
`assertJsonResponse`, `TEST_SIGNING_SECRET`.

| candidate | class | lines (src / own tests) | evidence |
|---|---|---|---|
| `src/dom/*` (canvas, fetch, localStorage, matchMedia, resizeObserver + index) | TEST-ONLY (self-tests only); README-documented | 760 / ~1,000 | zero importers; web-app (the only browser test suite) has its own `matchMedia` stub in `src/__tests__/setup.ts` and never depends on test-utils |
| `src/assertions/response.ts` (+index) | TEST-ONLY | 184 / ~250 | `assertJsonResponse` only reaches the presets-api shim; the other 6 asserts have zero references |
| `src/cloudflare/analytics.ts` (`createMockAnalyticsEngine`, `MockAnalyticsEngine`, `AnalyticsDataPoint`) | TEST-ONLY | 74 | discord-worker's `src/test-utils.ts:50` has its own 4-line `createMockAnalytics` |
| `src/factories/user.ts` (`createMockUser`, `createMockUsers`, `createDiscordUser`, `createXIVAuthUser`, `userToRow`, `createMockUserRow`, `UserRow`) | TEST-ONLY | 157 | zero external importers (`createMockUserRow`/`UserRow` grep hits are oauth's own local symbols) |
| `src/factories/vote.ts` (`createMockVoteRow`, alias `createMockVote`, `createMockVotes`, `createVotesForPreset`, `createVotesFromUser`) | TEST-ONLY (+ knip "duplicate export": `createMockVote` is an alias) | 97 | only reaches presets-api shim, never consumed |
| `src/constants/secrets.ts` (13 `TEST_*` constants) | TEST-ONLY | 86 | `TEST_SIGNING_SECRET` shim-only; the other 12 zero references |
| `src/auth/context.ts` (`createAuthContext`, `createModeratorContext`, `createBotAuthContext`, `createWebAuthContext`, `createUnauthenticatedContext`, `AuthSource` re-export) | TEST-ONLY | 104 | shim-only |
| `src/auth/signature.ts` (`createBotSignature`, `createTimestampedSignature`, `verifyBotSignature` re-export) | TEST-ONLY | 103 | shim-only; consumes `@xivdyetools/auth` `verifyBotSignature` — the only in-repo *test* of the shared verifier from a consumer side |
| `src/utils/crypto.ts` | REDUNDANT-RE-EXPORT | 15 | 6-function pass-through of `@xivdyetools/auth/encoding`; internal callers (`auth/jwt.ts:26`, `auth/signature.ts:28`) could import `@xivdyetools/auth/encoding` directly; `base64UrlDecodeBytes`, `base64UrlDecode`, `hexToBytes` unused even internally. Root barrel then re-publishes all six via `export * from './utils'` |
| `randomId`, `randomStringId` on `factories/index.ts:15-18` | REDUNDANT-RE-EXPORT | 5 | already exported via `utils/index.ts` → root; consumers use neither (`nextStringId` is a wrapper of `randomStringId`) |
| `factories/dye.ts` extras (`createMockDyes`, `createMetallicDye`, `createPastelDye`, `createDarkDye`, `getMockDyeById`, `getMockDyesByIds`) | TEST-ONLY | ~90 of 255 | only `createMockDye` (×7) is used; the 22 external `mockDyes` hits are web-app's own `__tests__/mocks/services` fixture, not this package |
| `factories/preset.ts` extras (`createMockPresets`, `createCuratedPreset`, `createPresetWithStatus`, `presetToRow`, `rowToPreset`, `createMockPreset`) | TEST-ONLY | ~120 of 238 | live: `createMockPresetRow` ×5, `createMockSubmission` ×3 |
| `factories/category.ts` extras (`createMockCategory`, `createMockCategories`, `createCuratedCategory`, `categoryToRow`, `DEFAULT_CATEGORIES`) | TEST-ONLY | ~100 of 140 | live: `createMockCategoryRow` ×1 |
| `constants/pkce.ts` extras (`INVALID_*`, `MIN/MAX_VERIFIER_LENGTH`, `S256_CHALLENGE_LENGTH`, `VERIFIER_PATTERN`, `generateCodeChallenge`, `isValid*Format`) | TEST-ONLY | ~90 of 119 | live: `VALID_CODE_VERIFIER` ×3, `VALID_CODE_CHALLENGE` ×4 (oauth) |
| `auth/headers.ts` extras (`jsonHeaders`, `authenticatedJsonHeaders`, `mergeHeaders`, `authHeadersWithSignature`) | TEST-ONLY | ~80 of 134 | live: `authHeaders` ×2 |
| `auth/jwt.ts` extras (`createJWTWithExpiration`, `FullJWTPayload`, `TestJWTPayload`) | TEST-ONLY | ~30 | live: `createTestJWT` ×3, `createExpiredJWT` ×2 |
| `@testing-library/dom` devDependency | DEAD dep | — | not imported anywhere in src or tests |
| devDeps of bot-logic / stoat-worker on `@xivdyetools/test-utils` | DEAD dep | — | never imported by either |
| DUPLICATE: `apps/discord-worker/src/test-utils.ts` | DUPLICATE (other track) | ~100 of 144 | re-implements `createMockKV`, `createMockD1`, `createMockAnalytics`, `createMockDye`, `createMockDyes`, `createMockPreset` next to the shared ones; only `createMockEnv` is imported (3 files) |

Note: knip's `AuthSource` unused-type flag on `auth/context.ts:23` is a re-export of a types-package type; trivial.

## 6. Dependency check summary

| package | finding |
|---|---|
| logger | clean (no runtime deps) |
| auth | clean; peer `@cloudflare/workers-types ^4` vs dev `^5` drift |
| worker-kit | clean; same peer/dev drift |
| types | clean |
| test-utils | `@testing-library/dom` unused devDep; peer `vitest >=2` used |
| consumers | `@xivdyetools/logger` unused direct dep in api-worker, oauth, presets-api; `@xivdyetools/test-utils` unused devDep in bot-logic, stoat-worker |

## 7. Whole-file orphans

None of the five packages has a src file unreachable from a barrel/subpath. Files whose *entire* export
surface has no consumer: `types/src/dye/database.ts` (27), `test-utils/src/dom/*` (760), `test-utils/src/assertions/*`
(184), `test-utils/src/cloudflare/analytics.ts` (74), `test-utils/src/factories/user.ts` (157),
`test-utils/src/factories/vote.ts` (97), `test-utils/src/constants/secrets.ts` (86),
`test-utils/src/auth/context.ts` (104), `test-utils/src/auth/signature.ts` (103), `test-utils/src/utils/crypto.ts` (15).
