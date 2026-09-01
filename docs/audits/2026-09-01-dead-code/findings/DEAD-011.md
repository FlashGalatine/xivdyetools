# DEAD-011: presets-api `ban-check.ts` — `checkBanStatus` and `requireNotBannedCheck` superseded by the mounted `requireNotBanned` middleware — 61 lines

**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/presets-api · **Semver:** NONE (app-internal) · **Category:** Unused Export (test-only)

## Location
- `src/middleware/ban-check.ts:131-146` `checkBanStatus` (16, "check ban status without blocking" — no caller, ever)
- `src/middleware/ban-check.ts:148-192` `requireNotBannedCheck` (45, the inline-guard form, with a usage docblock nothing follows)

## Evidence
- `evidence/symrefs-presets-api.txt`: `checkBanStatus prod=1 tests=7`; `requireNotBannedCheck prod=3 tests=4` where all three prod hits are inside `ban-check.ts` itself (the declaration plus two lines of its own docblock example).
- The live form is the middleware: `requireNotBanned` is imported by `handlers/presets.ts:18` and `handlers/votes.ts:9` and registered per router for every mutating method — the arrangement FINDING-017 (2026-08-21 security audit) deliberately put in place so no write route can forget it. The inline-guard variant is the pattern that finding replaced.
- **Not a security hole:** ban enforcement is live; only the two unused *alternatives* are dead. Both share the live `isUserBanned` + `banLookupFailure` helpers — keep those.

## Fix
**REMOVE** both exported functions and the test blocks that only exercise them; keep `isUserBanned`, `bannedResponse`, `banLookupFailure`, `requireNotBanned`. Delete the `requireNotBannedCheck` usage example from the module docblock so the next reader does not re-add it. presets-api CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api`.

## Status
FIXED 2026-09-01 `befee92c` — both removed; `requireNotBanned` and the shared fail-closed helpers untouched.

