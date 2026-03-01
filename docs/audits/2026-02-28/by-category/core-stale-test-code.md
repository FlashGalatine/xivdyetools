# Core Package: Stale Test Code Summary

## Overview
- **Total Findings:** 2 (DEAD-043, DEAD-044)
- **Recommended for Removal:** 2
- **Estimated Lines Removable:** 539 test lines

## Findings

| ID | Location | Confidence | Recommendation |
|----|----------|------------|----------------|
| [DEAD-043](../findings/DEAD-043.md) | `core.test.ts` omnibus test (324 lines) | HIGH | REMOVE |
| [DEAD-044](../findings/DEAD-044.md) | `logger.test.ts` tests deprecated re-exports (215 lines) | HIGH | REMOVE |

## Notes
Both files test functionality that has migrated elsewhere:
- `core.test.ts` duplicates coverage from dedicated per-service test files
- `logger.test.ts` tests code that belongs to `@xivdyetools/logger`

Removing both will reduce test suite execution time by eliminating redundant test runs while maintaining full coverage.
