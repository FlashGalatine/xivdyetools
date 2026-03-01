# Legacy/Deprecated Code Summary

## Overview
- **Total Findings:** 8 (DEAD-011, 017, 018, 019, 023, 029, 031, 041)
- **Recommended for Removal:** 4 now, 1 as refactoring project, 3 monitor/low-priority
- **Estimated Lines Removable:** ~85 immediately, ~208 via migration

---

## Web App Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-011 | `src/services/api-service-wrapper.ts` | `LocalStorageCacheBackend` — deprecated, replaced by IndexedDB | HIGH | REMOVE |
| DEAD-017 | `src/shared/logger.ts` | `initErrorTracking()` — dead in production | HIGH | REMOVE |
| DEAD-018 | `src/shared/types.ts` | ~8 deprecated re-export blocks (50 consumers) | HIGH | REFACTOR FIRST |
| DEAD-019 | `src/shared/tool-config-types.ts` | 4 deprecated `HarmonyConfig` fields | MEDIUM | REMOVE WITH CAUTION |

DEAD-018 is the largest migration debt item. All 50 importing files need to be updated to import from `@xivdyetools/types` directly instead of the deprecated re-exports in `shared/types.ts`. This is a standalone refactoring task worth scheduling separately.

---

## Discord Worker Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-023 | `package.json` | Unused `discord-interactions` devDependency (replaced by @xivdyetools/auth) | HIGH | REMOVE |
| DEAD-029 | `src/services/i18n.ts` | Legacy KV functions (setUserLanguagePreference, clearUserLanguagePreference) — superseded by unified preferences.ts | HIGH | REMOVE |
| DEAD-031 | `src/index.ts` | 8 legacy command markers (live, functional commands annotated "legacy") | LOW | MONITOR — tech debt for future migration |

---

## bot-logic Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-041 | Multiple source files | 2 REFACTOR comment markers | LOW | COSMETIC — address or remove stale comments |
