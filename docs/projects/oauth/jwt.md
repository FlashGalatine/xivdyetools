# JWT Structure

**Token format and verification for XIV Dye Tools authentication**

---

## Token Format

JWTs are three base64url-encoded parts separated by dots:

```
header.payload.signature
```

---

## Header

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

All tokens use HMAC-SHA256 signing.

---

## Payload Claims

### Standard Claims (RFC 7519)

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | string | Internal user ID (UUID) |
| `iat` | number | Issued at (Unix timestamp, seconds) |
| `exp` | number | Expiration (Unix timestamp, seconds) |
| `iss` | string | Issuer URL (e.g., `https://oauth.xivdyetools.app`) |
| `jti` | string | Unique token ID (UUID) for revocation tracking |

### User Claims

| Claim | Type | Description |
|-------|------|-------------|
| `username` | string | Discord or XIVAuth username |
| `global_name` | string \| null | Discord display name or character name |
| `avatar` | string \| null | Discord avatar hash |
| `auth_provider` | string | `"discord"` or `"xivauth"` |

### Provider-Specific Claims

| Claim | Type | Description |
|-------|------|-------------|
| `discord_id` | string? | Discord user ID (snowflake) |
| `xivauth_id` | string? | XIVAuth user ID |
| `primary_character` | object? | XIVAuth character info |

**Primary character object** (XIVAuth only):
```json
{
  "name": "Character Name",
  "server": "Adamantoise",
  "verified": true
}
```

### Example Payload (Discord)

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1704110400,
  "exp": 1704114000,
  "iss": "https://oauth.xivdyetools.app",
  "jti": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "username": "user123",
  "global_name": "Display Name",
  "avatar": "a_1234567890abcdef",
  "auth_provider": "discord",
  "discord_id": "123456789012345678"
}
```

---

## Signature

**Algorithm:** HMAC-SHA256

**Key:** `JWT_SECRET` environment variable (hex string, 256-bit)

**Process:**
```
message   = base64url(header) + '.' + base64url(payload)
signature = HMAC-SHA256(message, JWT_SECRET)
token     = message + '.' + base64url(signature)
```

Uses the Web Crypto API (`crypto.subtle`) for Cloudflare Workers compatibility.

---

## Token Lifetime

| Setting | Value |
|---------|-------|
| Default lifetime | 1 hour (3600 seconds) |
| Configurable via | `JWT_EXPIRY` environment variable |
| Refresh grace period | 24 hours after expiry |

**Expiration check:**
```typescript
const now = Math.floor(Date.now() / 1000);
if (payload.exp < now) {
  // Token expired — try refresh if within 24-hour grace period
}
```

---

## Token Lifecycle

### Creation

Tokens are created at `POST /auth/callback` after successful OAuth exchange:

1. Generate timestamps: `iat = now`, `exp = now + JWT_EXPIRY`
2. Generate unique `jti` via `crypto.randomUUID()`
3. Build payload with user claims
4. Sign with HMAC-SHA256
5. Return token + `expires_at`

### Verification

At `GET /auth/me` and other authenticated endpoints:

1. Split token into 3 parts
2. Recompute HMAC-SHA256 signature and compare (timing-safe)
3. Decode payload and check `exp` against current time
4. Check JTI against revocation blacklist (if KV available)
5. Return verified claims

### Refresh

At `POST /auth/refresh`:

1. Verify signature (ignores expiry)
2. Check if within 24-hour grace period
3. Check revocation blacklist
4. Issue new token with fresh `iat`, `exp`, and `jti`
5. Old token remains valid until its natural expiry

### Revocation

At `POST /auth/revoke`:

1. Verify signature only (allows expired tokens for logout)
2. Store `revoked:<jti>` in KV with TTL matching token expiry
3. Future verification checks against blacklist
4. KV entries auto-expire when token would have expired naturally

---

## Consumer Usage

### Web App

```typescript
// Display user info
const { username, global_name, avatar_url } = user;

// Check expiry for refresh
if (payload.exp < Date.now() / 1000) {
  await refreshToken();
}
```

### Presets API

```typescript
// Verify token and extract user
const payload = await verifyJWT(token, JWT_SECRET);
const userId = payload.sub;           // Preset ownership
const provider = payload.auth_provider; // User type
```

---

## Related Documentation

- [PKCE Flow](pkce-flow.md) - OAuth authentication flow
- [Endpoints](endpoints.md) - Full API reference
