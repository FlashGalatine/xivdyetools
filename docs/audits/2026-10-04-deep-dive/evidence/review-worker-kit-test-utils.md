# Review: worker-kit-test-utils (branch preview/integration-2026-10-04 @80262a2f)

## Map
| Module | Role |
|---|---|
| worker-kit/src/body-guards/{body-guards,structure}.ts | `bodyGuards()` = Hono `bodyLimit` wrapper + JSON depth/proto check; used by oauth, presets-api |
| worker-kit/src/image-sniff/detect.ts | magic-byte sniff (png/jpeg/gif/webp/bmp), 12-byte minimum |
| worker-kit/src/middleware/{request-id,logger,rate-limit}.ts | requestId -> logger -> rateLimit factories |
| worker-kit/src/rate-limiter/backends/{memory,kv,cloudflare,upstash}.ts | four backends, fail-open default |
| worker-kit/src/rate-limiter/{ip,key-scope,headers}.ts, presets/configs.ts | client IP, log scope, headers, limit tables |
| test-utils/src/cloudflare/{d1,kv,r2,fetcher,analytics}.ts | Workers mocks |
| test-utils/src/{factories,auth,utils,constants} | fixtures, test JWT, id helpers |

Changed since 79a69d1f: body-guards/*, image-sniff/*, worker-kit index, test-utils factories/dye.ts + index (all MAIN; no open PR touches this slice).

## Candidates

### worker-kit-test-utils-01 BUG LOW (MAIN)
- `packages/worker-kit/src/body-guards/body-guards.ts:105-108`: `jsonDepthLimit` skips unless `content-type` literally contains lowercase `application/json`.
- Input: `POST /auth/callback` with `Content-Type: text/plain` (or `Application/JSON`, `application/vnd.api+json`) and a deeply nested or `__proto__` JSON body -> guard calls `next()`; `apps/oauth/src/handlers/callback.ts:53` and `xivauth.ts:84` parse it with `c.req.json()`, which ignores Content-Type. oauth has no Content-Type gate (presets-api does, `apps/presets-api/src/index.ts:184-219`, so it is covered there).
- Impact is low: oauth handlers read named fields only. Tests miss it: body-guards.test.ts:244/381 only assert text/plain is skipped. Covered: no.
```ts
const contentType = c.req.header('content-type');
if (!contentType?.includes('application/json')) { return next(); }
```
- Fix: case-insensitive match plus `+json`, or guard by "has body" (as presets-api BUG-054 does); add an oauth Content-Type 415 gate.

### worker-kit-test-utils-02 BUG MEDIUM (MAIN)
- `packages/worker-kit/src/rate-limiter/ip.ts:63,87-89`: `getClientIp` keys IPv6 clients by the full address (`normalizeIp` only lowercases).
- Input: a client holding one /64 (any residential or VPS allocation) rotates source addresses -> each gets a fresh bucket in presets-api (`middleware/rate-limit.ts:100`), oauth, api-worker -> the per-IP ceiling (e.g. oauth 10/min login) is effectively unbounded.
- Tests: ip.test.ts:111-121 only checks lowercase. Covered: no.
```ts
return normalizeIp(cfIp.trim());   // normalizeIp = ip.toLowerCase()
```
- Fix: collapse IPv6 to its /64 prefix (expand `::`, keep the first 4 groups) before keying; keep IPv4 as is. Check `key-scope.ts` IPV6_RE still labels it `ip`.

### worker-kit-test-utils-03 BUG LOW, latent (MAIN)
- `packages/worker-kit/src/middleware/rate-limit.ts:200-211` (and 163-168): on 429 the headers (X-RateLimit-*, Retry-After) are set with `c.header()` before returning `formatError(c, retryAfter)`. That only works if formatError builds its Response with `c.json/c.text`. A raw `new Response(...)` drops all of them. Same class as the pkg-01 fix at lines 225-233, left unfixed on the deny path.
- No app passes `formatError` today (git grep over apps/*/src), so latent. Test at rate-limit.test.ts:233 uses a context helper. Covered: no.
- Fix: after `formatError` returns, copy the headers onto the returned Response, or document the contract.

### worker-kit-test-utils-04 BUG LOW (MAIN)
- `packages/worker-kit/src/rate-limiter/backends/kv.ts:186,191`: `reset()` and `resetAll()` call `kv.list()` once, no cursor loop. Real KV returns at most 1000 keys per page, so `resetAll` over a busy prefix leaves keys behind (same class as BUG-098 / BUG-035).
- Failing state: more than 1000 `ratelimit:` keys -> `resetAll()` resolves with the rest still counted. Tests use small sets. Covered: no.
```ts
const { keys } = await this.kv.list({ prefix: this.keyPrefix });
await Promise.all(keys.map((k) => this.kv.delete(k.name)));
```
- Fix: loop on `list_complete` / `cursor`.

### worker-kit-test-utils-05 BUG LOW (MAIN) test-utils mock fidelity
- `packages/test-utils/src/cloudflare/kv.ts:699-713` and `r2.ts:471-477`: cursor resume scans for `key === resumeAfter` and skips until found. If that key was deleted between pages (the normal "list, delete the page, list next" retention loop), `skipping` never clears and the next page returns empty with `list_complete: true`. Real KV/R2 continue after the cursor. Listing also follows Map insertion order, not the lexicographic order of the real services.
- Failing state: 1500 keys, consumer deletes page 1 then passes the cursor -> mock reports done after 1000, so a purge-cron test passes or fails for the wrong reason. Covered: no.
- Fix: encode the cursor as the last key and resume with `key > last` over a sorted key list.

### worker-kit-test-utils-06 BUG LOW (MAIN) test-utils mock fidelity
- `packages/test-utils/src/cloudflare/d1.ts:255-263`: `first()` returns `mockFn(...)` unchanged when it is not an array, so a mock yielding `undefined` (a missing `return`, an unmodeled branch) returns `undefined` where real D1 returns `null`. Code written `row === null` misbehaves only in tests.
- Fix: `return (result ?? null) as T | null`.

## POSITIVE
- `MemoryRateLimiter` per-key retention windows (BUG-023/097), LRU prune and chronological array invariants are correct (memory.ts:105-170).
- Rate-limit middleware: backend memoized per isolate, headers applied after `next()` so raw Responses keep them (rate-limit.ts:225-233), log context uses `keyScope`, never the key.
- `CloudflareRateLimiter`: constructor validation, tier key scoping `:t<limit>_<period>`, period-aware tier choice.
- KV limiter fixes `now` once for check/increment (BUG-064); TTL >= 60 s satisfies the KV minimum.
- `validateStructure` recursion is bounded by maxDepth, so no stack-depth DoS; `Object.hasOwn` catches the own `__proto__` JSON.parse creates.
- `detectImageFormat` never calls RIFF a WebP without `WEBP`, and requires 12 bytes uniformly.
- test-utils: `createMockDye` sequence counter, null stainID passthrough, id=itemID contract; D1 mock rejects `undefined` binds and returns independent statements; KV mock enforces the 60 s TTL floor.

## REJECTED
- `getDiscordCommandLimit` / `getModerationLimit` prototype-key lookup (configs.ts): no app calls them (git grep over apps/*/src), so nothing client-controlled reaches them; dead-code audit owns it.
- `BM` / `GIF` magic being 2-3 bytes (detect.ts:222-224): false positives are rejected later by the decoder; not a defect.
- Cloudflare limiter `remaining` always `limit-1` and a looser tier chosen when limit >= effective: documented limitation of the binding (no counter to read).
- Upstash: INCR on a denied request, pipeline not atomic with EXPIRE NX: NX makes a missed EXPIRE self-heal on the next request.
- KV `windowStart` check (`now - windowStart >= windowMs`) is always false inside one fixed bucket: harmless dead branch.
- Memory `entry.windowMs` never shrinks: bounded by cleanup, no wrong result.
- `requestIdMiddleware` accepts any UUID version, not only v4 (request-id.ts:259): cosmetic.
- `bodySizeLimit` trusting an understated Content-Length: documented, with a backstop in presets-api upload.

## COVERED
41 files read (all non-test in the slice): worker-kit package.json, src/index.ts, body-guards/{body-guards,structure,types,index}.ts, image-sniff/{detect,index}.ts, middleware/{request-id,logger,rate-limit,types,index}.ts, rate-limiter/{index,types,ip,key-scope,headers}.ts, backends/{memory,kv,cloudflare,upstash}.ts, presets/{configs,index}.ts; test-utils package.json, src/index.ts, cloudflare/{d1,kv,r2,fetcher,analytics,index}.ts, auth/{jwt,headers,index}.ts, constants/{pkce,index}.ts, factories/{dye,preset,category,index}.ts, utils/{counters,index}.ts. Consumers checked: oauth and presets-api body-validation.ts, index.ts, rate-limit.ts. Tests only skimmed by grep. (middleware/types.ts and rate-limiter/types.ts were only skimmed.)
