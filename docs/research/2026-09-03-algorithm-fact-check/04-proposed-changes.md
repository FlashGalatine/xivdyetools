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

## Sprint 1 — Stop shipping wrong colours (P0) — ✅ **DONE**

**Shipped in core 4.4.0.** Three assumptions in this sprint's original text turned out to be wrong on
the facts, all in our favour:

| Assumed | Actual |
|---|---|
| +5.9 KB gzip on the bot bundle | **Zero.** `ColorService` statically imports `SpectralMixer`, and bot-logic already imports `ColorService` — spectral.js was already in the bundle |
| Might need a major bump | **Minor (4.3.0 → 4.4.0).** The four K/S helpers were never exported from `blending/index.ts`, so removing them breaks no consumer |
| — | **Found a second bug:** spectral.js returns the *string* `"#NANNANNAN"` for 3-digit hex instead of throwing, so `mixColorsSpectral('#00F','#FF0')` threw where every other mode worked. Fixed in both paths |

Also worth recording: the two `spectral` exemptions in `blending.integration.test.ts` turned out **not**
to be load-bearing — the broken ramp is technically monotonic and does end at white, so it passed those
checks anyway. Removing them was hygiene; the defect is caught by the black-and-white mid-tone assertion
and the new pigment tests.

**Every mode exemption in the blending suite is now gone.** The remaining `ryb` exemption on the
monotonic-ramp check was measured and found **stale** — RYB's black→white ramp is
`#000000 #404040 #808080 #bfbfbf #ffffff`, identical to `rgb`. It dates from before BUG-006 fixed the
RYB conversion and was simply never removed. The three per-test mode lists (`bijectiveModes`,
`midToneModes`) are now driven off `ALL_MODES`, so a seventh blending mode cannot be added without being
covered by the ratio-boundary, self-mix and mid-tone assertions.

Verified after the change: bot and web now produce **identical** spectral output (surface divergence
13/42 → 6/42 cells, the remainder being RYB, which is Sprint 2), blue + yellow is `#398F54`, green + red
is a brown `#834B17`, and white + black is `#A6A6A6`. Full gates: 25/25 test tasks, 42/42 type-check +
lint.

---

### Original plan

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

## Sprint 2 — One implementation per named mode (P1) — ✅ **DONE**

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

⚠️ **This finding was WRONG ON THE FACTS as originally written, and was corrected during
implementation.** It claimed `gradient.ts:39-43` defaults `spectral` / `ryb` / `hsl` to `lab`. It does
not: that function's parameter is a **`MatchingAlgorithm`**, whose vocabulary is the six
`MatchingMethod` values (`ciede2000`, `oklab`, `cie76`, `redmean`, `rgb`, `distinguish`) — `spectral`,
`ryb` and `hsl` are not values it can ever receive. All six are in fact handled sensibly
(`oklab`→oklab, the RGB family→rgb, the LAB family→lab). Nothing was broken there.

**The real defect is one file over, and larger.** `apps/og-worker/src/services/svg/mixer.ts:69` mixed
with a hardcoded `ColorService.mixColorsLab`, and `MixerParams` had **no mixing-mode field at all** —
while `apps/web-app/src/services/share-service.ts:84` has always emitted `mode?: MixingMode` on every
mixer share URL (`mixer-tool.ts:1932`, `mode: this.mixingMode`). So **every** shared mix unfurled as a
CIELAB card regardless of which of the six algorithms the sharer had picked — including the web
mixer's own default, which is `ryb`, so the *typical* case was wrong, not an edge case.

**Done:** `?mode=` is read on both mixer routes and defaults to `ryb` (matching the web tool, so links
shared before this release still render what their sharer saw); the three-dye fold-in uses the same
mode instead of always LAB; `mode` joined the FINDING-024 query-key allowlist, is value-checked the
way `algo` is (400, never echoing the value), and — the part that is easy to miss — **joined the edge
cache key**, without which the first mode rendered for a dye pair would have been served for every
other mode for up to seven days.

**Two traps worth recording**, both found by testing rather than reading:

1. `generateMixerOG` is **not deterministic**. The shared OG mark mints a fresh `clipPath` id per
   render (`ogm0b`, `ogm1b`, …), so two identical calls return different strings. A first attempt at
   this test asserted `expect(ryb).not.toBe(lab)` over whole SVGs and **passed while `mode` was still
   being ignored entirely** — a vacuous test. The tests now assert on the emitted mix `fill`, which is
   the one pixel the mode actually decides.
2. The RYB result changed enough to falsify shipped UI copy. `mixingRybDesc` said "Blue + Yellow =
   Olive" in all six locales; the mode now returns `#008000`, a true green. Corrected ×6.

### 2.4 The Gossett–Chen citation fix is moot

The two verified citation errors (black corner `0.094` not `0.09`; IEEE InfoVis **2004** pp. 113–118,
not "their 2006 paper") lived in `RybColorMixer.ts`, which 2.1 deletes. The corrected citation is kept
in `02-mixing-algorithms.md` for the record; there is no longer any code to fix.

---

## Sprint 3 — Correctness hardening (P2) — ✅ **DONE**

### 3.1 Delete `getDeltaE_OklchWeighted` — ✅ DONE

Its hue term under-weights by a factor of π at small angles even at the documented-neutral `kH = 1`, and
it has no production caller (only two web-app test files reference it; the `oklch-weighted`
`MatchingMethod` was retired in the 5.0 suite). Deleting removes a wrong formula and dead weight in one
step. If a weighted metric is wanted later, build it on ΔH = 2·√(C₁C₂)·sin(Δh/2).

### 3.2 Use the exact CIE constants — ✅ DONE

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

### 3.3 Freeze the CIEDE2000 conformance vector as a test — ✅ DONE

**The implementation already passes** — all 34 of Sharma, Wu & Dalal's supplementary pairs, max deviation
4.95 × 10⁻⁵ against data quoted to 4 dp (probe `07-ciede2000-sharma.mts`, ready to lift into the suite).

This is a regression gate, not a fix. It is worth having because those 34 pairs specifically target the
mean-hue and arctangent edge cases where Sharma et al. found that "several implementations distributed on
the Internet, including some from reputable sources, were erroneous", and where the CIE standard's own
text is ambiguous. Nothing else in the suite would catch a regression there.

### 3.4 Make harmony use the suite's default metric — ⚠️ **premise overtaken**

**As written, this finding no longer describes live behaviour.** It was true when measured, but
the harmony convergence (PR #159) landed in between and moved the live path out from under it.

What is true now: all three surfaces — web app, Discord bot, og-worker — call
`HarmonySelector.generateHarmonySlots`, which takes `matchingMethod` as a **required** config
field, and all three pass it explicitly (the web app passes `ciede2000`). The `HarmonyGenerator.
find*Dyes()` methods that carry the `'cie76'` default are reached only through the `DyeService`
façade, and **nothing in this monorepo calls those** — they survive as published npm API. The
`'cie76'` default was therefore already unreachable in production.

**Done anyway**, because a published default that contradicts `DEFAULT_MATCHING_METHOD` is still
wrong: `DEFAULT_HARMONY_DELTA_E = 'ciede2000'`. The difference is real where the path *is* used —
the two formulas pick different complements for **40 of the 125 dyes** (32%, matching the
fact-check's 31.5% figure).

**And the rotation-space half of this finding cannot be done as described.** `generateHarmonySlots`
rotates hue in HSV unconditionally and has no `colorSpace` option at all; the bot's `color_space`
choice was deliberately *withdrawn* (`schemas.test.ts` asserts it is not registered) precisely so
the three surfaces cannot disagree. Defaulting to `oklch` would mean adding a new option to the
converged path and re-opening that divergence — a design decision, not a default flip. Left alone.

⚠️ Two vacuous tests were found in this area and fixed: one asserted only `toBeDefined()`, so
mutating the default formula left the whole file green; the other was
`expect(x === null || x !== null).toBe(true)`, which no source change can falsify. A first draft of
the replacement was *also* vacuous — it used primaries as bases, and those all sit in the 68% of
dyes where the two formulas agree.

### 3.5 Consider ΔEOK2 in place of plain ΔEOK for the `oklab` method — ✅ DONE

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

### 3.6 Add algebraic-law gates for every mixing mode — ✅ DONE

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

## Sprint 4 — Say true things in the UI (P2) — ✅ **DONE**

### 4.1 Stop describing the mode by a mechanism it does not use — ✅ DONE (mostly self-resolving)

Until 1.1 lands, `apps/discord-worker/src/commands/schemas.ts` offers *"Spectral - Kubelka-Munk physics"*
for something that is not Kubelka–Munk. After 1.1 the label becomes accurate; the point is that the label
should be checked against the implementation, not written from intent.

Likewise `mixer-blending-engine.ts`'s docstring predicts *"RYB: Blue + Yellow = Olive Green"* and
*"Spectral: Blue + Yellow = Green"*. The first matches the Gossett–Chen path (`#8db26b`); the second is
true of the web path and false of the bot's.

### 4.2 Call the harmony schemes what they are — ✅ DONE (restrained reading)

Not a bug, and not an argument for removing anything — people want triadic schemes and the tool should
offer them. But the labelling should not imply perceptual validation the rules do not have. From
[05-harmony-geometry.md](./05-harmony-geometry.md):

- **Analogous** and **monochromatic** have direct psychophysical support (Schloss & Palmer 2011: both
  preference and harmony rise monotonically as hue difference shrinks — hue similarity explains 53.5 % and
  67.3 % of variance respectively).
- **Complementary** is contested. The same study reports *"virtually no evidence supporting Chevreul's
  claim that contrastive hues are harmonious"*, with paint-complement pairs rated *less* harmonious than
  near-complements.
- **Split-complementary, triadic and tetradic have never been psychophysically tested** — in either
  direction. Documented artistic tradition (Goethe 1810 → Itten 1961), no empirical confirmation.

Also worth knowing internally: these offsets were defined on the artist's **RYB** wheel, where red's
complement (green) sits at 180°. In HSV that same green is at ≈120°, so a 180° HSV rotation from red lands
on **cyan**. There is no colorimetric standard for an RYB wheel, so this is not straightforwardly
"fixable" — but it explains why a complementary suggestion sometimes does not look like what a painter
would call the complement.

*Optional, and the most evidence-backed thing the harmony tool could add:* a "closely related" mode driven
by hue **similarity** rather than a fixed offset. That is the one robust finding across both major
studies, and it is close to what analogous already does.

### 4.3 Surface that the matching algorithm changes the answer — ✅ DONE

Against the 125-dye set over 1 000 random queries, the non-default methods pick a *different* winning dye
than `ciede2000` in 31.5 % (`cie76`), 31.7 % (`oklab`), 42.6 % (`redmean`) and 44.3 % (`rgb`) of cases.
Worth one line in the tool help — users currently have no signal that the toggle is consequential.

---

## Suggested order

| Sprint | Ships | Risk |
|---|---|---|
| 1 | Correct colours on the Discord bot | Low — one delegation + test updates |
| 2 | One answer across all three surfaces | ✅ DONE — picked chromatic subtraction; changes web + OG output |
| 3 | Regression gates + precision | ✅ DONE — but 3.5 moved 24.7% of the harmony golden (all `oklab`) |
| 4 | Honest labels and help text | ✅ DONE |

Sprint 2.1 changes what the web mixer renders for `ryb`. That is a deliberate, user-visible change and
should be called out in the changelog rather than slipped in.

---

## Explicitly not recommended

- **Do not touch the k-d tree, and do not "optimise" the perceptual scan onto it.** It is Euclidean-only
  and correctly used only for `matchingMethod === 'rgb'`; all perceptual methods take an exact linear
  scan. The in-code comments already record why the previous RGB-radius pre-filter was removed.

  This audit strengthens that: a Euclidean axis bound is **not** a valid lower bound for CIEDE2000, so
  pruning would be *unsafe*, not merely slow. Measured (`08-de00-vs-de76-bounds.mts`), the raw axis
  difference overestimates ΔE₀₀ by up to **6.4×**, and ΔE₀₀ runs as low as 0.14× ΔE76 — so a pruned tree
  would silently discard the branch holding the true winner, increasingly often as chroma rises, which is
  exactly where a dye palette lives.

  Note the plausible-sounding argument that *"S_L, S_C, S_H ≥ 1, therefore ΔE₀₀ ≤ ΔE76, therefore pruning
  is conservative"* is **false** — the G factor amplifies a\* by up to 1.5× before those divisors apply,
  and ΔE₀₀ measurably exceeds ΔE76 near the neutral axis (e.g. `(50,0,0)`→`(50,5,0)`: ΔE76 = 5.000,
  ΔE₀₀ = 6.417). If a future optimisation pass revisits this, that is the trap.

  If indexing ever genuinely becomes necessary at much larger n, the principled route is **DIN99o**
  (Cui, Luo, Rigg, Roesler & Witt, 2002) — a fixed remap of Lab whose plain Euclidean distance
  approximates CIEDE2000 accuracy while remaining a real metric, and therefore validly prunable.
- **Do not switch the default matching method.** `ciede2000` is the industry standard and the current
  default. Nothing in this audit argues against it.
- **Do not adopt Mixbox** without a licence review — see [02-mixing-algorithms.md](./02-mixing-algorithms.md).

---

## New finding, raised by Sprint 2 — a THIRD interpolation vocabulary in web-app (P1)

Sprint 2 unified the *mixing* surface. It surfaced that the **Gradient** tool is a separate,
un-unified one. There are three mode vocabularies in play, not two:

| Vocabulary | Values | Where it computes |
|---|---|---|
| `BlendingMode` (core) | rgb, lab, oklab, ryb, hsl, spectral | `packages/core/src/blending` |
| `MixingMode` (web mixer) | rgb, lab, oklab, ryb, hsl, spectral — the **same six** | delegates to core ✅ |
| `InterpolationMode` (web gradient) | rgb, **hsv**, lab, **oklch**, **lch** — a **different set** | `gradient-tool.ts:1718`, `interpolateInSpace` — **its own local implementation** |

So `apps/web-app/src/components/gradient-tool.ts` interpolates colour in the browser, in three spaces
core has no blending mode for (`hsv`, `oklch`, `lch`), with `hsv` as its **default**. That is a direct
violation of "core computes, the front end selects" — the same class of defect as the mixer's, in a
tool that was simply not in Sprint 2's scope. og-worker's gradient card, correspondingly, ignores the
`?interpolation=` the share URL carries and picks its space from the *matching* algorithm instead.

**Not fixed here** — it is materially larger than a scope-adjacent tidy-up: it means either adding
`hsv` / `oklch` / `lch` to core's public `BlendingMode` (new API, new tests, a share-URL compatibility
story) or narrowing the gradient tool to the six. That is a sprint of its own and a product decision
about which spaces the gradient tool should offer, so it is recorded rather than actioned.

---

## Sprint 3 corrections — what measurement changed

Four claims in Sprint 3 did not survive contact with the code, and are corrected in place above.
Recording them together because the pattern is consistent: each was a reasonable inference that a
measurement falsified.

1. **3.5 is not "a one-line change".** Scaling `a,b` by 2 changes the metric's *scale*, not only
   its ranking, which invalidates every calibrated threshold compared against it — the three
   `BAND_VOCABULARY` oklab rows and `HARMONY_MAX_DISTANCE.oklab`. Left un-recalibrated, a "very
   close" oklab match would have rendered as merely "close". The repo's own
   `band-vocabulary.parity.test.ts` catches this, which is why it was caught.

2. **3.6's "no overshoot past either endpoint" is not a universal law.** It holds only for `rgb`.
   `lab`, `oklab`, `ryb` and `hsl` all put an interior channel outside the endpoints' range,
   because they interpolate a straight line in a *different* space and its image in sRGB is a
   curve. The excursions are small (1–8 counts) but real. Asserting the universal version would
   have failed correct code, so the gate scopes it to `rgb` and pins concrete counter-examples.

3. **3.6's pigment table over-claims for `ryb`.** "red + green → muddy brown/olive, not a flat
   average" is a Kubelka–Munk property. `spectral` delivers it (`#834b17`); `ryb` returns exactly
   `#808080`, a flat average, and is right to — RYB is a hue-wheel geometry with no absorption
   model, so it has no mechanism for muddiness. Also, "black + white → not `#a6a6a6`" names the
   precise value `spectral` actually returns; the exclusion was an unmeasured guess.

4. **3.4's premise was overtaken** by the merged harmony convergence — see the section above.

**One non-correction worth recording.** Two mutations of the CIEDE2000 implementation survived the
new conformance gate, which looked like a coverage gap and is not: deleting the `C1p·C2p === 0`
mean-hue special case changes nothing because `dHp` is zero there, so `Hp` reaches the result only
through terms multiplying or dividing that zero; and flipping `dhp = h2p − h1p − 360` to `+ 360`
changes nothing because `dhp` enters only as `sin(dhp·π/360)`, where 720° is exactly one period.
Both branches *are* exercised by the 34 pairs (4 and 2 respectively). The gate is fine; the formula
is insensitive there. A third mutation — flipping the `Rt` sign — fails 11 of the 34.

---

## Sprint 4 notes

**4.1 largely resolved itself.** Sprint 1 made the bot's *"Spectral - Kubelka-Munk physics"* label
true rather than aspirational, and the `mixer-blending-engine.ts` docstring was corrected during
Sprint 2. One stale comment survived in `apps/web-app/src/shared/tool-config-types.ts` (RYB
described as "Blue + Yellow = Olive Green") and is fixed.

Two observations recorded rather than actioned:

- The bot spells the same six mixing modes **three different ways** across three command schemas
  (`Spectral - Pigment physics` / `Spectral - Pigment physics simulation` /
  `Spectral - Kubelka-Munk physics`). All three are now *accurate*, so this is consistency, not
  truth. Core already exports the canonical table as `BLENDING_MODES` with `name` and
  `description`, so unifying is easy — but Discord slash-command choice names are part of the
  registered schema, so it costs a command re-registration for a cosmetic gain. Left alone
  deliberately.
- **`lch` on the bot's `/gradient` is NOT a silent fallback.** Worth stating because it looks like
  one: `lch` is offered in the choices but is not a `BlendingMode`, so the obvious worry is that it
  lands in `blendColors`'s `default:` branch and renders as `rgb`. It does not —
  `packages/bot-logic/src/commands/gradient.ts` handles `rgb`/`hsv`/`lab`/`oklch`/`lch` locally and
  delegates only the other four to `blendColors`.

**4.2 taken at its narrowest.** The section's own framing is "not a bug, and not an argument for
removing anything… but the labelling should not imply perceptual validation the rules do not have."
Read strictly, that licenses removing *unsupported outcome claims*, not adding a psychophysics
lecture to a glamour tool. So: `triadic`, `tetradic` and `square` lost "for vibrant, balanced
palettes" / "for rich combinations" / "for dynamic variety" and now state their geometry; the two
schemes that DO have support (`analogous`, `monochromatic`) keep their outcome language, which is
earned; `complementary`'s "for maximum contrast" is a colorimetric statement rather than a harmony
claim and stays. Six geometric descriptions were already fine.

⚠️ This is a copy judgement, not a correctness fix — it is the one change in these four sprints a
maintainer might simply disagree with, and reverting it costs nothing.

The RYB-wheel note from `05-harmony-geometry.md` was deliberately NOT surfaced in the UI: that the
offsets were defined on a wheel where red's complement is green, while HSV puts that green at 120°
so a 180° rotation lands on cyan, is a real and interesting fact — but there is no colorimetric
standard for an RYB wheel, so there is no action a user could take on it.

**4.3** adds one line under the Matching Algorithm picker, ×6 locales. The numbers were re-measured
after Sprint 3 rather than reused: `oklab` had moved from 31.7% to **24.4%** because ΔEOK2 brought
it closer to the CIEDE2000 reference, so quoting the original figure would have been wrong.

---

## Extended finding — the gradient interpolation vocabulary is FOUR implementations, not three

Sprint 2 recorded that `apps/web-app/src/components/gradient-tool.ts` carries its own
`interpolateInSpace` over `rgb / hsv / lab / oklch / lch`. Sprint 4 found the fourth:

| Surface | Modes | How |
|---|---|---|
| core `blending` | rgb, lab, oklab, ryb, hsl, spectral | the canonical six |
| web **mixer** | the same six | delegates to core ✅ |
| web **gradient** | rgb, **hsv**, lab, **oklch**, **lch** | local implementation |
| bot-logic **gradient** | all nine — the union of both sets | **hybrid**: handles rgb/hsv/lab/oklch/lch locally, delegates oklab/ryb/hsl/spectral to `blendColors` |

So the bot's `/gradient` offers modes the web gradient does not and vice versa, and the two
implement the overlapping ones separately. Nothing here is *broken* — `lch` really does work on the
bot — but it is the same "one name, more than one implementation" shape Sprint 2 removed from
mixing, and it is now the largest remaining item in this audit. Fixing it means either promoting
`hsv`/`oklch`/`lch` into core's public `BlendingMode` (new API, new tests, share-URL compatibility)
or narrowing both gradient tools to the six. That is a product decision as much as an engineering
one, so it stays recorded rather than actioned.
