# 05 — Response Formats

## Content Negotiation

The API supports two response formats: **JSON** (default) and **XML** (opt-in).

### Format Selection Priority

1. `?format=xml` query parameter (highest priority — explicit override)
2. `Accept: application/xml` request header
3. Default: `application/json`

### Content-Type Headers

| Format | Response Header |
|--------|----------------|
| JSON | `Content-Type: application/json; charset=utf-8` |
| XML | `Content-Type: application/xml; charset=utf-8` |

---

## JSON Response Envelope

All JSON responses use a consistent envelope structure.

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "locale": "en",
    "apiVersion": "v1"
  }
}
```

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `success` | boolean | Yes | Always `true` for 2xx responses |
| `data` | object \| array | Yes | The response payload |
| `pagination` | object | Only for lists | Pagination metadata (see below) |
| `meta` | object | Yes | Request context metadata |

### Error Response

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid hex color format. Expected #RRGGBB.",
  "details": { ... },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "apiVersion": "v1"
  }
}
```

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `success` | boolean | Yes | Always `false` for 4xx/5xx responses |
| `error` | string | Yes | Machine-readable error code |
| `message` | string | Yes | Human-readable error description |
| `details` | object | Sometimes | Additional error context (validation errors, rate limit info) |
| `meta` | object | Yes | Request context metadata |

See [06-error-handling.md](./06-error-handling.md) for the complete error code catalog.

---

## Pagination

Endpoints returning lists support cursor-based pagination with page numbers.

### Query Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | number | `1` | — | Page number (1-based) |
| `perPage` | number | `50` | `200` | Items per page |

### Pagination Metadata

```json
{
  "pagination": {
    "page": 2,
    "perPage": 50,
    "total": 136,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": true
  }
}
```

### When Pagination Applies

| Endpoint | Default perPage | Notes |
|----------|----------------|-------|
| `GET /dyes` | 50 | 136 total dyes; fits in ~3 pages at default |
| `GET /match/within-distance` | 20 | Results capped by `limit` param, not paginated |
| `GET /presets` | 50 | Curated presets are a small set |
| `GET /locales/:locale/dyes` | 200 | Full list usually preferred; single page |
| `GET /character/colors/:category` | — | Not paginated (palettes are small, fixed-size) |

**Non-paginated endpoints** return all results in `data` without a `pagination` field.

---

## XML Response Format

XML responses mirror the JSON structure with these conversion rules:

### Conversion Rules

| JSON | XML |
|------|-----|
| Root object | `<response success="true">` |
| `data` object | `<data>` element |
| `data` array | `<data>` with repeated child elements |
| Array item | Singular form of parent (e.g., `dyes` → `<dye>`) |
| Object property | Child element |
| Number | Text content |
| Boolean | Text content (`true` / `false`) |
| Null | Self-closing element with `nil="true"` |

### Example: JSON vs XML

**JSON:**
```json
{
  "success": true,
  "data": {
    "dye": {
      "itemID": 5729,
      "name": "Snow White",
      "hex": "#EFEFEF",
      "rgb": { "r": 239, "g": 239, "b": 239 },
      "isMetallic": false
    },
    "distance": 12.34,
    "method": "oklab"
  }
}
```

**XML:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response success="true">
  <data>
    <dye>
      <itemID>5729</itemID>
      <name>Snow White</name>
      <hex>#EFEFEF</hex>
      <rgb>
        <r>239</r>
        <g>239</g>
        <b>239</b>
      </rgb>
      <isMetallic>false</isMetallic>
    </dye>
    <distance>12.34</distance>
    <method>oklab</method>
  </data>
  <meta>
    <requestId>abc-123</requestId>
    <apiVersion>v1</apiVersion>
  </meta>
</response>
```

### XML Array Example

**JSON:**
```json
{
  "success": true,
  "data": [
    { "itemID": 5729, "name": "Snow White" },
    { "itemID": 5730, "name": "Ash Grey" }
  ]
}
```

**XML:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response success="true">
  <data>
    <dye>
      <itemID>5729</itemID>
      <name>Snow White</name>
    </dye>
    <dye>
      <itemID>5730</itemID>
      <name>Ash Grey</name>
    </dye>
  </data>
</response>
```

---

## CORS Policy

The public API uses a permissive CORS policy to enable browser-based integrations:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-Key, Accept
Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-Id, X-API-Version
Access-Control-Max-Age: 86400
```

**Key difference from presets-api:** The presets-api restricts `Access-Control-Allow-Origin` to the frontend URL for security (it handles user sessions). The public API uses `*` because it serves read-only data with no user sessions.

---

## Standard Response Headers

Every response includes these headers:

| Header | Example | Description |
|--------|---------|-------------|
| `X-Request-Id` | `550e8400-e29b-41d4...` | Unique request identifier for tracing |
| `X-API-Version` | `v1` | Current API version |
| `X-RateLimit-Limit` | `60` | Rate limit ceiling |
| `X-RateLimit-Remaining` | `42` | Requests remaining in window |
| `X-RateLimit-Reset` | `1702684860` | Unix timestamp when window resets |
| `Cache-Control` | `public, max-age=60` | Caching directive |
| `Content-Type` | `application/json; charset=utf-8` | Response format |

### Cache-Control by Endpoint

| Endpoint Group | Cache-Control | Rationale |
|---------------|---------------|-----------|
| `/dyes/*` | `public, max-age=3600, s-maxage=86400` | Dye data changes only with FFXIV patches |
| `/match/*`, `/harmony/*` | `public, max-age=3600, s-maxage=86400` | Deterministic results from static data |
| `/color/*` | `public, max-age=86400` | Pure computation, always same result |
| `/character/*` | `public, max-age=3600, s-maxage=86400` | Static character data |
| `/presets/*` | `public, max-age=300, s-maxage=3600` | Curated presets update occasionally |
| `/locales/*` | `public, max-age=3600, s-maxage=86400` | Locale data is static |
| `/prices/*` | `public, max-age=300, s-maxage=300, stale-while-revalidate=600` | Market data is semi-volatile |

---

## Compression

Cloudflare automatically handles response compression:

- **Brotli** (`Accept-Encoding: br`) — preferred, best compression ratio
- **gzip** (`Accept-Encoding: gzip`) — fallback
- Enabled by default on Cloudflare Workers; no implementation needed
