# review — core-color (`@xivdyetools/core`, colour math)

Repo root: `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02` (origin/main e7ac4042).
Deploy unit: `@xivdyetools/core` — npm publish, consumed by every app.

## 1. Map

| Module | Public surface | Notes |
|---|---|---|
| `services/color/ColorConverter.ts` (1631 L) | hex/RGB/HSV/HSL/LAB/LCH/OKLAB/OKLCH/CMYK, ΔE76/ΔE2000/ΔEOK, redmean, distinguish%, `normalizeDeltaEFormula` | 7 instance LRU caches (1000 each) behind an eager static singleton; static facade delegates to it |
| `services/color/ColorAccessibility.ts` | WCAG luminance, contrast ratio, AA/AAA, optimal text colour | pure, no cache |
| `services/color/ColorManipulator.ts` | brightness/saturation/hue rotate (HSV + LCh), invert, desaturate | destructures conversion results (BUG-005 hygiene) |
| `services/color/ColorblindnessSimulator.ts` | Brettel (gamma sRGB) + Machado (linear) simulation | one shared static LRU, `m:` key prefix separates models |
| `services/color/RybColorMixer.ts` | Gossett-Chen trilinear RYB cube + multi-start Newton inverse | `rgbToRyb` is the expensive one (no cache) |
| `services/color/SpectralMixer.ts` | spectral.js Kubelka-Munk wrapper | clamps ratio |
| `services/ColorService.ts` (787 L) | façade over all of the above + `getDistanceForMethod`, 6 `mixColors*`, `interpolateHue` | the one dispatch every surface shares |
| `blending/blending.ts` + `blending/conversions.ts` | `blendColors(hex1,hex2,mode,ratio)`, 6 modes, self-contained conversions | separate subpath `@xivdyetools/core/blending`; consumed by bot-logic `/mix`, `/gradient` |
| `blending/types.ts` / `index.ts` | `BlendingMode`, `BLENDING_MODES`, `isValidBlendingMode` | also re-exported by discord-worker preferences |
| `utils/index.ts` | `LRUCache`, `clamp`, `round`, `isValid{HexColor,RGB,HSV}`, `sleep`/`retry`/`isAbortError`, `abbreviateDyeName`, `generateChecksum` | |
| `utils/kd-tree.ts` | `KDTree` (3-D, NN + within-distance) | **not** barrel-exported; used only by `DyeDatabase`/`DyeSearch` for `matchingMethod: 'rgb'` |
| `constants/index.ts` | RGB/HSV bounds, `COLOR_DISTANCE_MAX`, Brettel/Machado matrices, `PATTERNS.HEX_COLOR`, Universalis config | |
| `types/index.ts` | `MatchingMethod` (6), `MATCHING_METHODS`, `MATCHING_METHOD_TAGS`, `LEGACY_MATCHING_METHOD_MAP`, `isMatchingMethod`, `normalizeMatchingMethod` | migration seam for KV / localStorage / `?algo=` / API bodies |
| `index.ts` (barrel) | exports `ColorService`, `ColorConverter`, the matching vocabulary, constants, the `utils` helpers. **Does not export** `KDTree`, `LRUCache`, `ColorAccessibility`, `ColorManipulator`, `ColorblindnessSimulator`, `RybColorMixer`, `SpectralMixer`, `normalizeDeltaEFormula` — those reach consumers only through `ColorService`/`ColorConverter`. `blending/` is a separate subpath export. | |

## 2. Candidates

---

### core-color-01 — BUG — **HIGH** — `packages/core/src/blending/conversions.ts:142-153`

**Claim:** `rgbToRyb()` never redistributes the leftover green into the yellow channel, so every colour whose green channel exceeds its red channel loses all of its green and blends as blue.

**Failing input → wrong outcome:** `blendColors('#00FF00', '#00FF00', 'ryb')` → **`#0000ff`** (blending a colour with itself must return that colour). Verified numerically against a verbatim transcription of both functions:

| in | RYB (r,y,b) | round-trip out |
|---|---|---|
| `#00ff00` pure green | 0.000 / **0.000** / 1.000 | `#0000ff` |
| `#00ffff` cyan | 0.000 / **0.000** / 1.000 | `#0000ff` |
| `#008080` teal | 0.000 / **0.000** / 0.502 | `#000080` |
| `#228b22` forest green | 0.133 / 0.133 / 0.545 | `#22228b` |
| `#6bcb77` (used in the tests) | 0.420 / 0.420 / 0.796 | `#6b6bcb` |
| `#34d399` (used in the tests) | 0.204 / 0.204 / 0.827 | `#3434d3` |
| `#ff0000`, `#ffff00`, `#0000ff`, `#808080` | — | exact (red-dominant / achromatic are unaffected) |

The reference Gossett/"Sugar" RYB algorithm has two steps this code drops: `if (b && g) { b /= 2; g /= 2; }` and **`y += g; b += g;`**. Only `b += g` survives here (folded into `b__ = (b_ + (g_ - y)) / 2`); `y` is returned as `Math.min(r_, g_)` unchanged. `g_ - y > 0` exactly when green beats red — i.e. every green, cyan and teal. Adding the two missing steps makes all eleven vectors above round-trip exactly and makes blue + yellow → `#008000`, which is the entire stated point of the mode.

**Reachable path:** `blendColors(..., 'ryb', ...)` — `packages/bot-logic/src/commands/mixer.ts:114` (`/mix`, five-ratio sweep, then `findClosestDyeExcludingFacewear` on the wrong hex) and `packages/bot-logic/src/commands/gradient.ts:212` (`/gradient`, RYB mode). The bot renders a blue card and matches the wrong dye for any green input.

**Why tests miss it:** see core-color-02. **Covered by test: no.**

```ts
// conversions.ts:140-153
  const mg = Math.max(r_, g_, b_);
  const y = Math.min(r_, g_);
  const r__ = r_ - y;
  const b__ = (b_ + (g_ - y)) / 2;          // leftover green folded into BLUE only
  const n = Math.max(r__, y, b__) / Math.max(mg, 0.001);
  return { r: r__ / Math.max(n, 0.001) + w,
           y: y     / Math.max(n, 0.001) + w,   // <- never receives (g_ - y)
           b: b__ / Math.max(n, 0.001) + w };
```

**Fix direction:** restore the two dropped steps in `rgbToRyb` and their inverses in `rybToRgb` (`y += g` / `b += g`, and the paired `b,g` halve/double) — this is a bug fix *inside* `blending/conversions.ts`, **not** the `RybColorMixer` unification declined in `DEPRECATIONS.md`; the recorded deltas in `conversions.equivalence.test.ts` will need their RYB row re-pinned.

---

### core-color-02 — UNTESTED — **HIGH** — `packages/core/src/blending/blending.test.ts:57-68, 101-121`

**Claim:** every identity / round-trip assertion in the blending suite explicitly excludes `'ryb'`, so core-color-01 is invisible.

- `bijectiveModes` at lines 37 and 102 list `rgb, lab, oklab, hsl, spectral` — RYB is removed with the comment *"RYB uses an approximate conversion — round-trip is lossy"*.
- The replacement ratio test (57-68) asserts only `dist0 < dist1` — true even when both outputs are the wrong hue.
- The replacement self-blend test (114-120) asserts only `rgb.r > 50 && rgb.b > 100` for `#8B5CF6`; the actual output is `#BA5CF6` (r moves 139 → 186) and it passes.
- `conversions.test.ts:167-222` tests RYB with range checks (`>= 0 && <= 1`) and black only — no round-trip block, unlike LAB/OKLAB/HSL which all have one.
- `conversions.equivalence.test.ts:263-267` ("RYB blending would move on essentially every pair") pins `blendColors('#e4dfd0','#656565','ryb',0) === '#e4dfd0'` — `#e4dfd0` is red-dominant (228 > 223), the one family the bug does not touch.

**Behaviour the tests were supposed to catch:** blending a colour with itself, or at ratio 0/1, returns that colour.
**Fix direction:** after core-color-01, add `'ryb'` to both `bijectiveModes` lists and add a green/cyan vector (`#00FF00`, `#008080`) to `conversions.test.ts`'s round-trip corpus.

---

### core-color-03 — BUG — **MEDIUM** — `packages/core/src/types/index.ts:91-93`

**Claim:** `normalizeMatchingMethod` uses the `in` operator on an object literal, so `Object.prototype` keys resolve through the prototype chain and the documented "anything else falls back to the default" does not hold.

**Failing input → wrong outcome:** `normalizeMatchingMethod('toString')` returns the **function** `Object.prototype.toString`, not `'ciede2000'`. Same for `constructor` (→ `Object`), `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `__proto__` (→ an object). Verified by running the exact expression.

Downstream: `ColorService.getDistanceForMethod` (`services/ColorService.ts:180-193`) is a switch over the six literals **with no `default:` case**, so it falls off the end and returns `undefined` — every ΔE readout blanks — and `MATCHING_METHOD_TAGS[method]` is `undefined` too. (`DyeSearch.calculateDistance:73` and `CharacterColorService:294` both *do* have a `default:` and are safe.)

**Reachable path:** the raw `?algo=` URL param is passed in unfiltered at `apps/web-app/src/components/mixer-tool.ts:690`, `swatch-tool.ts:3001` and `gradient-tool.ts:381`, and the value is then persisted via `ConfigController.setConfig`. `harmony-tool.ts:492` is accidentally safe (`.toLowerCase()`), and og-worker is defended by the `VALID_ALGORITHMS` allowlist in `og-params.ts:50`.

**Why tests miss it:** `types/__tests__/matching-method.test.ts:99-108` enumerates `undefined, null, 42, {}, 'not-a-method', ''` — no prototype key. **Covered by test: no.**

```ts
// types/index.ts:89-95
export function normalizeMatchingMethod(value: unknown): MatchingMethod {
  if (isMatchingMethod(value)) return value;
  if (typeof value === 'string' && value in LEGACY_MATCHING_METHOD_MAP) {  // walks Object.prototype
    return LEGACY_MATCHING_METHOD_MAP[value];
  }
  return DEFAULT_MATCHING_METHOD;
}
```

**Fix direction:** `Object.prototype.hasOwnProperty.call(LEGACY_MATCHING_METHOD_MAP, value)` (or build the map with `Object.create(null)` / a `Map`), and add a `default:` arm to `getDistanceForMethod` so the type hole cannot produce `undefined`.

---

### core-color-04 — UNTESTED — **MEDIUM** — `packages/core/src/__tests__/integration/performance-benchmarks.test.ts:76-82`

**Claim:** the LRU-cache benchmark's skip guard is the exact negation of its only assertion, so the test is green whether the cache works or not.

**Failing state → wrong outcome:** delete the `hexToRgb` cache entirely → `speedup ≈ 0` → `isCoverageMode` is `true` → the assertion is skipped → test passes. There is no `else` branch and no failure path.

```ts
const speedup = (time1 - time2) / time1;
const isCoverageMode = time1 > 5 || speedup <= 0.25;   // <- includes the failure condition
if (!isCoverageMode) {
  expect(speedup).toBeGreaterThan(0.25);               // can only run when already true
}
```

**Behaviour it was supposed to catch:** a regression in `ColorConverter`'s hex→RGB LRU caching. **Covered by test: no (it is the test).**
**Fix direction:** assert cache *behaviour* rather than wall-clock — e.g. `getCacheStats().hexToRgb` after N distinct colours, plus a counted-call spy — and keep the timing line as a non-gating `console` note, or drop the coverage-mode escape and use `it.skipIf(process.env.COVERAGE)`.

---

### core-color-05 — UNTESTED — **MEDIUM** — `packages/core/src/services/color/__tests__/ColorConverter.test.ts` (whole file, 1534 L)

**Claim:** the BUG-005 cache-poisoning fix has no regression test — nothing asserts that a returned object is a copy.

Six `return { ...cached }` sites in `ColorConverter.ts` (196, 279, 362, 424, 592, 1048) plus two in `ColorblindnessSimulator.ts` (64, 135) exist solely to stop a caller mutating a process-wide cached object. Deleting all eight spreads leaves the suite green: the only object-identity assertions in the whole `services/color/__tests__` tree are `ColorblindnessSimulator.test.ts:37` (the `visionType === 'normal'` pass-through, which never touches the cache) and string comparisons.

**Failing state → wrong outcome:** with the spreads removed, `const a = ColorConverter.hexToRgb('#FF0000'); a.r = 0;` then any later `hexToRgb('#FF0000')` in the same isolate returns `{r:0,...}` — the original HIGH bug. No test observes it.
**Fix direction:** one test per cached converter: call twice, mutate the first result, assert the second is unchanged and `not.toBe` the first.

---

### core-color-06 — UNTESTED — **MEDIUM** — `packages/core/src/utils/__tests__/kd-tree.test.ts:45, 60, 75, 158`

**Claim:** the k-d tree has no brute-force parity test, and its "Performance" case's only correctness assertion passes on `null`.

`nearestNeighbor` returns `Point3D | null`; vitest's `toBeDefined()` is `!== undefined`, so `expect(null).toBeDefined()` **passes**. At line 158 that is the sole correctness check — an implementation that returned `null` for every query would pass the whole `Performance` block, and the `excludeData` test (line 75-76, `expect(nearest?.data).not.toBe('red')`) as well. The three `Construction` tests assert only `isEmpty()`, so any median/split error is invisible.

I verified the implementation itself is **correct**: 4,000 randomised trials (n = 1–40, coordinate ranges 4 / 20 / 256 to force heavy duplicates, with and without an `excludeData` predicate) gave 0 nearest-neighbour mismatches, 0 within-distance set mismatches, and 0 lost nodes versus brute force. The gap is coverage, not behaviour.

**Fix direction:** add a seeded randomised parity test (kd-tree vs linear scan) covering duplicates, ties, exclusions and `pointsWithinDistance`; replace `toBeDefined()` with `toBeNull`/`not.toBeNull` where nullability is the point.

---

### core-color-07 — UNTESTED — **MEDIUM** — `packages/core/src/services/color/__tests__/ColorManipulator.test.ts`

**Claim:** 14 tests assert only `expect(result).toBeDefined()` on functions that always return a string, so their named behaviour is never checked.

Lines 22, 53, 58, 72-73, 79, 105, 111, 118, 125, 202, 206, 232, 238, 244 (plus 183/189/195, which add only a hex-shape regex). Titles that assert nothing:

- `'should rotate red to green (120°)'` (102-106) and `'should rotate red to blue (240°)'` (108-112) — no channel check
- `'should return grayscale when decreasing saturation by -100'` (50-54) — no R===G===B check
- `'should return white when increasing black brightness to 100'` (19-23)
- `'should preserve hue and brightness'` (67-74) and `'should preserve saturation and brightness'` (114-120, only `not.toBe(original)`)
- `'should preserve brightness'` (199-210) — asserts `brightResult.localeCompare(darkResult) !== 0`, i.e. "two different strings"

**Behaviour they were supposed to catch:** making `rotateHue` return its input unchanged keeps 6 of these green; making `desaturate` a no-op keeps 3 green.
**Fix direction:** replace `toBeDefined()` with the assertion the title promises (hue ≈ 120 via `hexToHsv`, `r === g === b`, `v` preserved).

---

### core-color-08 — BUG (doc) — **LOW** — `packages/core/src/services/color/RybColorMixer.ts:137`

**Claim:** the `rybToRgb` JSDoc example states an output the function has never produced.

```ts
 * RybColorMixer.rybToRgb(0, 255, 255) // Returns { r: 0, g: 255, b: 89 }
```
Actual: `(0,1,1)` lands exactly on `RYB_CORNERS['0,1,1'] = {r:0, g:0.66, b:0.2}` → `{ r: 0, g: 168, b: 51 }`, which is what `__tests__/RybColorMixer.test.ts:55-61` pins. Doc contradicts both code and test. **Fix:** correct the example to `{ r: 0, g: 168, b: 51 }`.

---

### core-color-09 — BUG (doc) — **LOW** — `packages/core/src/services/ColorService.ts:21`

**Claim:** the module-header example calls `ColorService.rgbToHsv(rgb)` with a single RGB object, but the signature is `rgbToHsv(r: number, g: number, b: number)` (line 114). Copying the example is a TypeScript error. **Fix:** `ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b)`.

---

### core-color-10 — BUG — **LOW** — `packages/core/src/services/ColorService.ts:566-575`

**Claim:** `mixColorsRgb` is the only mixer that neither clamps `ratio` nor gamut-clamps its output, so an out-of-range ratio throws where the five siblings return a colour.

`mixColorsRgb('#000000', '#FFFFFF', 1.5)` → `Math.round(0 + 255*1.5) = 383` → `rgbToHex` → `isValidRGB` false → `AppError(INVALID_RGB_VALUE)` thrown. `mixColorsRyb` (`RybColorMixer.mixColors:103`) and `mixColorsSpectral` (`SpectralMixer.mixColors:48`) clamp; `mixColorsLab`/`mixColorsOklab`/`mixColorsHsl` are saved by the clamp inside their inverse conversions. All six carry the identical JSDoc `@param ratio Mix ratio (0 … 1)`. `blendColors` clamps (`blending.ts:51`).
**Covered by test: no.** **Fix:** `ratio = clamp(ratio, 0, 1)` at the top of `mixColorsRgb` (or in all six, for one contract).

---

### core-color-11 — BUG (doc) — **LOW** — `packages/core/src/services/color/ColorConverter.ts:325-332` vs `:340`

**Claim:** `normalizeHue`'s doc says it "Also handles negative values and values >= 360", but its HSV caller rejects those inputs first. `hsvToRgb(-10, 50, 50)` throws `AppError` at line 340 (`isValidHSV` requires `h >= 0 && h <= 360`) before `normalizeHue` runs, so on that path the wrap branch is unreachable (it is live for `hslToRgb:1443`, which does not validate). `ColorManipulator.rotateHue:45` pre-normalises for the same reason. **Fix:** scope the comment to the HSL path, or move the normalisation ahead of the guard so the documented tolerance is real.

---

### core-color-12 — REFACTOR — **LOW** — `packages/core/src/services/CharacterColorService.ts:294`

DISTINGUISH % is rescaled with the literal `4.416729559` where `ColorConverter.getDistinguishabilityPercent` (`ColorConverter.ts:535`) and `DyeSearch.calculateDistance:65` both divide by `COLOR_DISTANCE_MAX` from `constants/index.ts:35`. Three copies of one quantity, one of them hardcoded to 9 dp. **Fix:** import `COLOR_DISTANCE_MAX`.

---

### core-color-13 — OPT — **LOW** — `packages/core/src/services/color/RybColorMixer.ts:170-244`

`rgbToRyb` runs 9 multi-start Newton candidates × 20 iterations, each iteration costing 1 + 6 `trilinearInterpolate` calls (7 `lerpRgb` each) — up to ~1,260 trilinear evaluations per call when the target is outside the RYB gamut (greens, cyans — exactly the colours that never converge to `tolerance`). It is the only conversion in the package without an LRU cache, while the far cheaper `rgbToOklab` got one under OPT-001. `ColorService.mixColorsRyb` calls it twice per mix, and the web-app mixer calls that per slider tick. Also, `bestRyb` is only updated *before* each Newton step, so the 20th iterate is always discarded. **Fix:** add an `LRUCache<string, RYB>` keyed `${r},${g},${b}` mirroring `rgbToOklabCache`.

---

## 3. POSITIVE — do not re-file

- **CIEDE2000 is exactly right.** `ColorConverter.getDeltaE2000` (755-853) reproduces all 34 Sharma/Melgosa reference pairs with a worst absolute error of 4.95e-5 — including the `Rt` rotation pairs (18-21), the `C1p*C2p === 0` guards and both hue-wrap branches.
- **The k-d tree is correct**, including median splits over heavy duplicate runs, the `<=` far-side pruning bound, and `excludeData`: 4,000 randomised brute-force parity trials, 0 mismatches on both `nearestNeighbor` and `pointsWithinDistance`.
- **BUG-005 (cache handing out mutable references) has not regressed.** All eight cached returns spread-copy, `hexToHsv`/`hexToLab` store an object distinct from the sibling cache's, and a repo-wide grep for mutation of a conversion result (`hsv.h +=`, `rgb.r =`, …) outside tests found nothing.
- **The ΔE alias seam holds.** Every `formula === 'ciede2000'` comparison in the repo (`HarmonyGenerator.ts:230/240/419/435`) sits *after* a `normalizeDeltaEFormula` call, and the one caller that still spells it `'cie2000'` (`bot-logic/src/commands/harmony.ts:184`, plus web-app's accessibility tool) folds correctly. No raw-string `===` trap survives.
- **`classifyBandTier`** (`config/band-vocabulary.ts:135-156`) rounds to display precision *before* comparing and uses a consistently exclusive `<` at every cut; `deriveDistinguishCuts` is the single legal RGB-DIST→DISTINGUISH derivation. No off-by-one.
- **`isValidHexColor` is anchored** (`PATTERNS.HEX_COLOR = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/`) with a pre-regex length guard, and `normalizeHexKey` is the single source of truth for both cache key and parse source, so 3-digit / lowercase / duplicate-`#` inputs cannot desynchronise them.
- **`rgbToHex` cannot emit a malformed channel**: `isValidRGB` bounds the input to [0,255] before `Math.round`, so no 256/-1 → 3-char channel is reachable; `xyzToRgb`/`oklabToRgb`/`hslToRgb`/`cmykToRgb` all clamp.
- **`hsvToRgb` hue wrap is right**: `normalizeHue(360) === 0`, and the cache key is built from the normalised, 2-dp-rounded hue so 359.9999 and 0.0001 cannot thrash the cache (CORE-BUG-001).

## 4. REJECTED

- *k-d tree median split mishandles duplicates / prunes with the wrong metric* — brute-force parity clean over 4,000 trials; both pruning bounds are the correct axis distance and use `<=`.
- *`k` larger than the point set / ties* — `KDTree` has no k-NN API; `pointsWithinDistance` returns everything in range, sorted, and `results.sort((a,b) => a.distance - b.distance)` never sees `undefined`.
- *k-means++ with fewer pixels than k* — `PaletteService.ts:266` clamps via `effectiveK = Math.min(k, pixels.length)`, and `kMeansPlusPlusInit:159-163` has an explicit `totalDistanceSquared === 0` all-duplicates branch.
- *`samplePixels` step arithmetic at small `maxSamples`* — the 0/0 → NaN case is already fixed and guarded (`PaletteService.ts:387-395`, BUG-044): `maxSamples < 2` is clamped with a warning.
- *`getDeltaE` defaulting to `'cie76'` while `DEFAULT_MATCHING_METHOD` is `'ciede2000'`* — no production caller relies on the default; every call site passes an explicit formula, and the mismatch is documented at `apps/web-app/src/components/harmony-tool.ts:1509`.
- *`LRUCache.get` returns `undefined` for a stored `undefined` value* — no call site stores `undefined`; every value is an object or a branded string.
- *`new ColorConverter({ cacheSize: 0 })` still caches one entry* — `LRUCache.set` evicts then inserts, so capacity 0 behaves as 1. No caller passes 0 outside `ColorConverter.test.ts:39`.
- *`generateChecksum` collides `hash` with `-hash` via `Math.abs`* — non-cryptographic by contract, used only for cache validation.
- *`ColorAccessibility` uses the WCAG 0.03928 linearisation threshold while `ColorConverter` uses the sRGB-spec 0.04045* — both are accepted spellings of the same curve; the delta is < 1e-6 and WCAG mandates 0.03928 for contrast.
- *`interpolateHue('longer')` returns a 0° arc for identical hues* — mathematically ambiguous, no caller passes `'longer'`.
- *`HarmonyGenerator` silently computes ΔE76 when handed `'oklab'`* (`:240`, `:435` — the ternary only special-cases `'ciede2000'`) — latent only: `deltaEFormula` is set from exactly one call site (`bot-logic/src/commands/harmony.ts:184`, `'cie2000'`), so `'oklab'` is unreachable today.
- *`blending/conversions.ts` diverging from `ColorConverter`* — declined in `DEPRECATIONS.md`; the deltas are deliberately pinned by `conversions.equivalence.test.ts`. core-color-01 is a bug **inside** the blending copy, not a unification proposal.
- *`packages/core/src/types/__tests__/{types,index}.test.ts` are 1,001 lines of near-duplicate suites testing `@xivdyetools/types`' `createHexColor`/`createDyeId`/`AppError` from inside core, duplicating `packages/types/src/color/branded.test.ts` and `error/app-error.test.ts`* — real duplication, but it belongs to the dead-code/test-hygiene lane rather than this deep dive, and core's own `types/index.ts` is separately covered by `matching-method.test.ts`.

## 5. COVERED — 33 files read

**Scope, non-test (17):** `services/ColorService.ts`, `services/color/ColorConverter.ts`, `services/color/ColorAccessibility.ts`, `services/color/ColorManipulator.ts`, `services/color/ColorblindnessSimulator.ts`, `services/color/RybColorMixer.ts`, `services/color/SpectralMixer.ts`, `blending/blending.ts`, `blending/conversions.ts`, `blending/types.ts`, `blending/index.ts`, `utils/index.ts`, `utils/kd-tree.ts`, `constants/index.ts`, `types/index.ts`, `types/spectral-js.d.ts`, `index.ts`.

**Scope, tests skimmed (13):** `blending/blending.test.ts`, `blending/conversions.test.ts`, `blending/conversions.equivalence.test.ts`, `blending/types.test.ts`, `services/color/__tests__/{ColorConverter,ColorManipulator,ColorAccessibility,ColorblindnessSimulator,RybColorMixer,SpectralMixer}.test.ts`, `utils/__tests__/{kd-tree,utils}.test.ts`, `types/__tests__/matching-method.test.ts` (+ `types/__tests__/{types,index}.test.ts` headers), `__tests__/integration/performance-benchmarks.test.ts`.

**Read to confirm a claim (outside scope):** `config/band-vocabulary.ts`, `services/dye/HarmonyGenerator.ts`, `services/dye/DyeSearch.ts`, `services/CharacterColorService.ts`, `services/PaletteService.ts`, `services/dye/DyeDatabase.ts` (KDTree use), `packages/bot-logic/src/commands/{mixer,gradient,harmony}.ts`, `apps/og-worker/src/{og-params,og-data-generator}.ts` + `services/svg/dye-helpers.ts`, `apps/web-app/src/components/{mixer,swatch,gradient,harmony}-tool.ts` (algo-param sites), `apps/discord-worker/src/services/preferences.ts`.

**Method note:** three claims were checked numerically by transcribing the functions verbatim into scratch scripts outside the repo and running them under node — the RYB round-trip table (core-color-01), the 34-pair Sharma CIEDE2000 check, and the 4,000-trial k-d tree brute-force parity. No repo file was modified, and no test, build, install or git command was run.
