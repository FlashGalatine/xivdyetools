# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2026-08-30

Security audit remediation (docs/audits/2026-08-29-security, Sprint 2: FINDING-001 / 002 / 003 / 010 / 012 / 013 / 022 / 023). **Major bump:** `/auth/refresh` removed; `orig_iat`, `xivauth_id` and `primary_character` are no longer minted; `users.avatar_url` and the `xivauth_characters` table are dropped by a hand-run migration — no known client used any of them.

### Removed

- **`POST /auth/refresh` is gone; the route now 404s (FINDING-003).** It accepted a token on signature alone for `REFRESH_GRACE_SECONDS` past `exp` and minted the replacement from the **old token's claims** rather than the user row, with `orig_iat` capping the chain at 30 days and only the presented `jti` ever blacklisted. So whoever held a copied token could re-mint it every hour for up to a month, and the victim's `/auth/revoke` — which blacklists only the `jti` the victim holds — never touched the attacker's chain. There is no per-user revocation epoch and no reuse detection to catch it. **No client ever called the endpoint**: `grep -rn 'auth/refresh' apps/*/src` found callers only inside oauth itself, and the web app re-runs the PKCE sign-in flow instead of refreshing — so removing it costs nothing and closes the whole chain. A session now ends at `exp` (1 h, `JWT_EXPIRY`). `src/handlers/refresh.ts` is renamed `src/handlers/token.ts`, which keeps `GET /auth/me` and `POST /auth/revoke` unchanged. The `REFRESH_GRACE_SECONDS` blacklist-TTL grace in `revokeToken` **stays exactly as it is** (FINDING-001, 2026-08-21) — with no refresh endpoint it is simply a clock-skew margin on the revocation entry.

- **The `xivauth_characters` table and every write to it (FINDING-001).** Each XIVAuth sign-in deleted and re-inserted the caller's entire FFXIV roster — Lodestone id, character name and home world, **unverified registrations included** — into `xivauth_characters` "for future features". Those features never arrived: `git ls-files 'apps/*/src/*.ts' 'packages/*/src/*.ts' | xargs grep -n 'getCharacters\|xivauth_characters'` found the store call, the definition and a test mock, and nothing else — no reader, no TTL, no purge, and no mention of a character roster in `apps/web-app/PRIVACY.md`, so users were never told. `storeCharacters` / `getCharacters` and the `XIVAuthCharacter` plumbing they alone used are deleted. The handler still reads the roster in memory to pick the verified character whose name becomes `username` / `global_name` (FINDING-013) and discards the rest, so login behaviour is unchanged for users with and without a verified character. If a future feature needs the roster, collect it then, minimally, and disclose it first.
- **The `users.avatar_url` column and every write to it (FINDING-002).** Written on every Discord sign-in (`null` on the XIVAuth path) and never read back: `POST /auth/callback`, `GET /auth/me` and the web app all recompute the CDN URL from the Discord id and the `avatar` hash via `getAvatarUrl`. Responses are byte-identical; only the stored copy is gone. `CreateUserParams`, the `INSERT`/`UPDATE` statements, `UserRow` and both handler call sites drop it.
- **Schema + migration.** `schema/users.sql` now builds `users` alone, without `avatar_url`, so a fresh database matches the code. An existing database is brought into line by the new `migrations/0001_drop_xivauth_characters.sql` (`DROP TABLE IF EXISTS xivauth_characters` + `ALTER TABLE users DROP COLUMN avatar_url`). It is **hand-run, and only AFTER this release is deployed** — running it first would 500 every sign-in on the missing column. From `apps/oauth`: `wrangler d1 execute xivdyetools-users --remote --file=migrations/0001_drop_xivauth_characters.sql`, with `SELECT COUNT(*) FROM xivauth_characters` before and `PRAGMA table_info(users)` after; the file's header carries the commands and the verified SQLite `DROP COLUMN` preconditions (no index, view, trigger, CHECK or FK names the column). Use `d1 execute --file=`, **not** `d1 migrations apply` — this database keeps no `d1_migrations` table and the `ALTER` is not idempotent. No `BEGIN TRANSACTION` (D1 rejects it).

### Changed

- **The JWT carries only the claims consumers read (FINDING-002).** `createJWTForUser` no longer mints `orig_iat`, `xivauth_id` or `primary_character`; issued tokens are exactly `sub`, `iat`, `exp`, `iss`, `jti`, `username`, `global_name`, `avatar`, `auth_provider`, `discord_id`. Nothing breaks: `orig_iat` anchored the refresh chain and lost its only reader when `POST /auth/refresh` went (FINDING-003, same release); `xivauth_id` never had a consumer (the `users.xivauth_id` **column** stays — it is the XIVAuth lookup key); `primary_character` carried an FFXIV character name, home world and verified flag — *including an unverified registration, which the web sign-in copy explicitly denies collecting* — which the web app copies into `AuthUser` and never renders, while presets-api reads only `sub` / `discord_id` / `username` / `global_name`. All three are declared optional in `@xivdyetools/types`, so no package changes and no type break. `primary_character` is dropped from the `POST /auth/xivauth/callback` **response body** for the same reason. A verified character's name still reaches consumers as `username` / `global_name` — that is the display identity and the only part of the roster that leaves the worker.

### Fixed

- **`GET /auth/me`'s `avatar_url` was built from the internal user UUID instead of the Discord snowflake, so it never resolved.** `getAvatarUrl(userId, avatarHash)` builds `https://cdn.discordapp.com/avatars/<userId>/<hash>.<ext>`, which needs the Discord snowflake — `callback.ts`'s Discord path correctly passes `discordUser.id` — but `token.ts`'s `/auth/me` handler passed `payload.sub`, which `createJWTForUser` mints as the internal `users.id` UUID (`services/jwt-service.ts`), never a Discord id. Every existing test fixture set the mock user's internal `id` equal to its Discord id, which made the two indistinguishable and hid the bug. Now uses `payload.discord_id`, falling back to a `null` avatar_url (rather than building a URL around `undefined`) when it is absent — an XIVAuth-only account with no linked Discord identity.

### Security

- **`Cache-Control: no-store` and `Pragma: no-cache` on every response the app dispatches — CORS preflight 204s excluded (FINDING-022).** The security-headers middleware set only `X-Content-Type-Options`, `X-Frame-Options` and HSTS, so the token bodies from `POST /auth/callback` and `POST /auth/xivauth/callback` went out cacheable — which RFC 6749 §5.1 forbids for a bearer token — as did `GET /auth/me` and the callback bounces carrying an authorization code. Nothing caches in the path today (Workers origin, bearer flow, `fetch` from the SPA), so this is hygiene against a future CDN rule or a browser heuristic on a 200 JSON body. Applied worker-wide rather than to `/auth/*` only: the health routes have nothing worth caching either. CORS and the other headers are untouched. (Docs corrected in this release: Hono's `cors()` answers an OPTIONS preflight with its own 204 before this middleware — registered after `cors()` — ever runs, so a preflight response never carries these headers; `docs/projects/oauth/endpoints.md` and `CLAUDE.md` previously claimed "every response" without that exception.)

- **The request logger no longer collects the User-Agent header (FINDING-010).** `loggerMiddleware({ serviceName: 'xivdyetools-oauth', logUserAgent: true })` put every caller's User-Agent into the "Request started" log context on every request; worker-kit's own default is `false` and nothing here ever consumed the value. The web privacy guide promises the server "discards everything about the request" — this field was the one exception. `logUserAgent` is no longer set, so the worker-kit default applies.

- **A native rate-limit binding failing over to fail-open is now logged (FINDING-012).** `CloudflareRateLimiter` (backing `/auth/*`) is constructed once per isolate in `services/rate-limit.ts`, without a logger, so a throwing `RL_AUTH_*` binding allowed the request through — the accepted trade-off — with no signal anywhere that it had happened. `checkRateLimit()`'s result now carries the underlying limiter's `backendError` flag; the `/auth/*` middleware in `index.ts` checks it per request — the limiter is a per-isolate singleton and cannot hold a request-scoped logger, so the check happens at the call site instead — and logs `logger.warn('Rate limiter backend error — request allowed (fail-open)', { path })` through the request logger: no client-visible header, and no key or IP in the log context, only which endpoint saw the error.

- **Production startup validation now requires the security bindings the 2026-08-21 fixes depend on, and fails every request — not just logs — when one is missing (FINDING-013).** `validateEnv()` never checked for `RL_AUTH_10` / `RL_AUTH_20` / `RL_AUTH_30` or `TOKEN_BLACKLIST` in production, so a config edit or a dashboard change that silently dropped one degraded to the KV or in-memory rate-limit fallback, or no revocation check on `/auth/me`, with no error and no log anywhere. Production now additionally requires all four bindings to be present, using the same `Missing required env var in production: X` shape the file already uses. The env-validation middleware already failed every request in production when validation failed — not just the first one in the isolate (the BUG-017 pattern) — confirmed, not changed, by this release.

- **A wrangler-config invariant test now pins the shapes a deploy-time config drift could quietly break (FINDING-023).** `src/__tests__/wrangler-config.test.ts` (new, modelled on `apps/presets-api/tests/wrangler-config.test.ts`) asserts the top-level worker stays `xivdyetools-oauth` with `ENVIRONMENT = "production"` and routes to `auth.xivdyetools.app`, exactly one `[env.development]` block exists and no `[env.preview]` / `[env.production]` (this worker's top level **is** production — a second production-shaped env is the invariant, not the label), the three `RL_AUTH_10/20/30` `[[ratelimits]]` tiers and their `[env.development.ratelimits]` counterparts are present with distinct dev namespace ids, the dev and production `TOKEN_BLACKLIST` KV ids actually match presets-api's (not just each other — the same pair presets-api's own test pins from its side), and `[env.development]`'s D1 `database_id` is not the production one. None of this was guarded before; a binding silently pointed at the wrong namespace is exactly the drift FINDING-013's fail-closed `validateEnv` cannot catch on its own, since a wrong-but-present binding still passes a truthy check.

### Deploy notes

- **Run `migrations/0001_drop_xivauth_characters.sql` by hand, and only AFTER this release is deployed.** Bare `wrangler deploy` **is** the production deploy on this worker (no `--env production` — see `CLAUDE.md`); running the migration before the deploy 500s every sign-in on the missing column/table. From `apps/oauth`: `wrangler d1 execute xivdyetools-users --remote --file=migrations/0001_drop_xivauth_characters.sql`, with `SELECT COUNT(*) FROM xivauth_characters` / `PRAGMA table_info(users)` before and after — the file's header also now carries a **live** precondition check (`PRAGMA index_list(users)`, `SELECT sql FROM sqlite_master WHERE tbl_name = 'users'`) to catch an ad-hoc index or constraint on `avatar_url` that the checked-in schema wouldn't show, before the `ALTER` runs. Use `d1 execute --file=`, **not** `d1 migrations apply` — this database keeps no `d1_migrations` bookkeeping table and the `ALTER` is not idempotent.

## [2.7.0] - 2026-08-21

Security audit remediation (docs/audits/2026-08-21-security — FINDING-001, FINDING-003, FINDING-012, FINDING-013, FINDING-029). Minor bump: behaviour changes on `/auth/refresh`, on authorize/callback validation and on XIVAuth account linking; no contract break for the web app.

### Security

- **`/auth/refresh` grace window reduced from 24 h to the shared `REFRESH_GRACE_SECONDS` (15 min) from `@xivdyetools/auth` 1.4.0**, and `/auth/revoke` / rotation-revoke blacklist entries now outlive `exp` by that same window. Before this, a blacklist entry expired exactly at `exp` while the refresh endpoint still accepted the token for another 24 h — so a token the user had revoked at logout (or a leaked one) became refreshable the moment it expired and could be re-minted for up to the 30-day session cap with no way for the victim to stop it. Regression tests: revoke → expire → refresh must 401; refresh → expire → refresh-again must 401.
- **`/auth/*` rate limiting now prefers the native Workers Rate Limiting bindings `RL_AUTH_10` / `RL_AUTH_20` / `RL_AUTH_30`** (one per `OAUTH_LIMITS` value, keyed per IP + path) via `CloudflareRateLimiter` from `@xivdyetools/worker-kit` 1.1.0 (FINDING-003). The KV-backed limiter could not throttle a fast client (KV 1 write/s/key, swallowed put failures, fail-open), which is exactly the brute-force pattern these limits exist for. `checkRateLimit(ip, path, backends?)` takes `{ cloudflare?, kv? }`; KV (`TOKEN_BLACKLIST`, `rl:` prefix) and per-isolate memory remain as fallbacks. Bindings need no resource creation (`namespace_id` 1021-1023 prod, 1024-1026 development; the 1027-1029 preview tier went with `[env.preview]`, see FINDING-029 below).
- **OAuth flow hardening (FINDING-012, OAUTH-4 / OAUTH-5).** `redirect_uri` is now matched on origin **and** exact path (`REDIRECT_CALLBACK_PATH = '/auth/callback'`, no query string, no fragment) at authorize time and again at the GET callback — origin-only matching let any attacker-chosen path on an allowlisted origin receive the `?code=` bounce (RFC 8252 §8.4 / OAuth 2.1 want an exact match). `return_path` (at most 256 chars, single leading `/`, visible ASCII, no backslash) and the SPA's `state` (at most 256 visible-ASCII chars) are bounded server-side before they enter the signed state (`400 Invalid return_path` / `400 Invalid state`). The GET callbacks now echo the worker-signed `state` in the bounce to the SPA, and both POST callbacks **require** it in the body (`400 Missing state` when absent, `null` or empty): it must verify (signature, expiry, provider matching the endpoint) and `S256(code_verifier)` must equal the signed `code_challenge` **before** the provider is called (`400 PKCE verification failed` / `400 Invalid state`), so PKCE no longer depends on Discord/XIVAuth enforcing it for a secret-bearing client (`utils/pkce-binding.ts`). The web app forwards `state` from the callback bounce into both POST bodies (same release), so the binding is always enforced — the POST body is now `{ code, code_verifier, state }`.
- **XIVAuth identity, account linking and logging (FINDING-013, OAUTH-7 / OAUTH-8 / OAUTH-9).** Only a `verified: true` character may become `username` / `global_name` (the preset author name downstream); an unverified registration is still carried as `primary_character` with `verified: false`, otherwise the opaque `XIVAuth User <id8>` label is used (XIVAuth exposes no account name). The Discord `external_id` XIVAuth asserts is ignored unless it is a well-formed snowflake. The silent account merge is gone: when the asserted Discord ID already belongs to another local account nothing is deleted and nothing is claimed (linking two existing local accounts needs an explicit, signed-in confirmation step, which does not exist yet — the event is audit-logged instead); an unowned Discord ID is still linked; an existing Discord link is never overwritten from an XIVAuth assertion; a stale `xivauth_id` is replaced by the XIVAuth account actually logging in. `findOrCreateUser()` takes an optional logger for these audit events. The XIVAuth POST handler now logs exclusively through the request-scoped structured logger and without identifiers (no XIVAuth id, linked Discord id, username, character name or response key lists); upstream error bodies are logged in `development` only, as the Discord path already did.
- **Preview environment deleted; fail-closed gates apply to every non-development environment (FINDING-029, OAUTH-6 / INF-6).** `[env.preview]` (`xivdyetools-oauth-preview` / `auth-preview.xivdyetools.app`) bound the PRODUCTION D1 + KV behind a stale `v4-ui-migration.xiv-colorexplorer.pages.dev` frontend origin and, with `ENVIRONMENT = "preview"`, sat outside every `=== 'production'` gate — one `wrangler deploy --env preview` away from a second token issuer on production data. The env-validation 500 (`Service misconfigured`), the HTTPS-only URL requirement and HSTS now key on `ENVIRONMENT !== 'development'`, and `validateEnv` rejects any `ENVIRONMENT` other than `development` / `production`. `[env.development]` stays; its D1 `database_id` is still the `TODO_RUN_WRANGLER_D1_CREATE` placeholder (create it with `wrangler d1 create xivdyetools-users-dev` or drop the block before any `--env development` deploy).

### Tests

- 62 new tests (258 → 320): redirect-URI path pin, `return_path` / `state` bounds and the new `oauth-validation.test.ts` unit suite; PKCE state binding on both POST callbacks (missing/null/empty state, mismatch, tampered/unsigned/expired/wrong-provider/non-string/oversized state, happy path — every POST-callback test now sends a valid bound state); XIVAuth verified-only display names, snowflake-validated Discord link, production log hygiene (no ids, no upstream bodies; dev-only bodies); `findOrCreateUser` no-merge / link / stale-`xivauth_id` / never-overwrite cases; env gates (`preview`-like env → 500, production HTTPS, HSTS). Coverage 91.8 → 94.7 % statements.

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
