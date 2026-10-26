# Security review: apps/oauth (2026-10-26, HEAD 13c386e5)

Reviewer key: `oauth`. Deploy unit: `oauth` (xivdyetools-oauth-worker 3.1.3). The top-level `wrangler.toml` block
is production (`name = "xivdyetools-oauth"`, route `auth.xivdyetools.app`, `ENVIRONMENT = "production"`,
wrangler.toml:1-23); there is no `[env.production]`, so a bare `wrangler deploy` is the production deploy.

Delta since the 2026-10-03 audit (base 0ab33466), from `git log 0ab33466..HEAD -- apps/oauth`: 3.1.2 (FINDING-006
retired origin + route removed, `[observability] enabled = false`), 3.1.3 (limiter keyed on the decoded path, non-object
JSON bodies 400, roster robustness, 415 gate), dependency bumps. No route, claim, schema or D1 change. The chara feature
does not touch this unit.

## 1. Routes and authz matrix

Middleware order (index.ts:36-244): requestId -> logger (pathname only, no query, no UA) -> CORS -> security headers
(wrap `next()`, so they land on 404/429/500 too) -> env validation (fail closed outside development) -> `/auth/*` rate
limit -> 10 KB body cap -> 415 JSON content-type gate -> JSON depth / prototype-pollution guard -> routes.

| Route | Caller | Gate before handler | Input bounds | Writes |
|---|---|---|---|---|
| GET `/` (index.ts:251) | anyone | env validation | none | none; echoes `ENVIRONMENT` |
| GET `/health` (index.ts:260) | anyone | env validation | none | none |
| GET `/auth/discord` (authorize.ts:30 -> oauth-flow.ts:110) | anyone | RL 10/min per IP+path | challenge `^[A-Za-z0-9-_]{43,128}$`, method S256 only, redirect_uri exact origin + exact path `/auth/callback` no query/hash, return_path <=256 visible ASCII rooted at one `/`, state <=256 visible ASCII (oauth-flow.ts:116-186) | none (signs state) |
| GET `/auth/xivauth` (xivauth.ts:58) | anyone | same | same | none |
| GET `/auth/callback`, `/auth/xivauth/callback` (oauth-flow.ts:228) | anyone (provider redirect) | RL 20/min; HMAC state + exp, provider match (oauth-flow.ts:249-269), redirect re-validated (276-285) | query only | none (302 bounce) |
| POST `/auth/callback` (callback.ts:49) | anyone holding a signed state + matching verifier | RL 20/min; 10 KB; 415; depth 10; object body; verifier regex; signed state required; S256(verifier) == signed challenge before any Discord call (callback.ts:109-128, pkce-binding.ts:49-82) | state <= 4096 chars | D1 `users` upsert (bound statements) |
| POST `/auth/xivauth/callback` (xivauth.ts:77) | same | same (xivauth.ts:111-158) | same | D1 `users` upsert |
| GET `/auth/me` (token.ts:34) | Bearer JWT | RL 30/min; HS256 pinned, sub+exp typed, exp, `iss == WORKER_URL`, jti blacklist (jwt-service.ts:155-243) | header | none |
| POST `/auth/revoke` (token.ts:101) | holder of any validly signed token (expired allowed) | RL 30/min; signature-only verify | header | KV `revoked:<jti>`, TTL exp+900 s (auth/revocation.ts:79-97) |
| any other `/auth/*` | anyone | RL 30/min (own bucket per spelling) | n/a | 404 JSON echoing method + path |
| OPTIONS `*` | CORS preflight | answered by `cors()` before the header middleware | exact allowlist | none |

Outbound fetch targets are fixed constants (discord.com token + `/users/@me`, xivauth.net token/user/characters:
callback.ts:150,200; xivauth.ts:34-37), each with `AbortSignal.timeout` (10 s / 5 s). No user-controlled URL.

## 2. Positive controls (verified this checkout)

- State: HMAC-SHA256 over base64url(JSON), `crypto.subtle.verify`, mandatory `exp` (state-signing.ts:61-87); unsigned
  states only when `ENVIRONMENT === 'development'` (oauth-flow.ts:93,250) and never on the POST leg (pkce-binding.ts:66).
- PKCE bound server-side: S256(verifier) compared to the challenge the worker signed, provider pinned in the state on
  both legs (pkce-binding.ts:72-78; oauth-flow.ts:267).
- Redirect and CORS share one exact allowlist (`https://xivdyetools.app`, `https://beta.xivdyetools.app`, FRONTEND_URL;
  loopback stripped outside development: constants/oauth.ts:14-51; index.ts:73). FINDING-006 (2026-10-03) holds: the
  projectgalatine origin and route are gone (constants/oauth.ts:10-25, wrangler.toml:6-11).
- JWT: HS256 pinned and typed `sub`/`exp` via `@xivdyetools/auth` (jwt.ts:299-330), `iss` pinned on `/auth/me`
  (token.ts:53-58), 1 h TTL (wrangler.toml:23), `jti` per token; blacklist TTL = remaining life + 15 min, minimum 60 s,
  so it outlives `exp` (auth/revocation.ts:89-91). `/auth/refresh` stays removed (index.ts:286-293).
- Minimal claims: `sub, iat, exp, iss, jti, username, global_name, avatar, auth_provider, discord_id?`
  (jwt-service.ts:126-142). No roster, no `primary_character`, no `xivauth_id`.
- D1 only through `.prepare().bind()`; the one template (`UPDATE users SET ${fields}`) joins constant column strings
  (user-service.ts:259-289). Schema holds `id, discord_id, xivauth_id, auth_provider, username, created_at, updated_at`
  only (schema/users.sql:14-25); migration 0001 drops `xivauth_characters` and `avatar_url`. All of it is disclosed in
  apps/web-app/PRIVACY.md:82-92.
- Account linking never claims a Discord id another row owns and never overwrites an existing link; concurrent-claim
  race handled (user-service.ts:174-249). Linked id must be a valid snowflake (xivauth.ts:343-353).
- Logging: request logger records pathname only (worker-kit logger.ts:80-89; no `sanitizePath`, so no query string,
  hence no `code`/`state` in logs); `logUserAgent` not set (index.ts:43-45); production level is `info`, so the
  XIVAuth `debug` lines (scope, mfaEnabled, counts) are suppressed (logger presets/worker.ts:68); upstream error bodies
  only in development (callback.ts:169-173, xivauth.ts:190-197); `[observability] enabled = false` (wrangler.toml:48-49).
- Response hygiene: `Cache-Control: no-store`, `Pragma`, nosniff, XFO DENY, HSTS on every dispatched response including
  the env-validation 500 (index.ts:114-134); `onError` returns a generic message outside development (index.ts:311-333).
- Body: 10 KB streamed cap, 415 unless `application/json`, depth 10 + prototype-pollution check, case-insensitive
  media type in worker-kit 1.5.0 (body-validation.ts:22-73; worker-kit body-guards.ts:43-54).
- Rate limit: native `RL_AUTH_10/20/30` bindings required in production by `validateEnv` (env-validation.ts:120-133),
  so the KV `rl:<ip>` fallback is unreachable there; keyed on the decoded path (index.ts:182-193); `getClientIp` ignores
  X-Forwarded-For by default (worker-kit ip.ts:57-78).
- Secrets: only `DISCORD_CLIENT_SECRET`, `JWT_SECRET`, `XIVAUTH_CLIENT_SECRET` as secrets; `[vars]` hold public client
  ids and URLs (wrangler.toml:17-23); `.dev.vars` and `.dev.vars.*` ignored (.gitignore:11-13). `JWT_SECRET` >= 32
  chars enforced (env-validation.ts:82-86).
- Login CSRF / code injection: an injected code needs the victim's own verifier and the SPA's CSRF nonce.

## 3. Candidates (details in the structured return)

- oauth-01 LOW: per-IP limiter keys on the full IPv6 address (worker-kit ip.ts:87-89, rate-limit.ts:145), so one
  client with a routed /64 gets an independent 10/20/30-per-minute budget per address. Precondition: IPv6 enabled on
  the auth.xivdyetools.app zone (Cloudflare default, not confirmable from the repo). Shared helper: affects every
  worker using `getClientIp`.
- oauth-02 INFO: `GET /auth/discord` and `/auth/xivauth` are an unauthenticated HMAC oracle under `JWT_SECRET` (the JWT
  key) over base64url(JSON) partly chosen by the caller (oauth-flow.ts:190-203, state-signing.ts:35-41). Not
  exploitable today: a JWT signing input always contains `.`, a state's never does, and the only other `JWT_SECRET`
  consumer is presets-api's JWT verify (apps/presets-api/src/middleware/auth.ts:100). No key/domain separation.

## 4. Rejected items

- Revocation fails open on a KV read error (auth/revocation.ts:61-66): carried rejection (2026-10-03 review-oauth, 2026-09-15).
- `/auth/revoke` accepts expired or other-issuer signed tokens (token.ts:118): can only blacklist a jti the caller holds.
- `error_description` reflected into the SPA redirect (oauth-flow.ts:233-238): SPA only logs it (web-app auth-service.ts:271-279).
- `credentials: true` on CORS (index.ts:100): no cookies exist; exact allowlist.
- `GET /` echoes `ENVIRONMENT` (index.ts:251-257) and 404 echoes method+path as JSON with nosniff (index.ts:300-308): not sensitive.
- Preflight lacks security headers (documented in apps/oauth/CLAUDE.md): 204, no data.
- Beta origin trusted in production CORS/redirect (constants/oauth.ts:16-20): documented design (beta uses prod accounts).
- Shared `JWT_SECRET` with presets-api / single HS256: accepted trade-off.
- XIVAuth `refresh` scope (xivauth.ts:47): carried 2026-08-29 OAUTH-09 INFO, unchanged; not re-filed.
- XIVAuth `debug` log of `mfaEnabled`/scope (xivauth.ts:210-216,281-285): `debug` is below the production `info` level.
- `User <uuid> not found after update` in a console line (user-service.ts:294, callback.ts:272): needs a row deleted mid-request; Workers Logs off.
- KV `rl:<ip>:<path>` keys: fallback unreachable in production (env-validation.ts:120-133).
- Non-string `code`/`code_verifier` in the POST body: coerced to the same string by regex, TextEncoder and URLSearchParams; no bypass.
- `xivauthUser.id.slice` on a non-string id -> 500 (xivauth.ts:376): upstream-trusted, robustness only.
- Trusting XIVAuth's `social_identities` Discord link (xivauth.ts:343-353): upstream decision reviewed 2026-08-21 FINDING-013;
  XIVAuth binds identities via OmniAuth (other-sources/XIVAuth app/controllers/users/omniauth_callbacks_controller.rb:71-95).
- `workers_dev`/`preview_urls` not pinned at top level: routes are set so wrangler defaults both off; carried hardening note (2026-10-03 review-ci-supply-chain:70).
- Dev env D1 placeholder `TODO_RUN_WRANGLER_D1_CREATE` (wrangler.toml:84): a `--env development` deploy fails; documented.

## 5. Files covered

33 files. apps/oauth (24): wrangler.toml, package.json, CLAUDE.md, CHANGELOG.md (3.1.2-3.1.3), schema/users.sql,
migrations/0001_drop_xivauth_characters.sql, src/index.ts, src/types.ts, src/constants/oauth.ts,
src/handlers/{authorize,callback,oauth-flow,token,xivauth}.ts, src/middleware/body-validation.ts,
src/services/{jwt-service,rate-limit,user-service}.ts, src/utils/{env-validation,oauth-validation,pkce-binding,state-signing}.ts,
src/__tests__/wrangler-config.test.ts (header). packages/auth/src: revocation.ts, jwt.ts (verifyJWTSignatureOnly),
hmac.ts (hmacVerify). packages/worker-kit/src: rate-limiter/ip.ts, rate-limiter/presets/configs.ts,
rate-limiter/backends/cloudflare.ts (key build), middleware/logger.ts, body-guards/body-guards.ts (media type).
packages/logger/src/presets/worker.ts (level). Cross-checks: apps/web-app/src/services/auth-service.ts (callback
handling), apps/web-app/PRIVACY.md (sign-in disclosure, IP section), apps/presets-api/src/middleware/auth.ts (grep),
other-sources/XIVAuth (read-only, not fetched; HEAD a4e6693): api/v1/users_controller.rb, omniauth_callbacks_controller.rb.
Directories: apps/oauth/, packages/auth/src/, packages/worker-kit/src/, packages/logger/src/presets/.
