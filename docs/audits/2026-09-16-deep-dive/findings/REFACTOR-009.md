# REFACTOR-009: `bodySizeLimit` / `jsonDepthLimit` middleware exists as two near-copies in oauth and presets-api
**Priority:** P3 · **Effort:** MEDIUM · **Risk:** LOW · **Deploy unit:** worker-kit (publish) → oauth, presets-api

## Location
- `apps/oauth/src/middleware/body-validation.ts` (115 lines, 10 KB)
- `apps/presets-api/src/middleware/body-validation.ts` (177 lines, 100 KB + the preview-image exemption)

## Evidence
- `evidence/cross-unit-dupes.txt`; `diff` shows the same `bodyLimit` wrapper with different caps, error shapes and one route exemption

## Fix
- A `bodyGuards({ maxSize, depth, exempt })` factory in worker-kit; nice-to-have — the two copies are small and deliberately different in their limits

## Status
FIXED (Sprints 13 + 14 + 16, `7d3f137f`, `3fcb5dd4`, `e75328c5`) — `bodyGuards({ maxSize, maxDepth, onTooLarge, onInvalidJson, exempt })` in `@xivdyetools/worker-kit/body-guards`; both consumers adopted it with their error bodies byte-identical and their existing middleware tests unchanged (the parity proof); presets-api's preview-image exemption (5 MB / 400, JSON check skipped) is the `exempt` option.
