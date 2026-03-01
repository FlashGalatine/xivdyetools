# Legacy/Deprecated Code Summary

## Overview
- **Total Findings:** 3 (DEAD-011, DEAD-018, DEAD-019)
- **Recommended for Removal:** 2 now, 1 as a refactoring project
- **Estimated Lines Removable:** ~60 immediately, ~208 via migration

## Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-011 | `src/services/api-service-wrapper.ts` | `LocalStorageCacheBackend` — deprecated, replaced by IndexedDB | HIGH | REMOVE |
| DEAD-017 | `src/shared/logger.ts` | `initErrorTracking()` — dead in production | HIGH | REMOVE |
| DEAD-018 | `src/shared/types.ts` | ~8 deprecated re-export blocks (50 consumers) | HIGH | REFACTOR FIRST |
| DEAD-019 | `src/shared/tool-config-types.ts` | 4 deprecated `HarmonyConfig` fields | MEDIUM | REMOVE WITH CAUTION |

## Notes
DEAD-018 is the largest migration debt item. All 50 importing files need to be updated to import from `@xivdyetools/types` directly instead of the deprecated re-exports in `shared/types.ts`. This is a standalone refactoring task worth scheduling separately.
