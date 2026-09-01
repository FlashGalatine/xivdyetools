# FINDING-003: `/auth/refresh` has no client yet keeps a stolen token re-mintable for 30 days and escapes the victim's logout (residual of 2026-08-21/FINDING-001)
**Severity:** MEDIUM · **Exposure:** INTERNET-AUTH (needs a copied token) · **Deploy unit:** oauth · **Rotation:** NONE · **CWE:** CWE-613 (insufficient session expiration)

## Location
- `apps/oauth/src/handlers/refresh.ts:74-110` — an expired token is accepted on signature alone for `REFRESH_GRACE_SECONDS` past `exp`
- `apps/oauth/src/handlers/refresh.ts:155-182` — the new token is minted from the **old token's claims** (not the user row); `orig_iat` bounds the chain at 30 days; only the presented `jti` is revoked

## Evidence
- `git ls-files 'apps/*/src/*.ts' | xargs grep -n 'auth/refresh'` → no caller outside oauth's own files; the web app never refreshes (it signs in again), so the endpoint serves only whoever holds a copied token.
- Chain: attacker refreshes every ≤ 75 min → victim's `/auth/revoke` blacklists only the `jti` the victim holds → attacker's chain survives up to 30 days; there is no revoke-all-for-user and no reuse detection.
- 2026-08-21 FINDING-001 recommendation 3 (shorten/remove refresh) was not executed and is absent from `docs/operations/POST_MERGE_CHECKLIST.md` §5.

## Fix
- Remove `/auth/refresh` (no consumer). If kept: require a still-valid token, re-read the user row, add a per-user revocation epoch checked by presets-api, and cut the grace window to minutes.

## Status
FIXED 2026-08-30 50c283b9 (oauth 3.0.0) — `/auth/refresh` removed (404 even for a valid token; the token router is now `handlers/token.ts` with `/auth/me` + `/auth/revoke` unchanged); the revocation blacklist TTL still outlives `exp` by `REFRESH_GRACE_SECONDS` as clock-skew margin. No client ever called the endpoint.
