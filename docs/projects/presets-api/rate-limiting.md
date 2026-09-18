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
other three kinds count `submission_events` rows alone, through `reserveDailyEvent()` (presets-api
2.3.5, BUG-015 of the 2026-09-16 deep-dive): the event row is inserted **first**, the day's rows
are counted including it, and a count over the cap deletes that row and refuses — so two
concurrent edits can no longer both pass a check-then-insert. A handler whose mutation fails after
the reservation releases the row again (best effort). Two trades come with the shape: a refused
request now costs a prune DELETE + INSERT + COUNT + DELETE where it used to cost one COUNT (bounded
by the per-IP limiter), and a request abandoned between the reservation and its completion keeps
its slot until UTC midnight. The reservation itself stays best-effort — a D1 write error leaves the
cap inert for that request rather than failing the edit, as before. Concurrent requests racing for
the same last free slot are settled deterministically: the count is bounded to rows with
`id <= ` the reservation's own row id (presets-api 2.3.6, PR review fix round 2), so exactly one
of them lands at or below the cap and wins — the earlier round counted every row regardless of id,
so with one slot free and two or more concurrent requests, every single one of them observed the
cap already exceeded and refused, and nobody got the slot.

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
| Daily quotas — `submission` (`checkSubmissionRateLimit`) | **Fail-closed** | The count is a D1 query awaited on the request path; a D1 error surfaces as a 500 and the mutation does not happen. |
| Daily quotas — `text_edit` / `flagged_edit` / `preview_upload` (`reserveDailyEvent`) | **Fail-open** | An INSERT or COUNT error logs a `[BUG-015]` warning and lets the request through unmetered, rather than 500ing a mutation because a hand-run migration (`0012_submission_events_text_edit.sql`) is missing in a given environment. |

The `submission_events` **write** is best-effort, but the shape differs by kind. For `submission`,
`recordSubmissionEvent` writes only *after* the preset row has already been created
(`handlers/presets.ts`), so a failed insert there truly can never fail a mutation that already
landed — there is nothing left it could roll back. For the three `reserveDailyEvent` kinds the
order is reversed: the insert precedes the mutation it gates, so a failed INSERT or COUNT instead
fails the *reservation* open (see the table above) rather than failing closed — the mutation that
follows was never at risk of being undone, because it has not happened yet.

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
