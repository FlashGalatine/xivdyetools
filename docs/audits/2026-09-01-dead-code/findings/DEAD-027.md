# DEAD-027: image-worker `getImageDimensions` — 27 lines exercised only by its own test

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/image-worker · **Semver:** NONE (service-binding-only worker, no public API) · **Category:** Unused Export (test-only)

## Location
- `apps/image-worker/src/photon.ts:232-258` — `getImageDimensions(buffer: Uint8Array)`

## Evidence
- `evidence/symrefs-image-worker.txt`: `prod=1 tests=5`; the five "other" hits are web-app's own same-named helper in `src/components/`, not importers.
- `git ls-files apps/image-worker | xargs grep -nw getImageDimensions` → the declaration, `photon.test.ts` (4 uses), and one CHANGELOG line listing it among the functions copied in from discord-worker during the 2026 split. It arrived with the copy and never gained a caller here.
- The live dimension checks go through `validators.ts` (`validateDimensions` at `:243`, reached from the header-reading path), which is a different code path with its own tests.

## Fix
**REMOVE** the function and its `describe('getImageDimensions')` block (`photon.test.ts:232-258`). Confirm `photon.ts` keeps its other exports' imports (it does — `loadImage`, `resizeImage`, `extractPixels`, `processImageFor*` are all live). image-worker CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-image-worker`.

## Status
FIXED 2026-09-01 `46713036`.

