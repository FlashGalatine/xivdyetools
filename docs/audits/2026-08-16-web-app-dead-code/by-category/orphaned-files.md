# Orphaned Files & Assets — Summary

## Overview
- **Total Findings:** 8 (DEAD-001, 002, 003, 004, 005, 009, 010, 023, 024)
- **Recommended for Removal:** 8
- **Estimated Dead Bytes:** ~3.9 MB of assets + 2 source modules (257 lines) + 2 test files (488 lines)

| ID | Location | Bytes / Lines | Confidence | Recommendation |
|----|----------|------|------------|----------------|
| DEAD-001 | `assets/` (root, 22 files) | 1.1 MB | HIGH | REMOVE (copy `favicon-48x48.png` + `mstile-150x150.png` to `public/assets/icons/` first) |
| DEAD-002 | `src/public/` | 408 KB | HIGH | REMOVE |
| DEAD-003 | `service-worker.js` + `public/js/sw-register.js` | 258 + 30 lines | HIGH | REMOVE |
| DEAD-004 | `public/js/load-css.js` | 520 B | HIGH | REMOVE |
| DEAD-005 | `robots.txt` (root) | 1 file | HIGH | REMOVE (decide separately on a fresh `public/robots.txt`) |
| DEAD-009 | `src/services/price-utilities.ts` + test | 191 + 418 lines | HIGH | REMOVE |
| DEAD-010 | `src/services/dye-selection-context.ts` + test | 66 + 70 lines | HIGH | REMOVE |
| DEAD-023 | `public/og/<tool>/` ×18 | 2.06 MB | HIGH | REMOVE |
| DEAD-024 | `public/assets/icons/` orphans + `tools/preview.html` + dead preloads | ~172 KB | HIGH | REMOVE |
