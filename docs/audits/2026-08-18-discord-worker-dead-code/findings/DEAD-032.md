# [DEAD-032]: core `band-calibration.ts` is build/test-time tooling exported from the runtime barrel (+ `RATIO_BANDS`, undiscoverable `calibrate-bands` script)

## Category
Dead Code Path (barrel leak) — REFACTOR FIRST

## Location
- `packages/core/src/index.ts:112-127` — barrel exports of `calibrateBandVocabulary`, `DE2000_GROUND_TRUTH`, `METHOD_DISPLAY_DP` + types `BandCalibrationResult`, `CalibratedMethodId`, `CalibratedMethodBands`, `RatioCalibration` (12 lines)
- `packages/core/src/config/band-calibration.ts` (273 lines) — consumed only by `scripts/calibrate-bands.ts:14,20` and `band-vocabulary.parity.test.ts`. The module is **not dead** — the parity test is a real guard on the frozen `BAND_VOCABULARY` numbers — but its barrel exports pull `ColorConverter` + `ColorblindnessSimulator` + `ColorAccessibility` into any consumer's import graph for a function nobody calls at runtime. `METHOD_DISPLAY_DP` duplicates `BAND_METHOD_DP` for the 4 calibrated methods
- `config/band-vocabulary.ts:115` — `RATIO_BANDS` (12 lines): TEST-ONLY design constant; web-app comments (`comparison-tool.ts:1930`, `metric-help.ts:23`) *explicitly* decline to use it
- `scripts/calibrate-bands.ts` (21 lines) — the documented manual recalibration path, but not listed in `package.json#scripts`
- `ColorblindnessSimulator.simulateColorblindnessMachado` / `…MachadoHex` (+ `ColorService` facades) — used only by the calibration module → ride with it

## Evidence
`evidence/track-B-core.md` §0.3, §1a, §7.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH (usage); the design decision on `RATIO_BANDS` belongs to the design owner |
| **Blast Radius** | LOW — the script imports from the module path, not the barrel |
| **Reversibility** | EASY |

## Recommendation
**REFACTOR FIRST** — drop the 12 barrel lines (script + parity test import the module directly), add `"calibrate:bands": "tsx scripts/calibrate-bands.ts"` so the tool is discoverable, fold `METHOD_DISPLAY_DP` into `BAND_METHOD_DP`; decide `RATIO_BANDS` (keep as documented 5.0 calibration output or un-export) with the design owner.
