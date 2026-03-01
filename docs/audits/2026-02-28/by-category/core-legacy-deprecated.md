# Core Package: Legacy/Deprecated Code Summary

## Overview
- **Total Findings:** 3 (DEAD-042, DEAD-047, DEAD-049)
- **Recommended for Removal:** 2 now (DEAD-042, DEAD-049), 1 phased (DEAD-047)
- **Estimated Lines Removable:** ~200 lines (immediate), ~100 more (Phase 1 of DEAD-047)

## Findings

| ID | Location | Confidence | Recommendation |
|----|----------|------------|----------------|
| [DEAD-042](../findings/DEAD-042.md) | `types/logger.ts` deprecated wrapper (22 lines) | HIGH | REMOVE WITH CAUTION |
| [DEAD-047](../findings/DEAD-047.md) | ~80 deprecated type re-exports in `types/index.ts` (~163 lines) | HIGH (Group B) / MEDIUM (Group A) | REMOVE (phased) |
| [DEAD-049](../findings/DEAD-049.md) | Deprecated `characterColorData` export + monolithic JSON | HIGH | REMOVE |

## Notes
DEAD-047 is the largest single finding — 163 lines of deprecated compatibility re-exports. Group B (68 types with zero consumers) can be removed immediately. Group A (12 types still consumed by ~40 files) requires a migration wave.
