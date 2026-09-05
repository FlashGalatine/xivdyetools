# Perceptual / colour-science wheels for Harmony Explorer

Research slice 02. Date: 2026-09-04. All browser-support numbers are from primary sources (webstatus.dev / MDN BCD / caniuse-db) fetched on that date.

---

## 0. What the repo already has (read-only survey)

Three facts change the cost model before any research is applied:

1. **`@xivdyetools/core` already ships every conversion needed for OKLCH and CIELCH.**
   `packages/core/src/services/color/ColorConverter.ts` has `hexToOklch`/`oklchToHex`/`rgbToOklch`/`oklchToRgb` (lines ~1149–1235) and `hexToLch`/`lchToHex`/`labToLch`/`lchToLab` (lines ~1237–1360), plus Lab, HSL, HSV, CMYK. `packages/core/src/blending/conversions.ts` additionally has `rgbToRyb`/`rybToRgb`. **No new npm dependency is required for OKLCH or CIELCH.**

2. **A hue-rotation-in-space helper already exists — and it is wrong.**
   `packages/core/src/services/dye/HarmonyGenerator.ts` defines `export type HarmonyColorSpace = 'hsv' | 'oklch' | 'lch' | 'hsl'` and a private `rotateHueInSpace()` (line 456) that does exactly the naive thing:

   ```ts
   case 'oklch': {
     const oklch = ColorConverter.hexToOklch(hex);
     return ColorConverter.oklchToHex(oklch.L, oklch.C, (oklch.h + offset + 360) % 360);
   }
   ```

   `oklchToHex` → `oklchToRgb` → `oklabToRgb`, which ends in `clamp(this.linearToSrgb(rLin), RGB_MIN, RGB_MAX)` — **per-channel clipping, no gamut mapping**. Sections 6–7 show what that costs: up to a **50.6° hue error** on a saturated base.

3. **That path is currently dead for harmony, and the convergent path is HSV-only.**
   `packages/core/src/services/dye/HarmonySelector.ts` → `generateHarmonySlots()` is the single shared algorithm (web-app, discord-worker, og-worker) and hard-codes `ColorService.hsvToHex(targetHue, baseHsv.s, baseHsv.v)` at line 208. `apps/discord-worker/src/commands/schemas.test.ts` (lines 114–124) asserts that `/harmony` **no longer registers** a `color_space` option, with the comment: *"`generateHarmonySlots` rotates hue in HSV, and that IS the shared algorithm, so offering another space would be offering a different answer than the page gives."* Shipping wheels means threading a space parameter through `generateHarmonySlots`, not through `HarmonyGenerator.rotateHueInSpace`.

---

## 1. OKLCH (Björn Ottosson, December 2020)

**What it is / who uses it.** Oklab is a Lab-shaped space whose parameters were fitted by Ottosson against three datasets: lightness and chroma pairs generated with CAM16 inside Pointer's Gamut, and **the Ebner–Fairchild constant-hue data that was used to derive IPT**. Its reported RMS errors against those sets are Lightness 0.20 / Chroma 0.81 / Hue 0.49, versus CIELAB's 1.70 / 1.84 / 0.69 and IPT's 4.92 / 2.18 / 0.48. OKLCH is its cylindrical form. It is the CSS Color 4 default interpolation space, the default space for ColorAide's harmony module, and the space the CSSWG chose for its gamut-mapping algorithm.

**Hue definition, sRGB primaries.** Hue is `atan2(b, a)` on the Oklab opponent plane. Pure sRGB red is ≈ **29.2°** (this number is already in the repo's own doc comment on `rgbToOklch`), so the RGB corners are *not* at 0/120/240 — see Table E. Chroma is unbounded and gamut-dependent: at L = 0.65 sRGB allows C = 0.2963 at h = 330° (magenta) but only C = 0.1109 at h = 195° (cyan) — a 2.67× swing around the circle (Table D).

**The "Oklab blue" behaviour.** The problem Oklab was built to fix is CIELAB's: a blue detours through purple as you change its lightness or chroma at constant Lab hue angle. Hung & Berns (1995) measured constant-hue loci on a CRT and found CIELAB/CIELUV/Hunt all showed large errors around the blue primary — a hue shift equating to 30 ΔE or more. Raph Levien's independent interactive review concludes IPT, ICtCp and Oklab are all "a huge improvement over CIELAB" on hue linearity, and prefers Oklab overall for its better lightness and chroma prediction. Oklab is not perfect — Levien notes the cube-root transfer makes the black-to-white ramp slightly dark — but for hue rotation specifically it is the best-supported, best-tooled option. Note that Oklab post-dates the main academic comparisons (Zhao & Luo 2020 compared CIELAB, CAM16-UCS, IPT and Jzazbz and did *not* include Oklab); since Oklab's hue was fitted to the IPT dataset, IPT's good result is the closest published proxy. **Flagged as inference, not a measured result.**

**Drawing the ring.** Two options, and they are not equivalent:

- *Constant L and C.* `conic-gradient(in oklch longer hue, oklch(65% 0.15 0), oklch(65% 0.15 360))` gives a genuinely iso-lightness ring, but at any C worth looking at, large hue arcs fall outside sRGB. CSS Images 4 says intermediate polar-space colours "fall out of gamut; they will then be gamut mapped" — **but no browser implements CSS Color 4 gamut mapping; they clip**. The interop issue web-platform-tests/interop#443 states plainly: *"CSS Color 4 describes how out-of-gamut colors must be mapped to an RGB destination, however no browser currently implements this,"* and notes that because the syntax parses fine, *"it is not possible to use feature detection."* It was proposed for Interop 2024 and **not** selected — the announced 17 focus areas include Relative Color Syntax (which carries some out-of-gamut tests) but no gamut-mapping area. A clipped ring goes flat and dark across the blues.
- *Max-in-gamut chroma per hue.* Compute the sRGB cusp chroma for each hue at the chosen L and emit an explicit hex per stop. This is what makes a ring look like a colour wheel rather than a muddy band, and it is the only option that can be made byte-identical between the CSS ring and the resvg ring.

**Okhsl / Okhsv — the missing piece for the ring.** Ottosson followed Oklab with two gamut-normalised cylindrical spaces (2021). **Okhsv** finds the sRGB *cusp* (max chroma) for each hue and remaps the triangular gamut slice into a square, so `s = 1, v = 1` sits exactly on the gamut boundary for every hue. **Okhsl** instead interpolates three chroma scaling values (C₀, C_mid, C_max) so gamut unevenness is pushed out to s ≈ 1 and the interior stays smooth; Ottosson: *"I believe Okhsl delivers a better overall compromise, and keeps many of the benefits of Lab-like color spaces, without the complexity of an irregular shape."* Reference C++ is MIT-licensed, with a JS implementation in his demo picker. **This is the right model for the wheel graphic**: draw the ring in Okhsl at s = 1 and it is perceptually hue-uniform *and* automatically in-gamut at every angle — no per-stop gamut mapping, no clipped blue band. Keep OKLCH for the harmony *arithmetic* (rotate at true constant L and C, then gamut-map the target); use Okhsl only for the ring's paint. Effort: **S–M** (the cusp/`find_gamut_intersection` helpers are ~80 lines of published MIT code).

**How many stops.** See Table G. Browsers interpolate linearly *in the declared space* between stops, so with `in oklch` a modest stop count already lands under one JND; with plain hex stops (interpolating in sRGB by default) you need more. oklch.com does not use CSS gradients at all for its charts — its `package.json` lists `three` (WebGL) and `@colordx/gpu` plus `delaunator`, i.e. GPU pixel painting; repo is MIT.

**Browser support (webstatus.dev, 2026-09-04).**

| Feature | Baseline | Chrome/Edge | Firefox | Safari |
|---|---|---|---|---|
| `oklab()` / `oklch()` (feature id `oklab`) | **Widely available**, low 2023-05-09, high 2025-11-09 | 111 (2023-03-07) | 113 (2023-05-09) | 15.4 (2022-03-14) |
| Gradient interpolation incl. `in oklch` + `longer hue` (`gradient-interpolation`) | **Newly available** since 2024-06-11; Widely expected 2026-12-11 | 111 (2023-03-07) | 127 (2024-06-11) | 16.2 (2022-12-13) |

caniuse's nearest feature, "LCH and Lab color values" (`lch()`/`lab()`, first shipped Chrome 111 / Firefox 113 / Safari 15), reports **93.28% global `y` support** — a good proxy for `oklch()`, which shipped in the same releases, though not literally the same feature row. So `conic-gradient(in oklch longer hue, …)` **is** usable in production today; the risk is not syntax support, it is the clipping behaviour above.

---

## 2. CIELCH(ab)

**What it is.** Cylindrical CIELAB, 1976, the industry default for 40 years. Hue = `atan2(b*, a*)`, L* 0–100, C* typically 0–130.

**Why it is the cautionary tale.** Hung & Berns (1995), "Determination of constant hue loci for a CRT gamut and their predictions using color appearance spaces" (*Color Res. Appl.* 20(5) 285–295; dataset archived at Zenodo 3367463) measured 24 constant-hue loci with nine observers at 132 positions and found CIELAB's iso-hue lines bend badly in blue. Ebner & Fairchild (1998, CIC6 pp. 8–13) built IPT specifically to fix that, and Oklab was later fitted to their data. Evil Martians demonstrate the practical symptom: at LCH hue 300, reducing chroma walks blue → purple, while OKLCH holds the hue.

**Verdict for a harmony wheel.** CIELCH is worth offering only as a *comparison* wheel — "this is what the classic Lab wheel gives you" — not as a recommended default. Its complements of blue land somewhere different from OKLCH's precisely because its blue hue angle is wrong. Zero incremental cost (`hexToLch`/`lchToHex` already exist), so it is nearly free to expose; the honest framing is "legacy perceptual wheel".

---

## 3. CAM16 / HCT (Material You)

**What it is.** HCT = **H**ue and **C**hroma from the CAM16 colour appearance model, **T**one = CIELAB (D65) L*. ColorAide: *"it is two color spaces glued together."* It is the hue Google's Material You theming runs on; `material-color-utilities`' `blend.ts` `harmonize()` rotates a design colour's HCT hue toward a key colour's, capped at `Math.min(differenceDegrees * 0.5, 15.0)` degrees — real, shipped precedent for hue arithmetic in CAM16 hue.

**Availability and licence.** `@material/material-color-utilities` v0.4.0 on npm, **Apache-2.0** (verified from the repo's `package.json` and `LICENSE`). Apache-2.0 is compatible with an MIT-ish monorepo but adds a NOTICE/attribution obligation and a patent grant — a legal-hygiene item, not a blocker.

**What it buys over OKLCH for a harmony wheel: essentially nothing, at real cost.**
- CAM16 is a *viewing-conditions* model. Its extra fidelity comes from adapting to surround/luminance/degree-of-adaptation, none of which a dye picker knows or controls.
- On the specific axis we care about — hue linearity — CAM16-UCS was **outperformed by IPT and Jzazbz**, especially in blue (Zhao & Luo, JOSA A 37(5) 865, 2020). Oklab's hue is IPT-derived. So HCT would plausibly be *worse* at exactly the job.
- ColorAide documents the cost asymmetry: forward conversion is marginally more expensive than CAM16, but *"in the reverse direction (from HCT) the conversions are much more expensive"* because HCT discards CAM16 lightness for CIELAB L*, so inverting requires an iterative solve. A harmony wheel is reverse-heavy (we synthesise `HCT → hex` for every ring stop and every rotated target).

**Recommendation: skip.** Adding ~15 KB and an iterative inverse for a hue that is measurably not better than the one already in `core` is a bad trade, particularly with the discord-worker bundle running at 2,632 KiB gzip against a 3,072 KiB limit.

---

## 4. IPT, ICtCp, Jzazbz, Munsell renotation — one paragraph each

**IPT** (Ebner & Fairchild, CIC 1998). Cone-response-difference space built expressly for hue uniformity; eight constant-hue surfaces were measured to fit it. It is the *ancestor* of Oklab's hue: Ottosson fitted Oklab's hue to Ebner & Fairchild's dataset. Adding IPT would give a wheel whose hue is, by construction, near-identical to OKLCH's, with worse lightness (IPT lightness RMS 4.92 vs Oklab 0.20). **Redundant.**

**ICtCp** (Dolby, ITU-R BT.2100). IPT re-derived with a PQ nonlinearity for HDR; `Ct`/`Cp` are the blue-yellow and red-green axes. One survey of nine spaces found ICtCp's hue linearity the best of the set. But ICtCp's whole point is HDR/wide-gamut signal coding — its PQ curve is defined against absolute cd/m², which is meaningless for 125 fixed sRGB swatches. **Different tool, not a different wheel.**

**Jzazbz** (Safdar et al., *Opt. Express* 25(13) 15131, 2017). Also HDR/WCG-oriented; outperformed CIELAB and CAM16-UCS on iso-hue prediction and, with ICtCp, predicted blue hue with minimum variation. In Zhao & Luo's 2020 follow-up with new WCG/HDR psychophysics, **IPT and Jzazbz outperformed CIELAB and CAM16-UCS, especially in blue**. For SDR sRGB dyes, Jzazbz's hue plane behaves very much like IPT's and therefore like Oklab's. **Marginal-to-no user-visible difference; real conversion cost.**

**Munsell renotation.** The only genuinely *different* wheel in this group. It is an empirical atlas, not a formula: 5 principal hues (5R 5Y 5G 5B 5P) plus 5 intermediates, subdivided into 100 hue steps, and its complements are defined by additive mixture to a neutral of the same value. Because it is table-based, hue rotation means interpolating the renotation dataset (or shipping a fitted approximation), and its "opposite" is not the same as a 180° rotation in any Lab-like space. It is a legitimate *artist's* wheel and would be a distinct product feature — but it belongs with the RYB slice, not here, and it is an **L** effort: a renotation table plus bidirectional interpolation.

---

## 5. Hering / opponent "unique hues"

Unique red, yellow, green and blue are the four hues that observers describe as containing no trace of another hue. Miyahara et al. (2003), as reported by Wikipedia's *Unique hues*, give average hue angles of **unique red 353°, unique yellow 58°, unique green 128°, unique blue 228°**. Individual variation is large — unique green's wavelength varies by up to 70 nm between observers, well beyond what L:M cone-ratio differences predict.

Wikipedia does not say which colour space those angles are in, so Table H computes both plausible readings; the conclusion survives either. The structurally interesting fact for a harmony feature: **the unique hues are not opposite each other.** Red→green is 116–141° depending on reading and space; yellow→blue is 157–170°. So an opponent wheel built on measured unique hues cannot simultaneously place R↔G and Y↔B at 180°, which is precisely the assumption every "complementary = +180°" harmony rule makes. A four-primary opponent wheel therefore has to *warp* the hue axis so that the four cardinals sit at 0/90/180/270 and everything between is interpolated — which is exactly what the RYB artist's wheel does, by different means. Table H gives the OKLCH angles these four land on.

**Verdict:** interesting, defensible as an "opponent / Hering" wheel, but it is a *warped* wheel (a monotone remap of hue angle with four anchors), not a colour space. Implementation is S–M (a 4-anchor periodic interpolation over an existing OKLCH hue), and it is the only perceptual option that changes complements in a way a user would actually notice. Flag: the anchor angles are one study's averages with large inter-observer variance.

---

## 6. Gamut mapping — the part that actually decides the feature

Rotating hue at fixed L and C in OKLCH or CIELCH puts you outside sRGB most of the time, because the sRGB gamut is a lumpy solid, not a cylinder (Table D shows max in-gamut chroma varying by more than 2× across hue at a single lightness).

**CSS Color 4 §14 — "Binary Search Gamut Mapping with Local MINDE"** (verbatim constants from the spec source):

- Work in OkLCh. If L ≥ 100% return white; if L ≤ 0% return black; if already in gamut, return as-is.
- `JND = 0.02`, `epsilon = 0.0001`, difference metric `deltaEOK`.
- `clip(color)` = convert to destination and clamp each component to its reference range.
- If `delta(clip(origin), origin) < JND`, **return the clipped colour immediately**.
- Otherwise binary-search chroma in `[0, C_origin]`; at each step, if the candidate is out of gamut but `delta(clip(candidate), candidate) < JND`, accept the clipped version and move `min` up. Return `clipped`.

The spec's own note explains the constant: one JND in CIE Lab with ΔE2000 is 2; because Oklab's L runs 0–1 rather than 0–100, one JND with deltaEOK is 100× smaller, i.e. 0.02.

**Library support.**
- **colorjs.io** (MIT): `toGamut()` defaults to `method: "css"` — the algorithm above. `"clip"` is documented as *"not recommended."* `"lch.c"` was the pre-CSS-4 default. Their worked example: for P3 yellow, pure chroma reduction lands at C = 25 while the CSS method reaches C = 103 — a dramatic difference, and the reason pure chroma reduction is wrong for yellows.
- **culori** (MIT): `toGamut(dest='rgb', mode='oklch', delta=differenceEuclidean('oklch'), jnd=0.02)` — *"The default arguments for this function correspond to the gamut mapping algorithm defined in CSS Color Level 4."* `clampChroma()` is the plain chroma-reduction variant; `clampGamut()` is the clip.
- **Ottosson's own gamut-clipping post** compares preserve-chroma, project-to-L=0.5, project-to-L_cusp, and adaptive-L0 variants, and recommends **adaptive L0 with α = 0.05** as the default. His point about naive per-channel clipping: *"Hues are heavily distorted and all the details in the flowers are gone."*

**Which strategy for harmony targets?** Not clip, and not pure chroma reduction.

- **Clip** is what the repo does today. It silently changes hue — the whole point of choosing a perceptual wheel — and it darkens. It also makes the CSS ring and the resvg ring disagree, since browsers clip too but with their own rounding.
- **Pure chroma reduction** (`clampChroma`) preserves hue and lightness exactly, which is philosophically right for a *harmony target*, but over-desaturates yellows badly (the 25-vs-103 example).
- **CSS `css-gamut-map`** is the right default: hue and lightness are preserved to within one JND, chroma is preserved as far as the gamut allows, and it is the thing every other tool in the ecosystem now does, so our targets will agree with colorjs/culori/Chrome-eventually.

One caveat specific to *this* product: the target colour is thrown away. What the user sees is the **nearest of 125 fixed dyes by CIEDE2000**. So the gamut-mapping choice matters less than it would in a paint app — but it matters in the direction that counts, because clipping's hue error is large enough (Table B) to select a *different dye*. The pragmatic option worth considering: **skip gamut mapping for matching and rank dyes against the un-mapped OKLCH target directly** (CIEDE2000 in Lab works fine on an out-of-sRGB Lab colour), and use the gamut-mapped colour only for the swatch you draw. That is strictly more faithful and avoids the whole binary search on the hot path. Flagged as a design suggestion, not something I found precedent for.

---

## 7. Computed evidence

**Method.** All numbers below were computed for this report with hand-written conversions (Ottosson's published Oklab matrices; sRGB↔XYZ D65; CIE Lab with κ = 24389/27, ε = 216/24389; CIEDE2000 per the standard formulation), plus faithful implementations of the three gamut strategies — per-channel `clip`, pure chroma reduction, and the CSS Color 4 binary search with local MINDE (JND 0.02, ε 0.0001, ΔE_OK). Verified against reference values before use: `#FF0000` → OKLCH `0.6280 / 0.2577 / 29.234°` (matches the repo's own doc comment) and CIELCH `53.237 / 104.55 / 40.0°`; ΔE2000(`#FF0000`,`#00FF00`) = 86.61; ΔE2000(x,x) = 0.

**Cross-validated.** A second, independently written implementation (different author, same brief, CIEDE2000 additionally checked against the Sharma et al. 2005 test pairs) reproduced Tables D, E, G and H to 3–4 significant figures and Table B's `clip` and `chroma-reduce` columns exactly. Two disagreements are worth recording:

- **`css-gamut-map` vs pure chroma reduction.** My run recovered a little extra chroma via local MINDE (`#FF0000`+180° → `#009CB2`, C 0.1109); the second run returned the chroma-reduced colour unchanged (`#009AAC`, C 0.1084) in *every* case. The gap is under one JND either way. The engineering conclusion is the useful part: **for sRGB destinations, local MINDE buys almost nothing over plain chroma reduction.** colorjs.io's dramatic 25-vs-103 example is a *P3* case; sRGB's gamut is convex enough at these hues that `clampChroma` is very nearly as good. If implementation cost matters, plain chroma reduction is a defensible shortcut here — but verify against culori before committing.
- **Table F's chroma handling.** I capped chroma at the in-gamut maximum for each lightness; the second run held the base chroma fixed and clipped. Both show the drift; the magnitude differs (37.8° vs 48.7° of OKLCH hue swing across the CIELCH-constant-hue ramp). The direction and the conclusion are identical.

**Implementation trap found during that cross-check: the sRGB gamut is not star-shaped in Oklab.** Along pure blue's exact hue ray (h ≈ 264.05°) chroma goes in-gamut → out → back in at the true corner. A naive "bisect on chroma" assumes the in-gamut set along a ray is a single interval, and will return the wrong ceiling there. The CSS spec's `min_inGamut` flag exists partly for this, but any home-grown `maxChroma()` helper needs a test at that hue specifically.

### Table E — where the sRGB corners land (and how unevenly)

| Corner | HSV | OKLCH h | CIELCH h |
|---|---|---|---|
| red `#FF0000` | 0° | **29.2°** | **40.0°** |
| yellow `#FFFF00` | 60° | 109.8° | 102.9° |
| green `#00FF00` | 120° | 142.5° | 136.0° |
| cyan `#00FFFF` | 180° | 194.8° | 196.4° |
| blue `#0000FF` | 240° | 264.1° | **306.3°** |
| magenta `#FF00FF` | 300° | 328.4° | 328.2° |

Gap to the next corner (HSV is 60° everywhere by construction):

| Arc | OKLCH | CIELCH |
|---|---|---|
| red→yellow | 80.6° | 62.9° |
| yellow→green | 32.7° | 33.1° |
| green→cyan | 52.3° | 60.4° |
| cyan→blue | 69.3° | **109.9°** |
| blue→magenta | 64.3° | **21.9°** |
| magenta→red | 60.8° | 71.8° |

CIELCH squeezes blue and magenta into 21.9° while stretching cyan→blue across 109.9° — a 5× spread. OKLCH's range is 32.7–80.6°, far from even but far better behaved. **Practical consequence: on any perceptual wheel the RGB corners are not at 60° intervals, so a "triadic" +120° from red does *not* land on green.**

### Table D — maximum in-gamut chroma per hue (L = 0.65 OKLCH / L* = 65 CIELCH)

| h | OKLCH C_max | hex | CIELCH C*_max | hex |
|---|---|---|---|---|
| 0° | 0.2601 | `#FF0D89` | 61.7 | `#FF6AA0` |
| 30° | 0.2364 | `#FF3624` | 62.0 | `#FF716A` |
| 60° | 0.1524 | `#D17400` | 83.3 | `#F77C00` |
| 90° | **0.1328** | `#AF8A00` | 68.7 | `#BC9B00` |
| 120° | 0.1543 | `#849C00` | 76.6 | `#79AD00` |
| 150° | 0.1790 | `#00AC4F` | 67.8 | `#00B55E` |
| 180° | 0.1179 | `#00A692` | 42.8 | `#00B19C` |
| 195° | **0.1109** | `#00A4A4` | 38.2 | `#00B0AE` |
| 210° | 0.1124 | `#00A1B5` | **36.3**† | `#00AEBD` |
| 240° | 0.1489 | `#0099E0` | 39.6 | `#00ABDA` |
| 270° | 0.1860 | `#6483FF` | 54.4 | `#30A3FF` |
| 300° | 0.2215 | `#A664FF` | 62.4 | `#9D8FFF` |
| 330° | **0.2963** | `#E800E1` | **93.8** | `#FF54F3` |
| 345° | 0.2764 | `#F700B4` | 70.6 | `#FF63C0` |

† minimum is at 210° for CIELCH. Ratio of max to min chroma around the circle: **2.67× in OKLCH (0.1109 → 0.2963), 2.58× in CIELCH (36.3 → 93.8).** A constant-chroma ring is therefore impossible; either the ring is dull enough for the worst hue everywhere, or it clips.

### Table B — complements (+180°), all three gamut strategies

`hΔ` is the hue error of the final sRGB colour versus the intended target, measured in the space the rotation happened in.

| Base | HSV | OKLCH clip | OKLCH chroma-reduce | OKLCH **css-map** | CIELCH clip | CIELCH chroma-reduce | CIELCH **css-map** |
|---|---|---|---|---|---|---|---|
| `#FF0000` | `#00FFFF` | `#00A9DB` hΔ **+18.9°** | `#009AAC` hΔ +0.1° | `#009CB2` hΔ +2.9° | `#00A2F3` hΔ **+43.0°** | `#008CA1` hΔ +0.2° | `#008EA6` hΔ +3.2° |
| `#0000FF` | `#FFFF00` | `#A02000` hΔ **−50.6°** | `#6E5000` hΔ −0.5° | `#734F00` hΔ −5.6° | `#006000` hΔ +9.7° | `#2C5600` hΔ +0.1° | `#175900` hΔ +6.7° |
| `#FFD700` | `#0028FF` | `#B9CDFF` hΔ −7.5° | `#CFD8FF` hΔ −0.3° | `#CBD6FF` hΔ −2.0° | `#00E2FF` hΔ **−53.8°** | `#C6DBFF` hΔ +0.3° | `#BCDCFF` hΔ −9.4° |
| `#6D5440` | `#40596D` | `#425D71` hΔ +1.0° | `#425D71` | `#425D71` | `#385E72` hΔ −0.5° | `#385E72` | `#385E72` |

Three things jump out.

1. **Clipping is not a rounding error, it is a different colour.** The OKLCH complement of pure blue should be a dark olive (`#6E5000`); clipping returns `#A02000`, a dark *red*, off by 50.6°. The CIELCH complement of gold should be a pale blue; clipping returns `#00E2FF`, a vivid cyan, off by 53.8°. Both would select an entirely different dye. This is precisely what `ColorConverter.oklchToHex()` does today.
2. **Either non-clipping strategy is fine; both keep hue within a few degrees.** Pure chroma reduction is hue-exact (≤ 0.5°); the CSS map trades ~3–9° of hue for some chroma back. In sRGB that trade is small (see the cross-validation note above) — the important decision is *not clipping*, not which of the two you pick.
3. **Low-chroma bases are unaffected.** `#6D5440` (OKLCH C = 0.0453) is in gamut after rotation in *both* spaces, so all three strategies agree and HSV lands within a few units too. **The wheel choice only changes the answer for saturated bases** — a useful thing to tell users, and a useful thing to test.

### Table C — triads (+120° / +240°), HSV vs css-mapped perceptual

| Base | off | HSV | OKLCH css-map | CIELCH css-map |
|---|---|---|---|---|
| `#FF0000` | +120 | `#00FF00` | `#00A836` | `#00945B` |
| `#FF0000` | +240 | `#0000FF` | `#5577FF` | `#0080F5` |
| `#0000FF` | +120 | `#FF0000` | `#AA0011` | `#7C3A00` |
| `#0000FF` | +240 | `#00FF00` | `#006C00` | `#005850` |
| `#FFD700` | +120 | `#00FFD7` | `#67EEFF` | `#00F2FF` |
| `#FFD700` | +240 | `#D700FF` | `#FFBBF9` | `#FFC2FF` |
| `#6D5440` | +120 | `#406D54` | `#3C625B` | `#33615B` |
| `#6D5440` | +240 | `#54406D` | `#5D5470` | `#5E5570` |

**The headline product difference is lightness, not hue.** HSV preserves S and V, so red's triad is vivid green and vivid blue. OKLCH preserves L, so red (L = 0.628) gives a mid green `#00A836` and a mid periwinkle `#5577FF` — the three read as a *set*. Gold's triad goes from HSV's `#00FFD7`/`#D700FF` (vivid) to OKLCH's `#67EEFF`/`#FFBBF9` (pale, because gold is light). For matching against 125 fixed dyes this is a real behavioural change: iso-lightness targets will systematically pull toward the mid-tone dyes and away from the darkest and lightest ones.

### Table F — the blue→purple drift (why CIELCH is the cautionary tale)

Left: hold **CIELCH** hue at 306.3° (pure blue's Lab hue) and vary L*. Right: hold **OKLCH** hue at 264.05° and vary L. Chroma is capped at the in-gamut maximum in both.

| L* | hex | OKLCH hue | | L | hex | CIELCH hue |
|---|---|---|---|---|---|---|
| 20 | `#0000AC` | 264.1° | | 0.2 | `#00094A` | 301.8° |
| 30 | `#0000EF` | 264.1° | | 0.3 | `#001784` | 302.5° |
| 40 | `#562FFF` | 278.8° | | 0.4 | `#0028C3` | 302.4° |
| 50 | `#8155FF` | 288.9° | | 0.5 | `#043FFF` | 301.4° |
| 60 | `#A277FF` | 295.3° | | 0.6 | `#3A73FF` | 291.9° |
| 70 | `#BD99FF` | 299.1° | | 0.7 | `#6C9AFF` | 284.0° |
| 80 | `#D5BBFF` | 301.9° | | 0.8 | `#9DBDFF` | 278.1° |

Constant CIELAB hue walks `#0000EF` → `#D5BBFF`: blue to lavender, a **37.8° swing in OKLCH hue** while the CIELAB coordinate never moves. Constant OKLCH hue walks `#00094A` → `#9DBDFF`, which stays recognisably the same blue at every step even though the CIELAB coordinate drifts 24°. This is Hung & Berns's result reproduced in fourteen lines of arithmetic, and it is the single strongest argument for OKLCH over CIELCH.

### Table G — how many ring stops

Ring at OKLCH L = 0.65, per-hue maximum chroma, N evenly spaced hues. Values are the **worst adjacent-stop difference**.

| N | max adjacent ΔE_OK | max adjacent ΔE2000 |
|---|---|---|
| 6 (today's wheel) | 0.2433 | **44.08** |
| 12 | 0.1526 | 25.68 |
| 24 | 0.0861 | 14.64 |
| 36 | 0.0731 | 10.23 |
| 60 | 0.0433 | 6.36 |
| 72 | 0.0407 | 5.67 |
| 120 | 0.0227 | 4.00 |
| 360 | **0.0096** | **1.36** |

Read this two ways, because the two renderers differ:

- **CSS `conic-gradient`** interpolates *between* stops, so the stop count only bounds how much the browser has to invent. **N = 72 (ΔE_OK ≈ 0.04, two JND between anchors)** is comfortably smooth; N = 120 is safe with margin. Today's six-stop ring has 44 ΔE2000 between anchors, which is why it reads as a crude rainbow rather than a wheel.
- **SVG arc segments are flat-filled** — there is no interpolation, so each visible band must itself be under one JND. That needs **N ≥ 120, realistically 360** for ΔE2000 < 1.4. That is 360 `<path>` elements, which is a genuine SVG-size consideration if the card ever regains a wheel.

### Table H — unique hues are not opposite each other

Wikipedia gives Miyahara et al. (2003) averages of red 353°, yellow 58°, green 128°, blue 228° but **does not state which space those angles are in** — the Measurement section says unique hues are "typically quantified as wavelength of monochromatic light, Munsell color, or hue degree derived from a RGB color space". So I computed it both ways.

| Reading | unique R | unique Y | unique G | unique B | R→G | Y→B |
|---|---|---|---|---|---|---|
| as **CIELAB** angles (at L* 60, max C) | `#FF45A3` (OK 354.4°) | `#E76E00` (OK 50.6°) | `#51A300` (OK 135.6°) | `#009EBD` (OK 218.4°) | 135° Lab / **141.2°** OKLCH | 170° Lab / **167.8°** OKLCH |
| as **HSV** angles (at S=V=1) | `#FF001E` (OK 26.9°) | `#FFF700` (OK 107.3°) | `#00FF22` (OK 143.1°) | `#0033FF` (OK 264.1°) | 135° HSV / **116.2°** OKLCH | 170° HSV / **156.8°** OKLCH |

**The conclusion is robust to the ambiguity: under either reading, in either space, neither red↔green nor yellow↔blue is 180° apart.** Red→green is 116–141°, yellow→blue is 157–170°. A four-primary opponent wheel therefore cannot be produced by rotating any of these spaces — it requires an explicit warp that pins four anchors at 0/90/180/270 and interpolates between them.

---

## 8. Drawing the ring in two renderers

**Current state in the repo.** The web ring is `apps/web-app/src/components/v4/v4-color-wheel.ts`, and it is a hard-coded, shadow-side CSS declaration with **six segments**:

```css
background: conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red);
```

at `opacity: 0.8` behind a `radial-gradient` donut mask. It is a static sRGB wheel with no interpolation-space declaration — so it interpolates in sRGB and its stops are the RGB corners at exactly 0/60/120/180/240/300. Making it wheel-aware means replacing that literal with a computed `style` binding (and it lives inside V4LayoutShell's shadow root, so no global CSS reaches it).

On the card side, `packages/svg/src/harmony-card.ts` says in its own header comment: *"The wheel is gone entirely — it was 160,000 pixels saying less"* — **the Discord/OG harmony card no longer draws a wheel at all.** So the arc-segment work below is only needed if the card gets a wheel back; today the resvg side is a non-issue and the feature is web-only. That materially lowers the cost estimate.

- **Browser.** `conic-gradient()` with `in oklch longer hue` works everywhere that matters (Baseline Newly since 2024-06-11). But because browsers clip rather than gamut-map, do **not** hand the browser two OKLCH endpoints and let it interpolate through out-of-gamut territory. Generate N stops in JS, gamut-map each with the CSS algorithm, and emit **plain hex** stops. Then the interpolation space no longer matters much (Table G quantifies the residual), and the ring is reproducible.
- **resvg.** SVG has no conic gradient — mesh gradients were added to SVG 2 and then **deferred** out of it for lack of browser-vendor confidence, and no SVG renderer implements angular gradients. So the card ring must be N arc segments (`<path>` with `A` commands, or stroked arcs on a circle with `stroke-dasharray`). This is the constraint that sets N: the same N should drive both renderers so the web ring and the card ring are visibly the same object. From Table G, pick the smallest N whose adjacent-stop ΔE is under one JND; arc-segment count in the hundreds is cheap for resvg but bloats the SVG string, so there is a real bytes-vs-banding trade-off worth measuring against the og-worker/discord-worker size budgets.

---

## 9. Per-wheel scorecard

| | OKLCH | Okhsl (ring paint) | CIELCH(ab) | HCT (CAM16) | IPT / ICtCp / Jzazbz | Munsell renotation | Opponent (unique-hue) |
|---|---|---|---|---|---|---|---|
| **(i) What / who** | CSS default interp. space; ColorAide harmony default; oklch.com | Ottosson 2021; gamut-normalised Oklab cylinder | 1976 industry standard | Material You theming | HDR/WCG research + Dolby BT.2100 | Artist/atlas standard since 1905 | Hering opponent theory |
| **(ii) sRGB red hue** | ≈29.2° (Table E) | same hue axis as OKLCH | ≈40° (Table E) | CAM16 hue, ≈27° *(unverified)* | IPT ≈24° *(unverified)* | ≈7.5R–10R | 353° = unique red |
| **(iii) Conversion available** | **already in `core`** | not in `core`; MIT reference code | **already in `core`** | Apache-2.0 npm dep, iterative inverse | culori/colorjs only for some; none in `core` | none — needs data table | derive from OKLCH |
| **(iv) Complement of pure red** | `#009CB2` (teal) — vs HSV's `#00FFFF` | same as OKLCH | `#008EA6` (darker teal) | *(not computed)* | *(not computed)* | 5BG by construction | unique green, 116–141° away — **not** 180° |
| **(v) Precedent** | ColorAide, atmos.style, aicolors, palette.ikit | Ottosson's own picker; several OSS pickers | every legacy Lab tool | `material-color-utilities` `harmonize()` | none for harmony | Munsell/Itten teaching, Paletton-style tools | design-theory literature; no mainstream tool |
| **(vi) Fit for 125 fixed dyes** | Good — hue error small, targets stay near real dyes | Not a matching space — a *display* space | Acceptable; blue targets misplaced | Good but no better | Same as OKLCH | Distinctive results | Distinctive results |
| **(vii) Effort / risk** | **S** (code exists; gamut mapping is the work) | **S–M**, low risk | **S** (same) | **M–L** + Apache-2.0 + bundle | **M–L**, low payoff | **L** (dataset) | **M**, anchor angles contested |

---

**Precedent for a user-facing wheel *toggle* is thin.** Individual tools pick a space and commit: Adobe Color / Figma / Sessions College use an RGB-HSB wheel, Paletton-style tools use RYB, atmos.style and the newer OKLCH generators use OKLCH. The only place I found the choice actually exposed is ColorAide, and that is a Python API argument, not a UI — and its docs explicitly refuse to claim a winner: *"While OkLCh is the default, we make no assertions that this is better than using any other color space."* So the feature is a genuine differentiator, but there is no UX pattern to copy and the labelling burden (in six languages) falls entirely on us. Prefer plain-language labels ("Perceptual (OKLCH)", "Classic Lab (CIELCH)") over jargon.

## 10. Recommendation and open risks

**Ship two perceptual wheels: OKLCH (recommended default among perceptual options) and CIELCH (labelled as the classic/legacy Lab wheel, useful as a visible contrast).** Both need zero new dependencies. Do **not** ship HCT, IPT, ICtCp or Jzazbz: on the one axis that matters they are equal-or-worse than the hue already sitting in `core`, and each costs a dependency, a bundle, or an iterative inverse. The opponent/unique-hue wheel is the one genuinely novel perceptual option and is worth a follow-up spike; Munsell belongs with RYB.

**Paint the ring in Okhsl at s = 1** (MIT reference code, ~80 lines of cusp maths) rather than trying to hold OKLCH C constant around the circle. It is in-gamut by construction at every hue, which removes the single ugliest failure mode.

**Gamut mapping: anything but per-channel clipping.** Implement the CSS Color 4 binary search with local MINDE in `core` (~40 lines, constants above) if you want ecosystem-matching output; plain chroma reduction is within one JND of it for every sRGB case measured and is simpler. Use whichever for every swatch that gets drawn. Consider ranking dyes against the *un-mapped* target. For a test gate, add **culori as a devDependency only** and assert parity against `toGamut('rgb', 'oklch', differenceEuclidean('oklch'), 0.02)` — culori's documented default *is* the CSS Color 4 algorithm, it is MIT, and `culori/fn` is tree-shakeable so the dev-only import stays cheap. That gives a real oracle instead of golden files we wrote ourselves.

**Biggest gotchas, in order.**
1. **The existing `rotateHueInSpace` clips per channel**, and the error is not cosmetic: the OKLCH complement of `#0000FF` comes out `#A02000` (dark red) instead of `#6E5000` (dark olive), a **50.6° hue error**; the CIELCH complement of `#FFD700` comes out 53.8° wrong. Anyone who wires the new UI to it ships a wheel that quietly disagrees with itself and picks the wrong dye.
2. Browsers do not implement CSS gamut mapping; they clip. Never let a `conic-gradient(in oklch …)` interpolate through out-of-gamut colours — pre-compute hex stops.
3. `generateHarmonySlots` is the single convergent path (per the 2026-09-03 harmony convergence work) and is HSV-only. Adding a space anywhere else re-forks the three surfaces.
4. Constant-L-and-C rotation is not achievable in sRGB (Table D: chroma varies 2.67× around the circle). Every perceptual wheel needs a per-hue chroma ceiling or it degenerates into a clipped band.
5. **The visible change users will notice is lightness, not hue.** HSV preserves S and V, so every partner is as vivid as the base; OKLCH/CIELCH preserve L, so a light base yields light partners and a dark base dark ones (Table C: gold's HSV triad is `#00FFD7`/`#D700FF`, its OKLCH triad is `#67EEFF`/`#FFBBF9`). Perceptual targets will systematically bias dye selection toward mid-tones. That is arguably better design, but it is a behavioural change worth an explicit product decision rather than a side effect.
6. **The sRGB gamut is not star-shaped in Oklab** — at blue's hue ray a chroma bisection can find a false ceiling. Test `maxChroma()` at h ≈ 264° explicitly.
7. Wheel choice is a no-op for low-chroma bases — `#6D5440` gives the same answer under all three strategies in both spaces. Any test suite built only on muted dyes will pass regardless of whether the feature works.

**Unverified / flagged.**
- Whether any browser engine has *since* shipped CSS Color 4 gamut mapping. Confirmed: it was **not** an Interop 2024 focus area, and interop#443 says no browser implemented it; I found no evidence of a shipped implementation as of 2026-09, but I could not positively confirm the current per-engine state.
- CAM16/IPT hue angles for sRGB red in the scorecard are from memory of the literature, not computed here.
- Oklab's hue-linearity ranking relative to Jzazbz/ICtCp is inferred from its IPT-derived fit; Zhao & Luo (2020) predates Oklab and did not test it.
- Miyahara unique-hue angles are one study's averages with large inter-observer variance, **and Wikipedia does not state which colour space they are expressed in** — Table H therefore computes both readings rather than asserting one. I did not obtain the Miyahara paper itself.
- The Safdar 2017 Jzazbz paper and the Dolby ICtCp white paper would not render as text for me; those two are cited from abstracts and secondary summaries, not from the full text. Everything else in the Sources list I opened and read.
- All Section 7 numbers are my own computation, not quoted from a library. They agree with published reference values at the four sanity points listed, but they have not been diffed against culori or colorjs.io — do that before treating any single hex as canonical.

---

## Sources

- https://bottosson.github.io/posts/oklab/ — Ottosson, "A perceptual color space for image processing" (Oklab derivation, matrices, RMS table)
- https://bottosson.github.io/posts/gamutclipping/ — Ottosson, sRGB gamut clipping strategies
- https://bottosson.github.io/posts/colorpicker/ — Ottosson, "Okhsv and Okhsl: two new color spaces for colour picking" (gamut-normalised rings, MIT reference code)
- https://raphlinus.github.io/color/2021/01/18/oklab-critique.html — Raph Levien, "An interactive review of Oklab"
- https://www.w3.org/TR/css-color-4/#gamut-mapping — CSS Color Module Level 4, gamut mapping
- https://raw.githubusercontent.com/w3c/csswg-drafts/main/css-color-4/Overview.bs — CSS Color 4 spec source (verbatim MINDE pseudocode, JND 0.02, epsilon 0.0001)
- https://drafts.csswg.org/css-images-4/#conic-gradients — CSS Images 4 (polar interpolation, out-of-gamut note)
- https://colorjs.io/docs/gamut-mapping — Color.js gamut mapping methods and the P3-yellow example
- https://github.com/Evercoder/culori — culori repository (MIT)
- https://culorijs.org/api/ — culori API reference (`toGamut` defaults, `clampChroma`, `culori/fn` tree-shaking)
- https://github.com/web-platform-tests/interop/issues/443 — "Gamut mapping" interop issue (browsers clip)
- https://webkit.org/blog/14955/the-web-just-gets-better-with-interop/ — Interop 2024 focus-area list (gamut mapping not selected)
- https://webkit.org/blog/14633/get-ready-for-interop-2024/ — Interop 2024 proposal process
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color-interpolation-method — MDN, hue interpolation methods
- https://api.webstatus.dev/v1/features?q=oklch — Baseline data for `oklab` and `gradient-interpolation`
- https://web-platform-dx.github.io/web-features-explorer/features/gradient-interpolation/ — feature scope and Baseline dates
- https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/types/color.json — MDN BCD, `oklch` version_added
- https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/css-lch-lab.json — caniuse-db, LCH/Lab support and 93.28% usage
- https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl — Evil Martians, OKLCH in CSS (LCH hue-300 blue→purple demo)
- https://raw.githubusercontent.com/evilmartians/oklch-picker/main/package.json — oklch.com dependencies (three/WebGL, MIT)
- https://facelessuser.github.io/coloraide/harmonies/ — ColorAide colour harmonies (OkLCh default, RYB caveat)
- https://facelessuser.github.io/coloraide/colors/hct/ — ColorAide HCT (definition, reverse-conversion cost)
- https://raw.githubusercontent.com/material-foundation/material-color-utilities/main/typescript/package.json — `@material/material-color-utilities` v0.4.0, Apache-2.0
- https://raw.githubusercontent.com/material-foundation/material-color-utilities/main/LICENSE — Apache License 2.0
- https://raw.githubusercontent.com/material-foundation/material-color-utilities/main/typescript/blend/blend.ts — `harmonize()` HCT hue rotation, 15° cap
- https://zenodo.org/records/3367463 — Hung & Berns (1995) constant hue loci dataset
- https://www.semanticscholar.org/paper/Development-and-Testing-of-a-Color-Space-(IPT)-with-Ebner-Fairchild/90066c3523e040c18ef92982e20e3370cf5f0e6a — Ebner & Fairchild (1998), IPT
- https://opg.optica.org/josaa/abstract.cfm?uri=josaa-37-5-865 — Zhao & Luo (2020), hue linearity of colour spaces for WCG/HDR media
- https://opg.optica.org/oe/fulltext.cfm?uri=oe-25-13-15131&id=368272 — Safdar et al. (2017), Jzazbz (page did not render; cited from abstract metadata)
- https://en.wikipedia.org/wiki/Unique_hues — Miyahara et al. (2003) unique-hue angles, inter-observer variance
- https://en.wikipedia.org/wiki/ICtCp — ICtCp definition and IPT lineage
- https://professional.dolby.com/siteassets/pdfs/ictcp_dolbywhitepaper_v071.pdf — Dolby ICtCp white paper (referenced, not fully parsed)
- https://www.sciencedirect.com/topics/engineering/munsell-system — Munsell principal hues and complement definition
- https://atmos.style/color-wheel — atmos.style colour wheel (OKLCH-based harmony tool, precedent)
- https://color.adobe.com/create/color-wheel — Adobe Color wheel (RGB/HSB harmony, precedent for the current default)
- https://css-tricks.com/my-struggle-to-use-and-animate-a-conic-gradient-in-svg/ — SVG has no conic gradient
- https://www.w3.org/Graphics/SVG/WG/wiki/SVG2GradientsComments — SVG 2 mesh gradients deferred
