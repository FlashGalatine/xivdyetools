# Harmony Explorer — selectable colour wheels

**Date:** 2026-09-04 · **Scope:** `@xivdyetools/core` (new module + one selector change), `web-app`,
`bot-logic` + `discord-worker`, `og-worker`, `@xivdyetools/svg` (one optional card token), six locales ·
**Status:** draft for review · **Research:** `docs/research/2026-09-04-harmony-color-wheels/` ·
**Branch:** `research/harmony-color-wheels` (PR #167)

## Problem

The Harmony Explorer rotates hue on the sRGB/HSV wheel. The offsets it rotates by are Itten's, written
for the artist's RYB wheel, where red's complement is green; on the HSV wheel the same 180° lands on
cyan. Adobe Color resolves this by computing on RYB and hiding it, which has produced years of "your
complementary is wrong" threads. There is no wheel that is *right*: complementarity is a property of a
wheel, not of a colour, and four traditions give four answers for red alone.

The choice is not cosmetic. Measured over all 125 dyes × complementary/triadic/analogous, the RYB
wheel changes the chosen partner dye in **45.3 %** of slots (mean ΔE00 15 between old and new pick), and
OKLCH rotation changes 61.6 % (research 05 §6, 06 §3).

Since PR #159 every surface — page, `/harmony`, OG card — calls one function,
`generateHarmonySlots`. A wheel added anywhere else re-forks them. So the wheel must be a named,
shareable input to that one function, and the page's ring must be painted from the same maths.

## Decisions (user, 2026-09-04)

1. **RYB mapping:** the Adobe-parity 25-pair hue-warp table (NodeBox/Paletton lineage; red's complement
   at sRGB 138°, Adobe Color reports 137°). Not core's mixer model, not a cube interpolation.
2. **OKLCH ships in release 1**, not as a later increment.
3. **Both OKLCH flavours ship:** a hue warp that keeps the base's saturation and value, and a
   constant-lightness rotation with gamut mapping. With Munsell (decision 5), five wheels in the
   selector.
4. **Localise everything** user-facing, in all six locales.
5. **Munsell:** licence check first; substitute the opponent (Hering) wheel if it fails. **The check
   cleared** (research 07): RIT publishes the renotation data with no licence or restriction while
   attaching explicit restrictions to other assets on the same page, the R `munsell` package republishes
   the same data as sRGB under MIT, and the wheel needs 40 rows (V=6, C=8 exists for all 40 principal
   hues). **User, after the check: build Munsell in this release with the recommended path** — the
   40-row hue table derived from RIT `real.dat` at V=6/C=8, cross-checked against the R `munsell`
   package's MIT sRGB values, shipping only the derived pairs plus the generator script, with the
   NOTICE and trademark disclaimer text from research 07 (§2.3). Five wheels in the selector. The
   opponent (Hering) wheel remains a later candidate on its own merits.

## Non-goals

- No CMYK, HSL, HWB, CIELCH, HSLuv or HCT entries: CMYK/HSL/HWB are the same circle (verified
  identical targets), the rest are worse duplicates of OKLCH (research 03, 02).
- The matching metric does not follow the wheel. CIEDE2000 stays the default for every wheel; swapping
  it moves 45.6 % of picks by itself and is a separate product change (research 05 §3).
- No ring on the Discord or OG cards; the card removed its wheel deliberately. A text token suffices.
- `HARMONY_OFFSETS` is untouched.

---

## 1. Vocabulary and wire format

```ts
export type ColorWheelId = 'rgb' | 'ryb' | 'munsell' | 'oklch-hue' | 'oklch-lightness';
export const DEFAULT_COLOR_WHEEL: ColorWheelId = 'rgb';
```

The id is the single wire format everywhere: share URL (`&wheel=`), Discord option value, OG query,
web-app storage, config controller. Ids are ASCII and never change; labels do. An absent or unknown id
means `rgb`, so every existing link, preset and bot invocation keeps its meaning.

**English labels and blurbs** (to be translated; the control is never called "Color mode", which in
all six locales already means Adobe's document colour mode):

| id | Label | Blurb |
|---|---|---|
| — | **Color wheel** | Which wheel the harmony angles are measured on. Changes which dyes are suggested. |
| `rgb` | RGB (screen) | The screen wheel, and also the CMY print wheel — same circle, different names. Today's behaviour. |
| `ryb` | RYB (artist's) | The painter's wheel harmony rules were written for. Red's complement is green. |
| `munsell` | Munsell (JIS) | The evenly spaced perceptual hue circle behind Japan's JIS colour standard. Red's complement is blue-green. |
| `oklch-hue` | OKLCH hue (perceptual spacing) | The screen wheel re-spaced so equal angles are equal perceived hue steps. Keeps the base's vividness and brightness. |
| `oklch-lightness` | OKLCH lightness (perceptual, keeps brightness) | Rotates hue at constant perceived lightness and colourfulness. Partners match the base's brightness; palettes lean toward mid-tones. |

The selector lists them in that order, `rgb` first and default. The Munsell option additionally
carries, in its info tooltip rather than the blurb, the one-line trademark disclaimer from §2.3.

## 2. Core: the `ColorWheel` module

New file `packages/core/src/services/dye/ColorWheel.ts`, exported from the package root.

**Core is the single source of truth (user, 2026-09-04).** Everything a consumer needs to offer,
validate, compute and draw a wheel is exported from `@xivdyetools/core`: the id union, the display
order, the default, the type guard, the registry, the warp tables and Munsell data, the ring paint, and
the gamut map. The web app, `bot-logic`, `discord-worker`, `og-worker` and any future consumer
(Stoat bot, `api-worker`, third parties on npm) import these and hold **no list of their own** — the
Discord choices, the sidebar options and the OG validator are all derived from `COLOR_WHEEL_IDS` the
way `/harmony type` choices already derive from core's harmony types. Adding a wheel later is one
registry entry in core plus translations; no surface code changes.

```ts
export interface ColorWheel {
  readonly id: ColorWheelId;
  /** Where a colour sits on this wheel, 0–360. */
  hueOf(hex: string): number;
  /** The ideal colour for a slot at `wheelHue`, carrying whatever this wheel preserves from the base. */
  target(baseHex: string, wheelHue: number): { targetHex: HexColor; targetHue: number };
  /** Ring paint at `count` evenly spaced wheel angles, plain hex, in gamut. */
  ringStops(count: number): readonly HexColor[];
}

export function getColorWheel(id: ColorWheelId): ColorWheel;   // Object.hasOwn lookup
export function isColorWheelId(value: unknown): value is ColorWheelId;
export const COLOR_WHEEL_IDS: readonly ColorWheelId[];        // in display order
```

`targetHue` is always an sRGB/HSV hue, because the non-perceptual ranking branch in `devianceFor`
compares dye HSV hue to it.

### 2.1 Hue-warp wheels: `rgb`, `ryb`, `munsell`, `oklch-hue`

A factory `hueWarpWheel(id, table)` builds a wheel from a **checked-in, strictly monotone table** of
`[wheelAngle, hsvHue]` pairs spanning 0→360 on both columns:

- `hueOf(hex)` = interpolate `hexToHsv(hex).h` through the table's HSV column to the wheel column.
- `target(baseHex, θ)` = `hsvHue = interpolate θ back`; `targetHex = hsvToHex(hsvHue, base.s, base.v)`;
  `targetHue = hsvHue`. This is today's S/V-carry contract, unchanged.
- `ringStops(n)` = `hsvToHex(fromWheel(θᵢ), 100, 100)` — pure sRGB hues re-spaced along the wheel.

Tables:

- **`rgb`:** `[[0,0],[360,360]]`. The identity. Today's output is reproduced by construction.
- **`ryb`:** the 25 pairs, column 1 = RYB angle, column 2 = sRGB hue:
  `(0,0) (15,8) (30,17) (45,26) (60,34) (75,41) (90,48) (105,54) (120,60) (135,81) (150,103) (165,123)
  (180,138) (195,155) (210,171) (225,187) (240,204) (255,219) (270,234) (285,251) (300,267) (315,282)
  (330,298) (345,329) (360,360)`. Column order is the known trap (research 01 §1a); §6 asserts it by
  value.
- **`munsell`:** 40 pairs, one per principal hue (2.5R, 5R, 7.5R, 10R, 2.5YR … 10RP), plus the wrap
  pair. Column 1 = the Munsell hue as an angle, `ASTM hue number × 3.6°` (100 evenly spaced steps;
  5R = 5, 5Y = 25, 5G = 45, 5B = 65, 5P = 85), **re-zeroed so sRGB 0° ↦ wheel 0°** like every other
  warp wheel — the wheel keeps Munsell's spacing, not its origin. Column 2 = the HSV hue of that
  notation at **V = 6, C = 8**, computed from the renotation's xyY (illuminant C) → XYZ → Bradford
  C→D65 → linear sRGB → HSV hue **before any clipping**, so a row slightly outside sRGB still yields a
  hue. Munsell hue order is spectral order, so the table is monotone by construction; the generator
  asserts it. Data provenance and attribution in §2.3.
- **`oklch-hue`:** 73 pairs at 5° steps of HSV hue, column 2 = HSV hue, column 1 = the OKLab hue of
  `hsvToHex(h, 100, 100)` re-zeroed so HSV 0° ↦ wheel 0° and **monotonised** with a running maximum.
  The raw curve reverses by 0.16° across HSV 231.4°–240° and a naïve inverse then errs by 13°
  (research 05 §7). The table is generated once by a script in `packages/core/scripts/` and checked in
  as data; the script is kept so the derivation is reproducible, and a test re-derives and compares.

### 2.2 Constant-lightness wheel: `oklch-lightness`

Bespoke implementation:

- `hueOf(hex)` = `hexToOklch(hex).h`.
- `target(baseHex, θ)`: `{L, C} = hexToOklch(baseHex)`; `targetHex = gamutMapOklch(L, C, θ)`;
  `targetHue = hexToHsv(targetHex).h`. Achromatic bases (`C` below a small epsilon) return the base
  hex unchanged for every θ, so greys stay grey.
- `ringStops(n)`: for each θᵢ, the maximum in-gamut chroma at a fixed ring lightness (proposed
  `L = 0.65`), found with the same bisection, memoised on first use. This is the only ring whose stops
  are not pure sRGB hues; it is emitted as hex so the browser never interpolates through
  out-of-gamut colours (browsers clip; none implements CSS Color 4 gamut mapping).

`gamutMapOklch(L, C, h): HexColor` is added to `ColorConverter`: CSS Color 4 §14 binary search on
chroma with local MINDE, `JND = 0.02` in ΔE_OK, `ε = 0.0001`, returning the clipped candidate once it is
within one JND. It is additive; the existing `oklchToHex` (which clips) is unchanged for callers that
rely on it. A devDependency on `culori` provides the oracle test (§6) and ships zero bytes.

### 2.3 Munsell data provenance (research 07)

- **Source:** RIT Munsell Color Science Laboratory's `real.dat` (the 1943 Newhall–Nickerson–Judd
  renotation, "real" colours only), published with no licence or restriction. **Not vendored.** The
  generator script `packages/core/scripts/build-munsell-hues.ts` takes a local path to `real.dat`,
  extracts the 40 rows at V=6/C=8, derives the pairs, asserts monotonicity, and writes
  `packages/core/src/data/munsell-hues.json`. Only that 40-pair file ships.
- **Cross-check:** the derived sRGB hue of each row is compared against the R `munsell` package's
  MIT-licensed `munsell.map` hex (same file, same Bradford C→D65 pipeline) and against RIT's own
  `real_sRGB.xls`; the per-row deltas are recorded in the implementation plan's evidence. Any row more
  than 1° off either reference blocks the table.
- **Attribution:** create `packages/core/NOTICE` with the text in research 07 §"Attribution" (RIT MCSL
  and the 1943 JOSA paper, doi:10.1364/JOSA.33.000385; the R `munsell` MIT copyright line; the
  "computed renotations, not Book of Color measurements" caveat; the trademark sentence), reference it
  from the package README, and add the trademark sentence once to the wheel's UI tooltip in six
  locales: "MUNSELL is a registered trademark of Amazys Holding GmbH; this wheel is computed from
  published renotation data and is not affiliated with or endorsed by X-Rite or Pantone."
- **Ring:** pure sRGB hues re-spaced along the wheel, as for RYB.

### 2.4 Public API surface (published npm)

```ts
// @xivdyetools/core
export type ColorWheelId;                          // 'rgb' | 'ryb' | 'munsell' | 'oklch-hue' | 'oklch-lightness'
export const COLOR_WHEEL_IDS: readonly ColorWheelId[];   // display order, rgb first
export const DEFAULT_COLOR_WHEEL: ColorWheelId;    // 'rgb'
export function isColorWheelId(v: unknown): v is ColorWheelId;
export function getColorWheel(id: ColorWheelId): ColorWheel;   // hueOf / target / ringStops
export interface ColorWheel;
export interface HarmonySelectionConfig { …; wheel?: ColorWheelId }
export interface HarmonySlot { …; wheelHue: number }
export namespace ColorConverter { gamutMapOklch(L, C, h): HexColor }
```

Consumers reach the wheels only through `generateHarmonySlots(…, { wheel })` for selection and
`getColorWheel(id).ringStops(n)` / `.hueOf(hex)` for drawing. The deprecated `DyeService.find*Dyes()`
façade is not extended with a wheel parameter; it stays as it is for compatibility and points callers
at `generateHarmonySlots`. `core` bumps a minor for the new exports and the new slot field.

### 2.5 Deprecations

`HarmonyColorSpace`, `HarmonyOptions.colorSpace` and `HarmonyGenerator.rotateHueInSpace` are marked
`@deprecated` with a pointer to `ColorWheel`. They are unreachable in production and they clip (the
OKLCH complement of pure blue comes out 50.6° wrong — research 02 §7). They remain exported because
core is published; removal is a later major.

The bot's dead plumbing for them is removed in this change: `discord-worker`'s `color_space` option
parsing and `bot-logic`'s `harmonyOptions` field (already `void`ed since PR #159).

## 3. Core: the selector change

`HarmonySelectionConfig` gains `wheel?: ColorWheelId` (default `'rgb'`). `HarmonySlot` gains
`wheelHue: number` — the slot's angle on the selected ring — alongside the existing `targetHue`.

```ts
const wheel = getColorWheel(config.wheel ?? DEFAULT_COLOR_WHEEL);
const baseWheelHue = wheel.hueOf(baseHex);
offsets.forEach((offset, index) => {
  const normalisedOffset = ((offset % 360) + 360) % 360;
  const wheelHue = (baseWheelHue + normalisedOffset) % 360;
  const { targetHex, targetHue } = wheel.target(baseHex, wheelHue);
  // ranking, pinning, de-duplication, companions: unchanged
  slots.push({ index, offset: normalisedOffset, wheelHue, targetHue, targetHex, dye, deviance, companions });
});
```

Nothing after target construction changes. With `wheel` unset the existing golden digest must be
byte-identical (§6).

## 4. Web app

- **Config:** `HarmonyConfig.wheel: ColorWheelId` (default `rgb`); storage key
  `v3_harmony_wheel` beside the existing harmony keys; `ConfigController` `harmony` section carries
  it like `matchingMethod`.
- **Sidebar** (`config-sidebar.ts`, `renderHarmonyConfig`): a `Color wheel` `<select>` directly below
  the harmony-type select, copying the gradient tool's colour-space select, with the selected option's
  blurb in the existing `config-description` slot (Krita's one-line-per-option pattern). The options
  are rendered by iterating core's `COLOR_WHEEL_IDS`; labels and blurbs are locale keys
  `config.wheel.<id>` / `config.wheel.<id>Desc`, so the web app holds no wheel list of its own.
- **Tool** (`harmony-tool.ts`): passes `wheel` into the core call; share params include `wheel` only
  when it is not `rgb`, so links for the default stay byte-identical to today's; the share-URL reader
  accepts `wheel=`, normalises unknown values to `rgb` with the same loud log the `algo` path uses.
- **Ring** (`v4-color-wheel.ts`): two new properties replace the component's private geometry —
  `ringStops: string[]` (from `wheel.ringStops(72)`) and `nodeAngles: number[]` (the base at index 0,
  then each slot's `wheelHue`). The `conic-gradient` becomes a computed inline style built from
  `ringStops`; the private `getHarmonyAngles()` offsets copy and `hexToHue()` are deleted. The empty
  state receives angles derived from `HARMONY_OFFSETS` at base 0° on the RGB wheel. Node click
  behaviour (nearest dye to the node colour) is unchanged. This lives inside V4LayoutShell's shadow
  root, so the style is set shadow-side.
- **OG meta:** wherever the page's `?algo=` is forwarded into the OG image URL today, `wheel` is
  forwarded beside it when not `rgb`.

## 5. Discord bot and OG worker

**Schema** (`discord-worker/src/commands/schemas.ts`): an optional `wheel` string option on
`/harmony` whose choices are **derived from core's `COLOR_WHEEL_IDS`** exactly as
`HARMONY_TYPE_CHOICES` derives from the harmony-type union — values are the ids, names come from a
`COLOR_WHEEL_LABELS` map typed `Record<ColorWheelId, string>` so a wheel added in core without a label
is a type error, following the English-only convention the `matching` choices already use. Five
choices, far under Discord's 25.

**Handler** (`discord-worker/src/handlers/commands/harmony.ts`): parse `wheel`, validate with
`isColorWheelId`, pass to `bot-logic`. Remove `color_space`.

**bot-logic** (`commands/harmony.ts`): `HarmonyCommandOptions.wheel?: ColorWheelId`; forwarded into
`generateHarmonySlots`; the embed's share URL appends `&wheel=` when not `rgb`. The card
(`@xivdyetools/svg` `generateHarmonyCard`) gains an optional `wheelLabel` header token, rendered only
when the wheel is not `rgb`, localised through the bot translator (`harmony.wheel.<id>` keys in six
locales). No ring.

**Analytics:** the option's presence is logged, never its value (Tier A rule).

**og-worker:** `wheel` is added to `OG_ALLOWED_QUERY_KEYS` and validated at the shared `/og/*` guard
exactly as `algo` is (reject with 400 when present and invalid), using core's `isColorWheelId` rather
than a local list. The harmony route forwards it into
`generateHarmonySlots` and prints the same header token. **Cache-space note for review:** FINDING-024
bounded the number of distinct renders per path by allowlisting query keys; `wheel` is a validated
four-value enum, the same class as `algo` (six values), so it multiplies the harmony route's variants by
four. Unlike `perceptual`, it cannot be defaulted away — a card that ignored it would show dyes the
page it opens never shows, for 45 % of palettes. The embed route that turns a page share URL into the
OG image URL forwards `wheel` with `algo` and `lang`.

## 6. Testing

One parameterised suite in core runs over every registered wheel:

1. **Round trip:** `|fromWheel(toWheel(h)) − h| < 1e-9` for h in 0…360 step 0.1 (warp wheels); for
   `oklch-lightness`, `hueOf(target(base, θ).targetHex)` within 1° of θ for saturated in-gamut bases.
2. **Monotone tables:** every warp table strictly increasing in both columns and spanning 0→360; the
   `oklch-hue` table equals what the generator script re-derives.
3. **Involution:** the complement of the complement is the base, within 1e-9.
4. **Golden unchanged:** the existing `HarmonySelector.golden.test.ts` digests are byte-identical with
   `wheel` unset and with `wheel: 'rgb'`.
5. **Golden per wheel:** the same test gains a frozen digest for each non-RGB wheel, so a table edit is a
   deliberate re-baseline with a named sample that prints dye names first.
6. **RYB by value:** `target(red, 120).targetHue = 60` (yellow) and `target(red, 180).targetHue ≈ 138`;
   RYB blue (240°) maps to sRGB 204°.
6b. **Munsell landmarks:** the checked-in table has exactly 40 hues plus the wrap pair, consecutive
   wheel angles are 9° apart (2.5 Munsell steps × 3.6°), and the sRGB hues of 5Y, 5G, 5B and 5P match
   the generator's derived values within 0.5° — the plan records those four numbers once the generator
   has run against `real.dat`.
7. **Mutation check, once, recorded in the plan:** perturb the RYB table by 1° in a scratch run and
   confirm tests 5 and 6 go red. A suite that stays green with the warp stubbed to identity is a gate
   that cannot fail.
8. **Grey stability:** no rotated target of an S = 0 base gains saturation under any wheel; the
   lightness wheel's achromatic branch is what makes this hold for it.
9. **Gamut map oracle:** `gamutMapOklch` agrees with `culori.toGamut('rgb','oklch')` to ΔE_OK 0.001
   over a few thousand random triples, including hues around 264° where the sRGB gamut is not
   star-shaped in Oklab.
10. **Registry safety:** `getColorWheel('toString' as never)` throws or returns the default, never
    `Object.prototype.toString`.
11. **Saturated bases in every test.** Muted bases give the same answer under every wheel; a suite
    built on them passes whether or not the feature works.

Surface tests: the web tool passes `wheel` through and omits it from share URLs when default; the ring
component renders 72 stops and places nodes at the given angles (a wheel with a non-identity table
places the complementary node off 180° of the ring's HSV angle); the bot handler maps the option and
rejects an invalid value; the OG guard accepts `wheel=ryb`, rejects `wheel=cmyk`, and the harmony
route's slots change when it is set. The web-app locale-parity gate and the bot's reverse-key gate
cover the strings.

## 7. Rollout and versions

One PR. Package bumps: `core` minor (new exports, new slot field), `svg` minor (optional card prop),
`bot-logic` minor, `web-app` minor, `discord-worker` and `og-worker` per their conventions. Layman's
changelogs: product-level, web-app and discord-worker, each describing the surface it actually changes
(the bot gains an option and a card token; the page gains a control and a re-painted ring; both
gain different dyes when a non-default wheel is chosen).

The PR also adds `packages/core/NOTICE` (§2.3) and the generator script; the `real.dat` download is
a one-time manual step documented in the script header, not a build dependency.

Follow-ups outside this spec: the opponent (Hering) wheel as a later spike; a spectral-complement
toggle on Complementary once PR #164's spectral fix lands; a warm/cool overlay.

## 8. Open items for review

- English blurbs in §1 — wording to approve before translation.
- Ring lightness for `oklch-lightness` stops: `L = 0.65` proposed.
- Stop count: 72 for every ring (two JND between anchors for OKLCH; more than enough for RYB).
- Whether `oklch-lightness` should also carry the base's lightness *exactly* for near-white and
  near-black bases, or clamp toward mid-tones when the rotated hue has no chroma at that lightness. The
  CSS gamut map already reduces chroma to whatever fits; the proposal is to accept that.
- Munsell sample point V=6/C=8: chosen because it is the one value/chroma present for all 40 hues in
  `real.dat`; a different point would shift some hues by a few degrees. Recorded, not open.
- `opponent` is a later candidate id, not registered here.
