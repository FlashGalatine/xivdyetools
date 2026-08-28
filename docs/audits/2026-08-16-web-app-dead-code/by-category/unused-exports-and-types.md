# Unused Exports, Types & Symbols — Summary

## Overview
- **Total Findings:** 7 (DEAD-008, 011, 012, 013, 014, 015, 016)
- **Recommended for Removal:** 7 (DEAD-015 has one REFACTOR-FIRST row; DEAD-012 has one REMOVE-WITH-CAUTION row)
- **Estimated Lines Removable:** ~1,000 source lines + ~1,400 test lines

| ID | Location | Lines | Confidence | Recommendation |
|----|----------|------|------------|----------------|
| DEAD-008 | `storage-service.ts:391-775` `SecureStorage` section + `secure-storage.test.ts` | 385 + 1,325 | HIGH | REMOVE |
| DEAD-011 | `services/index.ts` barrel — 42 redundant + 30 dead re-exports | ~75 lines | HIGH | REMOVE (trim) |
| DEAD-012 | 15 dead exported functions + 30 drop-export-only | ~260 | HIGH (one MEDIUM) | REMOVE |
| DEAD-013 | 21 dead SVG icon constants | 130+ / 6.4 KB | HIGH | REMOVE |
| DEAD-014 | 11 dead exported types (+ drop-export list) | ~120 | HIGH | REMOVE |
| DEAD-015 | 15 `tsc --noUnusedLocals` hits incl. cascades | ~90 | HIGH (`_isFocused` REFACTOR-FIRST) | REMOVE |
| DEAD-016 | dead `BaseComponent` protected API + no-op `updateDrawerContent` | ~90 | HIGH | REMOVE |

**Tool-verified false positives (KEEP):** `scripts/check-bundle-size.d.ts` (implicit `.d.ts` resolution), `ICON_TOOL_DYE_MIXER`, `browser-api-types.ts` (`declare global`), 6 `@customElement` side-effect modules, `getState` (polymorphic), `__setTestEnvironment` (test hook), beta-branding exports (vite plugin), the 8 `*ShareParams` union members, `showDeltaE` (still read).
