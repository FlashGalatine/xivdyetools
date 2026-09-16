# DEAD-003: ShareService.getBaseUrl — 7 source lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Unused Export

## Location
- `apps/web-app/src/services/share-service.ts:578–584`.

## Evidence
- Only its declaration remains; current share URL construction uses other paths and exposes no external class API.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete getBaseUrl and its JSDoc; retain the active share builders and share URL tests.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` plus `pnpm --filter xivdyetools-web-app run build:check`.

## Status
DONE — removed in `2d1695af` (2026-09-16, branch cleanup/dead-code-2026-09-15).
