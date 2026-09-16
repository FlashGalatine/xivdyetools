# DEAD-013: truncateUnicodeSafe — 9 source + 38 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** presets-api · **Semver:** NONE · **Category:** Test-only

## Location
- `apps/presets-api/src/services/moderation-service.ts:53–61`.

## Evidence
- Only dedicated unit tests call the helper; no moderation, storage, logging, script or configuration path invokes it.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete the helper/JSDoc and its import/describe block at tests/services/moderation-service.test.ts:104–141; retain local/profanity/Perspective behavior tests.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api`.

## Status
OPEN — recommendation only; no source change made.
