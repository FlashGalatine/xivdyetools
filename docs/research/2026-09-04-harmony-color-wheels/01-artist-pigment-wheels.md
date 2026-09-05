# Artist / pigment / appearance-system colour wheels

Research slice 01 for the XIV Dye Tools "choose your colour wheel" feature. Every claim below is tagged
**[fetched]** (I opened the page/source), **[snippet]** (search result only, not opened), or **[derived]**
(I computed it by hand from a fetched formula — arithmetic shown so it can be re-checked).

---

## 0. The shape of the problem

Every wheel in this family reduces to the same three-function contract:

```
wheelHue   = toWheel(srgbHue)          // sRGB/HSV hue 0-360 -> wheel angle 0-360
target     = fromWheel(wheelHue + off) // wheel angle -> sRGB hue, S and V carried over
dye        = nearestCIEDE2000(target)  // unchanged, 125 fixed dyes
```

So the only real questions per wheel are: (a) does `toWheel` exist in closed form, (b) does `fromWheel`
exist (we need it — the harmony target must be rendered), (c) is the pair exactly invertible, and
(d) does the round trip preserve S/V so a "hue rotation" stays a hue rotation.

---

## 1. RYB — the artist's wheel

**What / who.** Red-Yellow-Blue subtractive wheel. Moses Harris (1766, 18 hues), Goethe (1810),
Chevreul (72 hues), Itten and Albers at the Bauhaus **[fetched: Wikipedia RYB]**. This is what "the colour
wheel" means to almost every non-programmer.

**Hue-angle definition.** Primaries at **R 0°, Y 120°, B 240°**; secondaries **orange 60°, green 180°,
violet 300°**. Canonical complements: red↔green, yellow↔violet, blue↔orange **[fetched: Wikipedia RYB]**.

There are three genuinely different computational RYBs, and they disagree.

### 1a. Piecewise-linear hue warp (NodeBox / Paletton / Adobe Color)

The classic 25-entry lookup, verified verbatim in a NodeBox-derived gist **[fetched: SEVEZ gist]**:

```
wheel = [[0,0],[15,8],[30,17],[45,26],[60,34],[75,41],[90,48],[105,54],[120,60],
         [135,81],[150,103],[165,123],[180,138],[195,155],[210,171],[225,187],
         [240,204],[255,219],[270,234],[285,251],[300,267],[315,282],[330,298],
         [345,329],[360,0]]
```

**Column order is the trap.** Column 1 is the *artistic/RYB* angle, column 2 is the *HSB/sRGB* hue.
`toWheel` searches column 2 and interpolates to column 1; `fromWheel` does the reverse **[fetched: gist]**.
The widely-read sighack write-up states the columns the other way round in prose while implementing them
correctly **[fetched: sighack]** — copy the prose and you get blue as red's complement, silently.

Piecewise-linear and strictly monotone ⇒ **exact analytic inverse**, S and V untouched. Licence: NodeBox
is BSD-ish/public-domain-ish; the table is 25 pairs of integers, i.e. facts, not code.

**Red's complement:** sRGB 0 → artistic 0 → +180 → artistic 180 → **sRGB hue 138** (a spring green,
≈`#00FF9C`) **[derived from the fetched table]**. Adobe staff confirm Adobe Color harmonies run on an RYB
wheel and that red's complement comes out at **137°** **[fetched: Adobe community thread]** — a 1° match,
which is strong evidence Adobe uses this exact family of warp.

Note `color-scheme.js` is a *different* thing: its `rgb2ryb()` is a channel-shuffle, and its
`COLOR_WHEEL` is a 24-entry table of literal RGB+saturation values, not a hue warp **[fetched:
color-scheme.js source]**. Don't cite it as the Paletton algorithm.

### 1b. Gossett & Chen 2004 — trilinear cube

RYB is treated as a unit cube; each of the 8 corners is assigned an sRGB triple and any (r,y,b) is
trilinearly interpolated. The paper PDF I fetched is an image-only scan, so the corner values below come
from the canonical MIT-licensed port that cites it **[fetched: friggeri/RYB ryb.coffee]** — **flag: not
verified against the paper's own text.**

```
white  [1,1,1]      red    [1,0,0]        yellow [1,1,0]     blue  [0.163,0.373,0.6]
violet [0.5,0,0.5]  green  [0,0.66,0.2]   orange [1,0.5,0]   black [0.2,0.094,0]
out[i] = Σ corner[i] * (r|1-r)(y|1-y)(b|1-b)   // standard trilinear
```

**No inverse.** sRGB→RYB needs numeric root-finding; `bahamas10/node-rgb2ryb` tried and is
**deprecated as "not accurate"** by its own author **[fetched: repo README]**. That alone rules the cube
out as our primary, since we must place the *base* colour on the wheel.

Second, fatal-for-us problem: **the corners have wildly different luminance**, so a hue rotation is not
a hue rotation. RYB(1,0,0) → V=1.00; RYB(0,1,1) → (0,0.66,0.2), V=0.66 **[derived]**. Harmony slots would
drift dark/light for no reason the user can see.

Red's complement: the green corner `#00A833`, hue 138.2° **[derived]** — same hue as the warp table,
much lower value.

Modern descendant: **RYBitten** (meodai, MIT) — same trilinear machinery with an optional smoothstep
easing and an Itten-calibrated cube: white `#FDF6ED`, red `#E32421`, yellow `#F3E600`, orange `#F08E1C`,
blue `#1699DA`, violet `#78229A`, green `#008E5B`, black `#1D1C1C`; ships 30+ historical gamuts
(Itten, Munsell, Goethe, Albers) **[fetched: RYBitten README]**. It documents **`ryb2rgb` only — no
inverse** **[fetched]**. Its green corner `#008E5B` is hue ≈158° **[derived]**, so red's complement is a
teal, not a green — a third answer again.

### 1c. Sugita & Takahashi (IWAIT 2015 / IIEEJ Trans. 5(2):110-122, 2017) — analytic, invertible

The one RYB with a published closed-form **both ways**. The paper PDF host was unreachable
(`nishitalab.org` refused connection), but the R package `PBSmapping` implements it and I fetched the
source verbatim **[fetched: rdrr.io PBSmapping/R/extraFuns.r]**; the docs name the paper as the algorithm
source **[fetched: CRAN RGB2RYB man page]**. Licence of that implementation: GPL-2/3 — **do not copy the
R; re-implement from the equations.**

```
RGB -> RYB                                RYB -> RGB
Iw = min(R,G,B)                           Ib = min(R,Y,B)
r,g,b = R-Iw, G-Iw, B-Iw                  r,y,b = R-Ib, Y-Ib, B-Ib
r' = r - min(r,g)                         r' = r + y - min(y,b)
y' = 0.5*(g + min(r,g))                   g' = y + min(y,b)
b' = 0.5*(b + g - min(r,g))               b' = 2*(b - min(y,b))
n  = max(r',y',b') / max(r,g,b)           n  = max(r',g',b') / max(r,y,b)
Ib = min(1-R,1-G,1-B)                     Iw = min(1-R,1-Y,1-B)
out = (r',y',b')/n + Ib                   out = (r',g',b')/n + Iw
```

Define wheel hue by running the ordinary HSV hexcone formula on the (R,Y,B) triple. Then **[derived,
all twelve computed by hand from the formulas above]**:

| RYB angle | 0 | 30 | 60 | 90 | 120 | 150 | 180 | 210 | 240 | 270 | 300 | 330 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **S&T → sRGB hue** | 0 | 20 | 30 | 40 | 60 | 100 | 120 | 180 | 240 | 255 | 270 | 300 |
| **Warp table → sRGB hue** | 0 | 17 | 34 | 48 | 60 | 103 | 138 | 171 | 204 | 234 | 267 | 298 |
| **G&C cube → sRGB hue** | 0 | 15 | 30 | 45 | 60 | 87 | 138 | 164 | 211 | 264 | 300 | 340 |

**Red's complement under S&T: exactly `#00FF00`, hue 120°** **[derived]** — RYB(1,0,0) → invert → (0,1,1)
→ sRGB (0,1,0). Clean, but note the three models put RYB "blue" at sRGB 204° / 211° / 240° — i.e. the warp
and cube models treat Itten's blue as the cyan-leaning pigment blue, while S&T treats it as monitor blue.
That is the single largest visible difference between the RYB variants.

### 1d. Precedent tools

Adobe Color (RYB, confirmed by staff) **[fetched]**; Paletton ("the ancient artistic RYB colour wheel")
**[snippet]**; Sessions College Color Calculator has an explicit **RYB / RGB "Color Mode" toggle**
**[fetched]** — the closest existing precedent for the exact UI we're planning; ColorPixer and apzok.com
ship separate RGB and RYB wheel pages **[snippet]**; iro.js has an open feature request for it **[snippet]**.

---

## 2. Munsell

**What / who.** A. H. Munsell's perceptual atlas; the basis of **JIS Z 8721** ("色の表示方法—三属性による表示")
and the JIS standard colour samples **[snippet, multiple JP sources]**. Genuinely meaningful to Japanese
users, which is the strongest argument for it here.

**Hue-angle definition.** 5 principal hues **R Y G B P** and 5 intermediates **YR GY BG PB RP**, each band
split into 10 steps ⇒ **100 hue steps**; charts commonly print 40 hues at 2.5-step spacing
**[fetched: Wikipedia Munsell]**. The wheel is *evenly spaced*: ASTM hue number
`H = 10*((7 - code) % 10) + hue` with codes R=7 YR=6 Y=5 GY=4 G=3 BG=2 B=1 PB=10 P=9 RP=8, so
5R=5, 5Y=25, 5G=45, 5B=65, 5P=85, 10RP=100 — **3.6° per step** **[fetched: colour-science
`MUNSELL_HUE_LETTER_CODES`]**.

**Do not confuse this with `hue_to_hue_angle()`** in colour-science, which is a *chromaticity-diagram*
angle used only for renotation interpolation **[fetched, verbatim]**:

```python
single_hue = ((17 - code) % 10 + (hue/10) - 0.5) % 10
angle = LinearInterpolator((0,2,3,4,5,6,8,9,10),(0,45,70,135,160,225,255,315,360))(single_hue)
```

⇒ 5R=0°, 5YR=22.5°, 5Y=45°, 5GY=70°, 5G=135°, 5BG=160°, 5B=225°, 5PB=240°, 5P=255°, 5RP=315°
**[derived]**. Using *that* as the wheel would put green and blue-green almost on top of each other.
`hue_angle_to_hue()` is its exact inverse **[fetched]**.

**sRGB ↔ Munsell.** Forward (Munsell→xyY) is table interpolation over the 1943 renotation; inverse is
Centore's iterative algorithm, which colour-science documents as able to raise
`RuntimeError: maximum iterations reached without converging` **[fetched: colour.notation.munsell]**.
In JS: **`munsell.js`** (privet-kitty, **MPL-2.0**) has both directions — `hexToMunsell`,
`rgb255ToMunsell`, `munsellToHex`, plus `mhvc` triplets — interpolating via LCHab and inverting by
Centore's method **[fetched: repo + README]**.

**Red's complement.** 5R sits at ASTM 5; +50 ⇒ ASTM 55 = **5BG**, a teal. Munsell's wheel was built so
opposite hues at equal chroma are *mixture* complements. This is a materially different answer from RYB
(green) and is the reason to offer Munsell at all.

**Practicality.** Live inversion per pick is overkill. Recommended: precompute a **360-entry LUT
sRGB-hue → Munsell ASTM hue** offline (at a mid value/chroma) plus its inverse, ship ~1.5 KB of JSON, and
the wheel becomes structurally identical to the RYB warp. Complexity **M** with the LUT, **L** if live.

---

## 3. NCS and the Hering / opponent wheel

**What / who.** NCS is built on Hering's opponency: six elementaries W, S, **Y, R, B, G**, with the four
chromatic ones at **90° spacing**, each quadrant divided into 100 steps, notated `Y90R` = 10% yellow /
90% red **[fetched: Wikipedia NCS]**. National reference norm in Sweden, Norway, Spain, South Africa
**[fetched]**.

**Where the unique hues actually are.** CIECAM02's hue-quadrature anchors — the closest thing to a
standardised answer — are **R 20.14°, Y 90.00°, G 164.25°, B 237.53°** **[snippet: CIECAM02 unique-hue
table]**. In CIELAB the commonly quoted loci are **R 24°, Y 90°, G 162°, B 246°** **[snippet]**.

In **sRGB HSV hue**, using Wikipedia's own (explicitly approximate) elementary hexes
R `#C40233`, Y `#FFD300`, G `#009F6B`, B `#0087BD` **[fetched]**, the four unique hues land at
**≈345°, ≈50°, ≈160°, ≈197°** **[derived]**. That is violently non-uniform — unique blue and unique green
are only 37 sRGB-degrees apart while yellow→green spans 110. A 4-anchor monotone spline through those
points is the whole implementation; it is **S** complexity and exactly invertible.

**OKLCH equivalents: I could not verify these this session** (shell execution was blocked in this
worktree). `#FF0000` is `oklch(0.628 0.258 29.23)` **[snippet]**; the rough OKLCH landmarks quoted by
Evil Martians are red 20, yellow 90, green 140, blue 220, purple 320 **[snippet]**. **Recompute before use.**

**Red's complement** on the opponent wheel: opposite unique R is the B/G midpoint, i.e. `B50G` — a cyan.

**Licensing caution.** "NCS" is a trademark of NCS Colour AB and the official NCS↔sRGB data is licensed.
Ship this as **"Opponent (Hering) — unique hues"**, not as NCS.

---

## 4. PCCS

**What / who.** Japan Color Research Institute, 1964; 24 hues + 12 tones; the backbone of the Japanese
色彩検定 curriculum. Hues are "determined based on the psychological primaries and their psychological
complements as well as the additive and subtractive primaries" and spaced perceptually evenly
**[fetched: Wikipedia PCCS]** — i.e. it is an opponent wheel wearing a Munsell interface.

**Definition relative to Munsell.** PCCS hues are *defined by* Munsell notations; a published
correspondence table exists (sourced to 『色彩学概要』p.77 表2.2) **[fetched: colorcodesearch.com]**. A full
24-row table with Munsell + RGB was fetched **[fetched: kenchikushi999.com]**, e.g. 1:pR = 10RP 4/13.5,
2:R = 4R 4.5/14, 5:O = 4YR 6/13.5, 8:Y = 5Y 8/13, 12:G = 3G 5.5/11, 17:B = 10B 3.5/10.5, 22:P = 7P 3.5/11.5,
24:RP = 6RP 4/12.5. **Caveat: the RGB and HEX columns on that page disagree with each other**
(e.g. row 1 gives `182,30,85` and `#a1122e`), so treat the hexes as indicative and derive sRGB from the
Munsell notations instead.

**Practical mapping:** there is no direct published PCCS→sRGB standard; go PCCS → Munsell → sRGB, which
means PCCS costs nothing extra once Munsell exists — it is a 24-anchor relabelling of the Munsell wheel.
**Complexity S given Munsell, M standalone.** Red (2:R = 4R) → +12 hues → 14:BG = 5BG, again a teal.

**Korean / Chinese traditional systems.** Obangsaek (오방색) and Wu Xing five-colour theory are
**not hue wheels** — they are five directional/elemental colours: blue-green (east), red (south),
yellow (centre), white (west), black (north) **[snippet: Wikipedia Obangsaek + multiple]**. Two of the
five are achromatic, so there is no hue geometry and no complement operation. Offer them, if at all, as a
*palette preset*, never as a wheel.

---

## 5. Ostwald, Runge, Chevreul, Harris, Goethe

- **Ostwald (1917)** — 24 evenly spaced hues built out from Hering's four psychological primaries
  (yellow, red, blue, sea-green) **[snippet]**. Geometrically this *is* the opponent wheel of §3 with a
  24-step grid; it adds no new mapping, only a label. Skip as a separate wheel.
- **Chevreul** — 72 hues on an RYB base, complements opposite **[snippet]**. Same geometry as §1, finer
  subdivision. Skip.
- **Harris (1766)** — 18 prismatic hues, RYB primaries **[fetched: Wikipedia RYB]**. Same geometry. Skip.
- **Goethe (1810)** — 6-hue RYB circle from the primary/secondary triangle **[fetched: Wikipedia RYB]**.
  Same geometry, coarser. RYBitten ships a Goethe cube if a distinct *look* is wanted **[fetched]**.
- **Runge (1810)** — a colour *sphere*; its equator is an RYB-ish 12-hue circle. Contributes a
  lightness/chroma solid, not a new hue geometry. Skip.

---

## 6. Recommendation

| Wheel | Method to pick | Inverse | Red's complement | Fits 125 dyes | Cx |
|---|---|---|---|---|---|
| **RYB (artist)** | NodeBox/Adobe 25-pair piecewise warp | analytic, exact | sRGB 138° green | yes | **S** |
| **Munsell (JIS)** | precomputed 360-entry hue LUT via `munsell.js` (MPL-2.0) offline | LUT both ways | 5BG teal | yes | **M** |
| **Opponent (Hering)** | 4-anchor spline on CIECAM02 anchors 20.1/90/164.3/237.5 | analytic | B50G cyan | yes | **S** |
| PCCS | relabel the Munsell wheel with 24 anchors | via Munsell | 5BG teal | yes | S-after-Munsell |
| RYB via G&C / RYBitten cube | — | **none** | varies 138-158° | no | M |
| NCS-branded / Ostwald / Chevreul / Runge / Harris / Goethe | — | — | — | — | skip |

**Suitability for a 125-dye picker.** The wheel only moves the *target* colour; CIEDE2000 nearest-dye
matching is untouched. The real risk is **compression**: the RYB warp squeezes sRGB 0-60 into 120 artistic
degrees and stretches sRGB 60-138 into 60, so analogous ±30° in the red-orange region becomes a ~±15°
sRGB move and can collapse two harmony slots onto the same dye. Measure slot-collision rate per wheel
before shipping, exactly as the harmony-convergence work did.

**Risks / gotchas, biggest first.**

1. **Column order of the warp table.** Implement it backwards and red's complement becomes blue, not
   green — and a naive test ("complement of red is not 180°") still passes. Assert the specific value:
   `toWheel(0)=0`, `fromWheel(180)≈138`, and `fromWheel(120)≈60` (yellow).
2. **Two surfaces, one warp.** The CSS conic-gradient ring and the resvg SVG ring must be generated from
   the *same* `fromWheel`. A plain `conic-gradient(red,yellow,lime,…)` is an sRGB ring; on an RYB wheel
   yellow must sit at 120°, not 60°. resvg has no conic gradient, so the card needs an N-segment
   approximation sampled from `fromWheel` — same function, same table, one source of truth.
3. **Cube models are not hue rotations.** Gossett & Chen / RYBitten change V as well as H, and have no
   inverse. Use them only if you want their *look* as a rendering style, never as the wheel geometry.
4. **Achromatic input.** Hue is undefined at S=0 or V=0 for every wheel; decide once, centrally.
5. **`hue_to_hue_angle` ≠ Munsell wheel angle.** Grabbing colour-science's chromaticity angle by mistake
   yields a wheel where 5G and 5BG are 25° apart instead of 36°.
6. **Licences.** PBSmapping's R is GPL — re-derive from the published equations. NCS is trademarked and
   its sRGB data licensed. `munsell.js` is MPL-2.0 (file-level copyleft: fine as a build-time dependency
   producing a LUT, awkward if vendored into a bundle).

**Unverified / open.** Gossett & Chen's corner values are from MIT ports, not the paper (PDF is an image
scan; `vis.computer.org` fails TLS). Sugita & Takahashi's own paper was unreachable
(`nishitalab.org` refused connection) — the equations above are the PBSmapping implementation of it.
OKLCH hue angles for the unique hues were not computed (shell blocked). Paletton's exact internal table
was not read from source.

---

## Sources

Fetched:
- https://github.com/friggeri/RYB
- https://raw.githubusercontent.com/friggeri/RYB/master/ryb.coffee
- https://github.com/meodai/RYBitten
- https://raw.githubusercontent.com/meodai/RYBitten/main/README.md
- https://github.com/bahamas10/node-rgb2ryb
- https://bahamas10.github.io/ryb/about.html
- https://bahamas10.github.io/ryb/assets/ryb.pdf (image-only scan — no text extractable)
- https://sighack.com/post/procedural-color-algorithms-hsb-vs-ryb
- https://gist.github.com/SEVEZ/3dfa1f7807dab5379fe3
- https://raw.githubusercontent.com/c0bra/color-scheme-js/master/lib/color-scheme.js
- https://raw.githubusercontent.com/ProfJski/ArtColors/master/RYB.h
- https://search.r-project.org/CRAN/refmans/PBSmapping/html/RGB2RYB.html
- https://rdrr.io/cran/PBSmapping/src/R/extraFuns.r
- https://community.adobe.com/t5/adobe-color-discussions/how-is-complementary-color-determined/m-p/13638448
- https://www.sessions.edu/color-calculator/
- https://en.wikipedia.org/wiki/RYB_color_model
- https://en.wikipedia.org/wiki/Munsell_color_system
- https://en.wikipedia.org/wiki/Natural_Color_System
- https://en.wikipedia.org/wiki/Practical_Color_Coordinate_System
- https://colour.readthedocs.io/en/develop/_modules/colour/notation/munsell.html
- https://colour.readthedocs.io/en/v0.3.7/_modules/colour/notation/munsell.html
- https://github.com/privet-kitty/munsell.js
- https://github.com/privet-kitty/munsell.js/blob/master/README.md
- https://kenchikushi999.com/pccs-conversion/
- https://colorcodesearch.com/pccs-munsell/
- https://arcenciel.design/study/pccs (no data exposed in HTML)

Attempted, unavailable:
- http://vis.computer.org/vis2004/DVD/infovis/papers/gossett.pdf (TLS unsupported protocol)
- http://nishitalab.org/user/UEI/publication/Sugita_IWAIT2015.pdf (connection refused)
- https://www.npmjs.com/package/munsell (403)
- https://rdrr.io/cran/PBSmapping/src/R/PBSmapping.r (truncated)
- https://colour.readthedocs.io/en/develop/generated/colour.notation.munsell.hue_to_hue_angle.html (404)

Search-snippet only (not opened — treat as secondary):
- https://www.researchgate.net/publication/227661876_Unique_Hue_Data_for_Colour_Appearance_Models_Part_I_Loci_of_Unique_Hues_and_Hue_Uniformity
- https://www.researchgate.net/figure/Mean-hue-angle-for-unique-hue-stimuli-in-CIECAM02_tbl4_287719500
- https://en.wikipedia.org/wiki/Ostwald_color_system
- https://en.wikipedia.org/wiki/Obangsaek
- https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
- https://paletton.com/
- https://colorpixer.com/ryb-color-wheel
- https://github.com/jaames/iro.js/discussions/174
- https://jis.eomec.com/jisz87211993 (JIS Z 8721)
- https://www.semanticscholar.org/paper/Computational-RYB-Color-Model-and-its-Applications-Sugita-Takahashi/545a54824193b495ac5f6dd5a5aad839d99950f9
