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
4. Bounces the authorization code back to the frontend — it does **not** exchange it here:
   ```
   302 → ${redirect_uri}?code=<auth_code>&csrf=<token>&state=<signed_state>[&return_path=<path>][&provider=<id>]
   ```

`state` is the same signed value the worker minted in Step 2, echoed back so the SPA can return it
in Step 5 (FINDING-012). `return_path` is only appended when it is something other than `/`, and
`provider` only on the flows whose config sets `markProviderOnRedirect`.

The authorization code alone is useless — it requires the `code_verifier` to exchange.

### Step 5: Client Exchanges Code

The frontend sends both the code and the stored verifier:

```json
POST /auth/callback
{
  "code": "<authorization_code>",
  "code_verifier": "<from_sessionStorage>",
  "state": "<the signed state echoed by the GET bounce>"
}
```

`state` is **required**. Without it there is nothing to bind the verifier to, so the exchange must
not reach the provider: a missing one is `400 Missing state`.

**Worker processing:**
1. Validates `code_verifier` against RFC 7636's grammar (`[A-Za-z0-9-._~]{43,128}`)
2. **Verifies the PKCE↔state binding itself, before calling Discord** (`verifyPkceStateBinding`):
   the state's HMAC signature, expiry and provider marker must check out, and
   `base64url(SHA-256(code_verifier))` must equal the `code_challenge` this worker signed at
   authorize time. A bad signature/expiry/provider is `400 Invalid state`; a challenge mismatch is
   `400 PKCE verification failed`
3. Only then sends code + code_verifier to Discord's token endpoint (Discord checks PKCE too — this
   worker no longer *depends* on it doing so, which is the point of step 2)
4. Fetches user info from the Discord API
5. Creates/updates the user row in D1
6. Issues the JWT and returns it **in the response body** — no redirect, no cookie

**Response:**
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

---

## State Parameter Security

The state parameter prevents CSRF and tampering attacks.

**Format:** `base64url(json).hmac_signature`

**State data structure:**
```typescript
{
  csrf: string;           // CSRF token (UUID)
  code_challenge: string; // THE PKCE ANCHOR — what the POST leg checks S256(code_verifier) against
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
- `code_challenge` is what makes PKCE enforceable **here** rather than only at the provider: the
  state is signed with `JWT_SECRET`, so a client cannot swap in a challenge of its own choosing
- `provider` pins the state to the flow it was minted for, so a Discord state cannot be replayed at
  the XIVAuth callback (checked on both the GET and POST legs)

---

## Redirect URI Validation

The allowlist is `ALLOWED_REDIRECT_ORIGINS` (`src/constants/oauth.ts`) **plus** `env.FRONTEND_URL`,
assembled by `getAllowedRedirectOrigins(env)`. It is not `FRONTEND_URL` alone:

| Environment | Allowed Origins |
|-------------|----------------|
| Production | `https://xivdyetools.app`, `https://beta.xivdyetools.app`, `https://xivdyetools.projectgalatine.com` (transition domain), plus `env.FRONTEND_URL` |
| Development | All of the above plus `http://localhost:5173`, `http://localhost:3000`, `http://127.0.0.1:5173`, `http://127.0.0.1:3000` |

The loopback entries are filtered out whenever `ENVIRONMENT !== 'development'`.

Validation requires an exact origin match (protocol + hostname + port) — no subdomain wildcards —
**and** the path must be exactly `/auth/callback` (`REDIRECT_CALLBACK_PATH`) with no query string
and no fragment. Origin-only matching was the FINDING-012 gap: an allowlisted origin with an
attacker-chosen path was accepted. The same allowlist is consulted at authorize time and again on
the GET callback, so a flow cannot start on one origin and bounce to another.

---

## XIVAuth Differences

The XIVAuth flow is identical to Discord with these differences:

| Aspect | Discord | XIVAuth |
|--------|---------|---------|
| Initiate | `GET /auth/discord` | `GET /auth/xivauth` |
| Callback | `GET /auth/callback` | `GET /auth/xivauth/callback` |
| Exchange | `POST /auth/callback` | `POST /auth/xivauth/callback` |
| Scopes | `identify` | `user user:social character refresh` |
| User data | Username, avatar | Username taken from the **verified** character; the roster is read in memory and discarded |
| Account merge | — | **Never merges two existing accounts** (see below) |

XIVAuth provides FFXIV character information and asserts a Discord link via the `user:social` scope.
What the worker does with that link is deliberately narrow (FINDING-013):

- A Discord ID that **another local account already owns** is *not* claimed, and nothing is deleted.
  Linking two existing accounts needs an explicit, signed-in confirmation step, which does not
  exist — so it simply does not happen. The refusal is audit-logged without identifiers.
- A Discord ID **nobody owns** is linked to the logging-in account (the social link is
  OAuth-verified upstream, and there is no competing local identity).
- An existing Discord link is **never overwritten** from an XIVAuth assertion.
- The XIVAuth ID of the account actually logging in wins over a stale one left by an earlier link —
  the Discord account is the anchor.

Before this, the merge was driven solely by the asserted Discord link: another row could be deleted
and its Discord ID — the presets-api identity and moderator key — claimed by this one.

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
