# Color Matching

<p class="xdt-meta">2 endpoints · 6 distance methods · ΔE2000 default</p>

Find FFXIV dyes that best match any hex color you provide, using perceptual color distance algorithms.

## Distance methods

| Method | Tag | Scale | Description |
|---|---|---|---|
| `ciede2000` | ΔE2000 | 0 – 100 | CIEDE2000 ΔE — current ISO standard for perceptual color difference (**default**) |
| `oklab` | ΔEOK2 | 0 – ~1.244 | Euclidean distance in Oklab with `a`/`b` scaled ×2 (CSS Color 4 §20.4) — modern, excellent perceptual uniformity |
| `cie76` | ΔE76 | 0 – 100 | CIE76 ΔE in Lab space — older standard, reasonable accuracy |
| `redmean` | REDMEAN | 0 – ~765 | Weighted RGB distance — cheap perceptual approximation |
| `rgb` | RGB DIST | 0 – ~441.67 | Euclidean distance in RGB space — fast, not perceptually uniform |
| `distinguish` | DISTINGUISH % | 0 – 100 (integer) | RGB distance rescaled to a percentage — same ranking as `rgb`, rounded, so ties are common |

**Default:** `ciede2000` — the same "what does *close* mean" answer used across the XIV Dye Tools suite. `distance` is returned in the chosen method's native unit, so thresholds are not comparable across methods.

::: warning `oklab` changed scale in core 5.1.0
`oklab` was plain ΔEOK (Euclidean Oklab) up to core 5.0.0. From 5.1.0 it is **ΔEOK2** — the same distance with `a` and `b` scaled by 2, as CSS Color 4 §20.4 defines, because plain ΔEOK under-weights differences in colorfulness against differences in lightness.

This moves both the **ranking** and the **numeric scale**: values for a given pair are roughly 1.4–2× their former size (a pure lightness difference such as black-to-white is unchanged at `1.0`, a pure chroma difference nearly doubles). Any `maxDistance` threshold or client-side band your code compares against an `oklab` distance needs to move with it. Rankings changed too — against `ciede2000` as the reference over 2,000 random sRGB queries, plain ΔEOK picked a different closest dye 30.4% of the time and ΔEOK2 24.4%.

The other five methods are unaffected, and `ciede2000` remains the default.
:::

::: tip Retired methods
The pre-5.0 values `hyab` and `oklch-weighted` are still **accepted** for compatibility but are silently normalised to `ciede2000` (and `euclidean` to `rgb`) — the response `method` field shows what was actually used. The old `kL` / `kC` / `kH` weight parameters are ignored.
:::

Both endpoints take the same **type / acquisition filters** (`metallic`, `pastel`, `dark`, `cosmic`, `ishgardian`, `vendor`, `craft`, `expensive`): set one to `true` or `false` and the matcher narrows the candidate set to dyes that match, exactly as [`GET /v1/dyes`](./dyes#get-v1-dyes) filters do.

## GET /v1/match/closest

Find the single closest FFXIV dye to a given hex color.

<EndpointCard
  endpoint="/v1/match/closest"
  summary="The single closest dye to a hex color."
  preview="/v1/match/closest?hex=EA4133"
  :params="[
    { name: 'hex', in: 'query', required: true, default: 'FF6B6B', description: 'Hex color — #RRGGBB or RRGGBB (3-digit shorthand is not accepted)' },
    { name: 'method', in: 'query', default: 'ciede2000', description: 'Distance algorithm', options: ['ciede2000', 'oklab', 'cie76', 'redmean', 'rgb', 'distinguish'] },
    { name: 'excludeIds', in: 'query', description: 'Comma-separated IDs to exclude (max 50; itemID or stainID, auto-detected)' },
    { name: 'locale', in: 'query', default: 'en', description: 'en · ja · de · fr · ko · zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] },
    { name: 'metallic', in: 'query', description: 'Only / never metallic dyes', options: ['true', 'false'] },
    { name: 'pastel', in: 'query', description: 'Only / never pastel dyes', options: ['true', 'false'] },
    { name: 'dark', in: 'query', description: 'Only / never dark dyes', options: ['true', 'false'] },
    { name: 'cosmic', in: 'query', description: 'Only / never Cosmic Exploration dyes', options: ['true', 'false'] },
    { name: 'ishgardian', in: 'query', description: 'Only / never Ishgardian dyes', options: ['true', 'false'] },
    { name: 'vendor', in: 'query', description: 'Only / never vendor-acquired dyes', options: ['true', 'false'] },
    { name: 'craft', in: 'query', description: 'Only / never crafted dyes', options: ['true', 'false'] },
    { name: 'expensive', in: 'query', description: 'Only / never premium-cost dyes', options: ['true', 'false'] },
  ]"
/>

```json
{
  "success": true,
  "data": {
    "dye": {
      "itemID": 5741,
      "stainID": 13,
      "name": "Coral Pink",
      "hex": "#cc6c5e",
      "rgb": { "r": 204, "g": 108, "b": 94 },
      "category": "Reds",
      ...
    },
    "distance": 9.568,
    "method": "ciede2000",
    "inputHex": "#FF6B6B"
  },
  "meta": { ... }
}
```

**Distance values** are floats (rounded to 4 decimals) in the chosen method's native unit. For `ciede2000`, roughly `< 2` is imperceptible, `2–10` is a visible-but-close match, and `> 10` is a clearly different color; for `oklab` (ΔEOK2), values below `0.03` are perceptually very close and above `0.17` are clearly different — these are the suite's own calibrated band cuts, and they moved up with the 5.1.0 scale change described above.

## GET /v1/match/within-distance

Find all dyes within a color distance threshold. Results are sorted closest-first.

<EndpointCard
  endpoint="/v1/match/within-distance"
  summary="Every dye within a distance of a hex color."
  preview="/v1/match/within-distance?hex=EA4133&maxDistance=12"
  :params="[
    { name: 'hex', in: 'query', required: true, default: 'FF6B6B', description: 'Hex color — #RRGGBB or RRGGBB' },
    { name: 'maxDistance', in: 'query', required: true, default: '15', description: 'Maximum distance in the method\'s unit (min 0.01; ΔE2000: try 5–30)' },
    { name: 'method', in: 'query', default: 'ciede2000', description: 'Distance algorithm', options: ['ciede2000', 'oklab', 'cie76', 'redmean', 'rgb', 'distinguish'] },
    { name: 'limit', in: 'query', default: '10', description: 'Max results (1–125; API default 20) — applied after excludeIds and the filters' },
    { name: 'excludeIds', in: 'query', description: 'Comma-separated IDs to exclude (max 50)' },
    { name: 'locale', in: 'query', default: 'en', description: 'en · ja · de · fr · ko · zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] },
    { name: 'metallic', in: 'query', description: 'Only / never metallic dyes', options: ['true', 'false'] },
    { name: 'pastel', in: 'query', description: 'Only / never pastel dyes', options: ['true', 'false'] },
    { name: 'dark', in: 'query', description: 'Only / never dark dyes', options: ['true', 'false'] },
    { name: 'cosmic', in: 'query', description: 'Only / never Cosmic Exploration dyes', options: ['true', 'false'] },
    { name: 'ishgardian', in: 'query', description: 'Only / never Ishgardian dyes', options: ['true', 'false'] },
    { name: 'vendor', in: 'query', description: 'Only / never vendor-acquired dyes', options: ['true', 'false'] },
    { name: 'craft', in: 'query', description: 'Only / never crafted dyes', options: ['true', 'false'] },
    { name: 'expensive', in: 'query', description: 'Only / never premium-cost dyes', options: ['true', 'false'] },
  ]"
/>

```json
{
  "success": true,
  "data": {
    "results": [
      { "dye": { "itemID": 5741, "stainID": 13, "name": "Coral Pink", "hex": "#cc6c5e", ... }, "distance": 9.568 },
      { "dye": { "itemID": 5735, "stainID": 7, "name": "Rose Pink", "hex": "#e69f96", ... }, "distance": 12.8236 }
    ],
    "inputHex": "#FF6B6B",
    "maxDistance": 15,
    "method": "ciede2000",
    "resultCount": 2
  },
  "meta": { ... }
}
```

If no dyes fall within `maxDistance`, `results` will be an empty array and `resultCount` will be `0`. Try increasing `maxDistance` — for `ciede2000`, black-to-white is `100`, so `30` already covers a wide neighbourhood; for `oklab` (ΔEOK2 — black-to-white `1.0`, but the widest pair, green-to-magenta, reaches `1.244`) a value of `0.3` reaches roughly a third of all dye pairs and `0.5` about three-quarters. Note these numbers roughly doubled in core 5.1.0 — a `maxDistance` tuned against the pre-5.1.0 `oklab` scale now returns noticeably fewer results.
