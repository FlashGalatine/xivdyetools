# DEAD-080: @xivdyetools/svg — 3 Unused Local Variables in comparison-grid.ts

## Category
Dead Code Paths

## Location
- File(s): `packages/svg/src/comparison-grid.ts`
- Line(s): 261, 391, 394
- Symbol(s): `columnWidth`, `pairs`, `dyes`

## Evidence
TypeScript compiler with `--noUnusedLocals` flags:

```
src/comparison-grid.ts(261,3): error TS6133: 'columnWidth' is declared but its value is never read.
src/comparison-grid.ts(391,3): error TS6133: 'pairs' is declared but its value is never read.
src/comparison-grid.ts(394,3): error TS6133: 'dyes' is declared but its value is never read.
```

### `columnWidth` (line 261)
In `generateDyeColumn()` — the parameter `columnWidth` is accepted but never referenced in the function body. The column layout is calculated using the `centerX` parameter instead.

### `pairs` and `dyes` (lines 391, 394)
In `generateAnalysisSection()` — the parameters `pairs` and `dyes` are accepted but the function only uses `mostSimilar` and `leastSimilar` (which are derived from pairs/dyes by the caller). The raw data is passed but not directly used.

## Also flagged in test files
```
src/accessibility-comparison.test.ts(8,10): error TS6133: 'VisionType' is declared but its value is never read.
src/comparison-grid.test.ts(5,39): error TS6133: 'ComparisonGridOptions' is declared but its value is never read.
```
These are unused type imports in test files — minor but should be cleaned.

## Why It Exists
Likely from iterative development — parameters were added for potential use but the implementation evolved to use derived values instead.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — compiler-verified unused |
| **Blast Radius** | LOW — removing unused parameters requires updating callers |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — private functions |

## Recommendation
**REMOVE**

### Rationale
- Compiler-flagged violations
- Removing unused parameters simplifies the function signatures
- ~6 lines of dead parameter declarations + call-site cleanup

### If Removing
1. Remove `columnWidth` parameter from `generateDyeColumn()` signature and all call sites
2. Remove `pairs` and `dyes` parameters from `generateAnalysisSection()` signature and all call sites
3. Remove `VisionType` import from `accessibility-comparison.test.ts`
4. Remove `ComparisonGridOptions` import from `comparison-grid.test.ts`
5. Run `npm test -- --run` and `npm run type-check` to verify
