# OAuth Worker Overview

**xivdyetools-oauth** v2.6.0 - Discord OAuth authentication for the XIV Dye Tools ecosystem

---

## What is the OAuth Worker?

A Cloudflare Worker that handles Discord OAuth authentication and issues JWTs for the XIV Dye Tools ecosystem. All other services verify these JWTs to authenticate users.

---

## Quick Start (Development)

```bash
cd xivdyetools-oauth

# Install dependencies
npm install

# Set secrets (one time)
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put JWT_SECRET

# Start local dev server (port 8788)
npm run dev

# Deploy — NOTE: on this worker a bare `wrangler deploy` IS production
# (no [env.production]; the top-level block is `xivdyetools-oauth` on auth.xivdyetools.app;
# `[env.development]` / `[env.preview]` are the non-production envs)
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
├── index.ts                 # Hono app, middleware, routes
├── types.ts                 # TypeScript interfaces
├── handlers/
│   ├── authorize.ts         # GET /auth/discord
│   ├── callback.ts          # GET/POST /auth/callback
│   └── refresh.ts           # POST /auth/refresh, GET /auth/me
└── services/
    └── jwt-service.ts       # JWT creation/verification
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/discord` | GET | Start OAuth flow (PKCE required) |
| `/auth/callback` | GET | Discord redirect handler |
| `/auth/callback` | POST | SPA token exchange |
| `/auth/refresh` | POST | Refresh expired JWT |
| `/auth/me` | GET | Get user info from JWT |
| `/auth/revoke` | POST | Logout (client-side) |

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
- `iss` - Issuer URL
- `discord_id` - Discord user ID
- `username` - Discord username
- `global_name` - Discord display name
- `avatar` - Avatar hash for URL construction

---

## Environment Variables

**wrangler.toml:**
```toml
[vars]
ENVIRONMENT = "production"
DISCORD_CLIENT_ID = "your-client-id"
FRONTEND_URL = "https://xivdyetools.app"
WORKER_URL = "https://auth.xivdyetools.app"
JWT_EXPIRY = "3600"
```

Redirect / CORS origins are `ALLOWED_REDIRECT_ORIGINS` (`https://xivdyetools.app`, `https://beta.xivdyetools.app`, the transitional `https://xivdyetools.projectgalatine.com`) plus `FRONTEND_URL` — unified in 2.6.0, which fixed the beta login hang.

**Secrets:**
```bash
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put JWT_SECRET
```

---

## Refresh Token Grace Period

JWTs can be refreshed within 24 hours after expiration:

```typescript
// Token expired 2 hours ago
// Client sends: POST /auth/refresh with expired JWT

// Server checks:
// 1. Is JWT signature valid?
// 2. Is expiration within 24h grace period?

// If yes, issue new JWT
```

This allows users to stay logged in without re-authenticating frequently.

---

## Related Documentation

- [PKCE Flow](pkce-flow.md) - Detailed PKCE implementation
- [JWT Structure](jwt.md) - Token format and verification
- [Endpoints](endpoints.md) - Full API reference
