# DEAD-011: Header helper cascade — 36 source + 139 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** moderation-worker · **Semver:** NONE · **Category:** Dead Path

## Location
- `apps/moderation-worker/src/utils/url-sanitizer.ts:68–75,135–162`.

## Evidence
- The only production-code references to sanitizeHeaders are inside DEAD-010; SENSITIVE_HEADERS is local to that helper. This is a conditional removal, not an independently unreachable helper today.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE WITH CAUTION** — After DEAD-010 has landed and passed its gate, re-grep; delete sanitizeHeaders, SENSITIVE_HEADERS and their JSDoc, plus only url-sanitizer.test.ts:154–292 and its import. Keep the sanitizeErrorMessage block beginning at :294.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker`.

## Status
OPEN — recommendation only; no source change made.
