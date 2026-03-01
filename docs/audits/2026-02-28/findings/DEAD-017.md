# DEAD-017: initErrorTracking() — Dead in Production

## Category
Dead Code Path

## Location
- File(s): `src/shared/logger.ts`
- Line(s): ~78
- Symbol(s): `initErrorTracking()` function

## Evidence
Only referenced from test mocks/setup files. No production code calls `initErrorTracking()`. The error tracking it initializes is handled differently in the current architecture.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero production callers |
| **Blast Radius** | LOW — need to update test setup |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- Removes dead production code
- Test setup can be simplified

### If Removing
1. Remove `initErrorTracking()` from `src/shared/logger.ts`
2. Update test setup/mocks that reference it
3. Run tests to verify
