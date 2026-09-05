# Rate Limiting — Presets API

The Presets API enforces **three** layers of limiting, because the three things worth bounding are
not the same thing: a per-IP edge gate, a per-user fairness gate, and per-user daily quotas on the
mutations that cost something downstream (a moderator's attention, a Perspective call, an R2
object).

## Layer 1: Per-IP Rate Limiting

| Property   | Value                                                        |
|------------|--------------------------------------------------------------|
| Limit      | 100 requests per minute per client IP                        |
| Backend    | The native Workers Rate Limiting binding `RL_PUBLIC` (`[[ratelimits]]`, 100 / 60 s) via `CloudflareRateLimiter`, key prefix `public:`. `MemoryRateLimiter` from `@xivdyetools/worker-kit/rate-limiter` is the per-isolate fallback used only when the binding is unbound (dev / tests) |
| Scope      | `/api/*` (mounted before `authMiddleware`)                   |
| Key        | `CF-Connecting-IP` only — never a caller-supplied header (BUG-044) |
| Middleware | `src/middleware/rate-limit.ts` (`publicRateLimitMiddleware`) |

A request with **no** `CF-Connecting-IP` skips this layer entirely. Cloudflare sets that header at
the edge and overwrites anything a client sends, so its absence means the caller is a Service
Binding inside this account — see [Service-binding callers](#service-binding-callers) below.

## Layer 2: Per-User Rate Limiting

| Property   | Value                                                        |
|------------|--------------------------------------------------------------|
| Limit      | 100 requests per minute per acting Discord user              |
| Backend    | The same `RL_PUBLIC` binding with key prefix `user:` (so the two layers cannot share counters); memory fallback when unbound |
| Scope      | `/api/*`, mounted **after** `authMiddleware`                 |
| Key        | `AuthContext.userDiscordId` — an identity the JWT or the v2 HMAC signature has already established |
| Middleware | `src/middleware/rate-limit.ts` (`perUserRateLimitMiddleware`) |

Unauthenticated requests pass straight through: they have no user to bucket on, and Layer 1 has
already counted them.

### Response Headers

Both middleware layers emit the standard headers on allowed and denied responses alike:

| Header                  | Description                                |
|-------------------------|--------------------------------------------|
| `X-RateLimit-Limit`     | Maximum requests per window                |
| `X-RateLimit-Remaining` | Requests remaining in the current window   |
| `X-RateLimit-Reset`     | Window reset timestamp (Unix seconds, rounded up) |
| `Retry-After`           | Seconds until retry (429 only)             |

### 429 Too Many Requests

The shared middleware in `@xivdyetools/worker-kit` produces this body — note there is **no**
`success` field on it:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 42
}
```

The `Retry-After` header value matches the `retryAfter` field (seconds until the client may retry).

## Layer 3: Per-User Daily Quotas

Four separate daily caps, all keyed on the acting Discord user and all reset at UTC midnight
(`src/services/rate-limit-service.ts`):

| Kind | Cap | Charged on |
|------|-----|------------|
| `submission` | 10 / day | `POST /api/v1/presets` |
| `flagged_edit` | 10 / day | An edit that actually notifies a moderator |
| `preview_upload` | 20 / day | `POST /api/v1/presets/:id/preview-image` |
| `text_edit` | 30 / day | `PATCH /api/v1/presets/:id` when `name` or `description` is sent — checked **before** `moderateContent`, for every preset status (FINDING-005) |

### Storage

There is no `rate_limits` table — it was dropped by `migrations/0006` (REFACTOR-018) after never
being read or written. Counting happens in two places:

- `submission_events` (migration `0011`, extended by `0012`) — an **append-only** row per
  quota-bearing mutation, `(user_discord_id, kind, created_at)`. Nothing a user can do deletes
  these rows, so deleting your own presets cannot refill a quota (FINDING-008).
- the `presets` table itself — the surviving-row count for the current UTC day.

The submission cap is enforced on `getEffectiveSubmissionCountToday()`, which is
`max(presets rows today, submission_events 'submission' rows today)` — the higher of the two. The
other three kinds count `submission_events` rows alone (`checkDailyEventLimit`).

### 429 body

A quota rejection is a handler response, not the middleware's, and has a different shape:

```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "You've reached your daily submission limit (10 per day). Try again tomorrow.",
  "remaining": 0,
  "reset_at": "2026-09-06T00:00:00.000Z"
}
```

On a successful preset submission, the response instead carries the remaining count for the day:

```json
{
  "success": true,
  "preset": { "..." },
  "remaining_submissions": 7
}
```

## Failure Behavior

| Layer | Failure Mode | Rationale |
|-------|--------------|-----------|
| Per-IP / per-user middleware | **Fail-open** (`onError: 'fail-open'`, the worker-kit default) | If the limiter backend errors, the request is allowed. Availability over accuracy. |
| Daily quotas | **Fail-closed** | The count is a D1 query awaited on the request path; a D1 error surfaces as a 500 and the mutation does not happen. |

The `submission_events` **write** is deliberately best-effort in the other direction: a failed
insert is logged and swallowed so a quota bookkeeping error can never fail a mutation that already
landed.

## Service-binding callers

Bot traffic (`discord-worker`, `moderation-worker`) arrives over Service Bindings and carries no
`CF-Connecting-IP`, so it **skips Layer 1** — `getClientIp` would answer the literal `'unknown'`
for every one of them and both bots' entire traffic, every Discord user in every guild, would share
one 100/min bucket (BUG-044). Bots are bounded by Layer 2 instead, where each Discord user gets
their own bucket, and by the Layer 3 quotas exactly as web callers are. Holding `BOT_API_SECRET`
does not exempt a caller from any of it.

## CORS Headers

Rate limit headers are exposed to browser clients via CORS so that the web app can read them:

```
Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
```

## Related Documentation

- [Endpoints](endpoints.md) -- API route reference
- [Moderation](moderation.md) -- Preset moderation workflow
- [Database](database.md) -- D1 schema, including `submission_events`
- [Overview](overview.md) -- Presets API architecture overview
</content>
</invoke>
