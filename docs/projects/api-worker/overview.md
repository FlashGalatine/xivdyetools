# Public API Overview

**xivdyetools-api-worker** - Public REST API for dye database and color matching

---

## What is the Public API?

A Cloudflare Worker deployed at `data.xivdyetools.app` that exposes the XIV Dye Tools dye database and color matching algorithms as a public, anonymous REST API. Designed for third-party consumers: Discord bot authors, Dalamud plugin developers, mobile apps, and data analysts.

---

## Quick Start (Development)

```bash
# From monorepo root
pnpm install
pnpm turbo run build --filter=xivdyetools-api-worker

# Dev server (port 8790)
pnpm --filter xivdyetools-api-worker run dev

# Tests (88 tests across 6 files)
pnpm turbo run test --filter=xivdyetools-api-worker

# Deploy
pnpm --filter xivdyetools-api-worker run deploy:production
```

---

## Architecture

### Request Flow

```
Request → Request ID → Security Headers → CORS → Rate Limit → Route Handler
```

Unlike the presets-api (authenticated, restricted CORS), this API is fully anonymous with `Access-Control-Allow-Origin: *`.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Subdomain | `data.xivdyetools.app` | Separate from `api.xivdyetools.app` (presets-api) due to opposite security postures |
| Auth | Anonymous | Public read-only data, no user state |
| CORS | `origin: *` | Must be callable from any browser, plugin, or bot |
| Rate Limiting | 60 req/min per IP | KV-backed sliding window with burst allowance of 5 |
| Caching | `max-age=3600, s-maxage=86400` | Deterministic data, changes only with game patches |
| Database | Bundled JSON | No D1 — the 136-dye database is part of the bundle via `@xivdyetools/core` |

### Source Structure

```
src/
  index.ts                 # Hono app, middleware stack, route mounting
  types.ts                 # Env bindings (RATE_LIMIT KV, ENVIRONMENT, API_VERSION)
  middleware/
    request-id.ts          # UUID generation, X-Request-ID header
    rate-limit.ts          # KV-backed 60/min per IP, fail-open
  routes/
    dyes.ts                # /v1/dyes/* (7 endpoints)
    match.ts               # /v1/match/* (2 endpoints)
  lib/
    api-error.ts           # ApiError class with typed error codes
    response.ts            # JSON envelope helpers (success/error/paginated)
    validation.ts          # ID resolution, hex parsing, param validation
    dye-serializer.ts      # Dye -> ApiDye (strips internals, adds marketItemID)
    services.ts            # DyeService singleton, distance calculation helper
```

### Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/core` | Dye database, color algorithms, k-d tree, localization |
| `@xivdyetools/types` | Shared TypeScript interfaces (Dye, RGB, etc.) |
| `@xivdyetools/logger` | Structured logging with secret redaction |
| `@xivdyetools/rate-limiter` | KVRateLimiter sliding window implementation |
| `spectral.js` | Spectral color mixing (explicit dep for pnpm strict isolation) |

### Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `RATE_LIMIT` | KV Namespace | Per-IP rate limit counters (60-second TTL) |
| `ENVIRONMENT` | Variable | `development` or `production` |
| `API_VERSION` | Variable | Currently `v1` |

No secrets required. No D1 database. No service bindings.

---

## Dye ID Auto-Detection

A core concept in this API. FFXIV dyes have three disjoint numeric ID ranges:

| Range | Type | Example |
|-------|------|---------|
| `< 0` | Facewear (synthetic negative IDs) | `-1` |
| `1–125` | stainID (game's internal stain table) | `1` = Snow White |
| `>= 5729` | itemID (game item database) | `5729` = Snow White |
| `126–5728` | Invalid (unassigned gap) | Returns 404 |

The `/:id` and `/batch` endpoints auto-detect which type of ID was provided and route to the correct lookup. The `/stain/:stainId` endpoint bypasses auto-detection for explicit stainID lookups.

---

## Phase Roadmap

### Phase 1 (Current) — Dye Database & Color Matching

9 endpoints, anonymous access, bundled data only. See [Endpoint Reference](endpoints.md).

### Phase 2 (Planned) — Presets & Social Features

- Community presets (via Service Binding to presets-api)
- Optional API key authentication for higher rate limits

### Phase 3 (Planned) — Market Data & Advanced

- Real-time Universalis market board prices (via Service Binding to universalis-proxy)
- Color palette generation endpoints

---

## Related Documentation

- [Endpoint Reference](endpoints.md) — Full API reference with examples
- [Public API User Guide](../../user-guides/public-api.md) — Getting started guide for third-party developers
- [Research: API Design](../../research/api/) — Original research documents
- [Presets API](../presets-api/overview.md) — The other API (authenticated, presets data)
