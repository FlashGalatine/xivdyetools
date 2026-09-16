# DEAD-007: OfflineBanner subscription and refresh helpers — 18 source + 44 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Test-only

## Location
- `apps/web-app/src/components/offline-banner.ts:179–190,199–204`.

## Evidence
- onStatusChange and updateMessage are only called by dedicated tests. Live banner updates use its separate internal online/offline listeners; no language-change caller invokes refresh.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete both helpers/JSDoc and their describe blocks at components/__tests__/offline-banner.test.ts:303–335,341–351. Keep setupListeners, cleanup, getIsOnline and DOM visibility tests.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` plus `pnpm --filter xivdyetools-web-app run build:check`.

## Status
DONE — removed in `2d1695af` (2026-09-16, branch cleanup/dead-code-2026-09-15).
