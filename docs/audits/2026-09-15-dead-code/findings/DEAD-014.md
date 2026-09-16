# DEAD-014: duplicateResponse — 3 source + 9 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** presets-api · **Semver:** NONE · **Category:** Test-only

## Location
- `apps/presets-api/src/utils/api-response.ts:174–176`.

## Evidence
- Its only executable caller is the dedicated response test; live duplicate-conflict handlers construct their responses inline.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete duplicateResponse/JSDoc and only its import/test at tests/utils/api-response.test.ts:131–139. Preserve errorResponse and handler-level conflict tests.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api`.

## Status
DONE — removed in `8f7b292b` (2026-09-16, branch cleanup/dead-code-2026-09-15).
