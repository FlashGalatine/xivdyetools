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

Discord redirect handler — verifies the signed state and bounces the auth code to the frontend. It
does **not** exchange the code; `POST /auth/callback` does.

| Parameter | Source | Description |
|-----------|--------|-------------|
| `code` | Discord | Authorization code |
| `state` | Discord | Signed state from Step 2 |
| `error` | Discord | Error code (on failure) |
| `error_description` | Discord | Error message (on failure) |

**Success:** `302` redirect to
`${redirect_uri}?code=<code>&csrf=<token>&state=<signed_state>` — plus `&return_path=<path>` only
when the recorded path is not `/`, and `&provider=<id>` only on flows configured to mark it. The
`state` is the same signed value the worker minted at authorize time, echoed back so the SPA can
return it in the POST leg (FINDING-012); it carries nothing secret.

**Failure:** `302` redirect with `?error=<message>`

**Validation:** state signature (HMAC-SHA256) and 10-minute expiry; the state's `provider` marker
must match the callback it arrived on; the recorded `redirect_uri` must be an allowlisted origin
**and** exactly `/auth/callback` with no query or fragment. A state that fails any of these bounces
to `FRONTEND_URL` with an error rather than to the untrusted target.

---

### POST /auth/callback

SPA token exchange — receives authorization code + PKCE verifier, returns JWT.

**Request:**
```json
{
  "code": "<authorization_code>",
  "code_verifier": "<43-128_char_verifier>",
  "state": "<the signed state echoed by GET /auth/callback>"
}
```

`state` is **required**: the worker verifies `base64url(SHA-256(code_verifier))` against the
`code_challenge` inside it *before* calling Discord, so PKCE holds regardless of provider behaviour
(FINDING-012). A `redirect_uri` field is accepted but ignored — the canonical worker callback URL is
always used for the exchange.

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
| 400 | `Invalid request body` — the body is not JSON |
| 400 | `Missing code or code_verifier` |
| 400 | `Invalid code_verifier format` — fails `[A-Za-z0-9-._~]{43,128}` |
| 400 | `Missing state` — the field is absent, `null` or empty |
| 400 | `Invalid state` — bad signature, expired, or minted for the other provider |
| 400 | `PKCE verification failed` — `S256(code_verifier)` does not match the signed `code_challenge` |
| 401 | Token exchange failed |
| 401 | Missing required scope (`identify`) |
| 401 | Invalid user data from Discord |
| 413 | `Payload too large` — the body exceeds the 10 KB `bodySizeLimit` |
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

Adds `jti` to the KV blacklist with a TTL of **the token's expiry plus a 15-minute grace**
(`REFRESH_GRACE_SECONDS`, floor 60 s), so a revoked id cannot fall out of the blacklist while any
consumer might still treat the token as live. Accepts expired tokens (allows logout after session
timeout).

Two different outcomes when the write does not happen:

| Situation | Response |
|-----------|----------|
| `TOKEN_BLACKLIST` is bound and the token has a `jti`, but the KV write **fails** | `503` `{ success: false, error: "Revocation failed", revoked: false }` and an error log. A logout that did not take is not a success: the session may still be live until `exp` (BUG-050) |
| `TOKEN_BLACKLIST` is not bound, or the token carries no `jti` | `200` `{ success: true, revoked: false }` with a `note` saying which of the two it was — there was never anything to write |

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

Rate limits are keyed on **IP + path**. In production the backend is the native Workers Rate
Limiting bindings (`RL_AUTH_10` / `RL_AUTH_20` / `RL_AUTH_30`, one per limit above), whose counters
are **atomic but per-colo** rather than a globally consistent sliding window — a distributed client
gets roughly `limit × colos`. KV (`TOKEN_BLACKLIST` under the `rl:` prefix) is the legacy fallback
and a per-isolate memory limiter is the dev/test fallback; both of those *are* sliding windows.
A backend error fails open, and the event is logged.

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
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — on every environment except `development` (FINDING-029: it used to be production-only, so any other non-development env went without it)
- `Cache-Control: no-store` and `Pragma: no-cache` (RFC 6749 §5.1)
- `X-Request-ID: <uuid>` (for error correlation)

---

## Related Documentation

- [PKCE Flow](pkce-flow.md) - Authentication flow walkthrough
- [JWT Structure](jwt.md) - Token format and verification
- [OAuth Overview](overview.md) - Worker architecture
