# Public API — Endpoint Reference (v1)

Full API reference for the XIV Dye Tools Public API at `data.xivdyetools.app`.

---

## Base URL

```
https://data.xivdyetools.app/v1
```

All dye and matching endpoints are prefixed with `/v1`. Responses use JSON with the envelope format described in [Response Format](#response-format). The [Universalis market-board proxy](#universalis-market-board-proxy) lives outside `/v1` and is not enveloped.

---

## Health

### `GET /health`

Health check endpoint. No envelope, no rate limiting.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-04-02T12:00:00.000Z"
}
```

### `GET /`

Root endpoint with service metadata.

---

## Dyes

### `GET /v1/dyes`

List all dyes with filtering, sorting, and pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (min 1) |
| `perPage` | integer | `50` | Results per page (1–200) |
| `category` | string | — | Filter by exact category name (case-sensitive): `Blues`, `Browns`, `Greens`, `Neutral`, `Purples`, `Reds`, `Special`, `Yellows` |
| `metallic` | boolean | — | Filter metallic dyes (`true`/`false`/`1`/`0`) |
| `pastel` | boolean | — | Filter pastel dyes |
| `dark` | boolean | — | Filter dark dyes |
| `cosmic` | boolean | — | Filter cosmic dyes |
| `ishgardian` | boolean | — | Filter Ishgardian dyes |
| `vendor` | boolean | — | Filter dyes acquired from vendors |
| `craft` | boolean | — | Filter dyes acquired by crafting |
| `expensive` | boolean | — | Filter premium-cost dyes (curated `EXPENSIVE_DYE_IDS`) |
| `consolidationType` | string | — | Filter by consolidation group (`A`, `B`, or `C`) |
| `minPrice` | integer | — | Minimum vendor cost |
| `maxPrice` | integer | — | Maximum vendor cost |
| `excludeIds` | string | — | Comma-separated IDs to exclude (max 50, auto-detects ID type) |
| `sort` | string | — | Sort field: `name`, `brightness`, `saturation`, `hue`, `cost` |
| `order` | string | `asc` | Sort direction: `asc` or `desc` |
| `locale` | string | `en` | Locale for dye names: `en`, `ja`, `de`, `fr`, `ko`, `zh` |

**Example:**

```
GET /v1/dyes?category=Reds&sort=brightness&order=desc&perPage=10
```

**Response:** Paginated envelope (see [Response Format](#response-format)).

---

### `GET /v1/dyes/:id`

Look up a single dye. The ID type is auto-detected by numeric range:

- `< 0` → legacy Facewear synthetic ID → **404** whose `message` names the Facewear color and whose `details` carry its new slug `facewearId` and `hex` (Facewear colors are no longer dyes since schema v2)
- `1–254` → stainID (125 assigned today; 404 if unassigned)
- `>= 5729` → itemID (the consolidated market IDs `52254`–`52256` are rejected with a 404 pointing at `/v1/dyes/consolidation-groups`)
- `255–5728` → returns 404

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `locale` | string | `en` | Locale for localized name |

**Examples:**

```
GET /v1/dyes/5729        # Snow White by itemID
GET /v1/dyes/1           # Snow White by stainID (auto-detected)
GET /v1/dyes/-1629       # legacy Facewear ID → explanatory 404
```

**Response:**

```json
{
  "success": true,
  "data": {
    "itemID": 5729,
    "stainID": 1,
    "id": 5729,
    "name": "Snow White",
    "hex": "#e4dfd0",
    "rgb": { "r": 228, "g": 223, "b": 208 },
    "hsv": { "h": 45, "s": 8.77, "v": 89.41 },
    "category": "Neutral",
    "acquisition": "Dye Vendor",
    "cost": 216,
    "currency": "Gil",
    "isMetallic": false,
    "isPastel": false,
    "isDark": false,
    "isCosmic": false,
    "isIshgardian": false,
    "consolidationType": "A",
    "marketItemID": 52254
  },
  "meta": { "requestId": "...", "apiVersion": "v1" }
}
```

---

### `GET /v1/dyes/stain/:stainId`

Explicit stainID lookup — bypasses auto-detection.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `locale` | string | `en` | Locale for localized name |

**Example:**

```
GET /v1/dyes/stain/1
```

Returns 400 (`INVALID_STAIN_ID`) if stainId is not a positive integer.

---

### `GET /v1/dyes/search`

Search dyes by name. Supports localized name search when a non-English locale is specified.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | **required** | Search query (case-insensitive substring match) |
| `locale` | string | `en` | Locale for search and response names |

**Examples:**

```
GET /v1/dyes/search?q=snow
GET /v1/dyes/search?q=白&locale=ja
```

**Response:** Array of matching dyes (not paginated).

---

### `GET /v1/dyes/categories`

List all dye categories with their dye counts.

**Example:**

```
GET /v1/dyes/categories
```

**Response:**

```json
{
  "success": true,
  "data": [
    { "name": "Blues", "count": 20 },
    { "name": "Browns", "count": 19 },
    { "name": "Neutral", "count": 6 },
    ...
  ],
  "meta": { ... }
}
```

---

### `GET /v1/dyes/batch`

Look up multiple dyes by ID in a single request. Supports mixed ID types.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ids` | string | **required** | Comma-separated IDs (max 50) |
| `idType` | string | `auto` | `auto` (range-based detection), `item`, or `stain` |
| `locale` | string | `en` | Locale for localized names |

**Examples:**

```
GET /v1/dyes/batch?ids=5729,1,999999
GET /v1/dyes/batch?ids=1,2,3&idType=stain
```

**Response:**

```json
{
  "success": true,
  "data": {
    "dyes": [ ... ],
    "notFound": [999999]
  },
  "meta": { ... }
}
```

---

### `GET /v1/dyes/consolidation-groups`

Returns Patch 7.5 dye consolidation metadata — which dyes belong to groups A, B, and C, and whether consolidation is currently active.

**Response:**

```json
{
  "success": true,
  "data": {
    "consolidationActive": true,
    "groups": [
      {
        "type": "A",
        "consolidatedItemID": 52254,
        "dyeCount": 85,
        "dyes": [{ "itemID": 5729, "stainID": 1, "name": "Snow White" }, ...]
      },
      { "type": "B", ... },
      { "type": "C", ... }
    ],
    "unconsolidated": {
      "count": 20,
      "dyes": [...]
    }
  },
  "meta": { ... }
}
```

---

## Color Matching

### `GET /v1/match/closest`

Find the single closest FFXIV dye to a given hex color.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hex` | string | **required** | Hex color (`#RRGGBB` or `RRGGBB`) |
| `method` | string | `ciede2000` | Distance algorithm (see below) |
| `excludeIds` | string | — | Comma-separated IDs to exclude (max 50, auto-detects ID type) |
| `locale` | string | `en` | Locale for localized name |
| `metallic` … `expensive` | boolean | — | Same eight type/acquisition filters as `GET /v1/dyes` — narrow the candidate set |

**Distance Methods** (the suite-wide 5.0 vocabulary; `distance` is returned in the method's native unit):

| Method | Tag | Scale | Description |
|--------|-----|-------|-------------|
| `ciede2000` | ΔE2000 | 0–100 | CIEDE2000 delta E (**default** — perceptually uniform, ISO standard) |
| `oklab` | ΔEOK | 0–1 | Euclidean distance in Oklab |
| `cie76` | ΔE76 | 0–100 | CIE76 delta E (Lab space) |
| `redmean` | REDMEAN | 0–~765 | Weighted RGB distance — cheap perceptual approximation |
| `rgb` | RGB DIST | 0–~441.67 | Euclidean distance in RGB space |
| `distinguish` | DISTINGUISH % | 0–100 (integer) | RGB distance rescaled to a percentage — same ranking as `rgb`, ties common |

The retired v4 values `hyab` and `oklch-weighted` are still **accepted** but normalised to `ciede2000` (`euclidean` → `rgb`) via core's `LEGACY_MATCHING_METHOD_MAP`; the response `method` shows what was used. The old `kL`/`kC`/`kH` weight parameters are ignored. Any other value → `400 INVALID_MATCHING_METHOD`.

**Example:**

```
GET /v1/match/closest?hex=FF0000
GET /v1/match/closest?hex=%23FF0000&method=oklab
GET /v1/match/closest?hex=FF6B6B&vendor=true
```

**Response:**

```json
{
  "success": true,
  "data": {
    "dye": {
      "itemID": 5741,
      "stainID": 13,
      "name": "Coral Pink",
      "hex": "#cc6c5e",
      ...
    },
    "distance": 9.568,
    "method": "ciede2000",
    "inputHex": "#FF6B6B"
  },
  "meta": { ... }
}
```

---

### `GET /v1/match/within-distance`

Find all dyes within a color distance threshold.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hex` | string | **required** | Hex color (`#RRGGBB` or `RRGGBB`) |
| `maxDistance` | float | **required** | Maximum distance threshold in the method's native unit (min 0.01) |
| `method` | string | `ciede2000` | Distance algorithm (same vocabulary as `/closest`) |
| `limit` | integer | `20` | Max results (1–125), applied after `excludeIds` and filters |
| `excludeIds` | string | — | Comma-separated IDs to exclude (max 50) |
| `locale` | string | `en` | Locale for localized names |
| `metallic` … `expensive` | boolean | — | Same eight type/acquisition filters as `GET /v1/dyes` |

**Example:**

```
GET /v1/match/within-distance?hex=FF6B6B&maxDistance=15&limit=5
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      { "dye": { "itemID": 5741, "name": "Coral Pink", ... }, "distance": 9.568 },
      { "dye": { "itemID": 5735, "name": "Rose Pink", ... }, "distance": 12.8236 }
    ],
    "inputHex": "#FF6B6B",
    "maxDistance": 15,
    "method": "ciede2000",
    "resultCount": 2
  },
  "meta": { ... }
}
```

Results are sorted by distance (closest first).

---

## Character Equipment (`.chara` import)

Resolves the equipment model keys an Anamnesis / Ktisis / Brio `.chara` file carries (`ModelBase` / `ModelVariant`, weapons `ModelSet`) to in-game items — names in six languages, icon ids, and the family of visually identical alternates on the same mesh. Powers the web app's Swatch Matcher "Dyes on this glamour" (11a/11c). Full reference: [developers.xivdyetools.app/reference/chara](https://developers.xivdyetools.app/reference/chara).

### `POST /v1/chara/resolve`

Body `{ gear: [{ slot, set?, base, variant }], glasses? }` — one entry per **worn** slot (≤ 12, `base` 0 rejected), optional Glasses row. Answer per requested slot: `{ itemId, names { en, ja, de, fr, ko?, zh? }, iconId, familySize, alternates[], viaMainHand }` or `null` (no Item row — NPC / prop model). Lowest row_id names a same-model family; off-hands resolve through the main hand (`viaMainHand: true` when the off-hand key is the weapon's own `ModelSub`). One upstream XIVAPI search at most; each (slot, key) is edge-cached ~7 days (`X-Cache: HIT` = no upstream call). Envelope is `Cache-Control: no-store`. Errors: `400 VALIDATION_ERROR` / `INVALID_BODY`, `413` over 8 KB, `503 UPSTREAM_UNAVAILABLE` while XIVAPI is down or re-indexing after a patch.

### `GET /v1/chara/icon/:iconId`

The item icon PNG (80 px `_hr1`), proxied from XIVAPI and edge-cached (`Cache-Control: public, max-age=2592000, immutable`). `404 NOT_FOUND` / `503 UPSTREAM_UNAVAILABLE`.

---

## Harmony (colour wheels)

Since api-worker 0.14.0 (core 5.2.0, PR #167): the five selectable colour wheels and core's shared harmony selector. Public reference: [developers.xivdyetools.app/reference/harmony](https://developers.xivdyetools.app/reference/harmony). All `GET`, enveloped, cached `public, max-age=3600, s-maxage=86400`.

### `GET /v1/wheels`

The five wheels in core's display order: `[{ id, tag, name, isDefault }]` — ids `rgb` (default), `ryb`, `munsell`, `oklch-hue`, `oklch-lightness`; `tag` is the untranslated card token (`RGB`, `RYB`, `MUNSELL`, `OKLCH·H`, `OKLCH·L`); `name` follows `?locale=`.

### `GET /v1/wheels/:id`

The wheel summary plus `ringStops` (`?stops=` 3–360, default 72 — in-gamut hex, evenly spaced around the wheel) and `dyes[]` = every dye's `{ stainID, itemID, name, localizedName?, hex, wheelHue }` on that wheel. Unknown id → `400 INVALID_COLOR_WHEEL` with `details.expected`.

### `GET /v1/harmony/types`

The ten harmony types — rows of core's `HARMONY_OFFSETS`, kebab-case wire ids (`split-complementary`, `inverted-tetradic`) — as `[{ id, offsets, name }]`.

### `GET /v1/harmony`

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `dye` | id | — | Base dye, itemID or stainID (auto-detected like `/v1/dyes/:id`); `404 NOT_FOUND` if unassigned. Exactly one of `dye` / `hex` |
| `hex` | string | — | Base colour, `#RRGGBB` or `RRGGBB` |
| `type` | enum | `complementary` | Harmony type; unknown → `400 INVALID_HARMONY_TYPE` |
| `wheel` | enum | `rgb` | Colour wheel; unknown → `400 INVALID_COLOR_WHEEL` (refused, never silently `rgb`) |
| `method` | enum | `ciede2000` | ΔE method for the strict ranking (retired names normalised as on `/v1/match/*`) |
| `strict` | boolean | `true` | Rank by ΔE against the ideal colour; `false` ranks by hue angle |
| `companions` | 0–5 | `0` | Runner-up dyes per slot |
| `preventDuplicates` | boolean | `false` | Never choose one dye for two slots |
| `excludeIds`, dye filters, `locale` | | | As on `/v1/dyes` |

Response `data`: `{ base: { hex, dye | null }, harmonyType, harmonyTypeName, wheel: { id, tag, name, isDefault }, method, strict, distanceUnit, baseWheelHue, slots: [{ index, offset, wheelHue, targetHue, targetHex, dye | null, distance | null, companions[] }] }`. `distanceUnit` is the method when `strict`, `degrees` otherwise; the base dye is always excluded from its own slots; a slot whose candidate pool is empty carries `dye: null` / `distance: null` rather than an error.

## Universalis Market-Board Proxy

Absorbed from the retired `apps/universalis-proxy` (Monorepo 2.0 Tier 2). Mounted at **`/universalis/*`** (canonical, on `data.xivdyetools.app`) and **`/api/v2/*`** (compatibility mount — the path shape used by `proxy.xivdyetools.app` / `proxy.xivdyetools.projectgalatine.com` and by discord-worker's `UNIVERSALIS_PROXY` service binding). Deliberately **outside** `/v1`: no `{ success, data, meta }` envelope (responses are raw Universalis bodies), no `?locale=`, no KV rate limiter, no `X-RateLimit-*` headers on success. Errors are a bare `{ "error": "..." }` object with the upstream status code. **Deliberately undocumented on the public docs site** since 2026-09-04 (API Docs Directions 1d): Universalis serves CORS itself, so a third party routing through us gained only our edge cache while spending the shared upstream 429 budget the web-app's Market Board and the bot's `/budget` depend on. The routes stay for our own clients; this section is their reference.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/universalis/aggregated/:datacenter/:itemIds` | Aggregated prices for 1–100 item IDs (each 1–1000000; deduped + sorted for cache keys) on a data center or world (validated against a static list with a live-list fallback). Upstream `?listings=5&entries=5`. Cached 300 s + 120 s stale-while-revalidate, coalesced. Per-IP memory rate limiter: `RATE_LIMIT_REQUESTS`/`RATE_LIMIT_WINDOW_SECONDS` = 30/60 s in production, 60/60 s in dev → `429 { "error": "Rate limit exceeded", "retryAfter" }` + `Retry-After` |
| `GET` | `/universalis/data-centers` | Universalis data-center list, cached 24 h + 6 h SWR, not rate-limited |
| `GET` | `/universalis/worlds` | Universalis world list, cached 24 h + 6 h SWR, not rate-limited |

Cache headers: `Cache-Control: public, max-age=<ttl>, stale-while-revalidate=<swr>` on fresh hits, `public, max-age=0, must-revalidate` on stale (SWR) hits, plus `X-Cache` (`HIT`/`HIT-STALE`/`MISS`), `X-Cache-Source`, `X-Cache-Stale`. Upstream failures: `502 { "error": "Failed to fetch from upstream API" }`, `502 { "error": "Upstream response too large" }` (> 5 MB), upstream `429` → `429 { "error": "Rate limited by upstream API", "retryAfter": 60 }`, other upstream statuses forwarded as `{ "error": "Upstream API error: <status>" }`.

---

## Response Format

### Success Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "apiVersion": "v1"
  }
}
```

`meta.locale` is added only when a non-English `locale` was requested.

### Paginated Envelope

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "perPage": 50,
    "total": 125,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": { ... }
}
```

### Error Envelope

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Parameter \"perPage\" must be <= 200.",
  "details": {
    "parameter": "perPage",
    "received": 500,
    "expected": "<= 200"
  },
  "meta": { ... }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid parameter value or format |
| `MISSING_PARAMETER` | 400 | Required parameter not provided |
| `INVALID_HEX` | 400 | Hex color format invalid |
| `INVALID_MATCHING_METHOD` | 400 | Unknown distance algorithm |
| `INVALID_LOCALE` | 400 | Unsupported locale |
| `INVALID_STAIN_ID` | 400 | Stain ID not a positive integer |
| `NOT_FOUND` | 404 | Dye or route not found |
| `RATE_LIMITED` | 429 | Rate limit exceeded (body carries a top-level `retryAfter` in seconds; `Retry-After` header set) |
| `INVALID_BODY` | 400 / 413 | `POST /v1/chara/resolve` body is not JSON / not an object (400) or over 8 KB (413) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `UPSTREAM_UNAVAILABLE` | 503 | XIVAPI (`/v1/chara/*`) is down, timed out, or re-indexing after a game patch — retry later; `details.upstreamStatus` carries the upstream code |

Validation stops at the first failing parameter — one error per response.

---

## Headers

### Response Headers

| Header | Value | Description |
|--------|-------|-------------|
| `X-Request-ID` | UUID | Unique request identifier for tracing |
| `X-API-Version` | `v1` | Current API version |
| `X-RateLimit-Limit` | `65` | Requests allowed per window (60 + 5 burst) — `/v1/*` only |
| `X-RateLimit-Remaining` | integer | Requests remaining — `/v1/*` only |
| `X-RateLimit-Reset` | Unix timestamp | When the window resets — `/v1/*` only |
| `Cache-Control` | `public, max-age=3600, s-maxage=86400` | On dye/match endpoints (the proxy sets its own — see above) |
| `Access-Control-Allow-Origin` | `*` | Open CORS |

### Request Headers

| Header | Description |
|--------|-------------|
| `X-Request-ID` | Optional — if you send a valid UUID, it will be echoed back; otherwise a new one is generated |

---

## Dye Object Schema

Every dye in the API response includes these fields:

| Field | Type | Description |
|-------|------|-------------|
| `itemID` | integer | Legacy game item ID (always positive; Facewear colors are not dyes since schema v2) |
| `stainID` | integer | Stain table ID (1–254; 125 assigned today) — the canonical dye key |
| `id` | integer | Primary identifier (same as itemID) |
| `name` | string | English dye name |
| `localizedName` | string? | Localized name (only present when `locale` is not `en`) |
| `hex` | string | Hex color value (`#RRGGBB`) |
| `rgb` | object | `{ r, g, b }` values (0–255) |
| `hsv` | object | `{ h, s, v }` — hue (0–360), saturation (0–100), value (0–100) |
| `category` | string | Dye category: `Blues`, `Browns`, `Greens`, `Neutral`, `Purples`, `Reds`, `Special`, `Yellows` |
| `acquisition` | string | How to obtain: `Dye Vendor`, `The Firmament`, `Cosmic Exploration`, `Venture Coffers` |
| `cost` | integer | Vendor price |
| `currency` | string or null | Currency type (e.g., `Gil`, `Cosmocredits`, `Skybuilders Scrips`) |
| `isMetallic` | boolean | Whether the dye has a metallic sheen |
| `isPastel` | boolean | Whether the dye is a pastel shade |
| `isDark` | boolean | Whether the dye is a dark shade |
| `isCosmic` | boolean | Whether the dye is from Cosmic Exploration |
| `isIshgardian` | boolean | Whether the dye is from Ishgardian Restoration |
| `consolidationType` | string or null | Patch 7.5 consolidation group: `A`, `B`, `C`, or `null` |
| `marketItemID` | integer | Item ID for market board lookups — for the 105 consolidated dyes this is one of the shared Patch 7.5 IDs (`52254`/`52255`/`52256`), so it differs from `itemID` |
