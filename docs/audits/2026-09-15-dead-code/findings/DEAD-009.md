# DEAD-009: Unbatched preset-status wrappers — 8 source + 77 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** moderation-worker · **Semver:** NONE · **Category:** Test-only

## Location
- `apps/moderation-worker/src/services/ban-service.ts:631–634,646–649`.

## Evidence
- hideUserPresets/restoreUserPresets have only test callers. Live banUser/unbanUser batch the underlying statement builders with audit-log statements; those builders remain live.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE WITH CAUTION** — Delete only the two exported wrappers/JSDoc and direct-wrapper test imports/blocks at ban-service.test.ts:662–697,699–739. Preserve batched ban/unban SQL, audit logging and security-path tests.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker`.

## Status
DONE — removed in `c6aa8c73` (2026-09-16, branch cleanup/dead-code-2026-09-15).
