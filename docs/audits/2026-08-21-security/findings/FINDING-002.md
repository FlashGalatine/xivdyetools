# FINDING-002: presets-api never consults the JWT revocation list — logout does not end API access

## Severity
**MEDIUM** — a revoked (logged-out) token keeps full read/write access to the presets API until its natural `exp` (1 h), while the web app and oauth README present server-side revocation as an effective control. Reviewer IDs: OAUTH-2, PAPI-10. Coordinator-verified.

## Category
CWE-613 Insufficient Session Expiration · OWASP A07:2021

## Location
- `apps/presets-api/src/middleware/auth.ts:71-84, 210-233` — verifies signature and `exp` only; no `TOKEN_BLACKLIST` binding exists in `apps/presets-api/wrangler.toml`; `iss` is not checked (`packages/auth/src/jwt.ts:173-202`).
- `apps/oauth/README.md:36-50` and `apps/web-app/src/services/auth-service.ts:73` describe revocation as an effective logout control.

## Description
`/auth/revoke` only influences `/auth/me` and `/auth/refresh` on the oauth worker. The one consumer that authorises user actions with the JWT (presets-api) is stateless and has no access to the blacklist KV, so revocation has no effect on what the token is actually used for.

## Evidence
```
$ grep -rn "TOKEN_BLACKLIST\|isTokenRevoked" apps/presets-api/src apps/presets-api/wrangler.toml
(no matches)
```

## Impact
The stolen-token window is the full 1 h regardless of user action; combined with FINDING-001 the user cannot shorten it at all. Documentation overstates the control.

## Recommendation
Pick one and document it:
- **Enforce**: bind the same `TOKEN_BLACKLIST` namespace into presets-api and call `isTokenRevoked(jti)` in `auth.ts` (one KV read per authenticated request; KV's ~60 s propagation is acceptable for logout semantics).
- **Accept**: keep presets-api stateless, shorten the JWT lifetime (e.g. 15 min) and correct the README / auth-service copy so logout is not presented as server-side revocation.

Also add `iss` (and optionally `aud`) verification in presets-api so tokens from any second issuer (e.g. the oauth preview env, FINDING-029) cannot be replayed.

## References
- Evidence: `../evidence/review-oauth.md` (OAUTH-2), `../evidence/review-presets-api.md` (PAPI-10)
