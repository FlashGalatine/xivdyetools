# Manual security review — `apps/oauth` (xivdyetools-oauth 2.7.0)

- **Reviewer:** Claude Code (Fable 5), read-only, whole-monorepo audit 2026-08-29
- **Tree:** worktree `security-audit-2026-08-29` @ `4c213248` (= `main`)
- **Scope:** every non-test file under `apps/oauth/src`, `apps/oauth/wrangler.toml`, `schema/users.sql`,
  `package.json`; the `@xivdyetools/auth` / `@xivdyetools/worker-kit` primitives the worker executes
  (revocation, jwt, Cloudflare/KV limiters, ip, logger, request-id); for contract only: presets-api
  `middleware/auth.ts` + `wrangler.toml`, web-app `auth-service.ts` + `PRIVACY.md`, discord-worker
  `PRIVACY_POLICY.md`, installed `hono@4.13.4` cors dist, `deploy-oauth.yml`. Tests read to confirm guards.
- **Delta reviewed:** `git log b195723f..HEAD -- apps/oauth` = 6 commits (`4078c722` FINDING-001/002/015,
  `e90922f9` FINDING-003, `51ce8aab` + `c97a4192` FINDING-012/013/029, two Dependabot bumps touching
  `package.json` only). Every changed source file was read in full.
- **Deploy-unit facts confirmed:** no `[env.production]` — the top-level block IS production and a bare
  `wrangler deploy` (both `deploy` and `deploy:production` scripts, `package.json:10-11`) ships it to
  `auth.xivdyetools.app` + `auth.xivdyetools.projectgalatine.com` (`wrangler.toml:6-9,16`); D1
  `xivdyetools-users` `6e97b759…` (`:61-64`); KV `TOKEN_BLACKLIST` `0d6f3be3…` (`:52-54`) — the same
  namespace presets-api binds in `[env.production]`; native `[[ratelimits]]` `RL_AUTH_10/20/30`
  namespace ids 1021-1023 (`:25-38`). `[env.development]` D1 id is still the
  `TODO_RUN_WRANGLER_D1_CREATE` placeholder (`:73`), which makes that env un-deployable (wrangler
  rejects it) rather than silently prod-bound. Secrets only via `wrangler secret` (`:75`); `.dev.vars*`
  gitignored (`.gitignore:11-13`); nothing under `apps/oauth/migrations` (the merge-day identity
  backfill was a presets-api D1 operation — `users` schema untouched since the last audit).

Severity: CRITICAL | HIGH | MEDIUM | LOW | INFO. Exposure: INTERNET-UNAUTH | INTERNET-AUTH | INTERNAL | LOCAL.

---

## Route / command table + authz matrix

Middleware order (`src/index.ts`): `requestIdMiddleware` (:36) → `loggerMiddleware({logUserAgent:true})`
(:37-40) → env validation, fail-closed 500 outside `development` on every request (:51-73) → `cors`
(:80-130, function allowlist = `getAllowedRedirectOrigins(env)`, `credentials:true`, OPTIONS
short-circuits here) → security headers nosniff / XFO DENY / HSTS outside development (:134-145) →
`/auth/*` `bodyLimit` 10 KB (:148) → `/auth/*` JSON depth ≤ 10 + prototype-key reject on
POST/PATCH/PUT `application/json` (:151) → `/auth/*` per-IP+path rate limit, native bindings → KV →
memory (:158-188) → routers (:231-234).

| Method | Path | Auth / integrity | Rate limit (tier) | Body cap | CORS | Notes |
|---|---|---|---|---|---|---|
| GET | `/` | none | none | – | allowlist | echoes `ENVIRONMENT` label (:195-201) |
| GET | `/health` | none | none | – | allowlist | timestamp only |
| GET | `/auth/discord` | none; `code_challenge` (S256, 43-128 b64url), `redirect_uri` exact-origin + exact `/auth/callback` path, `return_path` ≤256 visible-ASCII `/`-rooted, `state` ≤256 visible-ASCII | 10/min `RL_AUTH_10` | – | allowlist | 302 to Discord with HMAC-signed 10-min state (`oauth-flow.ts:70-177`) |
| GET | `/auth/xivauth` | as above | 10/min `RL_AUTH_10` | – | allowlist | scopes `user user:social character refresh` (`xivauth.ts:47`) |
| GET | `/auth/callback` | signed state (HMAC-SHA256, constant-time, `exp` enforced; unsigned only in development), redirect re-validated against allowlist + path pin | 20/min `RL_AUTH_20` | – | allowlist | bounces `code`, `csrf`, `state`, `return_path` to the SPA (`oauth-flow.ts:188-244`); provider `error`/`error_description` reflected to `FRONTEND_URL/auth/callback?error=` |
| GET | `/auth/xivauth/callback` | as above (+ `provider=xivauth` marker) | 20/min `RL_AUTH_20` | – | allowlist | same pipeline |
| POST | `/auth/callback` | `code` + RFC 7636 `code_verifier` + **required** signed `state`; `S256(verifier) == state.code_challenge`, `state.provider == 'discord'` **before** Discord is called (`callback.ts:95-114`) | 20/min `RL_AUTH_20` | 10 KB + depth | allowlist | server-side token exchange with pinned `redirect_uri` (`:119,146`), `identify` scope required (`:174`); returns JWT + user (`:237-249`) |
| POST | `/auth/xivauth/callback` | as above with `provider == 'xivauth'` (`xivauth.ts:125-144`) | 20/min `RL_AUTH_20` | 10 KB + depth | allowlist | `user`+`character` scopes required (`:207`); persists user + full character roster (`:333-355`) |
| POST | `/auth/refresh` | JWT in body: signature; `exp` or `exp + 15 min` grace; `jti` not revoked; user row exists; `orig_iat` ≤ 30 d (`refresh.ts:70-153`) | 30/min `RL_AUTH_30` | 10 KB + depth | allowlist | mints new `jti`, best-effort revokes old (`:176-182`); **no client calls it** |
| GET | `/auth/me` | `Authorization: Bearer` — signature + `exp` + revocation (`refresh.ts:226-230`) | 30/min default `RL_AUTH_30` | – | allowlist | returns `sub`, `username`, `global_name`, `avatar`, `avatar_url` |
| POST | `/auth/revoke` | `Authorization: Bearer` — signature only (expired tokens accepted by design) (`refresh.ts:282`) | 30/min default `RL_AUTH_30` | 10 KB + depth | allowlist | blacklists `jti` for `exp + 15 min` (`:296-300`) |
| * | unmatched | – | `/auth/*` only | – | allowlist | 404 JSON echoes method + path (`index.ts:241-249`) |

Allowlisted origins in production (`constants/oauth.ts:10-22,40-48`): `https://xivdyetools.app`,
`https://beta.xivdyetools.app`, `https://xivdyetools.projectgalatine.com`, `FRONTEND_URL`; localhost
entries stripped outside development. No cookies are set or read anywhere — auth is bearer-only.

### Previous-audit fixes touching this unit — verification

| Fix | Real? (file:line) | Guarding test | Regressed? |
|---|---|---|---|
| FINDING-001 blacklist TTL ≥ exp + grace, refresh grace = shared constant | `packages/auth/src/revocation.ts:25` (`REFRESH_GRACE_SECONDS = 900`), `:91` (`ttl = max(exp + grace − now, 60)`); `refresh.ts:96-106` uses the shared constant; rotation revoke `:180-182`; `/auth/revoke` `:296-300` | `refresh.test.ts:143-161` (past exp+grace → 401), `:478-501` (revoke → expire → refresh 401), `:503-528` (refresh → expire → refresh-again 401) | No. Residual: recommendation #3 (remove or rotate-with-reuse-detection) not done → **OAUTH-04** |
| FINDING-002 blacklist consulted by presets-api; namespaces match per env | presets-api `middleware/auth.ts:101-104`; oauth prod KV `0d6f3be3…` (`wrangler.toml:52-54`) = presets-api `[env.production]` `0d6f3be3…` (`apps/presets-api/wrangler.toml:98-100`); oauth dev `891bbbe8…` (`:56-59`) = presets-api top-level/dev `891bbbe8…` (`:41-43`); `JWT_ISSUER = https://auth.xivdyetools.app` in presets-api prod (`:64`) = oauth `WORKER_URL` (`wrangler.toml:20`) | presets-api `tests/middleware/auth.test.ts:1087-1115` | No |
| FINDING-003 native rate-limit bindings | `wrangler.toml:25-38` (top-level = prod), `rate-limit.ts:67-75,92-101` (bindings → KV → memory) | `rate-limit-binding.test.ts:49-101`; live bindings verified via API 2026-08-29 (`POST_MERGE_CHECKLIST.md:84-91`) | No. Fail-open + optional-binding shape → **OAUTH-05**; no toml invariant test → **OAUTH-07** |
| FINDING-012 exact redirect path, bounded params, PKCE binding mandatory (`400 Missing state`) | `oauth-validation.ts:67-94,108-129`; `pkce-binding.ts:49-82`; `callback.ts:95-114`; `xivauth.ts:125-144` (`c97a4192` made state required on both POSTs) | `authorize.test.ts:247-375`; `callback.test.ts:338-540` (`:518` missing/null/empty → 400); `xivauth.test.ts:978-1055` (`:1018`, `:1036` cross-provider) | No |
| FINDING-013 verified-only display name, snowflake-checked link, no silent merge, identifier-free logs | `xivauth.ts:303-313,320-323`; `user-service.ts:145-188`; logs `xivauth.ts:176-183,196-202,267-271,286-298,325-329` are status/booleans/counts only | `xivauth.test.ts:1057-1136,1138-1215`; `user-service.test.ts:292-407` | No |
| FINDING-015 `iss` claim, typed claims | `jwt-service.ts:123`, `refresh.ts:164` (`iss = WORKER_URL`); `packages/auth/src/jwt.ts:190-196,261-263` | `jwt-service.test.ts:159-163` | No (oauth's own verifiers do not pin `iss` — single issuer, INFO, not filed) |
| FINDING-029 `[env.preview]` deleted, env allowlist, gates on `!== 'development'` | `wrangler.toml:40-46` (gone); `env-validation.ts:20,63-71`; `index.ts:51-73,142-144`; dev D1 placeholder `:73` un-deployable | `env-validation.test.ts:127-152`; `index.test.ts:338-380` | No (config-level invariants untested → **OAUTH-07**) |

---

## Candidates

### OAUTH-01 — `xivauth_characters`: every XIVAuth login persists the user's full FFXIV character roster (names, home worlds, Lodestone ids) that nothing ever reads and no policy discloses

- **Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Rotation:** none · CWE-359 (data minimisation), CWE-212
- **Where:**
  - `apps/oauth/src/handlers/xivauth.ts:273-298` — fetches `/api/v1/characters`; `:345-355`:
    ```ts
    // Store characters if present (for future features)
    if (characters.length > 0) {
      const characterData = characters.map((ch) => ({ id: ch.lodestone_id, name: ch.name, home_world: ch.home_world, verified: ch.verified }));
      await storeCharacters(c.env.DB, user.id, characterData);
    }
    ```
  - `apps/oauth/src/services/user-service.ts:259-278` (`DELETE` + `INSERT … xivauth_characters (user_id, lodestone_id, name, server, verified)`); `:283-298` `getCharacters` — **zero callers** in non-test code (`git ls-files apps/oauth/src | grep -v __tests__ | xargs grep getCharacters` → definition only). No other worker binds `xivdyetools-users`.
  - `apps/oauth/schema/users.sql:25-33` — table has no TTL; rows die only via `ON DELETE CASCADE` from `users`, and no deletion path exists (see OAUTH-02).
  - Governing promise: `apps/web-app/PRIVACY.md:6-9` ("the sections below are the complete list"), `:42-46` (sign-in stores "the account identity you sign in with" — nothing about characters), `:78-80` ("character or world names" listed under *never collected*, analytics section). `apps/oauth/CLAUDE.md:9,93,156` describes the table but not a purpose.
- **Trigger:** any successful XIVAuth login with ≥1 registered character (verified **or unverified**).
- **Impact:** personal data (character identity ↔ Discord/XIVAuth account linkage, incl. unverified characters the user may not own) accumulates in production D1 with no purpose, no reader, no retention limit and no disclosure. The upstream body is also stored without shape validation (`characters = await charactersResponse.json()` `:285`, unbounded `name`/`server` strings).
- **Fix:** delete the fetch-and-store path (`storeCharacters`, `getCharacters`, the table) — the JWT already carries the one `primary_character` derived in-memory; or, if a feature is imminent, store only the verified primary character, validate the upstream shape, document purpose + retention in `PRIVACY.md`, and add a purge for existing rows.

### OAUTH-02 — Identity store not disclosed: a `users` row (Discord id / XIVAuth id / display name / avatar URL / timestamps) is written on every sign-in, `avatar_url` is write-only, and there is no deletion path

- **Severity:** MEDIUM (by the audit's PII rule: persisted fields not listed in the governing policy) · **Exposure:** INTERNET-AUTH · **Rotation:** none · CWE-359
- **Where:**
  - `apps/oauth/src/handlers/callback.ts:222-228` and `xivauth.ts:333-343` → `user-service.ts:79-85` (INSERT) / `:213-216` (`avatar_url = ?` on every login). `users.avatar_url` has **no reader**: every response recomputes it from the live Discord hash (`callback.ts:245`, `refresh.ts:239`) and `createJWTForUser` takes `avatar` from `options`, not the row (`jwt-service.ts:133`).
  - `apps/web-app/PRIVACY.md:42-46` — the only sign-in sentence: identity "is stored with the presets and votes you submit". The row is created on login even when nothing is ever submitted; retention is indefinite; `PRIVACY.md` has no deletion/retention section. `apps/discord-worker/PRIVACY_POLICY.md:114-138` offers data deletion for **bot** data only; no runbook or endpoint deletes an oauth `users` row (grep across `docs/`, `apps/*/README.md`, `apps/*/CLAUDE.md`: no hit).
- **Trigger:** any successful Discord or XIVAuth login.
- **Impact:** disclosure gap between the policy and the worker; one column stored with no purpose; a user cannot have their identity row (and, via cascade, OAUTH-01's roster) removed.
- **Fix:** add an "Account" paragraph to `PRIVACY.md` (what `auth.xivdyetools.app` stores, why — `sub` stability + account linking, retention, how to request deletion); stop writing `avatar_url` (drop the column or leave NULL); provide a deletion runbook (`DELETE FROM users WHERE id = ?`, cascade) or an authenticated `DELETE /auth/me`.

### OAUTH-03 — User-Agent logged on every request (`logUserAgent: true`) with no operational use and no policy disclosure

- **Severity:** MEDIUM (audit PII rule; practical risk LOW) · **Exposure:** INTERNET-UNAUTH · **Rotation:** none · CWE-532
- **Where:** `apps/oauth/src/index.ts:37-40`
  ```ts
  app.use('*', loggerMiddleware({ serviceName: 'xivdyetools-oauth', logUserAgent: true }));
  ```
  → `packages/worker-kit/src/middleware/logger.ts:141-145` puts `userAgent` into the "Request started" entry alongside request id, method and path. Nothing in the worker consumes it. `wrangler.toml` has no `[observability]` block, so persistence depends on the dashboard's Workers Logs setting (the 2026-08-29 checklist tails show logs are being read).
- **Governing promise:** `apps/web-app/PRIVACY.md:6-9` (complete-list clause) and `:78` (UA "never collected", analytics section); no server-log disclosure anywhere.
- **Trigger:** any request, including unauthenticated `/health` and every OAuth bounce.
- **Impact:** a fingerprinting datum joined to a per-request id in a log stream the policy does not mention. No token, code, verifier, query string or identifier is logged (positive, see controls 9-10), so this is the only per-request personal datum.
- **Fix:** `logUserAgent: false` (nothing reads it), or disclose "standard request logs (method, path, status, user agent) retained N days" in `PRIVACY.md`. Coordinator: the same opt-in may exist in other workers — dedupe against the worker-kit/api-worker reviews.

### OAUTH-04 — `/auth/refresh` remains a 30-day persistence primitive for a stolen token with no client using it (unremediated half of FINDING-001)

- **Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Rotation:** none (if a chain is suspected, `JWT_SECRET` rotation is the only kill switch) · CWE-613, CWE-384 · cross-link **FINDING-001** (residual, not regression)
- **Where:**
  - `apps/oauth/src/handlers/refresh.ts:27` (`MAX_SESSION_SECONDS = 30 d`), `:74-110` (expired-by-≤15-min tokens accepted), `:155-182` (new `jti` minted, old one revoked — so after the **attacker's** first refresh the victim's own token is the revoked one and the live chain is a `jti` the victim never sees; no reuse detection, no per-user cut-off, no `revoke-all`).
  - `:160-174` re-mints identity claims from the **old token** (`payload.username/global_name/avatar/discord_id/xivauth_id/primary_character`) rather than the DB row fetched at `:144` (used only for existence) — a token minted before a Discord link keeps a `discord_id`-less identity (presets-api then keys on `sub`, `apps/presets-api/src/middleware/auth.ts:51-72`).
  - Client usage: `git ls-files apps/web-app/src | xargs grep auth/refresh` → **0 hits**; the web app only calls `/auth/revoke` (`auth-service.ts:727`). FINDING-001's recommendation #3 ("remove `/auth/refresh` or implement rotation with reuse detection + per-user session generation") is not reflected in the FIXED status and is absent from `POST_MERGE_CHECKLIST.md` §5 residuals.
- **Trigger:** attacker holding any copy of a JWT (`localStorage` exposure, device compromise) POSTs it to `/auth/refresh` at least every 75 min (1 h `exp` + 15 min grace).
- **Impact:** a 1-hour credential becomes 30 days of presets-api + `/auth/me` access that the victim cannot terminate (their logout revokes only the token they hold).
- **Fix:** remove the route (or gate it behind an env flag defaulting off) until a client needs it. If kept: refresh only unexpired tokens (drop the grace path), reuse detection (`refresh:<jti>` → consumed; a second presentation revokes the chain), a per-user generation claim with `POST /auth/revoke-all`, and mint claims from the DB row.

### OAUTH-05 — Rate limiting is fail-open on binding error and unlogged; the security bindings are optional at runtime so a config regression silently degrades to the KV limiter and disables revocation

- **Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Rotation:** none · CWE-636 / CWE-778
- **Where:**
  - `packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:159-175` — on `binding.limit()` throwing, `config.failOpen !== false` (OAUTH_LIMITS never set it, `presets/configs.ts:19-33`) returns `allowed: true, backendError: true` and calls `this.logger?.warn(...)`; `apps/oauth/src/services/rate-limit.ts:95-98` constructs the limiter **without a logger**, so the warning is a no-op, and `index.ts:163-166` never inspects `backendError`. The accepted trade-off (`docs/architecture/security-trade-offs.md:125-129`) is conditioned on exactly that logging.
  - `apps/oauth/src/utils/env-validation.ts:36-120` validates `DB` but not `RL_AUTH_10/20/30` or `TOKEN_BLACKLIST` (`types.ts:71-77` all optional). Absent bindings → `oauthRateLimitTiers` returns `[]` (`rate-limit.ts:67-75`) → `KVRateLimiter` on `TOKEN_BLACKLIST` (`:102-107`), the backend FINDING-003 declared unable to throttle a fast client; absent `TOKEN_BLACKLIST` → memory limiter and every `if (payload.jti && c.env.TOKEN_BLACKLIST)` revocation check silently skipped (`refresh.ts:113,180,295`, `jwt-service.ts:224`).
- **Trigger:** a `wrangler.toml` edit or dashboard binding removal; or a runtime binding error during a brute-force burst.
- **Impact:** production keeps serving with the auth limiter and/or revocation disabled and no log line says so. Today all bindings are present (checklist §0, verified 2026-08-29), so this is latent.
- **Fix:** pass `getLogger(c)` into the limiters; log/emit `backendError`; set `failOpen: false` for the callback/refresh tiers; require the bindings in `validateEnv` outside `development`; add the toml invariant test from OAUTH-07.

### OAUTH-06 — Token-bearing responses lack `Cache-Control: no-store` / `Pragma: no-cache` (RFC 6749 §5.1)

- **Severity:** LOW · **Exposure:** INTERNET-AUTH · **Rotation:** none · previous INFO OAUTH-13, unchanged
- **Where:** `apps/oauth/src/index.ts:134-145` (header middleware sets only nosniff/XFO/HSTS); token bodies at `callback.ts:237-249`, `xivauth.ts:372-385`, `refresh.ts:184-188` (`/auth/refresh`) and `:232-241` (`/auth/me`, Authorization-bearing GET).
- **Trigger:** any token issuance / `/auth/me` call.
- **Impact:** spec-conformance only today — Worker responses on a custom domain are not edge-cached, POST responses are not browser-cached, and `/auth/me` has no validators for heuristic caching. Listed because the checklist row asks for it and the fix is one line.
- **Fix:** in the header middleware, for `/auth/*`: `c.header('Cache-Control', 'no-store'); c.header('Pragma', 'no-cache')`.

### OAUTH-07 — No config-level regression test for the FINDING-029 / FINDING-003 `wrangler.toml` invariants on a worker whose bare deploy is production

- **Severity:** LOW · **Exposure:** LOCAL (build/config) · **Rotation:** none
- **Where:** `apps/oauth/wrangler.toml:16,25-38,40-46,52-59,61-73`; tests live only under `src/__tests__` — the single `wrangler` hit is a comment (`env-validation.test.ts:126`). og-worker guards its toml (`apps/og-worker/tests/wrangler-env.test.ts`); oauth does not.
- **Trigger:** a future toml edit (re-adding a preview env, pasting the prod D1/KV id into `[env.development]`, dropping a `[[ratelimits]]` entry, changing top-level `ENVIRONMENT`).
- **Impact:** with OAUTH-05's optional bindings, such an edit deploys to production green.
- **Fix:** add a toml-parsing test asserting: no `[env.preview]`; top-level `ENVIRONMENT == "production"`; three `[[ratelimits]]` named `RL_AUTH_10/20/30`; `env.development` D1/KV ids ≠ top-level ids; `TOKEN_BLACKLIST` ids equal presets-api's per environment.

### OAUTH-08 — JWT carries claims no consumer reads (`xivauth_id`, unverified `primary_character`), and the token lives in web-app `localStorage`

- **Severity:** LOW · **Exposure:** INTERNET-AUTH · **Rotation:** none · CWE-359
- **Where:** `apps/oauth/src/services/jwt-service.ts:130-141` mints `username`, `global_name`, `avatar`, `discord_id`, `xivauth_id`, `primary_character`; `xivauth.ts:321,357-363` sets `primary_character` to `characters[0]` **even when unverified** (`verified:false`). Consumers: presets-api reads `sub/discord_id/username/global_name` only (`auth.ts:31-48,266-270`); web-app reads `username/global_name/avatar/discord_id/primary_character` (`auth-service.ts:305-325,469-488`) and stores the raw token in `localStorage` (`:459-464`, disclosed at `PRIVACY.md:26-30`). `xivauth_id`: **0 consumers** (web-app grep: none; presets-api type omits it).
- **Trigger:** any XIVAuth login; token theft exposes the claims (and the web app logs `primary_character.name @ server` at `auth-service.ts:493-496` — web-app reviewer's scope).
- **Impact:** personal data beyond need inside a bearer credential held in the most XSS-exposed store; an unverified character name (potentially someone else's) travels in the token.
- **Fix:** drop `xivauth_id`; include `primary_character` only when `verified === true` (or drop it — confirm whether any UI renders it); keep `discord_id`, `username`, `global_name`, `avatar`.

### OAUTH-09 — XIVAuth `refresh` scope requested, refresh token discarded (over-scoped consent)

- **Severity:** INFO · **Exposure:** INTERNET-AUTH
- **Where:** `apps/oauth/src/handlers/xivauth.ts:44-51` (`scopes: 'user user:social character refresh'`); `tokens.refresh_token` is only tested for presence in a debug log (`:196-202`) and never used or persisted. `user:social` **is** used (Discord link, `:303-313`).
- **Fix:** remove `refresh` from the scope string (consent screen then no longer asks for offline access the app cannot use).

### OAUTH-10 — CORS `credentials: true` is vestigial; Hono emits `Access-Control-Allow-Credentials: true` for every origin

- **Severity:** INFO · **Exposure:** INTERNET-UNAUTH · previous INFO OAUTH-15, unchanged
- **Where:** `apps/oauth/src/index.ts:128`; installed `hono@4.13.4` `dist/middleware/cors/index.js:43-45` sets the header unconditionally (before the origin check result matters). No cookies exist anywhere in the worker; harmless without an ACAO, but it advertises a credentialed API.
- **Fix:** delete `credentials: true`.

### OAUTH-11 — Unauthenticated, unbounded `error` / `error_description` reflected into the SPA redirect

- **Severity:** INFO · **Exposure:** INTERNET-UNAUTH
- **Where:** `apps/oauth/src/handlers/oauth-flow.ts:190-195` → `frontendErrorRedirect` (`:49-60`) appends the raw provider text to `FRONTEND_URL/auth/callback?error=`. Anyone can call `GET /auth/callback?error_description=<text>` (no state needed for this branch). The SPA only logs it and navigates (`auth-service.ts:243-250`) — no UI sink today; `FRONTEND_URL` is fixed, so no open redirect.
- **Fix:** map to the RFC 6749 §4.1.2.1 error-code enum, cap length, drop `error_description`.

---

## Positive controls (do not re-file)

1. **FINDING-001/002/003/012/013/015/029 are real, guarded and un-regressed** — see the verification table above; the two blacklist namespaces match presets-api per environment and presets-api pins `iss` to `https://auth.xivdyetools.app` in production.
2. **PKCE is now enforced server-side**: `verifyPkceStateBinding` (`pkce-binding.ts:49-82`) rejects non-string/empty/>4096-char state before HMAC, requires signature + `exp` + matching `provider`, then `S256(verifier) == code_challenge`; both POST callbacks return `400 Missing state` without it. The verifier only ever travels in the POST body.
3. **Redirect safety**: exact `URL.origin` match + exact `/auth/callback` path, no query/fragment (`oauth-validation.ts:67-94`), one allowlist for authorize, GET callback and CORS (`constants/oauth.ts:40-48`, `index.ts:101`), re-validated at callback time; loopback only in development; token-exchange `redirect_uri` pinned to `WORKER_URL` (`callback.ts:119`, `xivauth.ts:153`).
4. **Preflights no longer burn rate-limit budget**: `cors` is mounted (`index.ts:80`) before the `/auth/*` limiter (`:158`) and Hono 4.13.4 short-circuits OPTIONS with a 204 (`cors/index.js:49-78`).
5. **JWT hygiene**: HS256 pinned (`packages/auth/src/jwt.ts:147-149`), `exp`/`sub` required and type-checked (`:190-196`), constant-time `crypto.subtle.verify`, `jti` per token, `orig_iat` 30-day cap, user existence re-checked on refresh, secret ≥ 32 bytes at key import (`hmac.ts:96-98`) and ≥ 32 chars per request in production.
6. **Discord path is data-minimal**: `identify` scope only; `email`/`locale`/`mfa_enabled` on `DiscordUser` are never read (`callback.ts:222-235`).
7. **D1**: every statement `.prepare().bind()`; `updateUser` assembles constant column fragments only (`user-service.ts:193-224`); character replace is one atomic `db.batch`; UNIQUE races handled; schema CHECK + partial unique indexes.
8. **SSRF/timeouts**: four hard-coded HTTPS upstreams, `AbortSignal.timeout` 10 s / 5 s; scope validation on both providers; upstream access/refresh tokens never persisted or returned; client secrets only in server-side form bodies.
9. **Logging**: request logger records `pathname` only — `?code=`, `?state=`, `?csrf=` never reach logs (`worker-kit/middleware/logger.ts:71-83`); `X-Request-ID` UUID-validated (`request-id.ts:24,61-63`); XIVAuth handler logs statuses/booleans/counts; link events log `provider` only (`user-service.ts:163-176`); global error handler uses the sanitising structured logger (`index.ts:252-274`); no `console.log`, no Authorization/JWT/verifier/secret logged anywhere (grep of `git ls-files apps/oauth/src`).
10. **Env / secrets / deploy**: fail-closed env validation on every request outside development incl. HTTPS-only URLs, snowflake client id, `ENVIRONMENT ∈ {development, production}`; secrets never in `[vars]`; `.dev.vars*` gitignored; `deploy-oauth.yml` SHA-pinned actions, `permissions: contents: read`, `environment: production`, tests + type-check before deploy, no secret echoed.
11. **Body hardening**: 10 KB `bodyLimit` + JSON depth 10 + `__proto__`/`constructor`/`prototype` rejection on `/auth/*`; signed-state length bound before HMAC.
12. **Client IP** from `CF-Connecting-IP` only (`ip.ts:53-79`, XFF ignored), lower-cased; rate-limit keys `rl:<ip>:<path>|<window>` can never collide with `revoked:<jti>`.

## Rejected (checked, not filed)

- `GET /` echoes `ENVIRONMENT` (`index.ts:195-201`) — a public label ("production"), no secret or version.
- 404 body echoes method + path (`index.ts:241-249`) — JSON + nosniff, no reflection sink.
- `/auth/me` builds `avatar_url` from `sub` (a UUID) (`refresh.ts:239`) — wrong URL, not security (unchanged OAUTH-16).
- `console.error('Token refresh error:', err)` (`refresh.ts:190`) in production — D1/KV/signing errors carry no user identifiers or bound values.
- Double-encoded `return_path` (`/%255Cevil.com`) — `c.req.query()` decodes once and the worker rejects `\`; the SPA's `sanitizeReturnPath` (`auth-service.ts:113-152`) resolves against `window.location.origin` and rejects cross-origin; a literal `%5C` stays a same-origin path segment.
- Signed state replayable for 10 min / GET callback does not compare `state.provider` to `config.provider` (`oauth-flow.ts:188-244`) — the provider code is single-use and the POST binding checks provider + challenge (`pkce-binding.ts:72-79`); a cross-provider state fails there.
- Oversized `code` echoed into the bounce (`oauth-flow.ts:227`) — needs a signed state the caller minted for themselves; the resulting giant Location only hurts the caller.
- XIVAuth characters body not shape-validated (`xivauth.ts:285`) — trusted upstream; a malformed body yields a 500 through parameterised D1, no injection (folded into OAUTH-01's fix).
- Rate-limit key built from the request path — fixed `rl:` prefix, so it cannot address `revoked:` entries; long paths only reach the 404 handler.
- OPTIONS 204 lacks nosniff/XFO/HSTS — cors short-circuits before the header middleware; empty body, HSTS present on every other response.
- Env-validation 500 (`index.ts:69`) lacks the security headers — registered before the header middleware; body is a constant string.
- `JWT_SECRET` floor is 32 characters, not 32 bytes of entropy — unchanged INFO OAUTH-17; `hmac.ts:96` enforces ≥ 32 bytes.
- `bodyLimit` trusts `Content-Length` when present; `jsonDepthLimit` skipped for non-JSON content types — unchanged INFO OAUTH-14; 10 KB cap still applies.
- `frontendErrorRedirect` targets `FRONTEND_URL`, not the state's `redirect_uri` (`oauth-flow.ts:54`) — beta-initiated provider errors land on production's callback page; functional, not security.
- oauth's own verifiers (`/auth/me`, `/auth/refresh`, `/auth/revoke`) do not pin `iss` — a single issuer holds the secret (preview issuer deleted), presets-api pins it; INFO-grade, not filed.
- `index.ts:223` comment names `/auth/xivauth/cb` (route is `/callback`); `apps/oauth/CLAUDE.md:113-116,131,201-207` still documents a Durable Object limiter that no longer exists — stale docs, not security.
- Merge-day identity backfill — presets-api D1 only (`POST_MERGE_CHECKLIST.md:176-186`); oauth has no migrations and `schema/users.sql` is unchanged in the delta.

## Files covered

**apps/oauth** — `wrangler.toml`, `package.json`, `schema/users.sql`, `CHANGELOG.md` (2.7.0/2.6.0 entries), `README.md` (grep), `CLAUDE.md` (grep);
`src/index.ts`, `src/types.ts`, `src/constants/oauth.ts`, `src/handlers/authorize.ts`, `src/handlers/callback.ts`,
`src/handlers/oauth-flow.ts`, `src/handlers/refresh.ts`, `src/handlers/xivauth.ts`, `src/middleware/body-validation.ts`,
`src/services/jwt-service.ts`, `src/services/rate-limit.ts`, `src/services/user-service.ts`, `src/utils/env-validation.ts`,
`src/utils/oauth-validation.ts`, `src/utils/pkce-binding.ts`, `src/utils/state-signing.ts` (all in full);
tests (titles + guarding cases): `src/__tests__/{authorize,callback,xivauth,refresh,env-validation,index,rate-limit-binding,user-service,jwt-service}.test.ts`.

**packages** — `auth/src/revocation.ts`, `auth/src/jwt.ts` (full), `auth/src/hmac.ts` (key floor);
`worker-kit/src/rate-limiter/backends/cloudflare.ts`, `backends/kv.ts`, `rate-limiter/ip.ts`, `rate-limiter/presets/configs.ts`,
`rate-limiter/types.ts`, `middleware/logger.ts`, `middleware/request-id.ts` (full);
`types/src/auth/{jwt,response,xivauth,discord}.ts` (full).

**Contract / policy (outside unit, read-only)** — `apps/presets-api/src/middleware/auth.ts` (full), `apps/presets-api/wrangler.toml`
(KV + `JWT_ISSUER` lines), `apps/presets-api/tests/middleware/auth.test.ts` (revocation cases);
`apps/web-app/src/services/auth-service.ts` (storage, callback, sanitiser, logging sections), `apps/web-app/PRIVACY.md` (full),
`apps/discord-worker/PRIVACY_POLICY.md` (§1-4, §7 headings); `.github/workflows/deploy-oauth.yml` (full), `.gitignore` (wrangler lines);
`docs/architecture/security-trade-offs.md` (§1-2), `docs/operations/POST_MERGE_CHECKLIST.md` (§0 bindings, §3 KV row, §5);
`docs/audits/2026-08-21-security/evidence/review-oauth.md`, `findings/FINDING-001.md`, `findings/FINDING-003.md` (status sections);
`docs/audits/2026-08-29-security/evidence/{REVIEWER_BRIEF.md,delta-files-by-unit.txt,pii-sinks.txt,pii-sources.txt}` (oauth rows);
installed `hono@4.13.4` `dist/middleware/cors/index.js` (main checkout, read-only).
