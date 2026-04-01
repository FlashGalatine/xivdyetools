# 06 — Error Handling

## Error Response Format

All errors follow a consistent JSON structure (see [05-response-formats.md](./05-response-formats.md) for XML equivalents):

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
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

---

## Error Code Catalog

### Client Errors (4xx)

| Error Code | HTTP Status | Description | When |
|-----------|-------------|-------------|------|
| `VALIDATION_ERROR` | 400 | Invalid input parameter | Bad hex, out-of-range number, unknown enum value |
| `MISSING_PARAMETER` | 400 | Required parameter not provided | `hex` missing on `/match/closest` |
| `INVALID_HEX` | 400 | Hex color format invalid | Doesn't match `#RRGGBB` or `RRGGBB` |
| `INVALID_COLOR_SPACE` | 400 | Unknown color space name | `from=xyz` on `/color/convert` |
| `INVALID_MATCHING_METHOD` | 400 | Unknown matching method | `method=foo` on `/match/closest` |
| `INVALID_HARMONY_TYPE` | 400 | Unknown harmony type | Invalid `algorithm` or `colorSpace` |
| `INVALID_VISION_TYPE` | 400 | Unknown vision type | `type=foo` on `/color/simulate` |
| `INVALID_LOCALE` | 400 | Unsupported locale code | `locale=es` (not one of en/ja/de/fr/ko/zh) |
| `INVALID_SUBRACE` | 400 | Unknown subrace name | `subrace=Lalafell` (should be `Dunesfolk` or `Plainsfolk`) |
| `INVALID_GENDER` | 400 | Invalid gender value | Not `Male` or `Female` |
| `INVALID_CATEGORY` | 400 | Unknown color/preset category | `category=invalid` |
| `INVALID_API_KEY` | 401 | API key not recognized | Key hash not found in D1 |
| `KEY_REVOKED` | 401 | API key has been deactivated | `is_active = false` in D1 |
| `FORBIDDEN` | 403 | Access denied | Banned IP or key |
| `INVALID_STAIN_ID` | 400 | Invalid stain ID | `stainId` is not a positive integer, or is 0 |
| `NOT_FOUND` | 404 | Resource not found | Unknown dye ID, stain ID, preset ID |
| `RATE_LIMITED` | 429 | Rate limit exceeded | Too many requests in window |

### Server Errors (5xx)

| Error Code | HTTP Status | Description | When |
|-----------|-------------|-------------|------|
| `INTERNAL_ERROR` | 500 | Unexpected server error | Unhandled exception |
| `SERVICE_UNAVAILABLE` | 503 | Upstream service down | Universalis unreachable, D1 unavailable |
| `UPSTREAM_ERROR` | 502 | Upstream returned error | Universalis returned 5xx |

---

## Input Validation Rules

### Hex Color

| Rule | Constraint | Auto-correction |
|------|-----------|-----------------|
| Format | `/^#?[0-9A-Fa-f]{6}$/` | Missing `#` is auto-prepended |
| Case | Case-insensitive | Normalized to uppercase |
| Length | Exactly 6 hex digits (after `#`) | 3-digit shorthand NOT supported |

**Examples:**
- `#FF5733` — valid
- `FF5733` — valid (auto-prepended `#`)
- `ff5733` — valid (normalized)
- `#F53` — invalid (3-digit shorthand not supported)
- `red` — invalid

### Numeric Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `stainId` (path) | integer | >= 1 | — |
| `ratio` | float | 0.0 – 1.0 | 0.5 |
| `angle` | float | 0 – 360 | 30 |
| `maxDistance` | float | > 0 | — |
| `limit` | integer | 1 – 136 | varies |
| `steps` | integer | 2 – 50 | 5 |
| `count` | integer | 1 – 20 | 3 |
| `page` | integer | >= 1 | 1 |
| `perPage` | integer | 1 – 200 | 50 |
| `kL`, `kC`, `kH` | float | > 0 | 1.0 |
| `r`, `g`, `b` (RGB) | integer | 0 – 255 | — |
| `h` (HSV/HSL) | float | 0 – 360 | — |
| `s`, `v` (HSV) | float | 0 – 100 | — |
| `s`, `l` (HSL) | float | 0 – 100 | — |
| `L` (LAB) | float | 0 – 100 | — |
| `a`, `b` (LAB) | float | -128 – 127 | — |
| `L` (OKLAB) | float | 0 – 1 | — |
| `a`, `b` (OKLAB) | float | -0.5 – 0.5 | — |
| `L` (OKLCH) | float | 0 – 1 | — |
| `C` (OKLCH) | float | 0 – 0.5 | — |
| `h` (OKLCH/LCH) | float | 0 – 360 | — |

### Enum Parameters

| Parameter | Valid Values |
|-----------|-------------|
| `locale` | `en`, `ja`, `de`, `fr`, `ko`, `zh` |
| `method` (matching) | `rgb`, `cie76`, `ciede2000`, `oklab`, `hyab`, `oklch-weighted` |
| `formula` (distance) | `rgb`, `cie76`, `ciede2000`, `oklab`, `hyab` |
| `algorithm` (harmony) | `hue`, `deltaE` |
| `colorSpace` (harmony) | `hsv`, `oklch`, `lch`, `hsl` |
| `type` (vision) | `deuteranopia`, `protanopia`, `tritanopia`, `achromatopsia` |
| `from`, `to` (conversion) | `hex`, `rgb`, `hsv`, `hsl`, `lab`, `lch`, `oklab`, `oklch`, `ryb` |
| `idType` (dye batch) | `auto`, `item`, `stain` |
| `consolidationType` (dyes) | `A`, `B`, `C`, `none` |
| `sort` (dyes) | `name`, `brightness`, `saturation`, `hue`, `cost` |
| `order` | `asc`, `desc` |
| `gender` | `Male`, `Female` |
| `category` (character) | `eyeColors`, `highlightColors`, `lipColorsDark`, `lipColorsLight`, `tattooColors`, `facePaintColorsDark`, `facePaintColorsLight`, `hairColors`, `skinColors` |
| `category` (presets) | `jobs`, `seasons`, `themes`, `events`, `aesthetics`, `curated` |
| `hueMethod` | `shorter`, `longer`, `increasing`, `decreasing` |
| `format` | `json`, `xml` |

### Comma-Separated Lists

| Parameter | Max Items | Item Validation |
|-----------|----------|----------------|
| `ids` (dye batch) | 50 | Integers — itemIDs, stainIDs (1–125), or negative Facewear IDs when `idType=auto`; positive integers only when `idType=item`; positive integers when `idType=stain` |
| `excludeIds` | 50 | Integers — supports auto-detection (itemIDs, stainIDs, negative Facewear IDs) |
| `itemIds` (prices) | 100 | Positive integers (Universalis limit) — itemIDs only, no stainID support |

---

## Validation Error Details

When a `VALIDATION_ERROR` occurs, the `details` object provides machine-readable context:

### Single Parameter Error

```json
{
  "error": "INVALID_HEX",
  "message": "Invalid hex color format. Expected #RRGGBB or RRGGBB.",
  "details": {
    "parameter": "hex",
    "received": "not-a-color",
    "expected": "Hex color string matching /^#?[0-9A-Fa-f]{6}$/"
  }
}
```

### Multiple Parameter Errors

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Multiple validation errors.",
  "details": {
    "errors": [
      {
        "parameter": "ratio",
        "received": "1.5",
        "expected": "Number between 0.0 and 1.0"
      },
      {
        "parameter": "method",
        "received": "invalid",
        "expected": "One of: rgb, cie76, ciede2000, oklab, hyab, oklch-weighted"
      }
    ]
  }
}
```

### Missing Required Parameter

```json
{
  "error": "MISSING_PARAMETER",
  "message": "Required parameter 'hex' is missing.",
  "details": {
    "parameter": "hex",
    "required": true
  }
}
```

---

## Error Handling Middleware

Implement as Hono `onError` handler, consistent with presets-api:

```typescript
app.onError((err, c) => {
  const requestId = c.get('requestId');

  if (err instanceof ApiError) {
    return c.json({
      success: false,
      error: err.code,
      message: err.message,
      details: err.details,
      meta: { requestId, apiVersion: 'v1' }
    }, err.statusCode);
  }

  // Unexpected errors: log full details, return generic message
  logger.error('Unhandled error', { error: err, requestId });
  return c.json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
    meta: { requestId, apiVersion: 'v1' }
  }, 500);
});

app.notFound((c) => {
  return c.json({
    success: false,
    error: 'NOT_FOUND',
    message: `Endpoint ${c.req.method} ${c.req.path} not found.`,
    meta: { requestId: c.get('requestId'), apiVersion: 'v1' }
  }, 404);
});
```

---

## Rate Limit Error Enrichment

When returning a 429, include actionable information:

```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Rate limit exceeded. Register for a free API key to increase your limit from 60 to 300 requests per minute.",
  "details": {
    "limit": 60,
    "remaining": 0,
    "resetAt": "2025-12-15T12:01:00Z",
    "retryAfter": 30,
    "tier": "anonymous",
    "registrationUrl": "https://api.xivdyetools.com/register"
  },
  "meta": {
    "requestId": "abc-123",
    "apiVersion": "v1"
  }
}
```
