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
| Key        | `CF-Connecting-IP` only; IPv6 addresses share their /64, IPv4 is unchanged — never a caller-supplied header (BUG-044) |
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
| `submission` | 10 / day | Atomic admission before moderation; spent attempts remain counted even if creation fails |
| `flagged_edit` | 10 / day | An edit that actually notifies a moderator |
| `preview_upload` | 20 / day | `POST /api/v1/presets/:id/preview-image` |
| `text_edit` | 30 / day | `PATCH /api/v1/presets/:id` when name/description differs from storage, plus changed tags/example links only when extended checks are enabled — checked **before** `moderateContent`, for every preset status (FINDING-005) |

### Storage

There is no `rate_limits` table — it was dropped by `migrations/0006` (REFACTOR-018) after never
being read or written. Counting happens in two places:

- `submission_events` (migration `0011`, extended by `0012`) — an **append-only** row per
  quota-bearing mutation, `(user_discord_id, kind, created_at)`. Nothing a user can do deletes
  these rows, so deleting your own presets cannot refill a quota (FINDING-008).
- the `presets` table itself — the surviving-row count for the current UTC day.

Submission admission uses a single conditional `INSERT … SELECT … RETURNING id` before
moderation. Usage is the current UTC window's submission events **plus** same-user current-window
preset rows not represented by any retained submission event for that same user/preset/kind.
The anti-join has no window filter: an earlier retained event still represents a preset. Admission
and `/rate-limit` reporting use the same formula. The denied request writes no event and calls no
scorer, create, vote or notification. Admission database failure returns 503 before expensive work.
Known duplicates found before moderation may convert to votes without spending an attempt;
post-moderation collisions or create failures keep the spent attempt. Age-only pruning remains
best-effort and never makes admission fail open. Event IDs use the preallocated preset ID.

The other three kinds still use `reserveDailyEvent()`: insert first, count through the reservation's
own ID, and release a refused reservation. Their backend failure policy remains fail-open; this
sprint does not establish an unconditional ceiling for them. Text-edit attempts are spent before
moderation even when a later edit fails. Identical moderated fields are free. Tag/link-only edits
join this accounting only when extended checks are enabled (the preparation default is disabled).

Preview uploads retain a slot on image-worker fetch/status/body/timeout or decoding failures.
Cheap validation rejection and proven R2/DB/CAS failure refund; storage/database refunds can allow
additional processing attempts. An unconfirmed database write retains its event and returns 503;
a changed latest key alone does not prove that attachment never committed. Confirmed committed
attachments remain charged even when subsequently replaced. Cleanup/refund failures do not mask
the original result. D1 and R2 do not form one transaction.

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
| Daily quotas — `submission` (`reserveSubmissionAdmission`) | **Fail-closed** | Conditional admission failure returns 503 before moderation; reporting query errors remain request failures. |
| Daily quotas — `text_edit` / `flagged_edit` / `preview_upload` (`reserveDailyEvent`) | **Fail-open** | An INSERT or COUNT error logs a `[BUG-015]` warning and lets the request through unmetered, rather than 500ing a mutation because a hand-run migration (`0012_submission_events_text_edit.sql`) is missing in a given environment. |

Submission event admission is required; the separate three-kind reservation helper remains
best-effort as described above. No post-create append or compensating preset deletion enforces
the submission limit.

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
