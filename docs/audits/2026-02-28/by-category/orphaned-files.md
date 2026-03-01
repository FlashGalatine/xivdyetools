# Orphaned Files Summary

## Overview
- **Total Findings:** 7 (DEAD-001 through DEAD-007)
- **Recommended for Removal:** 7
- **Estimated Lines Removable:** 2,521 (source) + 408 (tests) = 2,929

## Findings

| ID | File | Lines | Confidence | Recommendation |
|----|------|-------|------------|----------------|
| DEAD-001 | `src/components/app-layout.ts` + test | 537 + 293 | HIGH | REMOVE |
| DEAD-002 | `src/components/dye-comparison-chart.ts` | 401 | HIGH | REMOVE |
| DEAD-003 | `src/components/dye-preview-overlay.ts` | 317 | HIGH | REMOVE |
| DEAD-004 | `src/components/featured-presets-section.ts` | 160 | HIGH | REMOVE |
| DEAD-005 | `src/components/mobile-bottom-nav.ts` | 200 | HIGH | REMOVE |
| DEAD-006 | `src/components/saved-palettes-modal.ts` + test | 451 + 115 | HIGH | REMOVE |
| DEAD-007 | `src/components/tool-header.ts` | 57 | HIGH | REMOVE |

## Notes
All 7 files are v3-era components superseded by the v4 architecture or never integrated. Safe to delete in Wave 1.
