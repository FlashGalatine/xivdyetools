# [DEAD-015]: svg — test-only exports (`interpolateColor`, `generateGradientColors`, `rgbToHex`, `LEDGER_GROUP_H`/`LEDGER_ROW_H`, `GLYPH_SETS`) and an optional barrel trim

## Category
Unused Export (TEST-ONLY) / Barrel hygiene

## Location
`packages/svg/src/`:

| Symbol | File:lines | Lines | Evidence |
|---|---|---|---|
| `interpolateColor`, `generateGradientColors` | gradient.ts:203-252 | ~50 + ~27 test | `generateGradientCard` calls neither; comment says "shared with bot-logic's interpolation" but bot-logic's gradient uses core. README documents them ("Color and text utilities") |
| `rgbToHex` | base.ts:70-72 | 3 | definition only + og-worker's unused re-export; svg's generators never call it (documented; duplicate of core) |
| `LEDGER_GROUP_H`, `LEDGER_ROW_H` | budget-ledger.ts | 2 barrel lines | only `index.test.ts` asserts their values (40 / 24) |
| `GLYPH_SETS` | icons/tool-icons.ts:335-342 | 8 | only `icons/tool-icons.test.ts` iterates it |

**Optional barrel trim (INTERNAL-ONLY, KEEP the code):** `placeGlyph`, `appIcon`, `formatMeasure`, `bandSlices`, `ACCENT`, `NUMFMT` are used inside svg by the generators but not in the README's "Frame primitives" list and imported by no consumer — ~6 lines of `index.ts`. The rest of the frame vocabulary (`CARD_TYPE`, `cardShell`, `cardText`, `fitText`, `commandChip`, `markFooter`, `swatch`, `idealSwatch`, `dashedRule`, `hairline`, `HARMONY_ROW_CAP`, `textWidth`, `LEDGER_{HEADER,COLHEAD,FOOTER,FOOTER_2LINE}_H`, frame types) is **DOCUMENTED-PUBLIC-API — KEEP**: README/CLAUDE tell consumers to build cards with them even though today only `cardTheme`/`num`/`grp`/`ROW_CAP`/`toolGlyph` cross the boundary.

**Do not touch:** the 26 `*Options`/`*Labels`/row types are the parameter types of live generators (consumers pass literals) — LIVE-by-inference.

## Evidence
knip missed all six because `index.test.ts`/`tool-icons.test.ts` reference them (tests are entries); found by the per-export grep in `evidence/track-C-svg-botlogic.md` §1.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW; `interpolateColor`/`generateGradientColors`/`rgbToHex` are README-documented → semver-minor for the published package |
| **Reversibility** | EASY |
| **Hidden Consumers** | og-worker's `services/svg/base.ts` re-exports `rgbToHex` (unused there) — trim with it |

## Recommendation
**REMOVE WITH CAUTION** the four documented helpers (CHANGELOG note); **REMOVE** the `LEDGER_GROUP_H`/`LEDGER_ROW_H`/`GLYPH_SETS` barrel lines; the barrel trim is optional/low value.
