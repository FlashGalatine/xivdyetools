# Device / additive / subtractive colour wheels for Harmony Explorer

Research slice 03. Scope: RGB-family wheels (HSV/HSL/HWB/HSI/HSY/HSLuv), CMY(K) "printer's wheel",
warm/cool + temperature, pigment-mixing-defined wheels, video/broadcast hues, and stragglers.

**Bottom line: of everything in this slice, nothing earns a slot in the wheel selector.** Two things
earn a slot *somewhere else* (a warm/cool overlay, and a "spectral complement" modifier on the
Complementary harmony only). The CMYK finding is the one the product owner must read.

---

## 1. RGB / HSV / HSL / HWB / HSI / HSY are ONE wheel — and the HSL-vs-HSV question is a no-op

### They share a hue angle

CSS Color 4 §4.3 states outright: *"The angles and spacing corresponding to particular hues depend
on the color space. For example, in HSL and HWB, which use the sRGB color space, sRGB green is 120
degrees."* §8 (hwb()) is even more explicit: *"The first argument specifies the hue, and is defined
identically to `hsl()`; this means it suffers the same disadvantages such as hue uniformity."*
Wikipedia's HSL/HSV article: *"while 'hue' in HSL and HSV refers to the same attribute, their
definitions of 'saturation' differ dramatically."* All three use the same piecewise hexagonal
`H' = ((G−B)/C mod 6 | (B−R)/C+2 | (R−G)/C+4)`, `H = 60°·H'`. sRGB primaries land at
R 0 / Y 60 / G 120 / C 180 / B 240 / M 300 by construction.

### The load-bearing finding: preserving HSL S/L is *identical* to preserving HSV S/V

The three models' non-hue coordinates are all functions of `max(R,G,B)` and `min(R,G,B)` alone:

| model | coord 2 | coord 3 |
|---|---|---|
| HSV | `S = (max−min)/max` | `V = max` |
| HSL | `S = (max−min)/(1−|2L−1|)` | `L = (max+min)/2` |
| HWB | `W = min` | `B = 1−max` |

Rotating hue at constant (S,V) holds `max` and `min` fixed and only moves the middle channel.
Therefore it also holds (S,L) fixed, and (W,B) fixed. The three "different" harmony targets are the
same RGB triple.

**Verified in-session numerically** (Python, 200 000 uniformly random RGB triples × 13 rotation
offsets ∈ {15,30,60,90,120,150,180,210,240,270,300,330,345}°):

```
max |HSV-rot − HSL-rot| = 1.22e-15
max |HSV-rot − HWB-rot| = 2.22e-16
max |HSV hue  − HSL hue| = 0.0
```

That is floating-point noise. **Switching the harmony target from HSV S/V to HSL S/L would change
zero dyes for zero users.** It is not a feature and must not be offered as one. (What *would*
change is slider semantics if the UI exposes L instead of V — a different question, and one the
Harmony Explorer does not currently ask.)

### HSI / HSY′ — same wheel, ≤1.12° apart at worst

Krita ships four selectors — HSV, HSL, HSI ("intensity as the sum of total rgb components"), HSY′
("Luma being an RGB approximation of true luminosity") — differing only in the lightness axis.
Some HSI formulations use the chromaticity hue `H₂ = atan2(β, α)` with `α = R−(G+B)/2`,
`β = (√3/2)(G−B)`. Wikipedia: *"these two definitions of hue (H and H₂) nearly coincide, with a
maximum difference between them for any color of about 1.12° – which occurs at twelve particular
hues, for instance H = 13.38°, H₂ = 12.26°."* On 125 fixed dyes with mean nearest-neighbour hue
spacing far above 1.12°, this can essentially never change a dye pick. **Not a distinct wheel.**

### HSLuv / HPLuv — a genuinely different hue, and a bad one

HSLuv's hue *is* CIELUV hue: it *"preserves the lightness and hue components of CIELUV LCh and
stretches its chroma so that every color has the same range."* So it is a third perceptual angle,
distinct from both CIELAB and OKLab. Pure sRGB red:

| space | hue of #FF0000 |
|---|---|
| HSV / HSL / HWB | 0° (by definition) |
| CIELCh_uv (= HSLuv) | ≈ 12.2° |
| OKLCh | ≈ 29–30° (MDN: `oklch(62.8% 0.25 30)`) |
| CIELCh_ab | ≈ 40° *(standard textbook value — not re-fetched from a primary source this session; CSS Color 4 does corroborate the family by giving LCH sRGB green = 134.39°)* |

CIELUV squeezes red–yellow into a third of the arc CIELAB gives it. It is the *least* modern of the
three and has no hue-constancy advantage over OKLab. **Skip** — if OKLCH ships (slice 04), HSLuv is
a strictly worse near-duplicate that would make the picker look padded. HPLuv is worse still: it
bounds chroma to what is achievable at *every* hue, i.e. pastels only, which on a fixed 125-dye set
would collapse most harmonies onto the same handful of muted dyes. **Hard skip.**

---

## 2. CMYK: it is the same circle, and the honest version doesn't exist

### The idealised CMY wheel is a relabel

Wikipedia's *Color wheel*: *"A color wheel based on RGB (red, green, blue) additive primaries has
cyan, magenta, and yellow secondaries. Alternatively, **the same arrangement of colors around a
circle** can be described as based on cyan, magenta, and yellow subtractive primaries, with red,
green, and blue being secondaries."* Put C at 180°, M at 300°, Y at 60° and you have written down
the wheel already shipping. Complements are identical (R↔C, G↔M, B↔Y). Triads, tetrads, everything.
**Shipping "CMYK" as a wheel option that produces byte-identical output to "RGB" is a lie in the
UI.**

### What real tools actually do

I checked the tools that advertise CMYK:

- **Adobe Color** — an Adobe employee (`syed_mehadi`, marked-correct answer): *"Hue in RYB wheel is
  different from hue in HSB wheel. Harmonies in Adobe Color are based in the RYB wheel."* No CMYK
  wheel exists; the RGB/CMYK/LAB selector is a value readout.
- **Figma's colour wheel** — RYB-shaped 12-hue wheel; *CMYK is an output value format only*, not an
  alternative geometry.
- **Sessions College Color Calculator** — offers exactly two wheels, RYB and RGB. No CMYK.
- **Paletton** — RYB only ("a specially created RYB color space").

Nobody ships a process-ink harmony wheel. "CMYK colour wheel" in the wild means either the relabelled
RGB circle or an RGB/RYB wheel that prints CMYK numbers underneath.

### The only genuinely different CMYK wheel — and why it's a trap

You get a real, warped wheel only by using *process-ink* primaries and their overprints instead of
sRGB corner colours. Published sRGB renderings and their HSV hues (hand-computed from the hex; the
arithmetic is checkable):

| ink / overprint | sRGB hex | HSV hue | ideal | warp |
|---|---|---|---|---|
| Process Yellow | #FFF200 | 56.9° | 60° | −3.1° |
| Process Red (M+Y) | #ED1C24 † | 357.7° | 0° | −2.3° |
| Process Magenta | #EC008C | 324.4° | 300° | **+24.4°** |
| Process Blue (C+M) | #2E3192 † | 238.2° | 240° | −1.8° |
| Process Cyan | #00AEEF | 196.3° | 180° | **+16.3°** |
| Process Green (C+Y) | #00A651 † | 149.3° | 120° | **+29.3°** |

† The three overprint hexes are widely circulated logo-spec values; **I did not verify them against
a primary print standard** — treat as indicative. Process Cyan #00AEEF and Process Magenta #EC008C
correspond to Pantone Process Cyan C / Process Magenta C.

Placing those six at equal 60° spacing gives a real mapping with a real inverse (monotone piecewise
interpolation, trivially invertible). **The complement of pure red becomes ≈196° — an azure/sky cyan
— instead of 180° pure cyan.** That is a visible, defensible change.

But the definition is not stable. Steve Eddins (MathWorks) on sRGB→SWOP CMYK: *"there is no single
standard way to convert to CMYK… the conversion depends strongly on several fundamental factors"* —
ink pigments, paper, black-generation heuristics, out-of-gamut handling — and the final CIELAB→CMYK
step is a 21×21×21×4 lookup table for which *"[there is no] simple formula."* So there is no "the"
CMYK wheel: there is a SWOP wheel, a FOGRA39 wheel, a GRACoL wheel, and a your-inkjet wheel, all
different, each requiring an ICC profile you would have to ship and version.

### Recommendation: do NOT ship CMYK as a separate wheel

FFXIV dyes are emissive screen colours read off a rendered character. There is no ink, no paper, no
press. A print wheel has no physical claim on them, and the geometrically honest version is
indistinguishable from what already ships.

User-facing wording if asked: *"The print wheel and the screen wheel are the same circle — cyan,
magenta and yellow are just the names of the points opposite red, green and blue. Picking it would
not change a single dye."*

If the PO insists anyway, the only defensible product is a **"Print inks (SWOP)"** option that names
the profile in the label and ships the warp table above — with a note that green shifts ~29°. That
is an M-sized job (hue LUT + inverse + copy + 6 locales) whose main risk is that users read "CMYK"
as authoritative when it is one press standard among several.

---

## 3. Warm / cool and colour temperature: overlay, not wheel

**Warm/cool is a bipartition of a wheel, not a wheel.** Figma's own tool lists "Warm vs. Cool" among
its schemes but as *"a categorical distinction rather than a geometric scheme."* It has no primaries,
no rotation, no complement operator. The split line is also not agreed: the classic artist cut runs
yellow-green ↔ red-violet, while the Munsell/Golden school holds that *every* hue has a warm and a
cool version — so any single angle you pick is a house opinion, and one you would have to defend in
six languages.

**Kelvin / the Planckian locus is not a hue circle at all.** It is a 1-D curve threading the middle
of the chromaticity diagram: *"the blackbody color temperature doesn't really go through ROYGBIV —
you won't find green or magenta, and the Planckian locus threads its path from red to blue carefully
without going around the hue wheel."* Note also the inversion trap for UI copy: *higher* Kelvin =
*cooler*-looking. There is no 120° on a line segment, so triadic/tetradic are undefined.

**Verdict: overlay.** Ship warm/cool as (a) a tint or icon on the harmony ring and dye chips and
(b) optionally a warm↔cool filter in the dye picker. Keep it out of the wheel selector — putting a
non-wheel in a wheel dropdown teaches users the wrong model.

---

## 4. Pigment-mixing-defined wheels: one good idea, one research project

Two separable constructions.

**(a) A "mixing wheel" — place hues so mixing neighbours yields the between-hue.** No prior art
exists. spectral.js (MIT, v3.0.0, already a dependency) exposes only `Color`, `mix()`, `palette()`,
`gradient()` — no wheel, no complement. Mixbox exposes only `lerp()`. Rebelle 7 has pigment sets and
Kubelka-Munk mixing but no mixing-derived wheel. Scott Burns (arXiv 1710.06364) gives
RGB→spectrum→weighted-geometric-mean→RGB and defines no wheel. The reason nobody has built one is
that the constraint system is over-determined: KM mixing is ratio-dependent and not transitive, so
"mix of neighbours = the hue between them" cannot hold for every triple simultaneously. You would
end up least-squares fitting a warp and calling it a wheel. **Skip — L complexity, research risk,
and the result would be unexplainable.**

**(b) A "spectral complement" — the partner whose 50/50 spectral mix is most neutral.** This *is*
well-posed: a 1-D search over hue at fixed L/C, objective = minimise OKLab chroma of
`spectral.mix(base, candidate, 0.5)`. It has real pedigree — Munsell defines its own wheel this way:
*"the scale of Hue has been composed so that colors which mix to make gray are placed directly
opposite."* Counter-evidence worth knowing: practitioners report that *"'geometrical' attempts to
make paint colors mix to neutral using opposite positions on the circle do not work"* with real
paints, and spectral.js's seven synthetic basis curves are an approximation of an approximation.

There is also an exact **colorimetric** version: CIE dominant/complementary wavelength — the
complement is the point where the line from the colour *through the white point* meets the spectral
locus. Cheap, linear in XYZ, unambiguous. But it defines only the 180° relation; there is no natural
120° or ±30° on it, so it cannot carry a harmony set.

**Verdict: skip as a wheel; consider as a toggle on the Complementary harmony only** ("true
complement / paint complement"). S-to-M complexity. Two blockers first: the mixer's spectral path
must be correct (there is a known live P0 where the bot's `spectral` mode returns near-black —
do not build a feature on top of it), and Mixbox is **CC BY-NC 4.0, non-commercial only** with
commercial licensing by email, so it is not a drop-in even if spectral.js proves inadequate.

---

## 5. Video / broadcast (YUV / YIQ / YCbCr / vectorscope): skip

YCbCr hue is `atan2` of two linear combinations of *gamma-encoded* R′G′B′, so the vectorscope wheel
is a linear shear of the RGB hue hexagon: same cyclic order, wildly unequal spacing. Published NTSC
chroma phases: yellow 167.1°, cyan 283.7°, green 241.3°, magenta 61.3°, red 103.7°, blue 347.1°;
−I at 303.0°, +Q at 33.0°; skin-tone line at 123°. Note that the three complement pairs are *exactly*
180° apart there (103.7↔283.7, 241.3↔61.3, 347.1↔167.1) — necessarily so, because an HSV 180°
rotation is a point reflection of R′G′B′ about `(max+min)/2` grey, which negates the chroma vector in
any space linear in R′G′B′. **So the vectorscope wheel gives byte-identical complements to what
ships today, and differs only for non-180° rotations** (R→G is 137.6° there, not 120°). It is an
engineering instrument for calibrating cameras, has zero artist mindshare, and the only part anyone
would ever want is the 123° flesh-tone line — which is a *filter* ("does this dye read as skin?"),
not a wheel. **Skip.**

---

## 6. Other wheel families encountered

| Wheel | What it is | Verdict |
|---|---|---|
| **Yurmby (YRMBCG)** | James Gurney's six-primary wheel — yellow, red, magenta, blue, cyan, green evenly spaced. *Exactly the RGB/CMY hexagon already shipping.* | **Skip (already shipped).** Worth renaming the default to "RGB / Yurmby" — artists recognise the latter. |
| **Coloroid** (Nemcsics, Hungarian Standard MSZ 7300) | 48 hues, angle ψ on the CIE 1931 xy plane, *"aesthetically uniform"* — equal-appearing increments across the whole range, explicitly built for design harmony rather than JND uniformity. | **Skip now, best future candidate.** Genuinely different and purpose-built for exactly our use case, but the transform equations live in the Hungarian standard, not freely published; no JS implementation; L complexity + sourcing risk. |
| **ICtCp** (ITU-R BT.2100) | HDR broadcast opponent space, hue = `atan2(Ct, Cp)`, optimised for lines of constant hue. | **Skip.** Users could not distinguish it from OKLCH; requires PQ encoding; no artist recognition. |
| **CIE xy dominant/complementary wavelength** | Colorimetrically exact complement: the line through the white point. Purples have no dominant wavelength, only a complementary one. | **Skip as wheel** (no 120° defined); possible "true complement" toggle alongside §4(b). |
| **Newton's 1704 circle** | The original. *"The divisions of Newton's circle are of unequal size, being based on the intervals of a Dorian musical scale."* | **Skip.** Charming and cheap (a 7-sector piecewise warp), but there is no canonical degree table — I found none. Unverified. |
| **Ostwald / DIN 6164 / Boutet / Harris / Schiffermüller** | Historical RYB-family and 24-hue systems. | Out of scope — slice 02 (artist wheels). |

---

## 7. What to actually do

1. **Keep the current wheel, rename it.** It is simultaneously the HSV wheel, the HSL wheel, the HWB
   wheel, the CMY subtractive wheel and the Yurmby wheel. Label it something like
   "Screen / RGB (Yurmby)" so the CMYK and HSL questions answer themselves in the UI.
2. **Do not ship CMYK.** See §2. If forced, ship "Print inks (SWOP)" with the profile named.
3. **Do not offer an HSL-vs-HSV target switch.** Verified no-op.
4. **Warm/cool → overlay**, not a wheel entry.
5. **Spectral complement → a modifier on the Complementary harmony**, gated behind fixing the
   existing spectral-mixing P0. Never Mixbox (CC BY-NC 4.0).
6. **Skip HSLuv/HPLuv, ICtCp, vectorscope, Coloroid, Newton.** The wheel selector should have three
   or four entries that a player can tell apart, not eight that mostly agree.

---

## Unverified / flagged

- Process overprint hexes #ED1C24 (red), #00A651 (green), #2E3192 (blue) — widely circulated, not
  traced to a primary print standard in this session.
- CIELCh_ab hue of sRGB red ≈ 40° — standard value, not re-fetched from a primary source here.
- Vectorscope bar angles come from HandWiki (a Wikipedia mirror), not SMPTE directly; the Tektronix
  primer PDF and glennchan.info were unreadable/unreachable.
- Newton's circle degree table: no canonical source found.
- The HSV/HSL/HWB equivalence in §1 was verified by in-session computation, not from a citation.
  Anyone re-checking should reproduce the 200k-sample test rather than trust the number.

## Sources

- https://www.w3.org/TR/css-color-4/ (fetched in full; §4.3 hue note, §7 hsl(), §8 hwb(), the
  "hue angle in HSL is not perceptually uniform" note)
- https://en.wikipedia.org/wiki/HSL_and_HSV
- https://en.wikipedia.org/wiki/Color_wheel
- https://en.wikipedia.org/wiki/Dominant_wavelength
- https://en.wikipedia.org/wiki/Coloroid
- https://en.wikipedia.org/wiki/Vectorscope
- https://www.hsluv.org/
- https://www.hsluv.org/comparison/
- https://docs.krita.org/en/reference_manual/dockers/advanced_color_selector.html
- https://community.adobe.com/t5/adobe-color-discussions/how-is-complementary-color-determined/m-p/13638448
- https://color.adobe.com/create/color-wheel
- https://www.sessions.edu/color-calculator/
- https://www.figma.com/color-wheel/
- https://blogs.mathworks.com/steve/2019/03/05/converting-from-srgb-to-swop-cmyk/
- https://github.com/rvanwijnen/spectral.js
- https://github.com/scrtwpns/mixbox
- https://scrtwpns.com/mixbox/docs/
- https://handwiki.org/wiki/Engineering:SMPTE_color_bars
- https://docs.timeinpixels.com/nobe-omniscope/scopes/vectorscope
- http://chilliant.blogspot.com/2021/03/hsl-and-cielchab-hue-wheels.html
- (search-surfaced, corroborating only) https://arxiv.org/abs/1710.06364 · https://munsell.com/color-blog/a-grammar-of-color-complementary-colors/ · https://www.escapemotions.com/blog/rebelle-5-meet-color-pigments · https://learn.toonboom.com/modules/colour-styling/topic/yurmby-colour-wheel · https://paletton.com/ · https://www.rp-photonics.com/color_temperature.html · https://www.pantone.com/color-finder/PROCESS-CYAN-C · https://professional.dolby.com/siteassets/pdfs/ictcp_dolbywhitepaper_v071.pdf
