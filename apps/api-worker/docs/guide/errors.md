# Error Reference

All `/v1` errors use the same envelope. The `error` field is a stable machine-readable code — safe to `switch` on in your application code.

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "No dye found with ID 999999.",
  "meta": { "requestId": "...", "apiVersion": "v1" }
}
```

## Error Codes

### Client Errors (4xx)

| Code | HTTP | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid parameter value or format |
| `MISSING_PARAMETER` | 400 | Required parameter not provided |
| `INVALID_HEX` | 400 | Hex color format invalid |
| `INVALID_MATCHING_METHOD` | 400 | Unknown color distance algorithm |
| `INVALID_LOCALE` | 400 | Unsupported locale code |
| `INVALID_STAIN_ID` | 400 | stainId is not a positive integer |
| `INVALID_COLOR_WHEEL` | 400 | `wheel` (or the `/v1/wheels/:id` path) is not one of the five wheel ids — `details.expected` lists them |
| `INVALID_HARMONY_TYPE` | 400 | `type` is not one of the ten harmony types — `details.expected` lists them |
| `INVALID_BODY` | 400 / 413 | `POST /v1/chara/resolve` body is not a JSON object (400) or exceeds 8 KB (413) |
| `NOT_FOUND` | 404 | Dye, stain, icon, or route not found — also returned for consolidated market itemIDs (`52254`–`52256`) and legacy negative Facewear IDs, each with an explanatory `message` (an unknown `category` is not an error; it simply matches no dyes) |
| `RATE_LIMITED` | 429 | Rate limit exceeded |

### Server Errors (5xx)

| Code | HTTP | Description |
|---|---|---|
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `UPSTREAM_UNAVAILABLE` | 503 | XIVAPI is down, timed out, or re-indexing after a game patch — only on `/v1/chara/*`, which is the one surface with an upstream. Retry later. |

The dye and matching endpoints have no upstream, so they never answer `502` / `503`.

## Validation Details

When validation fails, `details` includes the offending parameter:

```json
{
  "error": "INVALID_HEX",
  "details": {
    "parameter": "hex",
    "received": "#F53",
    "expected": "Hex color string matching /^#?[0-9A-Fa-f]{6}$/"
  }
}
```

Validation stops at the first failing parameter — a response never reports more than one validation error, so fix them one at a time:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Parameter \"perPage\" must be <= 200.",
  "details": { "parameter": "perPage", "received": 500, "expected": "<= 200" }
}
```

## Hex Color Rules

| Rule | Detail |
|---|---|
| Format | `/^#?[0-9A-Fa-f]{6}$/` |
| Missing `#` | Auto-prepended — `FF0000` is valid |
| Case | Case-insensitive |
| 3-digit shorthand | **Not supported** — `#F00` returns `INVALID_HEX` |

## Numeric Ranges

| Parameter | Range | Default |
|---|---|---|
| `page` | ≥ 1 | `1` |
| `perPage` | 1 – 200 | `50` |
| `stainId` (path) | ≥ 1 | — |
| `minPrice`, `maxPrice` | ≥ 0 | — |
| `ids` (batch), `excludeIds` | ≤ 50 comma-separated integers | — |
| `maxDistance` | ≥ 0.01 | — |
| `limit` (within-distance) | 1 – 125 (the whole dye database) | `20` |
| `iconId` (path) | 1 – 999999, canonical decimal | — |
| `stops` (wheels) | 3 – 360 | `72` |
| `companions` (harmony) | 0 – 5 | `0` |

## Enum Values

| Parameter | Valid values |
|---|---|
| `locale` | `en` `ja` `de` `fr` `ko` `zh` |
| `method` (matching) | `ciede2000` (default) `oklab` `cie76` `redmean` `rgb` `distinguish` — the retired `hyab` / `oklch-weighted` are still accepted and silently normalised to `ciede2000` (`euclidean` → `rgb`); the old `kL`/`kC`/`kH` weights are ignored |
| `sort` (dyes) | `name` `brightness` `saturation` `hue` `cost` |
| `order` | `asc` `desc` |
| `idType` (batch) | `auto` `item` `stain` |
| `consolidationType` | `A` `B` `C` |
| `wheel` (harmony) | `rgb` (default) `ryb` `munsell` `oklch-hue` `oklch-lightness` |
| `type` (harmony) | `complementary` (default) `analogous` `triadic` `split-complementary` `tetradic` `inverted-tetradic` `square` `monochromatic` `compound` `shades` |
| `strict`, `preventDuplicates` (harmony) | `true` `false` `1` `0` |

## Rate Limited Response

A `429` response carries the seconds to wait as a top-level `retryAfter` field:

```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Rate limit exceeded. 60 requests per minute allowed. Retry after the indicated number of seconds.",
  "retryAfter": 30,
  "meta": { ... }
}
```

(API keys are not yet available — see [Rate Limits](./rate-limits) — the message anticipates them.)

The `Retry-After` header is also set on 429 responses. See [Rate Limits](./rate-limits).
