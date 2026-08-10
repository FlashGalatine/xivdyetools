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
    rate-limit.ts          # KVRateLimiter wired to worker-kit's rateLimitMiddleware
    locale.ts              # Reads ?locale=, calls LocalizationService.setLocale once
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
| `hono` | HTTP framework + CORS middleware |
| `@xivdyetools/core` | `DyeService`, `dyeDatabase`, `ColorConverter`, `LocalizationService` |
| `@xivdyetools/types` | Shared TypeScript interfaces |
| `@xivdyetools/logger` | Structured logging |
| `@xivdyetools/worker-kit` | `requestIdMiddleware`, `loggerMiddleware`, `rateLimitMiddleware` |
| `@xivdyetools/worker-kit/rate-limiter` | `KVRateLimiter`, `getClientIp` |
| `spectral.js` | Spectral color mixing (transitive dep of core, explicit for pnpm strict isolation) |

### Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `RATE_LIMIT` | KV Namespace | Per-IP rate limit counters |
| `ENVIRONMENT` | Variable | `development` or `production` |
| `API_VERSION` | Variable | Currently `v1` |

## Deployment

```bash
pnpm --filter xivdyetools-api-worker run deploy              # DEV worker (xivdyetools-api-worker-dev, no routes)
pnpm --filter xivdyetools-api-worker run deploy:production   # Production (data.xivdyetools.app)
```

> ⚠️ A bare `wrangler deploy` does **not** mean "staging" across this monorepo — the target depends on each worker's `wrangler.toml`. Production always needs an explicit `--env production`. See [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../docs/operations/DEPLOY_ENVIRONMENTS.md).

Before deploying, update the KV namespace IDs in `wrangler.toml` from `placeholder-*` to real Cloudflare KV namespace IDs.

## Documentation Site

The public API documentation is a VitePress site in [`docs/`](./docs/), deployed with this worker as Workers Static Assets on [developers.xivdyetools.app](https://developers.xivdyetools.app) (absorbed from the former `apps/api-docs`).

```bash
pnpm --filter xivdyetools-api-worker run docs:dev       # Local docs dev server
pnpm --filter xivdyetools-api-worker run build:docs     # Build static docs
```

If you add or change an endpoint or parameter, update **both** `docs/reference/dyes.md` (or `matching.md`) and the `index.md` quick-start examples — the docs site is the public contract.

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
📝 **Blog**: [Project Galatine](https://blog.projectgalatine.com/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X/Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.** All FINAL FANTASY XIV content served by this API, including dye names and color values, is the property of Square Enix.
