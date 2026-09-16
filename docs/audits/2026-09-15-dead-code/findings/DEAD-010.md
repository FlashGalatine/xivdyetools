# DEAD-010: Unused fetch logging wrappers — 29 source + 124 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** moderation-worker · **Semver:** NONE · **Category:** Test-only

## Location
- `apps/moderation-worker/src/utils/url-sanitizer.ts:233–248,273–285`.

## Evidence
- sanitizeFetchRequest/sanitizeFetchResponse have no production callers; declaration, example and dedicated test matches account for all references.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete both fetch wrappers/JSDoc and their test blocks at url-sanitizer.test.ts:337–390,392–461. Keep sanitizeUrl/sanitizeErrorMessage and initially keep sanitizeHeaders for DEAD-011.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker`.

## Status
OPEN — recommendation only; no source change made.
