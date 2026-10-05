# Security review: apps/oauth (2026-10-03, commit 0ab33466)

Scope: `apps/oauth` (CF Worker, D1 `xivdyetools-users`, KV `TOKEN_BLACKLIST`), plus the shared code it executes: `packages/auth/src/{jwt,revocation}.ts`, `packages/worker-kit/src/{middleware/logger,rate-limiter/ip,rate-limiter/backends/cloudflare,rate-limiter/presets/configs,body-guards}`. No probe scripts were written. Source delta since 0332fcc5 for oauth `src/` is only `index.ts` (BUG-017 header reorder) and `middleware/body-validation.ts` (bodyGuards factory).

## 1. Entry points and authz matrix

All routes share one global chain (index.ts): requestId (36) -> logger (43, pathname only, no UA, no query) -> CORS (52-102) -> security headers + `Cache-Control: no-store` (114-134) -> validateEnv, 500 fail-closed outside development (153-175) -> for `/auth/*` only: rate limit (182-224) -> bodySizeLimit 10 KB (234) -> jsonDepthLimit (237) -> handler.

| Route | Who can call | Guards before handler | Body / param caps |
|---|---|---|---|
| GET `/`, `/health` (244-258) | anyone | global chain only (no rate limit, outside `/auth/*`) | none; `/` echoes `ENVIRONMENT` |
| GET `/auth/discord` (authorize.ts:516 -> oauth-flow.ts:110) | anyone | rate limit 10/min/IP/path | `code_challenge` regex 43-128 b64url, method S256 only, `redirect_uri` exact origin + exact path `/auth/callback`, `return_path` <=256 visible ASCII rooted at single `/`, `state` <=256 visible ASCII |
| GET `/auth/xivauth` (xivauth.ts:58) | anyone | same, 10/min | same shared pipeline |
| GET `/auth/callback` (callback.ts:35 -> oauth-flow.ts:228) | anyone (Discord redirect) | rate limit 20/min; HMAC-signed state with `exp`, provider match, redirect re-validated against allowlist | no body; `code`/`state` unbounded in query but bounded by edge URL limit |
| GET `/auth/xivauth/callback` (xivauth.ts:59) | anyone | same, 20/min | same |
| POST `/auth/callback` (callback.ts:49) | anyone holding code + verifier + signed state | rate limit 20/min, 10 KB cap, depth guard (JSON content-type only), verifier regex, state required, S256(verifier) == signed challenge, provider == discord | state <=4096 chars (pkce-binding.ts:26) |
| POST `/auth/xivauth/callback` (xivauth.ts:77) | same | same chain, provider == xivauth | same |
| GET `/auth/me` (token.ts:34) | holder of an unrevoked HS256 JWT with `iss` == WORKER_URL | rate limit 30/min; Bearer parse; sig + alg + exp + iss + blacklist | header only |
| POST `/auth/revoke` (token.ts:101) | holder of any validly signed token (expired allowed) | rate limit 30/min; sig-only verify | 10 KB |
| POST `/auth/refresh` | removed; 404 (index.ts:279-281) | | |
| OPTIONS `*` | CORS preflight answered by `cors()` before header middleware | allowlisted origin only (73-91) | n/a |

Bindings and secrets: D1 `DB`, KV `TOKEN_BLACKLIST`, `RL_AUTH_10/20/30`; secrets `DISCORD_CLIENT_SECRET`, `JWT_SECRET`, `XIVAUTH_CLIENT_SECRET` are not in `[vars]` (wrangler.toml:15-21 holds only public client ids and URLs). No `[observability]` block (Workers Logs off). `.dev.vars*` ignored (.gitignore:11-13, none tracked). The top-level block is production (`wrangler.toml:6-9`, no `[env.production]`); the only other env is `development`.

Outbound fetches (all fixed https hosts, all with `AbortSignal.timeout`): discord.com token (callback.ts:136) and users/@me (186); xivauth.net token (xivauth.ts:164), user (225), characters (276). No user-controlled URL, so no SSRF.

## 2. Positive controls

- State and PKCE: HMAC-SHA256 signed state with mandatory `exp` (state-signing.ts:80-83), constant-time verify via `crypto.subtle.verify` (jwt-service.ts:258 -> auth hmacVerify), unsigned states only when `ENVIRONMENT === 'development'` (oauth-flow.ts:93, 250), and the POST path never accepts unsigned (pkce-binding.ts:67 passes `false`). The worker recomputes S256(code_verifier) and compares to the challenge it signed before any provider call (pkce-binding.ts:76-78); the provider is bound into the state on both legs (oauth-flow.ts:267; pkce-binding.ts:72).
- Redirect allowlist is exact origin match via `new URL().origin` plus exact path/no query/no hash (oauth-validation.ts:67-93). There is no prefix or subdomain match. The same list drives CORS (index.ts:73). `return_path` rejects `//`, backslash, non-ASCII (oauth-validation.ts:108-115). Localhost entries are stripped outside development (constants/oauth.ts:40-48).
- Domain separation between state and JWT is incidental but sound: the state signature input is `base64url(json)` (no `.`), while JWT signing input always contains a `.`. The authorize endpoint therefore cannot be used as an HMAC signing oracle for a JWT.
- JWT: alg pinned to HS256 (packages/auth jwt.ts:147), `exp`/`sub` must be well typed (jwt.ts:179-190), `exp` enforced and `iss` pinned to `WORKER_URL` on `/auth/me` (jwt-service.ts:167-183; token.ts:53-58), 1 h TTL (jwt-service.ts:121-122), `jti` per token, `/auth/refresh` gone. Revocation TTL is remaining lifetime + 15 min (revocation.ts:91), so the entry outlives `exp`. A failed revoke write returns 503, not 200 (token.ts:159-171).
- Cache-Control `no-store` + Pragma on every response, including the misconfiguration 500 (index.ts:114-134), HSTS outside development. FINDING-022 stays fixed.
- validateEnv in production requires RL_AUTH_10/20/30 and TOKEN_BLACKLIST, JWT_SECRET >= 32, HTTPS URLs, ENVIRONMENT in {development, production} (env-validation.ts:71-133). It runs on every request and fails closed (index.ts:170). FINDING-013 and FINDING-029 stay fixed.
- Rate limiting is native `[[ratelimits]]` keyed IP + path (rate-limit.ts:138-150); tier routing is longest-prefix (configs.ts:45-52). XFF is not trusted (ip.ts:260). Native-backend errors fail open (accepted trade-off) but are logged without the key (index.ts:199-202).
- Logging and privacy: logger logs `pathname` only, so no `code` or `state` query reaches logs (logger.ts:83-86), and `logUserAgent` is off (index.ts:43-45). XIVAuth handler logs carry no ids, names or response keys (xivauth.ts:196-350). Prod error bodies are generic (index.ts:318-324), and upstream error bodies are logged only in development (callback.ts:155-159; xivauth.ts:177-183).
- D1: every statement is `.prepare().bind()`. The only template is the `UPDATE ... SET ${fields}` whose column names are hard-coded literals (user-service.ts:262-289). Identity row holds id, discord_id, xivauth_id, auth_provider, username, created_at, updated_at (schema/users.sql:17-27). The roster and avatar_url are gone (FINDING-001/002 stay fixed; xivauth.ts:337-342 reads the roster in memory only).
- Discord and XIVAuth access tokens are never stored or logged; the Discord scope is `identify` only.
- XIVAuth linked Discord id must pass `isValidSnowflake` (xivauth.ts:325); an id owned by another row is not claimed and nothing is deleted (user-service.ts:183-200).
- Regressions checked, all still fixed: 2026-08-29 FINDING-001 (no roster table or write), -002 (no avatar_url column, JWT claims minimal at jwt-service.ts:127-143), -003 (no `/auth/refresh`, native limiter), -013 (prod binding gate), -022 (no-store).

## 3. Rejected items

- Revocation fails open on KV read error (revocation.ts:61-66): accepted, documented in README.md:56 and listed as rejected in 2026-09-15.
- `/auth/revoke` accepts expired or other-issuer signed tokens (token.ts:118): harmless, it can only blacklist a jti the caller already holds a validly signed token for.
- Unbounded `error_description` reflected into the SPA redirect (oauth-flow.ts:233-238, 69-72): the SPA only logs `error` (auth-service.ts:255-262), nothing is rendered. This was OAUTH-11 in 2026-08-29 and is still INFO.
- `credentials: true` on CORS (index.ts:100): vestigial, no cookies are used (2026-08-29 OAUTH-10). The allowlist is exact so there is no exposure.
- State replay within 10 min: the provider code is single use and the exchange needs the verifier held in the victim's sessionStorage. The SPA also enforces the CSRF nonce fail-closed (auth-service.ts:386).
- Login CSRF / code injection: needs the victim's `code_verifier`; the SPA checks `csrf` against its stored nonce.
- Open redirect via the error path: `recoverErrorTarget` only returns a state-embedded `redirect_uri` that passes the allowlist, else FRONTEND_URL (oauth-flow.ts:87-100).
- `GET /` echoing `ENVIRONMENT` (index.ts:248): not sensitive.
- `[vars]` client ids (wrangler.toml:17-18): public OAuth client identifiers, not secrets. XIVAuth runs as a public PKCE client when `XIVAUTH_CLIENT_SECRET` is unset (xivauth.ts:158); that is safe because the worker enforces the PKCE binding itself.
- IP reaches only the Cloudflare rate-limit binding key (rate-limit.ts:145), which nothing persists. The KV `rl:` key fallback that would store IPs in `TOKEN_BLACKLIST` is unreachable in production because `validateEnv` demands the native bindings.
- Trusting XIVAuth's `social_identities` Discord link as verified: an upstream trust decision, already reviewed as 2026-08-21 FINDING-013/OAUTH-9, and the mitigation (no claim of an owned id) is in place.
- `username` for XIVAuth users is a verified FFXIV character name (xivauth.ts:342-344). `apps/web-app/PRIVACY.md:66-67` discloses "provider ID and username", and the 08-29 audit settled the wording. Left as a handoff, not a finding.
- Shared `JWT_SECRET` between oauth and presets-api (HS256): accepted single-algorithm trade-off.
- Dev-only `console.warn` of the client `redirect_uri` (callback.ts:128): development only.
- `X-Frame-Options`/HSTS missing on CORS preflight: the README documents it; the preflight carries no data.

## 4. Files covered

apps/oauth: wrangler.toml, README.md (lines 41-127 via grep), CLAUDE.md, schema/users.sql, migrations/0001_drop_xivauth_characters.sql (header), src/index.ts, src/types.ts (1-60), src/constants/oauth.ts, src/handlers/{authorize,callback,oauth-flow,token,xivauth}.ts, src/middleware/body-validation.ts, src/services/{jwt-service,rate-limit,user-service}.ts, src/utils/{env-validation,oauth-validation,pkce-binding,state-signing}.ts.
Shared: packages/auth/src/{jwt.ts (verify path), revocation.ts}, packages/worker-kit/src/{middleware/logger.ts, rate-limiter/ip.ts, rate-limiter/backends/cloudflare.ts, rate-limiter/presets/configs.ts (45-52), body-guards/body-guards.ts (content-type check)}.
Cross-reference: apps/web-app/src/services/auth-service.ts (215-285, 360-420), apps/web-app/PRIVACY.md (55-75), apps/presets-api/src/middleware/auth.ts:84-110, docs/architecture/security-trade-offs.md, docs/audits/2026-09-15-security/SECURITY_AUDIT_REPORT.md (50-63), docs/audits/2026-08-29-security/SECURITY_AUDIT_REPORT.md (oauth rows), evidence/pii-sinks.txt and pii-sources.txt (oauth rows).
Tests were not read except to confirm existence.

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-UNAUTH | apps/oauth/src/constants/oauth.ts:17 (+ wrangler.toml:8) | The "transition period - remove after migration complete" origin `https://xivdyetools.projectgalatine.com` is still a trusted redirect and CORS origin, and `auth.xivdyetools.projectgalatine.com` is still a bound custom domain. If that domain lapses or is reassigned, its owner can run a login flow and receive tokens. |
| c2 | LOW | INTERNET-AUTH | apps/oauth/src/handlers/xivauth.ts:47 | The XIVAuth authorize request asks for `refresh`, and a refresh token is never used or discarded explicitly (the response is read at 194-202 and dropped). The upstream grant stays alive, and neither provider's access token is revoked after use. This is data minimization (2026-08-29 OAUTH-09, not fixed). |
| c3 | INFO | INTERNET-AUTH | apps/oauth/src/handlers/token.ts:183-192 | `/auth/revoke` returns the raw `err.message` with a 500 for any thrown error. The handler is hardened so it is unreachable today, but it is the one route that bypasses the generic error contract of index.ts:318-324. |

c1: trigger is a request to `GET /auth/discord?redirect_uri=https://xivdyetools.projectgalatine.com/auth/callback&code_challenge=<43 chars>`, which the allowlist accepts. Evidence:
```
'https://xivdyetools.projectgalatine.com', // Transition period - remove after migration complete
```
policy NONE, reconcile_case 0, rotation NONE. The fix is to confirm the migration is complete and delete the origin, the CORS entry and the route.

c2: trigger is any XIVAuth sign-in. Evidence:
```
scopes: 'user user:social character refresh',
```
Drop `refresh` (policy NONE, case 1). Optionally add best-effort token revocation. The `user:social` and `character` scopes are used (Discord link and display name).

c3: trigger is a thrown error inside the try at token.ts:116-182. Evidence:
```
const message = err instanceof Error ? err.message : 'Revocation failed';
return c.json({ success: false, error: message }, 500);
```
Replace with a constant message (policy NONE, case 0).

No finding for personal data in this unit. oauth writes id, discord_id, xivauth_id, auth_provider, username (Discord display name or verified character name) and timestamps. `apps/web-app/PRIVACY.md:66-67` discloses "provider ID and username" as created at sign-in. No IP, UA, avatar, guild/channel id, roster or token reaches D1, KV or logs. The JWT carries `avatar` (an unlisted CDN hash, not persisted) back to the same user only.

Positive PII controls: pathname-only request logging, `logUserAgent` off, id-free account-link audit logs (user-service.ts:192-241), no `[observability]` block.

## 6. Handoffs

- documentation: `apps/web-app/PRIVACY.md:66-67` could say that for XIVAuth the stored "username" is the verified FFXIV character name (the six-file edit).
- documentation: `apps/oauth/wrangler.toml:67-69` and `README.md:102` still describe a dev D1 id placeholder (`TODO_RUN_WRANGLER_D1_CREATE`). A `--env development` deploy fails until it is created; this is working as intended but is easy to trip on.
- documentation: `packages/worker-kit/src/rate-limiter/presets/configs.ts:28-29` keeps a `/auth/refresh` limit entry for an endpoint that no longer exists.
- plain bug (minor): `oauth-flow.ts:283` uses `console.error` instead of the request logger for the blocked-redirect event. This is the only unstructured log on the GET callback path (prints a validated redirect_uri, no ids).
