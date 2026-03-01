# Dead Code Paths Summary

## Overview
- **Total Findings:** 2 (DEAD-010, DEAD-015)
- **Recommended for Removal:** 2
- **Estimated Lines Removable:** ~180+

## Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-010 | `src/components/market-board.ts` | 2 deprecated methods with 0 callers | HIGH | REMOVE |
| DEAD-015 | Multiple files (44 instances) | Unused local variables and parameters | HIGH | REMOVE |

## Notes
The 44 unused local variables include several dead helper functions (`hexToRgbString`, `renderRecentColors`, `handleExport`, `populateServerDropdown`) that are entire function bodies worth deleting.

The `createSection` pattern (7 instances across different tool components) suggests an incomplete refactoring wave where a shared section-builder was extracted but the local declarations were never cleaned up.
