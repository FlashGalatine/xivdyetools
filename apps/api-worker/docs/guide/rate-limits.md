# Rate Limits

## Current Limits

Every endpoint is anonymous. There is no API key required.

| Surface | Rate limit | Burst |
|---|---|---|
| `/v1/*` — anonymous (all users) | 60 req/min per IP (per-colo fixed window) | +5 |
| `/health`, `/` | not rate-limited | — |

The burst allowance lets you fire a quick burst of up to 65 requests before the sliding window kicks in.

## Rate Limit Headers

Every `/v1/*` response includes rate limit headers regardless of status:

```http
X-RateLimit-Limit: 65
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1702684860
```

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Total requests allowed per window (60 + 5 burst) |
| `X-RateLimit-Remaining` | **At least this many more requests are available** — not an exact countdown. See the note below. |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

::: warning `X-RateLimit-Remaining` is not a countdown
The production limiter is Cloudflare's native per-colo binding, which reports
whether *this* request was allowed rather than how many remain. Every allowed
request therefore carries the same value, and the first refused one carries `0`
— the number does not tick down as you go.

Use it as a boolean ("is there headroom?"), and drive backoff from the `429`
itself: `Retry-After` and `X-RateLimit-Reset` are exact.
:::

On `429` responses, `Retry-After` is also set (seconds to wait).

## Handling 429

When you receive a `429`:

1. Check `X-RateLimit-Reset` or `Retry-After` to know when to retry
2. Back off and retry after the window resets
3. If you need more than 60 req/min, registered API keys with a 300 req/min limit are planned

```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Rate limit exceeded. 60 requests per minute allowed. Retry after the indicated number of seconds.",
  "retryAfter": 30,
  "meta": { "requestId": "...", "apiVersion": "v1" }
}
```

## Tips for Staying Under Limits

- **Cache on your end.** Dye data is stable between FFXIV patches. Cache responses with `Cache-Control: max-age=3600`.
- **Use `/v1/dyes`** to paginate through all 125 entries in a few requests rather than fetching individually.
- **Use `/v1/dyes/batch`** for up to 50 dye lookups in a single request.

## CORS Preflight

CORS `Access-Control-Max-Age` is `3600` (1 hour) on every route — browsers will cache the preflight `OPTIONS` response for one hour before re-asking. (Reduced from 24h in v0.4.0 to allow CORS policy changes to propagate within an hour.)

## Planned: API keys

Optional API key registration for higher rate limits is planned:

| Tier | Rate limit |
|---|---|
| Anonymous | 60 req/min |
| Registered (free) | 300 req/min |

Registration will use Discord OAuth and take about 30 seconds. No manual approval.
