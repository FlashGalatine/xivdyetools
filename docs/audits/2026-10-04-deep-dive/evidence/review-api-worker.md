# Review: api-worker (deep-dive 2026-10-04)

Branch `preview/integration-2026-10-04` @ 80262a2f. Read-only review. Paths are relative to `apps/api-worker/` unless noted.

## 1. Map

| Area | Files | Notes |
|---|---|---|
| App + middleware chain | `src/index.ts`, `src/middleware/{rate-limit,locale}.ts` | docs host -> requestId -> logger -> security headers -> CORS -> `/v1/*` limiter -> telemetry limiter -> `/v1/*` locale -> X-API-Version |
| Dye / match / wheels / harmony | `src/routes/*.ts`, `src/lib/{validation,dye-serializer,harmony,response,api-error,services}.ts` | 14 GET routes, envelope `{success,data,meta}` |
| `.chara` resolve | `src/chara/{router,xivapi,resolver,cache,types,acquisition,regional-names}.ts` | POST `/v1/chara/resolve`, GET `/v1/chara/icon/:id`; Cache API store `chara-resolve` |
| Telemetry | `src/telemetry/{router,origin,schema}.ts` | POST `/v1/telemetry`, always 204 once parsed |
| Universalis proxy | `src/universalis/**` | `/universalis/*` and `/api/v2/*`; PR #229 swapped the memory limiter for native bindings |
| Acquisition build (offline) | `scripts/build-acquisition.ts`, `scripts/acquisition/{inputs,sources,select,format,labels,model}.ts`, `tables/*.json` | feeds `src/chara/data/acquisition.en.json` (23,585 lines) |
| Name tables (offline) | `scripts/build-item-names.mjs` | feeds `item-names.{ko,zh}.json` |
| Config | `wrangler.toml`, `package.json` | 5 rate-limit bindings per env, namespace ids 1001-1010, no collisions with other apps (1011-1056) |

Origin tags: PR #229 changed `src/types.ts`, `src/universalis/router.ts`, `src/universalis/services/rate-limiter.ts`, `wrangler.toml`. Everything else is MAIN.

## 2. Candidates

### api-worker-01 — BUG — MEDIUM — `src/index.ts:128-129`
- **Claim:** every telemetry beacon runs `telemetryRateLimitMiddleware` twice.
- **Why:** Hono's `use('/v1/telemetry/*')` also matches the bare `/v1/telemetry`, so the exact-path registration on line 128 and the wildcard on line 129 both fire.
- **Verified:** I ran Hono from `apps/api-worker/node_modules` with the same two `app.use` calls. `POST /v1/telemetry` ran the middleware 2 times and `POST /v1/telemetry/x` ran it once.
- **Failing input → wrong outcome:**
  - One beacon from a NAT address makes two `limit()` calls on `TELEMETRY_RATE_LIMITER` (or two KV puts on the fallback).
  - The 240/60 s bucket therefore admits 120 beacons per IP, not 240. The doc comment at `src/middleware/rate-limit.ts:151-157` sizes it as about 60 tabs; it is about 30.
  - The bucket fails closed (FINDING-014), so the excess beacons are dropped silently.
- **Why tests miss it:** `src/middleware/rate-limit.test.ts:70-76` hand-builds an app that registers only `app.use('/v1/telemetry', …)`, and its binding assertions count 3 calls for 3 beacons. No test goes through the real `index.ts` wiring, which has the extra `/*` line added by the api-worker-05 fix. Covered by a test: no.
- **Origin:** MAIN (introduced by the api-worker-05 fix).
- **Excerpt:**
```ts
app.use(TELEMETRY_PATH, telemetryRateLimitMiddleware);
app.use(`${TELEMETRY_PATH}/*`, telemetryRateLimitMiddleware);
```
- **Fix direction:** register only `${TELEMETRY_PATH}/*`, which already covers the exact path (the api-worker-05 comment assumes it does not). Then make a test drive `index.ts`'s `app` with a counting binding and assert one `limit()` call per beacon.

### api-worker-02 — BUG — LOW — `src/lib/validation.ts:202`, `:244`
- **Claim:** `parseIntParam` and `parseFloatParam` accept trailing garbage and exponent forms. api-worker-06 hardened dye ids with `CANONICAL_DYE_ID` and the icon id with `CANONICAL_ICON_ID`, but not the query integers.
- **Failing input → wrong outcome:**
  - `/v1/match/within-distance?limit=1e2` returns 1 result (`parseInt('1e2')` is 1) instead of 100.
  - `?page=2abc` returns page 2.
  - `?perPage=50.9` returns 50.
  - `?maxDistance=10px` is read as 10.
  - Each spelling is also a separate 24 h shared-cache key for the same payload, which is the cache-key fan-out api-worker-06 closed for ids.
- **Why tests miss it:** `tests/lib/validation.test.ts:100` only checks `'abc'`. Covered by a test: no.
- **Origin:** MAIN.
- **Excerpt:**
```ts
const num = parseInt(value, 10);
if (isNaN(num)) { throw … }
```
- **Fix direction:** reject anything that is not `/^-?\d+$/` (ints) or a plain decimal (floats) before parsing.

### api-worker-03 — BUG — LOW (operational) — `wrangler.toml:44`, `:98`, `src/chara/cache.ts:346`
- **Claim:** production pins `XIVAPI_VERSION = "latest"`, but the row cache is namespaced by that literal string (`chara:3:latest:rows:…`).
- **Effect:** the documented patch procedure ("roll the pin forward by hand → cold cache, not a stale one", `wrangler.toml:38-41`, `cache.ts:307-309`) cannot happen with `latest`, because the namespace never changes.
- **Failing state → wrong outcome:**
  - After a patch adds Item rows that share an existing `ModelMain` (new Dated / Augmented twins), cached families keep the old `familySize`, `alternates` and `rules` for up to 8 days (7 d TTL + 1 d SWR).
  - `getRows` ignores `isStale` (`cache.ts:362-366`), so the SWR day is just a longer TTL with no revalidation.
  - During the ingest window, `latest` also answers 503 instead of continuing on the old version. That is the trade-off the pin exists to avoid.
- **Why tests miss it:** nothing asserts the production var against the pin procedure; `tests/wrangler-config.test.ts` pins limits only. Covered by a test: no.
- **Origin:** MAIN.
- **Fix direction:** pin the real `/api/version` key in `[env.production].vars` and bump it as part of `build-acquisition.ts`/`build-item-names.mjs` after each patch. Or drop the pin language from the docs and key the namespace off `search.version`.

### api-worker-04 — OPT — LOW (unmeasured) — `src/chara/acquisition.ts:11`, `src/chara/regional-names.ts:11-12`
- **Claim:** three JSON tables (1.36 MB acquisition, 1.10 MB ko, 0.90 MB zh, 3.4 MB raw) are static imports, so every cold isolate parses them before serving `/health`, `/v1/dyes` or the Universalis proxy, which never touch them.
- **Failing state → wrong outcome:** added cold-start CPU on routes that do not use the data. I did not measure it; it should be checked with `wrangler deploy --dry-run` or a startup profile before acting.
- **Covered by a test:** n/a.
- **Origin:** MAIN.
- **Fix direction:** `await import()` inside `acquisitionFor` / `regionalNames` with a module-scope memo, or build the tables to `Map`s on first resolve.

### api-worker-05 — BUG — LOW (data) — `src/chara/data/item-names.meta.json`, `scripts/build-item-names.mjs`
- **Claim:** the ko/zh name tables lag the acquisition table.
  - `item-names.meta.json`: `generated 2026-08-21`, `equippable 28993`.
  - `acquisition.meta.json`: `generated 2026-09-28`, `equippable 29058`.
- **Failing state → wrong outcome:** about 65 equippable items added since 2026-08-21 have no ko/zh name. A Korean or Chinese UI shows the English name for them, while their acquisition line and rules are current.
- **Why tests miss it:** no test compares the two metas, and the two build scripts are separate hand-run steps ("run after build-item-names.mjs", `build-acquisition.ts:5`). Covered by a test: no.
- **Origin:** MAIN.
- **Fix direction:** one vitest assertion that `item-names.meta.equippable` equals `acquisition.meta.equippable`. Or run both scripts from a single `pnpm` task.

## 3. POSITIVE (do not re-file)

- **Body and upstream guards.**
  - Body caps stream and cancel (`src/lib/bounded-body.ts:18-38`).
  - The icon proxy is size-bounded, PNG-sniffed, and never reflects the upstream content type (`src/chara/router.ts:555-585`).
  - Every upstream fetch has `redirect: 'manual'` plus a 10 s timeout (`src/chara/xivapi.ts:234-250`, `src/universalis/services/cached-fetch.ts:335-349`).
- **Prototype-key hardening.** Telemetry events use a `Map` (`src/telemetry/schema.ts:278`); `parseMatchingMethod` allowlists first and uses `Object.hasOwn` (`src/lib/validation.ts:402-404`).
- **Truncated XIVAPI pages.** Misses from a truncated search are answered but never cached as "no item row" (`src/chara/router.ts:476-489`, `src/chara/xivapi.ts:282`).
- **Universalis rate limiting (PR #229).**
  - Scope and key selection is correct (`src/universalis/router.ts:135-151`).
  - The binding tier limit equals `config.maxRequests`, which includes the 20x multiplier for the service key; wrangler values are 30/600 (prod) and 60/1200 (dev).
  - The limiter is constructed outside the swallowed `onMiss` hook, so a misnamed binding surfaces as a 500.
  - Charging happens only on a cache miss (`cached-fetch.ts:301-303`); coalescer waiters are not double-charged.
  - Rate-limit namespace ids are unique across all apps (1001-1010 here, 1011-1056 elsewhere).
- **Known fixed patterns, no regression.**
  - `/v1/match/within-distance` filters, then truncates, and re-sorts after `slice`; core's k-d path is distance-sorted (`packages/core/src/utils/kd-tree.ts:195-197`).
  - The locale is carried explicitly with no singleton `setLocale`.
  - `excludeItemIDs` receives `dye.id`, which equals `itemID` (`DyeDatabase.ts:215-217`), so `resolveExcludeIds` is consistent.
- **Acquisition build.**
  - Teamcraft is pinned by SHA and every file is shape-asserted.
  - The relic spot checks fail the build.
  - A generated-table invariant test exists (`tests/acquisition/table.test.ts`).
  - I scanned the committed 23,585 lines for markup, doubled spaces, `NaN`/`undefined`, unbalanced parentheses and non-ASCII (only two Portuguese item names); all are clean.

## 4. REJECTED

- **Duplicate-vendor lines (e.g. item 7521, "Talan … (1 Spruce Plywood) / Talan … (1 Darksteel Hook) / …").**
  - I fetched Teamcraft `shops.json` at the pinned SHA. Shop 1769552 does carry 8 separate single-currency trades for the item, so the formatter reproduces its input faithfully.
  - Whether those are alternatives or one multi-part exchange is a game-data semantics question I cannot settle here. 93 lines are affected.
- **2 Gil vendor lines (369 items from Grenoldt, Varsarudh and Mewazunte).** I checked XIVAPI: items 25218, 25230 and 43199 have `PriceMid = 2`, so the data is correct.
- **`excludeItemIDs` fed with internal ids in `/v1/harmony`.** `Dye.id` equals `itemID` in schema v2, so it is correct.
- **`costText` doc comment says "1 Wolf Mark" while the code prints "1 Wolf Marks".** The Mar 2026 reminders require the plural for currencies; the doc comment is stale, with no behaviour impact.
- **Unlimited upstream hits from the invalid-world validation fetches (`src/universalis/router.ts:195-208`).**
  - They are not charged to the limiter and are not negatively cached, but they only reach upstream when `data-centers:all` / `worlds:all` are uncached and Universalis is already failing.
  - The in-isolate coalescer collapses concurrent attempts.
- **Chara cache "stale served without revalidation".** Cosmetic: the Cache API evicts at `ttl + swr` anyway (`cache-service.ts:179`).
- **`X-API-Version` missing on 429 and locale 400s.** The version middleware is registered after those short-circuits; cosmetic.
- **Cache poisoning via an empty-but-200 XIVAPI answer after a partial ingest.** Speculative; XIVAPI answers 503 until ingested, and I have no failing input.

## 5. COVERED

46 of the 49 slice files read in full:
- `package.json`, `wrangler.toml`
- all 7 `scripts/acquisition/*.ts` files, `build-acquisition.ts`, `build-item-names.mjs`
- 4 of the 5 `tables/*.json` files in full (`relic-sagas`, `eureka-lockboxes`, `ishgard-districts`, `duty-tokens` partly); `gacha-containers.json` read in part
- `src/index.ts`, `src/types.ts`, `src/lib/*` (7 files), `src/middleware/*` (2), `src/routes/*` (4)
- `src/chara/*` (7), `src/telemetry/*` (3)
- `src/universalis/{router,types}.ts`, `config/{cache,datacenters}.ts`, `services/*` (4)

`src/universalis/test-setup.ts` skimmed only. Tests sampled: `src/middleware/rate-limit.test.ts`, the PR #229 diff of `src/universalis/router.test.ts`, `tests/acquisition/table.test.ts`, and grep sweeps for weak assertions.
