# FINDING-015: `verifyJWT` accepts malformed claim types and has no `nbf`/`iat`/`iss`/`aud` enforcement

## Severity
**LOW** — signature/`alg` handling is correct (HS256 pinned, `alg:none` rejected, `crypto.subtle.verify`, ≥32-byte secret), so this only matters for tokens the issuer itself signs; hardening. Reviewer IDs: PKG-2, OAUTH-10.

## Category
CWE-20 Improper Input Validation · CWE-287

## Location
- `packages/auth/src/jwt.ts:173-202, 225-259` — `exp:{}`, `exp:"9999999999"`, `sub:{}`, `sub:123` pass when signed (executed by the reviewer against `dist/`); `nbf`/`iat` ignored; no `iss`/`aud` options, so consumers (presets-api `middleware/auth.ts`) cannot pin the issuer.

## Recommendation
Type-check claims (`typeof exp === 'number' && Number.isFinite`, `typeof sub === 'string'`), enforce `nbf`/`iat` with bounded skew, add `issuer`/`audience` options and use them in presets-api and oauth `/auth/me`.

## References
- RFC 7519 §4.1; Evidence: `../evidence/review-packages.md` (PKG-2)
