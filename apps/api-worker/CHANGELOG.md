# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

Dead-code sweep (`docs/audits/2026-09-01-dead-code`, DEAD-020/021/022/023). Nothing here had a
caller; the `/v1` contract is untouched.

- `errorResponse` from `lib/response.ts` — an 18-line error envelope with zero call sites. Errors
  have always travelled through `ApiError` and the app-level handler.
- The `LocalizationService` re-export from `lib/services.ts` — every consumer already imported it
  straight from `@xivdyetools/core`.
- `createMockEnv` from `src/universalis/test-setup.ts` — a duplicate of the live helper in
  `tests/test-utils.ts`, which is the one all six test files use.
- `CacheService.deleteEntry` / `.deleteAsync` — the cache-invalidation pair had no production
  caller; entries expire by TTL. Their two tests went with them.

## [0.10.0] - 2026-08-30

Security audit remediation (docs/audits/2026-08-29-security, FINDING-010 + FINDING-014). No change to the public `/v1` contract — telemetry gains sender/GPC/fail-closed gating, and the worker's request logs drop the last `logUserAgent: true` opt-in in the repository.

### Security

- **`POST /v1/telemetry` accepted a batch from anyone, and believed whatever environment it claimed** (`docs/audits/2026-08-29-security` FINDING-014). Any third-party page could `sendBeacon` allowlisted events from its visitors' browsers — or a script could `curl` them — straight into the production dataset, so the four product metrics were poisonable and the production/beta split (one `blob9` value, since beta shares the production worker) was whatever the body asserted. The sink now gates on the sender before it reads a byte of the body: only `Origin: https://xivdyetools.app` and `https://beta.xivdyetools.app` are written — plus `http://localhost[:port]` / `http://127.0.0.1[:port]` when `ENVIRONMENT` is not `production`, for `wrangler dev` — and the accepted origin *is* the `env` dimension, so a beta page can no longer label its traffic `production`. The one exception is that loopback case itself: a local origin carries no env of its own, so on a non-production worker the validated body's `env` field still decides `blob9` there. An unaccepted beacon gets the same bare `204` with no write rather than a 4xx (the client is `sendBeacon` and cannot read the response; a 403 would only inform a scripted sender), and the `Origin` value never reaches a log line. The column layout and the event allowlist are unchanged — only how `blob9` is computed. New `src/telemetry/origin.ts`; matching is exact, so `https://xivdyetools.app.evil.example` and `http://xivdyetools.app` are rejected.
- **`Sec-GPC: 1` beacons are now dropped server-side.** The web app's privacy page promises analytics never run when the browser sends the Global Privacy Control signal, but the promise was kept only client-side — a batch that reached the worker with the header set was still written. Such a request now answers `204` with no datapoint and no log line of its own.
- **The telemetry rate-limit bucket fails closed.** With `failOpen: true` and `onError: 'fail-open'`, a broken limiter backend admitted unlimited batches, each worth up to 25 metered Analytics Engine writes. Both settings are flipped (`failOpen: false` makes the backend rethrow instead of swallowing the error into `allowed: true`; `onError: 'fail-closed'` turns the throw into the existing minimal 429 body — either alone left the gap open). The `/v1/*` `API_RATE_LIMITER` bucket is deliberately unchanged and still fails open: dropping a beacon costs nothing, dropping a dye lookup costs a user.
- **Request logs no longer carry the User-Agent header** (`docs/audits/2026-08-29-security` FINDING-010). The global `loggerMiddleware()` call was opted into `logUserAgent: true` — the last such opt-in in the repository (worker-kit defaults to `false`; presets-api and oauth dropped theirs in Sprints 1–2) — so every request, including every `POST /v1/telemetry` beacon, put the browser's User-Agent into the "Request started" log line. Workers Logs are off for this script today, so the exposure was latent rather than retained, but it contradicted the web app's privacy page, which promises "the server discards everything about the request except the validated events." The 0.9.0 entry below ("no IP, no User-Agent, no request id") described the *datapoint* the whole time — nothing ever reached Analytics Engine — this fix is about the *request log* line, which now matches the same promise.

## [0.9.0] - 2026-08-29

Minor bump: one new (internal) endpoint and two new bindings; no change to the public `/v1` contract.

### Added

- **`POST /v1/telemetry` — the web app's opt-in usage telemetry lands in Analytics Engine** (`ANALYTICS` binding: `xivdyetools_web_analytics` in production, `xivdyetools_web_analytics_dev` on the routeless dev worker). The browser beacons a `text/plain` JSON batch (≤ 25 events / 16 KB, CORS-safelisted so no preflight); `src/telemetry/schema.ts` is an allowlist — every event is mapped onto a fixed column layout (`index1`/`blob1` event, `blob2` tool, `blob3`/`blob4` two coarse dimensions, `blob5`–`blob9` locale · theme · viewport bucket · app version · env, `double1` visible seconds) and anything unknown or malformed is dropped, never written. `204` with no body once the batch parses; `400` / `413` only for non-JSON / oversized bodies. Nothing from the request other than the validated batch reaches a datapoint — no IP, no User-Agent, no request id. Internal and deliberately undocumented on developers.xivdyetools.app. Queries: `docs/operations/ANALYTICS_QUERIES.md`; spec: `docs/superpowers/specs/2026-08-29-web-analytics-design.md`.
- **Telemetry has its own per-IP rate-limit bucket (`TELEMETRY_RATE_LIMITER`, 240 / 60 s; `namespace_id` 1003 prod / 1004 dev; KV fallback under `telemetry:ip:`).** The `/v1/*` limiter keys per client IP, and one opted-in tab beacons every 15 s plus once per hide/pagehide — dozens of tabs behind one NAT or VPN address would have exhausted the shared 65 / 60 s bucket and 429'd the user-facing `/v1/chara/resolve` + icon calls from that address. `/v1/telemetry` is carved out of the API bucket in `index.ts`; `createTelemetryRateLimitMiddleware()` / `selectTelemetryRateLimiter()` are exported for tests.

### Fixed — 2026-08-29

- **Telemetry event names that collide with `Object.prototype` members no longer 500.** The schema table was an object literal, so `{ n: 'constructor' }` resolved `Object` as its mapper and threw inside `parseTelemetryBatch` (an error-level log per request; `n: 'toString'` produced a garbage datapoint). The table is a `Map` now; such events are dropped like any other unknown name.

- **Every upstream fetch failed with 502 — the Market Board on the web app and the bot's `/budget` had no prices, and `POST /v1/chara/resolve` answered 503.** The FINDING-025 / API-9 hardening set `redirect: 'error'` on the Universalis and XIVAPI fetches; the Workers runtime implements only `follow` and `manual` and throws `TypeError: Invalid redirect value` on `error`, so the fetch never left the worker (logged as "Error proxying to Universalis"). Both clients now use `redirect: 'manual'`: the proxy's existing `!response.ok` check refuses a 3xx without following it, and the XIVAPI client throws `UpstreamUnavailableError` on one. The unit tests, which mock `fetch`, had pinned the broken value — they now pin `manual` and cover the refused redirect; a shared ESLint rule rejects `redirect: 'error'` workspace-wide.

## [0.8.0] - 2026-08-21

Security audit remediation (docs/audits/2026-08-21-security, FINDING-003 + FINDING-025 with the API-n items of `evidence/review-api-worker.md`). Minor bump: new binding, no intended API contract change — only malformed inputs that used to be accepted leniently are now rejected (API-4, API-13 below).

### Security

- **`/v1/*` per-IP rate limiting now uses the native Workers Rate Limiting binding `API_RATE_LIMITER`** (`[[ratelimits]]`, `simple = { limit = 65, period = 60 }` = the 60 + 5 burst it always advertised) via `CloudflareRateLimiter` from `@xivdyetools/worker-kit` 1.1.0. The KV-backed limiter could not throttle a fast client — KV allows 1 write/s/key and the increment swallowed the resulting 429s, so a single client sending >1 req/s never reached the threshold, and any KV error failed open. KV `RATE_LIMIT` is kept only as the fallback when the binding is absent. `createApiRateLimitMiddleware()` / `selectApiRateLimiter()` are exported for tests; the 429 body is unchanged. (FINDING-003)
- **FINDING-025 / API-2 — `POST /v1/chara/resolve` enforces its 8 KB cap on the stream** (new `src/lib/bounded-body.ts`): the body used to be buffered whole (`Request.text()`) before the size check, so a chunked / HTTP/2 POST with no `Content-Length` could push ~100 MB into the isolate. The reader is now cancelled the moment 8 KB (bytes, not UTF-16 units) is exceeded; `413 INVALID_BODY` as before.
- **API-3 — truncated XIVAPI search pages are not cached**: when the single 500-row search comes back with a `next` cursor or a full page, the request is still answered from the rows that arrived, but its misses are no longer stored as "no item row" for ~8 days (`XivapiClient.searchItems` now returns `truncated`; a warn log notes it).
- **API-4 — `GET /v1/chara/icon/:iconId` accepts the canonical decimal id only** (`/^[1-9]\d{0,5}$/`, otherwise `400 VALIDATION_ERROR`) and keys the edge cache on the canonical path. `041716`, `41716abc`, `41716%20` used to resolve to the same icon under distinct cache keys, each a fresh upstream fetch.
- **API-12 — the icon proxy serves `image/png` or nothing**: the upstream `Content-Type` is never reflected; the body is read with a 1 MB byte budget (`Content-Length` is advisory), must start with the PNG signature (else `503 UPSTREAM_UNAVAILABLE`, not cached), and the response carries `Content-Disposition: inline` + `Content-Security-Policy: sandbox`.
- **API-5 / INF-12 — no stack traces in any HTTP response** (the `stack` field is gone from the 500 envelope in every environment; `development` still returns `err.message`), and the routeless dev worker is off workers.dev: top-level `workers_dev = false` + `preview_urls = false` in `wrangler.toml` (guarded by `tests/wrangler-config.test.ts`). A bare `pnpm deploy` no longer publishes a second, public copy of the Universalis/XIVAPI relay with `ENVIRONMENT=development`; use `pnpm dev` for ad-hoc testing.
- **API-8 — Universalis proxy error bodies are constant**: `message` no longer carries the upstream `statusText` or a raw `Error.message` (`Upstream API error: <status>` + `The upstream API returned an error`; `Failed to fetch from upstream API` + `The upstream request failed; retry later`); both are logged with the request ID instead.
- **API-9 — upstream fetches cannot hang or wander**: `redirect: 'error'` on both the Universalis and the XIVAPI clients, and a 10 s `AbortSignal.timeout` on the Universalis fetch (XIVAPI already had one).
- **API-10 — `developers.xivdyetools.app` responses carry the API's security headers** (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS in production) — the docs host returned `ASSETS.fetch()` before the middleware chain, so it had none.
- **API-13 — input-bound nits**: `/v1/dyes/search?q=` ≤ 100 characters, `/v1/dyes?page=` ≤ 1000, `maxDistance` must be finite (`Infinity` / `1e400` → `400`), and every 4xx/5xx (the envelope, the proxy's bare `{error}`, the 429s) is `Cache-Control: no-store` — a 404 is heuristically cacheable by RFC 9111.

### Changed

- **API-7 — the Universalis proxy's per-IP limiter is charged on cache misses only** (`cachedFetch` gained an `onMiss` hook): a cached answer is free, so a service-binding caller sharing one `unknown` bucket (discord-worker `/budget`) cannot throttle itself on repeats, and invalid requests no longer consume the budget. The budget and the 429 body are unchanged.
- **API-11 — dead / misleading config removed**: `ALLOWED_ORIGINS` (typed and mocked, never read — the proxy is origin-agnostic by design, api-worker's global `cors({ origin: '*' })` is the policy) is gone from `universalis/types.ts` / `test-setup.ts`; `X-API-Key` is no longer advertised in CORS `allowHeaders` (no API-key feature exists); `wrangler.toml` now says that `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` govern only the proxy's limiter (the `/v1` limit is the binding).
- Docs: `reference/chara.md` (canonical icon id, pinned PNG, streamed 8 KB cap) and `reference/universalis.md` (constant error messages, misses-only budget) updated to match.

### Deploy notes

- `[[ratelimits]]` bindings need no resource creation — they deploy with the worker (`namespace_id` 1001 prod / 1002 dev; see `docs/developer-guides/environment-variables.md`).
- The top-level (dev) worker stops answering on `*.workers.dev` at its next deploy (API-5) — intentional; production is unaffected (custom domains only).

## [0.7.0] - 2026-08-20

### Added

- **`POST /v1/chara/resolve`** — equipment-model resolution for the web app's `.chara` import (Swatch Matcher 11a/11c "Dyes on this glamour", pulled forward from 5.1 into 5.0). Body: `{ gear: [{ slot, set?, base, variant }], glasses? }` — the twelve packed model lanes and nothing else from the file. Answer per requested slot: the lowest-row_id Item on that (slot, `ModelMain`) key, `names` in en/ja/de/fr (from XIVAPI v2, U+00AD stripped) plus ko/zh when the build-time tables know the item, `iconId`, `familySize` and up to 8 `alternates` (same-mesh families — Augmented / Replica / +1 / role variants; prefixes are never stripped), `viaMainHand` on OffHand when the off-hand key is the main weapon's own `ModelSub` (quiver / focus / fist pair) or the main key itself. `null` = no Item row (NPC / prop model) — not an error. Optional `glasses` resolves the Glasses sheet row (facewear). Rules per `docs/research/chara-equipment-resolution` (273/273 gear keys, 41/41 weapons on the corpus).
  - One upstream XIVAPI search per request at most (nested required groups, slot column as the mandatory second key); every (slot, key) is edge-cached ~7 d + 1 d SWR under a cache name of its own (`chara-resolve`), namespaced by the game-version pin — twenty users importing the same glamour is one upstream call. Empty answers are cached too. `X-Cache: HIT` = no upstream call. The POST envelope is `no-store`.
  - `503 UPSTREAM_UNAVAILABLE` (`details.upstreamStatus`) when XIVAPI is down, times out (10 s), or is re-indexing search after a patch — the client falls back to slot-only rows; dyes never depend on this call.
  - Validation is loud about the field: `400 VALIDATION_ERROR` for a bad slot / lane outside 0–65535 / duplicate slot / empty piece / bad `glasses` / >12 entries; `400 INVALID_BODY` for non-JSON; `413` over 8 KB.
- **`GET /v1/chara/icon/:iconId`** — the item icon PNG (`_hr1`, 80 px) proxied from XIVAPI's `/api/asset`, edge-cached under `caches.default` with `Cache-Control: public, max-age=2592000, immutable`; `404 NOT_FOUND` / `503 UPSTREAM_UNAVAILABLE` pass-through; 1 MB ceiling.
- **`scripts/build-item-names.mjs`** + `src/chara/data/item-names.{ko,zh}.json` — build-time Korean/Chinese equipment-name tables (28 986 ko / 28 992 zh of 28 993 equippable rows, ~200 KB gz each) from Teamcraft's `ko-items.json` / `zh-items.json`, filtered to equippable rows via `Item.csv` (`EquipSlotCategory ≠ 0`, local ffxiv-datamining clone or GitHub raw). Run by hand after a patch and commit; the worker never fetches GitHub at request time. `item-names.meta.json` records the build.
- New env vars (both envs): `XIVAPI_BASE` (`https://v2.xivapi.com`), `XIVAPI_VERSION` (`latest` — pin to a `/api/version` key to freeze; also the cache namespace), optional `XIVAPI_SCHEMA` (`exdschema@2:rev:<sha>`). New `ErrorCode`s `INVALID_BODY`, `UPSTREAM_UNAVAILABLE`.
- Docs: `docs/reference/chara.md` + sidebar/index entries.

### Changed

- CORS `allowMethods` gains `POST` (only `/v1/chara/resolve` accepts it; still anonymous, still `origin: *`).
- `CacheService` takes an optional third `cacheName` constructor argument (default `'universalis-proxy'`, unchanged for the proxy) so the chara row cache lives in its own Cache API store.

## [0.6.0] - 2026-08-16

Monorepo 2.0 / 5.0 release train (branch `monorepo-2.0-prep`, 2026-07-30 → 2026-08-16). Nothing below has shipped until the branch merges. Two whole apps absorbed, three new production domains, schema v2 serving and the 5.0 matching vocabulary — a minor bump on the 0.x line (a later 1.0.0 can mark the moment the public API is declared stable). The ⚠️ BREAKING block lists the response-changing items for a `/v1` client.

### ⚠️ BREAKING (public `/v1` API)

- **Schema v2 (core 3.0 → 4.0): Facewear colors are no longer dyes.** `GET /v1/dyes` returns **125** entries (was 136 — the 11 Facewear rows are gone; `limit` on `/v1/match/within-distance` is capped at 125 accordingly). Negative "synthetic" Facewear IDs on `GET /v1/dyes/:id` now return an explanatory `404` (`NOT_FOUND`) whose message names the Facewear color and whose `details` carry the new string slug `facewearId` and `hex` — resolved through the frozen `LEGACY_FACEWEAR_ITEM_IDS` map, so old links degrade with a pointer rather than a bare 404. The `stainID` window in `resolveIdType()` widens from `1–125` to the full Stain-sheet byte range **`1–254`** so future dyes resolve without an API change; the "unassigned range" hint is now `255–5728`.
- **5.0 matching vocabulary on `?method=`** (`VALID_MATCHING_METHODS`): `ciede2000` (new **default**, was `oklab`), `oklab`, `cie76`, `redmean` (new), `rgb`, `distinguish` (new). The retired v4 values `hyab` and `oklch-weighted` are still accepted at the boundary but **normalised to `ciede2000`** via core's `LEGACY_MATCHING_METHOD_MAP` (`euclidean` → `rgb`) instead of erroring, so existing clients keep working — but a request that omits `method`, or sends a retired one, now gets ΔE2000 numbers where it previously got OKLab / HyAB / weighted-OKLCh ones. The `kL` / `kC` / `kH` weight parameters on `/v1/match/closest` and `/v1/match/within-distance` are no longer read (silently ignored). Distances come from the single shared dispatch `ColorService.getDistanceForMethod()` in core.

### Deploy window (operator steps — manual, see `DEPRECATIONS.md`)

Production `wrangler.toml` now claims **four** custom domains: `data.xivdyetools.app`, `proxy.xivdyetools.app`, `proxy.xivdyetools.projectgalatine.com`, `developers.xivdyetools.app`. Deploy fails or steals nothing until the old owners release them, so **before** the first `deploy --env production` from this branch:

1. Remove `proxy.xivdyetools.app` and `proxy.xivdyetools.projectgalatine.com` from the old `xivdyetools-universalis-proxy` worker (or delete the worker).
2. Remove `developers.xivdyetools.app` from the old `xivdyetools-api-docs` Pages project.
3. Deploy api-worker (`pnpm --filter xivdyetools-api-worker run build:docs` first if deploying by hand — CI does it; the production env serves `docs/.vitepress/dist` as static assets).
4. Smoke-test `https://proxy.xivdyetools.app/api/v2/data-centers`, `https://data.xivdyetools.app/universalis/data-centers`, `https://developers.xivdyetools.app/`, `https://data.xivdyetools.app/health`.
5. Then deploy web-app (its production fallback already points at `data.xivdyetools.app/universalis`) and discord-worker (`UNIVERSALIS_PROXY` service binding retargeted to `xivdyetools-api-worker`; verify `/budget`). Expect a one-time cold Universalis cache (cache keys embed the request origin).
6. Delete the old proxy worker and the old Pages project after the cutover window.

Note: the deployed production worker predates this branch, so `data.xivdyetools.app/universalis/*` currently 404s and the beta web app's market-board calls fail until this ships — deploying api-worker is the only fix (do not repoint clients at the legacy proxy: it reflects `Access-Control-Allow-Origin: https://xivdyetools.app` to every caller).

### Added

- **Universalis market-board proxy absorbed from `apps/universalis-proxy`** (Monorepo 2.0 Tier 2; `src/universalis/`, code moved verbatim with its Cache-API caching, stale-while-revalidate, request coalescing and per-isolate memory rate limiter). Mounted twice in `src/index.ts`: **`/universalis/*`** (canonical, on `data.xivdyetools.app`) and **`/api/v2/*`** (compatibility mount preserving the exact path shape used by already-deployed web-app bundles via the `proxy.xivdyetools.app` domain and by discord-worker's `UNIVERSALIS_PROXY` service binding). Routes: `GET <mount>/aggregated/:datacenter/:itemIds` (per-IP rate-limited via `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` — 30/60 s in production, 60/60 s in dev — validated against the datacenter/world lists, cached 300 s + 120 s SWR, coalesced), `GET <mount>/data-centers`, `GET <mount>/worlds`. Responses are deliberately **not** wrapped in the `{success,data,meta}` envelope and the router is mounted outside `/v1/*` (no KV rate limiter, no locale middleware). CORS is the worker's global `cors({ origin: '*' })` — strictly more permissive than the proxy's allowlist, and the reason it can serve the beta host. New vars `UNIVERSALIS_API_BASE`, `RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW_SECONDS` in both environments.
- **API docs absorbed from `apps/api-docs`** (Tier 2): the VitePress site lives in `apps/api-worker/docs/` (`docs:dev` / `build:docs` / `docs:preview` scripts; `vitepress` + `vue` devDependencies) and ships as **Workers Static Assets** in the production env only (`[env.production.assets]`: `directory = "./docs/.vitepress/dist"`, `binding = "ASSETS"`, `run_worker_first = true`, `not_found_handling = "404-page"`). A host check at the top of the middleware chain routes requests whose hostname is `developers.xivdyetools.app` to `ASSETS` before any API middleware (no rate limiting / locale / API headers), and — because asset matching is path-based, not host-based — keeps docs pages from shadowing API paths on `data.*`. The docs now deploy atomically with the API they document; `docs/reference/dyes.md` and `guide/index.md` are updated for schema v2 (125 dyes, `1–254` stainIDs, negative-ID 404).
- **`.github/workflows/deploy-api-worker.yml`** — api-worker was live on `data.xivdyetools.app` with **no deploy workflow**. The new one triggers on `apps/api-worker/**` and `packages/{core,types,logger,worker-kit}/**` (or `workflow_dispatch`), builds deps, type-checks, tests, builds the docs, deploys with `--env production`, and smoke-tests both `/health` and the docs site. `deploy-universalis-proxy.yml` and `deploy-api-docs.yml` are deleted.

### Changed

- **Error strings tell the truth** — `/v1/dyes/stain/:stainId` validation `expected` now reads `positive integer (1-254)` (was `1-125`, contradicting the accepted window); the 429 body no longer promises "Register for an API key to get 300 requests per minute" (no API keys exist) — it now says `Rate limit exceeded. 60 requests per minute allowed. Retry after the indicated number of seconds.` (docs `guide/errors.md` + `guide/rate-limits.md` updated to match)
- Migrated from `@xivdyetools/worker-middleware` + `@xivdyetools/rate-limiter` to `@xivdyetools/worker-kit` (`/rate-limiter` subpath) — Tier 1 package consolidation, no behaviour change.
- Consumes `@xivdyetools/core` schema v2 (stainID-keyed `dyes.json`, `facewearColors` split out, `getFacewearColorByLegacyItemID`) and the 5.0 `DEFAULT_MATCHING_METHOD` / `LEGACY_MATCHING_METHOD_MAP` exports; `calculateDistance()` in `src/lib/services.ts` no longer takes weights.
- Dependencies: `hono` floor raised to `^4.12.34` (2026-08-09 security advisories); `wrangler` `^4.114.0 → ^4.120.0` (miniflare 5 / undici 7.29); `license: MIT` declared. Accepted and recorded (FINDING-004): `vitepress@1.6.4` pins `vite ^5.4` / `esbuild 0.21` with no patched release — revisit when VitePress 2 ships stable.
- Docs: `README.md` and `CLAUDE.md` synced (absorbed apps, schema v2, worker-kit, dev-vs-production deploy).

### Removed (2026-08-18 dead-code audit)

- **Unused direct `@xivdyetools/logger` dependency declaration** dropped from `package.json` — the worker's logging goes through `@xivdyetools/worker-kit`'s logger middleware, which already depends on `@xivdyetools/logger` itself; nothing in this app imports it directly.

### Tests

- Coverage thresholds raised to 90 % lines/functions/statements (branches 80 %); `src/**/*.test.ts` (the moved universalis suites: `router`, `cache-service`, `cached-fetch`, `request-coalescer`, `config/cache`) now included; `src/**/test-setup.ts` excluded from coverage (counting the scaffolding as product code understated function coverage by ~8 points); new `tests/lib/validation.branches.test.ts`; match/validation tests updated for the 5.0 vocabulary and the schema v2 ID window.

## [0.5.0] - 2026-07-19

2026-07-18 audit remediation (Sprint 4).

### Fixed

- Route, middleware, and validation fixes from the Sprint 4 batch (see `docs/audits/2026-07-18/` finding Status sections); consumes `@xivdyetools/core` 2.7.0 with the exact perceptual-search fix so `/v1` match results are correct at radius boundaries.

## [0.4.0] - 2026-04-29

### Removed

- **`?alliedSociety=` query parameter** on `/v1/dyes` and `/v1/match` filter inputs, plus the `alliedSociety?: boolean` field on `DyeQueryFilters`. The Allied Society dye category was collapsed out of `colors_xiv.json` by the Patch 7.5 dye consolidation; the filter was already a no-op against current data. Requests that still send `?alliedSociety=true` simply ignore the parameter going forward (no error, just no-op). Co-removed with `@xivdyetools/types@1.14.0` and `@xivdyetools/core@2.6.0`.

### Added

- **OPT-001** (2026-04-28 audit): New `localeMiddleware` at [`src/middleware/locale.ts`](src/middleware/locale.ts) reads `?locale=` once per request, validates via `parseLocale`, calls `LocalizationService.setLocale(locale)`, and stores the resolved code at `c.var.locale`. Wired into the global chain on `/v1/*`. Eliminates the 7 ad-hoc `await LocalizationService.setLocale(locale)` calls that previously appeared inside route handlers (5 in `routes/dyes.ts`, 2 in `routes/match.ts`) — a single-call-per-request pattern that's cleaner DRY and prevents any new localized route from forgetting to set the locale.

### Changed

- **BUG-001** (2026-04-28 audit): Replaced bare `console.error` in the global error handler with the structured logger from `@xivdyetools/worker-middleware`; added `loggerMiddleware` to the global middleware chain so all unhandled errors carry request ID, service name, and JSON structure.
- **ARCH-001** (2026-04-28 audit): Reduced CORS `maxAge` from `86400` (24 h) to `3600` (1 h) to match the `presets-api` / `oauth` precedent and tighten the cache window for an evolving public API.
- **BUG-004** (2026-04-28 audit): Dropped the module-scope `kvLimiter` singleton in `middleware/rate-limit.ts`; `KVRateLimiter` is now constructed per-request inside the `backend` factory (matches the `presets-api` / `oauth` pattern). Construction is cheap (no I/O), and removing the singleton avoids silently binding to whichever KV namespace was used first if api-worker ever adds a second tier.

---

## [0.3.0] - 2026-04-07

### Added

- **OPT-001**: Pending-promise deduplication on `GET /api/v1/categories` — concurrent CDN cache misses now share a single in-flight D1 query instead of each spawning a separate one (thundering herd prevention)
- Extended test coverage: `calculateDistance` branches, sort variants, locale handling, security headers, error handler paths
- New `tests/lib/services.test.ts` for distance calculation branches
- New `tests/utils/api-response.test.ts` for all response helper functions

### Changed

- Migrated rate-limit, request-ID, and logger middleware to `@xivdyetools/worker-middleware`; deleted local middleware files
- **ARCH-001**: Removed `nodejs_compat` compatibility flag from `wrangler.toml`
- **BUG-001**: Re-enabled strict TypeScript checks; cleaned up unused variables and implicit returns
- **REFACTOR-010**: Extracted category cache TTL values to named constants (`CATEGORY_CDN_TTL`, `CATEGORY_BROWSER_TTL`, `CATEGORY_SWR_TTL`) in `categories.ts`

---

## [0.2.0] - 2026-04-03

### Added

- `DyeQueryFilters` interface and `parseDyeFilters()` for parsing dye filter query parameters
- Dye type filtering on `GET /v1/dyes` endpoint via boolean query parameters
- Filter exclusion support on `/closest` and `/within-distance` match endpoints
- `applyDyeFilters()`, `buildFilterExcludeIds()`, `hasActiveDyeFilters()`, `dyeMatchesFilters()` utility functions
- 11 unit tests for filter functionality

---

## [0.1.0] - 2026-04-01

### Added

- Initial release — public REST API for XIV Dye Tools dye database and color matching
