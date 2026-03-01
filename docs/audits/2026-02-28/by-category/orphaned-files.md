# Orphaned Files Summary

## Overview
- **Total Findings:** 10 (DEAD-001 through DEAD-007, DEAD-020, DEAD-021, DEAD-022)
- **Recommended for Removal:** 10
- **Estimated Lines Removable:** 2,521 + 408 (web-app) + 6,562 (discord-worker) = **9,491**

---

## Web App Findings

| ID | File | Lines | Confidence | Recommendation |
|----|------|-------|------------|----------------|
| DEAD-001 | `src/components/app-layout.ts` + test | 537 + 293 | HIGH | REMOVE |
| DEAD-002 | `src/components/dye-comparison-chart.ts` | 401 | HIGH | REMOVE |
| DEAD-003 | `src/components/dye-preview-overlay.ts` | 317 | HIGH | REMOVE |
| DEAD-004 | `src/components/featured-presets-section.ts` | 160 | HIGH | REMOVE |
| DEAD-005 | `src/components/mobile-bottom-nav.ts` | 200 | HIGH | REMOVE |
| DEAD-006 | `src/components/saved-palettes-modal.ts` + test | 451 + 115 | HIGH | REMOVE |
| DEAD-007 | `src/components/tool-header.ts` | 57 | HIGH | REMOVE |

All 7 files are v3-era components superseded by the v4 architecture or never integrated. Safe to delete in Wave 1.

---

## Discord Worker Findings

| ID | File | Lines | Confidence | Recommendation |
|----|------|-------|------------|----------------|
| DEAD-020 | 7 dead service/util files (css-colors, error-response, color-blending, image-cache, pagination, progress, user-preferences) + 7 test files | ~1,889 + ~2,000 tests | HIGH | REMOVE |
| DEAD-021 | 6 orphaned locale JSON files (exact duplicates of bot-i18n) | ~4,422 | HIGH | REMOVE |
| DEAD-022 | Legacy handleMixerCommand handler (exported but never routed) | ~251 | HIGH | REMOVE |

DEAD-020 consists of speculatively built V4 infrastructure never wired into handlers. DEAD-021 are locale files left behind after bot-i18n package extraction. DEAD-022 is the old mixer handler replaced by handleMixerV4Command + handleGradientCommand.
