# Public API Guide

**Use the XIV Dye Tools API to integrate FFXIV dye data into your own projects.**

Base URL: `https://data.xivdyetools.app/v1`

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

If you have an **item ID** (from the game's item database), a **stain ID** (from the stain table), or a **Facewear ID** (synthetic negative), you can use the same endpoint — the API auto-detects which type:

```bash
# By item ID (5729 = Snow White)
curl https://data.xivdyetools.app/v1/dyes/5729

# By stain ID (1 = Snow White)
curl https://data.xivdyetools.app/v1/dyes/1

# By Facewear synthetic ID
curl https://data.xivdyetools.app/v1/dyes/-1
```

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
# All red dyes
curl https://data.xivdyetools.app/v1/dyes?category=Red

# Metallic dyes sorted by brightness
curl "https://data.xivdyetools.app/v1/dyes?metallic=true&sort=brightness&order=desc"

# Cheap dyes under 100 Gil
curl "https://data.xivdyetools.app/v1/dyes?maxPrice=100"

# Cosmic dyes
curl "https://data.xivdyetools.app/v1/dyes?cosmic=true"

# Page 2, 10 results per page
curl "https://data.xivdyetools.app/v1/dyes?page=2&perPage=10"
```

Available boolean filters: `metallic`, `pastel`, `dark`, `cosmic`, `ishgardian`

Available sort fields: `name`, `brightness`, `saturation`, `hue`, `cost`

### 4. Batch Lookup

Fetch up to 50 dyes in a single request:

```bash
# Mixed ID types (auto-detected)
curl "https://data.xivdyetools.app/v1/dyes/batch?ids=5729,1,-1"

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
# Default method (oklab - recommended)
curl "https://data.xivdyetools.app/v1/match/closest?hex=FF6B6B"

# With a specific distance algorithm
curl "https://data.xivdyetools.app/v1/match/closest?hex=FF6B6B&method=ciede2000"

# Exclude specific dyes from results
curl "https://data.xivdyetools.app/v1/match/closest?hex=FF6B6B&excludeIds=48227"

# Custom OKLCH weights (prioritize hue matching over lightness)
curl "https://data.xivdyetools.app/v1/match/closest?hex=FF6B6B&method=oklch-weighted&kL=0.5&kH=2"
```

### 6. Find All Similar Dyes

```bash
# All dyes within distance 0.15 of a color
curl "https://data.xivdyetools.app/v1/match/within-distance?hex=FF6B6B&maxDistance=0.15"

# Limit to top 5 closest
curl "https://data.xivdyetools.app/v1/match/within-distance?hex=FF6B6B&maxDistance=0.15&limit=5"
```

Results are sorted by distance (closest first).

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

---

## Distance Methods Explained

When matching colors, you can choose a distance algorithm. Different methods produce different "closest" results:

| Method | Best For | Notes |
|--------|----------|-------|
| `oklab` | General use (default) | Modern perceptually uniform space. Best all-around choice |
| `ciede2000` | Strict perceptual accuracy | Industry standard for color difference. More expensive to compute |
| `cie76` | Quick perceptual matching | Simpler delta E formula, less accurate for saturated colors |
| `rgb` | Simple applications | Euclidean distance in RGB — not perceptually uniform, but simple |
| `hyab` | Large color differences | Hybrid approach, better for distant colors |
| `oklch-weighted` | Custom priorities | Lets you weight lightness vs chroma vs hue independently |

For most use cases, the default `oklab` is the best choice. Use `oklch-weighted` when you want to emphasize or de-emphasize specific color properties (e.g., "match the hue closely but be flexible on brightness").

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
    "total": 136,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

Errors return:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Human-readable description",
  "details": { ... }
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

- If you exceed the limit, you'll receive a `429` response with a `Retry-After` header
- The `/health` endpoint is not rate-limited

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
| Item ID | >= 5729 | `5729` (Snow White) | Primary game item database ID |
| Stain ID | 1–125 | `1` (Snow White) | Internal stain table index |
| Facewear ID | < 0 | `-1` | Synthetic IDs for Facewear dyes (not tradeable) |

The `marketItemID` field in responses is the ID to use for Universalis market board lookups. After Patch 7.5 consolidation, multiple dyes may share the same `marketItemID`.

---

## Related

- [Full Endpoint Reference](../projects/api-worker/endpoints.md) — Detailed parameter tables and schemas
- [XIV Dye Tools Web App](https://xivdyetools.app) — Interactive color tools
- [Discord Bot](../user-guides/discord-bot/getting-started.md) — Bot commands for dye lookup in Discord
