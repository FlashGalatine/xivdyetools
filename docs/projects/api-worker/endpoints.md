# Public API — Endpoint Reference (v1)

Full API reference for the XIV Dye Tools Public API at `data.xivdyetools.app`.

---

## Base URL

```
https://data.xivdyetools.app/v1
```

All endpoints are prefixed with `/v1`. Responses use JSON with the envelope format described in [Response Format](#response-format).

---

## Health

### `GET /health`

Health check endpoint.

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
| `category` | string | — | Filter by category name (e.g., `Red`, `Neutral`, `Facewear`) |
| `metallic` | boolean | — | Filter metallic dyes (`true`/`false`/`1`/`0`) |
| `pastel` | boolean | — | Filter pastel dyes |
| `dark` | boolean | — | Filter dark dyes |
| `cosmic` | boolean | — | Filter cosmic dyes |
| `ishgardian` | boolean | — | Filter Ishgardian dyes |
| `consolidationType` | string | — | Filter by consolidation group (`A`, `B`, or `C`) |
| `minPrice` | integer | — | Minimum vendor cost |
| `maxPrice` | integer | — | Maximum vendor cost |
| `excludeIds` | string | — | Comma-separated IDs to exclude (max 50, auto-detects ID type) |
| `sort` | string | — | Sort field: `name`, `brightness`, `saturation`, `hue`, `cost` |
| `order` | string | `asc` | Sort direction: `asc` or `desc` |
| `locale` | string | `en` | Locale for dye names: `en`, `ja`, `de`, `fr`, `ko`, `zh` |

**Example:**

```
GET /v1/dyes?category=Red&sort=brightness&order=desc&perPage=10
```

**Response:** Paginated envelope (see [Response Format](#response-format)).

---

### `GET /v1/dyes/:id`

Look up a single dye. The ID type is auto-detected by numeric range:

- `< 0` → Facewear (synthetic ID)
- `1–125` → stainID
- `>= 5729` → itemID
- `126–5728` → returns 404

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `locale` | string | `en` | Locale for localized name |

**Examples:**

```
GET /v1/dyes/5729        # Snow White by itemID
GET /v1/dyes/1           # Snow White by stainID (auto-detected)
GET /v1/dyes/-1          # Facewear dye by synthetic ID
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
    "acquisition": "Ixali Vendor",
    "cost": 216,
    "currency": "Gil",
    "isMetallic": false,
    "isPastel": false,
    "isDark": false,
    "isCosmic": false,
    "isIshgardian": false,
    "consolidationType": "A",
    "marketItemID": 5729
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
    { "name": "Neutral", "count": 12 },
    { "name": "Red", "count": 14 },
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
GET /v1/dyes/batch?ids=5729,1,-1
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
    "consolidationActive": false,
    "groups": [
      {
        "type": "A",
        "consolidatedItemID": null,
        "dyeCount": 35,
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
| `method` | string | `oklab` | Distance algorithm (see below) |
| `excludeIds` | string | — | Comma-separated IDs to exclude |
| `locale` | string | `en` | Locale for localized name |
| `kL` | float | `1.0` | Lightness weight (oklch-weighted only) |
| `kC` | float | `1.0` | Chroma weight (oklch-weighted only) |
| `kH` | float | `1.0` | Hue weight (oklch-weighted only) |

**Distance Methods:**

| Method | Description |
|--------|-------------|
| `rgb` | Euclidean distance in RGB space |
| `cie76` | CIE76 delta E (Lab space) |
| `ciede2000` | CIEDE2000 delta E (perceptually uniform) |
| `oklab` | Oklab delta E (default — modern perceptual uniformity) |
| `hyab` | HyAB distance (hybrid approach) |
| `oklch-weighted` | OKLCh with custom lightness/chroma/hue weights |

**Example:**

```
GET /v1/match/closest?hex=FF0000
GET /v1/match/closest?hex=%23FF0000&method=ciede2000
GET /v1/match/closest?hex=FF6B6B&method=oklch-weighted&kL=2&kH=0.5
```

**Response:**

```json
{
  "success": true,
  "data": {
    "dye": {
      "itemID": 48227,
      "name": "Carmine Red",
      "hex": "#e50b18",
      ...
    },
    "distance": 0.0521,
    "method": "oklab",
    "inputHex": "#FF0000"
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
| `maxDistance` | float | **required** | Maximum distance threshold (min 0.01) |
| `method` | string | `oklab` | Distance algorithm |
| `limit` | integer | `20` | Max results (1–136) |
| `excludeIds` | string | — | Comma-separated IDs to exclude |
| `locale` | string | `en` | Locale for localized names |
| `kL` | float | `1.0` | Lightness weight (oklch-weighted only) |
| `kC` | float | `1.0` | Chroma weight (oklch-weighted only) |
| `kH` | float | `1.0` | Hue weight (oklch-weighted only) |

**Example:**

```
GET /v1/match/within-distance?hex=FF6B6B&maxDistance=0.15&limit=5
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      { "dye": { ... }, "distance": 0.0341 },
      { "dye": { ... }, "distance": 0.0892 },
      ...
    ],
    "inputHex": "#FF6B6B",
    "maxDistance": 0.15,
    "method": "oklab",
    "resultCount": 5
  },
  "meta": { ... }
}
```

Results are sorted by distance (closest first).

---

## Response Format

### Success Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "apiVersion": "v1",
    "locale": "en"
  }
}
```

### Paginated Envelope

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "perPage": 50,
    "total": 136,
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
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Headers

### Response Headers

| Header | Value | Description |
|--------|-------|-------------|
| `X-Request-ID` | UUID | Unique request identifier for tracing |
| `X-API-Version` | `v1` | Current API version |
| `X-RateLimit-Limit` | `65` | Requests allowed per window (60 + 5 burst) |
| `X-RateLimit-Remaining` | integer | Requests remaining |
| `X-RateLimit-Reset` | Unix timestamp | When the window resets |
| `Cache-Control` | `public, max-age=3600, s-maxage=86400` | On dye/match endpoints |
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
| `itemID` | integer | Game item ID (negative for Facewear dyes) |
| `stainID` | integer or null | Stain table ID (1–125, null for Facewear) |
| `id` | integer | Primary identifier (same as itemID) |
| `name` | string | English dye name |
| `localizedName` | string? | Localized name (only present when `locale` is not `en`) |
| `hex` | string | Hex color value (`#RRGGBB`) |
| `rgb` | object | `{ r, g, b }` values (0–255) |
| `hsv` | object | `{ h, s, v }` — hue (0–360), saturation (0–100), value (0–100) |
| `category` | string | Dye category (e.g., `Red`, `Neutral`, `Facewear`) |
| `acquisition` | string | How to obtain (e.g., `Ixali Vendor`, `Cosmic Exploration`) |
| `cost` | integer | Vendor price |
| `currency` | string or null | Currency type (e.g., `Gil`, `Cosmocredits`, `Skybuilders Scrips`) |
| `isMetallic` | boolean | Whether the dye has a metallic sheen |
| `isPastel` | boolean | Whether the dye is a pastel shade |
| `isDark` | boolean | Whether the dye is a dark shade |
| `isCosmic` | boolean | Whether the dye is from Cosmic Exploration |
| `isIshgardian` | boolean | Whether the dye is from Ishgardian Restoration |
| `consolidationType` | string or null | Patch 7.5 consolidation group: `A`, `B`, `C`, or `null` |
| `marketItemID` | integer | Item ID for market board lookups (may differ from itemID post-consolidation) |
