# Colour Mixing & Matching — Algorithm Fact-Check

**Date:** 2026-09-03 · **Base commit:** `876cfc2f` · **Package under review:** `@xivdyetools/core` 4.3.0

Verifies every mixing and matching algorithm in core against its published definition, against the
algebraic laws it must obey, and against the other implementation of the same thing. No code was changed
in this pass.

## Documents

| | |
|---|---|
| [00-methodology.md](./00-methodology.md) | What was checked, how, and the deliberate limits |
| [01-matching-algorithms.md](./01-matching-algorithms.md) | CIE76, CIEDE2000, Oklab, redmean, RGB, k-d tree — against the literature |
| [02-mixing-algorithms.md](./02-mixing-algorithms.md) | RGB, LAB, OKLAB, RYB, HSL, spectral — against the literature |
| [03-findings.md](./03-findings.md) | **The defect catalogue.** Every entry has a reproducible probe. |
| [04-proposed-changes.md](./04-proposed-changes.md) | **The proposal**, sequenced into four sprints |
| [probes/](./probes/) | The five scripts that produced every number quoted |

Start with [03-findings.md](./03-findings.md) and [04-proposed-changes.md](./04-proposed-changes.md).

## Headline

Core's **matching** side is in good shape — and now has a conformance pass to prove it. CIEDE2000 was
executed against all 34 of Sharma, Wu & Dalal's published test pairs: **0 failures, max deviation
4.95 × 10⁻⁵** against data quoted to four decimals. Those pairs exist specifically to catch the mean-hue
and arctangent errors the authors found in "several implementations distributed on the Internet,
including some from reputable sources". The Oklab matrices reproduce Ottosson's published values digit for
digit (and are the corrected post-2021 set); redmean matches Riemersma's formula including its `/256`
divisor; the D65 white point and sRGB matrix are consistent with each other, which is the property that
matters; and the k-d tree is correctly restricted to the one metric its pruning is valid for, with the
reasoning already recorded in-code.

Core's **mixing** side has a live defect and a structural one.

1. **`spectral` returns near-black.** The Discord bot's `/gradient mode:spectral` renders nine black
   stops out of eleven between blue and yellow. The mode applies the Kubelka–Munk K/S relation to
   *gamma-encoded sRGB channels*; K/S diverges as reflectance → 0, so any channel that is dark in either
   input is forced to ≈ 0 at every ratio. Three independent channels also cannot produce the
   blue + yellow = green result the mode is named for — that effect lives in spectral curve overlap.
   The test suite asserts the symptom as intended behaviour and exempts the mode from two other checks.

2. **Core ships two mixing APIs that disagree.** `ColorService.mixColors*` and `/blending`'s
   `blendColors()` are independent implementations. `web-app` uses the first, `bot-logic` the second, and
   `og-worker` supports only three of the six modes and silently renders the rest as `lab`. Thirteen of
   42 tested (mode, pair) cells disagree, by up to ΔE₀₀ 55.

3. **The web mixer's RYB fails the identity law** in 53 % of dye pairs — `mix(A, B, 0)` does not return
   `A` (max ΔE₀₀ 27.9). The trilinear RYB cube is not surjective onto sRGB, so its numerical inverse
   cannot be made exact.

Plus three smaller items: a dead `getDeltaE_OklchWeighted` whose hue term is under-weighted by π,
harmony silently ranking by CIE76 while the suite defaults to CIEDE2000, and rounded CIE ε/κ constants.

## The architectural read

Colour-space constants are **not** duplicated outside core — a repo-wide search for the sRGB matrices,
gamma constants and CIELAB ε/κ finds them only in `packages/core`. The conversions are already
centralised, which is the right shape.

What breaks the "core is the source of truth" principle is core itself giving two answers to the same
question, and one front end quietly substituting a different algorithm when it lacks the requested one.
The proposal collapses both.
