# Selectable colour wheels for Harmony Explorer — implementation design space and library landscape

Research slice 05. All measurements were run against the repository's own dye data
(`packages/core/src/data/dyes.json`, 125 dyes, Facewear excluded) on 2026-09-04.

---

## 0. What the code does today (verified, not assumed)

`generateHarmonySlots` (`packages/core/src/services/dye/HarmonySelector.ts`) is already the
single shared implementation — the 2026-09-03 harmony convergence landed it. Its per-slot loop is:

```ts
const baseHsv = ColorService.hexToHsv(baseHex);
const targetHue = (baseHsv.h + normalisedOffset) % 360;
const targetHex = ColorService.hsvToHex(targetHue, baseHsv.s, baseHsv.v);
const ranked   = rankCandidates(candidates, targetHue, targetHex, config);
```

Two facts matter for the design:

1. **There is exactly one place where hue arithmetic happens** — those three lines. A wheel
   abstraction is a three-line substitution, not a refactor.
2. **`targetHue` is carried alongside `targetHex`** and is used by the non-perceptual ranking
   branch (`devianceFor` falls back to angular hue distance when `usePerceptualMatching` is off).
   Any wheel that cannot produce a meaningful *sRGB-HSV* `targetHue` breaks that branch. This is
   the single biggest constraint on the abstraction, and it rules out one of the three families
   below.

Also verified: the `@xivdyetools/svg` package draws **no gradients at all** (`grep` for
`linearGradient|radialGradient` → 0 matches across 25 files) and the `/harmony` card
*deliberately has no wheel* — `harmony-card.ts` opens with "The wheel is gone entirely — it was
160,000 pixels saying less than these rows do." Cards are 400 × ≤350 logical units
(`CARD_MAX_HEIGHT === 350`), rendered at 3× to 1200 × 1050.

---

## 1. The abstraction

```ts
export interface ColorWheel {
  readonly id: 'rgb' | 'ryb' | 'cmyk' | 'oklch' | 'cielch';
  /** sRGB-HSV hue (0–360) → position on this wheel (0–360). Strictly monotonic. */
  toWheelHue(hsvHue: number): number;
  /** Position on this wheel (0–360) → sRGB-HSV hue (0–360). Inverse of the above. */
  fromWheelHue(wheelHue: number): number;
  /** The ring pixel at a wheel position — a fully saturated reference colour. */
  ringColor(wheelHue: number): HexColor;
}
```

Note what is *absent*: `fromWheelHue` returns an **hsvHue**, not a hex. The target is still built
by `hsvToHex(hue, baseHsv.s, baseHsv.v)`, exactly as today. That keeps the "carry the base's S/V"
contract that the whole convergence work was built on, keeps `targetHue` meaningful for the
hue-distance branch, and makes the RGB wheel the identity function — so today's output is
reproduced bit-for-bit by construction, not by luck.

The patch to `generateHarmonySlots` is then:

```ts
const baseWheelHue = wheel.toWheelHue(baseHsv.h);
const targetHue    = wheel.fromWheelHue(baseWheelHue + normalisedOffset);
const targetHex    = ColorService.hsvToHex(targetHue, baseHsv.s, baseHsv.v);
```

### (a) Hue-warp wheels — RYB, CMYK

A hue warp is a monotonic piecewise-linear bijection θ_hsv ↔ θ_w. The canonical RYB table is
NodeBox's `rotate_ryb` approximation of Itten's wheel (also republished by Sighack; it is the same
25 pairs everywhere it appears). **Column semantics are the opposite of what the comment in most
copies implies** — the code is authoritative: the first number is the *artistic/RYB* angle, the
second is the *HSV* hue:

```
(0,0) (15,8) (30,17) (45,26) (60,34) (75,41) (90,48) (105,54) (120,60)
(135,81) (150,103) (165,123) (180,138) (195,155) (210,171) (225,187)
(240,204) (255,219) (270,234) (285,251) (300,267) (315,282) (330,298) (345,329) (360,360)
```

Sanity check that settles the direction: RYB 120 ↔ HSV 60 is yellow, RYB 240 ↔ HSV 204 is Itten's
cyan-leaning blue, and `fromWheelHue(toWheelHue(0) + 180)` = **HSV 138°**, a green. That is the
familiar "red's complement is green" of the artist's wheel, which the RGB wheel gets wrong (it
gives cyan at 180°).

I verified invertibility and monotonicity numerically over 3,600 samples:

```
RYB warp: max round-trip error 2.27e-13°, monotonic = true
```

Both columns are strictly increasing, so it is a clean bijection with no special cases.

Paletton uses the same *family* of construction (it exposes an RYB hue on inspection) but does not
publish its table; `color-scheme` (MIT, c0bra, last published 2018) takes a different route —
a 24-entry `COLOR_WHEEL` mapping 15° steps to literal RGBA triples (`0: [255,0,0,100]`,
`120: [255,255,0,100]`, …). That is the same warp expressed as data-plus-colour rather than
angle-to-angle, and it is unusable for us because it also bakes in a "value" column that fights
our carry-the-base's-S/V rule.

A **CMYK wheel is not a distinct warp** — it is a relabelling. Subtractive CMY primaries are the
additive RGB secondaries, so a CMYK-labelled wheel is the RGB wheel rotated by 180° in *labelling
only*; its complements are identical to RGB's. Ship it as a ring-label variant of `rgb`, not as a
geometry. Selling it as its own geometry would be a lie the golden file would catch.

### (b) Full-space wheels — OKLCH / CIELCH rotation

Rotate `h` in OKLCH at fixed `L` and `C`, then gamut-map. This is a *different kind of thing*: it
replaces the base's HSV S/V with the base's OKLab L/C, so it changes lightness and chroma of the
target as well as hue, and it produces a hex with no natural `targetHue` for the non-perceptual
branch (you'd have to read the hue back out of the result — which after gamut mapping is not the
hue you asked for).

Gamut mapping options, in ascending cost:

| Method | What it does | Code | Notes |
|---|---|---|---|
| Naive clip | clamp linear RGB to [0,1] | ~3 lines | shifts hue and lightness; cheap |
| culori `clampChroma` | bisect chroma in LCh | ~35 lines | over-desaturates; "not guaranteed to return the optimal result" |
| culori `toGamut` / colorjs `toGamut({method:'css'})` | CSS Color 4: bisect chroma in OKLCH, accept the clipped candidate once ΔE_OK < 0.02 | ~65 lines | the spec algorithm; both libraries default to it |

I implemented the CSS Color 4 algorithm (binary search on chroma, JND 0.02 in OKLab, ε = 1/512)
and compared it against naive clipping over all 625 (dye, harmony-slot) targets:

```
CSS4 chroma-reduction vs naive clip differ on 127/625 targets (20.3%)
```

and the resulting *dye choice* differs on 385 vs 381 of 625 — i.e. **the gamut-mapping choice is
noise (0.6 pp) next to the choice of wheel.** ~40 lines of CSS-Color-4 bisection is worth it for
correctness on the ring and the target swatch, but do not expect it to change matches.

### (c) Table/data wheels — Munsell, NCS, PCCS

- **Munsell renotation** (`all.dat`, RIT): 4,995 rows of H V C → xyY. That is the smallest honest
  form of the dataset and it is ~150–250 KB of text before you build any inversion structure. The
  RIT original is distributed as an educational resource with no explicit open licence; the
  IEEE DataPort "re-renotation" is **CC BY-NC-SA 4.0** — the NC clause alone disqualifies it for a
  published npm package. Third-party inversion tables are far worse: `munsell-inversion-data`
  ships a 256³ × 32-bit LUT ≈ 64 MB.
- **NCS**: proprietary. NCS Colour AB asserts trademark *and* copyright *and* database rights, and
  commercial use requires a licence. Do not ship NCS data.
- **PCCS**: Japan Color Research Institute, 1964. No open dataset and no clear redistribution
  grant.

**Verdict on family (c): don't.** The honest compact substitute is a *hue-warp table hand-fitted to
the 40 principal Munsell hues* — 40 pairs of numbers, which is measurement, not their dataset —
but that is a design exercise with a colour scientist, not an engineering task, and the payoff over
RYB is small (both are "artist's wheels" that pull yellow apart and squeeze green).

---

## 2. Library landscape

Sizes are bundlephobia's minified + gzipped figures for the whole package entry point; all six have
zero runtime dependencies.

| Package | Version | min | min+gzip | Licence | Verdict |
|---|---|---|---|---|---|
| `culori` | 4.0.2 | 62,205 | **22,238** | MIT | Tree-shakable (`culori/fn`); the reference `toGamut`. Still 22 KB if imported whole. |
| `colorjs.io` | 0.7.1 | 81,704 | **32,377** | MIT | Best-documented gamut mapping; heaviest; poor tree-shaking (side-effectful space registration). |
| `chroma-js` | 3.2.0 | 41,225 | **16,233** | BSD-3-Clause AND Apache-2.0 | No OKLCH gamut mapping worth the name. Nothing we need. |
| `@texel/color` | 1.1.11 | 19,834 | **9,215** | MIT | The one genuinely modern, small, tree-shakable option; has OKLab/OKLCH + gamut mapping. |
| `color-space` | 3.1.0 | 117,952 | **52,932** | MIT | Conversion zoo, no gamut mapping. No. |
| `rybitten` | 1.2.0 | 12,529 | **4,257** | MIT | Trilinear RYB *cube* interpolation with 26 historical gamut presets (Itten, Munsell, Albers). Actively maintained (v1.0.0 Sept 2026). |
| `@material/material-color-utilities` | 0.4.0 | — | — | Apache-2.0 | 1,064,332 bytes unpacked. HCT is a CAM16-based *tone* system, not a hue wheel; solves a different problem. No. |
| `color-scheme` | 1.0.1 | — | — | MIT | Unmaintained since 2018; its `COLOR_WHEEL` is useful as a cross-check on the RYB table, not as a dependency. |
| `rgb2ryb` | — | — | — | — | **Deprecated by its own author** ("calculations are not accurate"), 11 years stale. Avoid. |
| `iris` (stevinz) | 1.0.4 | — | — | MIT | RYB hue shifting; 2 years stale; no advantage over 25 inlined numbers. |

### Dependency vs re-implement

**Re-implement. All of it.** The reasons are specific, not ideological:

- The RYB warp is **25 number pairs and a 6-line linear interpolator**, run twice. A 4 KB
  dependency to hold 25 numbers is not a trade; `rybitten` also solves the *wrong problem* — it is a
  full RGB↔RYB cube transform (trilinear interpolation between 8 corner colours), which changes
  saturation and lightness as well as hue and therefore breaks the carry-the-base's-S/V contract.
  Its 26 historical cubes are lovely and irrelevant.
- The CSS Color 4 gamut map is **~40 lines**. `packages/core` already has `hexToOklch`,
  `oklchToHex`, `hexToLch`, `lchToHex`, `rgbToOklab`, `oklabToRgb`, `getDeltaE_Oklab` — everything
  the bisection needs. Note that today's `oklchToHex` **clips** (`rgbToHex` clamps to 0–255) with no
  chroma reduction; adding a `gamutMapOklch()` beside it is additive and breaks nothing.
- `@xivdyetools/core` is *published to npm*. Every dependency it takes becomes a transitive
  dependency of every consumer, and the discord-worker sits at 2,632 KiB against Cloudflare's
  3,072 KiB gzip ceiling. 22 KB of culori is ~0.8% of the remaining headroom for something we can
  write in an afternoon and test better than they do.

The one place a dependency earns its keep is **as a test oracle, not a runtime import**: pin
`culori` as a `devDependency` in `packages/core` and assert our `gamutMapOklch` agrees with
`culori.toGamut` to within ΔE_OK 0.001 across a few thousand random OKLCH triples. That gets you
the correctness of the reference implementation at zero shipped bytes.

---

## 3. Should the metric follow the geometry?

No — and the measurement is unambiguous.

I re-ran the same OKLCH-rotated targets, ranking candidates once by CIEDE2000 and once by ΔE_OK:

```
METRIC swap on the SAME OKLCH target (ΔE00 vs ΔEOK ranking):
  285/625 = 45.6% of slots pick a different dye,
  mean ΔE00 between the two picks 12.21
```

Swapping the metric is *as disruptive as swapping the wheel*, so it is not a free "consistency"
tidy-up — it is a second, independent product change hiding inside the first.

The colour-science position is that these are separate questions with separate answers. The hue
circle is a **geometry for generating an intent**; the distance is a **model of perceived
difference**. CIEDE2000 is the CIE-recommended small-difference formula and it is what our matching
is already validated against (Sharma's 34 test pairs — see the mixing/matching fact-check).
OKLab's Euclidean distance is fitted for *interpolation and gradient smoothness*, and even there it
is under active revision: Oklch+ reports STRESS 16.61 vs Oklab's 33.42 on the same pair set, and a
known blue-region hue fold produces a visible purple shift around L ≈ 0.6. Oklab's own design goal
was hue *linearity* (fitted to Ebner-Fairchild) with CAM16 data for lightness and chroma — hue
linearity is exactly the property a wheel wants and exactly not the property a nearest-neighbour
metric wants.

Practical rule for the spec: **the wheel chooses `targetHex`; `matchingMethod` chooses the ranking,
and the two are orthogonal user settings.** Keep CIEDE2000 as the default for every wheel. Do not
auto-switch the metric when the wheel changes — that would silently move 45.6% of results for a
user who only changed the ring.

---

## 4. Rendering

### (a) Warped ring in CSS

Two options, and the cheap one is wrong. *Keeping the RGB ring and only moving the tick marks*
makes the wheel lie: on an RYB wheel the node opposite red must sit on green pixels, and if the
ring still paints cyan at 180° the picture contradicts the palette below it. Re-order the stops.

Because a hue warp is defined by breakpoints, the stop list *is* the table. For RYB (stop position
= wheel angle, stop colour = `hsl(fromWheelHue(angle))`):

```css
background: conic-gradient(from 0deg in hsl shorter hue,
  hsl(0   100% 50%) 0deg,   hsl(8   100% 50%) 15deg,  hsl(17  100% 50%) 30deg,
  hsl(26  100% 50%) 45deg,  hsl(34  100% 50%) 60deg,  hsl(41  100% 50%) 75deg,
  hsl(48  100% 50%) 90deg,  hsl(54  100% 50%) 105deg, hsl(60  100% 50%) 120deg,
  hsl(81  100% 50%) 135deg, hsl(103 100% 50%) 150deg, hsl(123 100% 50%) 165deg,
  hsl(138 100% 50%) 180deg, hsl(155 100% 50%) 195deg, hsl(171 100% 50%) 210deg,
  hsl(187 100% 50%) 225deg, hsl(204 100% 50%) 240deg, hsl(219 100% 50%) 255deg,
  hsl(234 100% 50%) 270deg, hsl(251 100% 50%) 285deg, hsl(267 100% 50%) 300deg,
  hsl(282 100% 50%) 315deg, hsl(298 100% 50%) 330deg, hsl(329 100% 50%) 345deg,
  hsl(360 100% 50%) 360deg);
```

`in hsl shorter hue` matters: it makes the browser walk hue linearly at constant saturation between
stops, which is *exactly* the linear interpolation the warp table itself specifies. Default sRGB
interpolation dips saturation at each midpoint. Drop the clause for the fallback — with 15° steps
the difference is invisible, and a bare `conic-gradient` is supported everywhere `conic-gradient`
is. Today's declaration lives at `apps/web-app/src/components/v4/v4-color-wheel.ts:124`, inside the
shadow root (page CSS never reaches it — see the shadow-DOM boundary note).

### (b) OKLCH ring smoothness and browser support

`in oklch` / `longer hue` gradient interpolation shipped in **Chrome 111 and Safari 16.4 (both
March 2023)** and **Firefox 127 (June 2024)** — ~95% of global traffic in 2026. It is production-safe
*as a progressive enhancement*, but Safari 12.1–16.1 parses `conic-gradient` and then chokes on the
`in oklch` clause, dropping the whole declaration and leaving a transparent ring. Guard it:

```css
.harmony-ring { background: conic-gradient(from 0deg, <24 explicit stops>); }
@supports (background: conic-gradient(in oklch, red, blue)) {
  .harmony-ring { background: conic-gradient(from 0deg in oklch longer hue, ...); }
}
```

Better still: **don't use OKLCH interpolation at all.** Emit the stops from `ringColor()` — the same
pure function the SVG card uses — so the browser and resvg paint the identical ring, and the ring
matches the maths by construction rather than by the browser's interpolation happening to agree.
24 stops at 15° is smooth on a 300 px wheel (~940 px circumference, ~39 px of arc per stop);
36 stops at 10° is imperceptibly better; below 8 stops you see facets.

### (c) SVG arc segments for resvg

**Conic gradients are not in any SVG specification.** `w3c/svgwg#785` ("Add a way to create conic
gradients") has been open since 8 April 2020 with no milestone, so this is not a resvg gap you can
wait out — no conformant SVG renderer has them. Arc segments are the only option.

Cheapest correct encoding, using a single wedge in `<defs>` and inheriting `fill` through `<use>`:

```svg
<defs><path id="wg" d="M200 55A120 120 0 0 1 210.5 55.5L208.4 85.4A90 90 0 0 0 200 85Z"/></defs>
<use href="#wg" transform="rotate(3 200 175)" fill="#ff7a00"/>
```

~55 bytes per segment. At 400 × 350 logical units:

| Segments | Step | Bytes (approx) |
|---|---|---|
| 72 | 5° | ~4.2 KB |
| 120 | 3° | ~6.9 KB |
| 360 | 1° | ~20 KB |

Standalone `<path>` wedges (no `<use>`) run ~95 bytes each — 11 KB at 3°, 34 KB at 1°. Either is
affordable, but note that **the `/harmony` card has no wheel today and shouldn't get one**: the card
comment records that the wheel was deliberately deleted for saying less than the rows. If the wheel
selection needs to appear on the card, it belongs as a text token in the header, not 160,000 pixels
of ring. Reserve the arc-segment renderer for og-worker's larger 1200 × 1050 OG frame if anywhere.

Two resvg cautions: `<use>`-with-inherited-`fill` must be *proved by rendering*, not by reading the
SVG string (the same discipline that caught the variable-font no-op), and adjacent wedges need
~0.25° of overlap or antialiasing leaves hairlines between them.

---

## 5. Behavioural contract and testing

A single parameterised suite, run over every registered wheel:

1. **Round trip.** `|fromWheelHue(toWheelHue(h)) − h| < 1e-9` for h in 0…359.9 step 0.1.
   *This is the test that would have caught my own bug* — my first OKLCH-warp prototype reported a
   13° round-trip error.
2. **Monotonicity.** `toWheelHue` is non-decreasing over 0…360 and `toWheelHue(360⁻) → 360`. Assert
   the *table* is monotonic at module load, not just sampled — sampling at 0.1° missed nothing here
   but would in general.
3. **Involution.** `complement(complement(x)) ≈ x` within 1e-9, for every wheel; and more generally
   `fromWheelHue(toWheelHue(h) + a + b) ≈ fromWheelHue(toWheelHue(h) + a + b mod 360)`.
4. **Golden file.** All 125 dyes × 10 harmony types × the RGB wheel, serialised to a checked-in
   fixture. Assert byte-for-byte. The RGB wheel is the identity map, so any drift is a regression,
   not a judgement call.
5. **Mutation-prove it.** Perturb the RYB table by 1° in a scratch run and confirm the golden file
   *and* at least one RYB assertion go red. A wheel suite whose assertions all pass with the warp
   stubbed to identity is a gate that cannot fail.
6. **Grey stability.** Measured: 4 near-grey dyes (Slate Grey, Pure White, Jet Black, Metallic
   Silver); **0 rotated targets gained saturation above 3.5%** under any of the three wheels, because
   the S/V carry makes a zero-saturation base rotation-invariant. Assert it, because a future
   full-space wheel would break it — Pure White's OKLCH-rotated complement is `#f7f8fc`, visibly
   bluer than the HSV wheels' `#f4f5f9`.
7. **Unknown-wheel safety.** `getWheel(id)` must use `Object.hasOwn`, not truthiness. The registry
   is keyed by a string that arrives from a share URL, and `WHEELS['toString']` is truthy — the
   exact trap `isKnownHarmonyType` already documents for `HARMONY_OFFSETS`.

### Encoding

- **Share URL**: add `&wheel=<id>`; **absent means `rgb`**. Every existing link keeps working with
  no migration and no dated fallback. Do not emit `wheel=rgb` in generated links — keep the default
  invisible so old and new links for the same palette are byte-identical.
- **Discord `/harmony`**: an *optional* `wheel` option with `choices` (RGB / RYB / OKLCH), defaulting
  to RGB when omitted. Choice names are localised through the existing bot-i18n path; the choice
  *values* stay the ASCII ids so analytics stay stable — and per the Tier A analytics decision, log
  the option's presence, not its value, unless the privacy policy is amended.
- **og-worker**: `?wheel=` alongside the existing `?lang=`, same default. The share-URL builders
  must carry it — og-worker has already shipped a bug where share URLs dropped `?lang=`.

---

## 6. How much is actually at stake

Method: for all 125 dyes and the three headline harmonies, build the target under each wheel, rank
the other 124 dyes by CIEDE2000, and compare the winner against the RGB wheel's winner. Script:
[`probes/wheelstakes.mjs`](./probes/wheelstakes.mjs) (and `wheelstakes2.mjs`, `wheelstakes3.mjs`), re-run
from that location with outputs checked in beside them.

| Harmony | Wheel | Slots | Partner changed | Mean ΔE00 when changed | Max ΔE00 | Mean target hue shift |
|---|---|---|---|---|---|---|
| complementary | RYB warp | 125 | 63 (**50.4%**) | 14.72 | 38.70 | 17.0° |
| complementary | OKLCH rotate | 125 | 81 (**64.8%**) | 16.98 | 58.38 | 4.7° |
| analogous | RYB warp | 250 | 93 (**37.2%**) | 13.41 | 27.10 | 9.8° |
| analogous | OKLCH rotate | 250 | 119 (**47.6%**) | 14.77 | 29.74 | 9.3° |
| triadic | RYB warp | 250 | 127 (**50.8%**) | 16.69 | 43.21 | 20.3° |
| triadic | OKLCH rotate | 250 | 185 (**74.0%**) | 16.46 | 36.14 | 17.2° |
| **All three** | **RYB warp** | **625** | **283 (45.3%)** | 15.17 | — | — |
| **All three** | **OKLCH rotate** | **625** | **385 (61.6%)** | 16.05 | — | — |

The feature is **material, not cosmetic**. Nearly half of every harmony changes under RYB, and the
changes are large — a mean ΔE00 of ~15 between old and new partner is roughly "different colour",
not "adjacent shade". For scale, ΔE00 ≈ 2.3 is the usual just-noticeable threshold.

Two results worth the product owner's attention:

- **OKLCH's disruption is not coming from hue.** Its mean target hue shift for complementary is only
  4.7° — smaller than RYB's 17.0° — yet it changes *more* partners (64.8% vs 50.4%). The movement is
  in lightness and chroma: rotating at fixed OKLab L and C abandons the base's HSV S/V, and the
  target lands somewhere the HSV wheels never go. That is a defensible design, but it is a
  different feature from "a different wheel", and users will read it as one.
- **A hue-warp built from OKLCH is a third option and behaves better.** Deriving a warp table from
  the OKLab hue of the sRGB pure-hue circle and keeping the S/V carry gives 280/625 = **44.8%**
  changed with a mean target displacement of ΔE00 5.6 (vs 9.6 for full OKLCH rotation) — same order
  of disruption as RYB, none of the lightness surprise. Its cost is variety: distinct complementary
  partners across the 125 dyes fall to **56/125**, against 75 for RGB, 67 for RYB and 66 for full
  OKLCH rotation. It compresses the wheel and collides more dyes onto the same answer.

Gamut mapping, for completeness: CSS Color 4 chroma reduction differs from naive clipping on
**20.3%** of targets but changes the chosen dye on only 0.6 pp more slots. Correctness, not impact.

---

## 7. The biggest engineering risk

**A non-invertible warp table that fails silently.** My first OKLCH-derived warp reported a
**13° round-trip error**, and the cause was subtle enough to be worth spelling out: the OKLab hue of
the fully saturated sRGB hue circle is *almost* monotonic but **reverses by 0.16° across HSV
231.4°–240.0°** (CIELab, measured the same way, does not reverse at all; OKLab at s=100, v=50
reverses on 59 of 3,600 samples). A 0.16° dent is invisible in the ring and imperceptible in any
single target — but a linear-search inverse walking the table hits the non-monotonic run, matches
the wrong interval, and returns a hue that is wrong by an order of magnitude more than the dent.
Nothing throws. The ring still looks right. The wheel just quietly answers the wrong dye for a band
of blues, and every downstream test that compares "the app" to "the bot" still passes because both
call the same broken function.

Mitigations, in order: (1) build every wheel from an explicit table and **assert monotonicity at
module load**; (2) monotonise derived tables with a running max before inverting, and assert the
correction never exceeds a stated tolerance; (3) make the round-trip test a hard gate for every
registered wheel, including any added later. The RYB table needs none of this — it is monotonic by
construction — which is a real argument for shipping RYB first and treating OKLCH as a second
increment.

Runner-up risks: the CMYK wheel being sold as a distinct geometry when it is a relabelled RGB wheel
(the golden file will show identical output — that is a spec bug, not a code bug, and it should be
caught before implementation); and the ring/geometry divergence, where the CSS conic stops and the
SVG arc fills are generated by two different code paths and drift. Both are solved by making
`ringColor()` a member of the same pure `ColorWheel` object that the geometry uses.

---

## Sources

- https://sighack.com/post/procedural-color-algorithms-hsb-vs-ryb
- https://github.com/meodai/RYBitten
- https://www.nodebox.net/code/Colors
- https://raw.githubusercontent.com/c0bra/color-scheme-js/master/lib/color-scheme.js
- https://registry.npmjs.org/color-scheme/latest
- https://registry.npmjs.org/chroma-js/latest
- https://registry.npmjs.org/culori/latest
- https://registry.npmjs.org/@texel/color/latest
- https://registry.npmjs.org/@material/material-color-utilities/latest
- https://bundlephobia.com/api/size?package=culori
- https://bundlephobia.com/api/size?package=colorjs.io
- https://bundlephobia.com/api/size?package=chroma-js
- https://bundlephobia.com/api/size?package=@texel/color
- https://bundlephobia.com/api/size?package=rybitten
- https://bundlephobia.com/api/size?package=color-space
- https://colorjs.io/docs/gamut-mapping
- https://github.com/Evercoder/culori/blob/main/src/clamp.js
- https://github.com/w3c/svgwg/issues/785
- https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#interpolation
- https://caniuse.com/mdn-css_types_image_gradient_conic-gradient_hue_interpolation_method
- https://bottosson.github.io/posts/oklab/
- https://raphlinus.github.io/color/2021/01/18/oklab-critique.html
- https://github.com/svgeesus/svgeesus.github.io/blob/master/Color/OKLab-notes.md
- https://arxiv.org/pdf/2606.05255 (Oklch+: A Three-Parameter Extension of Oklab)
- https://arxiv.org/pdf/2606.15352 (Chroma-gated differentiable OKLCH interpolation)
- https://en.wikipedia.org/wiki/Oklab_color_space
- https://files.cie.co.at/x046_2019/x046-PO005.pdf (Evaluation of hue shift formulae in CIELAB and CAM02)
- https://www.rit.edu/science/munsell-color-science-lab-educational-resources
- https://ieee-dataport.org/documents/munsell-re-renotation-revised
- https://github.com/privet-kitty/munsell-inversion-data
- https://en.wikipedia.org/wiki/Natural_Color_System
- https://ncscolour.com/en-int/pages/about-us
- https://en.wikipedia.org/wiki/Practical_Color_Coordinate_System
- https://www.npmjs.com/package/rgb2ryb
- https://github.com/stevinz/iris
- https://github.com/linebender/resvg
