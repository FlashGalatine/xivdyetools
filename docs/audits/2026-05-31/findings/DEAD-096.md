# DEAD-096: colorblindness-display.ts (test-only)

## Category
Stale Test Code / Orphaned-in-Production

## Location
- File(s): `src/components/colorblindness-display.ts` (232 lines),
  `src/components/__tests__/colorblindness-display.test.ts` (198 lines)
- Symbol(s): `ColorblindnessDisplay` class

## Evidence
Only its own test imports the source (`__tests__/colorblindness-display.test.ts:11: import { ColorblindnessDisplay } from '../colorblindness-display'`).
The live consumer, `accessibility-tool.ts`, imports `@components/v4/result-card` (line 16) — **not** this component — confirmed
by reading its import block. Furthermore, `accessibility-tool.test.ts:209` still carries a stale
`vi.mock('../colorblindness-display', …)` for a dependency the tool no longer has (DEAD-101).

- Git: last meaningful commit **2026-02-28**.

## Why It Exists
The v3 colourblindness simulation display. The v4 accessibility tool renders simulations via `result-card.ts`.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — sole importer is its own test; accessibility-tool confirmed to use result-card |
| **Blast Radius** | LOW — also remove the stale `vi.mock` in `accessibility-tool.test.ts` (DEAD-101) |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE** (source + test together)

### Rationale
- 430 lines removed (232 source + 198 test).

### If Removing
1. Delete `src/components/colorblindness-display.ts` and its test.
2. Remove the `vi.mock('../colorblindness-display', …)` block from `accessibility-tool.test.ts` (DEAD-101).
3. `pnpm --filter xivdyetools-web-app run test && run type-check`.
