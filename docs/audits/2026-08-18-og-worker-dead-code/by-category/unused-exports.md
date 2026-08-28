# Unused Exports Summary

## Overview
- **Total Findings:** 4
- **Recommended for Removal / Refactor / Update:** 3
- **Kept (with a fix or a note):** 1

## Findings

| ID | Description | Confidence | Recommendation | Est. lines |
|----|-------------|------------|----------------|-----------|
| [DEAD-004](../findings/DEAD-004.md) | base.ts: indigo THEME, OG_DIMENSIONS, linearGradient + 10 unused package re-exports | HIGH | REMOVE (delete file) | 77 |
| [DEAD-006](../findings/DEAD-006.md) | fonts.ts: cjkStack, FONT_FAMILIES | HIGH | REMOVE | 27 |
| [DEAD-013](../findings/DEAD-013.md) | svg/index.ts barrel: 25 symbols + 2 `export *` for one 11-symbol consumer; X_STRIP_SCALE | HIGH | REMOVE | ~40 |
| [DEAD-023](../findings/DEAD-023.md) | test-only / internal-only exports (generate*OGData ×6, detectCrawler, initRenderer, renderSvgToPng…) | HIGH | KEEP (un-export the 3 with zero consumers) | 0 |
