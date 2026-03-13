# OAuth Endpoints

**Full API reference for the XIV Dye Tools OAuth worker**

---

## Authentication Endpoints

### GET /auth/discord

Initiate Discord OAuth flow with PKCE.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code_challenge` | string | Yes | BASE64URL(SHA256(code_verifier)), 43-128 chars |
| `code_challenge_method` | string | No | Must be `S256` (default) |
| `state` | string | No | CSRF token (auto-generated UUID if omitted) |
| `redirect_uri` | string | No | Must be whitelisted (default: `FRONTEND_URL/auth/callback`) |
| `return_path` | string | No | Frontend path to restore (default: `/`) |

**Success:** `302` redirect to Discord authorization URL

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Missing or invalid `code_challenge` |
| 400 | Invalid `code_challenge_method` |
| 400 | `redirect_uri` not in whitelist |
| 429 | Rate limit exceeded (10/min per IP) |

---

### GET /auth/callback

Discord redirect handler — validates state and passes auth code to frontend.

| Parameter | Source | Description |
|-----------|--------|-------------|
| `code` | Discord | Authorization code |
| `state` | Discord | Signed state from Step 2 |
| `error` | Discord | Error code (on failure) |
| `error_description` | Discord | Error message (on failure) |

**Success:** `302` redirect to `${redirect_uri}?code=<code>&csrf=<token>&return_path=<path>`

**Failure:** `302` redirect with `?error=<message>`

**Validation:** State signature (HMAC-SHA256), expiration (10 min), redirect URI origin

---

### POST /auth/callback

SPA token exchange — receives authorization code + PKCE verifier, returns JWT.

**Request:**
```json
{
  "code": "<authorization_code>",
  "code_verifier": "<43-128_char_verifier>"
}
```

**Success (200):**
```json
{
  "success": true,
  "token": "<jwt>",
  "user": {
    "id": "<user_id>",
    "username": "<discord_username>",
    "global_name": "<display_name>",
    "avatar": "<avatar_hash>",
    "avatar_url": "<cdn_url>",
    "auth_provider": "discord"
  },
  "expires_at": 1704114000
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Missing `code` or `code_verifier` |
| 400 | Invalid `code_verifier` format |
| 401 | Token exchange failed |
| 401 | Missing required scope (`identify`) |
| 401 | Invalid user data from Discord |
| 429 | Rate limit exceeded (20/min per IP) |

---

### GET /auth/xivauth

Initiate XIVAuth OAuth flow. Same parameters as `/auth/discord`.

**Scopes requested:** `user user:social character refresh`

**Success:** `302` redirect to XIVAuth authorization URL

---

### GET /auth/xivauth/callback

XIVAuth redirect handler. Same behavior as `/auth/callback` with `provider=xivauth` in response.

---

### POST /auth/xivauth/callback

XIVAuth token exchange. Same request format as `POST /auth/callback`.

**Additional response data:**
```json
{
  "user": {
    "auth_provider": "xivauth",
    "primary_character": {
      "name": "<character_name>",
      "server": "<world_name>",
      "verified": true
    }
  }
}
```

**Additional validation:** Requires `user` and `character` scopes.

---

## Token Management Endpoints

### POST /auth/refresh

Extend session by refreshing an existing JWT.

**Request:**
```json
{
  "token": "<current_jwt>"
}
```

**Success (200):**
```json
{
  "success": true,
  "token": "<new_jwt>",
  "expires_at": 1704114000
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Missing token |
| 401 | Invalid signature |
| 401 | Beyond 24-hour grace period |
| 401 | Token revoked |
| 429 | Rate limit exceeded (30/min per IP) |

**Grace period:** Expired tokens can be refreshed up to 24 hours after expiry.

---

### GET /auth/me

Get current user info from JWT.

**Headers:** `Authorization: Bearer <token>`

**Success (200):**
```json
{
  "success": true,
  "user": {
    "id": "<user_id>",
    "username": "<username>",
    "global_name": "<display_name>",
    "avatar": "<avatar_hash>",
    "avatar_url": "<cdn_url>"
  }
}
```

**Errors:** `401` for missing, invalid, expired, or revoked token.

**Not rate limited** (requires valid token).

---

### POST /auth/revoke

Invalidate a token (logout).

**Headers:** `Authorization: Bearer <token>`

**Success (200):**
```json
{
  "success": true,
  "message": "Token revoked successfully",
  "revoked": true
}
```

Adds `jti` to KV blacklist with TTL matching token expiry. If KV is unavailable, returns `"revoked": false` with a note to clear client-side storage. Accepts expired tokens (allows logout after session timeout).

---

## Health Endpoints

### GET /

```json
{
  "service": "xivdyetools-oauth",
  "status": "healthy",
  "environment": "production"
}
```

### GET /health

```json
{
  "status": "healthy",
  "timestamp": "2026-03-13T12:00:00.000Z"
}
```

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `GET /auth/discord` | 10/min | 60s |
| `GET /auth/xivauth` | 10/min | 60s |
| `GET /auth/callback` | 20/min | 60s |
| `POST /auth/callback` | 20/min | 60s |
| `POST /auth/refresh` | 30/min | 60s |
| `GET /auth/me` | None | — |
| `POST /auth/revoke` | None | — |

Rate limits are per-IP using a sliding window algorithm (`@xivdyetools/rate-limiter`).

**Rate limit headers** (on all limited endpoints):
- `X-RateLimit-Limit` — Maximum requests per window
- `X-RateLimit-Remaining` — Requests remaining
- `X-RateLimit-Reset` — Window reset timestamp

**Exceeded (429):**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 42
}
```

---

## CORS

**Allowed origins:** `FRONTEND_URL` + development localhost ports (5173, 3000)

**Methods:** GET, POST, OPTIONS

**Headers:** Content-Type, Authorization

**Credentials:** Enabled

**Preflight cache:** 24 hours

---

## Global Security Headers

All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000` (production only)
- `X-Request-ID: <uuid>` (for error correlation)

---

## Related Documentation

- [PKCE Flow](pkce-flow.md) - Authentication flow walkthrough
- [JWT Structure](jwt.md) - Token format and verification
- [OAuth Overview](overview.md) - Worker architecture
