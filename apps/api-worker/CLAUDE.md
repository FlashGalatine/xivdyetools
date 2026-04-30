# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`xivdyetools-api-worker` is the **public REST API** for the XIV Dye Tools ecosystem — Phase 1 surfaces the 136-dye database and color-matching algorithms over a Cloudflare Worker on Hono. Deployed to **`data.xivdyetools.app`**.

The API is anonymous (no auth, no API key) with permissive CORS so it can be called from browsers, Dalamud plugins, Discord bots, and mobile apps. Sliding-window rate limiting (60 req/min/IP, +5 burst) is enforced via KV. Locale resolution is handled once per request by middleware so handlers can call `LocalizationService.getDyeName()` directly without per-call `setLocale()`.

## Commands

```bash
pnpm dev                    # wrangler dev on http://localhost:8790
pnpm deploy                 # Deploy to staging (default env)
pnpm deploy:production      # Deploy to env.production
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
  ├─► requestIdMiddleware           (every route — adds X-Request-Id)
  ├─► loggerMiddleware              (structured logger via @xivdyetools/worker-middleware)
  ├─► Security headers              (X-Content-Type-Options, X-Frame-Options, HSTS in prod)
  ├─► CORS (origin: *, GET/OPTIONS) (exposes RateLimit + Request-Id headers)
  ├─► rateLimitMiddleware           (only on /v1/*, KV-backed, fail-open)
  ├─► localeMiddleware              (only on /v1/*, sets LocalizationService state)
  ├─► API version header            (X-API-Version)
  └─► Route handler                 ──► successResponse / paginatedResponse / ApiError
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
│   └── locale.ts         # Reads ?locale=, calls LocalizationService.setLocale once
└── lib/
    ├── api-error.ts      # ApiError class + ErrorCode enum
    ├── response.ts       # successResponse / paginatedResponse / errorResponse / buildPagination
    ├── services.ts       # Module-scope DyeService singleton + calculateDistance dispatcher
    ├── dye-serializer.ts # Dye → API response shape (with optional localizedName / distance)
    └── validation.ts     # parseHex, parseLocale, parseDyeFilters, resolveIdType, etc.
```

### API Endpoints (Phase 1, 9 total)

All under `/v1`. All `GET`. All cache `Cache-Control: public, max-age=3600, s-maxage=86400`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Health/info JSON (name, version, status, docs URL) |
| GET | `/health` | `{ status: 'ok', timestamp }` |
| GET | `/v1/dyes` | List all dyes — filtering (category, metallic/pastel/dark/cosmic/ishgardian, consolidationType, price, vendor/craft/expensive), sorting (name/brightness/saturation/hue/cost), pagination (page/perPage, max 200) |
| GET | `/v1/dyes/search?q=` | Name search (English or localized via `?locale=`) |
| GET | `/v1/dyes/categories` | List categories with dye counts |
| GET | `/v1/dyes/batch?ids=` | Multi-ID lookup, max 50, mixed types via `idType=auto\|item\|stain` |
| GET | `/v1/dyes/consolidation-groups` | Patch 7.5 consolidation metadata (groups A/B/C + unconsolidated) |
| GET | `/v1/dyes/stain/:stainId` | Explicit stainID lookup (1–125) |
| GET | `/v1/dyes/:id` | Auto-detect ID type by range: `<0` Facewear, `1–125` stainID, `≥5729` itemID, `126–5728` invalid |
| GET | `/v1/match/closest?hex=` | Single closest dye (methods: rgb, cie76, ciede2000, oklab, hyab, oklch-weighted) |
| GET | `/v1/match/within-distance?hex=&maxDistance=` | All dyes within ΔE threshold (limit 1–136, default 20) |

Route registration in `routes/dyes.ts` is order-sensitive: static paths (`/search`, `/categories`, `/batch`, `/consolidation-groups`, `/stain/:stainId`) MUST be registered before `/:id` to avoid Hono matching conflicts.

### Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---|---|---|
| `RATE_LIMIT` | KV Namespace | Sliding-window rate limit counters, key prefix `api:ip:` |
| `ENVIRONMENT` | Var | `development` or `production` (gates HSTS header + verbose error stacks) |
| `API_VERSION` | Var | Currently `v1`; surfaced in response `meta.apiVersion` and `X-API-Version` |

Routes: `data.xivdyetools.app` (custom domain). Dev runs on port `8790`. Compatibility date `2024-12-01`. **No `nodejs_compat`** — the worker uses zero Node.js APIs (per ARCH-001 comment in `wrangler.toml`).

### Required Secrets / Optional Secrets

None. The worker is fully public and stateless — no Discord secrets, no JWT keys, no D1.

## Key Patterns

### Response Envelope

Every success response uses `{ success: true, data, meta }`; paginated responses add `pagination`. Every error uses `{ success: false, error: ErrorCode, message, details?, meta }`. `meta` always carries `requestId` + `apiVersion`, and `locale` when ≠ `en`. See `lib/response.ts`.

### ApiError Flow

Validation helpers (`parseHex`, `parseEnumParam`, `parseIntParam`, etc.) and route handlers `throw new ApiError(code, message, statusCode, details)`. The global `app.onError` in `index.ts` catches it and emits the structured envelope. Unknown errors map to `INTERNAL_ERROR` with `500`; in `development` the stack is included.

### Dye ID Auto-Detection

`resolveIdType(id)` in `lib/validation.ts` partitions the integer space into disjoint ranges:

- `id < 0` → Facewear (synthetic negative IDs from `DyeDatabase.initialize()`)
- `1 ≤ id ≤ 125` → stainID (game stain table)
- `id ≥ 5729` → itemID (game item database)
- `126 ≤ id ≤ 5728` → `invalid` (the gap)

Use `lookupDyeByResolvedId()` to dispatch to the correct `DyeService` method. For Facewear filtering elsewhere, prefer `dye.itemID > 0` over null-checks — `itemID` is **always** a number.

### Locale Middleware (OPT-001)

`localeMiddleware` runs once per request on `/v1/*`, parses `?locale=`, calls `await LocalizationService.setLocale(locale)`, and stashes the typed code at `c.var.locale`. Handlers gate on `locale !== 'en'` to skip the `getDyeName()` call entirely when English (the canonical name is already on `Dye.name`).

### Rate Limiting

Composes the shared `rateLimitMiddleware` factory from `@xivdyetools/worker-middleware` with `KVRateLimiter` (key prefix `api:ip:`, 60 req/60s, +5 burst, fail-open). The KV backend is constructed per-request — see BUG-004 comment in `middleware/rate-limit.ts` for why a module-scope singleton would be wrong.

### Service Singleton

`DyeService` is instantiated once per Worker isolate at module scope (`lib/services.ts`). The k-d tree (~1–2ms build for 136 dyes) is reused across all requests handled by the isolate. `calculateDistance()` dispatches to `ColorConverter` static methods because `findClosestDye`/`findDyesWithinDistance` return `Dye[]` without distances — match handlers recompute distance for the response.

## Dependencies

| Package | Purpose |
|---|---|
| `hono` | HTTP framework + CORS middleware |
| `spectral.js` | (currently unused at handler level — reserved for future spectral mixing endpoints) |
| `@xivdyetools/core` | DyeService, dyeDatabase, ColorConverter, LocalizationService |
| `@xivdyetools/types` | `Dye` interface |
| `@xivdyetools/logger` | Structured logger (consumed via worker-middleware) |
| `@xivdyetools/rate-limiter` | `KVRateLimiter`, `getClientIp` |
| `@xivdyetools/worker-middleware` | Shared `requestIdMiddleware`, `loggerMiddleware`, `rateLimitMiddleware` factory |
| `@xivdyetools/test-utils` (dev) | KV mock for vitest |

## Related Projects

**Dependencies (internal):** `@xivdyetools/core`, `@xivdyetools/types`, `@xivdyetools/logger`, `@xivdyetools/rate-limiter`, `@xivdyetools/worker-middleware`.

**Service Bindings:** None. `api-worker` is standalone and public-facing — it does not call other workers. Other workers do not currently bind to it (clients hit `data.xivdyetools.app` over HTTPS).

**Documentation:** [`apps/api-docs/`](../api-docs/) is the VitePress site documenting this worker's public API surface, deployed to Cloudflare Pages.

## Deployment Checklist

1. `pnpm lint && pnpm type-check && pnpm test` — must be green.
2. Bump `version` in `package.json` if behavior changed.
3. `pnpm deploy` to staging; smoke-test the staging URL.
4. `pnpm deploy:production` to ship to `data.xivdyetools.app`.
5. If any new endpoints/parameters were added, update **both** `apps/api-docs/reference/dyes.md` (or `matching.md`) and the `index.md` quick-start examples — the docs site is the public contract.
6. Verify `X-RateLimit-*` headers appear on a `/v1/*` response and `X-Request-Id` is unique per call.
