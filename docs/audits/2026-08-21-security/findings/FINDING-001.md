# FINDING-001: Token revocation is bypassable through `/auth/refresh` — a logged-out or leaked token can be re-minted for up to 30 days

## Severity
**HIGH** — precondition: the attacker holds a copy of a user's JWT (XSS, device/browser compromise, log leakage). Once they do, the victim has **no** way to terminate the session: logout/revoke stops working the moment the original token expires, and the refresh endpoint then re-mints indefinitely (bounded only by the 30-day `orig_iat` cap). Reviewer IDs: OAUTH-1, OAUTH-3. Coordinator-verified at the cited lines.

## Category
CWE-613 Insufficient Session Expiration · CWE-384 Session Fixation (rotation not enforced) · OWASP A07:2021 Identification and Authentication Failures

## Location
- `packages/auth/src/revocation.ts:55-61` — `revokeToken()` stores `revoked:<jti>` with `expirationTtl = max(exp - now, 60)` (entry disappears at `exp`).
- `apps/oauth/src/handlers/refresh.ts:35-115` — `POST /auth/refresh` accepts a token whose signature verifies even when **expired by up to 24 h** (`gracePeriod = 24*60*60`), then checks the blacklist (entry already gone), then mints a new token.
- `apps/oauth/src/handlers/refresh.ts:169-173` — the "rotation" revoke of the *old* token reuses the same TTL (`revokeToken(payload.jti, payload.exp, …)`), i.e. **60 s** for an already-expired token.
- `apps/oauth/src/handlers/refresh.ts:26` — `MAX_SESSION_SECONDS = 30 days`.
- `apps/web-app/src/services/auth-service.ts:691-704` — the web app calls `/auth/revoke` on logout (advertised as "server-side token revocation") but **never calls `/auth/refresh`**; the endpoint is pure attack surface today.

## Description
Revocation entries live exactly as long as the token's natural lifetime, but `/auth/refresh` deliberately honours tokens for 24 hours *after* `exp`. The two windows do not overlap, so every revocation becomes ineffective at `exp`:

1. Victim logs out at T < exp → `revoked:jti` stored until `exp`.
2. At exp + 1 s … exp + 24 h the attacker POSTs the old token to `/auth/refresh`: `verifyJWT` throws (expired) → `verifyJWTSignatureOnly` succeeds → grace check passes → `isTokenRevoked` is **false** (KV entry expired) → a fresh 1 h token is issued.
3. The "rotate" step revokes the old jti for only 60 s, after which the same old token can be refreshed **again** (it stays refreshable for 24 h past its exp, and each new token restarts the cycle); `orig_iat` caps the chain at 30 days.

## Evidence
```ts
// packages/auth/src/revocation.ts
const ttl = Math.max(expiresAt - now, 60); // Minimum 60 seconds
await store.put(`revoked:${jti}`, '1', { expirationTtl: ttl });

// apps/oauth/src/handlers/refresh.ts
const gracePeriod = 24 * 60 * 60; // 24 hours
if (decoded.exp + gracePeriod < now) { /* reject */ }
…
if (payload.jti && c.env.TOKEN_BLACKLIST) {
  const wasRevoked = await isTokenRevoked(payload.jti, c.env.TOKEN_BLACKLIST); // entry already expired
```

## Impact
A stolen token that the user believes they revoked keeps working (via refresh → new token) for up to 30 days; "logout everywhere"/incident response is impossible without rotating `JWT_SECRET` for all users. Compounded by FINDING-002 (presets-api never checks the blacklist at all).

## Recommendation
1. **Blacklist TTL must cover the refresh grace window**: `ttl = max(exp + GRACE + skew − now, 60)` — centralise `GRACE` in `@xivdyetools/auth` so both sides agree.
2. On refresh, revoke the old jti for the full window, and shorten the grace period (24 h is unusually long for a 1 h token; 5–15 min covers clock skew and in-flight requests).
3. Either remove `/auth/refresh` (the web app does not use it) or implement proper rotation: new `jti` per refresh, old one blacklisted for the grace window, reuse detection (refresh of an already-rotated jti → revoke the whole chain), and a per-user "session generation" claim so a `/auth/revoke-all` can invalidate every token for a user.
4. Add a regression test: revoke → advance past `exp` → refresh must fail.

## References
- OWASP Session Management Cheat Sheet — "Session Expiration", "Renewal"
- RFC 6749 §10.4 (refresh token rotation guidance)
- Evidence: `../evidence/review-oauth.md` (OAUTH-1, OAUTH-3)
