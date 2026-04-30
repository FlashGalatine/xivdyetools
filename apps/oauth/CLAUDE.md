# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cloudflare Worker that handles OAuth authentication for the XIV Dye Tools ecosystem. Supports two providers — **Discord** (primary, used everywhere) and **XIVAuth** (FFXIV community SSO that adds character verification). Both flows are PKCE-only (no implicit grant, no client_secret in the browser) and issue HS256 JWTs that downstream services (`xivdyetools-presets-api`, `xivdyetools-web-app`) verify with a shared `JWT_SECRET`.

The worker also owns a small D1 database (`xivdyetools-users`) that stores a unified user identity per provider plus a separate table for verified FFXIV characters from XIVAuth. JWT revocation is supported via a KV-backed blacklist with TTL matching token expiry.

## Commands

```bash
npm run dev                          # wrangler dev (port 8788)
npm run dev -- --env development     # Run with development env vars
npm run deploy                       # Deploy (default = production-like)
npm run deploy:production            # Deploy to production env
npm run test                         # vitest
npm run test:coverage                # Coverage via @vitest/coverage-v8
npm run type-check                   # tsc --noEmit
npm run lint                         # eslint src/
```

### Setting Secrets

```bash
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put XIVAUTH_CLIENT_SECRET    # Optional: only for confidential client mode
wrangler secret put JWT_SECRET                # openssl rand -hex 32 — share with presets-api
```

### Database Setup

```bash
wrangler d1 execute xivdyetools-users --remote --file=./schema/users.sql
wrangler d1 execute xivdyetools-users --local  --file=./schema/users.sql
```

### Pre-commit Checklist

```bash
npm run lint && npm run test -- --run && npm run type-check
```

## Architecture

### OAuth Flow (Discord)

```
Frontend                       OAuth Worker                       Discord
   │                                │                                │
   │  generate code_verifier        │                                │
   │  + code_challenge (S256)       │                                │
   │                                │                                │
   │  GET /auth/discord ?code_challenge=...&redirect_uri=...&state=…│
   │ ──────────────────────────────►│                                │
   │                                │  signState(HMAC-SHA256, 10min) │
   │ ◄── 302 Discord authorize ─────│                                │
   │                                                                  │
   │  Discord login + consent ──────────────────────────────────────►│
   │                                                                  │
   │ ◄────────────── 302 /auth/callback?code=…&state=…────────────── │
   │                                │                                │
   │  POST /auth/callback           │  verifyState(signature + age)  │
   │  { code, code_verifier, ... } ►│                                │
   │                                │  exchange code+verifier (10s)  │
   │                                │ ──────────────────────────────►│
   │                                │ ◄────────── tokens ────────────│
   │                                │  fetch /users/@me (5s)         │
   │                                │  upsert user in D1             │
   │                                │  createJWTForUser (HS256)      │
   │ ◄── { jwt, user, refreshAt } ──│                                │
```

XIVAuth follows the same shape under `/auth/xivauth` and `/auth/xivauth/cb`, plus pulls `/api/v1/characters` and stores them in `xivauth_characters`.

### Key Directories

```
src/
├── index.ts                          # Hono app, CORS allowlist, rate limiting, route mounting
├── types.ts                          # Env interface + re-exports from @xivdyetools/types
├── constants/
│   └── oauth.ts                      # Timeouts, scopes, allowed redirect origins, state expiry
├── handlers/
│   ├── authorize.ts                  # GET /auth/discord (PKCE entry point)
│   ├── callback.ts                   # GET + POST /auth/callback (token exchange + JWT mint)
│   ├── xivauth.ts                    # XIVAuth GET /auth/xivauth + /auth/xivauth/cb
│   └── refresh.ts                    # POST /auth/refresh, POST /auth/revoke (also /auth/me historically)
├── middleware/
│   └── body-validation.ts            # bodySizeLimit (10KB), jsonDepthLimit
├── services/
│   ├── jwt-service.ts                # HS256 sign/verify via Web Crypto, jti, revocation check
│   ├── user-service.ts               # findOrCreateUser, storeCharacters (D1 upserts)
│   ├── rate-limit.ts                 # In-memory legacy rate limiter (per-isolate)
│   └── rate-limit-do.ts              # Durable Object rate limiter (persistent, distributed)
├── durable-objects/
│   └── rate-limiter.ts               # Durable Object class for distributed rate limiting
├── utils/
│   ├── oauth-validation.ts           # validateCodeChallenge, validateCodeVerifier, validateRedirectUri, validateScopes, validateStateExpiration
│   ├── state-signing.ts              # signState/verifyState (HMAC-SHA256 over base64url JSON)
│   └── env-validation.ts             # First-request env validation
└── __tests__/                        # Test suites (separate __tests__ dir, not co-located)
```

### Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 (`xivdyetools-users`) | Users + XIVAuth characters |
| `TOKEN_BLACKLIST` | KV Namespace | Revoked JWT IDs (TTL matches token expiry) |
| `RATE_LIMITER` | Durable Object Namespace (optional) | Persistent per-IP rate limit when `USE_DO_RATE_LIMITING = "true"` |

Vars: `ENVIRONMENT`, `DISCORD_CLIENT_ID`, `XIVAUTH_CLIENT_ID`, `FRONTEND_URL`, `WORKER_URL`, `JWT_EXPIRY` (seconds, default `3600`). Custom domains: `auth.xivdyetools.app`, `auth-preview.xivdyetools.app`, `auth.xivdyetools.projectgalatine.com`. The `wrangler.toml` also defines a development env (`xivdyetools-oauth-dev`) and a preview env (`xivdyetools-oauth-preview`) — note the dev D1 still has `database_id = "TODO_RUN_WRANGLER_D1_CREATE"` placeholder.

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `DISCORD_CLIENT_SECRET` | Discord OAuth app secret |
| `JWT_SECRET` | HS256 signing key — must be identical to `xivdyetools-presets-api`'s `JWT_SECRET` |

### Optional Secrets

| Secret | Purpose |
|--------|---------|
| `XIVAUTH_CLIENT_SECRET` | XIVAuth confidential-client secret (PKCE-only flows can omit it) |
| `USE_DO_RATE_LIMITING` | `"true"` to switch from in-memory to Durable Object rate limiting |

## Database

### Tables (`schema/users.sql`)

| Table | Purpose |
|-------|---------|
| `users` | Unified identity row; `discord_id` and `xivauth_id` are nullable but at least one must be set (CHECK constraint). `auth_provider` records the most-recent login source. |
| `xivauth_characters` | FFXIV characters fetched from XIVAuth (Lodestone ID, name, server, verified flag); composite PK `(user_id, lodestone_id)`. |

Partial unique indexes on `discord_id` and `xivauth_id` enforce per-provider uniqueness while still allowing rows with only one ID set.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service health JSON |
| `/health` | GET | Liveness probe |
| `/auth/discord` | GET | Initiates Discord OAuth (requires `code_challenge`) |
| `/auth/callback` | GET | Discord redirect handler (exchanges code, mints JWT, redirects) |
| `/auth/callback` | POST | SPA token exchange (`{ code, code_verifier, ... }`) |
| `/auth/xivauth` | GET | Initiates XIVAuth OAuth |
| `/auth/xivauth/cb` | GET / POST | XIVAuth redirect handler |
| `/auth/refresh` | POST | Refresh JWT (24h grace window after expiry) |
| `/auth/revoke` | POST | Revoke a token (writes JTI to `TOKEN_BLACKLIST`) |

## Key Patterns

### PKCE Enforcement

`validateCodeChallenge` rejects anything not matching `/^[A-Za-z0-9\-_]{43,128}$/`; `validateCodeVerifier` rejects anything not matching `/^[A-Za-z0-9\-._~]{43,128}$/`. Only `S256` is accepted as `code_challenge_method`. The verifier is **only** ever sent in the POST body — never as a query parameter — so it can't leak through redirects, server logs, or browser history.

### State Parameter Signing

`signState(env.JWT_SECRET, payload)` produces `<base64url-json>.<hex-hmac>`; `verifyState` HMACs the JSON portion and compares to the signature, then checks `iat + STATE_EXPIRY_SECONDS (600) > now`. Without a valid signature the callback returns 400. The state carries the `redirect_uri`, `return_path`, and original `state` value supplied by the SPA.

### JWT Service

- HS256 via Web Crypto (`crypto.subtle.sign('HMAC', ...)`).
- Includes `sub`, `iat`, `exp`, `iss`, `username`, `global_name`, `avatar`, and a per-token `jti` for revocation.
- `verifyJWT` rejects non-HS256 algorithms, validates signature, and checks `exp`.
- `verifyJWTWithRevocationCheck` additionally queries `TOKEN_BLACKLIST` for the `jti`.
- `revokeToken` writes the `jti` with TTL = remaining lifetime so it auto-expires.

### Refresh Grace Window

`POST /auth/refresh` accepts tokens that are expired by up to **24 hours** so a user with a stale tab can re-acquire a fresh token without re-running the OAuth flow. Tokens expired beyond 24 hours are rejected.

### Redirect URI Validation

`validateRedirectUri(uri, ALLOWED_REDIRECT_ORIGINS)` parses the URL and compares the origin against an allowlist (constants/oauth.ts). Anything that doesn't parse, doesn't match, or fails origin equality is rejected — prevents open redirect attacks.

### Rate Limiting

`/auth/*` is rate-limited per IP. Two backends:
- **In-memory** (default): per-isolate Map, lost when the isolate cycles.
- **Durable Object** (opt-in via `USE_DO_RATE_LIMITING = "true"` + `RATE_LIMITER` binding): persistent and globally consistent.

Both emit `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. 429 responses include `Retry-After`.

### CORS

Allows `FRONTEND_URL` always; in `ENVIRONMENT === 'development'` only, also allows `localhost`/`127.0.0.1` on whitelisted ports `3000`, `5173`, `8787`. Requests without an `Origin` header (curl/Postman) are denied — server-to-server callers must use the relevant API endpoints rather than OAuth.

### Body Hardening

- `bodySizeLimit` (10KB — OAuth payloads are small).
- `jsonDepthLimit` on mutations.

## Security Patterns

### PKCE Validation

All OAuth flows enforce PKCE; the `code_verifier` is only sent via POST body and never logged.

### Algorithm Confusion Prevention

`verifyJWT` explicitly rejects any algorithm other than HS256 — prevents `alg: none` and RS-vs-HS swap attacks.

### Request Timeouts

External APIs are bounded:
- Token exchange: `REQUEST_TIMEOUT_MS = 10s`.
- User info / character fetch: `USER_INFO_TIMEOUT_MS = 5s`.

Prevents the worker from hanging on a slow Discord/XIVAuth response.

### Scope Validation

`validateScopes(actual, required)` rejects tokens missing required scopes:
- Discord: `identify`.
- XIVAuth: `user`, `character` (also requests `user:social` and `refresh` non-required).

### Token Revocation

JWT revocation is enforced on `/auth/me` and during refresh by checking `TOKEN_BLACKLIST` for the `jti`. TTL on the blacklist key matches the token's remaining lifetime so storage stays bounded.

### Generic Error Responses

`app.onError()` returns `Internal Server Error` in production; only dev mode includes `err.message`. Stack traces never leave the worker.

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/types` | Shared interfaces (JWTPayload, AuthProvider, XIVAuthUser, etc.) |
| `@xivdyetools/crypto` | Base64URL helpers |
| `@xivdyetools/rate-limiter` | Backend-agnostic rate limiter primitives |
| `@xivdyetools/logger` | Structured logging |
| `@xivdyetools/worker-middleware` | Shared Hono middleware (request ID, logger) |
| `miniflare` (dev) | Local DO + KV emulation for tests |

## Testing

Vitest with tests under `src/__tests__/` (separate from source files) plus `mocks/cloudflare-test.ts` for KV/D1/DO emulation.

```bash
npm run test                                          # Full suite
npx vitest run src/__tests__/jwt-service.test.ts      # Single file
npx vitest run -t "PKCE"                              # Pattern match
```

## Related Projects

**Dependencies:** `@xivdyetools/types`, `@xivdyetools/crypto`, `@xivdyetools/rate-limiter`, `@xivdyetools/logger`, `@xivdyetools/worker-middleware`

**Shares `JWT_SECRET` with:** `xivdyetools-presets-api` (which verifies these JWTs on web auth)

**Frontend client:** `xivdyetools-web-app` (initiates the PKCE flow, stores the JWT)

## Deployment Checklist

1. `wrangler secret put` for `DISCORD_CLIENT_SECRET` and `JWT_SECRET` (and `XIVAUTH_CLIENT_SECRET` if using XIVAuth confidential mode).
2. Confirm `JWT_SECRET` matches the value in `xivdyetools-presets-api` — otherwise web auth will fail across the API.
3. Verify `wrangler.toml` has correct `FRONTEND_URL` and `WORKER_URL` for the target env.
4. Apply schema if needed: `wrangler d1 execute xivdyetools-users --remote --file=./schema/users.sql`.
5. `npm run lint && npm run test -- --run && npm run type-check`.
6. `npm run deploy:production`.
7. Smoke-test the full flow from the web app: `/auth/discord` → consent → callback → `/auth/me` returns user info with the issued JWT.
8. If switching to DO rate limiting, set `USE_DO_RATE_LIMITING = "true"` and bind `RATE_LIMITER` (already present in wrangler.toml under `env.preview`).
