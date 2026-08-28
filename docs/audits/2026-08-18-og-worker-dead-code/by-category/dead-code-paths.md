# Dead Code Paths Summary

## Overview
- **Total Findings:** 8
- **Recommended for Removal / Refactor / Update:** 6
- **Kept (with a fix or a note):** 2

## Findings

| ID | Description | Confidence | Recommendation | Est. lines |
|----|-------------|------------|----------------|-----------|
| [DEAD-001](../findings/DEAD-001.md) | og-data-generator: no extractor/presets/budget cases → 3 image routes unreachable from any emitted URL | HIGH | KEEP + FIX (add emitters) | 0 (additive) |
| [DEAD-002](../findings/DEAD-002.md) | dye-helpers: character-colour-sheet block, prod-dead (test-only), CharacterColorService built at module load | HIGH | REMOVE | ~263 src + ~180 test |
| [DEAD-003](../findings/DEAD-003.md) | swatch ?sheet/?race/?gender parsed, forwarded onto og:image URL (cache-key fragmentation), never drawn; SwatchParams.index | HIGH | REMOVE | ~25 |
| [DEAD-010](../findings/DEAD-010.md) | index.ts comparison route drops `frame` → X branch unreachable; X gets a cropped card | HIGH | KEEP + FIX | 0 (1-line fix) |
| [DEAD-014](../findings/DEAD-014.md) | renderer.ts `render` param defaults ('legacy 1200-wide SVGs') unreachable | HIGH | REMOVE | ~5 |
| [DEAD-019](../findings/DEAD-019.md) | AnalyticsEvent.cacheHit hard-coded false at 12 sites → constant double2 | HIGH | REMOVE WITH CAUTION | ~13 |
| [DEAD-021](../findings/DEAD-021.md) | subset-cjk-fonts.py probes 13 source paths that cannot exist | HIGH | REMOVE | ~15 (py) |
| [DEAD-022](../findings/DEAD-022.md) | harmony/gradient/mixer `algo` parsed but not forwarded to image URL (card ≠ page) | HIGH (unread) / product call | REFACTOR FIRST | ±6 |
