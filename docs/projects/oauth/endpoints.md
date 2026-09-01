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

XIVAuth token exchange. Same request format and same response shape as `POST /auth/callback`,
with `auth_provider: "xivauth"` and `avatar` / `avatar_url` always `null` (XIVAuth exposes no
avatar).

The `character` scope is used to find the caller's **verified** character, whose name becomes
`username` and `global_name`. The rest of the roster is read in memory and discarded.

**`primary_character` was removed in 3.0.0** — from the response body and from the JWT
(FINDING-001 / FINDING-002, `docs/audits/2026-08-29-security`). It carried a character name,
home world and verified flag, *including for an unverified registration*, that no consumer
renders; the matching `xivauth_characters` table is gone too. A verified character's name still
reaches consumers as `username` / `global_name`.

**Additional validation:** Requires `user` and `character` scopes.

---

## Token Management Endpoints

### ~~POST /auth/refresh~~ — removed in 3.0.0

**Removed** by FINDING-003 (`docs/audits/2026-08-29-security`). `POST /auth/refresh` now returns
`404 Not Found` like any unknown route.

It had no client — the web app re-runs the sign-in flow rather than refreshing — but it accepted a
token on signature alone for `REFRESH_GRACE_SECONDS` past `exp` and minted the replacement from the
*old* token's claims. Whoever held a copied token could therefore refresh it indefinitely up to the
30-day `orig_iat` cap, and the victim's `/auth/revoke` blacklisted only the `jti` the victim held,
so the attacker's chain survived the logout.

**There is no session extension.** A token is valid until `exp` (1 h by default, `JWT_EXPIRY`);
after that the client starts a new PKCE flow.

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

**Rate limit:** the `/auth/*` default, 30/min per IP.

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
| `GET /auth/me` | 30/min | 60s |
| `POST /auth/revoke` | 30/min | 60s |

Every `/auth/*` route is limited; anything without a stricter entry above falls to the 30/min
default (`OAUTH_LIMITS` in `@xivdyetools/worker-kit/rate-limiter`). `POST /auth/refresh` had the
same 30/min tier before it was removed in 3.0.0.

Rate limits are per-IP using a sliding window algorithm (`@xivdyetools/worker-kit/rate-limiter`).

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

## Security Headers

Set on every response the app dispatches (including `/`, `/health` and 404s), with one exception: Hono's `cors()` middleware answers an OPTIONS preflight with its own 204 before the header middleware — registered after `cors()` — ever runs, so a preflight response carries the CORS headers only, none of these:

| Header | Value |
|--------|-------|
| `Cache-Control` | `no-store` |
| `Pragma` | `no-cache` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (not in `ENVIRONMENT=development`) |

`Cache-Control: no-store` / `Pragma: no-cache` were added in 3.0.0 (FINDING-022,
`docs/audits/2026-08-29-security`): the token responses are bearer JWTs, which RFC 6749 §5.1
requires never be cached, and the callback bounces carry an authorization code.

---

## CORS

**Allowed origins:** `ALLOWED_REDIRECT_ORIGINS` (`https://xivdyetools.app`, `https://beta.xivdyetools.app`, transitional `https://xivdyetools.projectgalatine.com`) + `FRONTEND_URL`; in `ENVIRONMENT=development` also localhost / 127.0.0.1 on ports 3000, 5173, 8787

**Methods:** GET, POST, OPTIONS

**Headers:** Content-Type, Authorization (exposes the `X-RateLimit-*` and `Retry-After` headers)

**Credentials:** Enabled

**Preflight cache:** 1 hour (`maxAge: 3600`, was 24 h before 2.4.0)

---

## Global Security Headers

Every response the app dispatches includes (CORS preflight 204s excluded — see Security Headers above):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000` (production only)
- `X-Request-ID: <uuid>` (for error correlation)

---

## Related Documentation

- [PKCE Flow](pkce-flow.md) - Authentication flow walkthrough
- [JWT Structure](jwt.md) - Token format and verification
- [OAuth Overview](overview.md) - Worker architecture
