# Review: api-worker (deep-dive 2026-09-16)

Scope: `apps/api-worker/src/**` (read-only) + `wrangler.toml` (read-only) + sampled docs contract
(`/v1/wheels`, `/v1/wheels/:id`, `/v1/harmony/types`, `/v1/harmony`, `/v1/chara/resolve`,
`/v1/telemetry`) against their handlers.

## 1. Map

| Module | Routes / exports | Role |
|---|---|---|
| `src/index.ts` | app assembly | Docs-host branch, global middleware chain, route mounts, `notFound`/`onError` |
| `src/types.ts` | `Env`, `Variables` | Bindings + `requestId`/`locale` context vars |
| `src/routes/dyes.ts` | `GET /search,/categories,/batch,/consolidation-groups,/stain/:id,/:id,/` | Dye DB access, ID auto-detection, facewear tombstone 404 |
| `src/routes/match.ts` | `GET /closest,/within-distance` | ΔE matching, BUG-030 limit-after-filter |
| `src/routes/wheels.ts` | `GET /,/:id` | Colour wheel registry + per-dye hue table |
| `src/routes/harmony.ts` | `GET /types,/` | `generateHarmonySlots` over core's wheels |
| `src/middleware/rate-limit.ts` | `rateLimitMiddleware`, `telemetryRateLimitMiddleware` | Native binding + KV fallback, fail-open vs fail-closed |
| `src/middleware/locale.ts` | `localeMiddleware` | Once-per-request locale registration (race-free) |
| `src/lib/validation.ts` | parsers, `resolveIdType`, filters | All client-input parsing |
| `src/lib/{api-error,response,services,dye-serializer,harmony,bounded-body}.ts` | helpers | Envelope, singleton `DyeService`, serialization, byte-capped body reads |
| `src/chara/{router,resolver,xivapi,cache,types,regional-names}.ts` | `POST /resolve`, `GET /icon/:id` | `.chara` model→item resolution, edge cache, XIVAPI client |
| `src/telemetry/{router,schema,origin}.ts` | `POST /telemetry` | Origin-gated, allowlist-validated AE writes |
| `src/universalis/{router,types}.ts` + `config/*`, `services/*` | `/universalis/*`, `/api/v2/*` | Cache API proxy, coalescer, memory rate limiter |

## 2. Candidates

**api-worker-01** — UNTESTED — priority MEDIUM — `tests/lib/dye-serializer.test.ts:6-24`
Claim: the only test of `serializeDye`'s field mapping (`src/lib/dye-serializer.ts:33-55`) asserts every boolean/string field with `.toBeDefined()`.
Failing input → wrong outcome: a future edit that swaps two same-typed fields (e.g. `isPastel: dye.isDark, isDark: dye.isPastel`, or `category: dye.acquisition`) still leaves every field "defined" — the test stays green while every dye in every `/v1/dyes*`, `/v1/match/*`, `/v1/wheels/:id`, `/v1/harmony` response carries swapped values.
Why tests miss it: `.toBeDefined()` only rejects `undefined`; it cannot detect a value landing in the wrong field.
Covered by test: yes (weakly — the vacuous assertion is the whole coverage for those 8 fields).
```ts
expect(result.isMetallic).toBeDefined();
expect(result.isPastel).toBeDefined();
expect(result.isDark).toBeDefined();
expect(result.isCosmic).toBeDefined();
```
Fix direction: assert exact values against a known mock dye's expected flags (as the test already does for `itemID`/`name`), not just presence.

**api-worker-02** — UNTESTED — priority MEDIUM — `src/routes/dyes.ts:240-252`
Claim: the negative-ID "legacy Facewear tombstone" 404 branch (which calls `getFacewearColorByLegacyItemID(id)` and shapes a 404 body carrying the facewear's `name`/`id`/`hex`) has no HTTP-level test anywhere in the suite.
Failing input → wrong outcome: `GET /v1/dyes/-1629` today returns the documented explanatory 404; a regression (wrong field name passed to the message template, or the `facewear ? {...} : undefined` details branch inverted) would ship silently — only the *lower-level* `resolveIdType(-1629).type === 'facewear'` and `lookupDyeByResolvedId(...) === null` are unit-tested (`tests/lib/validation.branches.test.ts:81-88`, `tests/lib/validation.test.ts:16-19`), never the route's own message/details construction.
Why tests miss it: the unit tests stop at "returns null," which is necessary but not sufficient — the interesting logic (facewear lookup + message text + `details` shape) lives entirely in the route handler and is unexercised.
Covered by test: no (route-level `grep` for `/v1/dyes/-` across `tests/routes/dyes.test.ts` returns nothing).
```ts
if (resolution.type === 'facewear') {
  const facewear = getFacewearColorByLegacyItemID(id);
  throw new ApiError(ErrorCode.NOT_FOUND,
    facewear ? `ID ${id} was the legacy synthetic ID for the Facewear color "${facewear.name}"...`
             : `Negative IDs (legacy Facewear synthetic IDs) are no longer served as dyes.`,
    404, facewear ? { facewearId: facewear.id, hex: facewear.hex } : undefined);
}
```
Fix direction: add a route-level test hitting `/v1/dyes/-1629` (a real legacy id) and one unknown negative id, asserting `body.details.facewearId`/`hex` and the bare-miss message respectively.

**api-worker-03** — BUG — severity LOW — `src/universalis/services/cache-service.ts:117-119`
Claim: the SWR-expiry delete path is the one Cache-API write in this file with no swallowed rejection.
Failing input → wrong outcome: a request that lands on an entry whose age is past `ttl + swrWindow` triggers `this.ctx.waitUntil(cache.delete(cacheRequest))` (no `.catch()`). Every sibling write (`store()` via `storeAsync()`, line 162-166) explicitly does `.catch(() => {})`. If `cache.delete()` ever rejects (transient Cache API error), it surfaces as an unhandled rejection inside `waitUntil` — the request itself already returned `null`/fell through to upstream correctly, so this is purely operational noise (an uncaught-exception log line), not a wrong response.
Why tests miss it: no test forces `cache.delete` to reject.
Covered by test: no.
```ts
if (isExpired && !isWithinSwr) {
  this.ctx.waitUntil(cache.delete(cacheRequest));
  return null;
}
```
Fix direction: `this.ctx.waitUntil(cache.delete(cacheRequest).catch(() => {}))` for consistency with `storeAsync`.

**api-worker-04** — REFACTOR — `src/index.ts:206-246` vs `src/lib/response.ts:26-35` / `src/routes/match.ts:52-65`
Claim: inconsistent error envelope construction. `buildMeta()` adds `locale` to `meta` only from `successResponse`/`paginatedResponse`; the global `onError` handler and the inline 404 in `match.ts`'s `/closest` (built by hand instead of `throw new ApiError(...)`) both hardcode `{ requestId, apiVersion }` and never forward `c.get('locale')`, and the inline 404 skips the `ApiError` class entirely (same wire shape, duplicated construction).
Not a live bug (error `message` text is English-only regardless), but it is the exact "inconsistent error shapes across routes" pattern called out as worth a REFACTOR line — every other 404 in this file goes through `throw new ApiError(...)`.
Fix direction: replace the inline `c.json({...}, 404)` in `match.ts:52-65` with `throw new ApiError(ErrorCode.NOT_FOUND, 'No matching dye found.', 404)`.

## 3. POSITIVE

- `/v1/harmony`, `/v1/wheels`, `/v1/wheels/:id`, `/v1/chara/resolve`, `POST /v1/telemetry` all match their documented contracts exactly (`docs/reference/harmony.md`, `docs/reference/chara.md`) — params, defaults, error codes, and response shapes were cross-checked line-by-line against the handlers.
- `BUG-030` (within-distance: limit applied after excludes/filters) is still correctly ordered — `src/routes/match.ts:99-118` filters/excludes before `.slice(0, limit)`.
- `routes/harmony.ts` mixes `dye.itemID` (from the base dye) and `resolveExcludeIds()`'s `dye.id` into one `excludeItemIDs` array — looked like a type-confusion bug, but `DyeDatabase.ts:215-216` guarantees `dye.id === dye.itemID` for every loaded dye, so this is safe today (see REJECTED).
- The telemetry pipeline (`origin.ts` + `schema.ts` + `router.ts`) is exemplary: Map-based (never object-literal) lookups everywhere a client string is the key, GPC checked before any body read, origin gate before any body read, fail-closed rate limiting documented and distinct from the fail-open API bucket.
- Every `fetch()` to an external upstream (Universalis in `cached-fetch.ts`, XIVAPI in `chara/xivapi.ts`) carries `AbortSignal.timeout(10_000)` and `redirect: 'manual'` (with the 2026-08-29 `manual`-not-`error` lesson documented inline).
- Both POST routes (`/v1/chara/resolve`, `/v1/telemetry`) enforce their byte cap on the **stream**, not just `Content-Length`, via the shared `bounded-body.ts` helpers.

## 4. REJECTED

- `excludeItemIDs` in `routes/harmony.ts:106-109` mixing `dye.itemID` and `resolveExcludeIds()`'s `dye.id` — checked `DyeDatabase.ts:206-217`: `id` is always set equal to `itemID` at load time for every current dye, so no divergence is reachable today.
- `/v1/*` rate limiter (`selectApiRateLimiter`) sharing one `'unknown'`-keyed bucket for any IP-less caller (the same class of bug as the fixed `BUG-048` on the Universalis proxy) — no current caller reaches `/v1/*` without `CF-Connecting-IP`; per `CLAUDE.md`, api-worker has no inbound service bindings on `/v1/*` routes, only outbound HTTPS/browser traffic. Cannot construct a failing request today.
- Missing `Vary: Origin` on Universalis proxy responses — the CORS middleware sets a static `Access-Control-Allow-Origin: *` (not reflected per-request), so no `Vary` is needed for correctness; consistent with the OPT-004 fixed-synthetic-origin cache key fix already in place.
- `routes/dyes.ts:253-255` hint text "falls in the unassigned range (255-5728)" for `id=0` would be inaccurate — unreachable: `CANONICAL_DYE_ID` (`/^-?[1-9]\d{0,9}$/`) rejects a bare `"0"` with a 400 before `resolveIdType` ever runs, on every route that accepts an id (`/:id`, `/batch`, `/harmony?dye=`).
- Security-headers middleware (`index.ts:77-92`) setting `Cache-Control: no-store` post-`next()` for thrown `ApiError`s — Hono's `onError` resolves the error into a response *within* the composed dispatch, so outer middleware's post-`await next()` code still runs; confirmed by the already-passing `app-hardening.test.ts:53-64` (`/v1/match/closest?hex=zzz` → 400 with `no-store`).

## 5. COVERED

34 source files read in full (all non-test `.ts`/`.toml`/`.json` under scope):
`src/index.ts`, `src/types.ts`, `wrangler.toml`,
`src/lib/api-error.ts`, `src/lib/bounded-body.ts`, `src/lib/dye-serializer.ts`, `src/lib/response.ts`, `src/lib/services.ts`, `src/lib/validation.ts`, `src/lib/harmony.ts`,
`src/routes/dyes.ts`, `src/routes/match.ts`, `src/routes/wheels.ts`, `src/routes/harmony.ts`,
`src/middleware/rate-limit.ts`, `src/middleware/locale.ts`,
`src/chara/router.ts`, `src/chara/cache.ts`, `src/chara/types.ts`, `src/chara/resolver.ts`, `src/chara/xivapi.ts`, `src/chara/regional-names.ts`, `src/chara/data/item-names.meta.json`,
`src/universalis/router.ts`, `src/universalis/types.ts`, `src/universalis/config/cache.ts`, `src/universalis/config/datacenters.ts`, `src/universalis/services/cache-service.ts`, `src/universalis/services/cached-fetch.ts`, `src/universalis/services/rate-limiter.ts`, `src/universalis/services/request-coalescer.ts`,
`src/telemetry/router.ts`, `src/telemetry/schema.ts`, `src/telemetry/origin.ts`.

Supporting reads (cross-reference / contract / coverage checks, not primary-scope source):
`packages/core/src/services/dye/HarmonySelector.ts`, `packages/core/src/services/dye/DyeDatabase.ts` (offset 190-230), `packages/core/src/services/dye/wheels/ColorWheel.ts` (grep excerpt);
`docs/reference/harmony.md`, `docs/reference/chara.md`, `docs/.vitepress/theme/lib/endpoints.ts` (grep);
`apps/api-worker/CLAUDE.md`, `apps/api-worker/tests/test-utils.js` (implied via test reads);
test files sampled for coverage/quality: `src/lib/validation.test.ts`, `tests/app-hardening.test.ts`, `tests/routes/harmony.test.ts`, `tests/routes/wheels.test.ts`, `tests/lib/dye-serializer.test.ts`, `tests/lib/validation.branches.test.ts`, `tests/lib/validation.test.ts`, `tests/routes/dyes.test.ts` (grepped).
