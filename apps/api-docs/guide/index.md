# Quick Start

The XIV Dye Tools API is a public REST API serving the FFXIV dye database and color matching algorithms. No account, no API key, no setup.

## Base URL

```
https://data.xivdyetools.app/v1
```

All endpoints are prefixed with `/v1`. Responses are JSON by default.

## Your First Request

Fetch Snow White (stainID 1):

```bash
curl https://data.xivdyetools.app/v1/dyes/1
```

```json
{
  "success": true,
  "data": {
    "itemID": 5729,
    "stainID": 1,
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
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "apiVersion": "v1",
    "locale": "en"
  }
}
```

Every response has the same `{ success, data, meta }` envelope. See [Responses](./responses) for the full spec.

## Dye ID Auto-Detection

Most ID endpoints accept any of three numeric ID types. The type is inferred by range:

| Range | Type | Example |
|-------|------|---------|
| `< 0` | Facewear (synthetic) | `-1` |
| `1 – 125` | stainID (game stain table) | `1` = Snow White |
| `≥ 5729` | itemID (game item database) | `5729` = Snow White |
| `126 – 5728` | *(invalid gap)* | Returns `404` |

```bash
# All three resolve to Snow White
curl https://data.xivdyetools.app/v1/dyes/1       # stainID
curl https://data.xivdyetools.app/v1/dyes/5729    # itemID
curl https://data.xivdyetools.app/v1/dyes/stain/1 # explicit stainID
```

## Localization

Add `?locale=` to any dye endpoint to get localized names. Supported: `en`, `ja`, `de`, `fr`, `ko`, `zh`.

```bash
curl https://data.xivdyetools.app/v1/dyes/1?locale=ja
```

```json
{
  "data": {
    "name": "Snow White",
    "localizedName": "スノーホワイト",
    ...
  }
}
```

## What's Available

**Phase 1 (now):** 9 endpoints — dye lookup, filtering, search, batch, and color matching.

| Endpoint group | Docs |
|---|---|
| `/v1/dyes/*` | [Dyes Reference](../reference/dyes) |
| `/v1/match/*` | [Matching Reference](../reference/matching) |

**Phase 2 (planned):** Community presets, optional API keys for higher rate limits.

**Phase 3 (planned):** Live Universalis market prices.

## Rate Limits

Anonymous requests: **60 per minute** per IP. Responses include `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers. See [Rate Limits](./rate-limits).
