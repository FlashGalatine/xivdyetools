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
wrangler secret put XIVAUTH_CLIENT_SECRET  # optional, confidential-client mode

# Start local dev server (port 8788)
pnpm --filter xivdyetools-oauth-worker run dev

# Deploy — NOTE: on this worker a bare `wrangler deploy` IS production
# (no [env.production]; the top-level block is `xivdyetools-oauth` on auth.xivdyetools.app;
# `[env.development]` is the only non-production env — `[env.preview]` was deleted 2026-08-21, FINDING-029)
pnpm --filter xivdyetools-oauth-worker run deploy   # = wrangler deploy, i.e. production
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
│   └── body-validation.ts   # bodySizeLimit (10 KB), requireJsonContentType (415), jsonDepthLimit
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
    "identity_revision": 0,
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
- `identity_revision` - local relationship revision; profile edits do not increment it
- `discord_id` - Discord user ID; **omitted** on an XIVAuth-only account
- `username` - Discord username (or the verified character name on XIVAuth)
- `global_name` - Display name
- `avatar` - Avatar hash for URL construction

An XIVAuth-only account gets ten claims; a Discord ID adds the eleventh. OAuth checks the
current revision and provider relationship before returning `/auth/me`. Legacy missing revision
means zero only against a nonpending revision-zero row.

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
rate-limit counters) and `RL_AUTH_10` / `RL_AUTH_20` / `RL_AUTH_30` (Workers Rate Limiting). `TOKEN_BLACKLIST` and the three `RL_AUTH_*` bindings are production-required (FINDING-013): outside `ENVIRONMENT=development`, `validateEnv` refuses every request with a 500 `Service misconfigured` — `/health` included — while any of them is missing. The worker fails closed, never silently.
There is **no Durable Object** anywhere in this worker.

Redirect / CORS origins are `ALLOWED_REDIRECT_ORIGINS` (`https://xivdyetools.app`, `https://beta.xivdyetools.app`) plus `FRONTEND_URL` — unified in 2.6.0, which fixed the beta login hang.

**Secrets:**
```bash
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put JWT_SECRET
wrangler secret put XIVAUTH_CLIENT_SECRET  # optional, confidential-client mode
```

---

## Database

The worker owns one D1 database, `xivdyetools-users`, with a single `users` table (schema in
`apps/oauth/schema/users.sql`). On a fresh database, load it from `apps/oauth/` with:

```bash
wrangler d1 execute xivdyetools-users --remote --file=./schema/users.sql
```

An existing database that still has the pre-3.0 schema (a `users.avatar_url` column) is brought
into line by `apps/oauth/migrations/0001_drop_xivauth_characters.sql`, which is **hand-run** once,
after the deploy that stops writing the dropped table and column (oauth 3.0.0); it is not part of
any deploy. Its `ALTER TABLE` is not idempotent, so never rerun it on a database that already ran
it or was created from the current schema; check `PRAGMA table_info(users)` first, as the
migration header describes. Run it with `wrangler d1 execute … --file=`, never
`d1 migrations apply`. See
[`apps/oauth/CLAUDE.md`](../../../apps/oauth/CLAUDE.md#database) for the table layout and the
full procedure.

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

## Private identity preparation

The named `IdentityLookup` service export adds no public HTTP route. It returns a current
stored association and supports session revision validation. `IDENTITY_SPLIT_ENABLED` remains
false; the first release has no outbound continuity binding and refuses detected existing
relationship changes. Apply the additive users migration before deployment and verify the
later presets/moderation consumers before a separate activation. See
[the identity and moderation contract](../../architecture/identity-moderation.md).
