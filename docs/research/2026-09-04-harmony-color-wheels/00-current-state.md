# 00 — What the Harmony Explorer's wheel is today

**Date:** 2026-09-04 · **Base commit:** `1c017aea` · **Read-only survey of the tree; no code changed.**

This note pins down what "the colour wheel" currently means in the code, which surfaces draw one, and
what already exists that a selectable-wheel feature could reuse. Everything here was read from the
source at the base commit; file paths are relative to `xivdyetools/`.

---

## 1. One algorithm, three surfaces

Since the harmony convergence (PR #159, 2026-09-03) every surface calls the same pure function,
`generateHarmonySlots()` in `packages/core/src/services/dye/HarmonySelector.ts`:

| Surface | Entry point | Draws a wheel ring? |
|---|---|---|
| Web app | `apps/web-app/src/components/harmony-tool.ts` → `v4-color-wheel` | **Yes** — CSS `conic-gradient` |
| Discord `/harmony` | `packages/bot-logic/src/commands/harmony.ts` → `packages/svg/src/harmony-card.ts` | **No** — the card's header comment says the wheel was removed as "160,000 pixels saying less" than the swatch rows |
| OpenGraph card | `apps/og-worker/src/services/svg/harmony.ts` | **No** |

So a wheel change has exactly one *rendering* site and one *geometry* site. The resvg constraint
(SVG has no conic gradients) would only matter if a ring were reintroduced on the cards.

## 2. The geometry: HSV hue plus a table of offsets

```ts
// packages/core/src/constants/index.ts
export const HARMONY_OFFSETS: Record<string, number[]> = {
  complementary: [180],           analogous: [30, 330],
  triadic: [120, 240],            'split-complementary': [150, 210],
  tetradic: [60, 180, 240],       'inverted-tetradic': [120, 180, 300],
  square: [90, 180, 270],         monochromatic: [0],
  compound: [30, 180, 330],       shades: [15, 345],
};
```

For each offset, `generateHarmonySlots` does, in order:

1. `baseHsv = hexToHsv(baseHex)` — **sRGB/HSV hue**: red 0°, yellow 60°, green 120°, cyan 180°,
   blue 240°, magenta 300°.
2. `targetHue = (baseHsv.h + offset) % 360`.
3. `targetHex = hsvToHex(targetHue, baseHsv.s, baseHsv.v)` — the ideal carries the **base's saturation
   and value** onto the rotated hue. This is deliberate and load-bearing: it is why a desaturated base
   finds desaturated dyes.
4. Rank the caller-filtered candidate dyes against `targetHex` by the configured ΔE (default
   CIEDE2000) when `usePerceptualMatching` is on, else by angular HSV-hue distance. Facewear is never a
   candidate.

The slot carries `targetHue`, `targetHex`, the chosen `dye`, its `deviance`, and `companions`.

**Consequence for a wheel feature.** "Which wheel" only touches steps 1–3: how a hex becomes an angle,
how an angle plus the base's other coordinates becomes a target hex. Ranking (step 4) can stay exactly
as it is. A wheel is therefore a pair of functions plus a ring painter, not a new selector.

## 3. What already exists in core

| Capability | Where | Status |
|---|---|---|
| `HarmonyColorSpace = 'hsv' \| 'oklch' \| 'lch' \| 'hsl'` with `rotateHueInSpace()` | `services/dye/HarmonyGenerator.ts` | **Unreachable in production.** Only the `DyeService` façade calls `HarmonyGenerator`, and nothing in the monorepo calls those methods. Survives as published npm API. Its OKLCH/LCH branches rotate at fixed L/C and hand the (possibly out-of-gamut) result to the k-d tree with no gamut mapping. |
| HSV, HSL, OKLCH, CIELCH(ab), OKLab, CIELab, CMYK converters | `services/color/ColorConverter.ts` | Live, tested, published |
| `rgbToRyb` / `rybToRgb` | `blending/conversions.ts` (also on `ColorService`) | Live — powers the mixer's "Paint" (RYB) mode. It is a **chromatic-decomposition** model (white removed, `G = y`, blue/yellow trade for green), with a documented exact inverse. It is *not* the Gossett–Chen cube and defines no hue angle of its own. |
| `spectral.js` (Kubelka–Munk) | core dependency | Live — mixer "Spectral" mode |
| Matching methods `ciede2000 \| oklab \| cie76 \| redmean \| rgb \| distinguish` | `ColorService.getDistanceForMethod` | Live on every surface |

## 4. The ring and the nodes (web app only)

`apps/web-app/src/components/v4/v4-color-wheel.ts`:

- Ring: `conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)` under a radial mask —
  the plain sRGB wheel, six stops.
- Nodes are placed at the **ideal angles**, `baseHue + offset`, where `baseHue` is the component's own
  `hexToHue()` (HSV) and the offsets come from a **private copy** of the table (`getHarmonyAngles()`,
  hand-mirrored from `HARMONY_OFFSETS` with a comment saying they must agree). Each node is filled with
  the *found* dye's hex. Coincident angles are staggered inward (`depth`).
- A node click finds the nearest dye to the node colour and makes it the new base.

Two things follow. First, on a non-RGB wheel the ring, the node angles and the base spoke all have to
come from the *same* hue function or the picture lies; the cleanest fix is for the wheel to consume
`HarmonySlot.targetHue` from core instead of re-deriving angles. Second, the ring itself is a six-stop
gradient: any wheel whose hue is a warp of HSV hue can be drawn by moving those stops, and any wheel
that is not needs a multi-stop gradient.

## 5. Existing UI and URL surface

- **Settings sidebar** (`apps/web-app/src/components/v4/config-sidebar.ts`, `renderHarmonyConfig()`):
  harmony-type `<select>`, "strict matching" toggle, matching-method `<select>` (shown when strict),
  companion count. The **gradient tool already has a colour-space `<select>`** (OKLCH / HSV / LAB / LCH /
  RGB with one-line descriptions, keys `config.colorSpace*`), and the **mixer has a mixing-mode
  `<select>`** (Spectral / RYB labelled "Paint" / OKLAB / LAB / HSL / RGB). A wheel selector has two
  in-house precedents to copy, including the vocabulary "Paint" for RYB.
- **Share URL:** `?dye=&harmony=&algo=&perceptual=&v=1`, read in `harmony-tool.ts` around line 433.
  Unknown values are normalised loudly to defaults. An absent parameter must keep meaning "RGB wheel".
- **Discord `/harmony` options** (`apps/discord-worker/src/commands/schemas.ts`): `color`, `type`,
  `companions`, `matching`, `strict_matching`, `prevent_duplicates`. Adding a `wheel` choice option is
  additive; Discord caps a command at 25 options and a choice list at 25 entries.
- **Localisation:** six locales; harmony type names come from `LanguageService.getHarmonyType()`;
  a locale-parity gate fails CI on a missing key.

## 6. Prior research this builds on

`docs/research/2026-09-03-algorithm-fact-check/05-harmony-geometry.md` already established:

- The offsets are Itten's, defined on a **twelve-hue RYB wheel**; the tool applies them to HSV hue.
  Red's traditional complement (green) sits at 180° RYB but ≈120° HSV, so "complementary" from red
  lands on cyan, not the artist's green. The gap applies to every offset.
- "There is **no colorimetric standard for an RYB wheel** — every software RYB parameterisation is ad
  hoc, and published conversion tables disagree at intermediate points even when they agree at the
  primaries."
- Complementarity "is a fact about a *wheel*, not about colour": Itten/Goethe say green, Munsell
  blue-green, Ostwald sea-green, RGB cyan.
- Recommendation there: prefer OKLCH over HSL where a rotation space is chosen; label the schemes as
  artistic tradition, not science; analogous and monochromatic are the two rules with empirical support.

A selectable wheel is the natural way to honour that note without picking one answer for everyone:
it makes the wheel an explicit, named choice instead of an unstated assumption.

## 7. Constraints that shape the design

- **Determinism across surfaces.** Web, bot and OG card must produce identical slots for identical
  inputs, so the wheel functions belong in core, pure, DOM-free, and covered by a golden test.
- **Backwards compatibility.** Existing share links, saved presets and the bot's default must keep
  producing today's results. The RGB wheel has to reproduce current output bit-for-bit.
- **Bundle budgets.** The Discord worker sits near Cloudflare's 3 MiB gzip cap
  (~2.6 MiB at last measure); the web app has a size gate. Any new colour library is a cost to justify.
- **125 fixed targets.** The output is always one of 125 dyes, so a wheel only matters where it moves
  the nearest-dye decision. "How many (dye × harmony) pairs change partner" is the right measure of
  whether a wheel is material or cosmetic — see `05-implementation-design.md`.
