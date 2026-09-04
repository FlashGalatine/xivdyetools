# Colour Harmony Geometry — Tradition vs Evidence

`HarmonyGenerator` offers complementary (180°), split-complementary (150°/210°), triadic (120°/240°),
tetradic (60°/180°/240°), square (90°/180°/270°), analogous (±30°) and monochromatic, rotatable in HSL,
CIELCh or Oklch.

The implementation is fine. This document is about whether the *rules* mean what the UI implies — because
the honest answer is more interesting than "yes", and it changes how they should be labelled.

---

## The line worth drawing

| Rule | Status |
|---|---|
| **Analogous** (±30°) | **Directly supported** by psychophysical evidence |
| **Monochromatic** | **Directly supported** — same finding |
| **Complementary** (180°) | **Contested — actively contradicted** at the pair level |
| **Split-complementary** (150°/210°) | **Never tested** |
| **Triadic** (120°/240°) | **Never tested** |
| **Tetradic / square** | **Never tested** |

"Never tested" is not "refuted". It means the psychophysical literature contains no study that measured
them, in either direction. They are documented artistic tradition with no empirical confirmation.

---

## Where the offsets come from

**Goethe (1810)**, *Zur Farbenlehre* — the earliest primary source located for "180° opposition =
harmony", on a six-hue wheel:

> the colours diametrically opposed to each other in this diagram are those which reciprocally evoke each
> other in the eye. Thus, yellow demands purple; orange, blue; red, green.

**Itten (1961)**, *The Art of Color* — the direct ancestor of the offsets the tool ships, on a twelve-hue
**RYB** wheel:

> All complementary pairs, all triads whose colors form equilateral or isosceles triangles in the
> twelve-member color circle, and all tetrads forming squares or rectangles, are harmonious.

Itten's harmony criterion is that the mixture yields a neutral grey. Note that is a claim about *pigment*
mixing on an RYB wheel — not about hue angles in any colorimetric space.

**Munsell (1905)** explicitly rejected the RYB basis, calling it *"a widely accepted error"* since
*"Brewster's theory was long ago dropped when the elements of color vision proved to be RED, GREEN, and
VIOLET-BLUE"*. His complement of red is **blue-green**. **Ostwald (1918)** used a 24-hue wheel on Hering's
opponent primaries; his complement of red is **sea-green**.

So "the complement of red" has at least four mutually inconsistent traditional answers — Itten/Goethe:
green; Munsell: blue-green; Ostwald: sea-green; and RGB/HSV: **cyan**. Complementarity is a fact about a
*wheel*, not about colour.

---

## The RYB-vs-HSV gap is large, and the tool sits on the wrong side of it

The traditional offsets are defined on the artist's RYB wheel. Rotating HSV hue by 180° is **not** the
same operation:

| Colour | RYB wheel angle | RGB/HSV angle |
|---|---|---|
| Red | 0° | 0° |
| Orange | 60° | 30° |
| Yellow | 120° | 60° |
| **Green** | **180°** | **120°** |
| Blue | 240° | 240° |
| Purple | 300° | 300° |

Red's traditional complement is green — 180° on the RYB wheel, but only ≈**120°** in HSV terms.
**A tool that rotates HSV hue by 180° from red lands on cyan, not the artist's green.**

This is a genuine mismatch between what the labels promise and what the geometry delivers, and it applies
to every offset the tool ships, not just complementary. Two caveats keep it from being a defect:

- There is **no colorimetric standard for an RYB wheel** — every software RYB parameterisation is ad hoc,
  and published conversion tables disagree at intermediate points even when they agree at the primaries.
  So "rotate on the RYB wheel instead" is not a well-defined fix.
- Since the empirical support for the fixed-angle rules is weak anyway (below), moving them onto a
  different wheel would trade one unvalidated geometry for another.

---

## What the psychophysics actually found

**Schloss & Palmer (2011)**, *"Aesthetic response to color combinations: preference, harmony, and
similarity"*, Attention, Perception & Psychophysics 73(2):551–571, open access at
[PMC3037488](https://pmc.ncbi.nlm.nih.gov/articles/PMC3037488). 48 colour-vision-screened observers, 32
CIELAB-sampled colours, 992 pairwise combinations, with harmony rated separately from preference.

> pair preferences are highest when the figure and ground have the same hue … and decrease monotonically
> as hue difference between the figure and ground increases

Hue similarity explained **53.5 %** of preference variance and **67.3 %** of harmony variance. And
directly against the complementary rule:

> there is virtually no evidence supporting Chevreul's claim that contrastive hues are harmonious

Paint-complement pairs rated *less* harmonious than the same hues paired with a near-complement.

The paper also explains why the folk belief survives: **figural preference** — how good a colour looks
*against* a background — does rise with hue contrast. *"People do not like strong hue contrasts because
such combinations are harmonious; they like colors against strongly contrastive backgrounds because they
make the figural color itself look 'better'."* Two dissociable constructs that classical theory conflated.

For a dye tool this distinction is unusually relevant: a player picking a coat and trousers is closer to
the *pair-harmony* task, while a player picking an accent against a base is closer to the *figural* one.

**Ou & Luo (2006)**, *"A colour harmony model for two-colour combinations"*, Color Research & Application
31(3):191–204. 1 431 colour pairs, 54 CIELAB-sampled colours, 17 observers. The fitted model is a smooth
regression over chroma, lightness and hue differences:

```
CH = HC + HL + HH
HC = 0.04 + 0.53·tanh(0.8 − 0.045·ΔC)
HL = 0.3 + 0.5·tanh(−4 + 0.029·(L1+L2)) + 0.14 + 0.15·tanh(−2 + 0.2·|L1−L2|)
```

**There is no term anywhere that rewards a specific hue-angle difference.** The leading quantitative,
psychophysically-fitted harmony model is structurally incompatible with snapping to template angles.

**The computational tradition's own foundation is unverifiable.** Cohen-Or, Sorkine, Gal, Leyvand & Xu
(2006), *"Color Harmonization"*, ACM TOG 25(3):624–630 — the paper that gave computer graphics the i/V/L/
I/T/Y/X hue templates (18°, 93.6°, 180° sectors) — grounds them thus:

> Based on Itten's schemes and extensive psychophysical research, Matsuda [1995] introduced a set of 80
> color schemes … Our color harmonization method is also based on these schemes.

Matsuda, Y. (1995), *Color Design*, Asakura Shoten — an untranslated Japanese book with **no discoverable
digitised copy**. Its sample size, task and population cannot be checked. Cohen-Or's own paper validates
with before/after image examples, not a human-preference study.

**One dissenting recent result**, flagged as a preprint: arXiv:2508.15777 (2025), 346 participants, found
a broad elevation in preference across a **160°–220° band** — but explicitly rejects sharp templates
(*"the assumption of hue independence cannot be reasonably upheld"*). Broad and hue-dependent, not a spike
at 180°. This sits in real tension with Schloss & Palmer; the honest summary is **unresolved**, not
settled either way.

---

## Colour space for the rotation

`rotateHueInSpace` supports `hsl`, `lch` and `oklch`. Preferring an LCh-family space is well-founded:
Ottosson documents that a constant-S/V HSV hue sweep produces *"clear differences in lightness for
different hues … yellow, magenta and cyan appear much lighter than red and blue"*.

But he is equally clear that CIELAB does not fully solve it either — *"their largest issue is their
inability to predict hue. In particular blue hues are predicted badly"* — with CIELAB, CIELUV **and** HSV
all shifting toward purple when blending toward blue.

**Important limit:** no study connects perceptual-uniformity of the rotation to human preference for the
resulting palette. The colour-space literature and the harmony-preference literature are separate bodies
of work that do not cite each other. Choosing Oklch makes the rotation *perceptually even*; it does not
make the harmony rule *valid*.

---

## What this implies for the tool

Nothing here is a bug, and none of it argues for removing features — people ask for triadic schemes and
the tool should offer them. It argues for **honest labelling** and one default change:

1. **Don't claim science the rules don't have.** Present these as the artist's traditional schemes —
   which they genuinely are, with a documented 200-year lineage — rather than implying perceptual
   validation. Analogous and monochromatic are the two that can honestly claim empirical support.
2. **Prefer `oklch` over `hsl`** as the rotation space where a default is chosen. It is better founded on
   its own terms, even though it does not validate the offsets.
3. **Consider surfacing hue *similarity*.** The one robust finding across both major studies is that
   harmony rises as hue difference shrinks. A "closely related" suggestion mode would be the most
   evidence-backed thing the harmony tool could offer, and it is essentially what analogous already does.
4. **Know which question the user is asking.** Schloss & Palmer's pair-harmony/figural-preference split
   maps onto "two garments together" versus "accent against a base" — a distinction the tool currently
   does not make, and the likeliest reason a "harmonious" suggestion sometimes looks wrong in practice.

---

## Could not verify

- **Matsuda (1995)** — the primary source for the computational templates. No digitised copy found.
- **Moon & Spencer (1944)**, *"Aesthetic Measure Applied to Color Harmony"*, JOSA 34:234 — cited by the
  2025 preprint; could not be located on Optica's own search. Existence unconfirmed.
- **Ou & Luo (2006)** primary text (paywalled); the formula above is reconstructed from an open conference
  precursor plus convergent secondary citations.
- **Ostwald (1918)** primary text.
- Whether Itten's own book uses the terms "analogous" or "split-complementary" — only
  complementary/triad/tetrad language was found directly.
- Any peer-reviewed study testing Oklch specifically against human harmony preference.
