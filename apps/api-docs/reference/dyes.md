# Dyes

7 endpoints covering the full 136-dye database.

## Dye Object

Every dye response includes these fields:

| Field | Type | Description |
|---|---|---|
| `itemID` | integer | Game item ID (negative for Facewear dyes) |
| `stainID` | integer \| null | Stain table ID (1–125; null for Facewear) |
| `id` | integer | Same as `itemID` |
| `name` | string | English dye name |
| `localizedName` | string? | Present only when `locale` ≠ `en` |
| `hex` | string | Hex color (`#RRGGBB`) |
| `rgb` | object | `{ r, g, b }` — 0–255 |
| `hsv` | object | `{ h, s, v }` — hue 0–360, sat/val 0–100 |
| `category` | string | e.g. `Red`, `Neutral`, `Facewear` |
| `acquisition` | string | e.g. `Ixali Vendor`, `Cosmic Exploration` |
| `cost` | integer | Vendor price |
| `currency` | string \| null | e.g. `Gil`, `Cosmocredits`, `Skybuilders Scrips` |
| `isMetallic` | boolean | Metallic sheen |
| `isPastel` | boolean | Pastel shade |
| `isDark` | boolean | Dark shade |
| `isCosmic` | boolean | From Cosmic Exploration |
| `isIshgardian` | boolean | From Ishgardian Restoration |
| `consolidationType` | string \| null | Patch 7.5 group: `A`, `B`, `C`, or `null` |
| `marketItemID` | integer | Item ID for market board lookups |

---

## GET /v1/dyes

List all dyes with filtering, sorting, and pagination. Returns 136 total dyes across ~3 pages at the default `perPage` of 50.

### Parameters

| Name | In | Default | Description |
|---|---|---|---|
| `page` | query | `1` | Page number |
| `perPage` | query | `50` | Items per page (1–200) |
| `category` | query | — | Filter by category name (e.g. `Red`, `Neutral`) |
| `metallic` | query | — | `true`/`false` — filter metallic dyes |
| `pastel` | query | — | `true`/`false` — filter pastel dyes |
| `dark` | query | — | `true`/`false` — filter dark dyes |
| `cosmic` | query | — | `true`/`false` — filter Cosmic Exploration dyes |
| `ishgardian` | query | — | `true`/`false` — filter Ishgardian dyes |
| `consolidationType` | query | — | Filter by Patch 7.5 group: `A`, `B`, `C`, or `none` |
| `sort` | query | — | `name`, `brightness`, `saturation`, `hue`, or `cost` |
| `order` | query | `asc` | `asc` or `desc` |
| `locale` | query | `en` | `en`, `ja`, `de`, `fr`, `ko`, or `zh` |

<TryIt
  endpoint="/v1/dyes"
  :params="[
    { name: 'category', in: 'query', required: false, description: 'e.g. Red, Neutral, Blue, Facewear' },
    { name: 'sort', in: 'query', required: false, description: 'name, brightness, saturation, hue, cost', options: ['name', 'brightness', 'saturation', 'hue', 'cost'] },
    { name: 'order', in: 'query', required: false, default: 'asc', description: 'asc or desc', options: ['asc', 'desc'] },
    { name: 'perPage', in: 'query', required: false, default: '10', description: 'Items per page (1–200)' },
    { name: 'locale', in: 'query', required: false, default: 'en', description: 'en, ja, de, fr, ko, zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] }
  ]"
/>

---

## GET /v1/dyes/:id

Look up a single dye. The ID type is inferred by numeric range — see [ID auto-detection](../guide/#dye-id-auto-detection).

### Parameters

| Name | In | Description |
|---|---|---|
| `id` | path | itemID, stainID (1–125), or Facewear ID (negative) |
| `locale` | query | Locale for `localizedName` |

<TryIt
  endpoint="/v1/dyes/:id"
  :params="[
    { name: 'id', in: 'path', required: true, default: '5729', description: 'itemID (≥5729), stainID (1–125), or Facewear ID (<0)' },
    { name: 'locale', in: 'query', required: false, default: 'en', description: 'en, ja, de, fr, ko, zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] }
  ]"
/>

---

## GET /v1/dyes/stain/:stainId

Explicit stainID lookup — bypasses range-based auto-detection. Use this when you specifically have a stainID and want to be unambiguous.

### Parameters

| Name | In | Description |
|---|---|---|
| `stainId` | path | stainID (positive integer, 1–125) |
| `locale` | query | Locale for `localizedName` |

<TryIt
  endpoint="/v1/dyes/stain/:stainId"
  :params="[
    { name: 'stainId', in: 'path', required: true, default: '1', description: 'stainID (1–125)' },
    { name: 'locale', in: 'query', required: false, default: 'en', description: 'en, ja, de, fr, ko, zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] }
  ]"
/>

---

## GET /v1/dyes/search

Search dyes by name. Case-insensitive substring match. Supports localized name search when a non-English locale is specified.

Returns an array (not paginated) of all matching dyes.

### Parameters

| Name | In | Required | Description |
|---|---|---|---|
| `q` | query | Yes | Search query |
| `locale` | query | No | Search against localized names and return `localizedName` |

<TryIt
  endpoint="/v1/dyes/search"
  :params="[
    { name: 'q', in: 'query', required: true, default: 'snow', description: 'Case-insensitive substring to match against dye names' },
    { name: 'locale', in: 'query', required: false, default: 'en', description: 'en, ja, de, fr, ko, zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] }
  ]"
/>

---

## GET /v1/dyes/categories

List all dye categories with their dye counts.

<TryIt endpoint="/v1/dyes/categories" />

Example response:

```json
{
  "success": true,
  "data": [
    { "name": "Neutral", "count": 12 },
    { "name": "Red", "count": 14 },
    { "name": "Brown", "count": 8 }
  ],
  "meta": { ... }
}
```

---

## GET /v1/dyes/batch

Look up multiple dyes by ID in a single request. Returns found dyes and a `notFound` array for any IDs that didn't resolve.

### Parameters

| Name | In | Required | Description |
|---|---|---|---|
| `ids` | query | Yes | Comma-separated IDs (max 50) |
| `idType` | query | No | `auto` (default), `item`, or `stain` |
| `locale` | query | No | Locale for `localizedName` |

<TryIt
  endpoint="/v1/dyes/batch"
  :params="[
    { name: 'ids', in: 'query', required: true, default: '5729,5730,5731', description: 'Comma-separated IDs (max 50)' },
    { name: 'idType', in: 'query', required: false, default: 'auto', description: 'auto, item, or stain', options: ['auto', 'item', 'stain'] },
    { name: 'locale', in: 'query', required: false, default: 'en', description: 'en, ja, de, fr, ko, zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] }
  ]"
/>

Example response:

```json
{
  "success": true,
  "data": {
    "dyes": [ { "itemID": 5729, "name": "Snow White", ... }, ... ],
    "notFound": []
  },
  "meta": { ... }
}
```

---

## GET /v1/dyes/consolidation-groups

Returns Patch 7.5 consolidation metadata. In Patch 7.5, 105 individual dyes were reorganized into three consolidated dye items (groups A, B, C). This endpoint exposes which dyes belong to which group and whether consolidation is currently active in the game.

<TryIt endpoint="/v1/dyes/consolidation-groups" />

Example response:

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
        "dyes": [
          { "itemID": 5729, "stainID": 1, "name": "Snow White" },
          ...
        ]
      },
      { "type": "B", "dyeCount": 35, "dyes": [ ... ] },
      { "type": "C", "dyeCount": 35, "dyes": [ ... ] }
    ],
    "unconsolidated": {
      "count": 31,
      "dyes": [ ... ]
    }
  },
  "meta": { ... }
}
```
