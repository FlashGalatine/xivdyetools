# [DEAD-010]: `src/services/dye-selection-context.ts` — orphaned module (66 lines) with only a test as consumer

## Category
Orphaned File (production-dead module; test-only)

## Location
- `apps/web-app/src/services/dye-selection-context.ts` (66 lines) — `export class DyeSelectionContext`
- `apps/web-app/src/services/__tests__/dye-selection-context.test.ts` (70 lines)
- `apps/web-app/src/services/index.ts:41` — `export { DyeSelectionContext } from './dye-selection-context';`

## Evidence
- `grep -rn "DyeSelectionContext\|dye-selection-context" src` → only the definition, the barrel line, and the test file.
- knip default + `--production`: unused.

## Why It Exists
A small selection-state holder from the pre-5.0 tool architecture; the 5.0 tools keep selection in `ConfigController` / per-tool state.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | None. |

## Recommendation
**REMOVE**

### If Removing
1. `git rm src/services/dye-selection-context.ts src/services/__tests__/dye-selection-context.test.ts`
2. Delete `src/services/index.ts:41`
3. `pnpm --filter xivdyetools-web-app run type-check test`
