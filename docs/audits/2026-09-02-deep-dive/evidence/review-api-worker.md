# Review — `api-worker` (deep-dive 2026-09-02)

Unit: `apps/api-worker` (CF Worker + KV + Workers Static Assets docs). Worktree `origin/main` e7ac4042.
Read-only review. 13 candidates: 6 BUG, 3 UNTESTED, 4 REFACTOR/OPT.

## 1. Map

| Path / module | Route(s) | Notes |
|---|---|---|
| `src/index.ts` | `GET /`, `GET /health` | docs-host branch → `ASSETS` (developers.*) before all middleware; then requestId → logger → security headers → CORS `*` → `/v1/*` rate limit → telemetry rate limit → locale → `X-API-Version`; `notFound` + `onError` envelopes |
| `src/routes/dyes.ts` | `/v1/dyes{,/search,/categories,/batch,/consolidation-groups,/stain/:stainId,/:id}` | module-scope memo for `/categories` + `/consolidation-groups`; `Cache-Control: max-age=3600, s-maxage=86400` |
| `src/routes/match.ts` | `/v1/match/closest`, `/v1/match/within-distance` | filters/exclusions applied **before** `slice(0, limit)` (BUG-030 fix intact) |
| `src/chara/router.ts` | `POST /v1/chara/resolve`, `GET /v1/chara/icon/:iconId` | 8 KB bounded body; `CharaRowCache` (Cache API, 7 d + 1 d SWR, keyed by XIVAPI version + shape v1); icon proxy = canonical-id regex, 1 MB cap, PNG-signature gate, `caches.default` |
| `src/chara/{resolver,xivapi,cache,regional-names,types}.ts` | — | pure resolution rules; one nested-group XIVAPI search per request; ko/zh from build-time tables |
| `src/telemetry/{router,schema,origin}.ts` | `POST /v1/telemetry` | GPC → Origin gate → 16 KB bounded body → allowlist schema → `waitUntil(writeDataPoint)`; 204 always |
| `src/universalis/router.ts` | `/universalis/*` **and** `/api/v2/*`: `/aggregated/:dc/:itemIds`, `/data-centers`, `/worlds` | un-enveloped; static DC/world whitelist + live-list fallback; per-IP memory limiter charged on cache **miss** only |
| `src/universalis/services/*` | — | `cached-fetch` (10 s timeout, `redirect: manual`, 5 MB bounded read), `cache-service` (synthetic-URL Cache API + SWR), `request-coalescer` (module-scope in-flight map), `rate-limiter` (MemoryRateLimiter adapter) |
| `src/lib/*` | — | `validation` (id-range resolution, param parsers, dye filters), `response` (envelope + pagination), `dye-serializer`, `bounded-body`, `api-error`, `services` (module-scope `DyeService`) |
| `src/middleware/*` | — | `locale` (`?locale=` → `c.var.locale`, `ensureLocaleLoaded`, no singleton mutation), `rate-limit` (native binding → KV fallback; separate telemetry bucket, fail-closed) |
| `wrangler.toml` | — | top-level = routeless dev worker (`workers_dev=false`, `preview_urls=false`); `[env.production]` = `data.*`, `proxy.*` ×2, `developers.*`; prod `RATE_LIMIT_REQUESTS=30` |

## 2. Candidates

---

### api-worker-01 — BUG — MEDIUM — `src/lib/validation.ts:318`

**Claim.** `parseMatchingMethod` tests membership with `value in LEGACY_MATCHING_METHOD_MAP`, a plain object literal, so every `Object.prototype` member passes the allowlist and returns a non-string as the `MatchingMethod`.

**Failing input → wrong outcome.** `GET /v1/match/closest?hex=FF0000&method=constructor` (also `toString`, `valueOf`, `hasOwnProperty`, `__proto__`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`).
`'constructor' in MAP` → `true` → returns `MAP['constructor']` = the `Object` function. `DyeSearch.calculateDistance` has a `default:` (`packages/core/src/services/dye/DyeSearch.ts:72`) so a dye is still found via ΔE2000, but `ColorService.getDistanceForMethod` (`packages/core/src/services/ColorService.ts:180-193`) is an **exhaustive switch with no default** → returns `undefined` → `Math.round(undefined*10000)/10000` = `NaN` → serialised as `"distance": null`. The `method` echo is a function, which `JSON.stringify` **drops from the object entirely**. Net: HTTP **200**, `data.distance: null`, no `method` key — instead of the `INVALID_MATCHING_METHOD` 400 that `?method=invalid` correctly produces. `/v1/match/within-distance` is worse: every distance is NaN, so `results.sort((a,b)=>a.distance-b.distance)` (`src/routes/match.ts:127`) compares with NaN and the ordering guarantee is void. Both responses ship `Cache-Control: public, max-age=3600, s-maxage=86400`.

**Why tests miss it.** `tests/routes/match.test.ts:67` only tries `method=invalid` (an own-property miss). The same hazard was *explicitly* defended in `src/telemetry/schema.ts:89-95` ("A Map, not an object literal … an object lookup would resolve inherited members") and is tested there (`src/telemetry/router.test.ts:94`) — the matching-method parser never got the same treatment.

**Covered by test:** no.

```ts
// src/lib/validation.ts:316-329
export function parseMatchingMethod(value: string | undefined): MatchingMethod {
  if (!value || value === '') return DEFAULT_MATCHING_METHOD;
  if (value in LEGACY_MATCHING_METHOD_MAP) {      // ← inherited members match
    return LEGACY_MATCHING_METHOD_MAP[value];     // ← Object, Object.prototype.toString, …
  }
  if (!VALID_MATCHING_METHODS.includes(value as MatchingMethod)) { throw new ApiError(...); }
```

**Fix.** `Object.hasOwn(LEGACY_MATCHING_METHOD_MAP, value)` (or make the map a `Map`, or `Object.create(null)`). Same one-line hazard exists in `packages/core/src/types/index.ts:91` (`normalizeMatchingMethod`, reached from the web-app `?algo=` deep link) — fix both. Consider a `default:` in `getDistanceForMethod` so a future escape degrades instead of returning `undefined`.

---

### api-worker-02 — BUG — MEDIUM — `src/routes/dyes.ts:279`

**Claim.** An empty-but-present `sort` query param 400s the whole dye listing with a *wrong* error code.

**Failing input → wrong outcome.** `GET /v1/dyes?sort=` (or a bare `?sort`). Hono's `_getQueryParam` returns `''` for both forms (`hono/dist/utils/url.js:154-160`), so `sortRaw !== undefined` is true and `parseEnumParam('', 'sort', VALID_SORT_FIELDS)` is called **with no default** → `src/lib/validation.ts:224-229` throws `MISSING_PARAMETER: Missing required parameter: sort` → HTTP 400 on a parameter that is optional. Any client that unconditionally appends `&sort=${state.sort ?? ''}` gets a hard 400 instead of an unsorted list. The sibling params were fixed for exactly this (`minPriceRaw ? … : undefined`, line 276-277, "BUG-070 (related): empty-but-present … treated as not provided") and `order` is immune because it passes a default.

**Why tests miss it.** `tests/routes/dyes.test.ts` only exercises `sort=brightness|name|cost|hue|saturation`; `tests/lib/validation.test.ts:119-134` tests `parseEnumParam` with `undefined` and `'d'`, never `''`.

**Covered by test:** no.

```ts
// src/routes/dyes.ts:278-280
const sortRaw = c.req.query('sort');
const sort = sortRaw !== undefined ? parseEnumParam(sortRaw, 'sort', VALID_SORT_FIELDS) : undefined;
const order = parseEnumParam(c.req.query('order'), 'order', VALID_ORDERS, 'asc'); // ← has a default, safe
```

**Fix.** `const sort = sortRaw ? parseEnumParam(...) : undefined;` — matching the `minPrice`/`maxPrice` treatment three lines above.

---

### api-worker-03 — BUG — MEDIUM — `src/universalis/router.ts:85`

**Claim.** The Universalis per-IP miss budget collapses to a single shared `'unknown'` bucket for every caller without `CF-Connecting-IP` — i.e. the whole discord-worker fleet — and the "charge on miss only" mitigation does not cover it, because every distinct `(datacenter, itemIds)` is a miss.

**Failing input → wrong outcome.** `discord-worker` builds its sub-request as `new Request('https://internal/api/v2/aggregated/…', { headers: { 'Content-Type': 'application/json' } })` (`apps/discord-worker/src/services/budget/universalis-client.ts:126-133`) — no `CF-Connecting-IP`, so `getClientIp` falls through to the literal `'unknown'` (`packages/worker-kit/src/rate-limiter/ip.ts:60-78`). Production sets `RATE_LIMIT_REQUESTS = "30"` (`wrangler.toml:78`). Once ~30 *distinct* DC/item combinations miss the cache inside one 60 s window in one isolate, the 31st `/budget` in **any guild** gets `429 {"error":"Rate limit exceeded"}` — cross-tenant throttling on a key nobody owns. The known mitigation (charging only on `onMiss`, FINDING-025/API-7) protects repeats of the *same* key, which is not the pattern `/budget` produces.

**Why tests miss it.** `src/universalis/router.test.ts:158` asserts the miss-only behaviour with a single key; nothing exercises N distinct keys from an IP-less caller, and the test env always goes through `app.request` with no `CF-Connecting-IP` (so it *is* the `'unknown'` bucket — the collapse is invisible because there is only one caller).

**Covered by test:** no (the sharing is acknowledged in a test comment at `router.test.ts:155-157`; the distinct-key residual is not).

```ts
// src/universalis/router.ts:84-95
const clientIP = getClientIp(c.req.raw);            // 'unknown' for every service-binding call
const chargeLimiter = async (): Promise<void> => {
  const result = await checkRateLimit(clientIP, rateLimitConfig);
  if (!result.allowed) throw new ProxyRateLimitedError(result, rateLimitConfig);
};
```

**Fix.** Give service-binding traffic its own identity (a header the bot sets, or `c.req.header('cf-connecting-ip') ?? 'svc:' + serviceName`) and its own budget; or skip `chargeLimiter` when the request arrives without `CF-Connecting-IP` and rely on the caller's own limiter.

---

### api-worker-04 — BUG — LOW — `src/universalis/router.ts:219` (also `:272`, `:302`)

**Claim.** An upstream 3xx is echoed verbatim as the response status, producing a bodied redirect with no `Location` that also escapes the `no-store` guard.

**Failing input → wrong outcome.** `redirect: 'manual'` (`cached-fetch.ts:152`) hands a 3xx back as a response; `!response.ok` → `UpstreamError(302, …)`; the router then does `c.json({...}, error.status as 400|404|500|502|503)` → a **302 with a JSON body and no `Location` header**. `src/index.ts:85` only stamps `Cache-Control: no-store` when `c.res.status >= 400`, so this response carries no cache directive at all and a 301 is heuristically cacheable. Reachable the day Universalis adds a host/path redirect — the same failure family as the 2026-08-28 `redirect: 'error'` outage the surrounding comment records.

**Why tests miss it.** `cached-fetch.test.ts:74` asserts only that `cachedFetch` *throws* on a 302; no router-level test walks the 3xx through to the HTTP response.

**Covered by test:** no.

```ts
// src/universalis/router.ts:214-220
return c.json(
  { error: `Upstream API error: ${error.status}`, message: 'The upstream API returned an error' },
  error.status as 400 | 404 | 500 | 502 | 503,   // ← 302 at runtime
);
```

**Fix.** Clamp the pass-through to a known 4xx/5xx set (`[400,404,429].includes(s) ? s : 502`), and drop `Cache-Control: no-store` on any non-2xx rather than only `>= 400`.

---

### api-worker-05 — BUG — LOW — `src/index.ts:118` + `src/middleware/rate-limit.ts:54`

**Claim.** `/v1/telemetry/<anything>` is exempted from the API rate-limit bucket by prefix but is not matched by the telemetry bucket, which is registered on the exact path — so that whole subtree is un-rate-limited.

**Failing input → wrong outcome.** `isTelemetryPath` skips on `path.startsWith('/v1/telemetry/')`, while `app.use(TELEMETRY_PATH, telemetryRateLimitMiddleware)` registers the literal path only — Hono's `use()` does **not** append `/*` (`hono/dist/hono-base.js:65-75`, `#addRoute(METHOD_NAME_ALL, this.#path, …)`), and `strict` defaults to `true`. So `GET /v1/telemetry/x` and `POST /v1/telemetry/` traverse both limiters untouched and reach `notFound()` — unlimited anonymous 404s on a `/v1/*` path the docs promise is limited.

**Why tests miss it.** `src/middleware/rate-limit.test.ts:70-80` reproduces the wiring but only ever requests the exact `/v1/telemetry`.

**Covered by test:** no.

```ts
// src/middleware/rate-limit.ts:54-56
export function isTelemetryPath(path: string): boolean {
  return path === TELEMETRY_PATH || path.startsWith(`${TELEMETRY_PATH}/`);  // exempts the subtree …
}
// src/index.ts:117-118
app.use('/v1/*', rateLimitMiddleware);
app.use(TELEMETRY_PATH, telemetryRateLimitMiddleware);                      // … but only covers the leaf
```

**Fix.** Either narrow `isTelemetryPath` to `path === TELEMETRY_PATH`, or register the telemetry limiter on `` `${TELEMETRY_PATH}/*` `` as well. Add a test asserting `/v1/telemetry/x` consumes a bucket.

---

### api-worker-06 — BUG — LOW — `src/routes/dyes.ts:209` and `:183`

**Claim.** The dye-id routes use bare `parseInt`, so non-canonical and outright wrong spellings resolve to a real dye and get a 24 h shared-cache TTL.

**Failing input → wrong outcome.** `GET /v1/dyes/1e3` → `parseInt('1e3', 10)` = `1` → returns the **stainID 1** dye with HTTP 200 and `Cache-Control: public, max-age=3600, s-maxage=86400`. Likewise `/v1/dyes/5729abc`, `/v1/dyes/%205729` (leading space), `/v1/dyes/+5729` — each a distinct cache key for the same payload. `/v1/dyes/stain/1e3` behaves identically. The icon proxy already got the canonical-form regex for exactly this reason (`src/chara/router.ts:53`, FINDING-025/API-4); the dye routes did not.

**Why tests miss it.** `tests/routes/dyes.test.ts` covers `'abc'` (400) and `200` (404) but no partially numeric or exponent form.

**Covered by test:** no.

```ts
// src/routes/dyes.ts:208-217
const raw = c.req.param('id');
const id = parseInt(raw, 10);            // '1e3' → 1, '5729abc' → 5729, ' 5729' → 5729
if (isNaN(id)) { throw new ApiError(ErrorCode.VALIDATION_ERROR, ...); }
```

**Fix.** Reuse the `CANONICAL_ICON_ID` pattern: `/^-?[1-9]\d{0,6}$/` (allowing the negative legacy-facewear branch) before `parseInt`, on `/:id`, `/stain/:stainId` and inside `parseCommaSeparatedIds`.

---

### api-worker-07 — BUG — LOW — `src/index.ts:140`

**Claim.** The API root advertises a documentation URL that 404s.

**Failing input → wrong outcome.** `GET https://data.xivdyetools.app/` returns `{"documentation":"https://data.xivdyetools.app/docs"}`. No `/docs` route exists, and the `ASSETS` branch (`src/index.ts:41`) fires only for `hostname === 'developers.xivdyetools.app'`, so that URL falls to `notFound()` → 404. The real docs host is `developers.xivdyetools.app` (`wrangler.toml:76`, `[env.production.assets]`).

**Why tests miss it.** No test asserts the root payload's fields; `app-hardening.test.ts:93` only checks that non-docs hosts don't hit `ASSETS`.

**Covered by test:** no.

**Fix.** `documentation: 'https://developers.xivdyetools.app'`.

---

### api-worker-08 — UNTESTED — LOW — `src/universalis/services/cached-fetch.test.ts:115-133`

**Behaviour that test was supposed to catch:** that a cache miss writes the fetched payload back to the Cache API.

The assertion is `expect(mockCtx.waitUntil).toHaveBeenCalled()`. On the miss path `RequestCoalescer.coalesce` **itself** calls `this.ctx.waitUntil(...)` for its 100 ms entry cleanup (`request-coalescer.ts:148-153`), so deleting `cacheService.storeAsync(cacheKey, parsed, config)` from `cached-fetch.ts:121` leaves this test green and the proxy permanently uncached.

```ts
// cached-fetch.test.ts:131-132
// waitUntil should be called to store to cache
expect(mockCtx.waitUntil).toHaveBeenCalled();
```

**Fix.** Assert the entry exists: `await caches.open('universalis-proxy')` then `.match(new Request(`${baseUrl}/__cache/store-test`))` is defined and round-trips the payload.

---

### api-worker-09 — UNTESTED — LOW — `src/universalis/config/cache.test.ts:17-43, 118-139`

**Behaviour that test was supposed to catch:** that each cache config is a well-formed `CacheConfig`.

`CACHE_CONFIGS` is declared `as const satisfies Record<string, CacheConfig>` (`config/cache.ts:47`), so the compiler already proves every field's presence and type. Nine of the fifteen assertions restate that: `toHaveProperty(field)` ×3 configs, `typeof config.cacheTtl === 'number'`, `typeof config.keyPrefix === 'string'`, `expect(CACHE_CONFIGS[key]).toBeDefined()` over a hand-written key list, and a `validateConfig()` helper that re-implements the type check and asserts `true`. No source edit that type-checks can make them fail.

```ts
// config/cache.test.ts:127-137
const validateConfig = (config: CacheConfig): boolean =>
  typeof config.cacheTtl === 'number' && typeof config.swrWindow === 'number' && ...;
Object.values(CACHE_CONFIGS).forEach((config) => { expect(validateConfig(config)).toBe(true); });
```

**Fix.** Keep the four value assertions (`300/120/86400/21600`) and the ordering invariants; delete the shape/typeof/type-safety blocks.

---

### api-worker-10 — UNTESTED — LOW — `src/universalis/services/cached-fetch.test.ts:221-234`

**Behaviour that test was supposed to catch:** `UpstreamError` carrying an upstream status.

The test constructs five errors with statuses it chose (400/429/500/502/503) and then asserts `error.status >= 400` and `error.statusText` truthy — arithmetic over its own inputs. It cannot fail for any implementation that stores the constructor arguments (already proven by the preceding test at :210).

**Fix.** Delete, or replace with the one behaviour that is not proven above — that `error.message` composes `status` + `statusText` for each.

---

### api-worker-11 — OPT — LOW — `src/universalis/services/cache-service.ts:65-67`

The Cache API key embeds `baseUrl` (`new URL(c.req.url).origin`), so the same Universalis answer is stored under three disjoint namespaces: `https://data.xivdyetools.app` (web app), `https://proxy.xivdyetools.app` / `…projectgalatine.com` (legacy custom domains, `wrangler.toml:74-75`) and `https://internal` (the discord-worker service binding). Three upstream fetches per TTL window for one payload. The coalescer key, by contrast, is origin-free (`cacheKey` only), so a cross-origin waiter takes the winner's data and never populates its own namespace.

**Fix.** Build the synthetic URL from a fixed constant host (`https://cache.internal/__cache/<key>`) rather than the request origin; `caches.open('universalis-proxy')` already namespaces it away from `chara-resolve` and `caches.default`.

---

### api-worker-12 — REFACTOR — LOW — `src/universalis/services/cached-fetch.ts:75-80, 97-101`

Two unconditional raw `console.log(JSON.stringify({event:'cache_result', …}))` per Universalis request, bypassing `@xivdyetools/logger`'s adapter, level control and redaction — the only place in the worker that does. Two log lines per market call also lands squarely in the "never enable Workers Logs without re-checking FINDING-010/011" constraint.

**Fix.** Route through `getLogger(c)?.debug(...)` (the router already has the context) or drop; `X-Cache` already exposes the same signal per response.

---

### api-worker-13 — REFACTOR — LOW — `docs/guide/rate-limits.md:8, 22`

Documented contract vs implementation, two drifts on the same table:
- "`X-RateLimit-Remaining` — Requests remaining before limit is hit". With `API_RATE_LIMITER` bound (production), `CloudflareRateLimiter.check` returns `remaining: tier.limit - 1` on every allowed request (`packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:170-176`), i.e. the header is the constant `64` until the moment it becomes `0`. The backend's own JSDoc flags this ("documented, not bugs") but the public docs don't, and the "Handling 429" section tells clients to act on it.
- "`/v1/*` — 60 req/min per IP (**KV-backed sliding window**)". Production is the native per-colo fixed-window binding; KV is only the unbound fallback (`src/middleware/rate-limit.ts:38-49`).

**Fix.** Document `X-RateLimit-Remaining` as an "at least one more" indicator and correct the backend description; `X-RateLimit-Reset`/`Retry-After` remain accurate.

## 3. POSITIVE — do not re-file

- **Telemetry is the model for client-controlled key lookup.** `EVENT_SCHEMAS` is a `Map` with an explicit comment about `Object.prototype` members, and `telemetry/router.test.ts:94` pins it. Privacy holds end-to-end: no IP, UA, request id or Origin reaches a datapoint or a log line; `Sec-GPC: 1` short-circuits before anything; the `env` blob is server-derived from `Origin`; `dye_pick` carries only a stainID that `dyeService.getByStainId` confirms exists.
- **BUG-028 / BUG-030 regressions are clean.** `buildCacheHeaders` still emits `max-age=0, must-revalidate` for stale SWR responses (`cached-fetch.ts:279-281`), and `/v1/match/within-distance` still fetches unbounded → filters → `slice(0, limit)` (`match.ts:106-118`).
- **The coalescer's in-flight map is sound.** The deferred promise is stored synchronously before any `await`, `promise.catch(()=>{})` suppresses the unhandled rejection, and the entry is deleted on **both** paths (immediately on reject, 100 ms deferred on resolve) — no rejected promise is ever cached, and the 60 s jittered sweep is a backstop, not the mechanism.
- **Locale handling is race-free and cache-correct.** `localeMiddleware` calls `ensureLocaleLoaded` (never `setLocale`), passes the locale explicitly to every getter, and the only locale input is the `?locale=` query param — which is part of the URL, so the 24 h `s-maxage` cannot serve a wrong-language body. No `Accept-Language`, no `Vary` needed.
- **The chara surface is carefully bounded.** Streamed 8 KB body cap, canonical icon-id regex, 1 MB icon cap, PNG-signature gate with the upstream `Content-Type` never reflected, `Content-Security-Policy: sandbox`, `redirect: 'manual'` + explicit 3xx refusal, 10 s `AbortSignal.timeout`, and truncated search pages deliberately not cached as "no item row".
- **No auth or cookies anywhere**, so the global `cors({ origin: '*', credentials: false })` is correct and needs no `Vary: Origin`; `X-API-Key` is correctly no longer advertised.
- **The docs host cannot shadow API paths**: `run_worker_first = true` plus an explicit `hostname === 'developers.xivdyetools.app'` check, with the security headers re-applied because that branch skips the middleware chain.
- **`wrangler.toml` guards the deploy hazard**: routeless dev worker with `workers_dev`/`preview_urls` explicitly off, pinned by `tests/wrangler-config.test.ts`.

## 4. REJECTED

- *`/v1/match/within-distance?method=rgb` truncates an unsorted k-d tree result* — `KdTree.pointsWithinDistance` sorts by distance before returning (`packages/core/src/utils/kd-tree.ts:196`). Not a defect.
- *Cached rejected init promise in `CacheService.getCache`* — `caches.open()` is memoised per **instance**, and a new `CacheService` is constructed per `cachedFetch` call, so a rejection cannot poison the isolate.
- *`localizedNameFor`'s `dye.itemID < 0` facewear guard is dead under schema v2* — true but harmless; it is documented as the legacy-compat branch and removing it buys nothing.
- *`EXPENSIVE_DYE_IDS.includes(dye.itemID)` broken by Patch 7.5 consolidation* — `EXPENSIVE_DYE_IDS = [13114, 13115]` are legacy per-dye itemIDs and `Dye.itemID` is still the legacy id; `getMarketItemID` is applied only in the serializer. Consistent.
- *`meta.requestId` / `X-Request-Id` baked into a 24 h-cacheable body* — real but inert: Cloudflare does not edge-cache a Worker's own dynamic response without a cache rule, and the id is a random UUID with no sensitivity.
- *`normalizeItemIds` / `ids.length === 0` unreachable branch* — `split(',')` on a `^[\d,]+$`-validated string always yields ≥ 1 element; dead but defensive, and `Number('')` = 0 is caught by the `id < 1` check.
- *Region names (`Japan`, `North-America`) rejected by the DC whitelist* — the live-list fallback would not accept them either, but nothing in the monorepo sends a region; Universalis' `/aggregated` is queried with a DC or world in both consumers.
- *Coalescer entry surviving a dropped `waitUntil` for up to 60 s* — the served payload is the same data at worst 60 s old inside a 300 s TTL; no observable wrongness.
- *`cache.put` on the synthetic `https://internal` origin failing* — every `CacheService` write is wrapped in a swallowing `try/catch` + `storeAsync(...).catch(() => {})`, so a rejection degrades to "uncached", not an error. (The fragmentation itself is filed as api-worker-11.)
- *Telemetry `writeDataPoint` exceeding AE limits* — `MAX_EVENTS = 25` matches the per-invocation cap exactly, and 9 short blobs are far under the 5,120-byte budget.

## 5. COVERED

**31 files read in full** (29 non-test sources in scope + 2 config).

`src/index.ts`, `src/types.ts`, `src/lib/api-error.ts`, `src/lib/bounded-body.ts`, `src/lib/dye-serializer.ts`, `src/lib/response.ts`, `src/lib/services.ts`, `src/lib/validation.ts`, `src/middleware/locale.ts`, `src/middleware/rate-limit.ts`, `src/routes/dyes.ts`, `src/routes/match.ts`, `src/chara/cache.ts`, `src/chara/regional-names.ts`, `src/chara/resolver.ts`, `src/chara/router.ts`, `src/chara/types.ts`, `src/chara/xivapi.ts`, `src/telemetry/origin.ts`, `src/telemetry/router.ts`, `src/telemetry/schema.ts`, `src/universalis/router.ts`, `src/universalis/types.ts`, `src/universalis/config/cache.ts`, `src/universalis/config/datacenters.ts`, `src/universalis/services/cache-service.ts`, `src/universalis/services/cached-fetch.ts`, `src/universalis/services/rate-limiter.ts`, `src/universalis/services/request-coalescer.ts`, `wrangler.toml`, `vitest.config.ts` (+ `package.json`).

**Tests skimmed:** `src/universalis/{router,test-setup}.test.ts`+`test-setup.ts`, `src/universalis/config/cache.test.ts`, `src/universalis/services/{cached-fetch,request-coalescer}.test.ts`, `src/middleware/rate-limit.test.ts`, `tests/app-hardening.test.ts`, `tests/routes/{dyes,match}.test.ts`, `tests/lib/validation.test.ts`; test-name inventories for `src/chara/router.test.ts` and `src/telemetry/router.test.ts`.

**Supporting reads (outside scope, to confirm claims):** `packages/core/src/{index.ts, types/index.ts, services/ColorService.ts, services/LocalizationService.ts, services/localization/TranslationProvider.ts, services/DyeService.ts, services/dye/{DyeSearch,DyeFilter}.ts, services/chara/chara-models.ts, utils/kd-tree.ts}`; `packages/worker-kit/src/{middleware/rate-limit.ts, rate-limiter/ip.ts, rate-limiter/backends/cloudflare.ts}`; `apps/discord-worker/src/services/budget/universalis-client.ts`; `apps/api-worker/docs/{guide/rate-limits.md, reference/universalis.md, .vitepress/config.ts}`; `hono@4.13.5/dist/{hono-base.js, utils/url.js}`.
