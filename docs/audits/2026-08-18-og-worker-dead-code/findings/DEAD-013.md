# [DEAD-013]: `services/svg/index.ts` barrel over-exports — 25 symbols + `export *` from two modules, of which the one consumer uses 11

## Category
Unused Export (barrel)

## Location
- File: `src/services/svg/index.ts` (58 lines)

## Evidence
The only importer of the barrel is `src/index.ts:30-42` (`generate*OG` ×9, `generateDefaultCard`, `DEFAULT_DECK`). Tests import the underlying modules directly (`./band`, `./default-card`, …), never the barrel. knip: `Unused exports: generateBandCard, bandInk, cardFooter, cardHeader, ogMark, xStrip, BAND_FRAMES, BAND_CAP, DECK_H, FOOTER_H, HEADER_H, MARK_STRIPES` and `Unused exported types: BandCardOptions, BandEntry, BandFrame, DefaultCardOptions, HarmonyOGOptions, GradientOGOptions, MixerOGOptions, SwatchOGOptions, ComparisonOGOptions, AccessibilityOGOptions, ExtractorOGOptions, PresetsOGOptions, BudgetOGOptions` — all from the barrel. `export * from './base'` and `export * from './dye-helpers'` re-export DEAD-004's and DEAD-002's dead surface too. Also `band.ts` exports `X_STRIP_SCALE` (internal only, `prod=2 tests=0`).

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** the surplus: keep the nine `generate*OG`, `generateDefaultCard`, `DEFAULT_DECK`; drop the frame internals, the option types (import from their modules where needed), and both `export *` lines (~40 lines). Un-export `X_STRIP_SCALE`. A barrel that mirrors what index.ts needs is also a readable route→generator map.
