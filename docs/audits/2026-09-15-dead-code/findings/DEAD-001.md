# DEAD-001: IndexedDBService.getWithContext and GetResult — 36 source lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Unused Export

## Location
- `apps/web-app/src/services/indexeddb-service.ts:183–217; GetResult at :32`.

## Evidence
- Tracked-tree symbol search finds only the method declaration and its local return type. Independent verifier checked direct, computed, inherited and test references; none exists.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete getWithContext and its GetResult alias/JSDoc together; retain get, transaction handling and all live storage tests.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` plus `pnpm --filter xivdyetools-web-app run build:check`.

## Status
OPEN — recommendation only; no source change made.
