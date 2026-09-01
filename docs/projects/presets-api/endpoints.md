# Presets API — Endpoint Reference (v2.0.0)

Full API reference for the Presets API Cloudflare Worker.

> **2.0.0 (5.0 wave):** preset `dyes` are **stainIDs (1–254), 3–6 per preset** — legacy itemIDs
> (≥ 5729) are rejected with "looks like a legacy item ID"; the `community` category is gone
> (migration 0007) and `appearance` / `zones` / `raids-trials` were added; a preset carries one
> primary `category_id` plus up to two `secondary_categories` (0010), an optional `example_link`
> (0008), and a moderated preview image (`preview_image_key` / `preview_image_status`, 0009 — R2
> via image-worker `POST /thumbnail`, served from `shots.xivdyetools.app`); rejections carry a
> `rejection_reason`. Route list below is transcribed from `src/handlers/*.ts`.

---

## Health

### `GET /`

Returns basic service information.

### `GET /health`

Health check endpoint. Returns service status with a timestamp.

---

## Categories

### `GET /api/v1/categories`

List all preset categories with their preset counts.

**Caching:** 60s edge cache, 30s browser cache.

**Response:**

```json
{
  "categories": [...]
}
```

---

## Presets (Public)

Every preset leaving this Worker over HTTP passes through `toPublicPreset()`
(`services/preset-service.ts`), which decides who sees the author's Discord id (FINDING-016,
2026-08-29 audit):

| Caller | `author_discord_id` | `is_owner` |
|--------|---------------------|------------|
| Anonymous | absent | absent |
| Web (JWT), someone else's preset | absent | `false` |
| Web (JWT), own preset | present | `true` |
| Web (JWT), moderator | present | `true` / `false` |
| Bot (HMAC) | present | absent (bot responses are unchanged) |

`author_name` is the author identity the gallery shows and is sent to everyone. The moderation
routes and the server-to-bot notification payloads keep the id.

### `GET /api/v1/presets`

List approved presets with pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | `1` | Page number (clamped to ≥ 1) |
| `limit` | number | `20` | Results per page (clamped to 1–50) |
| `category` | string | — | Filter by category |
| `sort` | string | — | Sort order: `popular`, `recent`, or `name` |
| `search` | string | — | Free-text search |
| `status` | string | `approved` | Moderators only for anything other than `approved`; unknown values → 400 |
| `is_curated` | `true` \| `false` | — | Restrict to curated (or community) presets |

There is no `tags` filter — tags are stored on the preset and returned in the response, but the
list endpoint does not filter by them. Non-moderators only ever see `approved` presets and the
audit fields are stripped from their responses.

**Response:**

```json
{
  "presets": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### `GET /api/v1/presets/featured`

Get featured presets.

### `GET /api/v1/presets/:id`

Get a single preset by ID.

---

## Presets (Authenticated)

All endpoints in this section require a JWT Bearer token in the `Authorization` header.

### `POST /api/v1/presets`

Submit a new preset.

**Rate Limit:** 10 submissions per day per user (UTC reset).

**Request Body:**

| Field | Type | Constraints |
|-------|------|-------------|
| `name` | string | 2-50 characters |
| `description` | string | 10-200 characters |
| `dyes` | number[] | 3-6 stainIDs (1-254); legacy itemIDs rejected |
| `tags` | string[] | Max 10 tags, each max 30 characters |
| `category_id` | string | One of `jobs`, `grand-companies`, `seasons`, `events`, `aesthetics`, `appearance`, `zones`, `raids-trials` |
| `secondary_categories` | string[] | Optional, max 2, must not repeat `category_id` |
| `example_link` | string | Optional URL to a page about the glamour (validated + normalised) |

**Moderation:** Runs content moderation on submission (local profanity filter + Perspective API).

**Duplicate Detection:** Computes a dye signature from the sorted JSON of the dye array. If a duplicate preset is found, the submission auto-votes on the existing preset instead of creating a new one.

### `GET /api/v1/presets/mine`

Get the authenticated user's own presets. Returns presets in all statuses, including `hidden`.

### `PATCH /api/v1/presets/:id`

Edit an owned preset. Validates that the authenticated user owns the preset.

- If `dyes` are changed, runs duplicate detection.
- If `name` or `description` are sent, the edit is charged to a per-user daily cap of 30
  (`DAILY_TEXT_EDIT_LIMIT`, `submission_events` kind `text_edit`) **before** content moderation is
  called, for every preset status; over the cap the edit is refused with `429 RATE_LIMITED`
  ("You've reached your daily limit of name and description edits (30 per day). Try again
  tomorrow.", plus `remaining: 0` and `reset_at`) and nothing is moderated or written.
- If `name` or `description` are changed, runs content moderation.
- If the edit is flagged by moderation, the previous values are stored in `previous_values`.
- Status (FINDING-004): a `pending` preset stays pending; an `approved` one drops to `pending` only
  if the new text tripped moderation; a **`rejected`** one returns to `pending` when its text is
  edited — that edit *is* the resubmission the web app's "Resubmit" button performs; a `flagged` one
  never moves and never notifies; `hidden` is 403. Tag / dye / category edits and text re-sent
  unchanged change no status and notify nobody. Every notifying edit is charged to a second daily
  cap of 10 (`DAILY_FLAGGED_EDIT_LIMIT`, kind `flagged_edit`, its own `429 RATE_LIMITED`).

### `DELETE /api/v1/presets/:id`

Delete an owned preset. Validates that the authenticated user owns the preset.

### `GET /api/v1/presets/rate-limit`

Remaining submissions for the authenticated user today.

### `PATCH /api/v1/presets/refresh-author`

Refresh the stored author display name from the caller's current identity.

### `POST /api/v1/presets/:id/preview-image` / `DELETE /api/v1/presets/:id/preview-image`

Upload (or remove) a preview image for an owned preset. The upload is thumbnailed by
`xivdyetools-image-worker` (`POST /thumbnail`, WebP) into the `THUMBNAILS` R2 bucket and enters
`preview_image_status = 'pending'` until a moderator approves it (a "picture pending review" embed
with ✅/❌ buttons is posted to the moderation channel via the `DISCORD_WORKER` service binding).

---

## Votes (Authenticated)

All endpoints in this section require a JWT Bearer token in the `Authorization` header.

### `POST /api/v1/votes/:presetId`

Vote on a preset. One vote per user per preset. Increments the preset's `vote_count` atomically.

### `DELETE /api/v1/votes/:presetId`

Remove a vote from a preset.

### `GET /api/v1/votes/:presetId/check`

Check whether the authenticated user has voted on a preset.

**Response:**

```json
{
  "has_voted": true
}
```

---

## Moderation (Moderator-only)

All endpoints in this section require a JWT Bearer token with moderator privileges.

### `GET /api/v1/moderation/pending`

Get presets that are pending moderator review.

### `PATCH /api/v1/moderation/:presetId/status`

Update a preset's moderation status. Transitions are validated server-side (state machine; a
submitter can never approve their own preset) and applied as one D1 `batch()`.

**Request Body:**

| Field | Type | Constraints |
|-------|------|-------------|
| `status` | string | Target status: `approved`, `rejected`, `flagged`, `pending` |
| `reason` | string | 10-200 characters (surfaced to the owner as `rejection_reason` on `GET /presets/mine`, joined from `moderation_log`) |

Creates an entry in the `moderation_log` table.

### `PATCH /api/v1/moderation/:presetId/preview-image`

Approve or reject a pending preview image (`{ action: 'approve' | 'reject' }`). Reject clears only
the image, never the preset's status. Called by discord-worker's `previewimg_*` buttons as the
clicking moderator.

### `GET /api/v1/moderation/:presetId/history`

Get the full moderation history for a preset.

### `PATCH /api/v1/moderation/:presetId/revert`

Revert a flagged edit by restoring the preset's `previous_values`.

### `GET /api/v1/moderation/stats`

Moderation queue statistics.

### `GET /api/v1/moderation/failed-notifications` / `PATCH /api/v1/moderation/failed-notifications/:id/resolve`

Dead-letter queue for Discord notifications that could not be delivered (migration 0005).

### Bans

There are no ban routes on this API. User bans live in the shared D1 `banned_users` table
(migration 0003) and are written by `xivdyetools-moderation-worker` (`/preset ban_user` /
`unban_user`); this API only *checks* the table (`requireNotBannedCheck`) on writes.

---

## Authentication

The API supports two authentication methods:

### 1. JWT Bearer

Used by the web app. Pass a JWT (issued by `apps/oauth`) in the `Authorization` header:

```
Authorization: Bearer <jwt>
```

The acting user's identity is taken from the **`discord_id`** claim (the Discord snowflake), with
the `sub` claim (the oauth worker's internal user UUID) used only as a fallback for XIVAuth-only
accounts that have no Discord ID. This keeps web and bot requests in the same identity space —
`author_discord_id`, votes, bans, moderation-log actors and `MODERATOR_IDS` are all keyed by the
snowflake. `global_name || username` becomes the display name.

### 2. Bot API Key + HMAC Signature

Used by the Discord bot and the moderation worker (via Service Binding). Requires the bot API
secret plus HMAC signature headers (`BOT_SIGNING_SECRET` is mandatory outside
`ENVIRONMENT=development|test` — without it bot auth is rejected):

```
Authorization: Bearer <BOT_API_SECRET>
```

**Required Headers:**

| Header | Description |
|--------|-------------|
| `X-Request-Timestamp` | Unix timestamp (seconds); a v2 signature is accepted for 60 seconds (60 s future skew) |
| `X-Request-Signature-V2` | Hex HMAC-SHA256 with `BOT_SIGNING_SECRET` over the length-prefixed canonical string — one field per line, each prefixed with its length: `v2`, `METHOD`, path (no origin, no query), `sha256(body)`, timestamp, nonce, Discord ID, username |
| `X-Request-Nonce` | Random single-use nonce (`[A-Za-z0-9._-]{1,64}`; the bots send a UUID) bound into the signature; accepted nonces are remembered for 120 s in the shared `TOKEN_BLACKLIST` KV (`botnonce:` prefix) and a repeat is refused |
| `X-User-Discord-ID` | Discord user ID (snowflake) of the acting user |
| `X-User-Discord-Name` | Discord username of the acting user (optional; part of the signed message) |

The legacy v1 `X-Request-Signature` header (`${timestamp}:${discordId}:${userName}`, 5-minute
window) is no longer accepted since presets-api 2.2.0 (2026-08-29 audit, FINDING-015) and is no
longer sent by discord-worker 5.1.0 or moderation-worker 1.6.0.
Verification is `verifyBotSignatureV2()` from `@xivdyetools/auth` (header names
`BOT_SIGNATURE_V2_HEADER` / `BOT_SIGNATURE_NONCE_HEADER` live there); the nonce replay cache is in
`apps/presets-api/src/middleware/auth.ts`.

---

## Rate Limiting

### IP-based

- **Limit:** 100 requests per minute (sliding window)
- **Scope:** All endpoints

### User-based

- **Limit:** 10 submissions per day (UTC reset)
- **Scope:** `POST /api/v1/presets` only

### Response Headers

All rate-limited responses include the following headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Timestamp (seconds) when the window resets |
| `Retry-After` | Seconds to wait before retrying (on 429 only) |

### 429 Too Many Requests

When rate limited, the response body includes a `retryAfter` field:

```json
{
  "success": false,
  "error": "Rate Limit Exceeded",
  "message": "Too many requests",
  "retryAfter": 42
}
```

---

## Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable description"
}
```

---

## Related Documentation

- [Overview](overview.md) — Architecture and design overview
- [Database](database.md) — D1 schema and migrations
- [Moderation](moderation.md) — Content moderation pipeline details
- [Rate Limiting](rate-limiting.md) — Rate limiting implementation
