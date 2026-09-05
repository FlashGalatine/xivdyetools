# OAuth Worker Overview

**xivdyetools-oauth** - Discord and XIVAuth authentication for the XIV Dye Tools ecosystem

---

## What is the OAuth Worker?

A Cloudflare Worker that handles Discord and XIVAuth OAuth authentication and issues JWTs for the XIV Dye Tools ecosystem. All other services verify these JWTs to authenticate users.

Current version: [docs/versions.md](../../versions.md). Release history:
[`apps/oauth/CHANGELOG.md`](../../../apps/oauth/CHANGELOG.md).

---

## Quick Start (Development)

```bash
# From the monorepo root (xivdyetools/)
pnpm install

# Set secrets (one time, from apps/oauth/)
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put JWT_SECRET

# Start local dev server (port 8788)
pnpm --filter xivdyetools-oauth-worker run dev

# Deploy — NOTE: on this worker a bare `wrangler deploy` IS production
# (no [env.production]; the top-level block is `xivdyetools-oauth` on auth.xivdyetools.app;
# `[env.development]` is the only non-production env — `[env.preview]` was deleted 2026-08-21, FINDING-029)
npm run deploy
```

See [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../operations/DEPLOY_ENVIRONMENTS.md).

---

## Architecture

### OAuth Flow (PKCE)

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌─────────┐
│ Browser │     │  OAuth   │     │ Discord │     │  APIs   │
└────┬────┘     └────┬─────┘     └────┬────┘     └────┬────┘
     │               │                │               │
     │ Generate PKCE │                │               │
     │ code_verifier │                │               │
     │──────────────►│                │               │
     │               │                │               │
     │               │ Redirect to    │               │
     │               │ Discord OAuth  │               │
     │               │───────────────►│               │
     │               │                │               │
     │               │ User approves  │               │
     │               │◄───────────────│               │
     │               │                │               │
     │               │ Exchange code  │               │
     │               │───────────────►│               │
     │               │                │               │
     │               │ Access token   │               │
     │               │◄───────────────│               │
     │               │                │               │
     │  JWT token    │                │               │
     │◄──────────────│                │               │
     │               │                │               │
     │ API request   │                │               │
     │ with JWT      │                │   Verify JWT  │
     │───────────────┼───────────────►│───────────────│
     │               │                │               │
```

### Project Structure

```
src/
├── index.ts                 # Hono app, CORS allowlist, security headers, /auth/* rate limiting, routes
├── types.ts                 # Env interface + TypeScript interfaces
├── constants/
│   └── oauth.ts             # Redirect-origin allowlist, callback path, state expiry, timeouts, scopes
├── handlers/
│   ├── authorize.ts         # GET /auth/discord
│   ├── oauth-flow.ts        # The shared authorize + GET-callback pipeline both providers are built from
│   ├── callback.ts          # GET/POST /auth/callback (Discord)
│   ├── xivauth.ts           # GET /auth/xivauth, GET/POST /auth/xivauth/callback
│   └── token.ts             # GET /auth/me, POST /auth/revoke
├── middleware/
│   └── body-validation.ts   # bodySizeLimit (10 KB), jsonDepthLimit
├── services/
│   ├── jwt-service.ts       # JWT creation/verification, revocation check
│   ├── user-service.ts      # findOrCreateUser + identity attachment rules (D1)
│   └── rate-limit.ts        # Backend selector: native RL_AUTH_* → KV → per-isolate memory
└── utils/
    ├── oauth-validation.ts  # validateRedirectUri (origin + exact path), validateReturnPath, validateStateParam, PKCE format checks
    ├── pkce-binding.ts      # verifyPkceStateBinding — S256(code_verifier) vs the signed code_challenge
    ├── state-signing.ts     # signState / verifyState (HMAC-SHA256 over base64url JSON)
    └── env-validation.ts    # Env validation, incl. the production-required bindings
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/discord` | GET | Start the Discord flow (PKCE required) |
| `/auth/callback` | GET | Discord redirect handler — verifies the state and **bounces** `code` + `csrf` + `state` to the SPA; it does not exchange the code |
| `/auth/callback` | POST | The token exchange — `{ code, code_verifier, state }`; verifies the PKCE↔state binding itself, then exchanges and returns the JWT in the body |
| `/auth/xivauth` | GET | Start the XIVAuth flow |
| `/auth/xivauth/callback` | GET / POST | Same two legs for XIVAuth |
| `/auth/me` | GET | Get user info from JWT (revocation- and issuer-checked) |
| `/auth/revoke` | POST | Logout (blacklists the `jti`) |

`POST /auth/refresh` was removed in 3.0.0 and now 404s — see below.

---

## PKCE Security

PKCE (Proof Key for Code Exchange) prevents authorization code interception:

```typescript
// Client generates random verifier
const code_verifier = generateRandomString(64);

// Client creates challenge (SHA256 hash)
const code_challenge = base64url(sha256(code_verifier));

// Client sends challenge to /auth/discord
// Server stores challenge

// After Discord redirect, client sends verifier
// Server verifies: sha256(verifier) === stored_challenge
```

---

## JWT Structure

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
    "iss": "https://auth.xivdyetools.app",
    "jti": "b2c1a9f0-...",
    "username": "User#1234",
    "global_name": "Display Name",
    "avatar": "avatar_hash",
    "auth_provider": "discord",
    "discord_id": "123456789012345678"
  }
}
```

**Claims:**
- `sub` - User UUID (internal)
- `iat` - Issued at timestamp
- `exp` - Expiration timestamp (1 hour default)
- `iss` - Issuer URL (`WORKER_URL`) — pinned on verification, so a token signed with the same secret by anything else is rejected
- `jti` - Unique token ID, the key `POST /auth/revoke` blacklists
- `auth_provider` - `discord` or `xivauth`
- `discord_id` - Discord user ID; **omitted** on an XIVAuth-only account
- `username` - Discord username (or the verified character name on XIVAuth)
- `global_name` - Display name
- `avatar` - Avatar hash for URL construction

Nothing else is carried: an XIVAuth-only account gets nine claims, a Discord one ten.

---

## Environment Variables

**wrangler.toml:**
```toml
[vars]
ENVIRONMENT = "production"
DISCORD_CLIENT_ID = "your-client-id"
XIVAUTH_CLIENT_ID = "your-xivauth-client-id"
FRONTEND_URL = "https://xivdyetools.app"
WORKER_URL = "https://auth.xivdyetools.app"
JWT_EXPIRY = "3600"
```

`XIVAUTH_CLIENT_ID` is **required** in every environment — `validateEnv` lists it alongside
`DISCORD_CLIENT_ID`, so the XIVAuth flow is not optional configuration.

Bindings: `DB` (D1 `xivdyetools-users`), `TOKEN_BLACKLIST` (KV — revoked `jti`s and the fallback
rate-limit counters) and `RL_AUTH_10` / `RL_AUTH_20` / `RL_AUTH_30` (Workers Rate Limiting). All
four are production-required (FINDING-013); each degrades silently rather than loudly when absent.
There is **no Durable Object** anywhere in this worker.

Redirect / CORS origins are `ALLOWED_REDIRECT_ORIGINS` (`https://xivdyetools.app`, `https://beta.xivdyetools.app`, the transitional `https://xivdyetools.projectgalatine.com`) plus `FRONTEND_URL` — unified in 2.6.0, which fixed the beta login hang.

**Secrets:**
```bash
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put JWT_SECRET
```

---

## No Token Refresh (removed in 3.0.0)

A session ends when the JWT expires (1 h by default); the client then runs the PKCE sign-in flow
again. `POST /auth/refresh` was removed by FINDING-003 (`docs/audits/2026-08-29-security`) and the
route now 404s.

The endpoint had no caller — the web app has always re-authenticated rather than refreshed — but it
accepted a token on signature alone past `exp` and re-minted the replacement from the *old* token's
claims. Anyone holding a copied token could therefore refresh it every hour up to the 30-day
`orig_iat` cap, and the victim's `/auth/revoke` only blacklisted the `jti` the victim held, so the
attacker's chain outlived the logout.

---

## Related Documentation

- [PKCE Flow](pkce-flow.md) - Detailed PKCE implementation
- [JWT Structure](jwt.md) - Token format and verification
- [Endpoints](endpoints.md) - Full API reference
