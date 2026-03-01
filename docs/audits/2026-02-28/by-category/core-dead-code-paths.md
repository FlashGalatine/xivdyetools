# Core Package: Dead Code Paths Summary

## Overview
- **Total Findings:** 1 (DEAD-054)
- **Recommended for Removal:** 1 (or add test coverage + internal adoption)
- **Estimated Lines Removable:** ~40 lines

## Findings

| ID | Location | Confidence | Recommendation |
|----|----------|------------|----------------|
| [DEAD-054](../findings/DEAD-054.md) | `isAbortError` — untested, unused export | HIGH | REMOVE WITH CAUTION or adopt |

## Notes
`isAbortError` is the only exported function in the entire `@xivdyetools/core` package with zero test coverage. It's also unused by both internal services and all external consumers. `APIService` implements its own inline abort error check instead of using this utility.
