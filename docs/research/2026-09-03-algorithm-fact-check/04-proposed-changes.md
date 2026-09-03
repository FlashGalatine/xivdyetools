# Proposed Changes

**Status:** proposal only — no code changed in this pass.
**Date:** 2026-09-03 · **Base:** `876cfc2f`

Evidence for every claim here is in [03-findings.md](./03-findings.md).

---

## The governing principle

> Core is the source of truth for colour computation. `web-app`, `discord-worker`, `og-worker` and any
> future project are front ends: they choose *which* computation to request and how to present it, and
> they never implement, substitute, or silently downgrade one.

The good news from the audit: **no colour-space constants are duplicated outside core.** A repo-wide
search for the sRGB matrices, the gamma constants and the CIELAB ε/κ finds them only in
`packages/core`. The conversions are already centralised.

The problem is one level up. **Core itself ships two competing mixing APIs**, and the three front ends
picked differently:

```
                     ┌─ ColorService.mixColors*  ──► RybColorMixer (Gossett-Chen) + spectral.js
@xivdyetools/core ───┤
                     └─ /blending  blendColors() ──► chromatic-subtraction RYB + per-channel K/S

web-app     ──► ColorService.mixColors*      (6 modes)
og-worker   ──► ColorService.mixColors*      (3 modes; the other 3 silently render as `lab`)
bot-logic   ──► @xivdyetools/core/blending   (6 modes, 2 of them wrong)
```

So the principle is not violated by the apps — it is violated by core, which gives two different answers
to the same question. Everything below follows from collapsing that to one.

---

## Sprint 1 — Stop shipping wrong colours (P0)

### 1.1 Replace the per-channel Kubelka–Munk with real spectral mixing

`blending/blendSpectral()` applies K/S to gamma-encoded sRGB channels and collapses to near-black; the
bot's `/gradient mode:spectral` renders nine black stops out of eleven.

**Do:** make `blendSpectral()` delegate to `spectral.js`, exactly as `SpectralMixer` already does, so
both APIs produce the same physically-grounded result.

**Cost:** `spectral.js@3.0.0` is **11.8 KB minified / 5.9 KB gzipped**, MIT-licensed. The
discord-worker sits at 2,632 KiB against a 3,072 KiB limit — roughly 440 KiB of headroom, so this is
~1.3 % of the remaining budget. No blocker.

**Delete:** `rgbToReflectance`, `reflectanceToRgb`, `reflectanceToKS`, `ksToReflectance` from
`blending/conversions.ts`. The K/S formulas themselves are *correct* — they are exact algebraic inverses
of the published relation — but they have no other caller, and what they are applied to (three
gamma-encoded sRGB channels, under the single-constant simplification, with no Saunderson correction) is
not Kubelka–Munk. Keeping them invites the same mistake again.

⚠️ **Do not promise more than spectral.js delivers.** Its own tracker
([issue #24](https://github.com/rvanwijnen/spectral.js/issues/24)) reports that 50/50 black + white comes
out *too bright* versus real paint. Measured here, white + black gives `#010101` on the bot (far too
dark) and `#a6a6a6` on the web (upstream says too light). Delegating fixes the catastrophic case and
makes the two surfaces agree; it does not make the mode physically exact.

*Alternative if a zero-dependency path is ever required:* Jakob & Hanika's sigmoid-quadratic spectral
upsampling (CGF 38(2), 2019 — 3 coefficients, ~6 FLOPs, used by PBRT and Mitsuba) is the cheapest
credible option. Strictly more work for the same user-visible result; not recommended now.

### 1.2 Fix the tests that certified the bug

- `blending.test.ts:157` — *"spectral: black dominates the mix (physically correct pigment behavior)"*
  asserts only `r, g, b < 50`. A function returning pure black unconditionally passes it. Replace with
  an assertion against the corrected behaviour (white+black must land in a mid range, not at 1/255).
- `blending.integration.test.ts:99` and `:108` — remove the `mode !== 'spectral'` exemptions from the
  monotonic-gradient and endpoint checks. Spectral has no reason to be exempt once 1.1 lands.

---

## Sprint 2 — One implementation per named mode (P1)

### 2.1 Choose the canonical RYB and delete the other

Two implementations, and they disagree by up to ΔE₀₀ 38:

| | `RybColorMixer` (Gossett–Chen cube) | `blending/conversions` (chromatic subtraction) |
|---|---|---|
| Identity law | **fails, 53 % of dye pairs**, max ΔE₀₀ 27.9 | passes exactly |
| Round-trip over 125 dyes | mean ΔE₀₀ 3.47, max 27.87 | mean 0.00, max 0.00 |
| Cost per conversion | ~9 starts × 20 Newton iterations × 7 trilinear evals | a dozen arithmetic ops |
| Pedigree | cited to a published paper | folk heuristic |

**Recommend: standardise on the chromatic-subtraction implementation.** A mixer slider that does not
return the input dye at 0 % is a defect a user can see in one drag, and no amount of academic pedigree
compensates.

The pedigree is real — the corner table is verified against Gossett & Chen — but so is the limit. Their
trilinear cube maps into the **convex hull of its eight corners**, only three of which sit on an sRGB
cube corner, so pure green, blue, cyan, magenta and true black have no RYB pre-image at all. The paper
defines no inverse, and the one the code adds cannot converge for those targets. ColorAide, which
implements the same cube with the same Newton-method inverse, documents the same limitation. **This
cannot be fixed by tuning the solver.**

If the Gossett–Chen *look* is wanted, the honest way to keep it is as a separate, clearly-labelled mode
documented as non-invertible — not as the thing behind a 0-to-100 % slider.

⚠️ **When swapping, note the two families use opposite conventions for the RYB origin**: Gossett–Chen
puts white at RYB (0,0,0), the chromatic-subtraction code puts black there. It cancels out for a
round-trip mix, but do not assume the axes mean the same thing.

**While the file is open**, fix two verified citation errors in `RybColorMixer.ts`: the black corner is
`(0.2, 0.094, 0.0)` in the paper, not `(0.2, 0.09, 0.0)`; and the paper is **IEEE InfoVis 2004**,
pp. 113–118, not "their 2006 paper".

### 2.2 Collapse the two mixing APIs into one

**Do:** keep `@xivdyetools/core/blending` as *the* public mixing surface — it was deliberately made
dependency-light (REFACTOR-005) so consumers need not pull the dye database — and reduce
`ColorService.mixColors{Rgb,Lab,Oklab,Ryb,Hsl,Spectral}` to thin delegations to `blendColors()`.

That keeps both call sites source-compatible while guaranteeing one answer. After 1.1 and 2.1 the two
already agree; delegation is what stops them drifting apart again.

### 2.3 og-worker must not silently substitute an algorithm

`apps/og-worker/src/services/svg/gradient.ts:39-43` handles `oklab` and `rgb` and defaults everything
else to `lab` — so a `spectral`, `ryb` or `hsl` share card renders in a *different algorithm* than the
card the user is sharing.

**Do:** support all six modes via `blendColors()`. This is a handful of lines once 2.2 lands, and it is
the direct application of the governing principle — the front end selects, core computes.

---

## Sprint 3 — Correctness hardening (P2)

### 3.1 Delete `getDeltaE_OklchWeighted`

Its hue term under-weights by a factor of π at small angles even at the documented-neutral `kH = 1`, and
it has no production caller (only two web-app test files reference it; the `oklch-weighted`
`MatchingMethod` was retired in the 5.0 suite). Deleting removes a wrong formula and dead weight in one
step. If a weighted metric is wanted later, build it on ΔH = 2·√(C₁C₂)·sin(Δh/2).

### 3.2 Use the exact CIE constants

Replace `epsilon = 0.008856` / `kappa = 903.3` with `216/24389` and `24389/27` (equivalently CIE
15:2004's `(24/116)³` and `841/108`) in `ColorConverter` and `blending/conversions.ts`, and drop the 4-dp
`round()` on `rgbToLab`'s output.

The repo is carrying the pre-2004 rounded pair. CIE 15:2004 replaced them with the exact rationals
specifically because independent rounding leaves the two branches of f(t) not meeting — a ≈3.3 × 10⁻⁵
jump in L\* that also makes the function very slightly non-monotonic, and therefore non-invertible, right
at the junction. Visually irrelevant; the exact fractions cost nothing.

**Leave the D65 white point and sRGB matrix alone.** They are the ASTM/Lindbloom pair and are consistent
with each other, which is the property that matters. CSS Color 4's alternative pair differs by
ΔE₀₀ ≈ 0.015. Swapping one without the other would be the actual bug.

### 3.3 Freeze the CIEDE2000 conformance vector as a test

**The implementation already passes** — all 34 of Sharma, Wu & Dalal's supplementary pairs, max deviation
4.95 × 10⁻⁵ against data quoted to 4 dp (probe `07-ciede2000-sharma.mts`, ready to lift into the suite).

This is a regression gate, not a fix. It is worth having because those 34 pairs specifically target the
mean-hue and arctangent edge cases where Sharma et al. found that "several implementations distributed on
the Internet, including some from reputable sources, were erroneous", and where the CIE standard's own
text is ambiguous. Nothing else in the suite would catch a regression there.

### 3.4 Make harmony use the suite's default metric

`HarmonyGenerator` defaults `deltaEFormula` to `'cie76'` at two call sites, and no caller anywhere
overrides it — so harmony always ranks by CIE76 while every other tool ranks by CIEDE2000, a metric that
disagrees on the winner 31.5 % of the time.

**Do:** default to `DEFAULT_MATCHING_METHOD` instead of the hard-coded `'cie76'`. The
`HARMONY_MAX_DISTANCE` table already carries a `ciede2000: 25` threshold, so the scale is handled. Expect
harmony results to change — changelog it.

This closes the "harmony ΔE76" item left open by the 2026-08-08 5.0 design review.

### 3.5 Consider ΔEOK2 in place of plain ΔEOK for the `oklab` method

CSS Color 4 §20.4 defines **ΔEOK2** — plain Oklab Euclidean with `a` and `b` scaled by 2 — because plain
ΔEOK "under-estimates differences in colorfulness compared to differences in lightness". The factor comes
from Ottosson's own testing against perceptual datasets (2.016 on COMBVD, 2.045 on OSA-UCS). §20.5 goes
further and *recommends* ΔEOKr2 (ΔEOK2 plus the toe lightness remap) for performance-sensitive
implementations.

**Measured on our own dye set** (probe `06-deltaeok2.mts`, 2 000 random sRGB queries), taking CIEDE2000 as
the reference and asking how often each variant picks a *different* winning dye:

| metric | disagrees with CIEDE2000 |
|---|---|
| plain ΔEOK (what ships today) | 31.5 % |
| **ΔEOK2 — `a`,`b` × 2** | **23.9 %** |
| ΔEOKr2 — toe remap + × 2 | 24.3 % |
| cie76 (for scale) | 31.2 % |

So ΔEOK2 cuts disagreement with the perceptual reference by roughly a quarter, and **the toe remap buys
nothing here** — it is slightly worse and much more code. Take the `a,b × 2` and skip ΔEOKr2.

This is a one-line change (`Math.sqrt(dL² + (2·da)² + (2·db)²)`). It **changes ranking**, so it needs the
same changelog treatment as 2.1 and 3.4.

Useful for the UI while here: CSS Color 4 §14.2.1 puts **one JND at ΔEOK ≈ 0.02** (the Lab range is
0–100 and Oklab's is 0–1, so the ΔE2000 JND of 2 scales down by 100×).

### 3.6 Add algebraic-law gates for every mixing mode

Promote the checks from `probes/04-algebraic-laws.mts` into the suite, run over the full dye set for all
six modes with **no per-mode exemptions**:

- identity at t = 0 and t = 1
- commutativity at t = 0.5
- idempotence: `mix(A, A, t) == A` (for K–M this holds by construction — if `(K/S)_A = (K/S)_B` then any
  convex combination is `(K/S)_A` — so a failure is a normalisation or rounding bug)
- monotonic progression across a gradient, with no reversals and no overshoot past either endpoint

Both P1 defects in this audit would have been caught on the first run. The existing suite's per-mode
exemption lists are precisely how they survived.

Plus the canonical qualitative pigment checks for `spectral` and `ryb`, which are the two modes that make
a physical claim:

| Pair | Expected |
|---|---|
| blue + yellow | a saturated **green** — the single most-cited K–M test, and Mixbox's own motivating example |
| red + green | muddy **brown/olive**, not a flat average |
| white + saturated red | a **saturated pastel**, hue roughly stable as white increases |
| black + white 50/50 | a **mid-to-dark grey** — not `#010101`, and not `#a6a6a6` either |

Assert these as *bands*, not exact hex values, so the gate survives a future change of spectral backend.

---

## Sprint 4 — Say true things in the UI (P2)

### 4.1 Stop describing the mode by a mechanism it does not use

Until 1.1 lands, `apps/discord-worker/src/commands/schemas.ts` offers *"Spectral - Kubelka-Munk physics"*
for something that is not Kubelka–Munk. After 1.1 the label becomes accurate; the point is that the label
should be checked against the implementation, not written from intent.

Likewise `mixer-blending-engine.ts`'s docstring predicts *"RYB: Blue + Yellow = Olive Green"* and
*"Spectral: Blue + Yellow = Green"*. The first matches the Gossett–Chen path (`#8db26b`); the second is
true of the web path and false of the bot's.

### 4.2 Surface that the matching algorithm changes the answer

Against the 125-dye set over 1 000 random queries, the non-default methods pick a *different* winning dye
than `ciede2000` in 31.5 % (`cie76`), 31.7 % (`oklab`), 42.6 % (`redmean`) and 44.3 % (`rgb`) of cases.
Worth one line in the tool help — users currently have no signal that the toggle is consequential.

---

## Suggested order

| Sprint | Ships | Risk |
|---|---|---|
| 1 | Correct colours on the Discord bot | Low — one delegation + test updates |
| 2 | One answer across all three surfaces | Medium — picks a winner between two RYB models; changes web-app output |
| 3 | Regression gates + precision | Low |
| 4 | Honest labels and help text | Low |

Sprint 2.1 changes what the web mixer renders for `ryb`. That is a deliberate, user-visible change and
should be called out in the changelog rather than slipped in.

---

## Explicitly not recommended

- **Do not touch the k-d tree.** It is Euclidean-only and correctly used only for `matchingMethod ===
  'rgb'`; all perceptual methods take an exact linear scan. At n = 125 that is the right design, and the
  in-code comments already record why the previous pre-filter was removed.
- **Do not switch the default matching method.** `ciede2000` is the industry standard and the current
  default. Nothing in this audit argues against it.
- **Do not adopt Mixbox** without a licence review — see [02-mixing-algorithms.md](./02-mixing-algorithms.md).
