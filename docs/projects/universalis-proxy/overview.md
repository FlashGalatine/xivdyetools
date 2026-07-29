# Universalis Proxy Overview

**CORS proxy for the Universalis market-board API with edge caching and request coalescing**

The Universalis Proxy sits between XIV Dye Tools applications and the [Universalis](https://universalis.app/) market data API. It solves CORS for browser callers and absorbs traffic spikes through Cloudflare's Cache API, an in-isolate request coalescer, and stale-while-revalidate semantics.

---

## Quick Facts

| Property | Value |
|----------|-------|
| **Version** | v1.5.0 |
| **Type** | Cloudflare Worker |
| **Framework** | Hono |
| **Storage** | Cloudflare Cache API only — **no KV / D1 / R2 bindings** |
| **Source** | `apps/universalis-proxy/` |
| **Domains** | `proxy.xivdyetools.app`, `proxy.xivdyetools.projectgalatine.com` |

---

## Why This Exists

1. **CORS reliability** — Universalis returns error responses (notably 429s) *without* CORS headers, which breaks browser callers exactly when they most need to read the error. The proxy's CORS middleware runs first and stamps `Access-Control-*` headers onto **every** response — including thrown errors and 404s. `Vary: Origin` is set on all responses (BUG-027) so shared HTTP caches can never replay one allowed origin's `Access-Control-Allow-Origin` to a different origin.
2. **Edge caching + coalescing** — the Cache API plus an in-isolate coalescer absorb spikes and reduce upstream pressure: aggregated price queries cache for 5 minutes, data-center / world lists for 24 hours.

The worker is stateless: caching is purely the Cache API, and rate limiting is a per-isolate `MemoryRateLimiter`. There are no storage bindings of any kind.

---

## API Endpoints

| Route | Purpose |
|-------|---------|
| `GET /` | Service info JSON |
| `GET /health` | Liveness probe |
| `GET /api/v2/aggregated/:datacenter/:itemIds` | Aggregated market prices (itemIds comma-separated, max 100) |
| `GET /api/v2/data-centers` | FFXIV data-center list (proxied, 24 h cache) |
| `GET /api/v2/worlds` | FFXIV world list (proxied, 24 h cache) |

All responses carry an `X-Cache` header: `HIT`, `MISS`, or `HIT-STALE`.

---

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

---

## Key Features

### Cache API with Normalized Keys

Cached entries live in Cloudflare's Cache API under synthetic URL keys. Item IDs are **sorted numerically** before keying, so `[1,2,3]` and `[3,1,2]` hit the same entry; the datacenter is lowercased.

```
aggregated:crystal:5729,5730,5731
```

### Stale-While-Revalidate

Each endpoint config carries a fresh TTL plus an SWR grace window. Entries older than the TTL but inside the window are served immediately (`X-Cache: HIT-STALE`) while a background refresh runs via `ctx.waitUntil`.

| Endpoint | Fresh TTL | SWR window |
|----------|-----------|------------|
| `aggregated` | 300 s (5 min) | 120 s (2 min) |
| `data-centers` / `worlds` | 86 400 s (24 h) | 21 600 s (6 h) |

Stale responses carry `Cache-Control: public, max-age=0, must-revalidate` (BUG-028) so downstream caches don't re-serve already-stale prices for another full TTL; fresh responses advertise `stale-while-revalidate=<swrWindow>`.

### Request Coalescing

`RequestCoalescer` deduplicates concurrent fetches for the same cache key within an isolate — ten browsers asking for the same Crystal aggregate at the same moment produce one upstream request, not ten.

### Defense-in-Depth Validation (aggregated endpoint)

Cheapest checks first:

1. **Rate limit** by client IP via `getClientIp()` — prefers the unspoofable `CF-Connecting-IP` and deliberately ignores `X-Forwarded-For` (BUG-066). 429 responses include `Retry-After`. The in-memory limiter is per-isolate and best-effort; the Cache API + coalescer are the real upstream protection.
2. **Datacenter** against a whitelist of valid FFXIV datacenters/worlds. 400 if unknown.
3. **itemIds** must match `^[\d,]+$`. 400 otherwise.
4. **Count** between 1 and 100 (Universalis's documented max).
5. **Range** — each ID a positive integer ≤ 1,000,000; the first 10 invalid IDs are echoed back.
6. **Upstream errors** map through `UpstreamError` — 429s preserve `Retry-After`; everything else becomes a 4xx/5xx with a generic message.

### Response Size Cap

Upstream responses are capped at **5 MB**, enforced by a *streamed byte budget* (BUG-065) — so chunked responses without a `Content-Length` header cannot bypass the ceiling. Oversized bodies get a dedicated 502.

---

## Configuration

No secrets. All configuration is plain `[vars]` in `wrangler.toml`:

| Variable | Description |
|----------|-------------|
| `ENVIRONMENT` | `"development"` or `"production"` — toggles localhost CORS allowance and verbose error messages |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist (e.g. `https://xivdyetools.app,https://xivdyetools.projectgalatine.com`) |
| `UNIVERSALIS_API_BASE` | Upstream base URL — `https://universalis.app/api/v2` |
| `RATE_LIMIT_REQUESTS` | Per-IP requests per window (production: 30, dev: 60) |
| `RATE_LIMIT_WINDOW_SECONDS` | Sliding-window length in seconds (default 60) |

---

## Quick Start

```bash
# From the monorepo root
pnpm --filter xivdyetools-universalis-proxy run dev     # wrangler dev
pnpm --filter xivdyetools-universalis-proxy run test    # vitest
pnpm turbo run type-check --filter=xivdyetools-universalis-proxy

# Deployment
pnpm --filter xivdyetools-universalis-proxy run deploy             # staging
pnpm --filter xivdyetools-universalis-proxy run deploy:production  # production
```

Smoke test after deploy:

```bash
curl -H "Origin: https://xivdyetools.app" \
  "https://proxy.xivdyetools.app/api/v2/aggregated/Crystal/5808"
# Expect 200 + Access-Control-Allow-Origin + X-Cache header
```

---

## Technology Stack

| Technology | Purpose |
|------------|---------|
| **Cloudflare Workers** | Serverless edge runtime |
| **Hono** | HTTP framework / routing |
| **Cloudflare Cache API** | Edge caching (the only storage) |
| **@xivdyetools/rate-limiter** | `MemoryRateLimiter` per-IP throttling |
| **@xivdyetools/worker-middleware** | Request-ID + structured-logger middleware |
| **Vitest** | Testing |

## Consumers

- **xivdyetools-web-app** — budget / market-board / pricing tools call the proxy from the browser
- **@xivdyetools/core** — `APIService` routes Universalis calls through the proxy URL

---

## Related Documentation

- [Caching Strategy](caching.md) - Caching implementation details
- [Deployment Guide](deployment.md) - Deployment procedures
- [Architecture Overview](../../architecture/overview.md) - How the proxy fits in the ecosystem
- [Data Flow](../../architecture/data-flow.md) - Market price flow diagrams
- `apps/universalis-proxy/CLAUDE.md` - Maintainer-level implementation guide
