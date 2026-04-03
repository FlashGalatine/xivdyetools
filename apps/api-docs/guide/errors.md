# Error Reference

All errors use the same envelope. The `error` field is a stable machine-readable code — safe to `switch` on in your application code.

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Dye with ID 999999 not found.",
  "details": { "id": 999999 },
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
| `INVALID_CATEGORY` | 400 | Unknown category name |
| `NOT_FOUND` | 404 | Dye, stain, or route not found |
| `RATE_LIMITED` | 429 | Rate limit exceeded |

### Server Errors (5xx)

| Code | HTTP | Description |
|---|---|---|
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Upstream service unavailable |
| `UPSTREAM_ERROR` | 502 | Upstream returned an error |

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

For multiple validation errors in the same request:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Multiple validation errors.",
  "details": {
    "errors": [
      { "parameter": "perPage", "received": "500", "expected": "<= 200" },
      { "parameter": "order", "received": "random", "expected": "asc or desc" }
    ]
  }
}
```

## Hex Color Rules

| Rule | Detail |
|---|---|
| Format | `/^#?[0-9A-Fa-f]{6}$/` |
| Missing `#` | Auto-prepended — `FF0000` is valid |
| Case | Case-insensitive |
| 3-digit shorthand | **Not supported** — `#F00` returns `INVALID_HEX` |

## Numeric Ranges (Phase 1)

| Parameter | Range | Default |
|---|---|---|
| `page` | ≥ 1 | `1` |
| `perPage` | 1 – 200 | `50` |
| `stainId` (path) | ≥ 1 | — |
| `maxDistance` | > 0 | — |
| `limit` (within-distance) | 1 – 136 | `20` |
| `kL`, `kC`, `kH` | > 0 | `1.0` |

## Enum Values (Phase 1)

| Parameter | Valid values |
|---|---|
| `locale` | `en` `ja` `de` `fr` `ko` `zh` |
| `method` (matching) | `rgb` `cie76` `ciede2000` `oklab` `hyab` `oklch-weighted` |
| `sort` (dyes) | `name` `brightness` `saturation` `hue` `cost` |
| `order` | `asc` `desc` |
| `idType` (batch) | `auto` `item` `stain` |
| `consolidationType` | `A` `B` `C` `none` |

## Rate Limited Response

A `429` response includes actionable retry information:

```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Rate limit exceeded. 60 requests per minute allowed for anonymous access.",
  "details": {
    "limit": 60,
    "remaining": 0,
    "resetAt": "2025-12-15T12:01:00Z",
    "retryAfter": 30,
    "tier": "anonymous"
  },
  "meta": { ... }
}
```

The `Retry-After` header is also set on 429 responses. See [Rate Limits](./rate-limits).
