# 06 — Synthesis and recommendation

**Date:** 2026-09-04 · **Base commit:** `1c017aea` · **Inputs:** documents 00–05 in this folder and the
scripts in `probes/`. No code was changed.

---

## Headline

1. **Ship a `Color wheel` selector with two entries in the first release: `RGB (screen)` — the
   default, bit-for-bit today's behaviour — and `RYB (artist's)`.** Design the enum and the UI for a
   third, `OKLCH (perceptual spacing)`, and add it as a second increment. Every other wheel researched
   is either the same circle under another name, a worse near-duplicate, licence-blocked, or a research
   project (§2).
2. **The feature is material, not cosmetic.** Over all 125 dyes × complementary/triadic/analogous
   (625 slots), the RYB wheel changes the chosen partner dye in **45.3 %** of slots, with a mean
   CIEDE2000 of 15 between the old and new pick — "a different colour", not "an adjacent shade".
   OKLCH rotation changes 61.6 % (§3).
3. **It is a genuine differentiator.** No Guild Wars 2, Elder Scrolls Online, Destiny or Animal
   Crossing dye tool offers harmony at all; Warframe's Fashion Frame Ninja offers harmony with CIEDE2000
   matching into fixed palettes — architecturally our product — and has a single fixed wheel. Adobe
   Color, the tool that sets user expectations, already computes on RYB and *hides* it, which is why
   it has years of "your complementary is wrong" threads (04 §1).
4. **Architecture is small.** A wheel is a pair of monotone hue maps plus a ring painter, all pure
   functions in `@xivdyetools/core`; the change to `generateHarmonySlots` is three lines; the ring's
   gradient stops and the node angles come from the same functions (§4). No new runtime dependency.
5. **Four things must be true or the feature quietly lies** (§5): the RYB table's column order is
   asserted by value; ring and geometry come from one function; every hue map is proved monotone at
   module load; and the wheel travels with the palette — share URL, `/harmony` option, OG parameter,
   and a text token on the card.

---

## 1. Where the five reports agree, and where they do not

**Agreed by every report that touched it**

- Only the web app draws a ring. The Discord card removed its wheel on purpose; the OG card never
  had one. The feature is web-rendering plus shared geometry — the resvg "no conic gradient" problem
  is moot unless a ring is reintroduced (00 §1, 02 §8, 05 §0).
- CMY/CMYK is the RGB wheel with the primaries and secondaries relabelled; complements and every
  harmony are byte-identical. HSV, HSL, HWB, HSI and HSY′ share the hue angle, and rotating at
  constant HSL (S,L) yields the *same RGB triple* as rotating at constant HSV (S,V) — verified to
  1.2 × 10⁻¹⁵ over 200 000 samples (03 §1–2, 05 §1a). Neither is a second wheel.
- The RYB wheel should be the 25-pair piecewise-linear hue warp (NodeBox / Paletton / Adobe lineage),
  not a cube interpolation: the warp is exactly invertible and leaves S/V untouched; the Gossett–Chen
  and RYBitten cubes have no inverse and change value as well as hue (01 §1, 05 §1a).
- Ranking stays CIEDE2000 whatever the wheel. Swapping the metric to ΔE_OK on the same target moves
  45.6 % of picks by itself — a second product change hiding inside the first (05 §3).
- Never let the existing `HarmonyGenerator.rotateHueInSpace()` near the UI: it clips per channel, so
  the OKLCH complement of pure blue comes out `#A02000` (dark red) instead of `#6E5000` (dark olive),
  50.6° off (02 §0, §7 Table B).
- Label the control **"Color wheel"** (ja 色相環, de Farbkreis, fr roue chromatique, ko 색상환, zh 色环),
  never "Color mode", which in all six locales already means Adobe's document colour mode (04 §4 Q1).

**Disagreements, and the call made here**

| Question | Position A | Position B | Call |
|---|---|---|---|
| Ship CIELCH in the UI? | 02: yes, as "Classic Lab" contrast wheel | 03/04: keep the picker to entries a player can tell apart; consumer tools ship two | **No UI entry.** CIELCH is OKLCH with the blue→purple drift (02 Table F: constant Lab hue walks `#0000EF`→`#D5BBFF`). Core may expose the id for API completeness if it is free. |
| Munsell wheel feasible? | 01: yes via a 360-entry LUT precomputed offline with `munsell.js` (MPL-2.0); matters for JP users because JIS Z 8721 *is* Munsell | 05: the renotation data is RIT-unlicensed or CC BY-NC-SA; a compact table "hand-fitted to the 40 principal hues" is a colour-scientist exercise | **Park, pending a licence decision.** The JP argument is real, but a LUT derived from non-commercial data is a derivative work until someone says otherwise. NCS is out under any name (trademark + licensed data); PCCS rides on Munsell. |
| OKLCH: rotate at constant L/C, or warp the hue axis? | 02: constant L and C plus CSS Color 4 gamut mapping; rank against the un-mapped target | 05: an OKLCH *hue warp* that keeps the S/V carry changes ~45 % of picks with half the target displacement and no lightness surprise, but compresses variety (56 distinct complements vs 75 for RGB) | **Warp first** (§4). It fits the same contract as RGB and RYB, needs no gamut mapping, and passes the same test suite. Constant-L/C is a different feature — "keep lightness" — that biases every palette toward mid-tones (02 §10 item 5); decide it on its own. |
| Hering / opponent wheel | 01: ship, S complexity, four CIECAM02 anchors | 02: unique R↔G and Y↔B are *not* 180° apart in any space, so it must be a 4-anchor warp, and the anchor angles are one study's contested averages | **Follow-up spike, not release 1.** It is the one wheel where yellow is opposite blue, which many players expect, and it is licence-clean. It needs one authoritative anchor set before it is a contract. |

---

## 2. The candidate matrix

Every wheel any report examined, one row each. "Distinct" means it moves at least one harmony
partner relative to the RGB wheel.

| Wheel | Distinct geometry? | Complement of `#FF0000` | Data / licence | Effort | Verdict |
|---|---|---|---|---|---|
| RGB · HSV · HSL · HWB · HSI · HSY′ · CMY · CMYK · Yurmby | one wheel | cyan, 180° | none | — | **Ship as default.** Explainer says it is also the print (CMY) wheel. |
| CMYK on process inks (SWOP/FOGRA) | yes, but per ICC profile | ≈196° azure | ICC LUT, no formula | M | Skip — there is no *the* CMYK wheel (03 §2). |
| **RYB — 25-pair warp table** | yes | 138° spring green (Adobe Color: 137°) | 25 integer pairs | **S** | **Ship (release 1).** |
| RYB — core's mixer model (`rgbToRyb`) | yes, differently | 120° pure green; identity from 210° to 360° | already in core | S | Fallback only — lopsided, and no external parity (probe `core-ryb-wheel-probe`). |
| RYB — Gossett–Chen / RYBitten cube | yes | 138°–158°, darker | MIT | M | Skip — no inverse; changes V. |
| **OKLCH hue warp** (S/V carry) | yes | ≈186° | already in core | **S–M** | **Design for; release 2.** Needs the monotonicity gate (§5 #3). |
| OKLCH constant-L/C rotation + gamut map | different contract | `#009CB2` teal | core + ~40 lines | M | Separate product decision ("keep lightness"). |
| CIELCH(ab) | yes, worse | `#008EA6` | already in core | S | No UI entry (blue→purple drift). |
| HSLuv / HPLuv (CIELUV hue) | yes | — | MIT | S | Skip — squeezes red–yellow into a third of Lab's arc; HPLuv is pastel-only. |
| HCT / CAM16 | ≈ OKLCH | — | Apache-2.0, ~1 MB unpacked, iterative inverse | M–L | Skip. |
| IPT · ICtCp · Jzazbz | ≈ OKLCH (Oklab's hue was fitted to the IPT data) | — | none in core | M–L | Skip. |
| **Opponent / Hering (4 unique hues)** | yes — yellow opposite blue | ≈ B50G cyan | published anchors, contested | **S–M** | **Follow-up spike.** |
| Munsell (JIS Z 8721) | yes | 5BG teal | renotation data: unlicensed / CC BY-NC-SA | M + licence call | Park; strongest JP-audience case. |
| NCS | yes | cyan | trademark + licensed data | — | Never as NCS; the opponent wheel is the same idea. |
| PCCS (24 hues) | via Munsell | 5BG teal | no redistribution grant | S after Munsell | Park with Munsell. |
| Ostwald · Chevreul · Harris · Goethe · Runge | no new geometry | — | — | — | Skip (labels on RYB or opponent). |
| Coloroid | yes, "aesthetically uniform" | — | Hungarian standard, no JS | L | Skip; best long-shot. |
| Warm/cool split · Kelvin locus | not wheels | — | — | S | **Overlay idea**, separate feature. |
| Spectral / mixing complement | 180° only | most-neutral mix partner | spectral.js (in core) | S–M | Toggle on Complementary later; gated on the spectral-mixing fix (PR #164). Never Mixbox (CC BY-NC). |
| Vectorscope / YUV | same complements | cyan | — | — | Skip. |
| Obangsaek · Wu Xing | not wheels (two of five colours are achromatic) | — | — | — | Palette preset at most. |

---

## 3. What actually changes — the numbers

From `probes/wheelstakes.mjs` (all 125 dyes, Facewear excluded, targets built per wheel, nearest
other dye by CIEDE2000, compared against the RGB wheel's pick):

| Harmony | Wheel | Slots | Partner changed | Mean ΔE00 old→new pick | Mean target hue shift |
|---|---|---|---|---|---|
| complementary | RYB warp | 125 | 63 (50.4 %) | 14.7 | 17.0° |
| complementary | OKLCH constant-L/C | 125 | 81 (64.8 %) | 17.0 | 4.7° |
| analogous | RYB warp | 250 | 93 (37.2 %) | 13.4 | 9.8° |
| analogous | OKLCH constant-L/C | 250 | 119 (47.6 %) | 14.8 | 9.3° |
| triadic | RYB warp | 250 | 127 (50.8 %) | 16.7 | 20.3° |
| triadic | OKLCH constant-L/C | 250 | 185 (74.0 %) | 16.5 | 17.2° |
| **all three** | **RYB warp** | **625** | **283 (45.3 %)** | 15.2 | — |
| **all three** | **OKLCH constant-L/C** | **625** | **385 (61.6 %)** | 16.1 | — |

Four readings that shape the design:

- **OKLCH's disruption is not hue.** Its complementary hue shift is 4.7° — a quarter of RYB's — yet it
  changes more partners, because rotating at constant OKLab L/C abandons the base's HSV S/V. Users
  would read that as "the wheel changed my lightness", which is a different feature from "a different
  wheel". This is the basis for preferring the OKLCH *warp* first.
- **The gamut-mapping choice is noise.** CSS Color 4 chroma reduction differs from naive clipping on
  20.3 % of targets but changes the chosen dye on only 0.6 percentage points more slots. Not clipping
  matters (02 Table B); *which* non-clipping method does not.
- **Greys are safe under warp wheels.** The four near-grey dyes gained no saturation under any hue
  warp, because an S = 0 base is rotation-invariant. A constant-L/C wheel breaks this (Pure White's
  OKLCH complement is visibly bluer) — another reason it is a separate decision.
- **The wheel is a no-op for muted bases.** `#6D5440` gives the same partner under every wheel and
  strategy (02 Table B row 4). A test suite built on muted dyes will pass whether or not the feature
  works; the golden and mutation tests must include saturated bases.

---

## 4. Design sketch for the spec

**Core.** A `ColorWheel` module beside `HarmonySelector.ts`:

```ts
interface ColorWheel {
  readonly id: 'rgb' | 'ryb' | 'oklch';           // extend later; never a free string
  toWheelHue(hsvHue: number): number;               // strictly monotone, 0–360 → 0–360
  fromWheelHue(wheelHue: number): number;           // exact inverse; returns an sRGB/HSV hue
  ringStops(count: number): readonly HexColor[];    // hsl(fromWheelHue(θ), 100%, 50%) per stop
}
```

`fromWheelHue` returns an HSV hue, not a hex, so the target is still built as
`hsvToHex(hue, base.s, base.v)`. That preserves the S/V-carry contract the convergence work rests
on, keeps `targetHue` meaningful for the non-perceptual ranking branch, and makes the RGB wheel the
identity — today's output is reproduced by construction. The RGB wheel is a two-line identity; the
RYB wheel is the 25-pair table with a linear interpolator run in each direction; a future OKLCH warp
is a table derived from the OKLab hue of the pure-hue circle, **monotonised and asserted**.

`generateHarmonySlots` gains `wheel?: ColorWheelId` on `HarmonySelectionConfig` (default `'rgb'`)
and changes three lines:

```ts
const baseWheelHue = wheel.toWheelHue(baseHsv.h);
const wheelHue     = (baseWheelHue + normalisedOffset) % 360;   // where the node sits on the ring
const targetHue    = wheel.fromWheelHue(wheelHue);              // the sRGB hue of the ideal
const targetHex    = ColorService.hsvToHex(targetHue, baseHsv.s, baseHsv.v);
```

`HarmonySlot` should expose `wheelHue` alongside `targetHue`: the node's position on the ring is the
wheel angle, while the ideal's colour is the sRGB hue. Today the web component re-derives node angles
from a private copy of the offsets table; on a non-RGB wheel that copy would place nodes on the wrong
pixels. Retire it and feed the component from the slots. Mark `HarmonyColorSpace` and
`rotateHueInSpace` `@deprecated` — they are unreachable in production and they clip.

**Web app.** A `Color wheel` `<select>` in the sidebar's harmony section, copying the gradient tool's
colour-space select and Krita's one-line-blurb-per-option pattern. The ring's `conic-gradient` takes
its stops from `ringStops(24)` (36 if the RYB ring shows facets), emitted as plain hex so the browser's
interpolation space is irrelevant. Share URL gains `&wheel=`; absent means RGB and generated links omit
the default so old and new links for the same palette stay identical. Storage key alongside the
existing harmony keys.

**Discord.** An optional `wheel` choice option beside `matching`; omitted means RGB. The card prints
the wheel name as a text token in the header — not a ring. Analytics logs the option's presence, not
its value, under the Tier A rule.

**OG worker.** `?wheel=` carried through the share-URL builders, next to `?lang=`, which has already
been dropped once.

**Localisation.** One label, two or three option names, two or three blurbs, in six locales; the
parity gate enforces completeness. Suggested English: label "Color wheel"; options "RGB (screen)",
"RYB (artist's)", later "OKLCH (perceptual)"; blurb for RGB: "The screen wheel. Also the CMY print
wheel — same circle, different names."

**Changelogs.** Product-level, web-app and discord-worker layman's changelogs, each describing the
surface it actually changes.

**Tests, one parameterised suite over every registered wheel.**

1. Round trip `|fromWheelHue(toWheelHue(h)) − h| < 1e-9`, h in 0…360 step 0.1.
2. Table monotonicity asserted at module load, not sampled.
3. Involution: complement of complement is the base, within 1e-9.
4. Golden file: 125 dyes × 10 harmony types on the RGB wheel, byte-for-byte.
5. Value assertions on RYB: `fromWheelHue(120) = 60` (yellow) and `fromWheelHue(180) ≈ 138`.
6. Mutation check: perturb the RYB table by 1° in a scratch run and confirm the suite goes red.
7. Grey stability: no rotated target of an S = 0 base gains saturation.
8. Registry lookup with `Object.hasOwn` — `WHEELS['toString']` is truthy, and the id arrives from a URL.
9. Bot and OG parity with the web app on saturated bases, per wheel.

---

## 5. Traps, biggest first

1. **The RYB table's column order.** Column 1 is the RYB angle, column 2 the sRGB hue. The most-read
   write-up states it backwards in prose while implementing it correctly. Reverse it and red's
   complement becomes blue while a naive "complement ≠ 180°" test still passes. Assert the values in
   §4 test 5.
2. **Ring and geometry from two code paths.** Sessions College proves a conic ring can be re-stopped on
   switch; the ring, the node angles and the base spoke must come from the same `ColorWheel` or the
   picture contradicts the palette. That is exactly where the three surfaces diverged before PR #159.
3. **Derived tables that are almost monotone.** The OKLab hue of the pure sRGB hue circle reverses by
   0.16° across HSV 231.4°–240°. Invisible in the ring; a linear-search inverse then returns hues
   wrong by 13° for a band of blues, and nothing throws. Build every wheel from an explicit table,
   monotonise, assert at load (`probes/wheelstakes3.mjs`).
4. **The existing OKLCH rotation clips.** 50.6° hue error on pure blue; anyone who wires the new UI to
   `rotateHueInSpace` ships a wheel that disagrees with itself.
5. **CMYK as a menu entry.** The golden file would show it identical to RGB. That is a spec bug to
   catch before implementation, not a code bug.
6. **Slot collisions in the compressed arc.** The RYB warp squeezes sRGB 0°–60° into 120° of wheel, so
   analogous ±30° near red becomes a ±15° sRGB move and two slots can land on the same dye. Measure the
   collision rate per wheel as the convergence work did; `preventDuplicates` mitigates.
7. **Tests on muted dyes pass regardless.** See §3.
8. **The label.** "Color mode" is pre-loaded with the wrong meaning for the exact users who will reach
   for this.
9. **A wheel that does not travel.** Adobe computed on RYB and displayed HSB hue; the mismatch produced
   years of support threads. Whatever wheel a palette was generated on must be in the share URL, the
   `/harmony` response and the card.

---

## 6. Decisions for the product owner

1. **RYB mapping:** the Adobe-parity 25-pair table (recommended — external parity, symmetric warp) or
   core's existing mixer model (no new data, but lopsided and matches nothing outside this repo).
2. **Release-1 scope:** RGB + RYB (recommended, matching every consumer precedent) or RGB + RYB + OKLCH
   warp in one go.
3. **OKLCH flavour when it comes:** the hue warp with S/V carry (recommended — same contract, same
   tests) or constant-L/C rotation with gamut mapping (a "keep lightness" feature that biases toward
   mid-tones and breaks grey stability).
4. **Labels and blurbs** in English, to be translated: "Color wheel" → "RGB (screen)" / "RYB (artist's)".
5. **Munsell / JIS:** worth a licence call for the Japanese audience, or leave parked.
   *Resolved later the same day:* the licence check in [07](./07-munsell-licence-check.md) found a
   clean path (RIT's unrestricted `real.dat`, cross-checked against the MIT R `munsell` package), so
   the "licence-blocked" rows above are withdrawn and Munsell is increment 2.

---

## 7. Suggested rollout

- **Increment 1 — one medium PR:** core wheel module + RGB/RYB + tests and golden file; three-line
  selector change; web select, ring stops and node angles from core; bot option and card token; OG
  parameter; six locales; three layman's changelogs; deprecate the clipping rotation helper.
- **Increment 2:** OKLCH hue warp behind the same control, with the monotonicity gate; an opponent-wheel
  spike to fix anchor angles.
- **Increment 3, optional:** spectral-complement toggle on Complementary once the spectral mixing fix
  lands; warm/cool overlay; Munsell if the licence question resolves.
