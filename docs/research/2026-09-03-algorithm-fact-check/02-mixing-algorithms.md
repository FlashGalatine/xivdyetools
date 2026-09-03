# Mixing Algorithms vs the Literature

Six named modes, verified against their published definitions. Implementation defects are catalogued in
[03-findings.md](./03-findings.md); this document is the source-by-source comparison.

---

## `rgb` — channel-wise linear interpolation

`blendRGB()` / `ColorService.mixColorsRgb()` interpolate the three **gamma-encoded** sRGB channels.

This is the standard "naive" blend. It is not physically meaningful — averaging gamma-encoded values is
not averaging light — but it is what every graphics API has always done, it is what users expect from a
control labelled "RGB", and it obeys every algebraic law. **Correct as labelled.**

Its well-known failure is the one the tool's own help text names: blue + yellow → grey (`#808080`), never
green, because additive light mixing has no mechanism to produce green from those two.

---

## `lab` — CIELAB linear interpolation

Interpolates L\*, a\*, b\* independently, then converts back.

Correct as an implementation of "lerp in CIELAB". The conversion in and out is checked in
[01-matching-algorithms.md](./01-matching-algorithms.md); both copies of `rgbToLab` in the repo agree to
2 × 10⁻⁴.

The known artefact — visible in the probe output as blue + yellow → `#ca8aaa`, a dusty pink — is CIELAB's
documented blue-region hue non-uniformity: the straight line between blue and yellow in L\*a\*b\* passes
through the purple/pink region rather than through neutral. This is a property of the space, not a bug,
and it is precisely the defect Oklab was designed to remove.

---

## `oklab` — Oklab linear interpolation

Interpolates Oklab L, a, b. The conversion matrices reproduce Ottosson's published values exactly
(see [01-matching-algorithms.md](./01-matching-algorithms.md)).

Blue + yellow → `#6cabc7`, a desaturated blue-cyan: better behaved than CIELAB's pink, still not green,
because Oklab — like CIELAB — is a perceptual *coordinate* space, not a pigment model. Neither space
claims to predict paint. **Correct as labelled.**

---

## `hsl` — shortest-arc hue interpolation

`blendHSL()` interpolates S and L linearly and takes the shortest arc in hue, with correct wraparound.
`rgbToHsl`/`hslToRgb` are the standard formulations and round-trip cleanly.

Correct, with the usual caveat that HSL hue is an sRGB-derived construct with no perceptual uniformity —
which is why blue + yellow → `#00ff80` (a vivid spring green): the midpoint of hue 240° and 60° is 150°,
regardless of how the two colours actually look.

---

## `ryb` — the artist's wheel

Two implementations ship. Both are recognisable members of a real tradition; they are not
interchangeable.

### Gossett–Chen trilinear cube — `RybColorMixer.ts`

**Source:** Nathan Gossett & Baoquan Chen, *"Paint Inspired Color Mixing and Compositing for
Visualization"*, **IEEE Symposium on Information Visualization (InfoVis) 2004**, pp. 113–118.
ACM DL: https://dl.acm.org/doi/10.5555/1038262.1038789

> The file's comment says "their 2006 paper". It is 2004. The 2005/2006 dates that circulate online are
> wrong.

**Corner table — verified against the paper:**

| RYB corner | Name | Paper | `RybColorMixer.ts` | |
|---|---|---|---|---|
| (0,0,0) | white | (1.0, 1.0, 1.0) | same | ✅ |
| (1,0,0) | red | (1.0, 0.0, 0.0) | same | ✅ |
| (0,1,0) | yellow | (1.0, 1.0, 0.0) | same | ✅ |
| (0,0,1) | blue | (0.163, 0.373, 0.6) | same | ✅ |
| (1,1,0) | orange | (1.0, 0.5, 0.0) | same | ✅ |
| (1,0,1) | violet | (0.5, 0.0, 0.5) | same | ✅ |
| (0,1,1) | green | (0.0, 0.66, 0.2) | same | ✅ |
| (1,1,1) | black | (0.2, **0.094**, 0.0) | (0.2, **0.09**, 0.0) | ❌ off by 0.004 |

The desaturated blue `(0.163, 0.373, 0.6)` is **the paper's own value**, not an import from another
implementation — it is a deliberate choice following Johannes Itten's colour model, and it is the single
corner where the two RYB traditions disagree most. Likewise the "black" corner is a muddy dark olive by
design: the paper reasons explicitly that mixing many pigments yields a muddy brown, not black.

**Interpolation:** the paper specifies trilinear, and additionally offers a biased variant using a
smoothstep ease, `cubicInt(t, A, B) = A + t²(3−2t)(B−A)`, to pull results toward the eight characteristic
colours. The repo implements the plain trilinear form.

**The paper defines no RGB→RYB inverse.** Sugita & Takahashi (IIEEJ Trans. 5(2), 2017) state it
directly: *"Gossett and Chen did not provide the details for converting from the RGB space to the RYB
space."* ColorAide, which also implements this cube, likewise adds a Newton-method inverse and says so.
The repo's multi-start Newton–Raphson is therefore a standard, legitimate addition — not a deviation.

**But the map is not surjective, and that is provable.** Trilinear interpolation is a nested convex
combination, so the image is confined to the **convex hull of the eight corner RGB values**. Only three
corners (white, red, yellow) lie on an sRGB cube vertex; the other five are interior points. Pure green,
pure blue, cyan, magenta and true black therefore have **no RYB pre-image at all**. This is the root
cause of the identity-law failure measured in [03-findings.md](./03-findings.md), and no solver
improvement can remove it. ColorAide documents the same consequence: *"translation of colors outside the
gamut will have poor conversions."*

### Chromatic subtraction — `blending/conversions.ts`

The other widely-copied RYB family: strip the shared "whiteness" `w = min(r,g,b)`, redistribute the
remainder through nested min/max splits, renormalise by a max ratio, add `w` back.

**Provenance is folklore.** The most-copied JavaScript form is Dave Eddy's `rgb2ryb`
(github.com/bahamas10/node-rgb2ryb), whose README credits a now-dead domain (`insanit.net`); no mirror
was located and the original author and date are **unverified**. Notably, Eddy has since deprecated his
own package — *"The calculations presented here are not accurate"* — in favour of a Gossett–Chen
cube-based one.

A separate, peer-reviewed lineage with a structurally similar approach exists — Sugita & Takahashi,
*"Computational RYB Color Model and its Applications"*, IIEEJ Trans. Image Electronics and Visual
Computing 5(2):110–122 (2017),
https://www.jstage.jst.go.jp/article/tievciieej/5/2/5_110/_pdf/-char/en — cited as the algorithmic basis
by the CRAN package PBSmapping. Whether it is formula-identical to the folklore code was **not
confirmed**.

Its practical virtue is measurable and decisive for this codebase: it is an **exact bijection** (round-trip
ΔE₀₀ 0.00 across all 125 dyes), so it satisfies the identity law the cube cannot.

**The two families use opposite conventions for the RYB origin** — Gossett–Chen puts white at (0,0,0),
this family puts black there. The convention cancels for a round-trip mix but matters to anyone editing
either file.

### Is RYB defensible at all?

Worth stating plainly, since the tool offers it as a mode. The colour-science position is that RYB is a
**poor physical model** of subtractive mixing: Stephen Westland (Univ. of Leeds) sets out the core
mismatch — the pairwise sums of the additive primaries R/G/B are **C/M/Y, not R/Y/B** — and notes CMY
gives a substantially larger gamut from three primaries (https://colourware.org/2011/03/19/ryb-primaries/).
RYB was superseded by Helmholtz-era colour science in the 19th century and survives through art
education, most influentially Itten's *The Art of Color* (1961).

Its defence is **pedagogical and intuitive, not physical**: it matches the tubes on a painter's palette
and gives the hue relationships people are taught. That is a legitimate reason for a cosmetics tool to
offer it — but no peer-reviewed source defending RYB on HCI grounds was located, so the mode should be
presented as "the artist's wheel", never as physically accurate.

---

## `spectral` — Kubelka–Munk

Two implementations ship, and they are not two versions of the same thing: one is genuine spectral
mixing, the other is not Kubelka–Munk in any meaningful sense. See the P0 entry in
[03-findings.md](./03-findings.md) for the evidence, and the section below for what the theory requires.

*(Kubelka–Munk source review pending — see 03-findings "Open".)*

---

## Modern alternative: Mixbox

**Šárka Sochorová & Ondřej Jamriška**, *"Practical Pigment Mixing for Digital Painting"*, ACM TOG 40(6),
Article 234 — **SIGGRAPH Asia 2021**. DOI 10.1145/3478513.3480549.
https://dcgi.fel.cvut.cz/en/publications/2021/sochorova-tog-pigments/

The current state of the art for RGB-in/RGB-out paint mixing. It represents an RGB colour in a
**7-dimensional latent space** — four Kubelka–Munk pigment concentrations plus three additive RGB
residuals that absorb whatever the four-pigment model cannot explain — so mixing happens under K–M while
the API stays RGB. Notably, its authors treat the gamut-mismatch problem head-on (colours unrepresentable
by pigments, and pigments unrepresentable in RGB) and design an invertible remapping around it, which is
exactly the problem Gossett–Chen leaves open.

**Licence: CC BY-NC 4.0** (github.com/scrtwpns/mixbox) — non-commercial only; commercial use requires a
paid licence from Secret Weapons. **This is a real adoption blocker** and the reason
[04-proposed-changes.md](./04-proposed-changes.md) does not recommend it without a licence review.

Other work in the window: Tan et al., *"Pigmento"*, IEEE TVCG 25(9) 2019 (arXiv:1707.08323) — pigment
decomposition *from* images, an analysis tool rather than a mixing algorithm. The frequently-cited
ancestor of this whole line is Curtis et al., *"Computer-Generated Watercolor"*, SIGGRAPH 1997.

---

## Verification notes

The following could not be confirmed from primary text and are recorded as such rather than asserted:

- Byte-identity of the Gossett–Chen document read (an author-hosted UMN technical report carrying both
  authors' emails) against the literal six-page InfoVis'04 proceedings PDF. The RYB-cube content is
  presented in that document as pre-existing rather than as its extension, and a reconstruction of the
  paper's own worked example — RYB (1.0, 0.5, 0.25) → RGB (0.8375, 0.19925, 0.0625) — reproduced to four
  decimal places, so confidence in the corner table specifically is high.
- The Mixbox paper's own text (both hosted PDFs failed extraction); its technical description here comes
  from the authors' shipped C++ source plus secondary summaries.
- The original author and date of the chromatic-subtraction heuristic.
- Whether Sugita & Takahashi's published algorithm is formula-identical to the folklore code.
