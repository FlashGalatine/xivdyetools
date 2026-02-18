# API Contracts

**Inter-service API specifications for the XIV Dye Tools ecosystem**

---

## Authentication Methods

### 1. Bot API Authentication

Used by the Discord worker to call the Presets API.

**Headers:**
```http
Authorization: Bearer <BOT_API_SECRET>
X-User-Discord-ID: 123456789012345678
X-User-Discord-Name: Username#1234
Content-Type: application/json
```

**Verification:**
```typescript
// In Presets API middleware
if (authHeader === `Bearer ${env.BOT_API_SECRET}`) {
  ctx.set('authType', 'bot');
  ctx.set('userDiscordId', headers['X-User-Discord-ID']);
  ctx.set('userDiscordName', headers['X-User-Discord-Name']);
}
```

### 2. JWT Authentication

Used by the web app after OAuth login.

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**JWT Structure:**
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-uuid",
    "iat": 1702684800,
    "exp": 1702688400,
    "iss": "https://oauth.xivdyetools.com",
    "username": "User#1234",
    "global_name": "Display Name",
    "avatar": "avatar_hash",
    "auth_provider": "discord",
    "discord_id": "123456789012345678"
  }
}
```

**Verification:**
```typescript
// In Presets API middleware
const payload = await verifyJWT(token, env.JWT_SECRET);
ctx.set('authType', 'jwt');
ctx.set('userDiscordId', payload.discord_id);
ctx.set('userDiscordName', payload.username);
```

---

## Presets API Endpoints

Base URL: `https://presets.xivdyetools.com/api/v1`

### GET /presets

List community presets with filtering and pagination.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | — | Filter by category slug |
| `search` | string | — | Search name/description |
| `status` | string | `approved` | Filter by status |
| `sort` | string | `popular` | Sort: `popular`, `newest`, `oldest` |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Items per page (max 100) |
| `is_curated` | boolean | — | Filter curated presets |

**Response:**
```json
{
  "presets": [
    {
      "id": "uuid",
      "name": "Forest Guardian",
      "description": "Earthy tones for tank glamour",
      "colors": [
        { "dyeId": 42, "name": "Bark Brown", "hex": "#6B4423" },
        { "dyeId": 78, "name": "Moss Green", "hex": "#3D5C3D" }
      ],
      "category": { "id": 1, "name": "Glamour", "slug": "glamour" },
      "author": { "discordId": "123...", "name": "User#1234" },
      "upvotes": 42,
      "downvotes": 3,
      "status": "approved",
      "is_curated": false,
      "created_at": "2025-12-01T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### POST /presets

Submit a new preset.

**Request Body:**
```json
{
  "name": "Forest Guardian",
  "description": "Earthy tones for tank glamour",
  "colors": [42, 78, 91],
  "category_id": 1
}
```

**Response (201 Created):**
```json
{
  "preset": {
    "id": "uuid",
    "name": "Forest Guardian",
    "status": "approved",
    "created_at": "2025-12-15T12:00:00Z"
  }
}
```

**Error Responses:**
| Status | Description |
|--------|-------------|
| 400 | Invalid input (missing fields, invalid dye IDs) |
| 401 | Not authenticated |
| 409 | Duplicate preset (same dye combination exists) |
| 429 | Rate limited (10 submissions/day exceeded) |

### GET /presets/:id

Get a single preset with user's vote status.

**Response:**
```json
{
  "preset": { ... },
  "userVote": "up" | "down" | null
}
```

### GET /presets/mine

Get current user's submitted presets.

**Response:**
```json
{
  "presets": [ ... ]
}
```

### GET /presets/featured

Get featured/curated presets.

**Response:**
```json
{
  "presets": [ ... ]
}
```

---

## Votes API

### POST /votes/:presetId

Vote on a preset.

**Request Body:**
```json
{
  "vote": "up" | "down"
}
```

**Response:**
```json
{
  "upvotes": 43,
  "downvotes": 3,
  "userVote": "up"
}
```

### DELETE /votes/:presetId

Remove a vote.

**Response:**
```json
{
  "upvotes": 42,
  "downvotes": 3,
  "userVote": null
}
```

---

## Categories API

### GET /categories

List all preset categories with counts.

**Response:**
```json
{
  "categories": [
    { "id": 1, "name": "Glamour", "slug": "glamour", "count": 45 },
    { "id": 2, "name": "Housing", "slug": "housing", "count": 23 },
    { "id": 3, "name": "Roleplay", "slug": "roleplay", "count": 12 }
  ]
}
```

---

## Moderation API

Requires moderator role (`MODERATOR_IDS` check).

### GET /moderation/pending

Get presets awaiting moderation.

**Response:**
```json
{
  "presets": [
    {
      "id": "uuid",
      "name": "Preset Name",
      "moderation_reason": "Flagged by profanity filter",
      "submitted_at": "2025-12-15T12:00:00Z"
    }
  ]
}
```

### PATCH /moderation/:id/status

Approve or reject a preset.

**Request Body:**
```json
{
  "status": "approved" | "rejected",
  "reason": "Optional rejection reason"
}
```

**Response:**
```json
{
  "success": true,
  "preset": { ... }
}
```

---

## OAuth API Endpoints

Base URL: `https://oauth.xivdyetools.com`

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
  "redirect_uri": "https://app.xivdyetools.com/callback"
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

Base URL: `https://bot.xivdyetools.com`

### POST /webhooks/preset-submission

Receive preset submission notifications from web app.

**Headers:**
```http
Authorization: Bearer <INTERNAL_WEBHOOK_SECRET>
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "new_submission",
  "preset": {
    "id": "uuid",
    "name": "Preset Name",
    "author": { "discordId": "123...", "name": "User" }
  }
}
```

### POST /webhooks/moderation

Receive moderation queue notifications.

**Request Body:**
```json
{
  "type": "pending_review",
  "preset": { ... },
  "reason": "Flagged by profanity filter"
}
```

---

## Error Response Format

All APIs return errors in a consistent format:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "You have exceeded the submission limit (10/day)",
    "details": {
      "limit": 10,
      "remaining": 0,
      "resetAt": "2025-12-16T00:00:00Z"
    }
  }
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE` | 409 | Preset with same dyes exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Related Documentation

- [Service Bindings](service-bindings.md) - How services call each other
- [Data Flow](data-flow.md) - Sequence diagrams for flows
- [Overview](overview.md) - High-level architecture
