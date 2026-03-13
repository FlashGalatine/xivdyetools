# Rate Limiting - Presets API v1.4.15

The Presets API enforces a two-tier rate limiting strategy: a global IP-based limit on all endpoints and a per-user submission limit on preset creation.

## Two-Tier Rate Limiting

### Tier 1: IP-Based Rate Limiting

| Property   | Value                                                        |
|------------|--------------------------------------------------------------|
| Limit      | 100 requests per minute per IP                               |
| Algorithm  | Sliding window via `@xivdyetools/rate-limiter` (Memory backend) |
| Scope      | All endpoints                                                |
| Middleware | `src/middleware/rate-limit.ts`                               |

#### Response Headers

Every response includes the following rate limit headers:

| Header                  | Description                                |
|-------------------------|--------------------------------------------|
| `X-RateLimit-Limit`     | Maximum requests per window                |
| `X-RateLimit-Remaining` | Requests remaining in the current window   |
| `X-RateLimit-Reset`     | Window reset timestamp (Unix seconds)      |

#### 429 Too Many Requests

When the IP rate limit is exceeded, the API responds with HTTP 429 and a `Retry-After` header:

```json
{
  "success": false,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 42
}
```

The `Retry-After` header value matches the `retryAfter` field in the response body (seconds until the client may retry).

### Tier 2: User-Based Submission Rate Limiting

| Property | Value                                                     |
|----------|-----------------------------------------------------------|
| Limit    | 10 preset submissions per day per user                    |
| Storage  | D1 `rate_limits` table (not KV -- needs atomic increment) |
| Reset    | UTC midnight (daily window)                               |
| Scope    | `POST /api/v1/presets` only                               |
| Service  | `src/services/rate-limit-service.ts`                      |

On a successful preset submission, the response includes the remaining submission count for the day:

```json
{
  "success": true,
  "preset": { "..." },
  "remaining_submissions": 7
}
```

## Failure Behavior

The two tiers have intentionally different failure modes:

| Tier                    | Failure Mode | Rationale                                            |
|-------------------------|--------------|------------------------------------------------------|
| IP rate limiter         | **Fail-open**   | If the backend is unavailable, the request is allowed. Availability is prioritized over accuracy. |
| Submission rate limiter | **Fail-closed** | If D1 is unavailable, the submission is rejected. This prevents abuse during outages.             |

## Bot API Key

Authentication via the bot API key (`BOT_API_SECRET`) does **not** bypass rate limits. Both the Discord bot and the web app are subject to the same IP-based and submission rate limits.

## CORS Headers

Rate limit headers are exposed to browser clients via CORS so that the web app can read them:

```
Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
```

## Related Documentation

- [Endpoints](endpoints.md) -- API route reference
- [Moderation](moderation.md) -- Preset moderation workflow
- [Database](database.md) -- D1 schema including the `rate_limits` table
- [Overview](overview.md) -- Presets API architecture overview
