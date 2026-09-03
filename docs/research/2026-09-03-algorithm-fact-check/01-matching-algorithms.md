# Matching Algorithms vs the Literature

Six `MatchingMethod`s and the conversions beneath them, verified against primary sources.
Defects are catalogued in [03-findings.md](./03-findings.md); this is the source-by-source comparison.

**Headline: the matching side is in good shape.** The one formula with a published conformance vector
passes it; the one with published matrices reproduces them exactly; the one spatial index is correctly
confined to the only metric it is valid for.

---

## The conversion layer

### sRGB transfer function — correct

`srgbToLinear` / `linearToSrgb` use threshold 0.04045 (encoded side) / 0.0031308 (linear side) with
12.92, 1.055, 0.055 and 2.4. These match the W3C CSS Color 4 sample code exactly.

The two thresholds are each independently rounded from the true intersection of the two curve pieces at
**S = 0.0404482362771082**, so a discontinuity of about **2.3 × 10⁻⁹** in linear light exists at the
boundary — roughly nine orders of magnitude below one 8-bit step. Not worth touching.

### sRGB → XYZ matrix and D65 white point — correct *and internally consistent*

The repo uses the `0.4124564 / 0.3575761 / 0.1804375 …` matrix with D65 `0.95047 / 1.00000 / 1.08883`.
Both derive from the ASTM E308 chromaticities as published by Bruce Lindbloom
(http://www.brucelindbloom.com/Eqn_RGB_XYZ_Matrix.html), so they belong together.

There is a second, equally legitimate lineage: CSS Color 4 derives its matrix from the sRGB-native
four-figure chromaticity 0.3127 / 0.3290, giving D65 = `0.9504559271 / 1.0 / 1.0890577508`. The W3C's own
discussion of the discrepancy (csswg-drafts [#6618](https://github.com/w3c/csswg-drafts/issues/6618),
[#6640](https://github.com/w3c/csswg-drafts/issues/6640)) catalogues roughly **sixteen** published D65
xy pairs across ICC, CIE editions, ASTM and vendor tools, and puts the round-trip difference between the
two main lineages at **ΔE₀₀ ≈ 0.015**. The spec editor's conclusion:

> The most important thing is to use a single set of consistent values everywhere (matrices to and from
> XYZ, adaptation matrices).

The repo satisfies that. **No change recommended** — mixing lineages would be the bug.

### CIELAB f(t) — pre-2004 constants (minor)

The repo uses ε = 0.008856 and κ = 903.3. CIE 15:2004 §8.2.1.1 publishes the exact forms — threshold
`(24/116)³` and slope `841/108` — which are ε = **216/24389** = 0.008856451679 and κ = **24389/27** =
903.2962963 (and 841/108 = κ/116 = 7.787037…, i.e. the familiar "7.787" is exactly this).

CIE 15:2004 did not change the function; it replaced two *independently rounded* decimals with their
exact rationals, because the rounded pair leaves the two branches not meeting. See
[03-findings.md](./03-findings.md) — our measurement reproduces Lindbloom's published ≈0.0000328 L\* jump
to the digit.

---

## `ciede2000` — the default. **Passes the published conformance vector.**

**Sources:** CIE Publication 142-2001, standardised as ISO/CIE 11664-6 (2014, rev. 2022); Sharma, G.,
Wu, W. & Dalal, E.N. (2005), *"The CIEDE2000 Color-Difference Formula: Implementation Notes,
Supplementary Test Data, and Mathematical Observations"*, Color Research & Application 30(1):21–30,
https://hajim.rochester.edu/ece/sites/gsharma/papers/CIEDE2000CRNAFeb05.pdf

Executed against all **34 supplementary test pairs**: **0 failures, max deviation 4.95 × 10⁻⁵** against
data quoted to four decimal places. Probe `07-ciede2000-sharma.mts`.

That is the meaningful result, because Sharma et al. built those pairs precisely to catch what code
review does not:

> Several implementations distributed on the Internet, including some from reputable sources, were
> erroneous.

The pitfalls they enumerate, and how the repo fares:

| Pitfall | Status |
|---|---|
| `atan2` quadrant handling; `b* = a′ = 0` must special-case to h′ = 0 | ✅ `hueAngle()` does exactly this |
| Signed ΔC′ / ΔH′ — the R_T cross-term needs correct signs, and a sign error corrupts **only blue** (~275°), so it ships undetected | ✅ signs preserved |
| Mean hue h̄′ — *"not defined unambiguously in either the CIE Technical Report or the article by Luo, Cui and Rigg"*; most implementations get it wrong | ✅ all four branches correct; pairs 9–16 exercise exactly this and pass |
| `C₁′·C₂′ = 0` special cases | ✅ both Δh′ and h̄′ special-cased |
| Degrees vs radians — silent, non-crashing if missed | ✅ correct at every call |

**Parametric factors.** kL = kC = kH = 1 is correct for the standard reference conditions (D65
simulator, 1000 lx, L\* = 50 neutral grey surround, object mode, >4° subtense, edge contact, differences
in the 0–5 CIELAB range). The usual real-world deviation is textiles, which conventionally use kL = 2 for
fabric texture. Nothing here argues for changing them.

**Known limits, for the record.** Sharma et al. quantify the formula's own discontinuities: the mean-hue
branch logic can jump up to ≈0.27 ΔE₀₀ for pairs near the discontinuity locus, and they conclude these
*"preclude the use of the formula in analysis based on Taylor series approximations and in design
techniques using gradient-based optimization."* Relevant only if anyone ever tries to optimise through it.

---

## `cie76` — correct, and the "2.3 JND" folklore is shakier than usually presented

ΔE\*ab = √(ΔL\*² + Δa\*² + Δb\*²). Correctly implemented.

Its perceptual failure traces to MacAdam's 1942 ellipses: JND regions in colour space are not uniform
spheres, and are notably tighter in blue/purple than in green. That non-uniformity is what CIE94 and
CIEDE2000 exist to correct.

On the interpretation thresholds the tool's docstrings quote (`<1 imperceptible`, `<3 barely
noticeable`): the familiar table comes from Mokrzycki & Tatol (2011), *"Color difference ΔE — A survey"*,
Machine Graphics and Vision. Two cautions worth carrying into any UI copy:

- The widely-repeated attribution of "2.3 = 1 JND" to **Dorothy Nickerson is almost certainly a citation
  error**. Nickerson's 1936 work predates CIELAB by forty years and used a Munsell-based formula, so it
  cannot have measured CIELAB units. The checkable source is **Mahy, Van Eycken & Oosterlinck (1994)**,
  Color Res. Appl. 19(2):105–121.
- CIEDE2000 was fitted to industrial pass/fail datasets, **not** derived by counting JNDs — CIE 142-2001
  does not use the phrase "just noticeable difference" at all. Any single scalar threshold is a rule of
  thumb, not a measured universal.

---

## `oklab` — matrices exact; the metric could be better

**Source:** Björn Ottosson (2020), https://bottosson.github.io/posts/oklab/

**All four matrices reproduce the published values digit for digit** — the linear-sRGB→LMS composite, the
LMS′→Oklab matrix, and both inverses. They are also the **corrected post-2021-01-25 set** (Ottosson
re-derived them with a higher-precision sRGB matrix and exactly matching D65); the repo is not carrying
stale pre-errata numbers.

`Math.cbrt` is the right call. `Math.pow(x, 1/3)` returns `NaN` for negative x, and LMS *can* go negative
— though only for out-of-gamut input, since every coefficient in the sRGB→LMS matrix is positive and each
row sums to 1, making LMS a convex combination of in-gamut RGB. The repo validates RGB to 0–255 before
converting, so it never reaches that case; the choice is still correct and should not be "optimised".

CSS Color 4 carries a further-refined 16-digit matrix set differing at ~1.3 × 10⁻⁸, which exists purely
so achromatic colours round-trip to exactly a = b = 0. Below float32 epsilon; not worth adopting.

**ΔEOK.** Plain Euclidean distance in Oklab *is* the sanctioned metric — CSS Color 4 §20.3: *"the color
difference metric does not need to correct for them and so ΔEOK is simply the Euclidean distance in
Oklab color space."* The repo's `getDeltaE_Oklab` is correct. §14.2.1 puts **one JND at ΔEOK ≈ 0.02**.

Two findings that argue for the ΔEOK2 change proposed in [04-proposed-changes.md](./04-proposed-changes.md) §3.5:

- CSS Color 4 §20.4 notes plain ΔEOK *"under-estimates differences in colorfulness compared to
  differences in lightness"* and defines **ΔEOK2** (a, b scaled ×2). The factor is Ottosson's own, from
  testing against COMBVD (2.016) and OSA-UCS (2.045). §20.5 recommends ΔEOKr2 for performance-sensitive
  implementations.
- Oklab's reputation outruns its measured performance as a *difference* metric. Ottosson's own
  hue-uniformity table scores Oklab at H RMS 0.49 / H95 1.06 — good, but **behind CAM16-UCS** (0.43 /
  0.92). He presents it as the best overall compromise, not the best on any single axis.

---

## `redmean` — matches the source; unvalidated by design

**Source:** Thiadmer Riemersma, *"Colour metric"*, https://www.compuphase.com/cmetric.htm

The implemented weights `(2 + r̄/256)`, `4`, `(2 + (255 − r̄)/256)` are exactly as published, and **r̄ is
divided by 256** — confirmed structurally from the author's reference C, which uses bit shifts
(`((512+rmean)*r*r)>>8`, `((767-rmean)*b*b)>>8`).

Riemersma's rationale: *"Although blue has a small contribution (about 10%) to the sensation of
brightness, human vision has an extraordinarily good colour discrimination capability in blue colours"* —
so the red/blue weights slide with mean red level instead of being fixed. He claims results *"very close
to L\*u\*v\*"* and, more importantly, *stability* — no region where it suddenly goes badly wrong.

**Status: engineering heuristic, no academic validation.** It lives on a personal page, gives no error
bound, and has never been benchmarked against COMBVD or any standard psychophysical dataset. Fine to
offer; should not be described as perceptually validated.

Its true maximum is **≈764.834** (black vs white), not 765 — the weights sum to 4.99609375 rather than 5
because of the /256. Nothing normalises by it today; recorded so nothing does so wrongly later.

---

## `rgb` and `distinguish` — correct, and honestly labelled

Plain Euclidean, maximum √(3·255²) = **441.67295593**, which is what `COLOR_DISTANCE_MAX` computes.
`distinguish` is that value rescaled to 0–100 and, as the code's own comment says, produces ranks
identical to `rgb`.

The literature is blunt about plain RGB distance: it weights all three channels 1:1:1 despite luma
coefficients of roughly 0.2126 / 0.7152 / 0.0722, and it conflates lightness and chromatic differences
into one number. The existing docstrings already say this is the least accurate option, which is the
right posture.

---

## The k-d tree — correctly confined to the one metric it is valid for

`KDTree` prunes on axis-aligned Euclidean bounds in RGB. `DyeSearch` uses it **only** when
`matchingMethod === 'rgb'`; every perceptual method takes an exact linear scan. This is right, and the
literature is clear about why.

**What the pruning assumes.** A k-d tree discards a subtree when the distance from the query to that
subtree's bounding box already exceeds the current best. That is sound only if distance-to-box is a
guaranteed **lower bound** on the distance to every point inside it — which holds for the Minkowski
family because those metrics decompose additively over coordinate axes.

**Why CIEDE2000 breaks it.** ΔE₀₀ does not decompose over L\*, a\*, b\* at all: the G factor rotates
a\* using the **mean chroma of the pair being compared**, so the effective ruler depends on *which two
points* you are measuring — not on position alone. There is no way to express "distance to this splitting
plane" as a partial sum of the final expression. The underlying reason is that the space is Riemannian:
De Visschere, *"Review of Measures Used for Evaluating Color Difference Models"* (arXiv:2601.13402) —
*"the color space underlying this model is a Riemann space, which is only Euclidean over infinitesimal
distances and the metric changes from point to point."*

Supporting evidence that no Euclidean embedding rescues this: Ridolfi, Gattass & Lopes (2010),
*"Investigating Euclidean Mappings for CIEDE2000 Color Difference Formula"*, CIC18 — the best ISOMAP /
Sammon embedding still leaves **3.98 % mean error**.

**Is CIEDE2000 a metric?** It is at least **symmetric**, unlike CIE94 and CMC (which are quasimetrics —
they use only the reference colour's chroma in the denominator). Swapping the two colours flips the signs
of ΔL′, ΔC′ and ΔH′ together, and the R_T·ΔC′·ΔH′ term is a product of two flipped factors, so it is
sign-invariant. Whether it satisfies the **triangle inequality** is a separate question, and here the
honest answer is: the structural argument is strong (pair-dependent weighting, Riemannian geometry,
demonstrated non-embeddability, and the existence of DIN99o as a purpose-built Euclidean substitute), but
**no single published counterexample was located**. Treat "not a true metric" as well-supported by
indirect evidence rather than as a cited theorem.

Either way it does not change the conclusion: swapping to a metric tree (VP-tree, M-tree) would not help
either, since their pruning correctness also *requires* the triangle inequality — see Ciaccia, Patella &
Zezula, M-tree, VLDB 1997.

**And at n = 125 the question is moot.** Exhaustive CIEDE2000 over 125 entries is a few hundred
transcendental operations — well under the cost of building or walking any index. The general guidance is
that k-d trees only start to win in the thousands; the field's answer to expensive CIEDE2000 comparison
is cheap early-rejection bounds per comparison (Pereira et al., IEEE 2019), not spatial indexing. Real
palette-matching libraries (e.g. `markusn/color-diff`) do exhaustive comparison too.

**If indexing ever became necessary**, the principled route is **DIN99o** (Cui, Luo, Rigg, Roesler &
Witt, 2002, Color Res. Appl. 27(4)) — a fixed, position-independent remap of Lab whose plain Euclidean
distance approximates CIEDE2000 accuracy while being a genuine Euclidean metric, and therefore validly
k-d-tree-prunable. Not needed at this scale.
