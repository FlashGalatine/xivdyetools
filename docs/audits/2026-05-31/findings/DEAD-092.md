# DEAD-092: color-interpolation-display.ts (test-only)

## Category
Stale Test Code / Orphaned-in-Production

## Location
- File(s): `src/components/color-interpolation-display.ts` (616 lines),
  `src/components/__tests__/color-interpolation-display.test.ts` (296 lines)
- Symbol(s): `ColorInterpolationDisplay` class, `InterpolationStep` type

## Evidence
The only importer of the source is its own test:
```typescript
// __tests__/color-interpolation-display.test.ts:11
import { ColorInterpolationDisplay, InterpolationStep } from '../color-interpolation-display';
```
No production module imports it. `gradient-tool.ts` (the would-be consumer) renders gradient steps via
`v4/result-card.ts` (first added 2026-02-18). Additionally, `gradient-tool.test.ts:234` still contains a
`vi.mock('../color-interpolation-display', …)` — a **stale mock** for a dependency gradient-tool no longer has (see DEAD-101).

- Git: last meaningful commit **2026-02-28**.

## Why It Exists
A v3 sub-component that rendered interpolation steps for the gradient/mixer tools. The v4 redesign folded this into
`result-card.ts`, but the component + its 296-line test were left behind, keeping the suite green over dead code.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — sole importer is its own test |
| **Blast Radius** | LOW — also remove the stale `vi.mock` in `gradient-tool.test.ts` (DEAD-101) |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE** (source + test together)

### Rationale
- 912 lines removed (616 source + 296 test). The largest test-only item.
- Removes a green test that disguises dead code as covered code.

### If Removing
1. Delete `src/components/color-interpolation-display.ts` and its `__tests__/` test.
2. Remove the `vi.mock('../color-interpolation-display', …)` block from `gradient-tool.test.ts` (DEAD-101).
3. `pnpm --filter xivdyetools-web-app run test && run type-check`.
