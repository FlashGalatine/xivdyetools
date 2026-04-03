# Color Matching

Find FFXIV dyes that best match any hex color you provide, using perceptual color distance algorithms.

## Distance Methods

| Method | Description |
|---|---|
| `rgb` | Euclidean distance in RGB space — fast, not perceptually uniform |
| `cie76` | CIE76 ΔE in Lab space — older standard, reasonable accuracy |
| `ciede2000` | CIEDE2000 ΔE — current ISO standard for perceptual color difference |
| `oklab` | Oklab ΔE — modern algorithm, excellent perceptual uniformity (default) |
| `hyab` | HyAB — hybrid approach, good for large color differences |
| `oklch-weighted` | OKLCh with custom `kL`/`kC`/`kH` weights for lightness/chroma/hue emphasis |

**Default:** `oklab` is the best general-purpose choice. Use `oklch-weighted` when you want to prioritize hue matching over lightness (e.g. `kL=0.5, kH=2`).

---

## GET /v1/match/closest

Find the single closest FFXIV dye to a given hex color.

### Parameters

| Name | In | Required | Description |
|---|---|---|---|
| `hex` | query | Yes | Hex color (`#RRGGBB` or `RRGGBB`) |
| `method` | query | No | Distance algorithm (default: `oklab`) |
| `excludeIds` | query | No | Comma-separated IDs to exclude from results |
| `locale` | query | No | Locale for `localizedName` |
| `kL` | query | No | Lightness weight for `oklch-weighted` (default: `1.0`) |
| `kC` | query | No | Chroma weight for `oklch-weighted` (default: `1.0`) |
| `kH` | query | No | Hue weight for `oklch-weighted` (default: `1.0`) |

<TryIt
  endpoint="/v1/match/closest"
  :params="[
    { name: 'hex', in: 'query', required: true, default: 'FF6B6B', description: 'Hex color — #RRGGBB or RRGGBB' },
    { name: 'method', in: 'query', required: false, default: 'oklab', description: 'Distance algorithm', options: ['rgb', 'cie76', 'ciede2000', 'oklab', 'hyab', 'oklch-weighted'] },
    { name: 'locale', in: 'query', required: false, default: 'en', description: 'en, ja, de, fr, ko, zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] }
  ]"
/>

Example response:

```json
{
  "success": true,
  "data": {
    "dye": {
      "itemID": 48227,
      "stainID": 52,
      "name": "Carmine Red",
      "hex": "#e50b18",
      "rgb": { "r": 229, "g": 11, "b": 24 },
      "category": "Red",
      ...
    },
    "distance": 0.0521,
    "method": "oklab",
    "inputHex": "#FF6B6B"
  },
  "meta": { ... }
}
```

**Distance values** are unitless floats. For `oklab`, values below `0.05` are perceptually very close, and above `0.2` are noticeable differences.

---

## GET /v1/match/within-distance

Find all dyes within a color distance threshold. Results are sorted closest-first.

### Parameters

| Name | In | Required | Description |
|---|---|---|---|
| `hex` | query | Yes | Hex color (`#RRGGBB` or `RRGGBB`) |
| `maxDistance` | query | Yes | Maximum distance threshold (min `0.01`) |
| `method` | query | No | Distance algorithm (default: `oklab`) |
| `limit` | query | No | Max results (1–136, default `20`) |
| `excludeIds` | query | No | Comma-separated IDs to exclude |
| `locale` | query | No | Locale for `localizedName` |
| `kL` | query | No | Lightness weight for `oklch-weighted` |
| `kC` | query | No | Chroma weight for `oklch-weighted` |
| `kH` | query | No | Hue weight for `oklch-weighted` |

<TryIt
  endpoint="/v1/match/within-distance"
  :params="[
    { name: 'hex', in: 'query', required: true, default: 'FF6B6B', description: 'Hex color — #RRGGBB or RRGGBB' },
    { name: 'maxDistance', in: 'query', required: true, default: '0.15', description: 'Maximum Oklab distance (try 0.05–0.30)' },
    { name: 'method', in: 'query', required: false, default: 'oklab', description: 'Distance algorithm', options: ['rgb', 'cie76', 'ciede2000', 'oklab', 'hyab', 'oklch-weighted'] },
    { name: 'limit', in: 'query', required: false, default: '10', description: 'Max results (1–136)' },
    { name: 'locale', in: 'query', required: false, default: 'en', description: 'en, ja, de, fr, ko, zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] }
  ]"
/>

Example response:

```json
{
  "success": true,
  "data": {
    "results": [
      { "dye": { "itemID": 48227, "name": "Carmine Red", "hex": "#e50b18", ... }, "distance": 0.0341 },
      { "dye": { "itemID": 48247, "name": "Rust Red", "hex": "#d4320e", ... }, "distance": 0.0892 }
    ],
    "inputHex": "#FF6B6B",
    "maxDistance": 0.15,
    "method": "oklab",
    "resultCount": 2
  },
  "meta": { ... }
}
```

If no dyes fall within `maxDistance`, `results` will be an empty array and `resultCount` will be `0`. Try increasing `maxDistance` — for `oklab`, a value of `0.3` covers most of the visible color space.
