# [REFACTOR-003]: Perceptual matching correctness silently bounded by magic RGB candidate thresholds

## Priority
MEDIUM

## Category
Magic values / correctness-adjacent design

## Location
- `packages/core/src/services/dye/DyeSearch.ts:205-209` (`findClosestDye`: `rgbCandidateThreshold = 100`)
- `packages/core/src/services/dye/DyeSearch.ts:344-347` (`findDyesWithinDistance`: `Math.max(maxDistance * 2, 150)`)

## Current State
For all non-RGB matching methods (`cie76`, `ciede2000`, `oklab`, `hyab`, `oklch-weighted`), candidate dyes come from a k-d tree range query with a hard-coded **RGB-space** radius, then are re-ranked with the requested perceptual metric:

```ts
// DyeSearch.ts:206-209
// 100 RGB units covers most cases where perceptual distance might differ from RGB
const rgbCandidateThreshold = 100;
const candidateResults = kdTree.pointsWithinDistance(targetPoint, rgbCandidateThreshold, ...);
```
```ts
// DyeSearch.ts:346
const rgbCandidateThreshold = Math.max(maxDistance * 2, 150);
```

## Issues
1. **Unverified correctness claim.** The value `100` is an unnamed constant whose "covers most cases" claim is untested. A dye that is perceptually closest — e.g., under `oklch-weighted` with `kL: 0.5` (the `matchHue` preset), which deliberately tolerates large lightness/RGB gaps — but sits >100 RGB units away is unfindable. The failure is silent: a *different* dye is returned, not an error.
2. **Unit conflation.** In `findDyesWithinDistance`, `maxDistance * 2` multiplies a *perceptual* distance (DeltaE units, OKLAB units ~0–1, etc., depending on method) by 2 to get an *RGB* radius. There is no principled relationship between these scales; the 150 floor papers over it for typical values only.
3. **Duplicated concept, divergent values.** The same "RGB pre-filter radius" idea appears in two methods with different formulas, so any future calibration must be done twice.

## Proposed Refactoring
- Extract named, per-method constants (e.g., `CANDIDATE_RADIUS_BY_METHOD: Record<MatchingMethod, number>`) with comments justifying each value.
- Add a safety fallback: when the perceptual best sits at/near the candidate-set boundary (or the candidate set is suspiciously small), widen the radius or fall back to a linear scan over the ~125 non-Facewear dyes — trivially cheap at this n.
- Add a regression test that, for each method, compares k-d-tree-assisted results against a brute-force linear scan across a sampled color grid, asserting identical winners.

## Benefits
- Correctness becomes auditable and testable instead of asserted in a comment.
- Per-method calibration becomes possible (the RGB radius needed to guarantee containment differs enormously between `cie76` scale ~0–100 and `oklab` scale ~0–0.5).
- Single source of truth for the pre-filter concept.

## Effort Estimate
LOW–MEDIUM (constants + fallback are small; the brute-force comparison test is the main work)

## Risk Assessment
LOW — n=125 makes even full linear scans cheap, so the fallback cannot regress performance meaningfully; behavior can only become more correct. Slight risk of changed match results where the current threshold was truncating candidates (which is precisely the fix).

> Source: evidence/core-analysis.md (2026-07-18 deep-dive, core area)

## Status

**DONE 2026-07-19** — new brute-force parity regression test (DyeSearch.parity.test.ts) immediately CONFIRMED real wrong-winner cases (e.g. #00FF55/oklab returned a 2.5×-worse dye). Resolution: perceptual methods now use the exact linear scan (n≈125, trivially cheap) in both findClosestDye and findDyesWithinDistance; the k-d tree remains the fast path for 'rgb'. The magic radii are gone entirely.
