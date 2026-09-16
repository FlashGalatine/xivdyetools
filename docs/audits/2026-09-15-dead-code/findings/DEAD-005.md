# DEAD-005: BaseComponent.setStyle — 7 source lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Unused Export

## Location
- `apps/web-app/src/components/base-component.ts:703–709`.

## Evidence
- Only the base declaration matches. No subclass override, inherited call, computed invocation or prototype access was found.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete setStyle and its JSDoc. Keep actual DOM styling and component lifecycle tests.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` plus `pnpm --filter xivdyetools-web-app run build:check`.

## Status
DONE — removed in `2d1695af` (2026-09-16, branch cleanup/dead-code-2026-09-15).
