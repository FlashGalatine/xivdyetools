# DEAD-093: color-display.ts (test-only)

## Category
Stale Test Code / Orphaned-in-Production

## Location
- File(s): `src/components/color-display.ts` (475 lines),
  `src/components/__tests__/color-display.test.ts` (346 lines)
- Symbol(s): `ColorDisplay` class

## Evidence
Only its own test imports the source (`__tests__/color-display.test.ts:11: import { ColorDisplay } from '../color-display'`).
No production module imports it. Per-dye/colour readouts are rendered by `v4/result-card.ts` in the v4 tools.

- Git: last meaningful commit **2026-02-28**.

## Why It Exists
The v3 colour readout card. Superseded by `result-card.ts`; the component + 346-line test were never removed.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — sole importer is its own test |
| **Blast Radius** | NONE |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE** (source + test together)

### Rationale
- 821 lines removed (475 source + 346 test).

### If Removing
1. Delete `src/components/color-display.ts` and its test.
2. `pnpm --filter xivdyetools-web-app run test && run type-check`.
