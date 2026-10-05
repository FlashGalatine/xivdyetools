# Review: core-color (colour math, wheels, harmony slots, blending)

Branch preview/integration-2026-10-04 @80262a2f. Read-only review; no PR touches this slice (only `ColorConverter.ts` changed since 79a69d1f, by the BUG-009 hex-validation order fix).

## Map

| Module | Role |
|---|---|
| `blending/blending.ts` | `blendColors` (6 modes), `interpolateHue`; spectral via spectral.js |
| `blending/conversions.ts` | self-contained LAB/OKLAB/RYB/HSL/hex (separate from ColorConverter by design) |
| `services/color/ColorConverter.ts` | hex/RGB/HSV/HSL/CMYK/LAB/OKLAB/OKLCH/LCH, ΔE76/2000/ΔEOK2, gamut map, LRU caches |
| `services/color/ColorAccessibility.ts` | luminance, WCAG ratio, text colour |
| `services/color/ColorManipulator.ts` | brightness/saturation/hue/invert |
| `services/color/ColorblindnessSimulator.ts` | Brettel (gamma space) + Machado (linear) |
| `services/dye/HarmonySelector.ts` | `generateHarmonySlots` (the one live harmony path) |
| `services/dye/HarmonyGenerator.ts` | legacy `find*Dyes` (published API only) |
| `services/dye/wheels/*` | registry, hue-warp, RGB/RYB/Munsell/OKLCH-hue/OKLCH-lightness wheels |

## Candidates

### core-color-01 BUG MEDIUM — HSL blend lets an achromatic input's fake hue 0 drag the result
- `packages/core/src/blending/conversions.ts:240-242` (`rgbToHsl` returns `h: 0` for greys) feeding `blending.ts:182-191` (`blendHSL`).
- Failing input: `blendColors('#FFFFFF','#0000FF','hsl',0.5)`. h1=0 (white's meaningless hue), h2=240, shorter arc gives diff -120, so h=300 (magenta); s=0.5, l=0.75. Result is a pink/magenta tint, not light blue. Same with `#000000` or any grey (and grey + `#00FF00` gives a magenta-ish hue too). Order reversed gives the same 300. Snow White, Soot Black and the greys are real dyes, so this is a common mix.
- Wrong outcome: the HSL mixer mode (web mixer, bot `/mixer` and `/gradient`) shows a hue that exists in neither input. CSS Color 4 treats an achromatic hue as "powerless" and takes the other colour's hue.
- Tests: `ColorService.test.ts:432` "achromatic colors in HSL" (not shown to assert a chromatic partner). Covered: no.
- Origin: MAIN.
```ts
// blending.ts
const blended: HSL = {
  h: interpolateHue(hsl1.h, hsl2.h, t, hueMethod),   // hsl1.h === 0 for a grey
```
- Fix: if `hsl1.s === 0` use `hsl2.h` (and vice versa; both grey keep 0) before interpolating.

### core-color-02 BUG MEDIUM — a pinned dye is not reserved against EARLIER slots under `preventDuplicates`
- `packages/core/src/services/dye/HarmonySelector.ts:223-258`. `used` starts empty and is filled slot by slot; pins are only added when their own slot is reached.
- Failing input: `preventDuplicates: true`, `pinned: Map{2 -> X}` where X is also the nearest eligible dye for slot 0 or 1 (the user swaps slot 2 to the dye slot 1 currently shows, via the companion list). Slot 1 picks X (unused so far), then slot 2 takes pin X: X appears twice though a non-duplicate fallback existed.
- Wrong outcome: duplicates shown with "prevent duplicates" on. The web app comment (`apps/web-app/src/components/harmony-tool.ts:1490`) and the option doc say a pin "still consumes its place so a later slot cannot pick it again"; it only blocks LATER slots.
- Fix: pre-seed `used` with all `pinned` dye itemIDs (for unpinned slots) before the loop.
- Origin: MAIN.

### core-color-03 UNTESTED MEDIUM (for core-color-02)
- `packages/core/src/services/dye/__tests__/HarmonySelector.test.ts:200-214`. The "still consumes its place" test pins slot 1 to Jet Black, a dye slot 0 would never choose, so the order dependence cannot show. Needs a pin equal to what an earlier slot naturally picks.
- Origin: MAIN.

### core-color-04 BUG LOW — `getOptimalTextColor` / `isLightColor` threshold is luminance 0.5
- `packages/core/src/services/color/ColorAccessibility.ts:70-81`.
- Failing input: `#FF8000` (relative luminance about 0.37) -> isLight false -> white text, contrast about 2.5:1, while black gives about 8:1. Any background with luminance between 0.18 and 0.5 (mid greys, oranges, light blues) gets the lower-contrast text. Best-contrast crossover is about 0.179.
- No in-repo caller (web-app `budget-tool.ts:1856` has its own `isLightColor`); published API, so LOW.
- Origin: MAIN. Not covered (tests assert extremes). Fix: pick the colour with the higher `getContrastRatio`.

### core-color-05 BUG LOW — `blendColors` with a NaN ratio emits `#NaNNaNNaN`
- `packages/core/src/blending/blending.ts:64` (`Math.max(0, Math.min(1, NaN))` is NaN) and `conversions.ts:334-335` (`NaN.toString(16)` -> "NaN").
- Failing input: `ColorService.mixColorsRgb('#FF0000','#0000FF', NaN)`. Returns an invalid HexColor. Known callers clamp or validate first (og-worker `index.ts:926`), so latent.
- Origin: MAIN. Fix: `const t = Number.isFinite(ratio) ? clamp : 0.5` or throw.

### core-color-06 BUG LOW — `hsvToRgb` cache is keyed on rounded inputs but computes from unrounded
- `ColorConverter.ts:385-431`. Key is `round(h,2),round(s,2),round(v,2)`; first caller's unrounded result is stored for the whole key.
- Failing input: `hsvToRgb(50, 50.004, 80)` then `hsvToRgb(50, 49.996, 80)` can differ by 1 on a channel; the second returns the first's value, so results depend on call order. Sub-unit; no shipped surface affected.
- Origin: MAIN. Fix: compute from the rounded values, or key on exact values.

### core-color-07 BUG LOW — legacy `findComplementaryPair` rotates the raw input, the other finders rotate the base dye
- `HarmonyGenerator.ts:183` uses `hex`; `:415` (`findHarmonyDyesByOffsets`) uses `baseDye.hex`. With `colorSpace` set, complement of a custom colour is not relative to the same colour as the other harmonies. Published API only, deprecated path; defended by the 5.2.0 deprecation.
- Origin: MAIN.

## POSITIVE
- ΔE2000 matches the Sharma reference structure (G, h' wrap cases, Rt, Rc, T); `normalizeDeltaEFormula` is the single alias fold (`ColorConverter.ts:46,916`).
- CIE epsilon/kappa are exact rationals in both LAB implementations; `hexToHsv` validates before the cache (BUG-009 fix holds).
- Defensive copies on every cached return (BUG-005); `isValidHexColor` length-guards before the regex.
- Wheel registry uses `Object.hasOwn` (`ColorWheel.ts:70`, `HarmonySelector.ts:159`); no prototype-key path. `HARMONY_OFFSETS` own-property check holds.
- Both generated warp tables (munsell 42 rows, oklch-hue 73 rows) verified strictly increasing, 0,0 to 360,360, max step 28 and 13 degrees; the RYB table matches the NodeBox pairs and is column-correct (`rgb-ryb.ts:21`).
- `gamutMapOklch` follows CSS Color 4 (JND 0.02, minInGamut); OKLCH-lightness treats greys as hue-less consistently in `hueOf` and `target`.
- `rgbToRyb` inverse (BUG-006) is exact; `interpolateHue` four modes are correct.

## REJECTED
- visionType prototype-key crash in `ColorblindnessSimulator` (`BRETTEL_MATRICES['constructor']`): callers validate (`og-worker/src/index.ts:1093` `isVisionType`, bot lens is a choice list).
- 0.03928 vs 0.04045 sRGB threshold in `ColorAccessibility.toLinear`: max error about 1e-5, invisible.
- `gamutMapOklch` returning a stale `clipped` after in-gamut iterations: matches the spec's loop.
- Hue seam in `hue-warp.interpolate` / `mod360`: `v` always in [0,360), binary search cannot index past the last row; 359.99999999999994 case returns itself.
- Companion duplicates in `generateHarmonySlots` (companion consumes `used`, later slot falls back to nearest used): documented trade-off.
- `HarmonyGenerator` non-HSV default branch (`rotateHueInSpace` default returns hex): unreachable via the typed union.
- Dead-code (`getOptimalTextColor`, `HarmonyGenerator` methods having no production caller): owned by the 2026-10-04 dead-code audit.

## COVERED
17 files read in full: `blending/{blending,conversions,index,types}.ts`, `services/color/{ColorAccessibility,ColorConverter,ColorManipulator,ColorblindnessSimulator}.ts`, `services/dye/{HarmonyGenerator,HarmonySelector}.ts`, `services/dye/wheels/{ColorWheel,hue-warp,munsell,oklch-hue,oklch-lightness,rgb-ryb,types}.ts`. Also checked: `utils/index.ts` validators, `constants/index.ts` matrices and `HARMONY_OFFSETS`, both warp-table JSONs, and the HarmonySelector pin tests. I could not run an empirical probe (the review is read-only), so core-color-01 and -02 are hand-traced.
