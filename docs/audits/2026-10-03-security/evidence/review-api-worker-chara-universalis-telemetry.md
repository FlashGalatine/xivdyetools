# Review: api-worker /chara, /universalis, /telemetry (2026-10-03, commit 0ab33466)

Scope: apps/api-worker src/chara/**, src/universalis/**, src/telemetry/**, src/index.ts, src/middleware/rate-limit.ts, wrangler.toml, plus worker-kit logger / rate-limiter / ip helpers.
Result: no candidates. Three INFO-level observations are recorded under Rejected.

## 1. Entry points and authz matrix

Every route is reachable from the internet. data.xivdyetools.app, proxy.xivdyetools.app and proxy.xivdyetools.projectgalatine.com are all custom-domain routes (wrangler.toml:80-87), so a handler that discord-worker also reaches over a service binding is still INTERNET-UNAUTH. The top-level dev env has workers_dev=false and preview_urls=false (wrangler.toml:21-22). No route in scope has auth; all are anonymous and read-only, apart from the telemetry write.

| Route | Methods | Middleware before handler (index.ts) | Caps / validation |
|---|---|---|---|
| /v1/chara/resolve | POST | requestId, logger, security headers, CORS *, /v1/* rate limit (index.ts:98), locale | Body read through readBoundedText at 8 KB on the stream (chara/router.ts:147-163). gear has at most 12 entries, each slot at most once. Lanes are integers 0..65535. glasses is an integer 1..65535. Strict JSON object. |
| /v1/chara/icon/:iconId | GET | same | Canonical id `^[1-9]\d{0,5}$` (router.ts:56, 262). Upstream body capped at 1 MB by stream, must start with the PNG signature, served as image/png with CSP sandbox. |
| /v1/telemetry (and /*) | POST | requestId, logger, security headers, CORS, its own telemetry limiter (index.ts:100-101); the /v1/* limiter skips it | Sec-GPC: 1 returns 204 first. Origin allowlist (exact match, or loopback off-production); otherwise 204 and drop. Body capped at 16 KB by stream. Non-JSON returns 400, a non-v1 batch returns 400. At most 25 events per batch. |
| /universalis/aggregated/:dc/:ids and /api/v2/aggregated/... | GET | requestId, logger, headers, CORS. Not under /v1, so no KV or API limiter and no locale. | dc must be in the static world/DC list or in the live upstream lists. ids must match `^[\d,]+$`, at most 100 ids, each integer 1..1e6, then deduped and sorted. A per-isolate memory limiter is charged on cache miss only. |
| /universalis/data-centers, /worlds (and /api/v2) | GET | same | No input. 24 h cache. |
| /, /health | GET | same | None. |
| developers.xivdyetools.app | any | docs branch runs first, serves static assets with security headers | Out of scope. |

Rate-limit identity: getClientIp reads only CF-Connecting-IP; XFF is not trusted by default (worker-kit ip.ts). A request with no IP (a service binding) goes to the SERVICE bucket: 1300 per 60 s on /v1, and 20x the per-IP budget on /universalis (router.ts:127-142). Native [[ratelimits]] bindings are present in both envs. The telemetry limiter fails closed. The API limiter fails open, which is an accepted trade-off.

Outbound fetches:
- chara/xivapi.ts:234 goes to XIVAPI_BASE, a var set to https://v2.xivapi.com.
- cached-fetch.ts:134 goes to UNIVERSALIS_API_BASE, a var set to https://universalis.app/api/v2.
- Both use redirect:'manual' with a 10 s timeout, and a 3xx is refused.
- User input reaches the URL only as a validated integer or as a validated world/DC name.

## 2. Positive controls

- chara/router.ts:78-135 parseResolveBody is a strict allowlist: integer lanes, a slot allowlist, no duplicate slots, at most 12 gear entries, and no free-text field exists. Names, TypeName, Nickname and file names cannot enter the API; the types.ts:3-5 docblock says the same.
- xivapi.ts buildResolveQuery only interpolates charaModelKey(), an integer computed from validated lanes, and slot columns from a fixed table. There is no query injection. A request makes at most one search call and one sheet call.
- chara/cache.ts keys are `chara:3:<version>:rows:<field>:<int>`, built from integers only. A truncated XIVAPI page is not cached (router.ts:225-233).
- The icon proxy never reflects the upstream Content-Type, enforces a PNG signature, and caches under a canonical URL with the query stripped (router.ts:262-303).
- Stream-level byte caps on request bodies and upstream bodies (lib/bounded-body.ts; cached-fetch.ts:546 readBounded, 5 MB).
- The Universalis cache key is `aggregated:<dc lower>:<normalized ids>`. Datacenter is allowlisted and ids are deduped and sorted. The Cache API is used, not KV, so there is no KV poisoning surface. Cache URLs are encodeURIComponent-ed under a fixed synthetic host (cache-service.ts buildCacheUrl).
- Upstream error text is logged but not echoed. Upstream statuses are clamped to 400/404/429/500/502/503 (router.ts:92-98). The global onError never returns a stack (index.ts:236-255).
- Telemetry privacy:
  - Order of checks is GPC, then Origin, then body (telemetry/router.ts:60-77).
  - env (blob9) is derived from Origin, not from the body (schema.ts:151-157).
  - Every event goes through a Map allowlist, so there is no prototype lookup (schema.ts:118).
  - tool, entry, via, producer, theme, vp and locale are enums. stainID must exist in the dye DB. Dwell is an integer 0..1800. Bad envelope fields become 'invalid' rather than rejecting the batch.
  - The 9 blobs and 1 double written are exactly what the spec lists. No IP, UA, request id or Origin value reaches a datapoint or a log line.
  - The request logger does not log the user agent (logUserAgent is not enabled). It logs method and pathname only, with no query string. There is no [observability] block in wrangler.toml, which matches PRIVACY.md's "Workers Logs off" claim.
  - The telemetry limiter has failOpen:false plus onError:'fail-closed' (rate-limit.ts:218-232).
- Policy reconciliation:
  - apps/web-app/PRIVACY.md lines 38-41 (chara request is model numbers only), 101-129 (analytics list, five dimensions, server discards the rest) and 137-143 (KV fallback counter, 120 s) match the code. KV TTL is window 60 s + buffer 60 s = 120 s (worker-kit kv.ts:211).
  - The one difference is that the spec says `ver` matches `/^\d+\.\d+\.\d+/` while the code also allows a -prerelease tail. That is a spec wording point, not a privacy issue.
- CORS * carries no credentials (credentials:false). No cookies or auth are used, so there is no CSRF or credentialed-CORS exposure.
- .dev.vars is gitignored (.gitignore:11). wrangler vars hold no secrets.

## 3. Rejected / not filed

- Forged Origin from a non-browser can write telemetry (up to 25 points x 240 requests/min per IP). This is the documented residual of 2026-08-29 FINDING-014 (origin.ts header: "raises the bar ... to a direct HTTP client"). It is fail-closed and allowlist-validated, so it can skew counts but injects no free text. Not re-filed.
- `ver` accepts any d.d.d(-[A-Za-z0-9.]+)? string up to 16 characters, so a forged client can create high-cardinality blob8 values. It is not PII and has no cost beyond dataset noise. A real browser sends only APP_VERSION. INFO, not filed.
- The Universalis aggregated limiter is a per-isolate memory limiter. This is the accepted BUG-066 trade-off; cache hits are free, and the Cache API plus coalescer protect upstream. The key space is large (any set of up to 100 ids), but each miss is charged. Not filed.
- Invalid-world requests trigger data-centers and worlds lookups with no onMiss charge. Those are 24 h cached and coalesced, and a down upstream is bounded by the 10 s timeout and the per-isolate coalescer. Not filed.
- Chara cache pollution: an attacker can fill the 7-day Cache API with "empty row" entries for arbitrary model keys, limited to 65 requests/min/IP, and the entries are evictable. XIVAPI fan-out is limited to 1 search per request. Not filed.
- Service-bucket detection depends on CF-Connecting-IP being absent. Cloudflare sets it on every external request, which is the documented assumption in rate-limit.ts and router.ts:120-126. I could not verify the worker-to-worker-via-public-hostname case offline (no network). Not filed.
- Echo of `received: rawId` in the icon 400 error. It is JSON, nosniff, bounded by URL length, and errors are no-store. Not an XSS surface.
- SQL: there is no D1 in these paths.

## 4. Files covered

apps/api-worker: src/index.ts; src/chara/{router,xivapi,cache,types}.ts and the first 60 lines of resolver.ts; src/universalis/router.ts; src/universalis/services/{cached-fetch,cache-service,request-coalescer,rate-limiter}.ts; the tail of src/universalis/config/datacenters.ts and the TTL lines of config/cache.ts; src/telemetry/{router,origin,schema}.ts; src/middleware/rate-limit.ts; src/lib/bounded-body.ts; wrangler.toml.
Other: packages/worker-kit/src/middleware/logger.ts; packages/worker-kit/src/rate-limiter/ip.ts; packages/worker-kit/src/rate-limiter/backends/{memory,kv}.ts (grep only); apps/web-app/PRIVACY.md lines 30-42 and 85-152; docs/superpowers/specs/2026-08-29-web-analytics-design.md (grep); docs/audits/2026-09-15-security/SECURITY_AUDIT_REPORT.md (grep); evidence/pii-sinks.txt and outbound-fetch.txt filtered to api-worker. For the pii-sinks filter, the only api-worker sink hits were the Cache API puts, writeDataPoint and the error logger, all reviewed above.
Tests not run; no probe scripts written.

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| none | | | | |

## 6. Handoffs

- Spec docs/superpowers/specs/2026-08-29-web-analytics-design.md:156 states `ver` matches `/^\d+\.\d+\.\d+/`; schema.ts:68 also allows a -prerelease tail (documentation).
- `received: rawId` and `provided`/`invalidIds` echo input in 400 bodies; harmless, noted for consistency only.
