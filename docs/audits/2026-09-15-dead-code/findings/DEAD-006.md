# DEAD-006: EmptyState.setOptions — 4 source + 39 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Test-only

## Location
- `apps/web-app/src/components/empty-state.ts:215–218`.

## Evidence
- Only its dedicated setOptions tests call it. Production passes options at construction; the @testonly reason describes unused reconfiguration behavior, not test isolation.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete setOptions/JSDoc and only the setOptions describe block at components/__tests__/empty-state.test.ts:252–290; retain constructor/render/action tests.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` plus `pnpm --filter xivdyetools-web-app run build:check`.

## Status
DONE — removed in `2d1695af` (2026-09-16, branch cleanup/dead-code-2026-09-15).
