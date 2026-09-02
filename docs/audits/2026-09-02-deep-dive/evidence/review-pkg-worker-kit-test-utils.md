# Review — `pkg-worker-kit-test-utils` (deep-dive 2026-09-02)

Deploy units: `@xivdyetools/worker-kit` (npm publish; all seven CF workers consume it) and
`@xivdyetools/test-utils` (workspace-private, merge only).
Repo root: `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02` (origin/main e7ac4042).

## 1. Map

| Module | Export / responsibility |
|---|---|
| `worker-kit/src/index.ts` | Re-exports both subtrees (`/middleware`, `/rate-limiter`) |
| `middleware/request-id.ts` | `requestIdMiddleware` (UUID-v4 gate on inbound `X-Request-ID`), `getRequestId` |
| `middleware/logger.ts` | `loggerMiddleware` (`createRequestLogger`, start/complete lines, `sanitizePath`), `getLogger` |
| `middleware/rate-limit.ts` | `rateLimitMiddleware` factory — key → config → backend → headers → 429; fail-open/closed |
| `middleware/types.ts` | Hono `ContextVariableMap` augmentation (`requestId`, `logger`) |
| `rate-limiter/types.ts` | `RateLimiter` / `ExtendedRateLimiter` / `RateLimitResult` / `RateLimitConfig` + option shapes |
| `rate-limiter/headers.ts` | `getRateLimitHeaders` (`X-RateLimit-Limit/Remaining/Reset`, `Retry-After`) |
| `rate-limiter/ip.ts` | `getClientIp` — `CF-Connecting-IP` first, XFF opt-in only, lowercased |
| `rate-limiter/key-scope.ts` | `scopeRateLimitKey` — FINDING-010 log redaction (prefix, else shape class) |
| `backends/memory.ts` | `MemoryRateLimiter` — per-isolate sliding window, per-key `windowMs`, LRU prune |
| `backends/kv.ts` | `KVRateLimiter` — best-effort fixed window, `check`/`checkOnly`/`increment`, fail-open |
| `backends/upstash.ts` | `UpstashRateLimiter` — INCR + EXPIRE NX + TTL pipeline (no in-repo consumer) |
| `backends/cloudflare.ts` | `CloudflareRateLimiter` — native `[[ratelimits]]` tiers, preferred limiter (FINDING-003) |
| `rate-limiter/presets/configs.ts` | `OAUTH_LIMITS` / `DISCORD_COMMAND_LIMITS` / `MODERATION_LIMITS` / `PUBLIC_API_LIMITS` |
| `test-utils/src/cloudflare/d1.ts` | `createMockD1Database` — `_queries`/`_bindings`, `_setupMock`, `batch`, `withSession` |
| `test-utils/src/cloudflare/kv.ts` | `createMockKV` — Map + `_ttls` + `_metadata`, `get/put/delete/list/getWithMetadata` |
| `test-utils/src/cloudflare/r2.ts` | `createMockR2Bucket` — ArrayBuffer store, `get/put/head/delete/list` |
| `test-utils/src/cloudflare/fetcher.ts` | `createMockFetcher` — service-binding stub with `_calls`, pattern routing |
| `test-utils/src/cloudflare/analytics.ts` | `createMockAnalyticsEngine` — `_dataPoints` |
| `test-utils/src/auth/{jwt,headers}.ts` | `createTestJWT`, `createExpiredJWT`, `authHeaders` |
| `test-utils/src/factories/*` | `createMockPresetRow`, `createMockSubmission`, `createMockCategoryRow`, `createMockDye`, `mockDyes` |
| `test-utils/src/utils/counters.ts` | `randomId`, `randomStringId`, `nextStringId` |
| `test-utils/integration/*` | `setup.ts` fixtures + 3 cross-service suites (bot auth, JWT validation, rate limiting) |

Consumers checked: `api-worker/src/middleware/rate-limit.ts`, `presets-api/src/middleware/rate-limit.ts`,
`oauth/src/services/rate-limit.ts`, `discord-worker/src/services/rate-limiter.ts`,
`moderation-worker/src/middleware/rate-limit.ts`.

## 2. Candidates

### pkg-worker-kit-test-utils-01 — BUG — LOW
`packages/worker-kit/src/middleware/rate-limit.ts:192-196`
**Claim:** `X-RateLimit-*` are set via `c.header()` *before* `await next()`, so they are silently
dropped for any handler that returns a raw `Response` instead of `c.json()`/`c.body()`.
**Failing input → wrong outcome:** `GET /v1/chara/icon/41716` on api-worker. `app.use('/v1/*', rateLimitMiddleware)`
(`apps/api-worker/src/index.ts:117`) runs the middleware, the slot is consumed, but the handler returns
`new Response(bytes, {...})` (`apps/api-worker/src/chara/router.ts:331`, and `:294` on the cache hit).
In Hono 4.13.5 a pre-`next()` `c.header()` lands in `#preparedHeaders`, which only `#newResponse`
(`hono/dist/context.js`, backing `c.json`/`c.text`/`c.body`) merges; `set res(_res)` merges only if `#res`
already exists, and nothing touches it here. The icon response ships with **no** rate-limit headers, so a
client budgeting from them sees nothing (api-worker's CORS `exposeHeaders` advertises them, and its deploy
checklist step 6 asks an operator to verify them).
**Why tests miss it:** `rate-limit.test.ts:50` routes to `(c) => c.json({ ok: true })`; every assertion in
"should set X-RateLimit-* headers on allowed requests" (`:74-96`) goes through the `c.json` path.
**Covered by test:** no.
```ts
    const headers = getRateLimitHeaders(result);
    for (const [headerName, headerValue] of Object.entries(headers)) {
      c.header(headerName, headerValue);          // pre-next(): #preparedHeaders
    }
    if (!result.allowed) { /* … 429 via c.json — headers survive … */ }
    await next();                                  // raw Response here discards them
```
**Fix:** apply `getRateLimitHeaders(result)` *after* `await next()` on the allowed path (post-finalize
`c.header()` clones the response and sets on it), keeping the pre-return set for the 429 branch.

### pkg-worker-kit-test-utils-02 — BUG — LOW (latent)
`packages/worker-kit/src/rate-limiter/backends/memory.ts:98,114`
**Claim:** `check()` writes back a timestamp array filtered by the **current** request's `config.windowMs`,
which defeats the per-key `entry.windowMs` cutoff that BUG-023 added to `cleanupOldEntries()` (`:176`).
**Failing input → wrong outcome:** one `MemoryRateLimiter`, key `k`. `check(k, {maxRequests:2, windowMs:3_600_000})`
at t=0 → `[0]`. `check(k, {maxRequests:100, windowMs:60_000})` at t=61_000 → the filter `ts > now - 60_000`
drops the t=0 stamp and stores `[61000]`. `check(k, {maxRequests:2, windowMs:3_600_000})` at t=61_001 is
allowed → three requests admitted inside one hour on a bucket the hour config limits to two. `entry.windowMs`
is recorded (max of all windows seen) but never used to bound retention in `check()` itself.
**Why tests miss it:** `memory.test.ts` never checks one key with two different `windowMs` values.
**Covered by test:** no. No in-repo trigger — every shared instance uses a single `windowMs`
(oauth keys are `${ip}:${path}` and all `OAUTH_LIMITS` entries are 60 000 ms), hence LOW.
```ts
    const entryWindowMs = Math.max(entry?.windowMs ?? 0, config.windowMs);
    const recentTimestamps = (entry?.timestamps ?? []).filter((ts) => ts > windowStart); // config.windowMs
    …
    this.requestLog.set(key, { windowMs: entryWindowMs, timestamps: recentTimestamps });  // truncated
```
**Fix:** filter the *stored* array with `now - entryWindowMs` and use `windowStart` only for the decision.

### pkg-worker-kit-test-utils-03 — UNTESTED — MEDIUM
`packages/worker-kit/src/rate-limiter/backends/memory.test.ts:194-215`
**Claim:** the only cleanup test is vacuous — its own comment says "we just verify no errors occur".
**Behaviour it was supposed to catch:** the BUG-023 regression (cleanup applying the current request's
`windowMs` to every key). After `vi.advanceTimersByTime(windowMs * 3)` the `user1` stamp is outside the
window regardless, so `expect(result.allowed).toBe(true)` holds whether cleanup ran, ran with the wrong
cutoff, or never ran at all.
**Covered by test:** no.
```ts
      // The stale user1 entry should have been cleaned up
      // (This is a behavioral test - we just verify no errors occur)
      const result = await limiterWithFastCleanup.check('user1', defaultConfig);
      expect(result.allowed).toBe(true);
```
**Fix:** assert on `limiter.size` (key deleted) and add a two-window case: seed key `k` with a 1 h config,
run 100 short-window checks on other keys, then assert `k`'s hour history survived.

### pkg-worker-kit-test-utils-04 — UNTESTED — MEDIUM
`packages/worker-kit/src/rate-limiter/backends/upstash.test.ts:152-159`
**Claim:** "provides a resetAt in the future" cannot fail, so BUG-055 (`resetAt`/`retryAfter` derived from
the key's real TTL rather than a full window from now) has no regression test.
**Behaviour it was supposed to catch:** `upstash.ts:85-96` uses `results[2]` (the pipelined `TTL`) —
reverting to `new Date(Date.now() + config.windowMs)` keeps the suite green, because every test seeds
`exec → [n, 1, 60]` where `ttlLeft === windowMs / 1000`, making the two formulas indistinguishable, and the
assertion only requires `resetAt >= before`.
**Covered by test:** no.
```ts
      mockPipeline.exec.mockResolvedValue([1, 1, 60]);
      const before = Date.now();
      const result = await limiter.check('user1', defaultConfig);
      expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(before);   // true for now+windowMs too
```
**Fix:** seed `exec → [6, 0, 12]` with `windowMs: 60_000` and assert `retryAfter === 12` and
`resetAt ≈ now + 12_000`; add the `ttl = -1 / -2` fallback case.

### pkg-worker-kit-test-utils-05 — UNTESTED — LOW
`packages/worker-kit/src/rate-limiter/backends/cloudflare.test.ts:103-116` + `backends/cloudflare.ts:163-165`
**Claim:** the test named "keys different tiers apart so a client cannot share one bucket across two
configs" asserts the opposite — both bindings receive the **same** key — and the source comment claims a
tier scoping the key does not have.
**Behaviour it was supposed to catch:** separation is provided entirely by the tiers being distinct binding
objects. Two tiers configured with the *same* `binding` (a plausible wrangler/`oauthRateLimitTiers`-style
mistake) would share one counter across a 10-limit and a 30-limit config; the test still passes.
**Covered by test:** no.
```ts
    await limiter.check('k', { maxRequests: 10, windowMs: 60_000 });
    await limiter.check('k', { maxRequests: 30, windowMs: 60_000 });
    expect(t10.calls).toEqual(['k']);   // identical key — the name claims they differ
    expect(t30.calls).toEqual(['k']);
```
**Fix:** either put the tier limit in `bindingKey` and assert the keys differ, or rename the test and the
comment to "distinct bindings hold distinct counters" and add a same-binding-twice guard in the constructor.

### pkg-worker-kit-test-utils-06 — BUG — LOW (latent)
`packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:148-151`
**Claim:** `selectTier()` matches on `limit` alone and never compares `config.windowMs` with the tier's
`periodSeconds`, so a config can be enforced over the wrong period.
**Failing input → wrong outcome:** tiers `[{limit:10, periodSeconds:10, …}, {limit:30, periodSeconds:60, …}]`
with `check(key, {maxRequests:10, windowMs:60_000})` picks the 10 s tier → 10 requests per **10** seconds
(6× the intended rate), while `resetAt` reports the 10 s period end so the headers look self-consistent.
**Why tests miss it:** every tier in `cloudflare.test.ts` omits `periodSeconds` (defaults to 60) and every
config uses `windowMs: 60_000`; no test mixes periods.
**Covered by test:** no. In-repo every tier is explicitly `periodSeconds: 60`
(`api-worker/src/middleware/rate-limit.ts:41,133`, `presets-api/.../rate-limit.ts:42`,
`oauth/src/services/rate-limit.ts:80-82`, `discord-worker/src/services/rate-limiter.ts:137`), hence latent.
**Fix:** restrict `selectTier` to tiers whose `periodSeconds * 1000 === config.windowMs` (falling back to
the largest matching period), or throw at construction when a bound tier's period has no matching config.

### pkg-worker-kit-test-utils-07 — UNTESTED — MEDIUM
`packages/worker-kit/src/rate-limiter/backends/kv.test.ts` (whole file) vs `backends/kv.ts:110-121,296-299`
**Claim:** no test crosses a fixed-window boundary, so BUG-064 — `check()` capturing `now` once so that
`checkOnly()` and `increment()` address the same `buildKey(key, now, windowMs)` window — is unfalsifiable.
**Behaviour it was supposed to catch:** deleting the shared `now` and letting each call re-read `Date.now()`
lets a request read window *N* and write window *N+1* (an un-counted request at the boundary). The suite has
no fake timers and no boundary case, so that revert stays green.
**Covered by test:** no.
```ts
    const now = Date.now();                       // BUG-064: one clock for both halves
    const result = await this.checkOnly(key, config, now);
    if (result.allowed && !result.backendError) { await this.increment(key, config, now); … }
```
**Fix:** with `vi.setSystemTime` place `now` 1 ms before `k*windowMs`, advance past the boundary between the
two internal calls (via a KV `get` that awaits), and assert both operations used the same `kvKey` suffix.

### pkg-worker-kit-test-utils-08 — BUG — LOW
`packages/test-utils/src/cloudflare/kv.ts:155-192`
**Claim:** the KV mock's `list()` never paginates — it always returns `cursor: undefined` and
`list_complete: keys.length < limit` — so an un-paginated consumer looks correct in tests and truncates at
1000 keys in production.
**Consumer it hides:** `apps/discord-worker/src/handlers/commands/stats.ts:375`
`const prefsList = await env.KV.list({ prefix: 'prefs:v1:' });` with no cursor loop → `/stats preferences`
reports at most 1000 users forever. Its sibling `services/analytics.ts:316-322` *does* follow the cursor
(BUG-037), so the pattern is known and this call site was missed.
`packages/worker-kit/src/rate-limiter/backends/kv.ts:273,281` (`reset`/`resetAll`) have the same gap
(test-only paths). The mock also emits `list_complete: false` with `cursor: undefined`, a state real KV never
returns, so a *correct* `while (!list_complete)` loop would re-read page one indefinitely against it.
**Why tests miss it:** `kv.test.ts` has "respects limit" and "indicates list_complete when all keys
returned", but no test asserting a cursor is issued when more keys remain.
**Covered by test:** no.
**Fix:** cap the mock at 1000 per page, return an opaque cursor whenever keys remain, and honour `cursor`
on the next call; then add the cursor loop at `stats.ts:375`.

### pkg-worker-kit-test-utils-09 — BUG — LOW
`packages/test-utils/src/cloudflare/kv.ts:129-147`
**Claim:** three `put`/`get` divergences make the mock more permissive than real KV.
1. `if (options?.expirationTtl)` — `0` is falsy and silently becomes "no TTL", and any positive value is
   accepted; real KV **rejects `expirationTtl < 60`** with a runtime error. A consumer that computes a
   sub-60 TTL passes every test and throws in production.
2. `if (options?.metadata !== undefined)` — a later `put` without metadata leaves the previous metadata in
   place; real KV replaces the whole entry, clearing metadata.
3. `get(key, 'json')` (the bare-string overload real KV accepts) is not handled: `options?.type` is
   `undefined`, so the raw string comes back instead of a parsed object.
**Why tests miss it:** `kv.test.ts`'s TTL block only covers a valid TTL, an absolute `expiration`, and
"clears TTL when put without expiration"; the metadata block never re-puts a key.
**Covered by test:** no. No in-repo caller is currently below 60 s (`packages/auth/src/revocation.ts:91`
clamps with `Math.max(…, 60)`; nonce/stats/announce TTLs are ≥ 60), so LOW today.
**Fix:** throw on `expirationTtl < 60` and on `expirationTtl === 0`, always replace metadata, and accept the
string form of the type argument.

### pkg-worker-kit-test-utils-10 — BUG — LOW
`packages/test-utils/src/cloudflare/d1.ts:231-255,284-293,315-322`
**Claim:** `batch()` is sequential with no atomicity or rollback, and `run()` returns a constant
`meta.changes = 1` unless the mock explicitly returns an object containing `meta`.
**Consumer it hides:** `apps/presets-api/src/handlers/votes.ts:83`
(`if (insertResult.meta.changes === 0) → already_voted`) and the mirror check in `removeVote` — with a
typical `_setupMock` returning rows or `null`, `changes` is always 1, so the `already_voted` /
"no vote existed" branches can never be reached and the `INSERT … ON CONFLICT DO NOTHING` semantics are
unobservable. The BUG-019 comment's "one atomic batch so a partial failure can never leave a vote row whose
increment didn't land" is likewise untestable through this mock (moderation-worker's four-statement batches
at `services/ban-service.ts:416,507` are in the same position).
Separately, `withSession().batch()` routes through `all()`, contradicting the fix comment on `mockDb.batch`
("Real D1 batch() behaves like run() per statement … so route through run(), not all()"), so a session batch
reports `meta.changes: 0` and no mutation meta.
**Why tests miss it:** `d1.test.ts:198-227` asserts only `success === true` and `results` non-empty;
`:344-353` ("session batch works") asserts only `results).toHaveLength(2)`.
**Covered by test:** no.
**Fix:** derive `meta.changes` from the mock function's return (e.g. `null` on an INSERT ⇒ `changes: 0`),
add a `_setBatchFailure(index)` hook that rejects the whole batch, and route `withSession().batch` through
`run()`.

### pkg-worker-kit-test-utils-11 — BUG — LOW
`packages/test-utils/src/cloudflare/d1.ts:175-182`
**Claim:** `bind()` accepts any value and mutates the shared statement instead of returning a new one.
Real D1 throws `D1_TYPE_ERROR` for `undefined` (and for objects), and each `bind()` yields an independent
statement.
**Failing input → wrong outcome:** a handler binding an optional column that is `undefined`
(`.bind(id, row.example_link)` where the field was never set) passes every test and 500s in production;
and `const s = db.prepare(sql); const a = s.bind(1); const b = s.bind(2); await a.run()` runs with `[2]` in
the mock and `[1]` against real D1.
**Why tests miss it:** `d1.test.ts`'s bind block only checks chaining and `_bindings` recording.
**Covered by test:** no.
**Fix:** reject `undefined` (and non-`number|string|boolean|null|ArrayBuffer` values) in `bind()`, and
return a fresh statement object carrying its own `boundValues`.

### pkg-worker-kit-test-utils-12 — BUG — LOW
`packages/test-utils/src/cloudflare/r2.ts:141-154,187-206`
**Claim:** `put()` stores `httpMetadata` (`:176`) but neither `get()` nor `head()` exposes it, and neither
provides `writeHttpMetadata()`; `get()` also ignores `options` (`range` / `onlyIf`) and `list()` never
returns a cursor (same shape as -08).
**Consumer it hides:** `apps/presets-api/src/services/preview-image-service.ts:165-166` writes
`httpMetadata: { contentType, cacheControl }` on every preview upload — the `immutable` + `s-maxage=86400`
policy that FINDING-018's takedown story depends on — and no test can read it back except by reaching into
`_store`. A serving path added later (`writeHttpMetadata(headers)`) would throw only in production.
**Why tests miss it:** `r2.test.ts` asserts `customMetadata` round-trips but never `httpMetadata`.
**Covered by test:** no.
**Fix:** surface `httpMetadata` on the object returned by `get()`/`head()` and add `writeHttpMetadata()`.

### pkg-worker-kit-test-utils-13 — UNTESTED — MEDIUM
`packages/test-utils/integration/rate-limiting/submission-limits.test.ts:36-90`
**Claim:** the entire suite exercises re-implementations declared inside the test file, not production code.
**Behaviour it was supposed to catch:** `checkPublicRateLimit()` (`:45-66`) is a hand copy of
`MemoryRateLimiter.check()` over a file-local `ipRequestLog` Map — worker-kit is never imported;
`checkSubmissionRateLimit(db, userDiscordId, mockSubmissionCount)` (`:76-90`) never queries the `db` it is
handed (the parameter is unused) and returns arithmetic on the count the test itself supplied. All 15
assertions — "at limit boundary", "reset at UTC midnight", "decrement remaining correctly", the concurrency
block — are about the test's own code. Deleting `presets-api/src/services/rate-limit-service.ts` and
`worker-kit`'s limiter leaves the file green, and the copy will drift from -02 above.
**Covered by test:** no (it *is* the test).
```ts
async function checkSubmissionRateLimit(db: MockD1Database, userDiscordId: string, mockSubmissionCount: number) {
  const submissionsToday = mockSubmissionCount;                 // `db` is never touched
  const remaining = Math.max(0, DAILY_SUBMISSION_LIMIT - submissionsToday);
  return { allowed: submissionsToday < DAILY_SUBMISSION_LIMIT, remaining, resetAt: tomorrow };
}
```
**Fix:** import `MemoryRateLimiter` from `@xivdyetools/worker-kit/rate-limiter` and presets-api's real
`checkSubmissionRateLimit`, seeding the count through `db._setupMock` — or delete the file as a duplicate of
`memory.test.ts`.

### pkg-worker-kit-test-utils-14 — UNTESTED — LOW
`packages/worker-kit/src/rate-limiter/headers.test.ts:22`
**Claim:** the `X-RateLimit-Reset` assertion recomputes the implementation's own formula on a timestamp with
zero sub-second part, so the `ceil`-vs-`floor` rounding rule is unfalsifiable.
**Behaviour it was supposed to catch:** `new Date('2026-01-25T12:01:00Z').getTime() / 1000` is an integer, so
`Math.ceil`, `Math.floor` and `Math.trunc` all agree; switching `headers.ts:41` to `floor` keeps the test green.
**Covered by test:** no.
**Fix:** use a `resetAt` with a fractional second (e.g. `…T12:01:00.400Z`) and hard-code the expected integer.

### pkg-worker-kit-test-utils-15 — REFACTOR — LOW
`packages/test-utils/src/factories/dye.ts:30-176`
**Claim:** the dye fixtures cannot represent a real dye. `createMockDye()` defaults
`id = randomId()` (a 9-digit number) and `itemID = 5700 + id`, so `stainID` lands far outside the real
1–254 range (presets-api's `validatePresetDyes` rejects > 254; api-worker's `resolveIdType` calls 255–5728
invalid), and `id !== itemID` in both `createMockDye` and every entry of `mockDyes` — contradicting
`packages/types/src/dye/dye.ts:51-57` ("always equal to `itemID` after `DyeDatabase.initialize()`").
**Impact:** no in-repo consumer today (web-app's `mockDyes` is its own local fixture; nothing outside
`test-utils`' own tests imports these), so this is a trap for the next consumer rather than a live defect.
**Fix:** default `stainID` into 1–254, set `id = itemID`, and keep `mockDyes` consistent with the invariant.

## 3. POSITIVE — do not re-file

- `scopeRateLimitKey()` + `key-scope.test.ts` is the strongest test file in the unit: it asserts the scope is
  never equal to, and never *contains*, the raw key for every identifying shape, and the middleware tests
  (`rate-limit.test.ts:262-263,296-297`) assert `context.key === undefined` **and** `keyScope === 'ip'` — a
  reverted redaction fails loudly. Do not weaken to a hash (the module doc explains why).
- FINDING-012 is fully landed: all three fallible backends log the fail-open through `console.warn` when no
  logger was passed (`kv.ts:174-182`, `upstash.ts:107-113`, `cloudflare.ts:195-212`), each with its own test.
- `CloudflareRateLimiter`'s constructor validates every tier's `binding.limit` is callable and throws
  (`cloudflare.ts:130-136`), with three tests including the "only one of several tiers is broken" case.
- `getClientIp` defaults `trustXForwardedFor: false` and lowercases IPv6 (SEC-002 / FINDING-006); every
  in-repo `keyExtractor` uses it rather than reading a header directly.
- Request-ID *is* propagated to sub-requests — `discord-worker/src/services/preset-api.ts:83` and
  `moderation-worker/src/services/preset-api.ts:58` both forward `X-Request-ID`.
- BUG-061 backend memoization (`rate-limit.ts:124,132`) is correct and documented, and both api-worker and
  presets-api expose middleware *factories* so each test gets its own isolate-scoped cache.
- `KVRateLimiter` honestly documents itself as best-effort (BUG-022/OPT-002) — removing the fake
  "optimistic concurrency" version metadata and the double-counting verification read was the right call.
- D1 mock `_queries`/`_bindings` index alignment on `exec()` (BUG-062, `d1.ts:297-300,325`) is right, and the
  bind-timing tests (`d1.test.ts:229-273`) genuinely pin it.

## 4. REJECTED

- `requestIdMiddleware` setting `X-Request-ID` after `next()` onto an immutable upstream `Response` —
  Hono 4.13.5's `header()` clones (`createResponseInstance(this.#res.body, this.#res)`) when `finalized`, so
  no `TypeError`. The post-`next()` placement is safe; only the *pre*-`next()` placement (-01) loses headers.
- `retryAfter: 0` swallowed by `result.retryAfter ?? …` — `??` preserves 0, and no backend can emit 0
  (`resetAt` is always strictly in the future in memory/KV; `cloudflare.ts:182` clamps with `Math.max(1, …)`).
- Upstash `allowed = count <= effectiveLimit` off-by-one — `INCR` returns the post-increment value, so
  exactly `effectiveLimit` requests pass. Correct.
- Upstash `INCR` on a denied request extending the lockout — `EXPIRE … NX` never re-arms the TTL, so the
  window still ends on schedule.
- `MemoryRateLimiter` sliding-window boundary (`ts > windowStart`, strict) — consistent between the decision
  and `resetAt`, and it guarantees `resetAt > now`, so `retryAfter >= 1`. Not an off-by-one.
- `KVRateLimiter.increment` swallowing `put` failures after retries — documented (BUG-022/OPT-002), logged on
  the last attempt, and the whole backend is deliberately the fallback (`CloudflareRateLimiter` is preferred).
- oauth sharing one `MemoryRateLimiter` across `/auth/*` configs — keys are `${ip}:${path}`
  (`oauth/src/services/rate-limit.ts:145`) and every `OAUTH_LIMITS` entry uses `windowMs: 60_000`, so neither
  bucket sharing nor -02's truncation can trigger.
- `rateLimitMiddleware`'s memoized backend closing over the first request's `c.env` — `env` is isolate-stable
  in Workers, and the `BUG-004` per-request KV construction it replaces is explicitly commented.
- `expirationTtl < 60` reaching real KV from an in-repo caller — all four call sites are ≥ 60
  (`revocation.ts:91` clamps, nonce 120 s, stats/announce TTLs larger). -09 is a mock-fidelity finding only.
- `loggerMiddleware` logging `pathname + search` when `sanitizePath` is supplied — only moderation-worker
  passes one (`index.ts:62`) and it passes its own `sanitizeUrl` redactor. Deliberate.
- `MemoryRateLimiter`'s `entryWindowMs` only ever growing — conservative by design; costs retention, never
  correctness.
- `getRequestId`/`getLogger` `try/catch` around `c.get` — defensive for error handlers, tested both ways.

## 5. COVERED — 40 files

**worker-kit sources (17, all read in full):** `src/index.ts`; `src/middleware/{index,types,request-id,logger,rate-limit}.ts`;
`src/rate-limiter/{index,types,headers,ip,key-scope}.ts`;
`src/rate-limiter/backends/{memory,kv,upstash,cloudflare}.ts`; `src/rate-limiter/presets/{configs,index}.ts`.

**worker-kit tests (11):** read in full — `backends/memory.test.ts`, `middleware/rate-limit.test.ts`,
`headers.test.ts`, `key-scope.test.ts`; read at case/assertion level — `backends/{kv,upstash,cloudflare}.test.ts`,
`middleware/{request-id,logger}.test.ts`, `ip.test.ts`, `presets/configs.test.ts`.

**test-utils sources (17, all read in full):** `src/index.ts`;
`src/cloudflare/{index,d1,kv,r2,fetcher,analytics}.ts`; `src/auth/{index,jwt,headers}.ts`;
`src/constants/{index,pkce}.ts`; `src/factories/{index,preset,category,dye}.ts`; `src/utils/{index,counters}.ts`.

**test-utils tests / integration (12 + 4):** `integration/setup.ts` and
`integration/rate-limiting/submission-limits.test.ts` read in full; `integration/discord-presets/bot-authentication.test.ts`
and `integration/oauth-presets/jwt-validation.test.ts` at case level; `tests/**` (12 files) at case level with
targeted reads of `cloudflare/d1.test.ts`.

**Consumer files read to confirm claims (not in scope, cited only):**
`apps/api-worker/src/{index.ts,middleware/rate-limit.ts,chara/router.ts}`,
`apps/presets-api/src/{middleware/rate-limit.ts,handlers/votes.ts,services/preview-image-service.ts}`,
`apps/oauth/src/services/rate-limit.ts`, `apps/discord-worker/src/{services/rate-limiter.ts,services/analytics.ts,handlers/commands/stats.ts}`,
`packages/auth/src/revocation.ts`, `packages/types/src/dye/dye.ts`, `node_modules/.../hono@4.13.5/dist/{context,compose,hono-base}.js`.
