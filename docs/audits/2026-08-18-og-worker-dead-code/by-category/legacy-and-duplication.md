# Legacy / Duplication / Docs drift Summary

## Overview
- **Total Findings:** 6
- **Recommended for Removal / Refactor / Update:** 6
- **Kept (with a fix or a note):** 0

## Findings

| ID | Description | Confidence | Recommendation | Est. lines |
|----|-------------|------------|----------------|-----------|
| [DEAD-008](../findings/DEAD-008.md) | tsconfig disables noUnusedLocals/Parameters/ImplicitReturns from base | HIGH | REFACTOR FIRST → enable | -3 |
| [DEAD-011](../findings/DEAD-011.md) | og-data-generator private harmonyToKey/getHarmonyName/getVisionName duplicate translator.ts exports | HIGH | REFACTOR | ~15 |
| [DEAD-012](../findings/DEAD-012.md) | harmony.ts inlines NOT FOUND band + toolGlyph instead of notFoundBand/bandGlyph like the other 8 | HIGH | REFACTOR | ~10 |
| [DEAD-015](../findings/DEAD-015.md) | generateSwatchOG async 'for call-site stability' + eslint-disable | HIGH | REMOVE | 3 |
| [DEAD-018](../findings/DEAD-018.md) | docs drift: worker-middleware ref, README 'own theme', CLAUDE.md deps table lacks @xivdyetools/svg, file-map lines | HIGH | UPDATE | docs |
| [DEAD-027](../findings/DEAD-027.md) | font stacks ×3, #0B0B0C ×4-5, mark stripes ×3, glyph ink ×5 re-typed | HIGH | REFACTOR | ~30 |
