# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.0] - 2026-08-16

Monorepo 2.0 release train (branch `monorepo-2.0-prep`). Nothing below has shipped until the branch merges. Minor bump: a new allowed origin plus a CORS behaviour fix; no contract break.

### Added

- `https://beta.xivdyetools.app` added to `ALLOWED_REDIRECT_ORIGINS` (`src/constants/oauth.ts`). The beta web app is a second Cloudflare Pages project serving non-main branches and deliberately uses this production OAuth worker so testers log in with real accounts. Until this ships, beta login fails with an opaque "Redirect URI is not whitelisted" error.

### Fixed

- **CORS and redirect URIs now use one allowlist.** The CORS origin callback previously reflected only `env.FRONTEND_URL`, while the redirect check used `getAllowedRedirectOrigins()` — so an origin could be trusted to *start* a login (302 to the provider, callback returned) and then be blocked from every XHR that *finishes* one (token exchange, `/auth/me`) with no `Access-Control-Allow-Origin`. beta.xivdyetools.app hit exactly that and sat showing its two login buttons. CORS now consults `getAllowedRedirectOrigins(env)` (which already folds in `FRONTEND_URL` and strips localhost outside development); production behaviour is otherwise unchanged. Same class as BUG-018, which had swept the three redirect lists but not CORS. Two regression tests, both verified to fail against the old code.
- `deploy:production` script could never succeed: this worker's `wrangler.toml` defines only `development` and `preview`, and the **top-level block is production** (`name = "xivdyetools-oauth"`, `auth.xivdyetools.app`), so `wrangler deploy --env production` hard-errors with "No environment found". The script is now an alias of the working bare `wrangler deploy` — the exact inverse of api-worker / presets-api, where the top-level block is the routeless `-dev` worker. Check the toml before assuming a convention.

### Changed

- Migrated from `@xivdyetools/worker-middleware` / `@xivdyetools/rate-limiter` / `@xivdyetools/crypto` to `@xivdyetools/worker-kit` (`/rate-limiter` subpath) and `@xivdyetools/auth/encoding` (Base64URL helpers) — Tier 1 package consolidation, no behaviour change. The deploy workflow's path filter now watches `packages/auth/**` and `packages/worker-kit/**` (auth itself was missing before).
- Dependencies: `hono` floor raised to `^4.12.34` (2026-08-09 security advisories); `wrangler` `^4.114.0 → ^4.120.0`; removed the unused direct `miniflare` devDependency (never imported by any test — it only pinned a second, vulnerable undici); `description` and `license: MIT` declared.
- Docs: `README.md` written (accuracy/licensing/attribution audit); `CLAUDE.md` corrected on the deploy command and synced to worker-kit / auth `/encoding`.

### Removed (2026-08-18 dead-code audit)

- **DEAD-019 (adopt)**: `services/jwt-service.ts`'s hand-rolled `getSigningKey` (private) is gone; `signJwtData`/`verifyJwtData` (still exported for `utils/state-signing.ts`) now delegate to `@xivdyetools/auth`'s `hmacSign`/`hmacVerify`. Verified byte-for-byte identical — a pinned vector (fixed secret + message, signature computed with the old implementation before deletion) is asserted unchanged in `__tests__/jwt-service.test.ts`. Safe because `JWT_SECRET` — this worker's only caller of these functions, shared with `signPayload`/`state-signing.ts` — is already enforced `>= 32` characters by `utils/env-validation.ts`, satisfying the minimum key length `hmacSign`/`hmacVerify` require internally.
- **`types.ts`'s dead `OAuthState` re-export** (DEAD-025): `@xivdyetools/types`' `OAuthState` was never actually this worker's OAuth-flow state shape — that's `StateData` in `utils/state-signing.ts`, with different fields — so the shared type was stale, not shared, and only ever reached this shim as a dead re-export. `PrimaryCharacter`/`JWTPayload` re-exports are untouched.

### Tests

- First tests for `getAllowedRedirectOrigins` (including development-only loopback filtering) and the two CORS-allowlist regression tests in `src/__tests__/index.test.ts` / `oauth-constants.test.ts`.
- Pinned-vector HMAC equivalence tests for `signJwtData`/`verifyJwtData` in `__tests__/jwt-service.test.ts` (DEAD-019 adoption proof).

## [2.5.0] - 2026-07-19

2026-07-18 audit remediation (Sprint 2).

### Fixed

- JWT issuance/refresh hardening: refresh rotation with `jti`-based revocation (KV-backed) and an `orig_iat` absolute session anchor so refresh chains cannot extend a session indefinitely.
- OAuth `state` signing and verification hardening; consolidated the dual JWT verifier paths flagged by the 2026-05-28 audit.
- Uses `@xivdyetools/auth` 1.2.0 primitives throughout (single verifier implementation).

## [2.4.1] - 2026-05-29

### Documentation

- **FINDING-006**: Added inline comment to the `[[d1_databases]]` binding in `wrangler.toml`'s dev environment documenting that `database_id = "TODO_RUN_WRANGLER_D1_CREATE"` is a placeholder — it must be replaced with a real D1 instance ID (created via `wrangler d1 create`) before `wrangler dev` can perform local D1 operations against the users database
- **FINDING-003**: Added JSDoc note to `verifyJWT()` in `src/services/jwt-service.ts` clarifying that this function validates signature and expiry but does **not** check the `TOKEN_BLACKLIST` KV store. Callers that need to honour token revocation must use `verifyJWTWithRevocationCheck()` instead — which is already used by `GET /auth/me` and `POST /auth/refresh`

---

## [2.4.0] - 2026-04-07

### Security

- **SEC-003**: Added `jsonDepthLimit` middleware (maxDepth 10, 10 KB body; prototype pollution keys rejected) on all `/auth/*` routes
- **SEC-004**: Added Hono `bodyLimit` middleware (10 KB) on all `/auth/*` routes
- **REFACTOR-004**: Added `isValidSnowflake` validation for `DISCORD_CLIENT_ID` in env-validation startup check

### Changed

- Migrated request-ID, logger, and rate-limit middleware to `@xivdyetools/worker-middleware`; deleted local middleware files
- **ARCH-001**: Removed `nodejs_compat` compatibility flag from `wrangler.toml`
- **BUG-001**: Re-enabled strict TypeScript checks; cleaned up unused variables and implicit returns
- **CORS**: Reduced preflight `maxAge` from 86400 s to 3600 s
- 11 new tests for JSON depth limiting and body size limits

---

## [2.3.10] - 2026-03-20

### Changed

- Lowered branch coverage threshold from 90% to 88% — uncovered branches are defensive paths (Durable Objects rate limiting, error handler logger fallback, legacy unsigned state) that require workerd runtime or are impractical to unit test

---

## [2.3.9] - 2026-03-18

### Security

- **BUG-013**: Removed `STATE_TRANSITION_PERIOD` feature flag — all OAuth states must now be HMAC-signed in production; unsigned states are only accepted in the development environment

---

## [2.3.8] - 2026-03-09

### Changed

- Updated `hono` from 4.12.3 to 4.12.5 (security: SSE injection, cookie injection, middleware bypass fixes)
- Updated `@cloudflare/workers-types` from 4.20260305.0 to 4.20260307.1
- Updated `@cloudflare/vitest-pool-workers` from 0.12.18 to 0.12.20 (fix: resource leak on pool shutdown)
- Updated `wrangler` from 4.69.0 to 4.71.0
- Updated `@types/node` from 25.3.3 to 25.3.5

## [2.3.7] - 2026-02-21

### Changed

- Fix type-check errors — add type assertions for `response.json()`, fix mock Env properties, fix `XIVAuthCharacter.server` → `home_world`, fix D1Meta cast
- Cast mock context through `unknown` to fix TS2352 type-check errors
- Handle `URLSearchParams` in mock fetch body assertions
- Resolve lint errors

## [2.3.6] - 2026-02-19

### Security

- **FINDING-007**: Startup env validation now blocks `STATE_TRANSITION_PERIOD=true` in production
  - If this legacy flag is enabled in production, the worker fails fast with a 500 error on the
    first request, preventing accidental weakening of OAuth state CSRF protection
- Added `STATE_TRANSITION_PERIOD` to `DEPRECATIONS.md` with target removal date of 2026-06-30

---

## [2.3.5] - 2026-01-26

### Security

- Added pre-commit hooks for security scanning (detect-secrets, trivy)
  - Scans for accidentally committed secrets before push
  - Vulnerability scanning for dependencies and container images

### Changed

- Added Dependabot configuration for automated dependency updates
  - Weekly npm dependency updates
  - Weekly GitHub Actions updates

---

## [2.3.4] - 2026-01-25

### Changed

- **REFACTOR-002**: Migrated in-memory rate limiting to `@xivdyetools/rate-limiter` shared package
  - Uses `MemoryRateLimiter` with `OAUTH_LIMITS` preset for endpoint protection
  - Endpoint-specific limits via path-based config lookup
  - Async interface for consistency with shared package
  - Durable Objects rate limiter remains unchanged

---

## [2.3.3] - 2026-01-25

### Changed

- **REFACTOR-001**: Migrated to `@xivdyetools/crypto` for Base64URL utilities
  - `base64UrlEncode`, `base64UrlDecode`, `base64UrlDecodeBytes` now imported from shared package
  - Reduces ~40 lines of duplicated code
  - Maintains backwards-compatible exports for dependent modules

---

## [2.3.2] - 2026-01-25

### Refactored

- **OAUTH-REF-003**: Deduplicated base64URL decode function (REFACTOR-001)
  - Exported `base64UrlDecode` from `jwt-service.ts`
  - Updated `state-signing.ts` to import from jwt-service instead of duplicating
  - Reduces code duplication and ensures single source of truth within oauth project

---

## [2.3.1] - 2026-01-25

### Security

- **FINDING-004**: Updated `hono` to ^4.11.4 to fix JWT algorithm confusion vulnerability (CVSS 8.2)
- **FINDING-005**: Updated `wrangler` to ^4.59.1 to fix OS command injection in `wrangler pages deploy`
- **FINDING-006**: Updated `devalue` transitive dependency to fix DoS vulnerability (CVSS 7.5)

---

## [2.3.0] - 2026-01-19

### Fixed

- **OAUTH-BUG-001**: Fixed potential call stack overflow in JWT service. Replaced string spread with `charCodeAt` (which could fail on large arrays) with `Array.from().map().join()` pattern for safer encoding

### Refactored

- **OAUTH-REF-002**: Consolidated OAuth validation utilities
  - Created `src/utils/oauth-validation.ts` with shared helpers
  - `validateCodeChallenge()` - RFC 7636 format validation
  - `validateRedirectUri()` - Origin allowlist validation
  - `ALLOWED_REDIRECT_ORIGINS` constant in `constants/oauth.ts`
  - Refactored both Discord and XIVAuth handlers to use shared utilities

---

## [2.2.2] - 2025-12-24

### Changed

- Updated `@xivdyetools/types` to ^1.1.1 for ecosystem consistency
- Updated `@xivdyetools/logger` to ^1.0.2 for ecosystem consistency

### Fixed

- Fixed type errors related to JWT payload requiring `auth_provider` field
- Fixed type errors related to XIVAuthCharacter using `home_world` instead of `server`
- Added missing JWT payload fields in token refresh (`discord_id`, `xivauth_id`, `primary_character`)

---

## [2.2.1] - 2025-12-24

### Fixed

#### Security Audit - High Priority Issues Resolved

- **OAUTH-HIGH-001**: Added timeouts to external Discord API calls
  - Token exchange request: 10 second timeout
  - User info fetch: 5 second timeout
  - Prevents worker hang if Discord API is slow or unresponsive

---

## [2.2.0] - 2025-12-24

### Fixed

#### Security Audit - Critical Issues Resolved

- **OAUTH-CRITICAL-001**: Separated base64 decoding from JSON parsing in OAuth state handling
  - Better error diagnostics: "Invalid state encoding" vs "Invalid state format"
  - Helps distinguish between corrupted state and malformed data
- **OAUTH-CRITICAL-002**: Fixed open redirect vulnerability in OAuth callback
  - Validates redirect_uri origin against allowed origins (FRONTEND_URL)
  - Blocks redirects to untrusted domains after successful authentication
  - Allows localhost origins only in development environment

---

## [2.1.0] - 2025-12-14

### Added

- **Structured Logging**: Added structured request logger middleware using `@xivdyetools/logger/worker`
- **Shared Package Integration**: Migrated to `@xivdyetools/types` and `@xivdyetools/logger` for ecosystem consistency
- **Test Utils Integration**: Migrated tests to use `@xivdyetools/test-utils` shared package

### Changed

- **JWT Utilities**: Extracted shared JWT utilities for better code organization (OAUTH-REF-002)

### Fixed

- **Security**: Added PKCE parameter format validation per RFC 7636
- **Security**: Added state expiration and scope validation
- **Security**: Added cross-cutting security improvements
- **CORS**: Restricted localhost CORS to specific ports (OAUTH-SEC-001)
- **Medium Severity**: Addressed MEDIUM severity audit findings
- **Tests**: Updated tests to use valid PKCE values per RFC 7636

### Deprecated

#### Type Re-exports
The following re-exports from `src/types.ts` are deprecated and will be removed in the next major version:

- **Auth Provider Types**: Import from `@xivdyetools/types` instead
- **JWT Types** (JWTPayload, OAuthState, etc.): Import from `@xivdyetools/types` instead
- **Discord Types** (DiscordTokenResponse, DiscordUser): Import from `@xivdyetools/types` instead
- **XIVAuth Types**: Import from `@xivdyetools/types` instead
- **Response Types** (AuthResponse, RefreshResponse, etc.): Import from `@xivdyetools/types` instead

**Note:** Project-specific types (Env, UserRow) remain unchanged.

**Migration Guide:**
```typescript
// Before (deprecated)
import { AuthProvider, JWTPayload, AuthResponse } from './types';

// After (recommended)
import type { AuthProvider, JWTPayload, AuthResponse } from '@xivdyetools/types';
```

---

## [2.0.1-beta] - 2025-12-13

### Fixed

#### XIVAuth Integration Bug Fixes
- **406 Not Acceptable Error**: Added required `Accept: application/json` header to XIVAuth API calls (Rails API requirement)
- **Response Format Mismatch**: Updated types and handler to match actual XIVAuth API response structure
  - XIVAuth user endpoint returns `social_identities[]` array, not `social.discord` object
  - XIVAuth user endpoint does NOT return `username` or `avatar_url` fields
  - `verified_characters` is a boolean, not an array
- **Separate Characters Fetch**: Characters must be fetched from `/api/v1/characters` endpoint (not included in user response)
- **D1 Database Error**: Fixed `undefined` values being passed to D1 by providing proper fallbacks
- **Username Handling**: Now uses primary character name as username, or `XIVAuth User {id}` as fallback
- **Field Mapping**: Properly map XIVAuth's `home_world` field to `server`

### Changed
- Updated `XIVAuthUser` type to match actual API response structure
- Added `XIVAuthSocialIdentity` type for the social identities array
- Added `XIVAuthCharacterRegistration` type for characters endpoint response
- Enhanced logging for debugging XIVAuth integration issues

## [2.0.0-beta] - 2025-12-13

### Added

#### XIVAuth OAuth Provider
- **XIVAuth Integration**: Second OAuth provider alongside Discord
- **GET /auth/xivauth**: Initiate XIVAuth OAuth flow with PKCE
- **GET /auth/xivauth/callback**: Handle XIVAuth redirect
- **POST /auth/xivauth/callback**: Exchange code for tokens with PKCE verification
- **Scopes Supported**: `user`, `user:social`, `character`, `refresh`
- **Character Info**: Primary FFXIV character included in JWT for XIVAuth users

#### D1 Database Integration
- **User Management**: Cloudflare D1 database for persistent user storage
- **User Service**: `findOrCreateUser()`, `findUserById()`, `storeCharacters()`
- **Account Merging**: Automatic account linking when Discord ID matches between providers
- **Schema**: `users` table (id, discord_id, xivauth_id, auth_provider, username, avatar_url)
- **Schema**: `xivauth_characters` table (lodestone_id, name, server, verified)

#### Multi-Provider JWT Support
- **createJWTForUser()**: New JWT creation function supporting both providers
- **Extended Payload**: `auth_provider`, `discord_id`, `xivauth_id`, `primary_character` claims
- **Provider Detection**: Automatic provider identification from token

### Changed

- **Discord Callback**: Updated to use D1 database and `createJWTForUser()`
- **Internal User IDs**: JWT `sub` claim now uses internal UUID instead of Discord ID
- **Optional Client Secret**: XIVAuth supports public client mode (PKCE-only)

### Technical Details

- **Cloudflare D1**: SQLite-compatible database at the edge
- **PKCE Security**: Required for both Discord and XIVAuth flows
- **Confidential Client**: Optional client secret for XIVAuth (recommended for server-side)

## [1.1.0] - 2025-12-07

### Added

#### Testing Infrastructure
- **Comprehensive Test Suite**: 82 tests covering all handlers and services
- **Vitest Configuration**: Testing framework with v8 coverage provider
- **96.6% Code Coverage**: Exceeds 90% target across all metrics
  - 100% coverage on jwt-service.ts, authorize.ts, callback.ts
  - 94%+ coverage on refresh.ts and index.ts
- **Test Scripts**: `npm test`, `npm run test:watch`, `npm run test:coverage`

### Changed
- Added test-related dependencies (vitest, @vitest/coverage-v8)
- Updated tsconfig.json to include @cloudflare/vitest-pool-workers types

## [1.0.0] - 2025-12-07

### Added

#### Authentication Flow
- **PKCE-Secured OAuth**: Proof Key for Code Exchange (PKCE) required for all OAuth flows
- **Discord OAuth Integration**: Full Discord OAuth2 authorization code flow
- **JWT Issuance**: JSON Web Tokens with HS256 signing for authenticated sessions

#### Endpoints
- `GET /auth/discord` - Initiate OAuth flow with PKCE challenge
- `GET /auth/callback` - Handle Discord redirect and token exchange
- `POST /auth/callback` - SPA token exchange (code + code_verifier)
- `POST /auth/refresh` - Refresh JWT within 24-hour grace period
- `GET /auth/me` - Get user info from JWT (Bearer token)
- `POST /auth/revoke` - Logout (client-side token clear)

#### Security
- **PKCE Enforcement**: All flows require code_challenge and code_verifier
- **JWT Claims**: Discord user ID (sub), username, global_name, avatar
- **Refresh Grace Period**: Expired tokens can be refreshed within 24 hours
- **CORS Configuration**: Localhost allowed for development, FRONTEND_URL for production

#### Infrastructure
- **Cloudflare Workers**: Edge deployment with global low-latency
- **Web Crypto API**: Native HS256 JWT signing without external dependencies
- **Hono Framework**: Lightweight routing and middleware
