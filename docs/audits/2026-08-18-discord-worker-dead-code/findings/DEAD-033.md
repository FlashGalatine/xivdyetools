# [DEAD-033]: core `/blending` — `getBlendingModeDescription` (with drifted strings) and the `rgbToLab` re-export are test-only

## Category
Unused Export (TEST-ONLY)

## Location
- `packages/core/src/blending/blending.ts:85-99` — `getBlendingModeDescription` (15 lines); its strings drift from `BLENDING_MODES[].description` (e.g. "Simple additive channel averaging" vs "Additive channel averaging (default)")
- `packages/core/src/blending/index.ts` — `rgbToLab` re-export (external `rgbToLab` hits are `ColorService.rgbToLab`)
- Tests: `blending.test.ts` (~15 lines) imports both from `./index.js` — which is why knip missed them
- External `/blending` imports (bot-logic gradient/mixer, discord-worker preferences): `blendColors`, `BlendingMode`, `BLENDING_MODES`, `isValidBlendingMode` only

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW (npm-published subpath; not README-featured) |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** both (+ test cases). Related, already tracked: `src/blending/conversions.ts` (307 lines) re-implements rgb↔lab/oklab/ryb/hsl that `ColorConverter`/`RybColorMixer` provide, and `/blending` `RGB`/`LAB` types duplicate `@xivdyetools/types` — open checkbox at `DEPRECATIONS.md:244`; not re-filed here.
