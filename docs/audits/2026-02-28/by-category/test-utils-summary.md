# Test-Utils Summary

## Overview
- **Total Findings:** 2 (DEAD-083, DEAD-084)
- **Recommended for Removal:** 2 (sequentially dependent)
- **Estimated Lines Removable:** ~50

## Findings

| ID | Category | Location | Confidence | Recommendation |
|----|----------|----------|------------|----------------|
| DEAD-083 | Legacy/Deprecated | factories/dye.ts, factories/category.ts (nextId callers) | HIGH | REMOVE WITH CAUTION — migrate to randomId() |
| DEAD-084 | Legacy/Deprecated | utils/counters.ts (counter infrastructure) | HIGH | REMOVE (after DEAD-083) |

## Execution Order
DEAD-084 depends on DEAD-083:
1. **First:** Migrate `nextId()` callers in dye.ts and category.ts to `randomId()` (DEAD-083)
2. **Then:** Remove the entire counter infrastructure (DEAD-084)

## Notes
The test-utils package is otherwise very clean: 0 TODOs, 0 commented-out code, 0 skipped tests. The legacy counter code is the sole remaining tech debt from the TEST-DESIGN-001 parallel safety migration. The package has many exported symbols that are unused by external consumers, but as a test utility library, broad API surface is expected and intentional.
