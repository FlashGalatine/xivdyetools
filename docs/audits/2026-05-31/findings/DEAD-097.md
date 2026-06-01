# DEAD-097: color-distance-matrix.ts (test-only)

## Category
Stale Test Code / Orphaned-in-Production

## Location
- File(s): `src/components/color-distance-matrix.ts` (220 lines),
  `src/components/__tests__/color-distance-matrix.test.ts` (204 lines)
- Symbol(s): `ColorDistanceMatrix` class

## Evidence
Only its own test imports the source (`__tests__/color-distance-matrix.test.ts:11: import { ColorDistanceMatrix } from '../color-distance-matrix'`).
The would-be consumer `comparison-tool.ts` renders comparison output via `v4/result-card.ts`. `comparison-tool.test.ts:206`
still carries a stale `vi.mock('../color-distance-matrix', …)` (DEAD-101).

- Git: last meaningful commit **2026-02-28**.

## Why It Exists
The v3 pairwise colour-distance matrix for the comparison tool. Superseded by the v4 result-card rendering.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — sole importer is its own test |
| **Blast Radius** | LOW — also remove the stale `vi.mock` in `comparison-tool.test.ts` (DEAD-101) |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE** (source + test together)

### Rationale
- 424 lines removed (220 source + 204 test).

### If Removing
1. Delete `src/components/color-distance-matrix.ts` and its test.
2. Remove the `vi.mock('../color-distance-matrix', …)` block from `comparison-tool.test.ts` (DEAD-101).
3. `pnpm --filter xivdyetools-web-app run test && run type-check`.
