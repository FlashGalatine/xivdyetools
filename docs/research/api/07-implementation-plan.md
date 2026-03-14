# 07 — Implementation Plan

## 5-Phase Rollout

Each phase builds on the previous and delivers a usable increment.

---

## Phase 1 — MVP: Dye Database & Matching

**Goal:** Ship the most-requested functionality: dye lookup and color matching.

### Deliverables

1. **Create `apps/api-worker/`** — New Cloudflare Worker project
   - Hono framework + TypeScript
   - Standard middleware stack: CORS (`*`), request ID, structured logging, error handler
   - `wrangler.toml` with KV binding for rate limiting

2. **Dye endpoints:**
   - `GET /v1/dyes` — List/filter/sort all dyes (includes `consolidationType`, `isIshgardian`, `marketItemID` fields)
   - `GET /v1/dyes/:id` — Single dye lookup
   - `GET /v1/dyes/search` — Name search
   - `GET /v1/dyes/categories` — Category list
   - `GET /v1/dyes/batch` — Multi-ID lookup
   - `GET /v1/dyes/consolidation-groups` — Patch 7.5 consolidation group metadata

3. **Matching endpoints:**
   - `GET /v1/match/closest` — Find closest dye to hex
   - `GET /v1/match/within-distance` — Range query

4. **Anonymous rate limiting** — 60/min per IP via `@xivdyetools/rate-limiter` KV backend

5. **JSON-only responses** — No XML yet

6. **Deploy** to `api.xivdyetools.com`

### Key Files to Create

```
apps/api-worker/
├── src/
│   ├── index.ts              # Hono app entry, module-scope service init
│   ├── middleware/
│   │   ├── cors.ts           # CORS * middleware
│   │   ├── rate-limit.ts     # Rate limiting middleware
│   │   ├── request-id.ts     # Request ID generation
│   │   ├── locale.ts         # Locale resolution from ?locale= param
│   │   └── error-handler.ts  # Global error handler + 404
│   ├── routes/
│   │   ├── dyes.ts           # /v1/dyes/* routes
│   │   └── match.ts          # /v1/match/* routes
│   ├── lib/
│   │   ├── validation.ts     # Input validation helpers
│   │   ├── api-error.ts      # ApiError class
│   │   └── response.ts       # Response envelope helpers
│   └── types.ts              # Env bindings, context types
├── wrangler.toml
├── tsconfig.json
├── package.json
├── vitest.config.ts
└── README.md
```

### Dependencies

```json
{
  "@xivdyetools/core": "workspace:*",
  "@xivdyetools/types": "workspace:*",
  "@xivdyetools/logger": "workspace:*",
  "@xivdyetools/rate-limiter": "workspace:*",
  "hono": "^4.x"
}
```

### Estimated Effort

Moderate — most logic is already in `@xivdyetools/core`. The work is primarily routing, validation, and response serialization.

---

## Phase 2 — Color Tools

**Goal:** Expose the full `ColorService` — conversion, mixing, simulation, accessibility.

### Deliverables

1. **Color conversion endpoints:**
   - `GET /v1/color/convert` — Convert between 9 color spaces
   - `GET /v1/color/convert/all` — Convert to all spaces at once

2. **Color distance & accessibility:**
   - `GET /v1/color/distance` — Delta-E calculation
   - `GET /v1/color/contrast` — WCAG contrast ratio + AA/AAA compliance

3. **Color mixing:**
   - `GET /v1/color/mix` — Mix two colors (9 methods)
   - `POST /v1/color/mix/multiple` — Mix N colors (spectral)
   - `GET /v1/color/gradient` — Generate gradient steps

4. **Colorblind simulation:**
   - `GET /v1/color/simulate` — Single vision type
   - `GET /v1/color/simulate/all` — All vision types at once

5. **Color manipulation:**
   - `GET /v1/color/adjust` — Brightness/saturation/hue
   - `GET /v1/color/invert`
   - `GET /v1/color/desaturate`

### New Files

```
apps/api-worker/src/routes/
├── color-convert.ts
├── color-distance.ts
├── color-mix.ts
├── color-simulate.ts
└── color-manipulate.ts
```

### Estimated Effort

Light — all endpoints are thin wrappers around `ColorService` static methods. Input validation is the main work.

---

## Phase 3 — Harmony, Character Colors & Presets

**Goal:** Complete the feature set with harmony generation, character color palettes, and curated presets.

### Deliverables

1. **Harmony endpoints (9 types):**
   - `GET /v1/harmony/complementary`
   - `GET /v1/harmony/analogous`
   - `GET /v1/harmony/triadic`
   - `GET /v1/harmony/square`
   - `GET /v1/harmony/tetradic`
   - `GET /v1/harmony/split-complementary`
   - `GET /v1/harmony/monochromatic`
   - `GET /v1/harmony/compound`
   - `GET /v1/harmony/shades`

2. **Character color endpoints:**
   - `GET /v1/character/subraces`
   - `GET /v1/character/colors/:category`
   - `GET /v1/character/colors/:category/:index`
   - `GET /v1/character/match`

3. **Preset endpoints:**
   - `GET /v1/presets`
   - `GET /v1/presets/:id`
   - `GET /v1/presets/categories`
   - `GET /v1/presets/random`

4. **Localization endpoints:**
   - `GET /v1/locales`
   - `GET /v1/locales/:locale/dyes`
   - `GET /v1/locales/:locale/dye/:id`

### New Files

```
apps/api-worker/src/routes/
├── harmony.ts
├── character.ts
├── presets.ts
└── locales.ts
```

### Considerations

- Character color data for race-specific categories (hair, skin) is lazy-loaded. The worker should preload common subraces on first request and cache per-isolate.
- Harmony endpoints share common query params — extract a shared validation helper.

### Estimated Effort

Moderate — harmony has 9 variants but they share the same pattern. Character colors need async handling for race-specific data.

---

## Phase 4 — API Keys, XML & Market Prices

**Goal:** Add the registered tier, XML format support, and market price pass-through.

### Deliverables

1. **API key infrastructure:**
   - D1 database schema for `api_keys` table
   - Key generation endpoint (behind Discord OAuth)
   - Key validation middleware
   - Registered tier rate limiting (300/min)

2. **API key management UI:**
   - Simple registration page at `api.xivdyetools.com/register`
   - Discord OAuth login
   - Key creation form (label + generate)
   - Key listing, rotation, deletion

3. **XML response support:**
   - Content negotiation middleware (`Accept` header + `?format=` param)
   - JSON-to-XML serializer (using `fast-xml-parser` or similar)
   - XML responses for all existing endpoints

4. **Market price pass-through (consolidation-aware):**
   - `GET /v1/prices/:datacenter/:itemIds` — with automatic deduplication of consolidated dye IDs
   - `GET /v1/prices/:datacenter/dyes` — convenience endpoint for all tradeable dyes, returns per-group prices
   - Service Binding to `universalis-proxy`
   - Automatic Facewear dye filtering (negative IDs)
   - Post-Patch 7.5: uses `getMarketItemID(dye)` to map individual dye IDs → consolidated group IDs, reducing Universalis calls from ~105 to ~20

### New Bindings

```toml
# wrangler.toml additions
[[d1_databases]]
binding = "API_KEYS"
database_name = "xivdyetools-api-keys"
database_id = "..."

[[services]]
binding = "UNIVERSALIS_PROXY"
service = "xivdyetools-universalis-proxy"
```

### New Files

```
apps/api-worker/src/
├── middleware/
│   ├── api-key.ts          # API key validation
│   └── format.ts           # Content negotiation (JSON/XML)
├── routes/
│   ├── prices.ts           # Market price pass-through
│   └── register.ts         # API key registration
├── lib/
│   └── xml-serializer.ts   # JSON → XML conversion
└── pages/
    └── register.html       # Simple registration UI
```

### Estimated Effort

Moderate-to-heavy — API key management is new infrastructure. XML serialization requires thorough testing across all response shapes.

---

## Phase 5 — Documentation & Developer Portal

**Goal:** Make the API discoverable and self-documenting.

### Deliverables

1. **OpenAPI 3.1 specification:**
   - Auto-generated from Hono route definitions (using `@hono/zod-openapi` or manual spec)
   - Covers all 40 endpoints with request/response schemas
   - Published at `api.xivdyetools.com/openapi.json`

2. **Interactive documentation:**
   - Embedded Scalar or Swagger UI at `api.xivdyetools.com/docs`
   - Try-it-now functionality with anonymous access
   - Code examples in JavaScript, Python, C#, and cURL

3. **Developer portal:**
   - Landing page at `api.xivdyetools.com`
   - Quick start guide
   - API key management (from Phase 4)
   - Usage analytics dashboard
   - Changelog and migration guides

4. **SDK stubs (optional):**
   - Auto-generated TypeScript client from OpenAPI spec
   - Published as `@xivdyetools/api-client` npm package

### Estimated Effort

Moderate — OpenAPI spec is the core work. UI can use off-the-shelf documentation tools (Scalar is lightweight and modern).

---

## Phase Summary

| Phase | Endpoints | Key Feature | Depends On |
|-------|-----------|-------------|------------|
| 1 | 8 | Dye lookup + color matching + consolidation groups | — |
| 2 | 11 | Color tools (convert, mix, simulate) | Phase 1 |
| 3 | 16 | Harmony + character + presets + locales | Phase 1 |
| 4 | 2 + infrastructure | API keys, XML, consolidation-aware market prices | Phase 1–3 |
| 5 | 0 (docs only) | OpenAPI, interactive docs, portal | Phase 1–4 |

**Phases 2 and 3 can run in parallel** since they are independent endpoint groups that share only the base infrastructure from Phase 1.

---

## Testing Strategy

Each phase includes tests:

1. **Unit tests** — Validate input parsing and response serialization (using Vitest)
2. **Integration tests** — Test full request→response cycle using `@cloudflare/vitest-pool-workers` (same pattern as presets-api and oauth workers)
3. **Contract tests** — Verify response shapes match the OpenAPI spec (Phase 5)
4. **Load tests** — Verify rate limiting behavior under concurrent requests

### Test File Structure

```
apps/api-worker/src/routes/__tests__/
├── dyes.test.ts
├── match.test.ts
├── color-convert.test.ts
├── color-mix.test.ts
├── color-simulate.test.ts
├── harmony.test.ts
├── character.test.ts
├── presets.test.ts
├── locales.test.ts
└── prices.test.ts
```
