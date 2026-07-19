# [REFACTOR-001]: Finish JWT consolidation onto @xivdyetools/auth (oauth still hand-rolled)

## Priority
HIGH

## Category
Architecture / Duplication (security-critical code)

## Location
- File(s): `apps/oauth/src/services/jwt-service.ts` (entire file, ~410 lines); `apps/oauth/src/handlers/refresh.ts:287-301` (`createJWTFromPayload`); `apps/oauth/package.json:16-23` (no `@xivdyetools/auth` dependency)
- Scope: module level (oauth worker JWT create/verify)

## Current State
**Prior-audit lineage:** This continues REFACTOR-001 from `docs/audits/2026-05-28/deep-dive`, which flagged that apps/oauth had a hand-rolled JWT verifier divergent from `@xivdyetools/auth` (different alg pinning). Status as of 2026-07-18: **partially resolved — aligned, not consolidated.**

- `apps/oauth/package.json` still does **not** depend on `@xivdyetools/auth`; the worker ships its own JWT implementation.
- The divergence that motivated the original finding was fixed *in place*: `verifyJWT` rejects non-HS256 (`jwt-service.ts:216-225`), `verifyJWTSignatureOnly` likewise (`jwt-service.ts:290-294`), both require `sub` (`jwt-service.ts:244-247`, `307-311`) with comments citing "REFACTOR-001: ... matches @xivdyetools/auth", and constant-time signature verification via `crypto.subtle.verify` was adopted (`jwt-service.ts:66-78`, consumed by `state-signing.ts:65`).
- `presets-api` is fully on the shared package (`apps/presets-api/src/middleware/auth.ts:10`).
- Residual duplication: **three** token-mint paths exist (`createJWT` at jwt-service.ts:88-130, `createJWTForUser` at 146-198, `createJWTFromPayload` in refresh.ts:287-301); `createJWT` and `isJWTExpired` (jwt-service.ts:321-327) are production-dead — grep confirms test-only usage (40+ test call sites).

## Issues
- Alignment is enforced only by comments — the next edit can silently diverge again. One residual gap already exists: `exp` is required by `verifyJWT` but not by `verifyJWTSignatureOnly` (see BUG-051).
- Two independent implementations of verification-critical logic across the ecosystem means every JWT hardening fix must be applied twice.
- Three mint paths and two dead exports inflate the security-review surface of the most sensitive worker.

## Proposed Refactoring
1. Add `@xivdyetools/auth` (workspace:*) to oauth.
2. Delegate `verifyJWT` / `verifyJWTSignatureOnly` to the shared implementations, keeping only the oauth-specific wrappers local (`verifyJWTWithRevocationCheck`, KV revocation helpers).
3. Collapse minting to `createJWTForUser` plus one internal `signPayload(payload, secret)` used by the refresh handler; delete `createJWTFromPayload`.
4. Delete `createJWT` and `isJWTExpired`; migrate the tests that use them to `createJWTForUser`.

## Benefits
- Single source of truth for verification-critical logic; structurally eliminates the drift class flagged in two consecutive audits.
- ~250 fewer lines of hand-rolled crypto-adjacent code in the auth worker.
- BUG-051's claim-optionality divergence disappears automatically.

## Effort Estimate
MEDIUM (the code moves are small; test migration across 40+ `createJWT` call sites is the bulk).

## Risk Assessment
LOW-MEDIUM. Token format is unchanged (HS256, same claims), so no invalidation of live sessions. Main risk is subtle behavioral differences between the shared and local verifiers (error types vs null returns) — the refresh handler's try/catch flow depends on `verifyJWT` throwing; verify the shared API's contract before swapping.

> Source: evidence/d1-workers-analysis.md (2026-07-18 deep-dive, d1-workers area)

## Status

**DONE 2026-07-19** — oauth now depends on `@xivdyetools/auth` (v1.2.0): `verifyJWT`/`verifyJWTSignatureOnly` delegate to the shared implementations (thin throwing wrapper preserved for handler flow); minting collapsed to `createJWTForUser` + one `signPayload` primitive; `createJWT`, `createJWTFromPayload`, and `isJWTExpired` deleted (tests migrated); KV revocation helpers moved into the shared package's new `revocation` module.
