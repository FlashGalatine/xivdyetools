# DEAD-015: VoteRow orphan type — 5 source + 9 test lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** presets-api · **Semver:** NONE · **Category:** Unused Type

## Location
- `apps/presets-api/src/types.ts:188–192`.

## Evidence
- Only tests/types.test.ts constructs the type; no D1 query or runtime source imports it. The test asserts a property it just placed in its own literal.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete VoteRow, its test import and tests/types.test.ts:318–326. Preserve actual votes schema, queries, adjacent row types and route tests.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api`.

## Status
OPEN — recommendation only; no source change made.
