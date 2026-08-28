# Public API Overview

**xivdyetools-api-worker** - Public REST API for dye database and color matching

---

## What is the Public API?

A Cloudflare Worker deployed at `data.xivdyetools.app` that exposes the XIV Dye Tools dye database and color matching algorithms as a public, anonymous REST API. Designed for third-party consumers: Discord bot authors, Dalamud plugin developers, mobile apps, and data analysts.

Since Monorepo 2.0 (2026-07-31) the same worker also owns two surfaces absorbed from retired apps:

- the **Universalis market-board proxy** (`/universalis/*` on `data.xivdyetools.app`, plus the `/api/v2/*` compatibility mount that backs `proxy.xivdyetools.app` / `proxy.xivdyetools.projectgalatine.com` and discord-worker's `UNIVERSALIS_PROXY` service binding) — from `apps/universalis-proxy`;
- the **developer documentation site** at `developers.xivdyetools.app` (VitePress in `apps/api-worker/docs/`, shipped as Workers Static Assets in the production env) — from `apps/api-docs`.

---

## Quick Start (Development)

```bash
# From monorepo root
pnpm install
pnpm turbo run build --filter=xivdyetools-api-worker

# Dev server (port 8790)
pnpm --filter xivdyetools-api-worker run dev

# Tests
pnpm turbo run test --filter=xivdyetools-api-worker

# Docs site (VitePress) dev server / build
pnpm --filter xivdyetools-api-worker run docs:dev
pnpm --filter xivdyetools-api-worker run build:docs

# Deploy — bare `deploy` = the routeless xivdyetools-api-worker-dev worker (NOT staging);
# production needs --env production and is normally done by CI (deploy-api-worker.yml) on merge to main.
pnpm --filter xivdyetools-api-worker run deploy               # dev worker
pnpm --filter xivdyetools-api-worker run deploy:production    # production (run build:docs first)
```

---

## Architecture

### Request Flow

```
Request → (developers.* host? → static docs ASSETS) → Request ID → Logger → Security Headers → CORS → Rate Limit (/v1/*) → Locale (/v1/*) → Route Handler
```

`/universalis/*` and `/api/v2/*` sit outside `/v1/*` — no KV rate limiter, no locale middleware, and their responses are raw Universalis bodies rather than the `{ success, data, meta }` envelope.

Unlike the presets-api (authenticated, restricted CORS), this API is fully anonymous with `Access-Control-Allow-Origin: *`.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Subdomain | `data.xivdyetools.app` | Separate from `api.xivdyetools.app` (presets-api) due to opposite security postures |
| Auth | Anonymous | Public read-only data, no user state |
| CORS | `origin: *` | Must be callable from any browser, plugin, or bot |
| Rate Limiting | 60 req/min per IP on `/v1/*` | KV-backed sliding window with burst allowance of 5; the proxy's `/aggregated` route has its own per-isolate memory limiter (30/min in production) |
| Caching | `max-age=3600, s-maxage=86400` | Deterministic data, changes only with game patches |
| Database | Bundled JSON | No D1 — the 125-dye database is part of the bundle via `@xivdyetools/core` |

### Source Structure

```
src/
  index.ts                 # Hono app, middleware stack, route mounting
  types.ts                 # Env bindings (RATE_LIMIT KV, ASSETS, ENVIRONMENT, API_VERSION, UNIVERSALIS_API_BASE, RATE_LIMIT_*)
  middleware/
    rate-limit.ts          # KV-backed 60/min per IP, fail-open (request-id + logger come from @xivdyetools/worker-kit)
    locale.ts              # Reads ?locale=, LocalizationService.ensureLocaleLoaded, sets c.var.locale
  routes/
    dyes.ts                # /v1/dyes/* (7 endpoints)
    match.ts               # /v1/match/* (2 endpoints)
  lib/
    api-error.ts           # ApiError class with typed error codes
    response.ts            # JSON envelope helpers (success/error/paginated)
    validation.ts          # ID resolution, hex parsing, param validation
    dye-serializer.ts      # Dye -> ApiDye (strips internals, adds marketItemID)
    services.ts            # DyeService singleton, distance calculation helper (ColorService.getDistanceForMethod)
  universalis/             # Market-board proxy (moved verbatim from apps/universalis-proxy)
    router.ts              # /aggregated/:dc/:itemIds, /data-centers, /worlds
    config/                # cache TTLs, datacenter/world lists
    services/              # cached-fetch, cache-service, request-coalescer, memory rate-limiter
docs/                      # VitePress developer docs → developers.xivdyetools.app
```

### Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/core` | Dye database, color algorithms, k-d tree, localization |
| `@xivdyetools/types` | Shared TypeScript interfaces (Dye, RGB, etc.) |
| `@xivdyetools/logger` | Structured logging with secret redaction |
| `@xivdyetools/worker-kit` | Hono middleware; `KVRateLimiter` sliding window via the `/rate-limiter` subpath |
| `spectral.js` | Spectral color mixing (explicit dep for pnpm strict isolation) |

### Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `RATE_LIMIT` | KV Namespace | Per-IP rate limit counters (60-second TTL) |
| `ASSETS` | Static Assets (production env only) | `docs/.vitepress/dist`, served when the request host is `developers.xivdyetools.app` |
| `ENVIRONMENT` | Variable | `development` or `production` |
| `API_VERSION` | Variable | Currently `v1` |
| `UNIVERSALIS_API_BASE` | Variable | `https://universalis.app/api/v2` |
| `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | Variable | Proxy limiter — `30`/`60` production, `60`/`60` dev |

No secrets required. No D1 database. api-worker calls no other worker; discord-worker's `UNIVERSALIS_PROXY` service binding targets it (`/api/v2/aggregated/...`).

Production routes (all custom domains): `data.xivdyetools.app`, `proxy.xivdyetools.app`, `proxy.xivdyetools.projectgalatine.com`, `developers.xivdyetools.app`. The top-level (bare `wrangler deploy`) env is the routeless `xivdyetools-api-worker-dev` worker — see [DEPLOY_ENVIRONMENTS.md](../../operations/DEPLOY_ENVIRONMENTS.md).

---

## Dye ID Auto-Detection

A core concept in this API. FFXIV dyes have three disjoint numeric ID ranges:

| Range | Type | Example |
|-------|------|---------|
| `1–254` | stainID (game's internal stain table; 125 assigned today, the rest reserved for future dyes) | `1` = Snow White |
| `>= 5729` | itemID (game item database) | `5729` = Snow White |
| `255–5728` | Invalid (unassigned gap) | Returns 404 |
| `< 0` | Legacy Facewear synthetic ID | Returns **404 with guidance** |

Since **schema v2** (2026-07-31) Facewear colours are not dyes and are no longer served by this
endpoint. A negative ID still routes, but only so the API can return an informative 404 naming
the colour it used to refer to (via `getFacewearColorByLegacyItemID()`) and its `facewearId` and
`hex`, rather than a bare "not found".

The `/:id` and `/batch` endpoints auto-detect which type of ID was provided and route to the correct lookup. The `/stain/:stainId` endpoint bypasses auto-detection for explicit stainID lookups.

---

## Phase Roadmap

### Phase 1 (Current) — Dye Database & Color Matching

9 endpoints, anonymous access, bundled data only. See [Endpoint Reference](endpoints.md).

### Phase 2 (Planned) — Presets & Social Features

- Community presets (via Service Binding to presets-api)
- Optional API key authentication for higher rate limits

### Phase 3 (Planned) — Market Data & Advanced

- Real-time Universalis market board prices exposed on the public `/v1` surface with the standard envelope (the raw proxy is already in-process at `/universalis/*` since the 2026-07-31 merge — see [Endpoint Reference](endpoints.md#universalis-market-board-proxy))
- Color palette generation endpoints

---

## Related Documentation

- [Endpoint Reference](endpoints.md) — Full API reference with examples
- [Public API User Guide](../../user-guides/public-api.md) — Getting started guide for third-party developers
- [Research: API Design](../../research/api/) — Original research documents
- [Presets API](../presets-api/overview.md) — The other API (authenticated, presets data)
