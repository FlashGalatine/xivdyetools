# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- Migrated from `@xivdyetools/worker-middleware` + `@xivdyetools/rate-limiter` to `@xivdyetools/worker-kit` (`/rate-limiter` subpath) — Tier 1 package consolidation, no behaviour change.
- Consumes `@xivdyetools/core` schema v2 (stainID-keyed `dyes.json`, `facewearColors` split out, `getFacewearColorByLegacyItemID`) and the 5.0 `DEFAULT_MATCHING_METHOD` / `LEGACY_MATCHING_METHOD_MAP` exports; `calculateDistance()` in `src/lib/services.ts` no longer takes weights.
- Dependencies: `hono` floor raised to `^4.12.34` (2026-08-09 security advisories); `wrangler` `^4.114.0 → ^4.120.0` (miniflare 5 / undici 7.29); `license: MIT` declared. Accepted and recorded (FINDING-004): `vitepress@1.6.4` pins `vite ^5.4` / `esbuild 0.21` with no patched release — revisit when VitePress 2 ships stable.
- Docs: `README.md` and `CLAUDE.md` synced (absorbed apps, schema v2, worker-kit, dev-vs-production deploy).

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
