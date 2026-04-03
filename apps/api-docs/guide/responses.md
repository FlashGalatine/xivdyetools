# Responses

All responses use a consistent JSON envelope regardless of endpoint.

## Success

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

| Field | Type | Description |
|---|---|---|
| `success` | `true` | Always `true` on 2xx responses |
| `data` | object \| array | The response payload |
| `meta.requestId` | string | UUID — echo this when reporting issues |
| `meta.apiVersion` | string | `"v1"` |
| `meta.locale` | string | Effective locale used for this response |

## Errors

```json
{
  "success": false,
  "error": "INVALID_HEX",
  "message": "Invalid hex color format. Expected #RRGGBB or RRGGBB.",
  "details": {
    "parameter": "hex",
    "received": "not-a-color",
    "expected": "Hex color string matching /^#?[0-9A-Fa-f]{6}$/"
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "apiVersion": "v1"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `success` | `false` | Always `false` on 4xx/5xx responses |
| `error` | string | Machine-readable error code — safe to `switch` on |
| `message` | string | Human-readable description |
| `details` | object? | Additional context (which param, what was received) |

See the [Error Reference](./errors) for the full code catalog.

## Paginated Lists

Endpoints returning arrays include a `pagination` field alongside `data`:

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 2,
    "perPage": 50,
    "total": 136,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": true
  },
  "meta": { ... }
}
```

Control pagination with `?page=` and `?perPage=` (max 200). Non-paginated endpoints (`/search`, `/categories`, `/match/*`) return all results in `data` without a `pagination` field.

## Response Headers

Every response includes these headers:

| Header | Example | Description |
|---|---|---|
| `X-Request-ID` | `550e8400-…` | Unique ID — matches `meta.requestId` in body |
| `X-API-Version` | `v1` | API version |
| `X-RateLimit-Limit` | `65` | Requests allowed per window (60 + 5 burst) |
| `X-RateLimit-Remaining` | `42` | Requests remaining in this window |
| `X-RateLimit-Reset` | `1702684860` | Unix timestamp when the window resets |
| `Cache-Control` | `public, max-age=3600, s-maxage=86400` | Caching directives |
| `Access-Control-Allow-Origin` | `*` | Open CORS — callable from any origin |

## Caching

Dye data is deterministic and changes only with FFXIV patches, so aggressive caching is safe:

| Endpoint group | Cache-Control |
|---|---|
| `/v1/dyes/*` | `public, max-age=3600, s-maxage=86400` |
| `/v1/match/*` | `public, max-age=3600, s-maxage=86400` |

The `Age` header (set by Cloudflare) tells you how old the cached response is. A fresh cache hit means sub-millisecond response time at the nearest PoP.

## Compression

Cloudflare automatically negotiates Brotli or gzip based on your `Accept-Encoding` header. No configuration needed.
