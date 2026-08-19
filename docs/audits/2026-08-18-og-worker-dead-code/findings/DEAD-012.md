# [DEAD-012]: `harmony.ts` hand-rolls the NOT FOUND band and the compact glyph that `band-shared.ts` provides for the other eight adapters

## Category
Legacy Code (duplication / drift)

## Location
- `src/services/svg/harmony.ts:110, 198-211, 206, 242`
- `src/services/svg/band-shared.ts:28-54` (`bandGlyph`, `notFoundBand`)

## Evidence
harmony.ts imports `toolGlyph` from `@xivdyetools/svg` directly and calls `toolGlyph('harmony', 'compact', { size: 13, ink: '#ECECEE', accent: '#FF6257' })` twice, then builds its own `generateBandCard({ bands: [{ hex: '#17171A', role: 'NOT FOUND', … }] })` — the exact body of `notFoundBand()` (whose comment even says "the glyph-tile default set replaces this in the defaults step"). Every other adapter (`gradient`, `mixer`, `swatch`, `comparison`, `accessibility`, `extractor`, `presets`, `budget`) uses `bandGlyph()` + `notFoundBand()`. If the not-found styling changes in band-shared, harmony silently keeps the old look.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | LOW (one file; `harmony.test.ts` asserts on output strings — check the NOT FOUND assertion still holds: `notFoundBand` sets `deck: label` where harmony's inline version sets `deck: \`#${dyeId}\`` and passes `label = \`#${dyeId}\`` — identical) |
| **Reversibility** | EASY |

## Recommendation
**REFACTOR** — replace the inline block with `return notFoundBand(getToolTag('harmony', locale), 'harmony', \`#${dyeId}\`, 'harmony', frame);` and the two `toolGlyph(...)` calls with `bandGlyph('harmony')`; drop the `@xivdyetools/svg` import. ~10 lines net.
