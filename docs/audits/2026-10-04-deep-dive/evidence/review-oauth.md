# Review: oauth (apps/oauth) - deep-dive 2026-10-04

## Map
| Module | Role |
|---|---|
| src/index.ts | Hono app. Order: requestId, logger, CORS, security headers, validateEnv gate, `/auth/*` rate limit, bodySizeLimit, jsonDepthLimit, routers |
| handlers/oauth-flow.ts | shared authorize + GET-callback pipeline (state signing, redirect allowlist, code bounce) |
| handlers/authorize.ts, callback.ts | Discord: GET /auth/discord, GET+POST /auth/callback |
| handlers/xivauth.ts | XIVAuth: GET /auth/xivauth, GET+POST /auth/xivauth/callback (+ roster -> display name) |
| handlers/token.ts | GET /auth/me, POST /auth/revoke |
| services/jwt-service.ts | HS256 mint, verify wrappers (delegate to @xivdyetools/auth), revocation |
| services/user-service.ts | D1 find-or-create + identity linking |
| services/rate-limit.ts | native RL_AUTH_* -> KV -> memory limiter; key = `ip:path` |
| utils/state-signing.ts, pkce-binding.ts, oauth-validation.ts, env-validation.ts | state HMAC, S256 binding, validators, env gate |
| constants/oauth.ts | redirect allowlist (PR #228 removed the projectgalatine origin) |
| wrangler.toml, migrations/0001 | config (PR #228: single route, observability off), hand-run drop migration |

PR #228 delta in this slice is small (constants/oauth.ts, oauth-flow.ts comment, wrangler.toml, 2 tests). Reviewed clean.

## Candidates

### oauth-01 BUG MEDIUM - src/index.ts:~196 (+ services/rate-limit.ts:~149)  origin MAIN
Claim: the rate-limit key uses `new URL(c.req.url).pathname` (raw, still percent-encoded) while Hono routes on a percent-decoded path, so an encoded spelling of an auth path reaches the handler but gets its own limiter bucket and the default tier.
Failing input: `POST /auth/%63allback` (or `/auth/%64iscord`, `/auth/xivauth/%63allback`, varying which letters are encoded). Verified with hono 4.13.9: `getPath` returns `/auth/callback`, `URL.pathname` stays `/auth/%63allback`.
Wrong outcome: key `ip:/auth/%63allback` is a fresh bucket per spelling and `getOAuthLimit` falls through to the 30/min default, so the 10/min login-initiation and 20/min token-exchange limits (FINDING-003) are bypassable without bound. Each exchange makes up to three upstream calls, so worker egress can be spent and the upstream app rate-limited, blocking logins for everyone.
Tests miss it: rate-limit tests call checkRateLimit with literal paths. Covered: no.
Excerpt:
```
const path = new URL(c.req.url).pathname;           // index.ts, raw
const result = await checkRateLimit(clientIp, path, ...)
// Hono route match uses getPath() -> decoded
```
Fix: derive the limiter path from the same decoded path Hono routes on (`c.req.path`, or decodeURI-normalize) and add a test posting `/auth/%63allback` past the limit.

### oauth-02 BUG LOW - src/handlers/callback.ts:~61 and src/handlers/xivauth.ts:~97  origin MAIN
Claim: `const { code, ... } = body` sits outside the try; a JSON body that is literally `null` makes `c.req.json()` return null and destructuring throws.
Failing input: `POST /auth/callback` with `Content-Type: application/json`, body `null`. jsonDepthLimit lets it through (validateStructure(null) returns ok).
Wrong outcome: `app.onError` -> `500 {error:'Internal Server Error'}` plus an error log, instead of the handler's 400 `Invalid request body`. No data impact.
Tests miss it: invalid-body tests send malformed JSON, not valid `null`. Covered: no.
Fix: after parse, `if (typeof body !== 'object' || body === null) return 400`.

### oauth-03 BUG LOW - src/handlers/xivauth.ts:~280-326  origin MAIN
Claim: BUG-051's fix guards only "roster is not an array"; array elements are not validated.
Failing input: characters endpoint returns 200 `[null]`. The debug line `characters.filter((ch) => ch.verified)` throws inside the try, the catch keeps `characters = [null]`, then `characters.find((ch) => ch.verified)` throws outside it.
Wrong outcome: `500 Authentication failed` instead of the degraded `XIVAuth User <id>` login. Related: a verified character with `name: ""` gives `displayName = ""` (`??` skips only null/undefined), so username/global_name become empty.
Tests miss it: the BUG-051 test covers object/null/string rosters only. Covered: partly.
Fix: filter the roster to objects, and require a non-empty string name before using it as displayName.

### oauth-04 UNTESTED LOW - src/__tests__ (rate-limit.test.ts / index.test.ts)
Claim: no test drives the limiter through the HTTP app with a percent-encoded path, which is how oauth-01 survived; same for a `null` JSON body (oauth-02).
Fix: add both cases alongside the fixes.

## POSITIVE
- State: HMAC via `crypto.subtle.verify`, `exp` enforced inside verifyState, unsigned accepted only in development and only on the GET leg; POST leg always requires signed state.
- PKCE bound server-side (pkce-binding.ts): provider match and S256 compare before any upstream call; non-string state handled without throwing.
- Redirect allowlist shared across authorize, GET callback and CORS; exact path, no query or hash; error redirects recover the origin only from a verified state.
- /auth/me pins issuer; shared verifier rejects non-HS256 and ill-typed claims; revoke write failure is a 503.
- CORS and security headers run before env validation; env validated on every request.
- findOrCreateUser recovers from unique-constraint races on INSERT and on the link UPDATE and refuses to steal a Discord id.
- No roster, avatar_url or character name persisted or minted; logs carry no identifiers.
- PR #228 changes are consistent and pinned by tests.

## REJECTED
- Login response `username` (Discord handle) differs from JWT username (display name): web-app reads the JWT payload (auth-service.ts:~498), no visible effect.
- `error_description` echoed unbounded into the SPA redirect: text injection only; rendering is the web-app slice.
- jsonDepthLimit skipped for non-JSON content-type: prototype keys harmless to destructuring, 10 KB cap still applies.
- State not single-use: replay needs code + verifier; provider codes are single-use.
- Revoke of an expired token: TTL floors at 60 s, works.
- FRONTEND_URL trailing slash would break CORS match: wrangler value has none; latent.
- oauth-10 (RETURNING) open by decision; not re-filed.
- Account-link ping-pong for two XIVAuth accounts sharing one Discord link: documented design.

## COVERED
19 slice files read (non-test): migrations/0001_drop_xivauth_characters.sql, package.json (skimmed), src/constants/oauth.ts, handlers/{authorize,callback,oauth-flow,token,xivauth}.ts, index.ts, middleware/body-validation.ts, services/{jwt-service,rate-limit,user-service}.ts, types.ts, utils/{env-validation,oauth-validation,pkce-binding,state-signing}.ts, wrangler.toml. Also read for confirmation: packages/auth/src/{jwt,revocation}.ts, packages/worker-kit/src/body-guards/*, rate-limiter presets and ip. Tests skimmed by grep only.
