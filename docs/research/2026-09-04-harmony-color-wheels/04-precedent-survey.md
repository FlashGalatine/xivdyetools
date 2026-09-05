# Precedent survey — how existing tools expose colour-wheel choice

Research slice 04. Question: when a tool computes colour harmony, which wheel does it use, can the user
change it, what is the control called, does the drawing change, and is the mapping documented?

---

## 1. Headline findings

1. **The single most influential harmony tool — Adobe Color — already computes on RYB, and does not tell
   you.** An Adobe employee (Syed Mehadi) states plainly in the Adobe community: *"Hue in RYB wheel is
   different from hue in HSB wheel. Harmonies in Adobe Color are based in the RYB wheel. But some other
   creative tool uses HSB color pickers, Color's interface converts to and exposes the H from HSB for
   compatibility."* The visible consequence is that red's complement lands at HSB hue ≈ 137°, not 180°.
   This has generated recurring "your color wheel is broken" threads for years. **Precedent lesson:
   computing on a hidden wheel is a support-cost decision, not a neutral one.**
2. **A user-facing wheel switch is an established, but minority, pattern.** It exists and is shipping in:
   Sessions College Color Calculator (web), Rebelle 8 (paint app), Coolorus and MagicPicker (Photoshop
   plugins), ColorDesigner (web). It does *not* exist in Adobe Color, Illustrator, Canva, Figma, Coolors,
   Procreate, Corel Painter, Clip Studio Paint, Krita, or Affinity.
3. **Nobody in the FFXIV-adjacent space does this.** Across GW2, ESO, Warframe, Destiny and ACNH tooling,
   exactly one tool (Warframe's Fashion Frame Ninja) offers harmony at all, and it offers no wheel choice.
   A wheel selector would be a genuine differentiator in the game-dye niche.
4. **Two is the shipping number for consumer tools; more than two is a pro-tool / paid-tier move.**

---

## 2. Comparison table

| Tool | Wheel(s) used for harmony | User-switchable? | Exact control label | Wheel drawing changes? |
|---|---|---|---|---|
| **Adobe Color / Express Color** | RYB (confirmed by Adobe staff); HSB hue exposed in UI | **No** | — (the "color mode" dropdown = RGB / HSB / LAB, value *notation* only) | n/a |
| **Illustrator Color Guide** | RYB-flavoured wheel (secondary sourcing) | No | "Harmony Rules" menu only | n/a |
| **Paletton** | RYB — "specially created RYB color space" | **No** (RYB only) | — (reports "Hue (RYB)" in swatch detail) | n/a |
| **Sessions College Color Calculator** | RYB (default) or RGB | **Yes** | `Color Mode` → `RYB` / `RGB` (+ `Lock`) | **Yes — verified live** |
| **Canva Color Wheel** | RGB ("designed for online use") | No | — | n/a |
| **Coolors** | HSL-style; harmonies listed on the picker page | No | "Color harmonies" | no wheel widget |
| **Figma Color Wheel** | traditional artist's wheel, unlabelled | No | harmony names only | n/a |
| **Atmos** | HSL on the wheel; LCH/OKLCH in the Playground | Partly (separate surfaces) | `HSL` selector; "Advanced color spaces" | n/a |
| **ColorDesigner** | 7 spaces | **Yes** | `Color Space:` → RGB, LAB PRO, LCH PRO, HSL, HSV, OKLCH PRO, OKLAB PRO | presumed |
| **ColorBrew** | HSL/HSV, explicitly *"not RYB"* | No | "Color harmony" / "Complementary 180°" | n/a |
| **HTML Color Codes** | RGB | No | — | n/a |
| **oklch.com** | OKLCH — picker/converter, **no harmony** | n/a | L / C / H sliders; P3, Rec2020, 3D model | n/a |
| **Huetone / Leonardo** | perceptual scales, **not harmony**; Leonardo has a colour-space selector for interpolation | n/a | "Choose from a variety of color spaces" | n/a |
| **pro-color-harmonies (meodai)** | **OKLCH**, adaptive, with muddy-zone avoidance | No | — | n/a |
| **Poline** | HSL polar coords (library); exports `colorsCSSlch` / `colorsCSSoklch` | No | `positionFunction*` | `<poline-picker>` |
| **Colormind / Khroma / Huemint / Color Hunt / Realtime Colors / Pigment** | **no wheel geometry at all** — ML, curated, or contrast-matrix | n/a | n/a | n/a |
| **Krita — Advanced Color Selector** | HSV / HSL / HSI / HSY′ | **Yes (4 models)** | model list with per-option explainer blurb | yes |
| **Krita — Artistic Color Selector** | HSY/HSI, discrete hue sectors, gamut masks | Yes | "Color Space", hue-sector count, "Enforce gamut mask" / "Just show the shapes" | yes |
| **Krita — RYB** | **not implemented**; bug 393477 still `REPORTED` | No | — | — |
| **Photoshop (native)** | HUD picker: "Hue Strip" / "Hue Wheel"; **no harmony feature** | n/a | — | n/a |
| **MagicPicker (PS plugin)** | **Traditional (RYB / "Itten's wheel")**, **Munsell**, **Color Temperature**, + Triangle/Box/Diamond, LDT-Cube | **Yes (3+ wheels)** | "Traditional Color Wheel (RYB mode or Itten's wheel)"; schemes: Mono, Complement, Triad, Tetrad, Analogic, Accented Analogic | yes |
| **Coolorus (PS plugin)** | RGB or RYB | **Yes** | "RGB/RYB Modes" + "Color Harmonies" + "Gamut Lock" | yes |
| **Affinity Designer** | HSL Colour Wheel; "Colour Chords" | No (wheel model fixed) | "Add Chord to Swatch"; sliders RGB/HEX/HSL/CMYK/Lab/Grayscale (notation only) | n/a |
| **Clip Studio Paint** | Colour Wheel palette, **HSV or HLS** | Yes (2 value models, same hue ring) | HSV / HLS toggle, bottom-right icon | ring unchanged |
| **Procreate** | single Hue×Saturation disc | No | Complementary, Split Complementary, Analogous, Triadic, Tetradic | n/a |
| **Corel Painter** | unstated wheel | No | Analogous, Complementary, Split Complementary, Tetradic, Monochromatic Light, Monochromatic Dark | n/a |
| **Rebelle 8** | **RGB or RYB** | **Yes** | `Color Panel Menu > Color Wheel` → RYB; "Color harmonies are supported in the circle-style color wheel" | yes |
| **Blender** | "Color Picker Type" (Circle HSV etc.); no harmony | n/a | — | yes |
| **GIMP** | no built-in harmony (plugins only) | n/a | — | — |
| **GW2 — Kulinda dye browser, GW2BLTC Dye Matcher, wiki Dye/By Color** | none — nearest-colour + browse only | n/a | "Dye matcher" column, Cloth/Leather/Metal toggles | — |
| **ESO — ESO-Hub Fashion Editor** | none — eyedropper / set-fill | n/a | — | — |
| **Warframe — Fashion Frame Ninja** | **harmony present**: monochrome, analogous, complementary, triadic, square, neutrals + accent; matched to in-game palettes by **CIEDE2000** | **No wheel choice** | "Color Picker & Harmony" | no wheel widget |
| **Warframe — warframecolorpicker.app / Polychrome** | nearest-match only (RGB/HSV fields) | n/a | "TARGET SCHEME", "PALETTES" | — |
| **Destiny shader tools / ACNH design tools** | grid browse; ACNH editors expose the game's own Hue/Vividness/Brightness (30/15/15) | n/a | — | — |

---

## 3. What the evidence actually shows, tool by tool

### The RYB incumbents

**Adobe Color** ships nine harmony radios — verified live in the current Adobe Express Color build:
`Custom, Analogous, Complementary, Split complementary, Triad, Square, Compound, Shades, Monochromatic`
(the older build additionally had "Double split complementary"). There is also a `Select color mood`
dropdown — `Colorful, Bright, Muted, Deep, Dark, None` — which is an interesting non-hue axis of variation.
There is **no wheel-model control anywhere in the UI**. The wheel is RYB in behaviour: community expert
Bob_Hallam confirms *"in the version I receive when loading Adobe Color Red and green are opposite… as the
green turns yellow the opposite turns more Magenta."* Adobe's "color mode" dropdown (RGB / HSB / LAB;
CMYK was removed as *"worthless"*) governs value notation, not the wheel.

**Paletton** is the purest RYB precedent and the one that *documents* its choice: *"it's not using the
modern computer and engineering RGB color space, but it's built on a classical artistic color wheel,
applies classical color theory and works within a specially created RYB color space."* It offers **no**
switch — RYB is the product. It does surface `Hue (RYB)` alongside RGB/LAB in each swatch's detail
read-out, which is a cheap, honest way to say "this number is in a different space".

### The clean switchable precedent

**Sessions College Color Calculator** is the closest structural analogue to XIV Dye Tools' browser wheel,
and I verified its behaviour in a live browser rather than from docs:

- The control is a `<select id="dropdown-select">` under the heading **`Color Mode`**, options **`RYB`**
  (default) and **`RGB`**, with a separate `Lock` control.
- Harmonies: `complementary, monochromatic, analogous, split complementary, triadic, tetradic`.
- **The wheel is a CSS `conic-gradient` and its stops are rewritten on switch** — exactly the rendering
  technique XIV Dye Tools already uses:
  - RYB: `#FFBF00 1° → yellow 30° → green 90° → cyan 120° → blue 150° → magenta 210° → red 270°`
    (R/Y/B land on 270°/30°/150° — a true 120° triad; cyan and magenta are squeezed into narrow arcs)
  - RGB: `chartreuse 1° → green 30° → cyan 90° → blue 150° → magenta 210° → red 270° → yellow 330°`
    (even 60° spacing)
- There is **no explanatory copy** on the page about what RYB vs RGB means for the result. That is a gap
  worth not copying.

**Rebelle 8** is the strongest desktop precedent, and it is recent (marketed as a headline 8.0 feature).
The switch lives at `Color Panel Menu > Color Wheel` and is framed in intent language, not model language:
*"Switch to RYB color wheel for better interpretation of how physical pigments mix in the real world."*
Harmonies — `Complementary (2)`, `Triadic (3)`, `Analogous Complementary (4)`, `Tetradic (4)` — are
"built right into your color wheel", and are explicitly constrained: *"Color harmonies are supported in
the circle-style color wheel"*, i.e. some wheel shapes don't support harmony at all.

**Coolorus** (`RGB/RYB Modes` + `Color Harmonies` + `Gamut Lock`) and **MagicPicker** are the
Photoshop-plugin answer to Photoshop having no harmony of its own. MagicPicker is the only tool found
offering **three genuinely different hue geometries**: *"Traditional Color Wheel in Photoshop and
Illustrator! (RYB mode or Itten's wheel)"*, a **Munsell** wheel (*"Industry standard, with human perceived
gamut-limiting in mind"*), and a **Color Temperature** wheel — all behind a fly-out settings menu, with
schemes named `Mono, Complement, Triad, Tetrad, Analogic, Accented Analogic`.

### Tools that deliberately refused RYB

**Krita** has had an open request (bug 393477, "Add color mode type - RYB color wheel") since 2018,
still `REPORTED`. Scott Petrovic's objection was practical — how do you select black and grey in RYB? —
and he pointed at the existing Artistic Color Selector; David Conner conceded conceptual value but noted
RYB would need special-casing, probably docker-only. Krita instead ships **four HSX models**
(`HSV / HSL / HSI / HSY'`) chosen in settings, each with *"a small blurb explaining the characteristic of
each model"* — a per-option explainer pattern worth stealing.

**ColorBrew** states the position in its own copy: *"this tool works in HSL/HSV, not RYB, so a hex code
is a strong starting point, not a guarantee."*

**iro.js** (a popular colour-wheel component) declined an RYB request: the maintainer said it would *"add
a bit of complexity to the colorwheel rendering and input handling"* and questioned whether it would be
*"widely useful"*. Note the specific words: **rendering and input handling** — the same two costs a
wheel-selector imposes on a conic-gradient ring with draggable nodes.

### The perceptual camp

`oklch.com`, Huetone and Leonardo are all **contrast/scale** tools, not harmony tools — none of them
rotates hue to make a palette. The perceptual harmony precedent is thinner than the discourse suggests:
**ColorDesigner** (a `Color Space:` dropdown offering `RGB, LAB PRO, LCH PRO, HSL, HSV, OKLCH PRO,
OKLAB PRO` right above the harmony schemes, with the perceptual ones paywalled) and **meodai's
pro-color-harmonies** ("adaptive OKLCH harmony" with muddy-zone avoidance) are the main ones.

### Game-adjacent tools — the differentiator check

- **Guild Wars 2**: Kulinda's dye browser, GW2BLTC's Dye Matcher (a "Dye matcher" % column plus
  Cloth/Leather/Metal filters), and the wiki's Dye/By Color page. **No harmony, no wheel.**
- **ESO**: ESO-Hub's Fashion Editor has an eyedropper and a "Set Fill Tool". **No harmony.**
- **Warframe**: **Fashion Frame Ninja** is the only real precedent — "Color Picker & Harmony", harmony
  modes `monochrome, analogous, complementary, triadic, square, neutrals + accent`, matched into the
  game's fixed palettes using **CIEDE2000**. This is architecturally *the same product as XIV Dye Tools'
  Harmony Explorer* — and it offers **no wheel choice**.
- **Destiny / ACNH**: browse-and-filter, or the game's own Hue/Vividness/Brightness axes. No harmony.

---

## 4. Answers to the four UX questions

### Q1 — Terminology, and does it translate?

There is no single de-facto label. Four families exist:

| Pattern | Used by | Risk |
|---|---|---|
| `Color Mode` → RYB / RGB | Sessions College | **Collides** with Adobe's meaning |
| `Color Space:` → RGB / LAB / LCH / HSL / HSV / OKLCH / OKLAB | ColorDesigner | Jargon-heavy |
| `Color Wheel` (submenu) → RYB | Rebelle 8 | Clear, intent-framed |
| "RGB/RYB Modes" / "Traditional Color Wheel (RYB, or Itten's wheel)" | Coolorus, MagicPicker | Pro-audience |

**Recommendation: do not use "Color Mode".** In every one of our six locales, "colour mode" is already the
localized string for *document colour mode* (RGB vs CMYK) in Adobe products — カラーモード, Farbmodus,
mode colorimétrique, 색상 모드, 颜色模式 — so the term is pre-loaded with the wrong meaning for the exact
users most likely to reach for this feature.

"Colour wheel" is the term that survives translation without collision and is the one *painters* already
use: **ja 色相環 / カラーホイール, de Farbkreis, fr roue chromatique (or cercle chromatique), ko 색상환,
zh 色环 / 色轮**. Adopt `Color wheel` as the control label, and name the values by intent-plus-model the
way Rebelle does rather than by acronym alone — e.g. *"RGB (screen)"*, *"RYB (artist's / traditional)"*,
*"Perceptual (OKLCH)"*. "Itten's wheel" is recognisable to painters but is a proper noun that will not
localize; keep it out of the primary label and put it in the explainer.

### Q2 — Does anyone ship more than two wheels, and how do they avoid overwhelming users?

Yes, three tools do, and all three use one of the same containment tactics:

1. **Paywall the extras.** ColorDesigner shows all seven spaces but marks four `PRO`. RGB/HSL/HSV are
   free; LAB/LCH/OKLCH/OKLAB are not. Non-experts self-select out.
2. **Bury them in a settings fly-out.** MagicPicker's RYB/Munsell/Temperature wheels are in the panel's
   fly-out menu, not on the canvas. Rebelle's RYB is in `Color Panel Menu`, not on the panel face.
3. **Attach a one-line explainer to each option.** Krita's model list carries "a small blurb explaining
   the characteristic of each model" — the cheapest and most transferable of the three.
4. **Split by surface.** Atmos keeps the public Color Wheel on plain HSL and puts LCH/OKLCH plus
   sRGB/Display-P3/unlimited gamut limits in a separate "Playground".

In every case **the default is the familiar wheel**, and the alternatives are opt-in.

### Q3 — Is the wheel a *view* or a *model*?

**Universally a model.** Everywhere the switch exists — Sessions College, Rebelle, Coolorus, MagicPicker,
ColorDesigner — flipping it recomputes the palette *and* re-renders the ring. I verified the Sessions
College case directly: the conic-gradient stop list is rewritten on switch, so the ring's geometry visibly
changes, and the harmony nodes then land on different colours.

I found **no** tool that re-plots an unchanged palette on a different wheel as a pure view. The nearest
thing is Krita's gamut masks (an overlay on a fixed wheel) and darktable's RYB vectorscope (an analysis
view of an existing image). Users will therefore expect: *change the wheel → different dyes come out, and
the ring looks different*. A view-only re-plot would be novel and would very likely read as a bug.

Corollary for us: if the wheel is a model, it is **part of the shareable state**. Adobe's mistake was
computing on RYB while exposing HSB hue; the resulting mismatch produced years of "your complementary is
wrong" threads. Whatever wheel a palette was generated on must be recorded on the OG/Discord card, in the
share URL, and in the `/harmony` command's response — otherwise the same inputs will appear to produce
different dyes.

### Q4 — The published arguments, strongest form each way

**For RYB.**
- *It matches how paint behaves.* Escape Motions: RYB *"reflects the way colors behave when mixed as
  physical pigments… resulting in richer, darker, or even muddier hues when blending, just like in
  real-world painting"*, and they shipped it as a "long-awaited" request.
- *Classical harmony theory was authored on it.* Paletton's stated rationale. Adobe silently agrees —
  their harmonies are RYB.
- *Red–green feels like a complement to most people.* This is the pair non-designers name, and it is what
  Adobe Color produces.

**Against RYB.**
- *Historically fabricated.* Bruce MacEvoy (handprint): there is *"no historical source prior to the 18th
  century that starts with three 'primary' or 'primitive' colors"*; the RYB triad was retrofitted into
  Newton's hue circle by artists as a practical compromise. Complements, he argues, should be defined
  against a white point on a chromaticity diagram, not by geometric opposition on a circle.
- *The spacing is bad even for painters.* James Gurney: the RYB wheel's red-orange-yellow sector is too
  "loose" and green-blue too "crowded".
- *There is no canonical RYB↔RGB mapping.* The darktable/pixls thread is the most useful evidence here:
  participants found *"no mathematical consensus exists; different websites produce conflicting sRGB
  values for the same harmonies"*, and that a genuine RYB conversion would need spectral pigment data.
  **This is a direct implementation risk for us: whichever mapping we pick (Gossett–Chen trilinear cube
  being the common one), it is a choice, not a standard, and it must be documented and frozen.**
- *Cost/benefit for a component library.* The iro.js maintainer's objection: rendering + input-handling
  complexity for a narrow audience.

**For perceptual (LCh / OKLCH).**
- *HSV's hue ring is badly distorted.* ninedegreesbelow: *"violet-blues, violets, and magentas occupy an
  unduly large portion of the HSV hue ring, and reds, oranges, yellows, greens, blue-greens, and blues
  are all squished together"* — so equal HSV steps are not equal steps, and triadic/analogous schemes are
  silently unbalanced.
- *HSV opposites are the wrong kind of complement.* They are mixing complements (make grey), not visual
  complements.
- *Constant-hue rotation preserves perceived lightness.* Evil Martians: rotating hue in OKLCH keeps
  perceived brightness stable; in HSL it does not (pure yellow vs pure blue at the same L).
- *The strongest partisan statement found*, from meodai's colour-expert guidance: RYB at equal 120° is
  *"the origin of bad color theory"*; *"Hue-first harmony is a weak standalone heuristic"*; use OKLCH for
  perceptually uniform work — and note the accompanying claim from Ellen Divers' research that *"hue is
  usually a weaker predictor of emotional response than chroma and lightness"*.

**Against perceptual.**
- The same ninedegreesbelow author warns that LCh uniformity *"breaks down especially around LCh hue
  270"* (Abney / Bezold-Brücke), and that LCh hues differ from CIECAM by up to 5° for warm colours and
  **20° around violet-blue**.
- Gamut: *"saturated dark magentas, blue-greens, and greens have serious gamut limitations in the sRGB
  color space"* — which is precisely the region where a fixed 125-dye set is sparse, so the "nicer" target
  may simply have no dye near it.
- It is unfamiliar. No mainstream consumer harmony tool defaults to it; the OKLCH harmony precedents are a
  paid tier and one developer demo.

---

## 5. Implications for XIV Dye Tools

- **Ship two wheels, design the enum for three.** Every switchable precedent aimed at a non-professional
  audience ships exactly two (Sessions College, Rebelle, Coolorus). Default stays today's RGB/HSV so no
  existing share link or `/harmony` invocation changes meaning; add "Artist's (RYB)" as the opt-in. Keep
  OKLCH as a designed-for third, gated behind the same control, because it is the one with real
  peer-reviewed backing but no consumer familiarity.
- **Label it `Color wheel`, not `Color mode`.** Translation collision, evidenced above.
- **Re-render the ring.** Sessions College proves a conic-gradient ring can be re-stopped on switch; users
  expect the picture to change when the maths does.
- **Freeze and document the RYB mapping.** The darktable thread is the cautionary tale — there is no
  standard, so ours becomes the contract, and any change silently re-picks dyes.
- **Carry the wheel in shared state.** The Adobe "hue 137" saga is what happens when the computed wheel
  and the displayed hue disagree. The `/harmony` command already has a `matching` (ΔE formula) option; a
  `wheel` option belongs beside it, and both belong on the card.
- **It is a real differentiator.** No GW2, ESO, Destiny or ACNH tool offers harmony at all; Warframe's
  Fashion Frame Ninja offers harmony + CIEDE2000 matching but a single fixed wheel. Being the first
  game-dye tool with a selectable harmony wheel is defensible marketing.

---

## Sources

Pages fetched and read for this report:

- https://community.adobe.com/t5/adobe-color-discussions/how-is-complementary-color-determined/m-p/13638448
- https://community.adobe.com/t5/adobe-color-discussions/incorrect-color-wheel-and-complementary-harmony/m-p/14371647
- https://community.adobe.com/t5/adobe-color-discussions/why-is-cmyk-not-a-color-mode-option-anymore/td-p/14469002
- https://color.adobe.com/create/color-wheel (live DOM inspected via Playwright — harmony radio list, "Select color mood")
- https://huebliss.com/adobe-color-wheel/
- https://paletton.com/
- https://www.sessions.edu/color-calculator/ (fetched, then live DOM + conic-gradient stops inspected via Playwright)
- https://coolors.co/color-picker
- https://coolors.co/color-wheel (404 — no such page exists)
- https://www.figma.com/color-wheel/
- https://atmos.style/
- https://atmos.style/color-wheel
- https://mycolor.space/
- https://colordesigner.io/color-wheel
- https://www.colorbrew.co/color-wheel
- https://htmlcolorcodes.com/color-wheel/
- https://products.aspose.app/html/color-wheel
- https://rgbatohex.com/tools/color-wheel
- https://oklch.com/
- https://github.com/ardov/huetone
- https://leonardocolor.io/
- https://meodai.github.io/pro-color-harmonies/
- https://github.com/meodai/poline/blob/main/README.md
- https://github.com/meodai/skill.color-expert/blob/main/SKILL.md
- https://www.khroma.co/
- https://pigment.shapefactory.co/
- https://evilmartians.com/chronicles/exploring-the-oklch-ecosystem-and-its-tools
- https://dev.to/sendotltd/an-advanced-color-picker-with-oklch-lch-lab-and-color-harmony-4h1j
- https://docs.krita.org/en/reference_manual/dockers/advanced_color_selector.html
- https://docs.krita.org/en/reference_manual/dockers/artistic_color_selector.html
- https://docs.krita.org/en/reference_manual/dockers/wide_gamut_color_selector.html
- https://bugs.kde.org/show_bug.cgi?id=393477
- https://help.procreate.com/procreate/handbook/colors/colors-harmony
- https://product.corel.com/help/Painter/540219480/Main/EN/Win-Documentation/Corel-Painter-Working-with-color-harmonies.html
- https://help.clip-studio.com/en-us/manual_en/300_color/Color_Wheel_palette.htm
- https://escapemotions.com/products/rebelle/manual/8/interface/panel-color/
- https://www.escapemotions.com/blog/rebelle-8-color-harmonies-filter-layer-per-layer-ryb-color-wheel-and-more
- https://coolorus.com/
- https://anastasiy.com/magicpicker
- https://tutorials.anastasiy.com/?kbe_knowledgebase=tip49-traditional-color-wheel
- https://s3-eu-west-1.amazonaws.com/affinity-docs/help/designer/en-US.lproj/pages/Clr/selectingClr.html
- https://github.com/jaames/iro.js/discussions/174
- https://discuss.pixls.us/t/color-harmony-with-ryb/39614
- https://www.handprint.com/HP/WCL/color6.html
- https://ninedegreesbelow.com/photography/lch-complements-and-color-harmonies.html
- https://longform.asmartbear.com/color-wheels/
- https://www.gw2bltc.com/en/tool/dye/search
- https://kulinda.github.io/dyes/ (title only returned)
- https://fashionframe.ninja/tools/color-association
- https://www.warframecolorpicker.app/

Fetch attempts that failed (findings for these rest on search-result summaries and are flagged as such
in the text): `helpx.adobe.com/color/using/create-color-schemes-color-wheel.html` (timeout),
`helpx.adobe.com/creative-cloud/adobe-color.html` (timeout),
`helpx.adobe.com/illustrator/.../color-guide-panel-overview.html` (timeout),
`helpx.adobe.com/sg/illustrator/using/color-groups-harmonies.html` (timeout),
`blogs.adobe.com/tonyharmer/...` (TLS mismatch), `canva.com/colors/color-wheel/` (403),
`colorkit.co/color-wheel/` (403), `icolorpalette.com/color-wheel/` (403),
`docs.blender.org/.../color_picker.html` (403), `paletton.com/wiki/...` (404/500),
`news.ycombinator.com/item?id=40943064` (429).
