# DEAD-002: SavedPresetsService.isSaved — 4 source lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Unused Export

## Location
- `apps/web-app/src/services/saved-presets-service.ts:121–124`.

## Evidence
- Only the method declaration matches in tracked source/tests; the verifier found no computed or inherited call.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete isSaved and its method-specific JSDoc; preserve save/load/list behavior.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` plus `pnpm --filter xivdyetools-web-app run build:check`.

## Status
OPEN — recommendation only; no source change made.
