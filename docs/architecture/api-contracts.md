# API Contracts

**Inter-service API specifications for the XIV Dye Tools ecosystem**

---

## Authentication Methods

### 1. Bot API Authentication

Used by the Discord worker (and the moderation worker) to call the Presets API over a Service Binding.

**Headers:**
```http
Authorization: Bearer <BOT_API_SECRET>
X-User-Discord-ID: 123456789012345678
X-User-Discord-Name: Username
X-Request-Timestamp: 1702684800
X-Request-Signature: <hex HMAC-SHA256>
Content-Type: application/json
```

**Verification** (`apps/presets-api/src/middleware/auth.ts`): the bearer is compared to `BOT_API_SECRET`
in constant time, then `verifyBotSignature()` from `@xivdyetools/auth` checks the HMAC over
`"<timestamp>:<X-User-Discord-ID>:<X-User-Discord-Name>"` with `BOT_SIGNING_SECRET` (timestamp is
Unix seconds; ≤ 5 min old, ≤ 60 s future skew). In production a missing/invalid signature leaves the
request **unauthenticated** (the route then answers 401) — only `ENVIRONMENT=development|test` accepts
an unsigned bot call.

```typescript
// Resulting auth context
ctx.set('auth', {
  isAuthenticated: true,
  isModerator: MODERATOR_IDS.includes(userDiscordId),
  userDiscordId,       // from X-User-Discord-ID
  userName,            // from X-User-Discord-Name
  authSource: 'bot',
});
```

### 2. JWT Authentication

Used by the web app after OAuth login.

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**JWT Structure** (issued by `apps/oauth`):
```json
{
  "header": { "alg": "HS256", "typ": "JWT" },
  "payload": {
    "sub": "user-uuid",
    "iat": 1702684800,
    "exp": 1702688400,
    "iss": "https://auth.xivdyetools.app",
    "jti": "token-uuid",
    "orig_iat": 1702684800,
    "username": "username",
    "global_name": "Display Name",
    "avatar": "avatar_hash",
    "auth_provider": "discord",
    "discord_id": "123456789012345678"
  }
}
```

**Verification** (`apps/presets-api/src/middleware/auth.ts`): `verifyJWT(token, JWT_SECRET)` from
`@xivdyetools/auth` (HS256 only, signature + expiry). The Presets API then uses the **`sub`** claim as
the acting user's ID and `global_name || username` as the display name:

```typescript
ctx.set('auth', {
  isAuthenticated: true,
  isModerator: MODERATOR_IDS.includes(payload.sub),
  userDiscordId: payload.sub,
  userName: payload.global_name || payload.username,
  authSource: 'web',
});
```

---

## Presets API Endpoints

Base URL: `https://api.xivdyetools.app/api/v1` (`apps/presets-api`, v2.0.0). All routes under
`/api/*` sit behind a 100 req/min per-IP limit, a 100 KB JSON body cap (the preview-image upload is
exempt and enforces its own 5 MB), and a `Content-Type: application/json` requirement on
POST/PATCH bodies (415 otherwise). Field-level rules come from
`apps/presets-api/src/services/validation-service.ts`.

### The preset object

Every route that returns a preset returns this shape (`CommunityPreset` in `@xivdyetools/types`,
serialised by `rowToPreset()` in `services/preset-service.ts`):

```json
{
  "id": "6f1c1c9e-6d0e-4b0e-9d61-3a6a3f4c8e2b",
  "name": "Forest Guardian",
  "description": "Earthy tones for a Warrior glamour",
  "category_id": "jobs",
  "secondary_categories": ["aesthetics"],
  "dyes": [23, 40, 57],
  "tags": ["tank", "earthy"],
  "author_discord_id": "123456789012345678",
  "author_name": "Username",
  "vote_count": 42,
  "status": "approved",
  "is_curated": false,
  "created_at": "2026-08-01T12:00:00.000Z",
  "updated_at": "2026-08-02T09:30:00.000Z",
  "dye_signature": "[23,40,57]",
  "previous_values": null,
  "example_link": "https://www.eorzeacollection.com/glamour/12345",
  "preview_image_url": "https://shots.xivdyetools.app/6f1c1c9e-…/2b7d….webp",
  "preview_image_status": "approved",
  "rejection_reason": null
}
```

| Field | Notes |
|-------|-------|
| `dyes` | **stainIDs** (1–254), 3–6 of them. Not itemIDs — legacy itemIDs are rejected on write. |
| `category_id` | Primary category slug: `jobs`, `grand-companies`, `seasons`, `events`, `aesthetics`, `appearance`, `zones`, `raids-trials`. There is no `community` category (migration 0007). |
| `secondary_categories` | 0–2 further slugs, never containing `category_id`. Category filters match either slot. |
| `status` | `pending` \| `approved` \| `rejected` \| `flagged` \| `hidden` (hidden = author banned; restored on unban). |
| `vote_count` | Single toggleable upvote count. There are no downvotes. |
| `dye_signature` | Sorted `dyes` as JSON (`"[23,40,57]"`); UNIQUE in D1 and the basis of duplicate detection. Omitted when null. |
| `previous_values` | `{ name, description, tags, dyes }` snapshot taken the first time an edit is flagged (revert target). **Stripped from every public response** — present only for the owner (`GET /presets/:id`, `/mine`) and moderators. |
| `example_link` | `https` page URL on an allowlisted host, or `null`. Stored, never fetched. |
| `preview_image_url` | Public R2 URL — present **only** while `preview_image_status` is `approved`; `null` otherwise. That condition is the moderation gate. |
| `preview_image_status` | `none` \| `pending` \| `approved`. Safe to show everywhere. |
| `rejection_reason` | Latest moderator `reject` reason. Populated **only** on `GET /presets/mine`; `null` elsewhere. |

### GET /presets

List presets with filtering and pagination. Public.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | — | Category slug; matches primary **or** secondary |
| `search` | string | — | Substring match on name / description / tags |
| `status` | string | `approved` | `pending`, `approved`, `rejected`, `flagged`. Anything else → 400; anything but `approved` → 403 unless the caller is a moderator. `hidden` is never listable. |
| `sort` | string | `popular` | `popular` (votes desc, then newest), `recent`, `name` |
| `page` | number | `1` | Clamped to ≥ 1 |
| `limit` | number | `20` | Clamped to 1–50 |
| `is_curated` | `true` \| `false` | — | Filter curated presets |

**Response:**
```json
{
  "presets": [ { …preset… } ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "has_more": true
}
```

### GET /presets/featured

Top 10 approved presets by `vote_count`. Public.

```json
{ "presets": [ { …preset… } ] }
```

### GET /presets/:id

One preset — the bare object, no wrapper. Non-approved presets answer **404** unless the caller is the
owner or a moderator (so hidden/rejected IDs cannot be probed). There is no vote flag on this response;
use `GET /votes/:presetId/check`.

### GET /presets/mine

The caller's own presets in every status (including `hidden`), newest first, each carrying
`rejection_reason`. Requires auth + user context.

```json
{ "presets": [ { …preset…, "rejection_reason": "Description is not about the palette" } ], "total": 3 }
```

### GET /presets/rate-limit

Requires auth. Remaining submissions in the current UTC day.

```json
{ "remaining": 7, "limit": 10, "reset_at": "2026-08-17T00:00:00.000Z" }
```

### PATCH /presets/refresh-author

Requires auth; empty body. Rewrites `author_name` on all of the caller's presets to their current
display name (the web app calls this on login).

```json
{ "success": true, "updated": 3 }
```

### POST /presets

Submit a new preset. Requires auth + user context; banned users get 403 `USER_BANNED`.

**Request Body:**
```json
{
  "name": "Forest Guardian",
  "description": "Earthy tones for a Warrior glamour",
  "category_id": "jobs",
  "secondary_categories": ["aesthetics"],
  "dyes": [23, 40, 57],
  "tags": ["tank", "earthy"],
  "example_link": "eorzeacollection.com/glamour/12345"
}
```

| Field | Rule (error message on failure) |
|-------|--------------------------------|
| `name` | required, 2–50 chars — `Name must be 2-50 characters` |
| `description` | required, 10–200 chars — `Description must be 10-200 characters` |
| `category_id` | required, one of the eight slugs (checked against D1) — `Invalid category` |
| `secondary_categories` | optional, ≤ 2 valid slugs, no duplicates, must not repeat the primary — `at most 2 secondary categories allowed` / `A secondary category cannot repeat the primary category` |
| `dyes` | 3–6 positive integers ≤ 254 — `Must include 3-6 dyes`; a value ≥ 5000 → `Dye 5729 looks like a legacy item ID; expected a stainID (1-254)`; 255–4999 → `Dye IDs must be stainIDs (1-254)` |
| `tags` | required array (may be `[]`), ≤ 10 strings of ≤ 30 chars — `Maximum 10 tags allowed` |
| `example_link` | optional; `https`, ≤ 300 chars, host on the allowlist (`eorzeacollection.com`, `mirapri.com`, `reddit.com`, `redd.it`, `x.com`, `twitter.com`, `bsky.app`, `instagram.com`, `pixiv.net`, `finalfantasyxiv.com`, `misskey.io`, plus subdomains). A bare host is normalised to `https://…` before storage. `Example link host must be one of: …` |

Flow: rate limit (10/UTC day) → validate → duplicate check on `dye_signature` → profanity/Perspective
moderation → insert → auto-vote → Discord notification (`type: "submission"`, see below).

**Response (201 Created)** — `moderation_status` is `approved` when moderation passed, `pending`
when it was flagged (the preset then waits in the moderation queue):
```json
{
  "success": true,
  "preset": { …preset… },
  "moderation_status": "approved",
  "remaining_submissions": 6
}
```

**Response (200 OK, duplicate)** — the same dye combination already exists; the caller's vote is
added to it instead and nothing is created:
```json
{ "success": true, "duplicate": { …preset… }, "vote_added": true }
```

**Error Responses:**
| Status | Body |
|--------|------|
| 400 | `{ "success": false, "error": "VALIDATION_ERROR", "message": "<rule message above>" }` or `"error": "INVALID_JSON"` |
| 401 | `{ "error": "Unauthorized", "message": "Valid authentication required" }` |
| 403 | `{ "success": false, "error": "USER_BANNED", "message": "You have been banned from using Preset Palettes." }` |
| 415 | `{ "error": "Unsupported Media Type", "message": "Content-Type must be application/json" }` |
| 429 | `{ "success": false, "error": "RATE_LIMITED", "message": "You've reached your daily submission limit (10 per day). Try again tomorrow.", "remaining": 0, "reset_at": "…" }` |

### PATCH /presets/:id

Edit a preset. **Owner only** (moderators cannot edit others' presets); banned users get 403.
Every field is optional; at least one must be present (`No updates provided`).

```json
{
  "name": "…", "description": "…", "dyes": [23, 40, 57], "tags": ["…"],
  "category_id": "zones", "secondary_categories": [], "example_link": null
}
```

- `secondary_categories: []` clears the list; `example_link: null` clears the link.
- Changing `dyes` re-runs duplicate detection (excluding this preset).
- Changing `name`/`description` re-runs content moderation. If it fails, the preset goes to
  `pending` and a write-once `previous_values` snapshot is taken (the moderator revert target).
- An edit can never lift a moderator-set status: only a currently-`approved` preset stays `approved`;
  `pending`/`rejected`/`flagged` stay in (or return to) the queue; `hidden` → 403
  `This preset cannot be edited`.
- Vote counts are preserved across edits.

**Response:**
```json
{ "success": true, "preset": { …preset… }, "moderation_status": "approved" }
```

**409 (duplicate dye combination):**
```json
{
  "success": false,
  "error": "DUPLICATE_RESOURCE",
  "message": "This dye combination already exists",
  "duplicate": { "id": "…", "name": "…", "author_name": "…" }
}
```

### DELETE /presets/:id

Owner **or moderator**. Deletes votes + preset atomically, then the preview image in R2.

```json
{ "success": true, "message": "Preset deleted" }
```

### POST /presets/:id/preview-image

Author only. The **raw image bytes** are the body (`Content-Type: image/png`, `image/jpeg` or
`image/webp` — or no header at all; the magic bytes decide). Max 5 MB. The image is thumbnailed to
WebP by `image-worker` (`POST /thumbnail`) into the `THUMBNAILS` R2 bucket, replaces any previous
image, and enters `preview_image_status = 'pending'` — invisible in the API until a moderator
approves it. A `type: "preview_image"` notification is sent to the Discord worker.

```json
{ "success": true, "status": "pending" }
```

| Status | Message |
|--------|---------|
| 400 `VALIDATION_ERROR` | `No image data provided` / `Image must be at most 5 MB` / `Image must be a PNG, JPEG or WebP` / `Image could not be processed` |
| 403 `FORBIDDEN` | `Only the author can set a preview image` |
| 415 | `Content-Type must be one of: image/png, image/jpeg, image/webp` |

### DELETE /presets/:id/preview-image

Author only; idempotent (nothing to remove is still a success). Clears the image and its R2 object;
the preset's own `status` is untouched and content moderation is **not** re-run.

```json
{ "success": true, "preview_image_status": "none" }
```

---

## Votes API

One upvote per user per preset, toggled on/off. No downvotes.

### POST /votes/:presetId

Requires auth + user context; banned users get 403.

**Response (200):**
```json
{ "success": true, "new_vote_count": 43 }
```

**Already voted (409):**
```json
{ "success": true, "already_voted": true, "new_vote_count": 42 }
```

### DELETE /votes/:presetId

Always 200 when the preset exists. `already_voted: false` means there was no vote to remove.

```json
{ "success": true, "new_vote_count": 42 }
```

### GET /votes/:presetId/check

```json
{ "has_voted": true }
```

---

## Categories API

### GET /categories

Public; cached (`Cache-Control: public, s-maxage=60, max-age=30, stale-while-revalidate=120`).
`preset_count` counts approved presets in the category as primary **or** secondary, so counts sum to
more than the preset total by design.

```json
{
  "categories": [
    { "id": "jobs", "name": "Jobs", "description": "…", "icon": "…", "is_curated": true, "display_order": 1, "preset_count": 45 },
    { "id": "appearance", "name": "Appearance", "description": "Palettes built around a character's own colours", "icon": "👤", "is_curated": true, "display_order": 6, "preset_count": 12 },
    { "id": "raids-trials", "name": "Raids & Trials", "description": "Palettes from raid and trial encounters", "icon": "🗡️", "is_curated": true, "display_order": 8, "preset_count": 7 }
  ]
}
```

### GET /categories/:id

The bare `CategoryMeta` object above; 404 `{ "success": false, "error": "NOT_FOUND", "message": "Category not found" }`.

---

## Moderation API

Requires a moderator (`MODERATOR_IDS`): 401 `{ "error": "Unauthorized", … }` when unauthenticated,
403 `{ "error": "Forbidden", "message": "Moderator privileges required" }` otherwise. There are no ban
routes here — bans are written to the shared `banned_users` table by `moderation-worker`; this API
only checks it on writes.

### GET /moderation/pending

The queue: presets whose `status` is `pending` **or** whose `preview_image_status` is `pending`,
oldest first. Each entry is a preset plus `pending_preview_image_url` (the unapproved image, which
public responses withhold).

```json
{
  "presets": [ { …preset…, "previous_values": { … }, "pending_preview_image_url": "https://shots.xivdyetools.app/…/….webp" } ],
  "total": 2
}
```

### PATCH /moderation/:presetId/status

```json
{ "status": "approved", "reason": "optional note" }
```

`status` ∈ `approved` | `rejected` | `flagged` | `pending` (`hidden` cannot be set here). The update
and its `moderation_log` row (`approve` / `reject` / `flag` / `unflag`) land in one batch, conditional
on the status the moderator saw.

**Response:** `{ "success": true, "preset": { …preset… } }`

**409 (concurrent moderation):** `{ "success": false, "error": "DUPLICATE_RESOURCE", "message": "Preset status changed concurrently — reload and retry" }`

### PATCH /moderation/:presetId/revert

```json
{ "reason": "Reverting flagged edit (10-200 chars)" }
```

Restores `previous_values`; 400 `This preset has no previous values to revert to` when there is no
snapshot. Response: `{ "success": true, "preset": { … }, "message": "Preset reverted to previous values" }`.

### PATCH /moderation/:presetId/preview-image

```json
{ "action": "approve" }
```

`approve` → `{ "success": true, "preview_image_status": "approved" }` (the URL now appears in public
responses). `reject` → clears the image and its R2 object → `{ "success": true, "preview_image_status": "none" }`.
The preset's own `status` is untouched: a bad picture is not a bad palette. Anything else →
400 `action must be 'approve' or 'reject'`.

### GET /moderation/:presetId/history

```json
{ "history": [ { "id": "…", "preset_id": "…", "moderator_discord_id": "…", "action": "reject", "reason": "…", "created_at": "…" } ] }
```

### GET /moderation/stats

```json
{ "stats": { "pending": 2, "approved": 150, "rejected": 4, "flagged": 1, "actions_last_week": 9 } }
```

### GET /moderation/failed-notifications · PATCH /moderation/failed-notifications/:id/resolve

Dead-letter queue for Discord notifications whose retries were exhausted.
`GET …?include_resolved=true` → `{ "notifications": [ … ], "total": n }`; `PATCH …/resolve` →
`{ "success": true }` (404 when unknown).

---

## OAuth API Endpoints

Base URL: `https://auth.xivdyetools.app`

### GET /auth/discord

Initiate Discord OAuth flow.

**Query Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `code_challenge` | Yes | SHA256 hash of code_verifier (base64url) |
| `code_challenge_method` | Yes | Always `S256` |
| `redirect_uri` | Yes | Frontend callback URL |
| `state` | No | CSRF protection token |

**Response:** Redirects to Discord OAuth consent page.

### GET /auth/callback

Handle Discord OAuth callback.

**Query Parameters:**
| Parameter | Description |
|-----------|-------------|
| `code` | Authorization code from Discord |
| `state` | CSRF token (if provided) |

**Response:** Redirects to frontend with `?token=JWT`

### POST /auth/callback

SPA-friendly token exchange.

**Request Body:**
```json
{
  "code": "AUTH_CODE",
  "code_verifier": "PKCE_VERIFIER",
  "redirect_uri": "https://xivdyetools.app/callback"
}
```

**Response:**
```json
{
  "token": "JWT_TOKEN",
  "user": {
    "id": "123...",
    "username": "User#1234",
    "global_name": "Display Name",
    "avatar": "avatar_hash"
  }
}
```

### POST /auth/refresh

Refresh an expired JWT (within 24h grace period).

**Headers:**
```http
Authorization: Bearer <EXPIRED_JWT>
```

**Response:**
```json
{
  "token": "NEW_JWT_TOKEN"
}
```

### GET /auth/me

Get current user info from JWT.

**Headers:**
```http
Authorization: Bearer <JWT>
```

**Response:**
```json
{
  "user": {
    "id": "123...",
    "username": "User#1234",
    "global_name": "Display Name",
    "avatar": "avatar_hash"
  }
}
```

---

## Discord Worker Webhook Endpoints

Base URL: `https://bot.xivdyetools.app`. presets-api never uses the URL — it calls this route over the
`DISCORD_WORKER` Service Binding (`services/notification-service.ts`); when the binding or
`INTERNAL_WEBHOOK_SECRET` is absent it skips the notification.

### POST /webhooks/preset-submission

Receives preset notifications from presets-api (`services/notification-service.ts`; consumer types in
`apps/discord-worker/src/types/preset.ts`). Body ≤ 10 KB.

**Headers:**
```http
Authorization: Bearer <INTERNAL_WEBHOOK_SECRET>
Content-Type: application/json
```

**Request Body** — a discriminated union on `type`.

`submission` (new preset, or an edit that failed content moderation):
```json
{
  "type": "submission",
  "preset": {
    "id": "6f1c1c9e-…",
    "name": "Forest Guardian",
    "description": "Earthy tones for a Warrior glamour",
    "category_id": "jobs",
    "dyes": [23, 40, 57],
    "tags": ["tank", "earthy"],
    "author_name": "Username",
    "author_discord_id": "123456789012345678",
    "status": "pending",
    "moderation_status": "flagged",
    "source": "web",
    "created_at": "2026-08-01T12:00:00.000Z"
  }
}
```

`preview_image` (an author uploaded a card picture; only what the embed needs is sent):
```json
{
  "type": "preview_image",
  "preview_image_key": "6f1c1c9e-…/2b7d….webp",
  "preset": { "id": "6f1c1c9e-…", "name": "Forest Guardian", "author_name": "Username" }
}
```

| Field | Values |
|-------|--------|
| `preset.status` | `pending` → moderation-channel embed; `approved` → submission-log embed ("new preset published"); other statuses post nothing |
| `preset.moderation_status` | `clean` \| `flagged` \| `auto_approved` |
| `preset.source` | `bot` \| `web` \| `none` (the presets-api `authSource`) |
| `preview_image_key` | R2 key; the embed's image URL is `https://shots.xivdyetools.app/<key>` |

**Behaviour:** the `submission` moderation embed is posted with `MODERATION_BOT_TOKEN` when set (so its
approve/reject buttons route to moderation-worker); `preview_image` embeds are posted with this bot's
own token, and their `previewimg_approve_<id>` / `previewimg_reject_<id>` buttons are handled here.
`type: "preview_image"` with no `MODERATION_CHANNEL_ID` configured is a silent no-op.

**Responses:** `{ "success": true }`; 401 `{ "error": "Unauthorized" }`; 400 `{ "error": "Invalid JSON body" }`
/ `{ "error": "Invalid payload" }` (unknown `type` or missing `preset`); 413 `{ "error": "Payload too large" }`;
**502** `{ "error": "Failed to deliver moderation notification" }` / `"Failed to deliver preview-image notification"`
when Discord rejects the post — presets-api retries with backoff (3×, 1–10 s) and then writes a
`failed_notifications` dead-letter row for `GET /moderation/failed-notifications`.

### POST /webhooks/github

Release-announcement hook (GitHub webhook, `GITHUB_WEBHOOK_SECRET`) — posts the parsed `CHANGELOG-laymans.md` entry to `ANNOUNCEMENT_CHANNEL_ID`. There is no `/webhooks/moderation` route; the live surface is `GET /health` plus `POST /`, `POST /webhooks/preset-submission`, `POST /webhooks/github`.

---

## Error Response Format

Presets API errors (`apps/presets-api/src/utils/api-response.ts`) are flat — no nested `error`
object:

```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "You've reached your daily submission limit (10 per day). Try again tomorrow.",
  "remaining": 0,
  "reset_at": "2026-08-17T00:00:00.000Z"
}
```

Route-specific extras ride alongside (`remaining`/`reset_at` on 429, `duplicate` on 409,
`requestId` on 500). Two legacy shapes remain: the auth guards answer
`{ "error": "Unauthorized" | "Forbidden" | "Bad Request", "message": "…" }` without `success`, and the
per-IP limiter answers `{ "error": "Too Many Requests", "message": "…", "retryAfter": 60 }` with a
`Retry-After` header.

**Error Codes (`ErrorCode`):**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Malformed request |
| `VALIDATION_ERROR` | 400 | A field failed a validation rule (message names the rule) |
| `INVALID_JSON` | 400 | Body is not valid JSON |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Not the owner / not a moderator / status filter not allowed |
| `USER_BANNED` | 403 | Caller is in `banned_users` |
| `NOT_FOUND` | 404 | Resource not found (also non-approved presets to non-privileged callers) |
| `CONFLICT` | 409 | Reserved |
| `DUPLICATE_RESOURCE` | 409 | Same dye combination exists (edit), or a concurrent moderation write |
| `RATE_LIMITED` | 429 | Daily submission limit reached |
| `INTERNAL_ERROR` | 500 | Unhandled error (carries `requestId`) |
| `SERVICE_UNAVAILABLE` | 500 | Worker misconfigured (env validation failed in production) |
| `DATABASE_ERROR` | 500 | Reserved |

---

## Related Documentation

- [Presets API endpoint reference](../projects/presets-api/endpoints.md) - Per-route reference for the same worker
- [Service Bindings](service-bindings.md) - How services call each other
- [Data Flow](data-flow.md) - Sequence diagrams for flows
- [Overview](overview.md) - High-level architecture
