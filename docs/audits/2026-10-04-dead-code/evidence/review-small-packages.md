# Dead-code review: small-packages (worker-kit, auth, logger, types, test-utils)

Branch preview/integration-2026-10-04 (main@8ecb878f + 13 PRs). Read-only. Tracked files only.
Helpers used: /tmp/sr.sh and /tmp/sr2.sh (my git-grep -l -w wrappers; symrefs.sh was too slow, >120s per batch) buckets: prod (own src non-test) / tests / other (outside the unit, non-test).

## Delta result
- pr-delta.txt: NO file of this unit is touched by any of the 13 PRs. `grep -E 'packages/(worker-kit|auth|logger|types|test-utils)' pr-delta.txt` -> empty.
- delta-since-2026-09-15.txt touches: auth/discord.ts (+34/-18, body streaming), logger/presets/browser.ts (+2/-1), test-utils/factories/dye.ts (+55/-4) and factories/index.ts, worker-kit body-guards/ + image-sniff/ (new, REFACTOR-008/009). Checked each; leftovers listed under candidates (test-utils dye.ts only).
- PR #229 effect: `git show 8ecb878f:apps/api-worker/src/universalis/services/rate-limiter.ts` constructed `new MemoryRateLimiter()` at module scope. After #229 api-worker constructs only CloudflareRateLimiter + KVRateLimiter.

## Backend construction map (non-test `new X(` in apps, `git grep -n -E 'new (Memory|KV|Upstash|Cloudflare)RateLimiter' -- apps packages ':!*.test.ts'`)
| Backend | Constructed by | Role |
|---|---|---|
| CloudflareRateLimiter | api-worker middleware/rate-limit.ts:40,66,178 + universalis/services/rate-limiter.ts:81; discord-worker services/rate-limiter.ts:147; moderation-worker middleware/rate-limit.ts:168; oauth services/rate-limit.ts:104; presets-api middleware/rate-limit.ts:59,76 | primary (native [[ratelimits]]) |
| KVRateLimiter | api-worker x4 (rate-limit.ts:48,71,189; universalis rate-limiter.ts:96); discord-worker :154; moderation-worker :169; oauth :113 | fallback when binding absent (DEAD-020 keep family) |
| MemoryRateLimiter | oauth services/rate-limit.ts:89; presets-api middleware/rate-limit.ts:37,49 | last-resort fallback only (DEAD-020) ; api-worker lost its last use in #229 |
| UpstashRateLimiter | NOBODY. `git grep -n 'UpstashRateLimiter' -- apps` = comments/CHANGELOG only; discord-worker dropped it (FINDING-007, apps/discord-worker/CHANGELOG.md:618) | only its own test packages/worker-kit/src/rate-limiter/backends/upstash.test.ts |

Subpath import tally (`git grep -h -o "from '@xivdyetools/worker-kit[^']*'" -- apps packages scripts`): root 34, /body-guards 6 (oauth, presets-api), /image-sniff 7, /rate-limiter 17. ZERO in-repo importers of /middleware, /rate-limiter/memory, /kv, /upstash, /cloudflare, /presets (published exports-map entries only; the 3 `/upstash` hits are a docblock in backends/upstash.ts:15).
auth subpath tally: root 18, /encoding 10 (moderation-worker, oauth, test-utils/src/auth/jwt.ts:26), /discord /hmac /jwt /timing = only in .md docs, /revocation 0.
logger tally: root 55, /library 14 (core, web-app), /browser 2 (web-app), /worker 3 (worker-kit middleware/logger.ts:17).
test-utils tally: root 29, /cloudflare 5, /factories 4, /constants 1, /auth 0.

## Candidates (see StructuredOutput for the machine-readable list)
1. UpstashRateLimiter (+ UpstashRateLimiterOptions, subpath ./rate-limiter/upstash, dependency @upstash/redis, root-barrel re-export that drags the Redis client into every root importer's graph). No in-repo constructor; test-only. @public-tagged "documented backend". Privacy history (discord FINDING-007) argues for retirement; npm API break -> next worker-kit major.
2. packages/test-utils/integration/ (setup.ts 214 lines + 2 test files 581 lines): both suites test a locally re-implemented copy of presets-api auth middleware (`processBotAuth`, local `verifyJWT`), never importing presets-api; bot-authentication.test.ts header admits it models a dropped contract. Real coverage is apps/presets-api/tests/middleware/auth*.test.ts. setup.ts carries @testonly (dead-code-check.txt) and its only importers are those two files. Private package: delete, never @public.
3. test-utils createMockD1 (cloudflare/d1.ts:477): no consumer outside its own tests/cloudflare/d1.test.ts (apps use createMockD1Database).
4. test-utils resetMockDyeSequence + randomStainId (factories/dye.ts:62,72, added in the Sep delta): zero callers outside tests/factories/dye.test.ts; no suite calls the reset, so the sequence-exhaustion throw is reachable only by its own test.
5. test-utils nextStringId (utils/counters.ts:52): alias delegating to randomStringId, one caller (factories/preset.ts:76).
6. worker-kit MemoryRateLimiter.size getter (memory.ts:173): only memory.test.ts:190,217.
7. logger ExtendedLogger.child / setContext / time and the DelegatingLogger class (core/base-logger.ts:439-540): no non-test caller outside packages/logger (`git grep -E '\.(child|setContext|time|timeAsync)\(' -- apps packages ':!packages/logger/src'` empty; worker.ts:78 uses setContext on a freshly built logger only). Gate misses them because the words appear in comments. Published interface -> KEEP unless major.
8. logger createBrowserLogger errorTracker path (presets/browser.ts:102-140) + ErrorTracker + BaseLogger.redactContext/sanitizeMessage: only web-app createBrowserLogger({isDev}) callers; none passes errorTracker/devOnly/prefix.
9. types createDyeId/createHue/createSaturation (color/branded.ts): no production consumer anywhere; only packages/core/src/types/__tests__/index.test.ts imports them (knip counts tests as entries). createHexColor is live.
10. types ErrorCode.DYE_NOT_FOUND / STORAGE_QUOTA_EXCEEDED / IMAGE_LOAD_FAILED: never thrown; only error-handler.ts:78-83 map keys + web-app/core tests.
11. types ToolKey (localization/index.ts:54) @deprecated, "nothing reads it": but core LocalizationService.getToolName (:499,:507) + TranslationProvider.getToolName (:354) + LocaleData.tools (:147) still reference it and have zero callers (og-worker getToolName at og-data-generator.ts:179 is a local function). Cross-unit with core; "removal is a core major".
12. worker-kit getClientIp option trustXForwardedFor (rate-limiter/ip.ts): never passed by any app (default false); XFF branch only reachable from ip.test.ts. Stale comments at ip.ts:67 ("default true for compat") and the JSDoc example "Default: trusts X-Forwarded-For" contradict `@default false`.
13. auth verifyDiscordRequest options maxBodySize / maxTimestampAgeSeconds / maxFutureSkewSeconds and verifyBotSignatureV2 maxAgeMs / clockSkewMs: no caller passes them (discord-worker index.ts:736, moderation-worker index.ts:160 use defaults). Tested config knobs; low value.
14. auth barrel re-export of hmacSignHex: only external consumer is apps/presets-api/tests/middleware/auth-v2.test.ts:20; function itself is live via createBotSignatureV2 (hmac.ts:309).
15. logger `export` on looksLikeSecretValue (base-logger.ts:594): only used inside base-logger.ts; tests mention it in comments only. Nit.

## Positive controls (live, verified)
- CloudflareRateLimiter constructed in 5 apps; KVRateLimiter in 4; MemoryRateLimiter in 2 (fallback).
- bodyGuards -> apps/oauth/src/middleware/body-validation.ts:15, apps/presets-api/src/middleware/body-validation.ts:14; sniffImageType/detectImageFormat -> image-worker validators.ts:14, presets-api preview-image-service.ts:12.
- auth /encoding live: moderation-worker handlers/modals/ban-reason.ts, oauth jwt-service.ts / pkce-binding.ts / state-signing.ts, test-utils auth/jwt.ts:26.
- createLibraryLogger live only via stoat-worker (index.ts:28, message-handler.ts:23); NoOpLogger via core + web-app api-service-wrapper.ts:13; createBrowserLogger via web-app shared/logger.ts:71,74; createRequestLogger via worker-kit middleware/logger.ts:17.
- OAUTH_LIMITS / DISCORD_COMMAND_LIMITS / MODERATION_LIMITS reached only through their getXLimit lookups (apps mention them in comments only); PUBLIC_API_LIMITS -> presets-api rate-limit.ts.
- test-utils createMockKV / createMockAnalyticsEngine -> discord-worker src/test-utils.ts; createMockFetcher -> moderation-worker preset-api tests; createMockR2Bucket/createMockD1Database/createMockPresetRow -> presets-api tests/test-utils.ts.

## Rejected (checked, live or accepted)
- DEFAULT_DISCORD_MAX_TIMESTAMP_AGE_SECONDS, BOT_SIGNATURE_V2_MAX_AGE_MS: used internally (discord.ts:101, hmac.ts:323), @public for consumers.
- createHmacKey / hmacVerifyHex: internal callers (hmac.ts:66, :334); apps only mention them in comments.
- looksLikeSecretValue/safeStringify: internal + adapters use safeStringify.
- worker-kit ExtendedRateLimiter checkOnly/increment: moderation-worker rate-limit.ts:205,247 call them.
- RateLimiter.reset(key)/resetAll: interface contract; resetAll used by oauth resetRateLimiter (@testonly hook, keep).
- types RateLimitResult/ModerationResult/ModerationLogEntry: re-exported by presets-api types.ts:59 and imported by rate-limit-service.ts:21.
- Dependencies: discord-interactions (auth/discord.ts verifyKey), @upstash/redis (only backends/upstash.ts, see candidate 1), hono (peer; body-guards, middleware), @xivdyetools/logger (worker-kit middleware); test-utils deps auth + types used (src/auth/jwt.ts:26, factories). No unused deps besides the Upstash-bound one.
- DEPRECATIONS.md retired packages (crypto, rate-limiter, worker-middleware, bot-i18n, color-blending): none present under packages/ (`ls packages`); only stale prose mentions in comments (apps/discord-worker/src/index.ts:178, moderation-worker index.ts:59, oauth index.ts:35, presets-api index.ts:50, presets-api preset-service.ts:19, moderation-worker middleware/rate-limit.ts:10) -- outside this unit.
- Skipped tests: `git grep -E '\b(it|test|describe)\.(skip|todo|only)\b|xit\(' -- <unit>` -> none. No snapshot files.
- Orphaned source files: none; every non-index source file has an importer (validateStructure imported by body-guards.ts; key-scope.ts by the backends). Duplicate-not-dead note: moderation-worker src/utils/safe-json.ts still has its own validateStructure copy (REFACTOR-009 only converted oauth + presets-api).

## Prior KEEP register
- DEAD-018 (core APIs): not in this unit; trigger (next core major) not met. Candidate 11 is a sibling and rides the same trigger.
- DEAD-019 (Stoat scaffolding): not in this unit; stoat consumes logger createLibraryLogger (live).
- DEAD-020 (rate-limit fallbacks): MemoryRateLimiter and KVRateLimiter survive only as fallbacks. Trigger "fallback retirement designed + local/test replacements + operational evidence" NOT met. Upstash (candidate 1) is distinct: it is not a fallback, nothing selects it.
- DEAD-021 (Discord test assertion contract): not this unit. (The 2026-08-18 logger DEAD-021 KEEP of adapters/BaseLogger/presets is a separate older register; still adjudicated KEEP, trigger unchanged.)
- Test-only exemptions in this unit: `packages/test-utils/integration/setup.ts` (@testonly, see candidate 2: reason "only tests construct these" is true but the tests are self-referential); `@public` ones: BaseLogger.timeAsync and DelegatingLogger.timeAsync (reasons hold; interface contract), AppError.toJSON (types/error/app-error.ts, published).

## Files covered
packages/worker-kit (28 source+test files), packages/auth (15), packages/logger (19), packages/types (47 source files), packages/test-utils (35 incl. integration/). Reads were targeted (exports, consumers, config, package.json); every tracked non-test source file in the unit had its exports enumerated and checked.
