# Rate Limits

## Current Limits (Phase 1)

All Phase 1 endpoints are anonymous. There is no API key required.

| Tier | Rate limit | Burst |
|---|---|---|
| Anonymous (all users) | 60 req/min per IP | +5 |

The burst allowance lets you fire a quick burst of up to 65 requests before the sliding window kicks in.

## Rate Limit Headers

Every response includes rate limit headers regardless of status:

```http
X-RateLimit-Limit: 65
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1702684860
```

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Total requests allowed per window (60 + 5 burst) |
| `X-RateLimit-Remaining` | Requests remaining before limit is hit |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

On `429` responses, `Retry-After` is also set (seconds to wait).

## Handling 429

When you receive a `429`:

1. Check `X-RateLimit-Reset` or `Retry-After` to know when to retry
2. Back off and retry after the window resets
3. If you need more than 60 req/min, Phase 2 will introduce registered API keys with a 300 req/min limit

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
  }
}
```

## Tips for Staying Under Limits

- **Cache on your end.** Dye data is stable between FFXIV patches. Cache responses with `Cache-Control: max-age=3600`.
- **Use `/v1/dyes`** to fetch all 136 dyes in a single paginated request rather than fetching individually.
- **Use `/v1/dyes/batch`** for up to 50 dye lookups in a single request.

## Coming in Phase 2

Phase 2 will introduce optional API key registration for higher rate limits:

| Tier | Rate limit |
|---|---|
| Anonymous | 60 req/min |
| Registered (free) | 300 req/min |

Registration will use Discord OAuth and take about 30 seconds. No manual approval.
