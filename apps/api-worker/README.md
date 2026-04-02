# XIV Dye Tools Public API

Public REST API for the FFXIV dye database and color matching. Deployed as a Cloudflare Worker at `data.xivdyetools.app`.

## Phase 1 — Dye Database & Color Matching

9 endpoints wrapping `@xivdyetools/core` with anonymous access, rate limiting, and deterministic caching.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/dyes` | List all dyes with filtering, sorting, and pagination |
| `GET` | `/v1/dyes/:id` | Single dye lookup (auto-detects itemID, stainID, or facewear ID) |
| `GET` | `/v1/dyes/stain/:stainId` | Explicit stainID lookup |
| `GET` | `/v1/dyes/search?q=` | Name search (supports localized names) |
| `GET` | `/v1/dyes/categories` | Category list with counts |
| `GET` | `/v1/dyes/batch?ids=` | Multi-ID lookup (max 50, mixed ID types) |
| `GET` | `/v1/dyes/consolidation-groups` | Patch 7.5 consolidation metadata |
| `GET` | `/v1/match/closest?hex=` | Find closest FFXIV dye to a hex color |
| `GET` | `/v1/match/within-distance?hex=&maxDistance=` | Find all dyes within a color distance threshold |

### Dye ID Auto-Detection

The `/:id` and `/batch` endpoints auto-detect ID type by numeric range:

| Range | Type | Example |
|-------|------|---------|
| `< 0` | Facewear (synthetic) | `-1` |
| `1–125` | stainID | `1` (Snow White) |
| `>= 5729` | itemID | `5729` (Snow White) |
| `126–5728` | Invalid (404) | |

### Filtering & Sorting (GET /v1/dyes)

**Filters:** `category`, `metallic`, `pastel`, `dark`, `cosmic`, `ishgardian` (booleans), `consolidationType` (A/B/C), `excludeIds`, `minPrice`, `maxPrice`

**Sorting:** `sort=name|brightness|saturation|hue|cost` with `order=asc|desc`

**Pagination:** `page` (default 1), `perPage` (default 50, max 200)

### Color Matching

Both match endpoints support 6 distance algorithms via `method` parameter:

`rgb`, `cie76`, `ciede2000`, `oklab` (default), `hyab`, `oklch-weighted`

The `oklch-weighted` method accepts optional weights: `lightnessWeight`, `chromaWeight`, `hueWeight`.

### Response Format

```jsonc
// Success
{ "success": true, "data": { ... }, "meta": { "requestId": "...", "apiVersion": "v1" } }

// Paginated
{ "success": true, "data": [...], "pagination": { "page": 1, "perPage": 50, "total": 136, ... }, "meta": { ... } }

// Error
{ "success": false, "error": "VALIDATION_ERROR", "message": "...", "meta": { ... } }
```

### Localization

All dye endpoints accept `?locale=en|ja|de|fr|ko|zh`. When a non-English locale is specified, the response includes `localizedName` on each dye object.

### Rate Limiting

60 requests per minute per IP, with a burst allowance of 5. Rate limit headers are included on all `/v1/*` responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1712000000
```

### Caching

All dye and match endpoints return `Cache-Control: public, max-age=3600, s-maxage=86400`. Data is deterministic and only changes with game patches.

### CORS

`Access-Control-Allow-Origin: *` — fully open for browser-based consumers.

## Development

```bash
# From monorepo root
pnpm install
pnpm turbo run build --filter=xivdyetools-api-worker

# Dev server (port 8790)
pnpm --filter xivdyetools-api-worker run dev

# Tests
pnpm turbo run test --filter=xivdyetools-api-worker

# Type check
pnpm --filter xivdyetools-api-worker run type-check
```

## Architecture

```
src/
  index.ts                 # Hono app, middleware stack, route mounting
  types.ts                 # Env bindings, Hono context variables
  middleware/
    request-id.ts          # UUID generation, X-Request-ID header
    rate-limit.ts          # KV-backed sliding window rate limiting
  routes/
    dyes.ts                # /v1/dyes/* (7 endpoints)
    match.ts               # /v1/match/* (2 endpoints)
  lib/
    api-error.ts           # ApiError class, error codes
    response.ts            # JSON envelope helpers (success/error/paginated)
    validation.ts          # Hex parsing, ID resolution, parameter validation
    dye-serializer.ts      # Dye -> API response shape
    services.ts            # Module-scope DyeService singleton, distance calculation
tests/
  test-utils.ts            # Mock env factory
  lib/                     # Unit tests for validation, response, serializer
  routes/                  # Integration tests for dye and match endpoints
  middleware/              # Rate limit and request ID tests
```

### Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/core` | Dye database, color algorithms, k-d tree matching |
| `@xivdyetools/types` | Shared TypeScript interfaces |
| `@xivdyetools/logger` | Structured logging |
| `@xivdyetools/rate-limiter` | KV-backed sliding window rate limiter |
| `spectral.js` | Spectral color mixing (transitive dep of core, explicit for pnpm strict isolation) |

### Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `RATE_LIMIT` | KV Namespace | Per-IP rate limit counters |
| `ENVIRONMENT` | Variable | `development` or `production` |
| `API_VERSION` | Variable | Currently `v1` |

## Deployment

```bash
pnpm --filter xivdyetools-api-worker run deploy              # Staging
pnpm --filter xivdyetools-api-worker run deploy:production   # Production
```

Before deploying, update the KV namespace IDs in `wrangler.toml` from `placeholder-*` to real Cloudflare KV namespace IDs.
