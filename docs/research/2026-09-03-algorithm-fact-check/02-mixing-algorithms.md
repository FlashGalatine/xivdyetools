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

Two implementations ship, and they are not two versions of the same thing.

### What the theory actually requires

**Sources:** Kubelka, P. & Munk, F. (1931), *"Ein Beitrag zur Optik der Farbanstriche"*, Zeitschrift für
technische Physik 12:593–601; Kubelka, P. (1948), *"New Contributions to the Optics of Intensely
Light-Scattering Materials, Part I"*, JOSA 38(5):448–457, DOI 10.1364/JOSA.38.000448.

For an opaque layer:

$$\frac{K}{S} = \frac{(1-R_\infty)^2}{2R_\infty} \qquad R_\infty = 1 + \frac{K}{S} - \sqrt{\left(\tfrac{K}{S}\right)^2 + 2\tfrac{K}{S}}$$

**The repo's two functions implement these correctly.** `reflectanceToKS` and `ksToReflectance` in
`blending/conversions.ts` are the right formulas, and they are exact algebraic inverses. The defect is
not in the formulas — it is in what they are applied to.

Three requirements the repo's usage does not meet:

**1. K–M is per-wavelength, on a spectral reflectance curve.** Not per-RGB-channel. Burns states the
information-theoretic reason directly (*"Subtractive Color Mixture Computation"*, arXiv:1710.06364):

> RGB values are sufficient to describe a specific color sensation, [but] they do not contain enough
> information to predict the RGB color that would result from a subtractive mixture of two specified
> RGB colors.

This is why blue + yellow → green is unreachable per-channel. Stephen Westland sets out the mechanism
(https://colourware.org/2018/05/18/why-yellow-and-blue-dont-make-green/): blue reflects the short third
of the spectrum, yellow the middle-and-long two-thirds, and the **overlap is the green band ~500–565 nm**
— the only region where both pigments fail to absorb. A per-channel scheme computes G_out solely from
(blue_G, yellow_G); it structurally cannot consult blue's B value while computing G, so it has no way to
manufacture the surviving band. Empirically confirmed too: *Pigmento* (Tan et al., IEEE TVCG 25(9) 2019,
arXiv:1707.08323) reports at Fig. 4 that 3-wavelength K–M recovery "produces significantly distorted
color gamuts" against an 8-wavelength model.

**2. Reflectance must be linear.** The repo feeds `channel / 255` — gamma-encoded sRGB. At a mid-tone
sRGB 128/255 (nominal 0.5), the true linear reflectance is
`((0.5 + 0.055)/1.055)^2.4 ≈ 0.214`, so the correct K/S is ≈1.44 against the ≈0.25 the unlinearised
value gives — **off by a factor of ~5.8×, and worse in shadow than in highlight** because K/S is convex
near zero.

This error class has a peer-reviewed name-check: Chen, Chang & Zhu, *"CoolerSpace: A Language for
Physically Correct and Computationally Efficient Color Programming"*, Proc. ACM Program. Lang. 8 OOPSLA2
Article 301 (2024), DOI 10.1145/3689741 — *"Incorrectly performing linear physics operations in a
non-linear color space is a common issue of color programming in the wild."*

**3. Single-constant K–M has a precondition the repo does not meet.** `(K/S)_mix = Σ cᵢ (K/S)ᵢ` — what
the repo uses — is valid only when scattering is dominated by a *shared* medium (dyes in a common
substrate, glazes over one ground). Mixing two arbitrary opaque colours needs the two-constant form,
`K_mix = Σ cᵢKᵢ`, `S_mix = Σ cᵢSᵢ`. See Berns & Mohammadi, *"Single-constant simplification of
Kubelka-Munk turbid-media theory for paint systems — A review"*, Color Res. Appl. 32(5) (2007).

The **Saunderson correction** (Saunderson, JOSA 32(12):727–736, 1942; now ISO 18314-2:2023) for the
coating/air interface is absent from the repo — and, for the record, from `spectral.js` too.

### One thing the repo does get right

It clamps reflectance to [0.001, 0.999] before computing K/S. Without that guard, `K/S(0) = 1/0 =
Infinity`, and the inverse then evaluates `1 + ∞ − √(∞² + 2∞)` = **NaN** — so an unguarded version of
this pipeline would emit NaN for every pure primary and secondary, black and white included. The clamp
converts a NaN crash into the near-black collapse measured in [03-findings.md](./03-findings.md). That
is a better failure, but it is still a failure.

### `spectral.js` — the implementation the web path uses

`spectral.js@3.0.0`, Ronald van Wijnen, **MIT**, github.com/rvanwijnen/spectral.js.
**11,798 bytes minified; 5,863 bytes gzipped** (measured directly from the installed package).

It does the job properly: linearises sRGB with the exact piecewise EOTF, then decomposes linear RGB over
**seven fixed primary reflectance curves** (White, Cyan, Magenta, Yellow, Red, Green, Blue) of **38
samples each, 380–750 nm at 10 nm**, adapted from Burns' LHTSS spectral-upsampling method. Mixing happens
in K/S space per band, then it gamut-maps out-of-sRGB results by reducing OkLCh chroma under a ΔE-OK
binary search (`method: 'map'`). No Saunderson correction.

Concentration weighting is `factor² × tintingStrength² × luminance`, which is a design choice rather than
a derivation — and it has open criticism in the library's own tracker. **Issue #24 reports that a 50/50
black + white mix comes out too bright** against real paint (which lands nearer Munsell value 3). That is
worth stating plainly next to this audit's own measurement: for white + black our two implementations
give `#010101` (bot, far too dark) and `#a6a6a6` (web, documented by upstream as too light). **Neither is
right; only one is in the right postcode.** Issue #13 questions the arbitrariness of the luminance
weighting; Issue #21 questions whether the seven primaries are redundant.

### Spectral upsampling — the literature

- **Burns, S.A. (2020)**, *"Numerical Methods for Smoothest Reflectance Reconstruction"*, Color Res.
  Appl. 45(1), DOI 10.1002/col.22437, and the companion essay *"Generating Reflectance Curves from sRGB
  Triplets"* (arXiv:1710.05732, CC BY-SA 4.0). Defines LSS / LLSS / **LHTSS**; LHTSS guarantees
  reconstructed reflectance strictly within (0,1). This is what `spectral.js` is built on.
- **Smits, B. (1999)**, *"An RGB-to-Spectrum Conversion for Reflectances"*, J. Graphics Tools 4(4):11–22.
- **Meng et al. (2015)**, *"Physically Meaningful Rendering using Tristimulus Colours"*, CGF 34(4).
- **Jakob & Hanika (2019)**, *"A Low-Dimensional Function Space for Efficient Spectral Upsampling"*,
  CGF 38(2):147–155 — sigmoid-smoothed quadratic, 3 coefficients, ~6 FLOPs to evaluate; adopted by PBRT
  and Mitsuba. The best choice if core ever wants a zero-dependency path.

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
