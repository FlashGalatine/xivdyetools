# Findings — Mixing & Matching Algorithm Fact-Check

**Date:** 2026-09-03
**Base commit:** `876cfc2f` (origin/main)
**Scope:** `@xivdyetools/core` colour **mixing** and **matching** algorithms, plus the surfaces that consume them.
**Method:** see [00-methodology.md](./00-methodology.md). Every finding below carries a reproducible probe output.

---

## Severity key

| | Meaning |
|---|---|
| **P0** | Wrong output visible to users today, on a shipped surface. |
| **P1** | Two surfaces disagree, or an algorithm violates a law it claims to obey. |
| **P2** | Correct but imprecise, mislabelled, or unreachable. |
| **OK** | Checked against the published definition and found correct. Recorded so it is not re-litigated. |

---

## P0 — `spectral` blend mode returns near-black for almost every input pair

**Where:** `packages/core/src/blending/blending.ts` → `blendSpectral()` / `kubelkaMunkMix()`, with
`packages/core/src/blending/conversions.ts` → `rgbToReflectance()`, `reflectanceToKS()`, `ksToReflectance()`.

**Reached by:** `@xivdyetools/core/blending` → `packages/bot-logic/src/commands/mixer.ts` and
`packages/bot-logic/src/commands/gradient.ts` → the Discord bot's `/mix` and `/gradient`, where
`apps/discord-worker/src/commands/schemas.ts` offers it to users three times as
*"Spectral - Kubelka-Munk physics"*.

**Observed** (probe `05-spectral-gradient.mts`), blue → yellow, the canonical pigment-mixing demonstration:

| t | bot `core/blending` "spectral" | web `ColorService.mixColorsSpectral` |
|---|---|---|
| 0.0 | `#0000ff` | `#0000FF` |
| 0.1 | `#000003` | `#004978` |
| 0.2 | `#000001` | `#005162` |
| 0.3 | `#000001` | `#00635D` |
| 0.4 | `#000001` | `#007858` |
| 0.5 | `#010101` | `#398F54` |
| 0.6 | `#010100` | `#68A74E` |
| 0.7 | `#010100` | `#92C046` |
| 0.8 | `#010100` | `#BAD73B` |
| 0.9 | `#030300` | `#DFED28` |
| 1.0 | `#ffff00` | `#FFFF00` |

Nine of the eleven gradient stops are black. The same collapse happens for black → white
(every interior stop is `#000000`–`#030303`, where the web path walks `#1D1D1D` → `#F3F3F3`).

At 50/50, across the canonical pigment test pairs (probe `01-blend-modes.mts`):

```
spectral #010101  #ff0100  #ff0101  #010001  #010100  #010101
         B+Y      R+Y      W+R      B+R      G+R      W+B
```

**Why.** Two compounding errors:

1. **Wrong domain.** `rgbToReflectance()` is `channel / 255`. sRGB values are *gamma-encoded*
   (≈ R<sup>1/2.2</sup>); Kubelka–Munk is defined on *linear* reflectance. No linearisation happens.
2. **Wrong dimensionality, and a hyperbolic singularity.** K/S = (1−R)²/2R diverges as R → 0. The code
   clamps R to 0.001, giving K/S = 499 for a zero channel versus 5.0 × 10⁻⁷ for a full one — a ratio of
   10⁹. Linearly averaging those is completely dominated by the dark endpoint. **Any channel where either
   input is 0 is forced to ≈ 0 in the output at every ratio**: at t = 0.99 (99 % yellow) the green channel
   still only reaches 21/255.

Kubelka–Munk's famous blue + yellow = green depends on mixing *spectral reflectance curves*, where
blue's and yellow's curves overlap in the green band. Three independent sRGB channels have no such
overlap to exploit, so this construction cannot produce the result the mode is named for, regardless of
how the singularity is handled.

**Why tests did not catch it.** `blending.test.ts:157` asserts the white+black mix has
`r, g, b < 50` under the heading *"black dominates the mix (physically correct pigment behavior)"* —
`#010101` passes, and so would a function that returned pure black unconditionally.
`blending.integration.test.ts:99` and `:108` explicitly **exempt** `spectral` from the monotonic-gradient
and endpoint checks. The suite documents the symptom as intended behaviour.

---

## P1 — Web and bot compute different colours for the same named mode

**Where:** core exposes **two** independent mixing APIs and the front ends chose differently:

| Consumer | API | `ryb` | `spectral` |
|---|---|---|---|
| `bot-logic` (Discord `/mix`, `/gradient`) | `@xivdyetools/core/blending` → `blendColors()` | chromatic-subtraction | per-channel K/S (broken, above) |
| `web-app` (mixer tool) | `ColorService.mixColors*` | Gossett–Chen cube | `spectral.js` (real KM) |
| `og-worker` (gradient share card) | `ColorService.mixColors*` | *unsupported* | *unsupported* |

**Observed** (probe `02-surface-divergence.mts`) — 13 of 42 (mode, pair) cells disagree.
`rgb`, `lab`, `oklab` and `hsl` agree exactly; `ryb` and `spectral` do not:

| mode | pair | bot | web | ΔE₀₀ |
|---|---|---|---|---|
| ryb | blue+yellow | `#008000` | `#8db26b` | 22.4 |
| ryb | red+yellow | `#804000` | `#ff9f40` | 38.1 |
| ryb | white+black | `#808080` | `#9b7349` | 19.0 |
| spectral | blue+yellow | `#010101` | `#398f54` | 46.2 |
| spectral | white+black | `#010101` | `#a6a6a6` | **55.2** |
| spectral | green+red | `#010100` | `#834b17` | 34.1 |

A third inconsistency: `apps/og-worker/src/services/svg/gradient.ts:39-43` implements only `oklab`,
`rgb` and a `lab` default — so a `/gradient mode:spectral` (or `ryb`, or `hsl`) **share card silently
renders as `lab`**, a third answer for the same user request.

This is the concrete violation of the stated architecture: core is meant to be the single source of
truth for colour computation, with each app a thin front end. Core currently speaks with two voices, and
og-worker with a third.

---

## P1 — Gossett–Chen RYB violates the identity law for 53 % of dye pairs

**Where:** `packages/core/src/services/color/RybColorMixer.ts` → `rgbToRyb()` (multi-start
Newton–Raphson inverse of the trilinear cube), reached from `ColorService.mixColorsRyb()` → the web-app
mixer.

**The law.** `mix(A, B, 0)` must return `A`, and `mix(A, B, 1)` must return `B`. Every other mode in
both APIs obeys it exactly.

**Observed** (probe `04-algebraic-laws.mts`, 2 500 dye pairs):

```
--- WEB path (ColorService) ---
  rgb       violations(dE>0.5):     0/2500  max dE00 0.00
  lab       violations(dE>0.5):     0/2500  max dE00 0.00
  oklab     violations(dE>0.5):     0/2500  max dE00 0.00
  ryb       violations(dE>0.5):  1332/2500  max dE00 27.87  (#49f8fd/#e4dfd0)
  hsl       violations(dE>0.5):     0/2500  max dE00 0.00
  spectral  violations(dE>0.5):     0/2500  max dE00 0.00
```

Worked example: `ColorService.mixColorsRyb('#49f8fd', '#000000', 0)` returns **`#7F9FC2`**, not
`#49f8fd` — ΔE₀₀ = 27.9. Dragging the web mixer's slider fully to one end does not show the dye you
picked.

**Why — and this is structural, not a tuning problem.** Both interpolation variants Gossett & Chen
specify (plain trilinear, and their biased `cubicInt` smoothstep) are nested *convex* combinations, so
every output lies in the **convex hull of the eight corner RGB values**. Only three of those corners
(white, red, yellow) sit on an actual sRGB cube corner; the other five are interior points. Therefore
pure green, pure blue, cyan, magenta and true black are **mathematically unreachable** by the model — no
RYB input maps to them. The Newton–Raphson search cannot converge for those targets and returns a
best-effort point that round-trips to a visibly different colour.

This is confirmed independently: ColorAide, which implements the same cube with the same Newton-method
inverse, documents that "translation of colors outside the gamut will have poor conversions". No damping
or extra iterations can fix it.

Round-trip cost over the 125-dye set (probe `03-numeric-checks.mts`):

```
Gossett-Chen (RybColorMixer)      round-trip dE00: mean 3.47, max 27.87 (#49f8fd)
chromatic-subtraction (blending)  round-trip dE00: mean 0.00, max 0.00
```

Note the inversion of expectations: the implementation with the academic pedigree is the lossy one, and
the plain heuristic is an exact bijection. Neither is "wrong" as a model — but only one can satisfy the
identity law, and the web app currently uses the one that cannot.

The cube is also the reason `ryb` white+black gives a brown (`#9b7349`) on the web path: RYB(0,0,0)
lerped to RYB(1,1,1) passes through the cube's centre, and the (1,1,1) corner is the "sludge" brown
`(0.2, 0.09, 0.0)`, not black.

---

## P2 — `getDeltaE_OklchWeighted` under-weights hue by a factor of π, and has no callers

**Where:** `packages/core/src/services/color/ColorConverter.ts:954`.

The hue term is `dHScaled = (dH_degrees / 180) * avgC * kH`. Every standard cylindrical colour-difference
formula (CIE94, CIEDE2000) uses ΔH = 2·√(C₁C₂)·sin(Δh/2), which for small Δh approaches C̄ · Δh in
**radians**. Dividing by 180 instead of by π/… scales the term by Δh_rad/π.

**Observed** (probe `03-numeric-checks.mts`, C = 0.15):

| Δh° | repo term | standard ΔH | ratio |
|---|---|---|---|
| 1 | 0.000833 | 0.002618 | 3.1416 |
| 10 | 0.008333 | 0.026147 | 3.1376 |
| 60 | 0.050000 | 0.150000 | 3.0000 |
| 180 | 0.150000 | 0.300000 | 2.0000 |

So hue differences are counted at roughly **⅓ of their correct weight** (exactly 1/π in the small-angle
limit) even when the caller passes `kH = 1`, which the docstring presents as the neutral setting.

**Reachability:** no production caller. The only references outside its own definition are two web-app
test files. The `oklch-weighted` `MatchingMethod` was retired in the 5.0 suite. This is dead code
carrying a wrong formula — the cheapest fix is deletion.

---

## P2 — CIELAB uses rounded ε and κ instead of the exact CIE fractions

**Where:** `ColorConverter.rgbToLab()` / `labToRgb()` use `epsilon = 0.008856` and `kappa = 903.3`.
CIE 15:2004 defines ε = 216/24389 = 0.008856451679… and κ = 24389/27 = 903.296296296….

**Observed** (probe `03-numeric-checks.mts`):

```
max |Δf| over t∈[0,0.02] = 2.828e-7  =>  max ΔL* ≈ 3.3e-5, max Δa* ≈ 1.4e-4
```

**This reproduces a known, documented defect exactly.** The 1976-era ε and κ were rounded *independently*
to four significant figures, so the two branches of f(t) no longer meet at the junction. Bruce Lindbloom
quantified the resulting jump at **≈0.0000328 in L\*** and petitioned the CIE to fix it; CIE 15:2004 did
so by replacing the decimals with the exact rationals. Our measured max ΔL\* is **3.28 × 10⁻⁵** — the same
number. The repo is carrying the pre-2004 constants.

Lindbloom's sharper point is that the mismatch makes the combined function *"not only discontinuous [but]
also non-monotonic, which makes it not invertible in this region."* That is a real property, in a tiny
neighbourhood of t ≈ ε.

Perceptually this is nothing — 3 × 10⁻⁵ L\* is orders of magnitude below any JND. It is worth fixing only
because the exact fractions cost nothing and the rounded ones have no upside. `rgbToLab()` additionally
rounds its output to 4 dp before ΔE is computed, which is the larger of the two effects (max component
Δ = 1.95 × 10⁻⁴ against the unrounded `blending/conversions.ts` implementation).

Note this does **not** threaten the CIEDE2000 conformance pass above: that test feeds Lab values directly
and never goes through `rgbToLab`.

---

## P2 — Harmony matching silently uses CIE76 while the rest of the suite uses CIEDE2000

**Where:** `packages/core/src/services/dye/HarmonyGenerator.ts:273` and `:461` —
`normalizeDeltaEFormula(options.deltaEFormula ?? 'cie76')`.

`packages/core/src/types/index.ts:50` sets `DEFAULT_MATCHING_METHOD = 'ciede2000'`, and `DyeSearch`
honours it. Harmony does not: its ΔE path defaults to `cie76`. A repo-wide search finds **no caller
anywhere that passes `deltaEFormula`** — not in `bot-logic`, not in `web-app`, not in any worker — so the
default is what always runs.

The two formulae pick a different winning dye in **31.5 %** of queries (probe `03-numeric-checks.mts`),
so this is not a rounding-level difference: harmony recommendations are drawn from a different metric
than every other tool in the suite, and nothing surfaces that.

The per-formula thresholds around it are fine — `HARMONY_MAX_DISTANCE` carries scale-aware values
(`ciede2000: 25`, `cie76: 40`, `oklab: 0.107`) rather than the two-way ternary that BUG-059 removed. Only
the default formula is out of step.

**Note:** this is the "harmony ΔE76" item left open by the 2026-08-08 5.0 design review. It is still open.

---

## OK — CIEDE2000 **passes the published conformance vector**

`ColorConverter.getDeltaE2000()` was executed against all **34 supplementary test pairs** from Sharma,
Wu & Dalal (2005), retrieved from the canonical file at the University of Rochester
(`hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt`).

```
  pairs:        34
  failures:     0
  max |diff|:   4.950e-05  (pair 23)
  PASS — implementation conforms to the published test vector.
```

The residual ≈5 × 10⁻⁵ is exactly what the data's own 4-dp quoting allows, so this is a clean pass.
Probe: `07-ciede2000-sharma.mts`.

This matters more than a code review would. Those 34 pairs exist *because* the CIE's own worked examples
"do not adequately test the implementation" — they are built to stress the arctangent quadrant handling,
the mean-hue branch logic and the `C₁′·C₂′ = 0` cases, and Sharma et al. report that "several
implementations distributed on the Internet, including some from reputable sources, were erroneous" on
exactly these. Notably, pairs 9–16 (near-180° hue separations, near-zero chroma) all pass, which is the
region where the standard itself is ambiguous and most implementations get the mean hue wrong.

The step-by-step read agrees: all nineteen steps present and correctly ordered, G computed from the mean
of the *original* chromas, correct four-case Δh′ and h̄′ branches, correct degree/radian conversion at
every trigonometric call, and `hueAngle()` returning 0 for a′ = b′ = 0.

**Recommendation: freeze this as a test.** It passes today; a gate keeps it passing.

## OK — Oklab / Oklch conversion

`rgbToOklab()` / `oklabToRgb()` reproduce Ottosson's published M1, M2 and inverse matrices coefficient
for coefficient, operate on linearised sRGB, and use `Math.cbrt` (which handles negative LMS correctly,
unlike `Math.pow(x, 1/3)`). `rgbToOklch()` maps hue into [0, 360) correctly.

## OK — k-d tree is correctly restricted to the one metric it is valid for

`packages/core/src/utils/kd-tree.ts` prunes on axis-aligned Euclidean bounds in RGB. `DyeSearch`
(`findClosestDye`, `findDyesWithinDistance`) uses the tree **only** when `matchingMethod === 'rgb'`, and
falls through to an exact linear scan for every perceptual method. The in-code comments (REFACTOR-003,
2026-07-18) record exactly why — a previous RGB-radius pre-filter returned wrong winners for `oklab`.
This is the correct call: CIEDE2000 is not a metric, so Euclidean pruning cannot be trusted to bound it,
and at n = 125 the exact scan is trivially cheap. **No change recommended.**

## OK — algebraic laws elsewhere

Both APIs are commutative in all six modes (0/1 600 violations, max ΔE₀₀ 0.00), and every mode except
web-`ryb` satisfies the identity law exactly.

---

## Context: the matching-method choice is not cosmetic

Probe `03-numeric-checks.mts`, 1 000 pseudo-random sRGB queries against the 125-dye set, asking how often
each method picks a *different* winning dye than the `ciede2000` default:

| method | disagrees with ciede2000 |
|---|---|
| `cie76` | 31.5 % |
| `oklab` | 31.7 % |
| `rgb` | 44.3 % |
| `redmean` | 42.6 % |

Worth stating in user-facing help: switching the matching algorithm changes the recommended dye about a
third to a half of the time.

---

## OK — redmean matches Riemersma's published formula

`getRedmeanDistance()` was checked against the source (Thiadmer Riemersma, *"Colour metric"*,
https://www.compuphase.com/cmetric.htm). The weights `(2 + r̄/256)`, `4`, `(2 + (255 − r̄)/256)` are
correct, and **`r̄` is divided by 256, not 255** — confirmed from the author's own reference C, which uses
bit shifts (`(512+rmean)*r*r >> 8`), so 256 is structural, not a typo.

One number to know if it is ever needed: redmean's true maximum (black vs white) is **≈764.834**, not 765
and certainly not 441.673. Nothing in the repo currently normalises by it — `band-calibration.ts` derives
each method's band thresholds empirically from the dye set rather than from a theoretical maximum, which
is the more robust choice — so **there is no defect here**. Recorded only so a future "let's show redmean
as a percentage" change does not reach for the wrong constant.

Status caveat worth keeping: redmean has **no peer-reviewed validation**. It exists on its author's
personal page, offers no error bound, and has never been benchmarked against COMBVD or any standard
psychophysical dataset. It is a good engineering heuristic; it is not a validated metric, and the UI
should not imply otherwise.

## OK — the D65 white point and sRGB matrix are internally consistent

The repo pairs `0.95047 / 1.00000 / 1.08883` with the `0.4124564 …` sRGB→XYZ matrix. Both come from the
same lineage (ASTM E308 chromaticities, as published by Bruce Lindbloom), so they **agree with each
other**, which is the property that actually matters.

CSS Color 4 uses a different, equally legitimate pair derived from the sRGB-native 4-figure chromaticity
(0.3127 / 0.3290 → `0.9504559 / 1.0 / 1.0890578`, with a matching matrix). The W3C's own thread on this
(csswg-drafts #6618, #6640) puts the round-trip difference between the two lineages at **ΔE₀₀ ≈ 0.015** —
imperceptible — and its conclusion is the one the repo already satisfies: *"The most important thing is
to use a single set of consistent values everywhere."* **No change needed.** Mixing the two lineages
would be the bug; the repo does not.

---

## Open — one item remains

**Whether Oklab Euclidean or CIEDE2000 is the better default matching metric** now has a partial answer,
recorded here rather than in the OK section because it rests on a preprint. Uchida, *"Oklch+: A
Three-Parameter Extension of Oklab for Improved Color Difference Prediction"* (arXiv:2606.05255, 2026)
reports STRESS against the COMBVD dataset (3 813 pairs pooled from BFD-P, WITT, LEEDS, RIT-DuPont and
others — lower is better):

| | plain Oklab Euclidean | CIEDE2000 |
|---|---|---|
| COMBVD (3 813 pairs) | 51.45 | **29.13** |
| BFD-P D65 held-out (2 028) | 47.35 | **24.12** |

If that holds, plain ΔEOK is substantially *worse* than CIEDE2000 at predicting perceived difference,
despite Oklab's "perceptually uniform" reputation — which supports keeping `ciede2000` as the default and
argues for the ΔEOK2 correction in [04-proposed-changes.md](./04-proposed-changes.md) §3.5. Treated as
indicative rather than settled: it is a preprint, and this audit did not reproduce it.

---

## P2 — Two citation errors in `RybColorMixer.ts`

The corner table was checked against the source. **Seven of eight corners match exactly, including the
blue `(0.163, 0.373, 0.6)`** — that desaturated blue is Gossett & Chen's own deliberate value, chosen
under Itten's influence, not an import from some other implementation. Two things are wrong:

| | In `RybColorMixer.ts` | Published |
|---|---|---|
| Black corner `(1,1,1)` | `(0.2, 0.09, 0.0)` | `(0.2, **0.094**, 0.0)` |
| Citation | "their 2006 paper" | IEEE **InfoVis 2004**, pp. 113–118 |

The G channel is off by 0.004. Harmless in practice; worth fixing while the file is open, since the
whole point of naming a source is that the numbers can be checked against it.

Two further notes for whoever edits this file:

- **The paper defines no RGB→RYB inverse at all.** Sugita & Takahashi (IIEEJ 2017) state this explicitly:
  "Gossett and Chen did not provide the details for converting from the RGB space to the RYB space."
  The multi-start Newton–Raphson inverse is therefore a legitimate, field-standard addition — ColorAide
  does the same thing — not a deviation from the paper. The identity-law failure above is a property of
  the model's gamut, not of the inverse being badly implemented.
- **The two RYB families use opposite white/black conventions.** Gossett–Chen puts white at RYB (0,0,0)
  and the "sludge" brown at (1,1,1); the chromatic-subtraction code in `blending/conversions.ts` maps
  (0,0,0) → black. The convention cancels out for a round-trip mix, but anyone swapping one
  implementation for the other must not assume the axes mean the same thing.
