# DEAD-043: Legacy omnibus `core.test.ts` — duplicates dedicated test coverage

## Category
Stale Test Code

## Location
- File(s): `packages/core/src/__tests__/core.test.ts`
- Line(s): 1–324
- Symbol(s): N/A (test file)

## Evidence
`core.test.ts` (324 lines) is a legacy omnibus test file that tests:
- ColorService: `hexToRgb`, `rgbToHex`, `rgbToHsv`, `hsvToRgb`, `getColorDistance`, `simulateColorblindness`
- DyeService: `getAllDyes`, `searchByName`, `findClosestDye`, `findDyesWithinDistance`
- APIService: `getPriceData`, `formatPrice`, cache stats
- Utils: `clamp`, `lerp`, `round`, validators, `sleep`, `retry`, `generateChecksum`

Every one of these areas has dedicated, more thorough test files:
- `services/__tests__/ColorService.test.ts`
- `services/__tests__/DyeService.test.ts`
- `services/__tests__/APIService.test.ts`
- `utils/__tests__/utils.test.ts`

Last modified: 2026-02-18 (exists since initial package creation; not updated in 6+ months).

## Why It Exists
Original "all-in-one" test file created when the package was first built. Dedicated per-service tests were added later but this file was never pruned.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — 100% duplicated coverage |
| **Blast Radius** | NONE — no production code affected |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
324 lines of pure test duplication. All tested functionality is covered more thoroughly in dedicated test files. Removing it reduces test suite execution time and maintenance burden without reducing coverage.

### If Removing
1. Delete `src/__tests__/core.test.ts`
2. Run `npm test -- --run` to verify no test count regression in any critical area
3. Run `npm run test:coverage` to confirm coverage is unchanged
