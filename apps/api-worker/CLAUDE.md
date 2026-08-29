# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`xivdyetools-api-worker` is the **public REST API** for the XIV Dye Tools ecosystem — Phase 1 surfaces the dye database (125 standard dyes, schema v2) and color-matching algorithms over a Cloudflare Worker on Hono. Deployed to **`data.xivdyetools.app`**. Since Monorepo 2.0 (Tier 2) the same worker also owns the **Universalis market-board proxy** (`/universalis/*`, plus the `/api/v2/*` compatibility mount that backs `proxy.xivdyetools.app` and discord-worker's `UNIVERSALIS_PROXY` service binding — absorbed from the retired `apps/universalis-proxy`) and serves the **VitePress developer docs** on `developers.xivdyetools.app` as Workers Static Assets (absorbed from the retired `apps/api-docs`).

The API is anonymous (no auth, no API key) with permissive CORS so it can be called from browsers, Dalamud plugins, Discord bots, and mobile apps. Sliding-window rate limiting (60 req/min/IP, +5 burst) is enforced via KV on `/v1/*`. Locale resolution is handled once per request by middleware (`ensureLocaleLoaded` — never `setLocale`, which would race across concurrent requests) and handlers pass `c.get('locale')` explicitly to every localization call.

## Commands

```bash
pnpm dev                    # wrangler dev on http://localhost:8790
pnpm deploy                 # Deploy to the DEV worker (xivdyetools-api-worker-dev, no routes, workers_dev=false since FINDING-025 → not reachable; use `pnpm dev`) — NOT staging, NOT production
pnpm deploy:production      # Deploy to env.production (data/proxy/developers domains) — CI does this on merge to main
pnpm docs:dev               # VitePress dev server for docs/
pnpm build:docs             # Build docs/.vitepress/dist (required before a by-hand production deploy)
pnpm test                   # vitest run
pnpm test:watch             # vitest in watch mode
pnpm test:coverage          # vitest run --coverage
pnpm type-check             # tsc --noEmit
pnpm lint                   # eslint src/
```

### Pre-commit Checklist

```bash
pnpm lint && pnpm type-check && pnpm test
```

## Architecture

```
Request
  ├─► Docs host check               (hostname === developers.xivdyetools.app → ASSETS binding, skips everything below; prod only)
  ├─► requestIdMiddleware           (every route — adds X-Request-Id)
  ├─► loggerMiddleware              (structured logger via @xivdyetools/worker-kit)
  ├─► Security headers              (X-Content-Type-Options, X-Frame-Options, HSTS in prod)
  ├─► CORS (origin: *, GET/OPTIONS) (exposes RateLimit + Request-Id headers)
  ├─► rateLimitMiddleware           (only on /v1/*, KV-backed, fail-open)
  ├─► localeMiddleware              (only on /v1/*, ensures locale data is loaded + sets c.var.locale)
  ├─► API version header            (X-API-Version)
  └─► Route handler                 ──► successResponse / paginatedResponse / ApiError
                                        (/universalis/* and /api/v2/* bypass rate-limit + locale and are NOT enveloped)
```

### Key Directories

```
src/
├── index.ts              # Hono app: middleware chain + route mounting + error handlers
├── types.ts              # Env + Hono Variables (requestId, locale)
├── routes/
│   ├── dyes.ts           # 7 dye endpoints (search, categories, batch, consolidation, stain, :id, list)
│   └── match.ts          # 2 color-matching endpoints (closest, within-distance)
├── middleware/
│   ├── rate-limit.ts     # KVRateLimiter wired to shared rateLimitMiddleware factory
│   └── locale.ts         # Reads ?locale=, calls LocalizationService.ensureLocaleLoaded once, sets c.var.locale
├── lib/
│   ├── api-error.ts      # ApiError class + ErrorCode enum
│   ├── response.ts       # successResponse / paginatedResponse / errorResponse / buildPagination
│   ├── services.ts       # Module-scope DyeService singleton + calculateDistance (→ ColorService.getDistanceForMethod)
│   ├── dye-serializer.ts # Dye → API response shape (with optional localizedName / distance)
│   └── validation.ts     # parseHex, parseLocale, parseMatchingMethod, parseDyeFilters, resolveIdType, etc.
├── universalis/          # Market-board proxy absorbed from apps/universalis-proxy (router, cache-service, cached-fetch, coalescer, memory rate limiter)
└── chara/                # .chara equipment resolution: router (POST /resolve, GET /icon/:id), xivapi client (UA, version/schema pin, 503→UpstreamUnavailableError), resolver (pure rules: slot column × ModelMain, lowest row_id, off-hand via main ModelSub), cache (per-key Cache API, own store), regional-names (+ data/item-names.{ko,zh}.json from scripts/build-item-names.mjs)
scripts/build-item-names.mjs  # Regenerates the ko/zh tables after a patch (local ffxiv-datamining clone or GitHub raw + Teamcraft JSON); manual, commit the output
docs/                     # VitePress site → developers.xivdyetools.app (built by `pnpm build:docs`, shipped as Workers Static Assets)
```

### API Endpoints (Phase 1: 9 under `/v1`, plus health + Universalis proxy)

All `GET`. All `/v1` routes cache `Cache-Control: public, max-age=3600, s-maxage=86400`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Health/info JSON (name, version, status, docs URL) |
| GET | `/health` | `{ status: 'ok', timestamp }` |
| GET | `/v1/dyes` | List all dyes — filtering (category, metallic/pastel/dark/cosmic/ishgardian, consolidationType, price, vendor/craft/expensive), sorting (name/brightness/saturation/hue/cost), pagination (page/perPage, max 200) |
| GET | `/v1/dyes/search?q=` | Name search (English or localized via `?locale=`) |
| GET | `/v1/dyes/categories` | List categories with dye counts |
| GET | `/v1/dyes/batch?ids=` | Multi-ID lookup, max 50, mixed types via `idType=auto\|item\|stain` |
| GET | `/v1/dyes/consolidation-groups` | Patch 7.5 consolidation metadata (groups A/B/C + unconsolidated) |
| GET | `/v1/dyes/stain/:stainId` | Explicit stainID lookup (positive integer; 404 if unassigned) |
| GET | `/v1/dyes/:id` | Auto-detect ID type by range: `1–254` stainID, `≥5729` itemID, `255–5728` invalid, `<0` legacy Facewear → 404 (see below); consolidated market IDs 52254–52256 → explanatory 404 |
| GET | `/v1/match/closest?hex=` | Single closest dye (methods: `ciede2000` default, `oklab`, `cie76`, `redmean`, `rgb`, `distinguish`; retired `hyab`/`oklch-weighted` accepted → normalised to `ciede2000`, `euclidean` → `rgb`; `kL`/`kC`/`kH` ignored) |
| GET | `/v1/match/within-distance?hex=&maxDistance=` | All dyes within a distance threshold in the method's unit (`maxDistance` ≥ 0.01, `limit` 1–125 default 20, applied after excludes/filters) |
| POST | `/v1/chara/resolve` | `.chara` equipment-model resolution (web-app Swatch Matcher 11a/11c) — body `{ gear: [{ slot, set?, base, variant }], glasses? }`; per slot: lowest-row_id item, names ×6 (ko/zh from build-time tables), `iconId`, `familySize` + `alternates`, `viaMainHand` off-hand rule; `null` = no Item row. One XIVAPI search max, per-key Cache API (~7 d, `chara-resolve` store, namespaced by `XIVAPI_VERSION`); `503 UPSTREAM_UNAVAILABLE` while XIVAPI re-indexes after a patch. `src/chara/` |
| GET | `/v1/chara/icon/:iconId` | Item icon PNG proxied from XIVAPI `/api/asset` (`_hr1`), edge-cached 30 d immutable |
| POST | `/v1/telemetry` | **Internal, undocumented, may change** — web-app opt-in usage telemetry → Analytics Engine (`ANALYTICS` binding, `xivdyetools_web_analytics` / `_dev`). `text/plain` JSON batch ≤ 25 events / 16 KB; allowlist schema in `src/telemetry/schema.ts` drops anything unknown; `204` always once parsed, `400`/`413` only for non-JSON / oversized. Fixed blob layout documented in `docs/operations/ANALYTICS_QUERIES.md`. Spec: `docs/superpowers/specs/2026-08-29-web-analytics-design.md` |
| GET | `/universalis/aggregated/:dc/:itemIds` | Universalis proxy — cached 300 s + 120 s SWR, coalesced, per-IP memory limiter (`RATE_LIMIT_REQUESTS`/`RATE_LIMIT_WINDOW_SECONDS`: 30/60 prod, 60/60 dev); raw Universalis body, no envelope |
| GET | `/universalis/data-centers`, `/universalis/worlds` | Universalis proxy — cached 24 h + 6 h SWR |
| GET | `/api/v2/*` | Same router as `/universalis/*` — compatibility mount for `proxy.xivdyetools.app` and the discord-worker service binding |

Route registration in `routes/dyes.ts` is order-sensitive: static paths (`/search`, `/categories`, `/batch`, `/consolidation-groups`, `/stain/:stainId`) MUST be registered before `/:id` to avoid Hono matching conflicts.

### Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---|---|---|
| `RATE_LIMIT` | KV Namespace | Sliding-window rate limit counters, key prefix `api:ip:` |
| `ASSETS` | Static Assets (`[env.production.assets]` only) | `docs/.vitepress/dist`, `run_worker_first = true`, `not_found_handling = "404-page"` — served when the request host is `developers.xivdyetools.app` |
| `ENVIRONMENT` | Var | `development` or `production` (gates the HSTS header and whether `err.message` is echoed on unknown errors — a stack is never returned, FINDING-025) |
| `API_VERSION` | Var | Currently `v1`; surfaced in response `meta.apiVersion` and `X-API-Version` |
| `UNIVERSALIS_API_BASE` | Var | `https://universalis.app/api/v2` — upstream for the proxy |
| `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | Var | Proxy's per-IP memory limiter — `30`/`60` in production, `60`/`60` in dev |
| `XIVAPI_BASE` / `XIVAPI_VERSION` / `XIVAPI_SCHEMA` | Var | `/v1/chara/*` upstream (`https://v2.xivapi.com`), the game-version pin (`latest` or a `/api/version` key — ALSO the row-cache namespace; after a patch search 503s on the new key until ingested, so roll forward by hand once a probe answers 200), optional `exdschema@2:rev:<sha>` schema pin |
| `ANALYTICS` | Analytics Engine dataset | `xivdyetools_web_analytics` (prod) / `xivdyetools_web_analytics_dev` (top-level dev); absent → the route accepts and discards |

Routes (production env only): `data.xivdyetools.app`, `proxy.xivdyetools.app`, `proxy.xivdyetools.projectgalatine.com`, `developers.xivdyetools.app` (all custom domains). The top-level env is the routeless `xivdyetools-api-worker-dev` worker. Dev runs on port `8790`. Compatibility date `2024-12-01`. **No `nodejs_compat`** — the worker uses zero Node.js APIs (per ARCH-001 comment in `wrangler.toml`).

### Required Secrets / Optional Secrets

None. The worker is fully public and stateless — no Discord secrets, no JWT keys, no D1.

## Key Patterns

### Response Envelope

Every success response uses `{ success: true, data, meta }`; paginated responses add `pagination`. Every error uses `{ success: false, error: ErrorCode, message, details?, meta }`. `meta` always carries `requestId` + `apiVersion`, and `locale` when ≠ `en`. See `lib/response.ts`.

### ApiError Flow

Validation helpers (`parseHex`, `parseEnumParam`, `parseIntParam`, etc.) and route handlers `throw new ApiError(code, message, statusCode, details)`. The global `app.onError` in `index.ts` catches it and emits the structured envelope. Unknown errors map to `INTERNAL_ERROR` with `500`; in `development` the error message is included — the stack never is (FINDING-025).

### Dye ID Auto-Detection

`resolveIdType(id)` in `lib/validation.ts` partitions the integer space into disjoint ranges:

- `1 ≤ id ≤ 254` → stainID (the full Stain-sheet byte range, so future dyes resolve without an API change; only 125 are assigned today)
- `id ≥ 5729` → itemID (game item database)
- `255 ≤ id ≤ 5728` → `invalid` (the gap)
- `id < 0` → `facewear` — retained **only to emit a helpful 404**

Use `lookupDyeByResolvedId()` to dispatch to the correct `DyeService` method.

**The negative range is a tombstone, not a lookup.** Schema v2 (2026-07-31) moved Facewear colors out of the dye database entirely, so this API no longer serves them as dyes. `routes/dyes.ts` resolves a negative ID through `getFacewearColorByLegacyItemID()` purely to name what the caller *used* to get: the 404 body carries the color's name, its new slug `id`, and its hex, so an old client gets a migration pointer instead of a bare miss. `/v1/dyes/consolidation-groups` still filters `category !== 'Facewear'` from its `unconsolidated` list as a belt-and-braces guard. Don't "fix" these by reviving negative-ID lookups.

### Locale Middleware (OPT-001)

`localeMiddleware` runs once per request on `/v1/*`, parses `?locale=`, calls `await LocalizationService.ensureLocaleLoaded(locale)` (registers the locale data **without** mutating the singleton's current locale — the old per-request `setLocale` raced across concurrent requests, BUG-006), and stashes the typed code at `c.var.locale`. Handlers read `c.get('locale')`, pass it explicitly to `localizedNameFor()`, and gate on `locale !== 'en'` to skip the `getDyeName()` call entirely when English (the canonical name is already on `Dye.name`).

### Rate Limiting

Composes the shared `rateLimitMiddleware` factory from `@xivdyetools/worker-kit` with `KVRateLimiter` (key prefix `api:ip:`, 60 req/60s, +5 burst, fail-open). The KV backend is constructed per-request — see BUG-004 comment in `middleware/rate-limit.ts` for why a module-scope singleton would be wrong.

### Service Singleton

`DyeService` is instantiated once per Worker isolate at module scope (`lib/services.ts`). The k-d tree (~1–2ms build for the 125 dyes) is reused across all requests handled by the isolate. `calculateDistance()` delegates to core's single dispatch `ColorService.getDistanceForMethod(hex1, hex2, method)` because `findClosestDye`/`findDyesWithinDistance` return `Dye[]` without distances — match handlers recompute distance for the response.

### Matching Methods

`parseMatchingMethod()` in `lib/validation.ts` accepts the 5.0 vocabulary `VALID_MATCHING_METHODS` = `ciede2000` (default via core's `DEFAULT_MATCHING_METHOD`) | `oklab` | `cie76` | `redmean` | `rgb` | `distinguish`. Retired v4 values are looked up in core's `LEGACY_MATCHING_METHOD_MAP` first (`hyab` → `ciede2000`, `oklch-weighted` → `ciede2000`, `euclidean` → `rgb`) so old clients keep working; anything else is `INVALID_MATCHING_METHOD`. The `kL`/`kC`/`kH` query params are no longer read.

### Universalis Proxy (`src/universalis/`)

Moved verbatim from `apps/universalis-proxy`. Mounted twice in `index.ts` — `/universalis` (canonical) and `/api/v2` (compat) — deliberately **outside** `/v1/*` so it gets neither the KV rate limiter nor the locale middleware, and its responses are **not** enveloped (core `APIService` and discord-worker's budget pipeline parse raw Universalis shapes). Cache keys embed the request origin, so a domain cutover means one cold cache.

## Dependencies

| Package | Purpose |
|---|---|
| `hono` | HTTP framework + CORS middleware |
| `spectral.js` | Not imported by this worker's own code — declared explicitly because core's blending module needs it and pnpm's strict isolation would otherwise fail to resolve it |
| `@xivdyetools/core` | DyeService, dyeDatabase, ColorService, LocalizationService, DEFAULT_MATCHING_METHOD, LEGACY_MATCHING_METHOD_MAP, getFacewearColorByLegacyItemID |
| `@xivdyetools/types` | `Dye` interface |
| `@xivdyetools/logger` | Structured logger (wired up by `worker-kit`'s `loggerMiddleware`) |
| `@xivdyetools/worker-kit/rate-limiter` | `KVRateLimiter`, `getClientIp` |
| `@xivdyetools/worker-kit` | Shared `requestIdMiddleware`, `loggerMiddleware`, `rateLimitMiddleware` factory |
| `@xivdyetools/test-utils` (dev) | KV mock for vitest |
| `vitepress` + `vue` (dev) | The developer docs site in `docs/` |

## Related Projects

**Dependencies (internal):** `@xivdyetools/core`, `@xivdyetools/types`, `@xivdyetools/logger`, `@xivdyetools/worker-kit/rate-limiter`, `@xivdyetools/worker-kit`.

**Service Bindings:** `api-worker` calls no other worker. It is the **target** of discord-worker's `UNIVERSALIS_PROXY` service binding (`service = "xivdyetools-api-worker"`, hitting `/api/v2/aggregated/...` for `/budget`); everyone else reaches it over HTTPS at `data.xivdyetools.app` (web-app's market-board calls use `data.xivdyetools.app/universalis`).

**Documentation:** `docs/` (in this app) is the VitePress site documenting this worker's public API surface — built by `pnpm run build:docs` and served as Workers Static Assets on developers.xivdyetools.app (absorbed from apps/api-docs). Hub copies live at `docs/projects/api-worker/` and `docs/user-guides/public-api.md` in the monorepo — keep them consistent.

## Deployment Checklist

1. `pnpm lint && pnpm type-check && pnpm test` — must be green.
2. Bump `version` in `package.json` if behavior changed (currently `0.6.0`).
3. Merging to `main` **is** the production deploy: `.github/workflows/deploy-api-worker.yml` builds deps, type-checks, tests, runs `build:docs`, runs `wrangler deploy --env production`, then smoke-tests `data.xivdyetools.app/health` and `developers.xivdyetools.app/`. There is no staging worker — `pnpm deploy` only pushes the routeless `xivdyetools-api-worker-dev` worker, which has `workers_dev = false` (FINDING-025) and is therefore not reachable over `*.workers.dev`; ad-hoc testing is `pnpm dev`.
4. Deploying by hand: `pnpm build:docs && pnpm deploy:production` (the assets directory must exist or the production deploy fails). See `docs/operations/DEPLOY_ENVIRONMENTS.md`.
5. If any new endpoints/parameters were added, update **both** `docs/reference/dyes.md` (or `matching.md` / `universalis.md`) and the `index.md` quick-start examples — the docs site is the public contract.
6. Verify `X-RateLimit-*` headers appear on a `/v1/*` response and `X-Request-Id` is unique per call.
