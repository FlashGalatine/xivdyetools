# DEAD-008: getPreference single-key reader — 11 source + 23 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** discord-worker · **Semver:** NONE · **Category:** Test-only

## Location
- `apps/discord-worker/src/services/preferences.ts:156–166`.

## Evidence
- Executable consumers are confined to preferences.exhaustive.test.ts. Production uses getUserPreferences; the local @testonly note explicitly identifies a deletion candidate.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete getPreference/JSDoc and its test import/describe block at preferences.exhaustive.test.ts:338–360. Retain whole-preference and default-value tests.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker`.

## Status
DONE — removed in `4f4e5c13` (2026-09-16, branch cleanup/dead-code-2026-09-15).
