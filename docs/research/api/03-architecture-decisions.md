# 03 — Architecture Decisions

## Decision 1: New Dedicated Worker

**Choice:** Create a new `apps/api-worker/` Cloudflare Worker rather than extending the existing `presets-api`.

**Rationale:**

| Concern | api-worker | presets-api |
|---------|-----------|-------------|
| **Auth model** | API keys (stateless, simple) | JWT + Bot Secret (user identity required) |
| **CORS** | `Access-Control-Allow-Origin: *` | Restricted to frontend URL |
| **Rate limits** | Per-IP / per-API-key, generous | Per-user, conservative |
| **Consumers** | Third-party developers worldwide | Own web app + Discord bot only |
| **Data** | Mostly in-memory (bundled JSON) | D1 database (user-generated content) |
| **Scaling** | Stateless, cache-friendly | Stateful (D1 transactions, voting) |

Mixing public API traffic with the internal presets API would complicate rate limiting, error handling, and security boundaries. Separate workers allow independent scaling, monitoring, and deployment.

**Alternatives considered:**

1. **Extend presets-api with `/public/` prefix** — Rejected: would share rate limit budget, CORS policy, and auth middleware; one bad actor could impact the web app.
2. **API Gateway (Cloudflare API Shield)** — Overkill for current scale; adds operational complexity without proportional benefit.

## Decision 2: Hono Framework

**Choice:** Use Hono as the HTTP framework.

**Rationale:** Every existing worker in the ecosystem uses Hono. Developers familiar with one worker can immediately understand the new one. Hono's middleware system directly supports the features needed: CORS, request ID, rate limiting, content negotiation, error handling.

## Decision 3: Path-Based API Versioning

**Choice:** Version the API via URL path: `/v1/dyes`, `/v1/match/closest`, etc.

**Rationale:**

- **Explicitness** — The version is visible in every request, making it easy to debug and document
- **Cache-friendly** — Cloudflare can cache `/v1/` and `/v2/` responses independently
- **Precedent** — The existing presets-api uses `/api/v1/` path-based versioning

**Version lifecycle:**

- Non-breaking changes (new fields, new endpoints) are added within the current version
- Breaking changes (removed fields, changed semantics) trigger a new version
- Deprecated versions receive 12 months of maintenance before sunset
- Version status communicated via `X-API-Version` and `X-API-Deprecated` response headers

## Decision 4: Bundled Data (No Database)

**Choice:** Bundle `@xivdyetools/core`'s JSON data files directly into the worker at build time — no D1 database needed for the core API.

**Rationale:**

The dye database (`colors_xiv.json`), preset data, and character color data are all static assets that change only when FFXIV patches add new dyes. They are already imported as JSON modules by `@xivdyetools/core`. Bundling them:

- Eliminates database query latency (0ms vs ~5ms for D1)
- Simplifies deployment (no migration scripts)
- Enables edge caching (every Cloudflare PoP has the data in memory)

**Estimated bundle size:**

| Component | Size |
|-----------|------|
| `@xivdyetools/core` (with tree-shaking) | ~200 KiB |
| `@xivdyetools/types` | ~10 KiB |
| Dye database JSON (incl. consolidation fields) | ~55 KiB |
| Consolidation config (`consolidated-ids.ts`) | ~1 KiB |
| Preset data JSON | ~30 KiB |
| Character color data (shared) | ~20 KiB |
| Character color data (race-specific, lazy) | ~2 MiB (loaded on demand via `import()`) |
| Locale JSON files (6 languages) | ~60 KiB |
| Hono + middleware | ~30 KiB |
| **Total (eager)** | **~400 KiB** |
| **Total (all lazy loaded)** | **~2.4 MiB** |

Well under the 10 MiB paid-plan limit. No WASM modules needed (unlike og-worker).

**Patch 7.5 note:** The dye database JSON now includes `consolidationType` and `isIshgardian` fields on every dye. The `consolidated-ids.ts` config file contains the 3 consolidated market item IDs; when all 3 are set (non-null), consolidation is active and `getMarketItemID(dye)` returns the group's consolidated ID instead of the individual `itemID`. This is bundled at build time — updating the consolidated IDs requires rebuilding and redeploying the worker.

**D1 is still used for:** API key storage and usage tracking (see [04-authentication-and-rate-limiting.md](./04-authentication-and-rate-limiting.md)).

## Decision 5: Service Bindings for Pass-Through

**Choice:** Use Cloudflare Service Bindings to delegate market price and community preset queries to existing workers.

```
api-worker ──Service Binding──► universalis-proxy  (market prices)
api-worker ──Service Binding──► presets-api         (community presets, if exposed)
```

**Rationale:**

- **Zero HTTP overhead** — Service Bindings are direct Worker-to-Worker calls, no DNS resolution or TLS handshake
- **No data duplication** — Market data caching stays in universalis-proxy; preset moderation stays in presets-api
- **Independent scaling** — Each worker scales independently based on its own traffic patterns
- **Precedent** — discord-worker and moderation-worker already use Service Bindings to call presets-api

## Decision 6: XML Response Support

**Choice:** Implement XML as a response serializer middleware, not as separate routes.

**Implementation approach:**

```
Request → Hono Router → Handler (returns JSON object) → Format Middleware → Response
                                                              │
                                              ┌───────────────┼───────────────┐
                                              ▼               ▼               ▼
                                     application/json  application/xml    (error)
```

**Content negotiation priority:**

1. `?format=xml` query parameter (highest priority, explicit)
2. `Accept: application/xml` header
3. Default: `application/json`

**XML conversion rules:**

- JSON objects → XML elements
- JSON arrays → Repeated elements with singular names (e.g., `<dyes>` → `<dye>`)
- Numeric values → Text content with type attribute
- Root element: `<response>` with `success` attribute
- Use a lightweight JSON-to-XML serializer (e.g., `fast-xml-parser` — ~15 KiB)

## Decision 7: Isolate-Level Service Initialization

**Choice:** Initialize `DyeService`, `ColorService`, `CharacterColorService`, `PresetService`, and `LocalizationService` once per Worker isolate in module scope.

**Rationale:**

Cloudflare Workers reuse isolates across requests. Initializing services at module load time means:

- The k-d tree is built once, not per-request
- Locale data is loaded once and shared across requests
- Character color data can be preloaded for common subraces
- Subsequent requests pay only handler + serialization cost

```typescript
// Module-level initialization (runs once per isolate)
const dyeService = new DyeService();
const colorService = ColorService; // Static methods, no instantiation needed
const presetService = new PresetService();
const characterColorService = new CharacterColorService();

// Per-request: locale is set based on query parameter
export default {
  async fetch(request: Request, env: Env) {
    // Hono handles routing, middleware, response formatting
  }
};
```

## Architecture Diagram

```
                          ┌──────────────────────────────────────┐
                          │        api.xivdyetools.com           │
                          │           (api-worker)               │
                          │                                      │
                          │  ┌─────────────────────────────────┐ │
                          │  │ Module Scope (per-isolate)      │ │
                          │  │  • DyeService (k-d tree built)  │ │
                          │  │  • PresetService                │ │
                          │  │  • CharacterColorService        │ │
                          │  │  • LocalizationService          │ │
                          │  └─────────────────────────────────┘ │
                          │                                      │
                          │  ┌─────────────────────────────────┐ │
                          │  │ Hono Middleware Stack            │ │
                          │  │  1. CORS (*)                    │ │
                          │  │  2. Request ID                  │ │
                          │  │  3. Rate Limiting (KV)          │ │
                          │  │  4. API Key Validation (D1)     │ │
                          │  │  5. Locale Resolution           │ │
                          │  │  6. Response Format (JSON/XML)  │ │
                          │  │  7. Error Handler               │ │
                          │  └─────────────────────────────────┘ │
                          │                                      │
                          │  ┌─────────────────────────────────┐ │
                          │  │ Route Groups                    │ │
                          │  │  /v1/dyes/*                     │ │
                          │  │  /v1/match/*                    │ │
                          │  │  /v1/harmony/*                  │ │
                          │  │  /v1/color/*                    │ │
                          │  │  /v1/character/*                │ │
                          │  │  /v1/presets/*                  │ │
                          │  │  /v1/locales/*                  │ │
                          │  │  /v1/prices/*                   │ │
                          │  └───────┬──────────────┬──────────┘ │
                          └──────────┼──────────────┼────────────┘
                                     │              │
                            Service Binding   Service Binding
                                     │              │
                                     ▼              ▼
                          ┌──────────────┐  ┌──────────────────┐
                          │  presets-api  │  │ universalis-proxy │
                          │     (D1)     │  │   (KV cache)     │
                          └──────────────┘  └──────────────────┘
```

## Bindings Summary

| Binding | Type | Purpose |
|---------|------|---------|
| `API_KEYS` | D1 | API key storage and usage tracking |
| `RATE_LIMIT` | KV | Rate limit counters |
| `PRESETS_API` | Service | Community presets pass-through |
| `UNIVERSALIS_PROXY` | Service | Market price pass-through |
| `ANALYTICS` | Analytics Engine | Request analytics |
