# Dead-code review: api-worker (apps/api-worker)

Preview branch preview/integration-2026-10-04. Read-only audit.

## Module map
- src/index.ts: Hono app; mounts /v1 (dyes, harmony, match, wheels, chara, telemetry), /universalis and /api/v2 (universalisRouter), ASSETS for developers host.
- src/universalis/: router, cache-service, cached-fetch, request-coalescer, rate-limiter (PR #229: selectProxyRateLimiter -> CloudflareRateLimiter | KVRateLimiter), config/{cache,datacenters}, test-setup (test only).
- src/middleware/: rate-limit (selectApiRateLimiter, selectTelemetryRateLimiter), locale.
- src/chara/: router, resolver, xivapi, cache, acquisition, regional-names, generated JSON tables.
- scripts/: manual patch-time generators (build-acquisition.ts, build-item-names.mjs); documented in CLAUDE.md/README/.gitattributes.
- docs/.vitepress: config, theme .vue components + lib/*.ts.

## Commands run (all from the worktree root, tracked files only)
- `git ls-files apps/api-worker` -> 100+ files listed; inventory above.
- `symrefs.sh apps/api-worker pluralOf` -> prod=0 tests=8 other=1 (docs/superpowers plan only). Batch mode timed out (120s) -> replaced with an in-memory scratchpad python equivalent (`refs.py`: git ls-files once, \b word counts, same prod/tests/other buckets, excludes docs/audits, CHANGELOG, coverage). Its prod count includes the declaration itself.
- refs.py over ~145 exports (every `^export` in src/ and scripts/ and docs/.vitepress): every one has either a second prod reference, a prod consumer in another file, or is a type/const used only inside its own file. No export with prod=decl-only AND tests=0 AND other=0 that knip would not already flag (knip lint:dead gate is clean per root-knip.txt). Results with prod files=1: pickGlasses/RowSource/CHARA_CACHE_CONFIG/XivapiEnv/DEFAULT_XIVAPI_* are file-internal uses (export keyword only); knip has no complaint, not filed.
- scripts/ exports (formatEntries, pluralOf, fateZoneLevels, tablesFrom, markerCoordinate, nearestSettlement, overrideLine, selectEntries, collectSources, buildInputs) -> each imported by scripts/build-acquisition.ts or the script chain, plus tests.
- `members.py` on RequestCoalescer, CacheService, XivapiClient, CharaRowCache (tool counts are name-only, noisy); hand-verified with `git grep`: CacheService.store (called by storeAsync and cache-service.test.ts), storeAsync (cached-fetch.ts:116,217; chara/cache.ts:71,86), XivapiClient.versionKey/searchItems/getGlasses/fetchIcon (chara/router.ts:203,213,244,300), CharaRowCache.getRows/storeRows/getGlasses/storeGlasses (router.ts:206,214,234,247) all live.
- `git grep MemoryRateLimiter|BUG-066|resetRateLimiter|getRateLimiter|createRateLimiter|__reset` over apps/api-worker -> only CHANGELOG and explanatory comments (rate-limiter.ts:10, router.ts:173); no code, test hook, mock or helper of the old per-isolate limiter remains. CHANGELOG.md:21 states the limiter and its test hook were removed.
- `git grep` of docs/guide, CLAUDE.md, README for "in-memory|memory limiter|isolate" -> CLAUDE.md:180 describes the api middleware correctly; nothing stale about the proxy limiter.
- wrangler.toml vs env reads (grep of `env.`/`c.env.` in src non-test): API_RATE_LIMITER (rate-limit.ts:39), TELEMETRY_RATE_LIMITER (:177), SERVICE_RATE_LIMITER (:65), UNIVERSALIS_RATE_LIMITER and UNIVERSALIS_SERVICE_RATE_LIMITER (universalis/services/rate-limiter.ts:78), RATE_LIMIT KV (three KV fallbacks), ANALYTICS (telemetry/router.ts:103), ASSETS (index.ts:44), ENVIRONMENT, API_VERSION, UNIVERSALIS_API_BASE (router.ts:199+), RATE_LIMIT_REQUESTS/WINDOW_SECONDS (router.ts:170-171), XIVAPI_BASE/VERSION/SCHEMA (xivapi.ts:215-217). Every declared binding/var is read; every Env field is declared. No orphan config.
- DEPRECATIONS.md grep for api-worker/universalis: entries are for removed apps (api-docs, universalis-proxy); both are gone (no apps/ dir). Nothing listed for api-worker internals.
- Skips/todo grep `\.(skip|only|todo)\(|xit\(|TODO|HACK|OBSOLETE` over src, scripts, tests, docs/.vitepress -> no hits. `legacy|compat` hits are live behaviour: Facewear negative-id 404 (routes/dyes.ts:240-248, test dyes-facewear-404), LEGACY_MATCHING_METHOD_MAP (validation.ts:403), /api/v2 compatibility mount (index.ts:181).
- Dependencies: @xivdyetools/core, worker-kit, types (type-only imports in src/lib, routes), hono; devDeps vitepress+vue (docs), @xivdyetools/svg (docs Glyph.vue:3 chromeGlyph/toolGlyph), test-utils (tests), wrangler (scripts), vitest, coverage-v8, workers-types, @types/node. All used.
- VitePress: refs.py over docs/.vitepress/lib exports -> every export consumed by a .vue component or config.ts (endpoints, fields, live, shiki-theme, search-index).
- ErrorCode: all 13 members have prod consumers.

## Candidates (borderline)
1. universalis/services/rate-limiter.ts:90 `config.windowSeconds === 10 ? 10 : 60` - the 10 s tier is unreachable in config: RATE_LIMIT_WINDOW_SECONDS is "60" in both wrangler envs (wrangler.toml [vars] and env.production.vars), router falls back to 60. Only tests/wrangler-config.test.ts:114 allows [10, 60] and no test asserts a 10 s tier. Dead path, ~1 line, speculative generality introduced by PR #229. Weak candidate.
2. universalis/services/request-coalescer.ts:173 isInFlight and :183 getInFlightCount, both @testonly (dead-code-check.txt). Reasons still hold: they observe module-scope inFlightRequests state that tests cannot reach otherwise (request-coalescer.test.ts cleanup/long-running scenarios). Genuine observation hooks; recommend KEEP.
3. tests/test-utils.ts:21 `export { createMockKV }` - re-export; no test imports createMockKV from `../test-utils` (all import from @xivdyetools/test-utils directly: grep shows none). Dead re-export, 1 line (createMockEnv in same file has 36 refs).

## Positive controls
- selectProxyRateLimiter has 3 prod files and 11 test refs; checkRateLimit/getRateLimitHeaders live from router.ts.
- Old limiter fully removed: no MemoryRateLimiter import, no reset hook, no mock.
- tests/wrangler-config.test.ts pins ratelimits limits to RATE_LIMIT_REQUESTS (lines 101-124), so wrangler vs code drift is guarded.
- ratelimit binding names: 5 declared in both envs, 5 read.

## Rejected (live)
- scripts/build-acquisition.ts, build-item-names.mjs: not in package.json scripts but documented manual generators (CLAUDE.md:77-78, .gitattributes:10-13), they write the committed src/chara/data JSON that acquisition.ts/regional-names.ts import.
- src/universalis/test-setup.ts: imported by 6 test files; MockCache etc. used internally.
- CacheService.store: public method used by storeAsync and tests.
- All `export` on types with file-internal-only use (HttpMethodLike, FieldSet, ApiWheelSummary...): not knip-flagged, not dead.
- pickItem/hasActiveDyeFilters/createApiRateLimitMiddleware: exported, used internally and by tests (export keyword only).

## Prior KEEP triggers
- DEAD-020 (rate-limit fallbacks): trigger NOT met. PR #229 adds a fourth native-binding/KV selector (universalis:ip:/universalis:svc:) with KV fallback, so fallback surface grew; no retirement design, no local replacement, no operational evidence in repo. Local `wrangler dev` has all five bindings declared in top-level toml, but tests still exercise the KV branch (rate-limiter.test.ts:37). Keep.
- DEAD-018/019/021 do not touch this unit.

## Files covered
~100 tracked files under apps/api-worker (src, scripts, tests, docs/.vitepress, wrangler.toml, package.json, configs); JSON data and fixtures checked only by consumer.
