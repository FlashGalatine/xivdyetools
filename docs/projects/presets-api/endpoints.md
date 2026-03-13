# Presets API — Endpoint Reference (v1.4.15)

Full API reference for the Presets API Cloudflare Worker.

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

### `GET /api/v1/presets`

List approved presets with pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max 100) |
| `category` | string | — | Filter by category |
| `sort` | string | — | Sort order: `popular`, `recent`, or `name` |
| `search` | string | — | Free-text search |
| `tags` | string | — | Filter by tags |

Actively filters out presets with `status='hidden'`.

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
| `dyes` | number[] | 2-5 positive integers |
| `tags` | string[] | Max 10 tags, each max 30 characters |
| `category_id` | number | Must reference a valid category |

**Moderation:** Runs content moderation on submission (local profanity filter + Perspective API).

**Duplicate Detection:** Computes a dye signature from the sorted JSON of the dye array. If a duplicate preset is found, the submission auto-votes on the existing preset instead of creating a new one.

### `GET /api/v1/presets/mine`

Get the authenticated user's own presets. Returns presets in all statuses, including `hidden`.

### `PATCH /api/v1/presets/:id`

Edit an owned preset. Validates that the authenticated user owns the preset.

- If `dyes` are changed, runs duplicate detection.
- If `name` or `description` are changed, runs content moderation.
- If the edit is flagged by moderation, the previous values are stored in `previous_values` and the preset status is set to `pending`.

### `DELETE /api/v1/presets/:id`

Delete an owned preset. Validates that the authenticated user owns the preset.

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

### `PATCH /api/v1/moderation/:id`

Update a preset's moderation status.

**Request Body:**

| Field | Type | Constraints |
|-------|------|-------------|
| `status` | string | One of: `approve`, `reject`, `flag`, `hide` |
| `reason` | string | 10-200 characters |

Creates an entry in the `moderation_log` table.

### `GET /api/v1/moderation/:id/history`

Get the full moderation history for a preset.

### `PATCH /api/v1/moderation/:id/revert`

Revert a flagged edit by restoring the preset's `previous_values`.

### `POST /api/v1/moderation/ban`

Ban a user from the Presets API.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `discord_id` | string | The Discord user ID to ban |
| `reason` | string | Reason for the ban |

### `DELETE /api/v1/moderation/ban/:discordId`

Unban a user by Discord ID.

### `GET /api/v1/moderation/bans`

List all currently banned users.

---

## Authentication

The API supports two authentication methods:

### 1. JWT Bearer

Used by the web app. Pass a JWT in the `Authorization` header:

```
Authorization: Bearer <jwt>
```

### 2. Bot API Key + HMAC Signature

Used by the Discord bot. Requires the bot API secret plus HMAC signature headers:

```
Authorization: Bearer <BOT_API_SECRET>
```

**Required Headers:**

| Header | Description |
|--------|-------------|
| `X-Timestamp` | Request timestamp for replay protection |
| `X-Discord-Id` | Discord user ID of the acting user |
| `X-User-Name` | Discord username of the acting user |
| `X-Signature` | HMAC signature over the request payload |

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
