# Core Package: Orphaned Files Summary

## Overview
- **Total Findings:** 3 (DEAD-050, DEAD-051, DEAD-052, DEAD-053)
- **Recommended for Removal:** 4
- **Estimated Lines/Files Removable:** 5 files, ~365 lines + 137-line CSV

## Findings

| ID | Location | Confidence | Recommendation |
|----|----------|------------|----------------|
| [DEAD-050](../findings/DEAD-050.md) | 3 × `add-type-flags` scripts (154 lines total) | HIGH | REMOVE |
| [DEAD-051](../findings/DEAD-051.md) | `compare-scrapes.js` (171 lines) | HIGH | REMOVE |
| [DEAD-052](../findings/DEAD-052.md) | `response.json` debug artifact (1 line) | HIGH | REMOVE |
| [DEAD-053](../findings/DEAD-053.md) | Tracked `output/dye_names.csv` (137 lines, gitignored) | HIGH | REMOVE (git rm --cached) |

## Notes
All 4 findings are in the `scripts/` directory. None are referenced by any build, test, or CI pipeline. All are historical artifacts from development workflows.
