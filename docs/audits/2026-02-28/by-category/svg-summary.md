# SVG Package Summary

## Overview
- **Total Findings:** 7 (DEAD-076 – DEAD-082)
- **Recommended for Removal:** 4 (DEAD-079, DEAD-080, DEAD-082 remove; DEAD-077, DEAD-078, DEAD-085 refactor)
- **Estimated Lines Removable:** ~80 + refactoring improvements

## Findings

| ID | Category | Location | Confidence | Recommendation |
|----|----------|----------|------------|----------------|
| DEAD-076 | Unused Exports | index.ts (42 symbols) | MEDIUM | KEEP WITH ANNOTATION — mark base primitives @internal |
| DEAD-077 | Duplicate Code | comparison-grid.ts, dye-info-card.ts (rgbToHsv) | HIGH | REFACTOR — extract to base.ts |
| DEAD-078 | Duplicate Code | comparison-grid.ts (getRelativeLuminance, getContrastRatio) | HIGH | REFACTOR — use existing ColorService/base.ts |
| DEAD-079 | Unused Exports | comparison-grid.ts (ComparisonDye, DyePair) | HIGH | REMOVE — make non-exported |
| DEAD-080 | Dead Code | comparison-grid.ts (3 unused locals) | HIGH | REMOVE — compiler-verified |
| DEAD-081 | Dead Code | harmony-wheel.ts (baseName option) | HIGH | REMOVE WITH CAUTION — unused interface property |
| DEAD-082 | Dead Code (app) | discord-worker services/svg/index.ts | HIGH | REMOVE — dead re-export |
| DEAD-085 | Legacy | comparison-grid.ts (inline truncation) | HIGH | REFACTOR — use truncateText() |

## Notes
`comparison-grid.ts` is the most problematic file in the svg package, with 4 findings concentrated in it. It has: duplicate `rgbToHsv`, duplicate luminance/contrast logic, unused function parameters, unexported types, and inconsistent name truncation. A focused cleanup of this single file would address 5 of the 8 findings.

The 42 unconsumed barrel exports (DEAD-076) are largely base primitives used internally — marking them `@internal` is sufficient.
