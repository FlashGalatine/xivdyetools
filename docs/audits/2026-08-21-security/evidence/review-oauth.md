# Manual security review — `apps/oauth` (xivdyetools-oauth 2.6.0) + `packages/auth` JWT/HMAC

- **Reviewer:** Claude Code (Fable 5), read-only manual review
- **Date:** 2026-08-21
- **Scope:** every non-test source file under `apps/oauth/src`, `apps/oauth/wrangler.toml`, `apps/oauth/schema/users.sql`, the `packages/auth/src` primitives the worker uses (jwt, hmac, revocation, timing, encoding), the `packages/worker-kit` middleware/rate-limiter code it mounts, and — for the OAuth flow contract only — `apps/web-app/src/services/auth-service.ts` and `apps/presets-api/src/middleware/auth.ts` (the JWT consumer). Tests were read for intent only.
- **Method:** full read of each file, call-path tracing for every checklist item, Hono 4.13.1 `cors`/`bodyLimit` dist read to confirm middleware semantics, and five read-only HTTPS probes of the hostnames named in config (results in OAUTH-6).
- **Nothing was modified.**

Severity key: CRITICAL / HIGH / MEDIUM / LOW / INFO. Confidence: CONFIRMED = full path traced, no guard found; PLAUSIBLE = likely, some runtime behaviour unverified.

---

## Summary table

| ID | Severity | Confidence | Location | Title |
|----|----------|------------|----------|-------|
| OAUTH-1 | HIGH | CONFIRMED | `packages/auth/src/revocation.ts:59-61`, `apps/oauth/src/handlers/refresh.ts:66-115,169-173,271-291` | Revocation TTL ends at `exp`, but `/auth/refresh` accepts tokens for 24 h after `exp` — revoked/expired tokens can be refreshed into new valid tokens (logout bypass) |
| OAUTH-2 | MEDIUM | CONFIRMED | `apps/presets-api/src/middleware/auth.ts:71-84,210-233` (contract gap owned by oauth) | The JWT consumer never consults the `TOKEN_BLACKLIST`; revocation only affects `/auth/me` and `/auth/refresh`, so logout does not end API access |
| OAUTH-3 | MEDIUM | CONFIRMED | `apps/oauth/src/handlers/refresh.ts:26,35-191` | `/auth/refresh` is unused by the only client yet lets any leaked token be kept alive for 30 days; no token-reuse detection and no per-user/session revocation |
| OAUTH-4 | LOW | PLAUSIBLE | `apps/oauth/src/utils/oauth-validation.ts:48-67`, `apps/oauth/src/handlers/oauth-flow.ts:100-125,182-199` | `redirect_uri` is validated by origin only (any path on an allowlisted origin), `return_path`/`state` are accepted unvalidated and unbounded server-side |
| OAUTH-5 | LOW | PLAUSIBLE | `apps/oauth/src/handlers/oauth-flow.ts:117-125`, `apps/oauth/src/handlers/callback.ts:73-121`, `apps/oauth/src/handlers/xivauth.ts:93-131` | The worker never binds `code_verifier` to the `code_challenge` it received; PKCE enforcement is delegated entirely to Discord/XIVAuth |
| OAUTH-6 | LOW | CONFIRMED (config), not currently deployed | `apps/oauth/wrangler.toml:27-47`, `apps/oauth/src/index.ts:44-65,132-135` | `[env.preview]` is a second issuer wired to **production** D1 + KV with a stale pages.dev FRONTEND_URL, and every "fail closed" gate keys on `ENVIRONMENT === 'production'` so preview fails open; README documents the opposite |
| OAUTH-7 | LOW | CONFIRMED | `apps/oauth/src/handlers/xivauth.ts:134-139,153-159,191-197,226-233,276-281` | Production `console.log` of XIVAuth user id, linked Discord id, username, character name, response key lists and raw upstream error bodies |
| OAUTH-8 | LOW | PLAUSIBLE | `apps/oauth/src/handlers/xivauth.ts:269-274,305-323`; consumer `apps/presets-api/src/middleware/auth.ts:215-216` | Unverified XIVAuth character registrations become `username`/`global_name` (the preset author name) — character-name impersonation |
| OAUTH-9 | LOW | PLAUSIBLE | `apps/oauth/src/services/user-service.ts:57-93`, `apps/oauth/src/handlers/xivauth.ts:263-267,284-290` | Account merge is driven solely by the XIVAuth-asserted Discord link: destructive row delete, stale `xivauth_id` on re-link, and `discord_id` (→ presets identity and moderator status) inherited from an upstream claim |
| OAUTH-10 | INFO | — | `apps/oauth/src/services/jwt-service.ts:118-142`, `packages/auth/src/jwt.ts:173-202` | No `aud`, `iss` never verified by any consumer; single shared HS256 secret across oauth + presets-api (any holder can mint) |
| OAUTH-11 | INFO | — | `apps/oauth/src/utils/state-signing.ts:35-41`, `apps/oauth/src/handlers/oauth-flow.ts:128,172` | `JWT_SECRET` reused for OAuth-state HMAC (formats are structurally disjoint; no cross-protocol forgery found) |
| OAUTH-12 | INFO | — | `apps/oauth/src/handlers/oauth-flow.ts:153-202` | Signed state is not single-use and its `provider` claim is never checked against the callback it is presented to |
| OAUTH-13 | INFO | — | `apps/oauth/src/index.ts:126-136`; token responses in `callback.ts:208-220`, `xivauth.ts:316-335`, `refresh.ts:175-179,223-232` | No `Cache-Control: no-store` / `Pragma: no-cache` on token-bearing responses (RFC 6749 §5.1) |
| OAUTH-14 | INFO | — | `apps/oauth/src/middleware/body-validation.ts:20-35,49-52` | `bodyLimit` trusts `Content-Length` when present (comment says it checks the stream); `jsonDepthLimit` is skipped for non-JSON content types while handlers `c.req.json()` anyway |
| OAUTH-15 | INFO | — | `apps/oauth/src/index.ts:116-121` | `credentials: true` is unnecessary (bearer-header auth, no cookies) and Hono emits `Access-Control-Allow-Credentials: true` even for disallowed origins |
| OAUTH-16 | INFO | — | `apps/oauth/src/handlers/refresh.ts:230,233-243,311-320` | `/auth/me` builds `avatar_url` from `sub` (internal UUID, wrong id); `/auth/me` and `/auth/revoke` echo `err.message` (internal strings only today) |
| OAUTH-17 | INFO | — | `apps/oauth/src/utils/env-validation.ts:52-57` | `JWT_SECRET` minimum is 32 *characters*, not 32 bytes of entropy (a 32-hex-char secret = 128 bits passes) |
| OAUTH-18 | INFO | — | `apps/oauth/src/index.ts:149-175`, `packages/worker-kit/src/rate-limiter/backends/kv.ts:12-21,161-180` | Rate limiting is per-IP only, KV best-effort/eventually-consistent, fail-open; OPTIONS preflights consume budget; no per-subject limit on `/auth/refresh` |

Positive controls verified: **17** (section after the findings).

---

## Findings

### OAUTH-1 — Revoked / expired tokens can be refreshed: blacklist TTL ends at `exp`, refresh grace extends 24 h past `exp`

- **Severity:** HIGH — deterministic bypass of the only revocation mechanism; precondition is possession of any copy of a user's JWT (even one already expired for up to 24 h), after which `/auth/revoke` (logout) cannot stop the attacker minting fresh 1-hour tokens for up to 30 days from the original login.
- **CWE:** CWE-613 (Insufficient Session Expiration), CWE-672 (Operation on a Resource after Expiration or Release)
- **Confidence:** CONFIRMED

**Where**

`packages/auth/src/revocation.ts:51-66`
```ts
export async function revokeToken(jti, expiresAt, store) {
  ...
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(expiresAt - now, 60); // Minimum 60 seconds
    await store.put(`revoked:${jti}`, '1', { expirationTtl: ttl });
```

`apps/oauth/src/handlers/refresh.ts:66-101` (grace window) and `:103-115` (blacklist check):
```ts
    } catch {
      const decoded = await verifyJWTSignatureOnly(token, c.env.JWT_SECRET);
      ...
      const gracePeriod = 24 * 60 * 60; // 24 hours
      if (decoded.exp + gracePeriod < now) { ... 401 ... }
      payload = decoded;
    }
    if (payload.jti && c.env.TOKEN_BLACKLIST) {
      const wasRevoked = await isTokenRevoked(payload.jti, c.env.TOKEN_BLACKLIST);
```

`apps/oauth/src/handlers/refresh.ts:169-173` (rotation revoke uses the OLD token's `exp` → for an already-expired token the entry lives 60 s) and `:271-291` (`/auth/revoke` uses `verifyJWTSignatureOnly`, so an expired token is accepted and blacklisted for only 60 s).

Web-app contract that makes path B routine: `apps/web-app/src/services/auth-service.ts:563-573` — `isAuthenticated()` calls `logout()` as soon as `expiresAt < now`, and `logout()` (`:691-706`) POSTs the *already expired* token to `/auth/revoke`.

**Exploit**

1. Attacker obtains a copy of victim token `T` (jti `J`, exp `E`) — via XSS on any allowed origin, a leaked log, a shared machine, a browser extension, etc.
2. Path A: victim logs out at `L < E` → KV `revoked:J` written with TTL `E-L`. At `E+δ` (δ ≤ 24 h) the entry has expired (Cloudflare KV returns `null` for expired keys). Attacker `POST /auth/refresh {"token":"T"}` → `verifyJWT` throws (expired) → signature-only path passes → grace check passes → `isTokenRevoked(J)` = false → `findUserById` ok → a new token `T2` with a fresh `jti` is minted and returned; chain continues until `orig_iat + 30d`.
3. Path B: the web-app itself revokes an expired token at logout → blacklisted for 60 s only → same replay after 60 s.
4. Path C (reuse): after a legitimate refresh the old token is revoked with TTL anchored to its old `exp`; once that lapses (or after 60 s if already expired) the same old token can be refreshed *again*, producing a second, parallel chain — so there is also no effective rotation.

**Fix**

- `revokeToken` TTL must cover the whole window in which the token could still be *used*: `ttl = max((exp + REFRESH_GRACE_SECONDS) - now, 60)` (export the grace constant from one place). For tokens presented to `/auth/refresh`, revoke the old `jti` for `exp + grace - now` as well.
- Better: make the refresh path reject any token whose `exp < now` unless a separate, opaque, single-use refresh token is presented (or drop the grace window entirely — see OAUTH-3).
- Add a regression test: revoke → advance clock past `exp` → refresh must still be 401.

---

### OAUTH-2 — Revocation blacklist is not consulted by the JWT consumer; logout does not end API access

- **Severity:** MEDIUM — revocation (and thus logout) is effective only for `/auth/me` and `/auth/refresh`; every `presets-api` call keeps accepting a revoked token until `exp` (≤ 1 h). Listed here because it is the oauth worker's contract that is silently broken; presets-api internals are another reviewer's scope.
- **CWE:** CWE-613
- **Confidence:** CONFIRMED

**Where**

`apps/presets-api/src/middleware/auth.ts:71-84` — `verifyJWT` wraps only `sharedVerifyJWT(token, secret)` (signature + `exp` + `sub`); there is no `isTokenRevoked` call and no `TOKEN_BLACKLIST` reference anywhere in `apps/presets-api/src`.

Contract claims that are therefore false: `apps/oauth/src/handlers/refresh.ts:253-254` (“Token will be rejected by /auth/me and other endpoints until it expires naturally”) and `apps/oauth/README.md` “Revocation is a KV-backed jti blacklist … ” (no caveat that the API does not check it). The web-app’s localStorage rationale (`auth-service.ts:70-76`) lists “Server-side token revocation on logout” as a mitigation.

**Exploit**

Victim logs out (token revoked). Anyone holding the token keeps full presets-api access (create/vote/edit, moderator actions if the user is a moderator) for the remaining lifetime (up to 1 h) — and, combined with OAUTH-1, indefinitely via refresh.

**Fix**

Either bind `TOKEN_BLACKLIST` into presets-api and call `isTokenRevoked(payload.jti, kv)` in its auth middleware (fail-open semantics are already documented), or shorten `JWT_EXPIRY` substantially and document revocation as oauth-local only. Correct the comments/README either way.

---

### OAUTH-3 — `/auth/refresh` is dead weight for the legitimate client but a 30-day persistence primitive for an attacker; no reuse detection, no per-user revocation

- **Severity:** MEDIUM — `apps/web-app` never calls `/auth/refresh` (only `/auth/revoke`, `auth-service.ts:697`), so the endpoint adds no user value today, yet it turns any leaked 1-hour token into up to 30 days of access with no way for the victim (or an operator, short of rotating `JWT_SECRET`) to cut the chain.
- **CWE:** CWE-613, CWE-384 (Session Fixation-like persistence), CWE-287
- **Confidence:** CONFIRMED

**Where**

`apps/oauth/src/handlers/refresh.ts:26` (`MAX_SESSION_SECONDS = 30 days`), `:146-173` (new `jti` minted before the old one is revoked; no record of the chain; nothing keyed by `sub`).

**Exploit**

Attacker with token `T` refreshes every < 25 h. Each refresh succeeds independently of anything the victim does (OAUTH-1 removes the only obstacle). Two parties refreshing the same `T` concurrently both succeed (no atomicity, no reuse detection), so theft is never detected. There is no "revoke all sessions for user X" operation.

**Fix**

- Short term: disable/feature-flag `/auth/refresh` until the web-app actually uses it; or drop the 24 h grace (refresh only *unexpired* tokens) so a stolen token is worthless after 1 h of inactivity.
- If kept: implement rotation with reuse detection (store `jti` → `next_jti`; presenting a consumed `jti` revokes the whole chain) and a per-user cut-off (`revoked-user:<sub>` = timestamp; reject tokens with `orig_iat` ≤ cut-off) exposed as "log out everywhere".
- Per-subject rate limit on `/auth/refresh` (today only per-IP).

---

### OAUTH-4 — `redirect_uri` is origin-matched only; path is attacker-chosen; `return_path` / `state` unvalidated and unbounded

- **Severity:** LOW — no open redirect to a foreign origin exists (origin match is exact and robust), but any path on an allowlisted origin can receive the `?code=…&csrf=…` bounce, so the scheme's safety rests on the SPA never leaking its URL. Standard guidance (RFC 8252 §8.4 / OAuth 2.1) is exact redirect-URI match.
- **CWE:** CWE-601 (partial), CWE-20
- **Confidence:** PLAUSIBLE (leak vector on the SPA not demonstrated; web-app sets `Referrer-Policy: strict-origin-when-cross-origin`, CSP `connect-src` is restricted, and `_redirects` is only the SPA catch-all, so no server-side open redirect was found)

**Where**

`apps/oauth/src/utils/oauth-validation.ts:56-62`
```ts
  const isAllowed = allowedOrigins.some((allowed) => {
    try { return new URL(allowed).origin === parsedUri.origin; } catch { return false; }
  });
```
`apps/oauth/src/handlers/oauth-flow.ts:101` (`finalRedirectUri = redirect_uri || …/auth/callback`), `:121` (`return_path: return_path || '/'` — no length/shape check), `:118` (`csrf: state || crypto.randomUUID()` — attacker-chosen, unbounded), `:192-199` (code, csrf, return_path appended to whatever path the state carries).

Tested parser edge cases against `validateRedirectUri`: `https://xivdyetools.app.evil.com` (different origin → rejected), `//evil.com` (no base → throws → rejected), `https://xivdyetools.app@evil.com` (origin = evil.com → rejected), `https://xivdyetools.app\@evil.com` (WHATWG turns `\` into `/` → host stays xivdyetools.app → allowed, benign), `javascript:alert(1)` (origin `null` → rejected), different port → rejected. Origin check is sound.

**Exploit (theoretical)**

Attacker starts a flow with *their own* `code_challenge` and `redirect_uri=https://xivdyetools.app/<any path>?…`, lures the victim through Discord consent; the victim's code lands on the chosen path. If that page ever leaked its query string (third-party Referer with a laxer policy, an analytics beacon, an open redirect added later), the attacker — who holds the matching verifier — exchanges it for the victim's JWT. Today the SPA's headers make this non-exploitable.

**Fix**

Require `redirect_uri` to equal `${origin}/auth/callback` exactly (origin from allowlist); cap `return_path` (≤ 512 chars, must start with `/`, reject `//` and `\`) and `state` (≤ 256 chars) before embedding them in the signed blob.

---

### OAUTH-5 — PKCE verifier is never bound to the challenge by the worker

- **Severity:** LOW — the worker receives `code_challenge` at authorize time and stores it in the signed state "for logging/debugging only", then accepts any RFC-7636-shaped `code_verifier` at the POST callback and forwards it. Correctness depends on Discord/XIVAuth enforcing PKCE for this (confidential, `client_secret`-bearing) client. If either provider treats PKCE as optional when a client secret is supplied, a captured code alone would suffice.
- **CWE:** CWE-287, CWE-345
- **Confidence:** PLAUSIBLE (provider behaviour not verified at runtime; Doorkeeper-based XIVAuth enforces PKCE once a challenge is stored; Discord documents PKCE support but its behaviour for secret-bearing clients was not verified)

**Where**

`apps/oauth/src/handlers/oauth-flow.ts:117-119`
```ts
    const stateData = {
      csrf: state || crypto.randomUUID(),
      code_challenge, // Stored for logging/debugging only
```
`apps/oauth/src/handlers/callback.ts:73-85` / `xivauth.ts:93-104` (format regex only), then `callback.ts:105-121` / `xivauth.ts:107-131` forward `code_verifier` to the provider. The POST body (`callback.ts:47`) does not even carry the state, so the worker has nothing to compare against.

**Fix**

Have the SPA POST the signed `state` alongside `code` + `code_verifier`; the worker verifies the state signature/expiry, then requires `base64url(SHA-256(code_verifier)) === state.code_challenge` before calling the provider. This makes PKCE hold regardless of provider behaviour and also gives the worker a real single-use handle (mark `state.csrf` consumed in KV).

---

### OAUTH-6 — Preview environment is a second production-grade issuer wired to production data with fail-open gates and a stale frontend origin

- **Severity:** LOW today (not a live surface: `auth-preview.xivdyetools.app` did **not resolve** on 2026-08-21; `v4-ui-migration.xiv-colorexplorer.pages.dev` **is live**, serving a stale web-app build — it is a branch alias of the owner's production Pages project, so not hijackable while that project exists). Becomes MEDIUM the moment someone runs `wrangler deploy --env preview`.
- **CWE:** CWE-1188 (Insecure Default Initialization), CWE-16
- **Confidence:** CONFIRMED (configuration), runtime exposure verified absent

**Where**

`apps/oauth/wrangler.toml:27-47` — `[env.preview]` binds `TOKEN_BLACKLIST` id `0d6f3be3…` and D1 `6e97b759…`, **identical to the production bindings at :49-61**, with `FRONTEND_URL = "https://v4-ui-migration.xiv-colorexplorer.pages.dev"`. `apps/oauth/README.md` ("The preview and development environments carry their own KV namespace and D1 database … so they do not share user state with production") contradicts the toml.

`apps/oauth/src/index.ts:44-65` — env validation only fails requests when `ENVIRONMENT === 'production'`; `:132-135` HSTS only for production. So a preview deploy with a weak/short `JWT_SECRET`, `http://` URLs, or a bad client id keeps serving (signing itself would still throw at `hmac.ts:95-98`, but everything else fails open). `oauth-flow.ts:171` correctly limits unsigned states to `development`.

If preview were deployed with the same `JWT_SECRET` as production (the rotation runbook `docs/operations/SECRET_ROTATION.md` only speaks of oauth + presets-api, so a copy-paste is likely), preview-minted JWTs are valid on production `/auth/me` and presets-api, the stale pages.dev build becomes an allowed CORS + redirect origin for a worker that reads/writes production users, and the shared `rl:` rate-limit keys let preview traffic burn production per-IP budgets.

**Fix**

Delete `[env.preview]` or re-point it at dedicated D1/KV and the real beta origin (`https://beta.xivdyetools.app`, which already uses the production worker by design); flip the gates to `ENVIRONMENT !== 'development'`; fix the README.

---

### OAUTH-7 — PII and upstream error bodies logged in production

- **Severity:** LOW — no tokens, codes, secrets or `Authorization` values are logged anywhere (verified), but Workers logs receive Discord/XIVAuth user identifiers and raw upstream error bodies on every XIVAuth login.
- **CWE:** CWE-532
- **Confidence:** CONFIRMED

**Where** (`apps/oauth/src/handlers/xivauth.ts`)
- `:134-139` — failed token exchange logs `error: errorData` (upstream body) regardless of environment (Discord's equivalent at `callback.ts:123-130` is correctly dev-gated).
- `:153-159` — "XIVAuth token exchange successful" with scope/expiry (harmless, but noise).
- `:191-197` — user-info failure logs the upstream body.
- `:226-233` — logs `id`, `mfa_enabled`, `verified_characters`, `raw_keys`.
- `:276-281` — `console.log('Creating/updating user:', { xivauth_id, discord_id, username, primary_character })`.

Also `packages/worker-kit/src/middleware/logger.ts:144-146` logs `User-Agent` because `index.ts:39` sets `logUserAgent: true` (fine), and the logger logs `url.pathname` only — query strings (`?code=`, `?state=`) never reach logs (positive).

**Fix**

Route through the request-scoped logger (`getLogger(c)`), drop identifiers (log counts/booleans), gate the debug statements to `development`, and dev-gate upstream error bodies as the Discord path already does.

---

### OAUTH-8 — Unverified XIVAuth characters become the user's display identity

- **Severity:** LOW — display-name impersonation. `username`/`global_name` (the preset author name in presets-api) are taken from the *first* character when no verified one exists, so a user can register an unverified character named after a known player and publish as that name.
- **CWE:** CWE-345, CWE-807 (Reliance on Untrusted Inputs in a Security Decision — identity display)
- **Confidence:** PLAUSIBLE (assumes XIVAuth lets users register a character before Lodestone verification, which the `verified` flag implies)

**Where** `apps/oauth/src/handlers/xivauth.ts:269-274`
```ts
    const primaryCharacter = characters.find((ch) => ch.verified) || characters[0] || null;
    const username = primaryCharacter?.name || `XIVAuth User ${xivauthUser.id.slice(0, 8)}`;
```
`:305-314,319-323` — JWT `primary_character.verified` is carried, but `username`/`global_name` lose the flag; presets-api `auth.ts:215-216` uses `global_name || username` as author name.

**Fix**

Use only verified characters for `username`/`global_name`; fall back to the opaque "XIVAuth User …" label otherwise (or suffix " (unverified)").

---

### OAUTH-9 — Account merge driven solely by the XIVAuth-asserted Discord link; destructive and integrity-losing

- **Severity:** LOW — correct behaviour *if* XIVAuth's social link is OAuth-verified (expected; XIVAuth is out of this audit's scope). Recorded because the merge (a) deletes another user's row on an upstream claim, (b) leaves a stale `xivauth_id` after a re-link, and (c) the resulting `discord_id` claim is what presets-api keys ownership **and moderator status** on (`auth.ts:59-65,218-224`).
- **CWE:** CWE-284, CWE-639
- **Confidence:** PLAUSIBLE

**Where** `apps/oauth/src/services/user-service.ts`
- `:65-81` — when the XIVAuth-found row lacks `discord_id` but another row owns it: move characters, `DELETE FROM users WHERE id = ?` (the Discord-first user's internal id disappears; their outstanding tokens fail on refresh only).
- `:87-89` — `xivauth_id: existingUser.xivauth_id || xivauth_id` keeps the *old* XIVAuth id when a Discord account is later linked to a different XIVAuth user, so two XIVAuth accounts resolve to one internal user and the second receives a JWT carrying the first's `xivauth_id`.
- `apps/oauth/src/handlers/xivauth.ts:263-267` — `linkedDiscordId = social_identities.find(provider==='discord').external_id` with no format check (`isValidSnowflake` exists in `@xivdyetools/types` and is used for the client id, not here).

**Fix**

Validate `external_id` with `isValidSnowflake`; on conflict prefer an explicit link step (user consent) over silent merge/delete; when the XIVAuth-found row and the Discord-found row differ, update `xivauth_id` to the current user instead of keeping the stale value; log merges as audit events.

---

### INFO items (best-practice / architectural)

- **OAUTH-10 — JWT claims.** `jwt-service.ts:118-142` sets `iss = WORKER_URL` but no `aud`/`nbf`; neither the oauth wrapper (`jwt-service.ts:155-168`) nor `packages/auth/src/jwt.ts:173-202` nor presets-api check `iss`. All verification is a single shared HS256 secret (oauth + presets-api per README/CLAUDE.md), so any holder can mint. Consider ES256 (private key only in oauth) or at least `aud` + `iss` checks. No exploit without secret compromise.
- **OAUTH-11 — Key reuse.** `state-signing.ts:35-41` signs `base64url(json)` with `JWT_SECRET`; JWTs sign `header.payload`. A state blob has 2 dot-separated parts and its signing input never contains a dot; a JWT needs 3 and its input always does — no cross-format forgery found. Derive a separate key (HKDF label) anyway.
- **OAUTH-12 — State lifecycle.** `oauth-flow.ts:153-202` — the signed state is replayable for 10 min (harmless: callback only bounces a provider code) and `stateData.provider` is not compared with `config.provider` (a Discord state can be presented to `/auth/xivauth/callback`; no impact found because the SPA picks the exchange endpoint from its own sessionStorage).
- **OAUTH-13 — Cache headers.** `index.ts:126-136` adds nosniff/XFO/HSTS but token responses (`callback.ts:208-220`, `xivauth.ts:316-335`, `refresh.ts:175-179`, `/auth/me` `:223-232`) lack `Cache-Control: no-store` + `Pragma: no-cache` (RFC 6749 §5.1). Add to the header middleware for `/auth/*`.
- **OAUTH-14 — Body middleware.** `body-validation.ts:22` says bodyLimit "checks the actual stream, not just Content-Length"; Hono 4.13.1's `bodyLimit` (`dist/middleware/body-limit/index.js:17-21`) short-circuits on a present `Content-Length` (the edge enforces framing, so no practical bypass). `jsonDepthLimit` (`:49-52`) only runs for `application/json`, while handlers call `c.req.json()` regardless of content type (`callback.ts:50`, `refresh.ts:39`, `xivauth.ts:70`); the 10 KB cap bounds the damage.
- **OAUTH-15 — CORS.** `index.ts:120` `credentials: true` is not needed (no cookies; tokens travel in the `Authorization` header) and Hono sets `Access-Control-Allow-Credentials: true` unconditionally (`cors/index.js:41-43`) — harmless without an ACAO, but remove it to shrink the surface. Allowlist itself is exact-match (positive).
- **OAUTH-16 — `/auth/me` and `/auth/revoke`.** `refresh.ts:230` builds `avatar_url` from `payload.sub` (internal UUID) instead of `discord_id` — wrong URL, not a security issue. `:233-243` / `:311-320` return `err.message`; all reachable messages are internal constants ("Invalid JWT", "JWT has expired", "Token has been revoked"), no upstream text.
- **OAUTH-17 — Secret strength check.** `env-validation.ts:52-57` enforces ≥ 32 characters; a 32-hex-char value (128 bits) passes while the docs recommend `openssl rand -hex 32` (256 bits). Enforce ≥ 64 hex chars or measure bytes after hex-decoding.
- **OAUTH-18 — Rate limiting.** `index.ts:149-175` per-IP (`CF-Connecting-IP`, XFF ignored — good), KV best-effort with lost updates under concurrency and eventual consistency (`kv.ts:12-21`), fail-open on KV errors (`:161-180`), OPTIONS preflights count against the bucket, no per-`sub` limit on `/auth/refresh`. Brute force on HMAC signatures/provider codes is infeasible, so this is hardening only.

---

## Positive controls verified

1. **PKCE surface:** S256 only; `code_challenge` (`oauth-validation.ts:19-22`) and `code_verifier` (`:31-34`, `callback.ts:76-77`) format-validated; verifier only ever travels in the POST body, never in a redirect (`oauth-flow.ts:59-62`); the SPA generates both with `crypto.getRandomValues` (`auth-service.ts:784-801`).
2. **State integrity:** HMAC-SHA256 via `crypto.subtle.verify` (constant-time), `exp` required and enforced inside the primitive (`state-signing.ts:53-88`), 10-minute TTL (`constants/oauth.ts:44`); unsigned legacy states only in `development` (`oauth-flow.ts:171`).
3. **Redirect allowlist:** exact `URL.origin` comparison (`oauth-validation.ts:48-67`), one shared list for authorize, GET callback and CORS (`constants/oauth.ts:30-38`, `oauth-flow.ts:100-113,182-189`, `index.ts:93`); loopback origins stripped outside development; re-validated at callback so a state signed under a different allowlist/env is blocked ("Blocked redirect to untrusted origin", `oauth-flow.ts:186-188`).
4. **Token-exchange redirect_uri pinned** to `${WORKER_URL}/auth/callback` / `/auth/xivauth/callback`; client-supplied `redirect_uri` ignored (`callback.ts:88-103`, `xivauth.ts:113`).
5. **Upstream calls:** hard-coded `https://` endpoints, `AbortSignal.timeout` 10 s / 5 s, `scope` validated (`callback.ts:143-154`, `xivauth.ts:161-178`), required user fields validated, upstream access/refresh tokens never persisted or returned, client secrets only in server-side form bodies, Discord error bodies dev-gated.
6. **JWT hygiene:** `alg` pinned to HS256 (`packages/auth/src/jwt.ts:125`), `sub` + `exp` required (`:184-191,238-240`), WebCrypto timing-safe verify, `jti` per token, `orig_iat` 30-day absolute cap, user existence re-checked on refresh (`refresh.ts:133-144`), signature verified even for expired tokens on refresh (`:72-83`), secret ≥ 32 bytes enforced at key import (`hmac.ts:95-98`) and per request in production (`index.ts:44-65`).
7. **No identity-chosen minting:** every JWT is minted from a provider-verified identity or a validly signed prior token; `/auth/me` requires Bearer; `/auth/revoke` requires a valid signature.
8. **D1 access:** every `.prepare()` uses bound parameters; `updateUser` assembles only constant column names (`user-service.ts:163-186`); no dynamic ORDER/LIMIT; merge and character replace run as atomic `db.batch` (`:72-80,229-239`); UNIQUE-constraint races handled (`:118-148`); schema enforces partial unique indexes + CHECK (`schema/users.sql:16,20-21`).
9. **CORS:** function allowlist, exact origin string match, no `*`, preflight handled with `Vary: Origin`, localhost only in development on whitelisted ports (`index.ts:72-122`); requests without `Origin` get no ACAO.
10. **Security headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS in production (`index.ts:126-136`).
11. **Error handling:** global `onError` hides messages outside development and never returns stacks (`index.ts:239-261`); handler catch blocks return generic bodies and sanitise logs in production (`callback.ts:221-237`, `xivauth.ts:336-351`).
12. **Rate limiting** on all `/auth/*` routes, per IP from `CF-Connecting-IP` (XFF not trusted, `worker-kit/rate-limiter/ip.ts:57-68`), longest-prefix config (`presets/configs.ts:38-52`), standard headers + `Retry-After`.
13. **Body hardening:** 10 KB limit and JSON depth/prototype-pollution checks on `/auth/*` (`body-validation.ts`).
14. **Logging hygiene:** request logger records `pathname` only — no query string, so `code`/`state`/`csrf` never hit logs (`worker-kit/middleware/logger.ts:75-84`); `X-Request-ID` validated as UUID (`request-id.ts:24,61-63`); no `Authorization` header, JWT, verifier or secret is logged anywhere in the worker.
15. **Env validation** fails closed on every request in production (not just first), including HTTPS-only URLs and snowflake format for the client id (`env-validation.ts`, `index.ts:25-65`).
16. **Web-app flow contract:** state + verifier in `sessionStorage`, cleared before exchange; fail-closed `csrf` comparison (`auth-service.ts:336-356`); `return_path` sanitised client-side (`:113-152`); `Referrer-Policy: strict-origin-when-cross-origin`, strict CSP with restricted `connect-src`, `form-action 'none'` (`public/_headers:17,23`); token revoked on logout; OAuth worker URL fixed to `https://auth.xivdyetools.app` (`:55`).
17. **Secrets handling:** no secrets in `wrangler.toml` (only public client ids); `XIVAUTH_CLIENT_SECRET` optional and only sent server-side; a rotation runbook exists (`docs/operations/SECRET_ROTATION.md`).

---

## Coverage — files read in full unless noted

**apps/oauth**
- `wrangler.toml`, `schema/users.sql`, `package.json`, `CLAUDE.md`, `README.md`, `CHANGELOG.md` (head)
- `src/index.ts`, `src/types.ts`
- `src/constants/oauth.ts`
- `src/handlers/authorize.ts`, `src/handlers/oauth-flow.ts`, `src/handlers/callback.ts`, `src/handlers/refresh.ts`, `src/handlers/xivauth.ts`
- `src/middleware/body-validation.ts`
- `src/services/jwt-service.ts`, `src/services/rate-limit.ts`, `src/services/user-service.ts`
- `src/utils/env-validation.ts`, `src/utils/oauth-validation.ts`, `src/utils/state-signing.ts`
- Tests (titles/intent only): `src/__tests__/{index,authorize,callback,xivauth,refresh,jwt-service,user-service,rate-limit,middleware,env-validation,body-validation,oauth-constants}.test.ts`

**packages/auth/src** — `jwt.ts`, `hmac.ts`, `revocation.ts`, `timing.ts`, `encoding/base64.ts`, `index.ts` (`discord.ts` skipped — not used by oauth)

**packages/worker-kit/src** — `middleware/logger.ts`, `middleware/request-id.ts`, `rate-limiter/backends/kv.ts`, `rate-limiter/ip.ts`, `rate-limiter/presets/configs.ts`

**packages/types/src/auth** — `jwt.ts`, `response.ts`, `xivauth.ts`, `discord-snowflake.ts`

**Flow contract (read-only, outside unit)** — `apps/web-app/src/services/auth-service.ts` (full), `apps/web-app/public/_headers` (CSP/Referrer lines), `apps/web-app/public/_redirects`, `apps/web-app/.env.development`; `apps/presets-api/src/middleware/auth.ts` (JWT verification path, lines 1-120 and 195-260); `.github/workflows/deploy-oauth.yml` (grep); `docs/operations/DEPLOY_ENVIRONMENTS.md` and `docs/operations/SECRET_ROTATION.md` (grep excerpts)

**Third-party semantics confirmed from installed code** — `hono@4.13.1` `dist/middleware/cors/index.js`, `dist/middleware/body-limit/index.js`

**Live probes (GET only, 2026-08-21):** `https://auth.xivdyetools.app/health` → 200; `https://auth-preview.xivdyetools.app/health` → DNS does not resolve; `https://v4-ui-migration.xiv-colorexplorer.pages.dev/` → 200 (stale web-app build); `https://xivdyetools.projectgalatine.com/` → 301 to `https://xivdyetools.app/`; `https://beta.xivdyetools.app/` → 200.
