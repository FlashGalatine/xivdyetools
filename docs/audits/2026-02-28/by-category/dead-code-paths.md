# Dead Code Paths Summary

## Overview
- **Total Findings:** 4 (DEAD-010, DEAD-015, DEAD-027, DEAD-034)
- **Recommended for Removal:** 3 (DEAD-027 partial — investigate)
- **Estimated Lines Removable:** ~180+ (web-app) + ~180+ (bot-i18n locale keys)

---

## Web App Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-010 | `src/components/market-board.ts` | 2 deprecated methods with 0 callers | HIGH | REMOVE |
| DEAD-015 | Multiple files (44 instances) | Unused local variables and parameters | HIGH | REMOVE |

The 44 unused local variables include several dead helper functions (`hexToRgbString`, `renderRecentColors`, `handleExport`, `populateServerDropdown`) that are entire function bodies worth deleting.

The `createSection` pattern (7 instances across different tool components) suggests an incomplete refactoring wave where a shared section-builder was extracted but the local declarations were never cleaned up.

---

## Discord Worker Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-027 | Multiple handler files | 9 unused handler parameters (4 genuinely unused, 5 interface-required) | MEDIUM | INVESTIGATE (4), PREFIX `_` (5) |

The 4 genuinely unused parameters may indicate incomplete implementations:
- `dye.ts` parameter `t` (Translator) — may be a missing localization call
- `preferences.ts` parameter `key` — handler may be partially implemented
- `preset.ts` parameter `userId` (×2) — derives user ID from interaction instead

---

## bot-i18n Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-034 | All 6 locale JSON files | ~30+ unused key sections (buttons, pagination, components, status, matching) | HIGH | REMOVE |

These locale keys were pre-created for planned features (pagination UI, component labels, status messages) that were never implemented. No `t()` calls reference them.
