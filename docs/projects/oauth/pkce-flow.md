# PKCE Flow

**OAuth 2.0 + PKCE security flow for XIV Dye Tools authentication**

---

## Overview

XIV Dye Tools uses **OAuth 2.0 with PKCE** (Proof Key for Code Exchange) for authentication. PKCE protects against authorization code interception attacks — even if an attacker captures the authorization code, they cannot exchange it without the `code_verifier` that never leaves the client.

Two OAuth providers are supported:
- **Discord** — Primary authentication (scope: `identify`)
- **XIVAuth** — FFXIV character verification (scopes: `user user:social character refresh`)

---

## Complete Flow

### Step 1: Client Generates PKCE Parameters

Before initiating OAuth, the client generates cryptographic proof:

```typescript
// Generate code_verifier: 43-128 characters [A-Za-z0-9-._~]
const code_verifier = generateRandomString(128);

// Compute code_challenge = BASE64URL(SHA256(code_verifier))
const code_challenge = base64url(await sha256(code_verifier));

// Store verifier in sessionStorage (never sent until Step 5)
sessionStorage.setItem('pkce_verifier', code_verifier);
```

The `code_verifier` stays in the browser. Only the `code_challenge` (a one-way hash) is sent to the server.

### Step 2: Client Initiates OAuth

```
GET /auth/discord?code_challenge=<base64url>&code_challenge_method=S256
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `code_challenge` | Yes | BASE64URL(SHA256(code_verifier)), 43-128 chars |
| `code_challenge_method` | No | Must be `S256` if provided (default) |
| `state` | No | CSRF token (UUID auto-generated if omitted) |
| `redirect_uri` | No | Where to return after auth (must be whitelisted) |
| `return_path` | No | Frontend path to restore after login (default: `/`) |

**Worker processing:**
1. Validates PKCE challenge format
2. Creates state object with CSRF token, challenge, redirect URI, and 10-minute expiry
3. Signs state with HMAC-SHA256 using `JWT_SECRET`
4. **302 redirects** to Discord authorization URL with PKCE parameters

### Step 3: User Authorizes on Discord

Discord presents the consent screen. On approval, Discord redirects back:

```
GET /auth/callback?code=<authorization_code>&state=<signed_state>
```

### Step 4: Worker Validates State

The callback handler at `GET /auth/callback`:

1. Verifies HMAC-SHA256 signature on state (prevents tampering)
2. Checks state expiration (10-minute TTL)
3. Validates redirect URI origin against whitelist
4. Passes authorization code to the frontend:
   ```
   302 → ${redirect_uri}?code=<auth_code>&csrf=<token>&return_path=<path>
   ```

The authorization code alone is useless — it requires the `code_verifier` to exchange.

### Step 5: Client Exchanges Code

The frontend sends both the code and the stored verifier:

```json
POST /auth/callback
{
  "code": "<authorization_code>",
  "code_verifier": "<from_sessionStorage>"
}
```

**Worker processing:**
1. Sends code + code_verifier to Discord's token endpoint
2. Discord validates: `SHA256(code_verifier) == code_challenge` from Step 2
3. On success, fetches user info from Discord API
4. Creates/updates user in D1 database
5. Issues JWT and returns user data

**Response:**
```json
{
  "success": true,
  "token": "<jwt>",
  "user": {
    "id": "<user_id>",
    "username": "<discord_username>",
    "global_name": "<display_name>",
    "avatar_url": "<cdn_url>",
    "auth_provider": "discord"
  },
  "expires_at": 1704114000
}
```

---

## State Parameter Security

The state parameter prevents CSRF and tampering attacks.

**Format:** `base64url(json).hmac_signature`

**State data structure:**
```typescript
{
  csrf: string;           // CSRF token (UUID)
  code_challenge: string; // For logging/debugging
  redirect_uri: string;   // Where to redirect after auth
  return_path: string;    // Frontend path to restore
  provider: string;       // 'discord' or 'xivauth'
  iat: number;            // Issued at (seconds)
  exp: number;            // Expires at (seconds) — 10-minute TTL
}
```

**Protections:**
- HMAC-SHA256 signature prevents state modification
- 10-minute expiry prevents replay attacks
- CSRF token prevents cross-site request forgery

---

## Redirect URI Validation

Only whitelisted origins are allowed:

| Environment | Allowed Origins |
|-------------|----------------|
| Production | `FRONTEND_URL` (e.g., `https://xivdyetools.app`) |
| Development | `localhost:5173`, `localhost:3000`, `127.0.0.1:5173`, `127.0.0.1:3000` |

Validation requires exact origin match (protocol + hostname + port). No subdomain wildcards.

---

## XIVAuth Differences

The XIVAuth flow is identical to Discord with these differences:

| Aspect | Discord | XIVAuth |
|--------|---------|---------|
| Initiate | `GET /auth/discord` | `GET /auth/xivauth` |
| Callback | `GET /auth/callback` | `GET /auth/xivauth/callback` |
| Exchange | `POST /auth/callback` | `POST /auth/xivauth/callback` |
| Scopes | `identify` | `user user:social character refresh` |
| User data | Username, avatar | Username, character name, server, verified status |
| Account merge | — | Merges with Discord account if linked |

XIVAuth provides FFXIV character information and can link to an existing Discord-authenticated account via the `user:social` scope.

---

## Request Timeouts

| External Call | Timeout |
|---------------|---------|
| Token exchange (Discord/XIVAuth) | 10 seconds |
| User info fetch | 5 seconds |
| Character list fetch (XIVAuth) | 5 seconds |

Timeouts use `AbortSignal.timeout()` to prevent worker hangs on slow upstream APIs.

---

## Related Documentation

- [JWT Structure](jwt.md) - Token format and verification
- [Endpoints](endpoints.md) - Full API reference
- [Architecture Overview](../../architecture/overview.md) - How OAuth fits in the ecosystem
