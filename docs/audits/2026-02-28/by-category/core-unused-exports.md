# Core Package: Unused Exports Summary

## Overview
- **Total Findings:** 5 (DEAD-045, DEAD-046, DEAD-048, DEAD-055, DEAD-056)
- **Recommended for Removal:** 1 now (DEAD-048 partial — deprecated `characterColorData`), rest at v2.0.0
- **Estimated Lines Removable:** ~20 lines from `index.ts` (export declarations); underlying implementations kept

## Findings

| ID | Location | Confidence | Recommendation |
|----|----------|------------|----------------|
| [DEAD-045](../findings/DEAD-045.md) | 13 unused utils in `utils/index.ts` | MEDIUM | KEEP (mark `@internal`, remove in v2.0.0) |
| [DEAD-046](../findings/DEAD-046.md) | 4 unused constants in `constants/index.ts` | MEDIUM | KEEP (mark `@internal`, remove in v2.0.0) |
| [DEAD-048](../findings/DEAD-048.md) | 11 character color data exports | MEDIUM | REMOVE WITH CAUTION (v2.0.0) |
| [DEAD-055](../findings/DEAD-055.md) | `MemoryCacheBackend` class | MEDIUM | KEEP |
| [DEAD-056](../findings/DEAD-056.md) | `VERSION` constant | LOW | KEEP |

## Notes
As a published npm package, removing exports is a breaking change. Most unused exports should be marked `@internal` now and removed in the next major version. The key distinction is between "unused in monorepo" and "unused everywhere" — external npm consumers are unknown.
