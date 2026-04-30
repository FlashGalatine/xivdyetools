# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Cloudflare Worker that proxies a small subset of the [Universalis](https://universalis.app/) FFXIV market-board API. It exists for two reasons:

1. **CORS reliability** — Universalis returns error responses (notably 429s) without CORS headers, breaking browser callers. This proxy stamps `Access-Control-*` headers onto **every** response, including errors.
2. **Edge caching + coalescing** — Cloudflare's Cache API + an in-isolate request coalescer absorb traffic spikes and reduce upstream pressure. Aggregated price queries cache for 5 minutes; data-center / world lists cache for 24 hours.

The Worker only exposes three GET endpoints (`/api/v2/aggregated/:dc/:itemIds`, `/api/v2/data-centers`, `/api/v2/worlds`) plus health checks. It runs without any KV / D1 / R2 bindings — caching is purely Cache API + the in-memory `MemoryRateLimiter` from `@xivdyetools/rate-limiter`.

## Commands

```bash
npm run dev                  # wrangler dev (localhost:8787)
npm run deploy               # Deploy to default (development) env
npm run deploy:production    # Deploy to production env
npm run test                 # vitest run
npm run test:watch           # vitest in watch mode
npm run test:coverage        # vitest with V8 coverage
npm run type-check           # tsc --noEmit
npm run lint                 # eslint src/
```

### Pre-commit Checklist

```bash
npm run lint && npm run test -- --run && npm run type-check
```

## Architecture

```
Browser (web-app) ──► proxy.xivdyetools.app
                          │
                          ▼
       ┌─── requestId + logger middleware ───┐
       │                                     │
       │  CORS middleware (always emits)     │
       │            │                        │
       │            ▼                        │
       │  GET /api/v2/aggregated/:dc/:ids    │
       │   ├─ rate-limit check (per IP)      │
       │   ├─ datacenter whitelist           │
       │   ├─ itemId regex + count + range   │
       │   ├─ normalize cacheKey             │
       │   └─ cachedFetch ──► Cache API hit  │
       │                  └─► coalesce + fetch upstream
       │                                     │
       │  GET /api/v2/data-centers           │
       │  GET /api/v2/worlds                 │
       └─────────────────────────────────────┘
                          │
                          ▼
                  universalis.app/api/v2
```

### Key Directories

```
src/
├── index.ts                       # Hono app, middleware, route definitions, error handlers
├── config/
│   ├── cache.ts                   # CACHE_CONFIGS (TTL + SWR window per endpoint)
│   └── datacenters.ts             # Whitelist of valid FFXIV datacenters/worlds
├── services/
│   ├── cache-service.ts           # Cache API wrapper (synthetic URL keys)
│   ├── cached-fetch.ts            # Orchestrator: lookup → coalesce → upstream → store
│   ├── request-coalescer.ts       # In-flight request dedup keyed by cacheKey
│   └── rate-limiter.ts            # Adapter over @xivdyetools/rate-limiter
├── types/
│   └── cache.ts                   # Env, CacheConfig, CacheResult, CacheSource types
└── index.test.ts                  # Top-level integration test
```

## Environment Bindings

The Worker has **no KV/D1/R2 bindings** — it is stateless aside from the in-isolate rate limiter and Cloudflare's Cache API.

### `[vars]` (wrangler.toml)

| Variable | Description |
|----------|-------------|
| `ENVIRONMENT` | `"development"` or `"production"` (toggles localhost CORS allowance and verbose error messages) |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist (e.g. `https://xivdyetools.app,https://xivdyetools.projectgalatine.com`) |
| `UNIVERSALIS_API_BASE` | Upstream base URL — `https://universalis.app/api/v2` |
| `RATE_LIMIT_REQUESTS` | Per-IP requests allowed per window (production: 30, dev: 60) |
| `RATE_LIMIT_WINDOW_SECONDS` | Sliding window length in seconds (default 60) |

### Routes

```
proxy.xivdyetools.app                   (custom domain)
proxy.xivdyetools.projectgalatine.com   (custom domain)
```

### Required Secrets

None.

## Key Patterns

### Always-On CORS Middleware

The CORS middleware runs first and runs after every handler. Even thrown errors and `app.notFound` responses get `Access-Control-Allow-Origin` set, which is the bug class that motivated the proxy in the first place.

```typescript
app.use('*', async (c, next) => {
  // Compute corsOrigin from ALLOWED_ORIGINS / dev localhost rules
  if (c.req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ... } });
  await next();
  c.header('Access-Control-Allow-Origin', corsOrigin);
});
```

### Cache Key Normalization

Item IDs are sorted numerically before being used in the cache key, so `[1,2,3]` and `[3,1,2]` hit the same cached entry. Datacenter is lowercased.

```typescript
const normalizedIds = normalizeItemIds(itemIds);                            // "1,2,3"
const cacheKey = `aggregated:${datacenter.toLowerCase()}:${normalizedIds}`;
```

### Stale-While-Revalidate

Each `CacheConfig` has both `cacheTtl` (TTL) and `swrWindow` (extra grace period). Once an entry is older than `cacheTtl` but still inside the SWR window, `cachedFetch` returns the stale data immediately and kicks off a background refresh via `ctx.waitUntil`. The response includes a `buildCacheHeaders(...)` block (e.g. `X-Cache: HIT-STALE`) so callers can see what happened.

| Endpoint | TTL | SWR window |
|----------|-----|------------|
| `aggregated` | 300s (5 min) | 120s (2 min) |
| `dataCenters` / `worlds` | 86400s (24 hr) | 21600s (6 hr) |

### Request Coalescing

`RequestCoalescer` deduplicates concurrent fetches for the same `cacheKey` within a single isolate. Ten browsers asking for the same Crystal aggregate at the same moment produce one upstream request, not ten.

### Defense-in-Depth Validation (aggregated endpoint)

Inputs are validated in this order — the cheapest checks first:

1. Rate-limit by `CF-Connecting-IP` (or `X-Forwarded-For` fallback). 429 with `Retry-After`.
2. Datacenter against `isValidDatacenterOrWorld()` whitelist. 400 if unknown.
3. `itemIds` matches `^[\d,]+$`. 400 otherwise.
4. ID count between 1 and 100 (Universalis's documented max). 400 otherwise.
5. Each ID is a positive integer ≤ 1,000,000. 400, with the first 10 invalid IDs echoed back.
6. Upstream errors are converted via `UpstreamError` — 429s preserve `Retry-After`; everything else is mapped to 4xx/5xx with a generic message.

### Response Size Cap

`cached-fetch.ts` enforces a `MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024` ceiling on upstream responses to prevent OOM from a malicious or buggy upstream payload.

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework / routing |
| `@xivdyetools/rate-limiter` | `MemoryRateLimiter` for per-IP throttling |
| `@xivdyetools/worker-middleware` | `requestIdMiddleware`, `loggerMiddleware`, `getLogger` for cross-worker tracing parity |

## Related Projects

**Dependencies:**
- `@xivdyetools/rate-limiter` — sliding-window limiter (Memory backend)
- `@xivdyetools/worker-middleware` — shared Hono middleware

**Consumed by:**
- `xivdyetools-web-app` — the budget / market-board / pricing tools fetch this proxy from the browser
- `@xivdyetools/core` — `APIService` calls Universalis through this proxy URL

## Deployment Checklist

1. Update `ALLOWED_ORIGINS` under `[env.production.vars]` if a new caller host is added.
2. `npm run lint && npm run test -- --run && npm run type-check`
3. `npm run deploy:production`
4. Smoke-test: `curl -H "Origin: https://xivdyetools.app" "https://proxy.xivdyetools.app/api/v2/aggregated/Crystal/5808"` — confirm 200 + CORS headers.
5. Confirm `xivdyetools-core` constants and `web-app` env still point at the proxy URL.

## Testing

Tests live next to the source (`src/**/*.test.ts`) and run under Vitest. The integration suite is `src/index.test.ts`; service-level tests cover `cache-service`, `cached-fetch`, `request-coalescer`, and `config/cache`.

```bash
npx vitest run src/services/cached-fetch.test.ts          # single file
npx vitest run -t "stale-while-revalidate"                # pattern match
```
