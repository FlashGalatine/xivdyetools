# Dyes

<p class="xdt-meta">7 endpoints · 125 dyes · Schema v2 · stainID-keyed</p>

The full dye database — **125 standard dyes**, keyed by stainID. Facewear colors are no longer served as dyes; legacy negative IDs return an explanatory 404.

Every dye in a response is the same **Dye Object** — every card on this page carries a **Fields** fold listing its 19 fields (`/categories` and `/consolidation-groups` return summaries, not dyes). Two of them are easy to confuse:

- `stainID` is the canonical key (the game's stain table, `1–254`); `itemID` is the legacy per-dye item.
- `marketItemID` is for **market-board lookups only** and is never a dye lookup key. Since Patch 7.5, 105 dyes share three consolidated items (`52254` / `52255` / `52256`), so look prices up on [Universalis](https://docs.universalis.app/) by `marketItemID` — never by a dye's legacy `itemID` — and use [`/v1/dyes/consolidation-groups`](#get-v1-dyes-consolidation-groups) to learn which dyes share which item.

## GET /v1/dyes

List all dyes with filtering, sorting, and pagination. Returns 125 entries across ~3 pages at the default `perPage` of 50.

<EndpointCard
  endpoint="/v1/dyes"
  summary="List all dyes with filtering, sorting, and pagination."
  fields="dye"
  preview="/v1/dyes?category=Reds&perPage=12"
  :params="[
    { name: 'category', in: 'query', description: 'Exact category name, case-sensitive', options: ['Blues', 'Browns', 'Greens', 'Neutral', 'Purples', 'Reds', 'Special', 'Yellows'] },
    { name: 'sort', in: 'query', description: 'name · brightness · saturation · hue · cost', options: ['name', 'brightness', 'saturation', 'hue', 'cost'] },
    { name: 'order', in: 'query', default: 'asc', description: 'asc or desc', options: ['asc', 'desc'] },
    { name: 'page', in: 'query', default: '1', description: 'Page number' },
    { name: 'perPage', in: 'query', default: '10', description: 'Items per page (1–200; the API default is 50)' },
    { name: 'locale', in: 'query', default: 'en', description: 'en · ja · de · fr · ko · zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] },
    { name: 'metallic', in: 'query', description: 'Only (true) or never (false) metallic dyes', options: ['true', 'false'] },
    { name: 'pastel', in: 'query', description: 'Only / never pastel dyes', options: ['true', 'false'] },
    { name: 'dark', in: 'query', description: 'Only / never dark dyes', options: ['true', 'false'] },
    { name: 'cosmic', in: 'query', description: 'Only / never Cosmic Exploration dyes', options: ['true', 'false'] },
    { name: 'ishgardian', in: 'query', description: 'Only / never Ishgardian dyes', options: ['true', 'false'] },
    { name: 'vendor', in: 'query', description: 'Only / never dyes acquired from vendors', options: ['true', 'false'] },
    { name: 'craft', in: 'query', description: 'Only / never dyes acquired by crafting', options: ['true', 'false'] },
    { name: 'expensive', in: 'query', description: 'Only / never premium-cost dyes (curated list)', options: ['true', 'false'] },
    { name: 'consolidationType', in: 'query', description: 'Patch 7.5 group', options: ['A', 'B', 'C'] },
    { name: 'minPrice', in: 'query', description: 'Lower bound on vendor cost (integer ≥ 0)' },
    { name: 'maxPrice', in: 'query', description: 'Upper bound on vendor cost (integer ≥ 0)' },
    { name: 'excludeIds', in: 'query', description: 'Comma-separated IDs to drop (max 50; itemID or stainID, auto-detected)' },
  ]"
/>

## GET /v1/dyes/:id

Look up a single dye. The ID type is inferred by numeric range — see [ID auto-detection](../guide/#id-auto-detection). A consolidated market item (`52254`–`52256`) is rejected with a hint pointing at `/v1/dyes/consolidation-groups`; a legacy negative Facewear ID answers 404 with the color's new slug, name and hex.

<EndpointCard
  endpoint="/v1/dyes/:id"
  summary="Look up a single dye; ID type inferred by range."
  fields="dye"
  preview="/v1/dyes/1"
  :params="[
    { name: 'id', in: 'path', required: true, default: '5729', description: 'itemID (≥ 5729) or stainID (1–254), auto-detected' },
    { name: 'locale', in: 'query', default: 'en', description: 'en · ja · de · fr · ko · zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] },
  ]"
/>

## GET /v1/dyes/stain/:stainId

Explicit stainID lookup — bypasses range-based auto-detection. Use this when you specifically have a stainID and want to be unambiguous.

<EndpointCard
  endpoint="/v1/dyes/stain/:stainId"
  summary="Look up a dye by stain table ID (1–254)."
  fields="dye"
  preview="/v1/dyes/stain/5"
  :params="[
    { name: 'stainId', in: 'path', required: true, default: '1', description: 'stainID (positive integer, 1–254; 404 if unassigned)' },
    { name: 'locale', in: 'query', default: 'en', description: 'en · ja · de · fr · ko · zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] },
  ]"
/>

## GET /v1/dyes/search

Search dyes by name. Case-insensitive substring match; with a non-English `locale` the localized names are searched and returned. Returns an array (not paginated) of every matching dye.

<EndpointCard
  endpoint="/v1/dyes/search"
  summary="Case-insensitive substring match on names; localized when locale is set."
  fields="dye"
  preview="/v1/dyes/search?q=rose"
  :params="[
    { name: 'q', in: 'query', required: true, default: 'snow', description: 'Substring to match against dye names' },
    { name: 'locale', in: 'query', default: 'en', description: 'Search against localized names and return localizedName', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] },
  ]"
/>

## GET /v1/dyes/categories

List all dye categories with their dye counts.

<EndpointCard
  endpoint="/v1/dyes/categories"
  summary="All dye categories with their counts."
  preview="/v1/dyes/categories"
/>

## GET /v1/dyes/batch

Look up multiple dyes by ID in a single request. Returns the dyes found and a `notFound` array for any IDs that didn't resolve.

<EndpointCard
  endpoint="/v1/dyes/batch"
  summary="Multiple dyes by ID in one request; notFound array for misses."
  fields="dye"
  preview="/v1/dyes/batch?ids=1,2,3,4,5,6"
  :params="[
    { name: 'ids', in: 'query', required: true, default: '5729,5730,5731', description: 'Comma-separated IDs (max 50)' },
    { name: 'idType', in: 'query', default: 'auto', description: 'How to read each ID: auto-detect by range, or force item / stain', options: ['auto', 'item', 'stain'] },
    { name: 'locale', in: 'query', default: 'en', description: 'en · ja · de · fr · ko · zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] },
  ]"
/>

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

## GET /v1/dyes/consolidation-groups

Patch 7.5 consolidation metadata. In Patch 7.5, 105 individual dyes were reorganized into three consolidated dye items (Type-A, Type-B, Type-C). This endpoint exposes which dyes belong to which group and whether consolidation is currently active in the game.

Consolidation is **active** (since April 2026) — all three consolidated itemIDs (`52254`, `52255`, `52256`) are populated, and the `marketItemID` field on each consolidated dye points to the consolidated item rather than the legacy per-dye itemID. Use this endpoint to discover which legacy itemIDs map to which consolidated parent, e.g. when caching market-board prices.

<EndpointCard
  endpoint="/v1/dyes/consolidation-groups"
  summary="Patch 7.5 consolidation groups A / B / C and their members."
  preview="/v1/dyes/consolidation-groups"
/>

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
        "dyes": [
          { "itemID": 5729, "stainID": 1, "name": "Snow White" }
        ]
      },
      { "type": "B", "consolidatedItemID": 52255, "dyeCount": 9, "dyes": [] },
      { "type": "C", "consolidatedItemID": 52256, "dyeCount": 11, "dyes": [] }
    ],
    "unconsolidated": {
      "count": 20,
      "dyes": []
    }
  },
  "meta": {}
}
```
