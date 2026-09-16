# Review: core-color

Scope: `@xivdyetools/core` — `services/color/`, `blending/`, `services/dye/wheels/` + the
harmony generation that consumes them (`HarmonyGenerator.ts`, `HarmonySelector.ts`),
`utils/`, `constants/`. Consumer contract spot-checked (read-only) in `apps/api-worker/src`
(`routes/wheels.ts`, `routes/harmony.ts`, `lib/harmony.ts`, `lib/validation.ts`) and
`apps/og-worker/src/services/svg/harmony.ts`.

## 1. Map

| Module | Role |
|---|---|
| `services/color/ColorConverter.ts` (1775L) | hex/RGB/HSV/HSL/LAB/OKLAB/OKLCH/LCH/CMYK conversions, ΔE76/ΔE2000/ΔEOK2, CSS Color 4 gamut mapping (`gamutMapOklch`, `maxChromaOklch`), 7 LRU caches, singleton `defaultInstance` |
| `services/color/ColorAccessibility.ts` | WCAG luminance/contrast/AA/AAA, light/dark text pick |
| `services/color/ColorManipulator.ts` | brightness/saturation/hue (HSV + LCh) adjust, invert, desaturate |
| `services/color/ColorblindnessSimulator.ts` | Brettel (gamma-space) + Machado (linear-space) CVD sim, shared LRU cache with `m:`-prefixed keys |
| `blending/blending.ts` | `blendColors()` — rgb/lab/oklab/ryb/hsl/spectral(Kubelka-Munk via spectral.js), `interpolateHue()` |
| `blending/conversions.ts` | Self-contained LAB/OKLAB/RYB/HSL ⇄ RGB + hex parse, deliberately independent of `ColorConverter` |
| `services/dye/wheels/ColorWheel.ts` | Registry: `COLOR_WHEEL_IDS`, `getColorWheel` (own-property guard), `parseColorWheelId`/`normalizeColorWheelId` |
| `services/dye/wheels/hue-warp.ts` | Generic monotone-table wheel engine (`RGB`, `RYB`, `Munsell`, `OKLCH-hue` are all this) |
| `services/dye/wheels/oklch-lightness.ts` | Constant-L/C wheel, `carriesBaseHsv: false`, module-scope ring cache (pure fn of `count`, safe) |
| `services/dye/HarmonySelector.ts` | `generateHarmonySlots` — the one selection algorithm every surface shares (PR #159) |
| `services/dye/HarmonyGenerator.ts` | Legacy per-type `find*Dyes()`, documented unreachable in production, kept for published API |
| `utils/index.ts`, `utils/kd-tree.ts` | LRUCache, clamp/round, validators, retry/sleep, k-d tree (already-fixed CORE-BUG-003) |
| `constants/index.ts` | RGB/HSV ranges, Brettel/Machado matrices, `HARMONY_OFFSETS` (documented bot-logic divergence, filed elsewhere) |

## 2. Candidates

**core-color-01** — kind BUG, severity MEDIUM — `packages/core/src/services/color/ColorConverter.ts:445-462`
Claim: `hexToHsv` checks the LRU cache using a key from `normalizeHexKey(hex)` *before* validating the input, unlike every sibling (`hexToRgb`, `rgbToHex`, `rgbToHsv`, `hsvToRgb`, `rgbToLab`, `rgbToOklab` all call `isValidHexColor`/`isValidRGB`/`isValidHSV` before touching their cache). `normalizeHexKey` only strips a leading `#` and expands 3→6 digits; it does not require `#` to be present. So `normalizeHexKey('FF0000') === normalizeHexKey('#FF0000') === 'FF0000'`.
Failing input → wrong outcome: on a fresh `ColorConverter`, call `converter.hexToHsv('#FF0000')` (warms the cache), then `converter.hexToHsv('FF0000')` (no `#`, which `isValidHexColor`/`PATTERNS.HEX_COLOR` rejects). The second call hits the cache and returns `{h:0,s:100,v:100}` silently instead of throwing `AppError(INVALID_HEX_COLOR)`. The identical input on an unwarmed cache DOES throw (falls through to `this.hexToRgb(hex)`, which validates). Whether malformed input throws now depends on unrelated prior calls. The **static** API (`ColorConverter.hexToHsv`) is worse: it reads `ColorConverter.defaultInstance`, a module-level singleton shared for the isolate/process lifetime, and `'#FF0000'` is an extremely common color to have already been converted by anything else in the same process.
```ts
hexToHsv(hex: string): HSV {
  const cacheKey = ColorConverter.normalizeHexKey(hex);
  const cached = this.hexToHsvCache.get(cacheKey);
  if (cached) { return { ...cached }; }        // <- no validation happened yet
  const rgb = this.hexToRgb(hex);               // validates, but only on a cache MISS
  ...
}
```
Why tests miss it: `ColorConverter.test.ts:471` (`expect(() => converter.hexToHsv('invalid')).toThrow(AppError)`) runs on a freshly-constructed, never-populated instance (`beforeEach` creates a new `ColorConverter`), so only the cache-miss path is exercised. No test warms the cache with a valid hex and then calls the "missing `#`" variant.
Covered by test: no.
Fix direction: call `isValidHexColor(hex)` (throwing `AppError(INVALID_HEX_COLOR)` on failure) before computing `cacheKey`/checking the cache, matching the order every other method already uses.

**core-color-02** — kind UNTESTED, priority MEDIUM — `packages/core/src/services/color/__tests__/ColorAccessibility.test.ts:108-121`
Claim: `'should have different thresholds for small vs large text'` is a guarded `if` with no `else`, and for the fixed pair it uses the guard never fires, so the test executes zero assertions on every run.
```ts
const smallText = ColorAccessibility.meetsWCAGAA('#767676', '#FFFFFF', false);
const largeText = ColorAccessibility.meetsWCAGAA('#767676', '#FFFFFF', true);
if (!smallText) {
  expect(largeText).toBe(true);
}
```
Failing input → wrong outcome: `#767676` on white is the textbook ~4.55:1 contrast pair (verified via `getPerceivedLuminance`: luminance ≈0.1809, ratio ≈(1.05)/(0.1809+0.05) ≈4.55), which is `>= 4.5`, so `meetsWCAGAA(..., false)` is `true` and `!smallText` is `false` — the body never runs. A regression that made `largeText`'s threshold equal to `smallText`'s (or removed the `largeText` parameter's effect entirely) would not be caught by this test; it passes with 0 assertions executed either way.
Why tests miss it: the guard depends on a value computed via the same code under test, and the chosen color pair happens to make the branch permanently dead.
Covered by test: no (this specific test asserts nothing; large-vs-small differentiation is otherwise only checked by two other self-referential `ratio >= threshold` tests at :123-135 and :175-186, which do have both branches).
Fix direction: assert both `smallText`/`largeText` unconditionally with a pair chosen to sit between the two thresholds (e.g. one with ratio in ~[3, 4.5)), or hardcode two known ratios that straddle both cutoffs.

## 3. POSITIVE

- `gamutMapOklch`/`maxChromaOklch` are cross-checked against an independent library (`culori`, CSS Color 4 `toGamut`) over 2000 random samples plus targeted blue-ray/cusp cases (`gamut-map.test.ts`) — high-confidence, not just internally-consistent tests.
- The five colour wheels (`hue-warp.ts` generic engine + `rgb-ryb.ts`/`munsell.ts`/`oklch-hue.ts`/`oklch-lightness.ts`) are well-guarded: `assertMonotoneTable` refuses non-monotone or mis-anchored tables at construction, `getColorWheel`/`isColorWheelId` use `Object.hasOwn`/own-property checks against prototype-key injection (`'toString'`, `'constructor'` both tested), and `mod360` is written to avoid perturbing already-in-range values (tested against a byte-exact identity-table regression).
- `HarmonySelector.generateHarmonySlots` correctly threads `wheel.carriesBaseHsv === false` into forcing `usePerceptualMatching: true` for `oklch-lightness`, and keeps `excluded` (must-never-choose) and `used` (already-shown) as separate sets per its own documented BUG history — verified consistent with both `apps/api-worker/src/routes/harmony.ts` and `apps/og-worker/src/services/svg/harmony.ts`, which both now call `generateHarmonySlots` directly rather than re-rotating hue themselves.
- `rgbToRyb`/`rybToRgb` (`blending/conversions.ts`) round-trip correctly for pure R/G/B/W probed by hand (BUG-006 fix holds); the RYB unit convention (0–1 in `blending/`, 0–255 at the `ColorService` seam) is applied consistently at every call site checked.
- Hue units are consistent everywhere checked: core, `api-worker`'s `/v1/wheels`/`/v1/harmony`, and `og-worker`'s harmony card all pass/receive degrees (0–360); no 0–1-vs-degrees mismatch found at any seam inspected.
- `api-worker`'s `parseColorWheel` genuinely 400s on an unrecognised wheel id (via core's `parseColorWheelId`, which returns `undefined` rather than silently normalizing) — matches its own documented "refused, never mapped to rgb" claim.

## 4. REJECTED

- `blending/conversions.ts:333 rgbToHex` — `n.toString(16)` on unrounded input would emit a malformed hex if given fractional RGB; checked every call site in `blending.ts` (`blendRGB`/`blendLAB`/`blendOKLAB`/`blendRYB`/`blendHSL` all `Math.round()` before returning, `blendSpectral` parses spectral.js's own integer hex) — always fed integers today. Fragile but not currently reachable.
- `services/dye/HarmonyGenerator.ts` legacy `find*Dyes()` (deprecated hue-rotation paths, `rotateHueInSpace` for `lch`/`hsl` still clip instead of gamut-map) — file's own comments document this is unreachable in production since PR #159 moved every surface to `generateHarmonySlots`; kept only for published-API compatibility. Not re-filed per brief's known-context list.
- `constants/index.ts` `HARMONY_OFFSETS` vs `bot-logic`'s own `IDEAL_OFFSETS` divergence — explicitly documented in the constant's own JSDoc as a filed product decision, not a bug; `bot-logic` is out of this unit's scope regardless.
- `services/dye/wheels/oklch-lightness.ts` module-scope `ringCache` (single-entry, keyed only by `count`) — looks like the "module-scope cache shared across requests" anti-pattern, but `ringStops(count)` is a pure function of `count` alone (no request-scoped input), so a stale/shared entry is never wrong, only occasionally re-computed. Not a bug.
- `utils/__tests__/utils.test.ts:403-416` `generateChecksum` — three `expect(typeof checksum).toBe('string')` tests are weak (brief's "arithmetic/typeof" pattern) but the same `describe` block has real determinism + different-input tests alongside them; not worth a separate finding.
- `services/color/__tests__/ColorManipulator.test.ts:296-302` — `not.toThrow()`-only assertions for extreme brightness/saturation deltas; weak per the brief's list but low-value/low-risk (the underlying `clamp` is otherwise well covered) — not filed as a primary candidate.

## 5. COVERED

24 files read (full unless noted):
`services/color/ColorConverter.ts`, `services/color/ColorAccessibility.ts`, `services/color/ColorManipulator.ts`, `services/color/ColorblindnessSimulator.ts`, `blending/blending.ts`, `blending/conversions.ts`, `blending/types.ts`, `blending/index.ts`, `services/dye/wheels/ColorWheel.ts`, `services/dye/wheels/types.ts`, `services/dye/wheels/hue-warp.ts`, `services/dye/wheels/oklch-hue.ts`, `services/dye/wheels/oklch-lightness.ts`, `services/dye/wheels/munsell.ts`, `services/dye/wheels/rgb-ryb.ts`, `utils/index.ts`, `utils/kd-tree.ts`, `constants/index.ts`, `services/dye/HarmonyGenerator.ts`, `services/dye/HarmonySelector.ts`; `services/ColorService.ts` (partial, RYB/mixing seam), `apps/api-worker/src/routes/wheels.ts`, `apps/api-worker/src/routes/harmony.ts`, `apps/api-worker/src/lib/harmony.ts` (all full, read-only consumer check); `apps/api-worker/src/lib/validation.ts` (grep, `parseColorWheel`), `apps/og-worker/src/services/svg/harmony.ts` (partial, read-only consumer check).

Tests read/skimmed: `services/color/__tests__/gamut-map.test.ts` (full), `services/dye/wheels/__tests__/{hue-warp,munsell,oklch-lightness,registry}.test.ts` (full), `services/color/__tests__/{ColorAccessibility,ColorManipulator,ColorConverter}.test.ts` (partial/targeted), `utils/__tests__/utils.test.ts` (partial), `blending/blending.test.ts` (structure scan). `blending/{algebraic-laws,conversions,conversions.equivalence,types}.test.ts`, `blending/blending.integration.test.ts`, `services/dye/wheels/__tests__/oklch-hue.test.ts`, `services/color/__tests__/{ciede2000-conformance,ColorblindnessSimulator}.test.ts`, `utils/__tests__/kd-tree.test.ts` were not opened (no red flags surfaced from grep sweeps across this set; lower priority, not in the changed-file list, deprioritized under the verification-bar time budget).
