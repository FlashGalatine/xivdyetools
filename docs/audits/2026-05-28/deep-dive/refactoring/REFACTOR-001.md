# [REFACTOR-001]: Consolidate the two divergent JWT verifier implementations

## Priority
HIGH

## Category
Architecture / Inappropriate duplication of a security primitive

## Location
- `apps/oauth/src/services/jwt-service.ts` — `verifyJWT`, `verifyJWTSignatureOnly`, `decodeJWT`
- `packages/auth/src/jwt.ts` — `verifyJWT`, `verifyJWTSignatureOnly`, `decodeJWT`

## Current State
Two independent JWT verifiers exist in the ecosystem:

| Behavior | `@xivdyetools/auth` (used by presets-api) | `oauth/jwt-service.ts` (issues + verifies its own) |
|----------|-------------------------------------------|----------------------------------------------------|
| Explicit `alg === 'HS256'` check | ✅ Yes | ❌ No (relies on hardcoded HMAC verify) |
| Require `sub` claim | ✅ Yes (BUG-010) | ❌ No |
| Require `exp` claim | ✅ Yes (FINDING-003) | Checks `exp < now` but tolerates missing `exp` (`payload.exp < now` is `undefined < now` → false) |
| Signature verify | `crypto.subtle.verify` | `crypto.subtle.verify` |

The crucial coupling: **oauth mints the JWTs and presets-api verifies them with the *other*
implementation.** They must remain behavior-compatible forever, yet they are maintained
separately and already differ in claim validation.

## Issues
- **Drift risk on a security boundary.** A future change to one verifier (e.g. adding an
  `alg`-dependent branch, or tightening claim checks) silently desyncs the issuer/verifier pair.
- **Documentation already disagrees with code** (oauth `CLAUDE.md` claims explicit HS256 pinning
  that the code does not do — see security FINDING-002).
- **Double the audit surface** for the single most security-sensitive operation in the system.

## Proposed Refactoring
1. Make `apps/oauth` depend on `@xivdyetools/auth` for **verification** (`verifyJWT`,
   `verifyJWTSignatureOnly`, `decodeJWT`). Token *creation* stays in oauth (the shared lib
   intentionally only verifies), but creation and verification then share the same claim contract.
2. Delete oauth's local verify/decode helpers; keep only `createJWTForUser` / `signJwtData`
   (the latter is also reused by `state-signing.ts`).
3. Ensure the shared lib's `JWTPayload` covers oauth's extra claims (`jti`, `iss`, `auth_provider`,
   `discord_id`, `xivauth_id`, `primary_character`) — extend the type if needed.
4. Add a cross-package contract test: a token minted by oauth verifies under `@xivdyetools/auth`
   and vice-versa, including the `exp`/`sub` requirements.

## Benefits
- One audited JWT verifier across the ecosystem; issuer and verifier can't drift.
- Resolves security FINDING-002 (alg pinning) for free.
- Smaller maintenance + audit surface.

## Effort Estimate
MEDIUM — touches an auth-critical path; do it behind the contract test, coordinate the oauth +
presets-api + auth version bumps in one PR.

## Risk Assessment
Medium: auth-critical. Mitigate with the contract test and a staging smoke-test of the full
login → `/auth/me` → authenticated `POST /api/v1/presets` flow before production.
