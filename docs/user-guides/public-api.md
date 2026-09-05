# Public API Guide

**Use the XIV Dye Tools API to integrate FFXIV dye data into your own projects.**

Base URL: `https://data.xivdyetools.app/v1`

Full, browsable reference with a live "try it" console: [developers.xivdyetools.app](https://developers.xivdyetools.app). The same worker also exposes a Universalis market-board proxy at `https://data.xivdyetools.app/universalis/*` (see [Market Prices](#9-market-prices-universalis-proxy)).

---

## Quick Start

No authentication required. Just make HTTP GET requests:

```bash
# Get all dyes
curl https://data.xivdyetools.app/v1/dyes

# Look up Snow White by item ID
curl https://data.xivdyetools.app/v1/dyes/5729

# Search for dyes by name
curl https://data.xivdyetools.app/v1/dyes/search?q=snow

# Find the closest dye to a hex color
curl https://data.xivdyetools.app/v1/match/closest?hex=FF0000
```

---

## Common Use Cases

### 1. Look Up a Dye

If you have an **item ID** (from the game's item database) or a **stain ID** (from the stain table), you can use the same endpoint — the API auto-detects which type:

```bash
# By item ID (5729 = Snow White)
curl https://data.xivdyetools.app/v1/dyes/5729

# By stain ID (1 = Snow White)
curl https://data.xivdyetools.app/v1/dyes/1
```

> **Facewear colours are not dyes** and are not served by this endpoint. A negative ID (the
> pre-2026-07-31 synthetic Facewear ID) returns a 404 that names the colour it used to refer to,
> so old links fail informatively rather than silently.

If you specifically need stain ID lookup (no auto-detection):

```bash
curl https://data.xivdyetools.app/v1/dyes/stain/1
```

### 2. Search for Dyes

```bash
# English name search
curl https://data.xivdyetools.app/v1/dyes/search?q=cherry

# Japanese name search
curl "https://data.xivdyetools.app/v1/dyes/search?q=白&locale=ja"
```

Supported locales: `en`, `ja`, `de`, `fr`, `ko`, `zh`

### 3. Browse Dyes with Filters

```bash
# All red dyes (category names are exact and case-sensitive: Reds, Blues, Neutral, ...)
curl https://data.xivdyetools.app/v1/dyes?category=Reds

# Metallic dyes sorted by brightness
curl "https://data.xivdyetools.app/v1/dyes?metallic=true&sort=brightness&order=desc"

# Cheap dyes under 100 Gil
curl "https://data.xivdyetools.app/v1/dyes?maxPrice=100"

# Cosmic dyes
curl "https://data.xivdyetools.app/v1/dyes?cosmic=true"

# Page 2, 10 results per page
curl "https://data.xivdyetools.app/v1/dyes?page=2&perPage=10"
```

Available boolean filters: `metallic`, `pastel`, `dark`, `cosmic`, `ishgardian`, `vendor`, `craft`, `expensive` — plus `consolidationType=A|B|C`, `minPrice`/`maxPrice`, and `excludeIds`

Available sort fields: `name`, `brightness`, `saturation`, `hue`, `cost`

### 4. Batch Lookup

Fetch up to 50 dyes in a single request:

```bash
# Mixed ID types (auto-detected: 5729 = itemID, 1 = stainID)
curl "https://data.xivdyetools.app/v1/dyes/batch?ids=5729,1,999999"

# Explicit stain IDs
curl "https://data.xivdyetools.app/v1/dyes/batch?ids=1,2,3,4,5&idType=stain"
```

The response tells you which IDs were found and which weren't:

```json
{
  "data": {
    "dyes": [ ... ],
    "notFound": [999999]
  }
}
```

### 5. Find the Closest Dye to a Color

```bash
# Default method (ciede2000 / ΔE2000 - recommended)
curl "https://data.xivdyetools.app/v1/match/closest?hex=FF6B6B"

# With a specific distance algorithm
curl "https://data.xivdyetools.app/v1/match/closest?hex=FF6B6B&method=oklab"

# Exclude specific dyes from results (itemID or stainID)
curl "https://data.xivdyetools.app/v1/match/closest?hex=FF6B6B&excludeIds=5741"

# Only consider vendor-bought dyes (same boolean filters as /v1/dyes)
curl "https://data.xivdyetools.app/v1/match/closest?hex=FF6B6B&vendor=true"
```

### 6. Find All Similar Dyes

```bash
# All dyes within ΔE2000 15 of a color
curl "https://data.xivdyetools.app/v1/match/within-distance?hex=FF6B6B&maxDistance=15"

# Limit to top 5 closest
curl "https://data.xivdyetools.app/v1/match/within-distance?hex=FF6B6B&maxDistance=15&limit=5"
```

Results are sorted by distance (closest first). `maxDistance` is in the chosen method's unit — `15` is a sensible ΔE2000 starting point; for `oklab` use something like `0.15`.

### Resolve a `.chara` file's equipment (POST)

A character file names no items — it stores each slot's model key. Send the worn slots' keys (and nothing else from the file) and get back the items, their names in six languages, icon ids and same-model alternates:

```bash
curl -X POST "https://data.xivdyetools.app/v1/chara/resolve" \
  -H "Content-Type: application/json" \
  -d '{"gear":[{"slot":"HeadGear","base":361,"variant":5},{"slot":"MainHand","set":634,"base":19,"variant":1}],"glasses":40}'

# The icon for a resolved item (PNG, long-cached)
curl -o mask.png "https://data.xivdyetools.app/v1/chara/icon/41716"
```

`items.<slot>` is `null` when the key has no Item row (NPC / prop models); `503 UPSTREAM_UNAVAILABLE` means XIVAPI is down or re-indexing after a patch — retry later. Full reference: [developers.xivdyetools.app/reference/chara](https://developers.xivdyetools.app/reference/chara).

### 7. Get Categories

```bash
curl https://data.xivdyetools.app/v1/dyes/categories
```

Returns each category name and how many dyes it contains.

### 8. Patch 7.5 Consolidation Data

```bash
curl https://data.xivdyetools.app/v1/dyes/consolidation-groups
```

Returns which dyes belong to consolidation groups A, B, and C, and whether consolidation is currently active in the game.

### 9. Market Prices (Universalis Proxy)

The worker also proxies the [Universalis](https://universalis.app) market-board API, with caching and open CORS, at `https://data.xivdyetools.app/universalis/*` — **outside** `/v1`, so responses are Universalis' own JSON (no `{ success, data, meta }` envelope) and it has its own rate limit (30 requests/min per IP on the prices route):

```bash
# Aggregated prices for the three Patch 7.5 consolidated dye items on Aether
curl https://data.xivdyetools.app/universalis/aggregated/Aether/52254,52255,52256

# Data-center and world lists
curl https://data.xivdyetools.app/universalis/data-centers
curl https://data.xivdyetools.app/universalis/worlds
```

Always price a dye by its `marketItemID`, not its `itemID`, and look prices up on Universalis directly — the public docs no longer advertise the proxy routes (see the [Dyes reference](https://developers.xivdyetools.app/reference/dyes#get-v1-dyes-consolidation-groups) for the consolidation groups).

---

## Distance Methods Explained

When matching colors, you can choose a distance algorithm. Different methods produce different "closest" results:

| Method | Scale | Best For | Notes |
|--------|-------|----------|-------|
| `ciede2000` | 0–100 | General use (**default**) | Industry-standard perceptual color difference — the same "closeness" used everywhere in XIV Dye Tools |
| `oklab` | 0–1 | Modern perceptual matching | Euclidean distance in Oklab — perceptually uniform, cheap to compute |
| `cie76` | 0–100 | Quick perceptual matching | Simpler delta E formula, less accurate for saturated colors |
| `redmean` | 0–~765 | Cheap approximation | Weighted RGB distance — a low-cost perceptual approximation |
| `rgb` | 0–~441.67 | Simple applications | Euclidean distance in RGB — not perceptually uniform, but simple |
| `distinguish` | 0–100 (integer) | Human-readable percentages | RGB distance rescaled to a percentage — same ranking as `rgb`, so expect ties |

For most use cases the default `ciede2000` is the best choice. `distance` values are in the method's own unit, so a threshold that works for one method will not transfer to another.

> **Upgrading from an older client?** The pre-5.0 methods `hyab` and `oklch-weighted` are still accepted but are silently treated as `ciede2000` (`euclidean` as `rgb`), and the old `kL`/`kC`/`kH` weight parameters are ignored — check the `method` field in the response to see what was actually used.

---

## Localization

All dye endpoints accept a `locale` parameter. When set to a non-English locale, each dye includes a `localizedName` field:

```bash
curl "https://data.xivdyetools.app/v1/dyes/5729?locale=ja"
```

```json
{
  "data": {
    "name": "Snow White",
    "localizedName": "スノウホワイト",
    ...
  }
}
```

Supported: `en`, `ja` (Japanese), `de` (German), `fr` (French), `ko` (Korean), `zh` (Chinese)

---

## Response Format

All responses follow a consistent envelope:

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

Paginated responses add:

```json
{
  "pagination": {
    "page": 1,
    "perPage": 50,
    "total": 125,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

When you request a non-English `locale`, `meta.locale` is added as well.

Errors return:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Human-readable description",
  "details": { ... },
  "meta": { ... }
}
```

---

## Rate Limiting

- **60 requests per minute** per IP address (with a burst allowance of 5)
- Rate limit headers are included on every `/v1/*` response:

```
X-RateLimit-Limit: 65
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1712000000
```

- If you exceed the limit, you'll receive a `429` response with a `Retry-After` header (and a top-level `retryAfter` in the body)
- The `/health` endpoint is not rate-limited
- The Universalis proxy has its own, separate limit — 30 requests per minute per IP on `/universalis/aggregated/*` (the data-center and world lists are unlimited)

**Tips for staying under the limit:**

- Use the `/batch` endpoint instead of individual lookups when fetching multiple dyes
- Cache responses on your end — the data only changes with FFXIV game patches
- Respect `Cache-Control` headers (data is cacheable for 1 hour on the client, 24 hours on CDN)

---

## CORS

The API allows requests from any origin:

```
Access-Control-Allow-Origin: *
```

This means you can call it directly from browser JavaScript, mobile apps, or any HTTP client without restrictions.

---

## Code Examples

### JavaScript (fetch)

```javascript
// Find the closest dye to a color
const res = await fetch('https://data.xivdyetools.app/v1/match/closest?hex=FF6B6B');
const { data } = await res.json();
console.log(`Closest dye: ${data.dye.name} (${data.dye.hex}), distance: ${data.distance}`);
```

### Python (requests)

```python
import requests

# Get all metallic dyes
response = requests.get('https://data.xivdyetools.app/v1/dyes', params={
    'metallic': 'true',
    'sort': 'name',
    'perPage': 200,
})
data = response.json()
for dye in data['data']:
    print(f"{dye['name']} — {dye['hex']}")
```

### C# (HttpClient)

```csharp
// Look up a dye by item ID (e.g., from Dalamud plugin)
var client = new HttpClient();
var response = await client.GetAsync("https://data.xivdyetools.app/v1/dyes/5729");
var json = await response.Content.ReadAsStringAsync();
```

### Rust (reqwest)

```rust
// Batch lookup for a Dalamud/ACT plugin
let response = reqwest::get("https://data.xivdyetools.app/v1/dyes/batch?ids=5729,5730,5731")
    .await?
    .json::<serde_json::Value>()
    .await?;
```

---

## Caching Guidance

All dye and color matching responses include:

```
Cache-Control: public, max-age=3600, s-maxage=86400
```

- **Browser/client cache**: 1 hour (`max-age=3600`)
- **CDN/edge cache**: 24 hours (`s-maxage=86400`)

The dye database is deterministic — the same query always returns the same result. Data only changes when Square Enix adds or modifies dyes in a game patch, which happens a few times per year. You can safely cache aggressively on your end.

---

## Dye ID Types

FFXIV dyes have multiple ID systems. The API accepts all of them:

| ID Type | Range | Example | Notes |
|---------|-------|---------|-------|
| Item ID | >= 5729 | `5729` (Snow White) | Legacy game item database ID |
| Stain ID | 1–254 | `1` (Snow White) | Internal stain table index — the canonical dye key (125 assigned today) |
| Legacy Facewear ID | < 0 | `-1629` | **No longer served** — Facewear colors are not dyes; you get a 404 naming the color and its new slug id |

The `marketItemID` field in responses is the ID to use for Universalis market board lookups. After Patch 7.5 consolidation, multiple dyes may share the same `marketItemID`.

---

## Related

- [Full Endpoint Reference](../projects/api-worker/endpoints.md) — Detailed parameter tables and schemas
- [XIV Dye Tools Web App](https://xivdyetools.app) — Interactive color tools
- [Discord Bot](../user-guides/discord-bot/getting-started.md) — Bot commands for dye lookup in Discord
