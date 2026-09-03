# review-oauth — deep-dive 2026-09-02

Unit: `oauth` (CF Worker + D1 `xivdyetools-users` + KV `TOKEN_BLACKLIST`). Repo root
`C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02`, `origin/main` e7ac4042.
Read-only review. Version 3.0.1; a bare `wrangler deploy` **is** production here.

## 1. Map

| Module | Route / export | Notes |
|---|---|---|
| `src/index.ts` | app wiring | requestId → logger → env-validate → CORS → security headers → `/auth/*` bodySize → jsonDepth → rate-limit; `GET /`, `GET /health`; 404 + onError |
| `src/handlers/authorize.ts` | `GET /auth/discord` | `DISCORD_FLOW_CONFIG` only; pipeline in oauth-flow |
| `src/handlers/oauth-flow.ts` | `buildAuthorizeHandler`, `buildGetCallbackHandler`, `frontendErrorRedirect` | shared authorize + GET-bounce pipeline for both providers |
| `src/handlers/callback.ts` | `GET /auth/callback`, `POST /auth/callback` | GET = shared pipeline; POST = PKCE bind → Discord token exchange → `/users/@me` → upsert → JWT |
| `src/handlers/xivauth.ts` | `GET /auth/xivauth`, `GET /auth/xivauth/callback`, `POST /auth/xivauth/callback` | + scope validation, user + characters fetch, snowflake-checked linked Discord id |
| `src/handlers/token.ts` | `GET /auth/me`, `POST /auth/revoke` | `/auth/refresh` deleted (FINDING-003) |
| `src/services/jwt-service.ts` | `signPayload`, `createJWTForUser`, `verifyJWT*`, `getAvatarUrl`, revocation re-exports | HS256 mint; verification delegated to `@xivdyetools/auth` |
| `src/services/user-service.ts` | `findOrCreateUser`, `attachIdentities`, `updateUser` | provider-id lookups, no-silent-merge linking, UNIQUE-retry |
| `src/services/rate-limit.ts` | `checkRateLimit`, `getClientIp`, `oauthRateLimitTiers`, `resetRateLimiter` | native binding → KV → memory, prefix `rl:` |
| `src/utils/state-signing.ts` | `signState`, `verifyState` | `base64url(json).hmac`; exp enforced in the primitive |
| `src/utils/pkce-binding.ts` | `verifyPkceStateBinding`, `computeS256Challenge` | signed-state-only; provider + S256 match |
| `src/utils/oauth-validation.ts` | challenge/verifier/redirect/return_path/state/scopes validators | redirect path pinned to `/auth/callback` |
| `src/utils/env-validation.ts` | `validateEnv`, `logValidationErrors` | production also requires `RL_AUTH_10/20/30` + `TOKEN_BLACKLIST` |
| `src/middleware/body-validation.ts` | `bodySizeLimit` (10 KB), `jsonDepthLimit` (depth 10 + proto keys) | |
| `src/constants/oauth.ts` | `ALLOWED_REDIRECT_ORIGINS`, `getAllowedRedirectOrigins`, `REDIRECT_CALLBACK_PATH`, timeouts | one allowlist for CORS + both flow steps |
| `schema/users.sql`, `migrations/0001_*.sql` | `users` + 3 indexes; drop roster/avatar_url | hand-run migration, no `d1_migrations` table |
| `wrangler.toml` | top level = production, `[env.development]` only | 3 ratelimit tiers per env; KV shared with presets-api |

## 2. Candidates

---

### oauth-01 — BUG — MEDIUM — `src/handlers/oauth-flow.ts:54`

**Claim.** Every GET-callback failure path redirects to `${FRONTEND_URL}/auth/callback`, discarding
the allowlisted origin that actually started the flow, so a beta / transition-domain user is dumped
on the production site.

**Failing input → wrong outcome.** A user on `https://beta.xivdyetools.app` starts a Discord login
(the SPA sends `redirect_uri=https://beta.xivdyetools.app/auth/callback`, confirmed at
`apps/web-app/src/services/auth-service.ts:654`) and clicks **Cancel** on the consent screen.
Discord returns to `GET /auth/callback?error=access_denied&state=<signed>`; the handler takes the
`if (error)` branch at `oauth-flow.ts:193` and issues `302 https://xivdyetools.app/auth/callback?error=access_denied`.
The user lands on a *different site*, their beta `sessionStorage` (PKCE verifier, CSRF nonce,
return path) is unreachable, and the beta app never learns the login failed. The same happens on the
10-minute state expiry and on the untrusted-redirect branch (`oauth-flow.ts:223`) — and `state` is
present in the query on the provider-error path, so the correct target *is* recoverable there.

```ts
function frontendErrorRedirect(c, config, message): Response {
  const redirectUrl = new URL(`${c.env.FRONTEND_URL}/auth/callback`);   // ← always production
  redirectUrl.searchParams.set('error', message);
  ...
}
// 193:  if (error) { return frontendErrorRedirect(c, config, error_description || error); }
```

**Why tests miss it.** `callback.test.ts:116-145` and `xivauth.test.ts:337-368` assert only
`location.searchParams.get('error')`; no test ever reads `location.origin`. The suite also runs on
the development env where `FRONTEND_URL` *is* the origin under test, so origin and target coincide.

**Covered by test:** no.
**Fix.** On the `error` and post-`verifyState` branches, verify the state and reuse
`stateData.redirect_uri` (already re-validated by `validateRedirectUri`) as the error target; keep
`FRONTEND_URL` only as the last-resort fallback when no trustworthy state is available.

---

### oauth-02 — BUG — MEDIUM — `src/handlers/token.ts:127-151`

**Claim.** A KV write failure during logout is swallowed by `revokeToken` and reported to the client
as `200 { success: true }` with a `note` that misattributes it to a missing JTI — the token stays
valid until `exp`, and nothing is logged anywhere.

**Failing input → wrong outcome.** `POST /auth/revoke` with a valid current token while
`TOKEN_BLACKLIST.put` throws (KV incident, quota, binding fault). `revokeToken`
(`packages/auth/src/revocation.ts:94`) catches and returns `false`; `revoked` is falsy so the handler
falls through to the "fallback" response, which — because `c.env.TOKEN_BLACKLIST` is truthy —
emits `note: 'Token lacks JTI claim (older token format)'`. The user is told logout succeeded, the
`jti` is never blacklisted, and `GET /auth/me` (and presets-api) keep accepting the token for up to
`JWT_EXPIRY` (3600 s). Neither `revokeToken` nor this handler logs anything, so a KV outage in which
every logout silently fails is invisible in production.

```ts
if (payload.jti && c.env.TOKEN_BLACKLIST) {
  const revoked = await revokeToken(payload.jti, payload.exp, c.env.TOKEN_BLACKLIST);
  if (revoked) { return c.json({ success: true, ..., revoked: true }); }
}
return c.json({ success: true, message: 'Token marked for revocation. ...', revoked: false,
  note: c.env.TOKEN_BLACKLIST ? 'Token lacks JTI claim (older token format)' : 'Token blacklist not configured' });
```

**Why tests miss it.** See oauth-04 — the KV-error test asserts exactly the two fields that are the
same in the success-shaped no-op case and never inspects `note`.

**Covered by test:** partially (behaviour is asserted, and the assertion cements the wrong note).
**Fix.** Distinguish "no jti" from "store write failed": have the handler branch on
`payload.jti`/store availability itself, log a `logger.error` on a failed put, and answer the write
failure with an accurate note (and ideally a non-200) so the client does not report a clean logout.

---

### oauth-03 — BUG — MEDIUM — `src/handlers/xivauth.ts:285` (blows up at `:325`)

**Claim.** The XIVAuth character roster is assigned to `characters` *before* it is known to be an
array, so a 200 response with any non-array JSON body defeats the "not a fatal error" catch and
turns the whole sign-in into a 500.

**Failing input → wrong outcome.** `GET https://xivauth.net/api/v1/characters` returns
`200 {"data": []}` (or `200 null`). Line 285 assigns the object to `characters`; line 288
(`characters.filter`) throws inside the try, the catch at 293 logs "Error fetching XIVAuth
characters" and continues *without restoring `characters` to `[]`*; line 325
(`characters.find(...)`) then throws `TypeError` outside that catch, reaches the outer handler catch
at 367, and the user gets `500 { success: false, error: 'Authentication failed' }` instead of the
intended degraded login with the `XIVAuth User <id>` fallback name.

```ts
if (charactersResponse.ok) {
  characters = await charactersResponse.json();          // 285 — no Array.isArray guard
  logger?.debug('XIVAuth characters fetched', { count: characters.length,
    verifiedCount: characters.filter((ch) => ch.verified).length });   // 288 throws
}
} catch (charErr) { logger?.warn(...); /* Continue without characters - not a fatal error */ }
const verifiedCharacter = characters.find((ch) => ch.verified) ?? null;   // 325 throws again → 500
```

**Why tests miss it.** `xivauth.test.ts:684` covers a non-ok status and `:731` covers `fetch`
throwing; both leave `characters` as the initial `[]`. No test returns a 200 whose body is not an
array.

**Covered by test:** no.
**Fix.** Parse into a local, `const roster = await res.json(); characters = Array.isArray(roster) ? roster : [];`
before any use — the catch then genuinely means "continue without characters".

---

### oauth-04 — UNTESTED — MEDIUM — `src/__tests__/token.test.ts:488-521`

**Claim.** "should handle KV errors gracefully during revocation" asserts only
`status === 200`, `success === true`, `revoked === false` — the exact triple the no-JTI
(`:403`) and no-KV (`:467`) cases already produce — so it cannot fail for the behaviour it exists to
pin: that a *failed* revocation is distinguishable from a *successful no-op*.

**Behaviour it was supposed to catch.** That a KV put failure is reported truthfully. Today the
response claims the token "lacks JTI" (oauth-02) and the test stays green; deleting the whole
`if (revoked)` block would also keep it green.

```ts
const errorKV = { put: async () => { throw new Error('KV put failed'); }, ... };
...
expect(response.status).toBe(200);
expect(json.success).toBe(true);
expect(json.revoked).toBe(false);      // ← identical to the no-JTI and no-KV cases; `note` never read
```

**Fix.** Assert `json.note` (and, once oauth-02 is fixed, the log line / status) so the three
`revoked:false` outcomes are told apart.

---

### oauth-05 — BUG — LOW — `src/handlers/oauth-flow.ts:204-224`

**Claim.** `buildGetCallbackHandler` never checks `stateData.provider === config.provider`, even
though `buildAuthorizeHandler:157` writes the marker and `verifyPkceStateBinding` enforces it on the
POST leg.

**Failing input → wrong outcome.** A Discord-flow signed state replayed at
`GET /auth/xivauth/callback?code=…&state=<discord state>` is accepted; the bounce carries
`provider=xivauth` (taken from `config`, not the state), so the SPA routes the exchange to
`POST /auth/xivauth/callback`, where `verifyPkceStateBinding(..., 'xivauth', ...)` finally rejects it
as `Invalid state` — a wasted round trip and a confusing failure rather than a fail-fast. No
privilege is gained; the loss is defence in depth on the GET leg.

**Why tests miss it.** `callback.test.ts:422` and `xivauth.test.ts:1067` test provider confusion only
on the POST leg.

**Covered by test:** no.
**Fix.** Add `if (stateData.provider && stateData.provider !== config.provider) return frontendErrorRedirect(...)`
right after `verifyState`.

---

### oauth-06 — BUG — LOW — `src/services/user-service.ts:97-98`

**Claim.** The INSERT path synthesizes the returned `UserRow` with ISO-8601 timestamps while D1
stores the column defaults `datetime('now')` (`schema/users.sql:21-22`, space-separated,
second precision, no `Z`), so the row a caller sees after a first sign-in never matches the row in
the database.

**Failing input → wrong outcome.** Any first-time sign-in returns
`created_at: '2026-09-02T12:00:00.000Z'` while the stored value is `'2026-09-02 12:00:00'`; the same
user's second sign-in (which re-reads the row via `updateUser`) returns the SQLite form. Latent
today — nothing in `apps/oauth` or `apps/presets-api` reads `UserRow.created_at`/`updated_at` — but
the first consumer to compare, sort or `new Date()` these values gets two formats from one API.

```ts
return { id: newId, ..., created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
```

**Why tests miss it.** The D1 mock (`__tests__/mocks/cloudflare-test.ts:100`) stores
`new Date().toISOString()` too, so mock and code agree on the wrong format.

**Covered by test:** no.
**Fix.** `INSERT … RETURNING *` (D1 supports it) and return the row the database actually wrote, or
bind explicit `strftime('%Y-%m-%d %H:%M:%S','now')` values.

---

### oauth-07 — BUG — LOW — `src/services/user-service.ts:160-173`

**Claim.** The "is this Discord id already owned?" guard is a check-then-update against the partial
`UNIQUE(discord_id)` index, not an atomic write, so two concurrent sign-ins asserting the same
Discord id both pass the SELECT and one `UPDATE` violates the index.

**Failing input → wrong outcome.** Two overlapping XIVAuth callbacks that each resolve to a
different local row and both assert linked Discord id `D` (which no row yet owns): both `SELECT id
FROM users WHERE discord_id = ? AND id != ?` return `null`, both proceed to `updateUser`, the second
`UPDATE` raises `UNIQUE constraint failed: users.discord_id`. The error escapes `attachIdentities`
(the UNIQUE-retry logic lives only around the INSERT at `:100-125`), reaches the handler's outer
catch, and the user sees `500 Authentication failed` — the exact failure BUG-004 added the guard to
avoid. Narrow window (same user, two providers, simultaneous), no data corruption.

**Covered by test:** no (`user-service.test.ts:243-364` exercises the guard only sequentially).
**Fix.** Wrap the link write in the same constraint-error handling the INSERT path has, or make it
`UPDATE users SET discord_id = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM users WHERE discord_id = ?)`
and re-read.

---

### oauth-08 — REFACTOR — LOW — `src/index.ts:56-78` vs `:85-135`

**Claim.** The env-validation middleware short-circuits with `500 { error: 'Service misconfigured' }`
*before* the CORS middleware runs, so the response carries no `Access-Control-Allow-Origin` and the
SPA sees an opaque network error instead of the 500 it could surface.

**Failing input → wrong outcome.** Any browser request from `https://xivdyetools.app` while a
production binding is missing (e.g. `TOKEN_BLACKLIST` dropped — `env-validation.ts:130`): the fetch
rejects with a CORS error and the user gets a generic "network problem", masking a config incident
that the JSON body names precisely.

**Covered by test:** no (`index.test.ts` misconfiguration tests use `fetchWithEnv` without an
`Origin` header).
**Fix.** Register the CORS middleware above the env-validation gate (it does not depend on validated
env — `getAllowedRedirectOrigins` only reads `FRONTEND_URL`/`ENVIRONMENT`).

---

### oauth-09 — OPT — LOW — `src/index.ts:162-172`

**Claim.** `bodySizeLimit` and `jsonDepthLimit` are registered on `/auth/*` *before* the rate-limit
middleware, so every request — including ones about to be 429'd — reads its body, `JSON.parse`s it
and walks the structure recursively.

**Impact.** Bounded by the 10 KB cap, so this is CPU shaping rather than a DoS: an attacker over
the limit still pays the parse budget on the worker instead of being rejected on a header check.
**Fix.** Move `app.use('/auth/*', …rate limit…)` above the two body middlewares; nothing in the
limiter reads the body.

---

### oauth-10 — OPT — LOW — `src/services/user-service.ts:195-231`

**Claim.** A returning-user sign-in costs 3-4 sequential D1 round trips (lookup → optional owner
check → `UPDATE` → `SELECT`), where `RETURNING` collapses the last two.

**Impact.** Two extra serial D1 hops on the latency-visible token-exchange path (`POST /auth/callback`),
which already makes two external Discord calls. Not a correctness problem.
**Fix.** `UPDATE users SET … WHERE id = ? RETURNING *` and drop the follow-up `SELECT`; the
`if (!updated) throw` check still works off the returned row.

---

### oauth-11 — BUG — LOW — `src/services/jwt-service.ts:156-169`

**Claim.** The worker mints `iss: env.WORKER_URL` (`:132`) but its own verification never pins it:
`verifyJWT` calls `sharedVerifyJWTSignatureOnly(token, secret)` with no `VerifyJWTOptions`, and no
`aud` is minted at all — so `GET /auth/me` accepts any well-formed HS256 token signed with
`JWT_SECRET`, whatever its issuer or intended audience.

**Failing input → wrong outcome.** Latent today (this worker is the only minter — the grep for
`JWT_SECRET` across `apps/*/src` shows no second `signPayload`/`hmacSign` caller). It becomes real
the moment the secret is reused for a second token kind: `@xivdyetools/auth`'s `verifyJWT` already
supports `issuer`/`audience`/`expectedType` and none of the three is used.

```ts
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const payload = await sharedVerifyJWTSignatureOnly(token, secret);   // no issuer/audience options
  if (!payload) throw new Error('Invalid JWT');
  if (payload.exp < now) throw new Error('JWT has expired');
```

**Covered by test:** no (`jwt-service.test.ts` asserts the claims minted, never that a foreign `iss`
is rejected).
**Fix.** Mint an `aud` and verify with `{ issuer: env.WORKER_URL, audience: … }` here and in
presets-api, so the claim pair is enforced rather than decorative.

---

## 3. POSITIVE — do not re-file

- **One redirect allowlist, three consumers.** `getAllowedRedirectOrigins` backs CORS
  (`index.ts:106`), the authorize step (`oauth-flow.ts:110`) and the GET bounce (`:220`); the
  BUG-018 divergence is gone and `oauth-constants.test.ts` + `index.test.ts:78` pin the beta origin.
- **Redirect-URI hardening holds against the usual bypasses.** `validateRedirectUri` compares
  WHATWG `origin` and pins path/`search`/`hash`, so trailing-dot hosts, `userinfo@`, backslash and
  path-swap variants all fail (verified by hand against `oauth-validation.test.ts:26-60`).
- **PKCE is enforced by this worker, not delegated.** `verifyPkceStateBinding` recomputes
  `S256(code_verifier)` against the signed challenge *before* either provider is called, state is
  mandatory on both POST legs, and the provider marker is checked there.
- **Rate-limit prefix shadowing stays fixed.** `getOAuthLimit` sorts keys longest-first and
  `rate-limit.test.ts:61` asserts `/auth/xivauth/callback` gets 20, not 10; the native binding tiers
  in `wrangler.toml` are pinned by `wrangler-config.test.ts:76`.
- **Env validation runs per request, not per isolate** (`index.ts:56-78`; only the *logging* latches),
  production additionally requires `RL_AUTH_*` + `TOKEN_BLACKLIST`, and `ENVIRONMENT` is restricted
  to the two labels wrangler defines — no regression of FINDING-029 / BUG-017.
- **No cookies, no session state:** tokens are returned in JSON bodies only, so the cookie-attribute
  class (`HttpOnly`/`SameSite`/domain) does not apply here; `Cache-Control: no-store` + `Pragma` are
  set on every response including `/health`.
- **Provider error bodies are development-only** on both token-exchange paths
  (`callback.ts:152-159`, `xivauth.ts:173-183`), and every XIVAuth log line is identifier-free.
- **Schema/migration pair is consistent** (`users.sql` has no `avatar_url`/`xivauth_characters`,
  `0001` drops both) and `schema.test.ts` strips `--` comments before asserting, so the gate cannot
  pass on prose.

## 4. REJECTED

- *State replay / no single-use store.* State is stateless HMAC with a 10-minute `exp`; replaying it
  needs the matching `code_verifier` (never transmitted) and a still-unspent provider code. No KV
  read-after-write assumption exists because state is never stored.
- *JWT ↔ state signing-key confusion.* Both use `JWT_SECRET`, but the signed message spaces are
  disjoint: JWT signs `b64url(header).b64url(payload)` (contains `.`), state signs `b64url(json)`
  (base64url only, never `.`), and the verifiers require exactly 3 vs exactly 2 dot-separated parts.
- *XIVAuth merge lets a foreign XIVAuth id attach to a Discord-owned row* (`user-service.ts:75`,
  step-2 lookup by `discord_id`). This is the documented anchor rule and requires XIVAuth to assert a
  Discord link it verified upstream; the "two existing local rows" case is refused at `:164`.
- *`Retry-After: 0` at a rate-limit period boundary* (`index.ts:200` recomputes instead of using
  `result.retryAfter`). Requires a sub-millisecond coincidence; cosmetic.
- *`parseInt(env.JWT_EXPIRY, 10) || 3600`* — `validateEnv:89-94` already rejects non-positive and
  non-numeric values, and the `|| 3600` fallback is a safe default, not a silent NaN.
- *`getClientIp` returning `'unknown'`* — collapses all IPs into one bucket only when
  `CF-Connecting-IP` is absent, which Cloudflare always sets on the routed custom domains;
  `X-Forwarded-For` is correctly not trusted.
- *`jsonDepthLimit` off-by-one* — `depth > maxDepth` admits 11 levels rather than 10; the cap is a
  CPU guard, not a contract, and 11 is as safe as 10.
- *`OAUTH_LIMITS['/auth/refresh']` is dead* (the endpoint was removed in FINDING-003). It lives in
  `@xivdyetools/worker-kit` and costs nothing; the 2026-09-01 dead-code audit is closed.
- *Negative CORS assertions* (`index.test.ts:57`, `:86`, `:114`) use `.not.toBe(origin)`. Weaker than
  `toBeNull()`, but they *can* fail if the worker echoed the origin, so not vacuous.
- *`GET /` leaking `ENVIRONMENT`* — the value is `production`/`development`, already implied by the
  hostname.

## 5. COVERED — 24 files read

Source (17, all non-test files in scope): `src/index.ts`, `src/types.ts`, `src/constants/oauth.ts`,
`src/handlers/authorize.ts`, `src/handlers/oauth-flow.ts`, `src/handlers/callback.ts`,
`src/handlers/xivauth.ts`, `src/handlers/token.ts`, `src/services/jwt-service.ts`,
`src/services/user-service.ts`, `src/services/rate-limit.ts`, `src/utils/state-signing.ts`,
`src/utils/pkce-binding.ts`, `src/utils/oauth-validation.ts`, `src/utils/env-validation.ts`,
`src/middleware/body-validation.ts`, `vitest.config.ts`.

Config / data (4): `wrangler.toml`, `package.json`, `schema/users.sql`,
`migrations/0001_drop_xivauth_characters.sql`.

Tests skimmed (13): `__tests__/mocks/cloudflare-test.ts`, `callback.test.ts`, `xivauth.test.ts`,
`token.test.ts`, `index.test.ts`, `authorize.test.ts`, `user-service.test.ts`, `rate-limit.test.ts`,
`rate-limit-binding.test.ts`, `body-validation.test.ts`, `oauth-validation.test.ts`,
`schema.test.ts`, `wrangler-config.test.ts` (plus name-level scan of `jwt-service.test.ts`,
`middleware.test.ts`, `env-validation.test.ts`, `oauth-constants.test.ts`).

Cross-unit reads used to confirm claims (7): `packages/auth/src/jwt.ts`,
`packages/auth/src/hmac.ts`, `packages/auth/src/revocation.ts`, `packages/auth/src/encoding/base64.ts`,
`packages/worker-kit/src/rate-limiter/presets/configs.ts`,
`packages/worker-kit/src/rate-limiter/backends/cloudflare.ts`,
`packages/worker-kit/src/rate-limiter/backends/memory.ts`, `packages/worker-kit/src/rate-limiter/ip.ts`,
`packages/types/src/auth/jwt.ts`, `apps/web-app/src/services/auth-service.ts` (OAuth initiation only).
