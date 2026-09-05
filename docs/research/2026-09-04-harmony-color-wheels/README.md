# Harmony Explorer — Selectable Colour Wheels

**Date:** 2026-09-04 · **Base commit:** `1c017aea` · **Scope:** feature research, no code changed.

The Harmony Explorer rotates hue on the plain sRGB/HSV wheel. Classical harmony rules (Itten's) were
written for the artist's RYB wheel, Adobe Color silently computes on RYB, and perceptual wheels
(OKLCH) are the modern alternative. This folder asks which wheels are worth letting the player choose,
what each would change, and how to build it without re-forking the three surfaces that PR #159 unified.

## Documents

| | |
|---|---|
| [00-current-state.md](./00-current-state.md) | What "the wheel" is in the code today, what already exists in core, and the constraints |
| [01-artist-pigment-wheels.md](./01-artist-pigment-wheels.md) | RYB (three competing models), Munsell, NCS/Hering, PCCS, Ostwald and friends |
| [02-perceptual-wheels.md](./02-perceptual-wheels.md) | OKLCH, CIELCH, HCT, IPT/ICtCp/Jzazbz, unique hues, gamut mapping, ring rendering |
| [03-device-subtractive-wheels.md](./03-device-subtractive-wheels.md) | Why CMYK, HSL, HWB and the vectorscope are not second wheels; warm/cool; mixing-defined wheels |
| [04-precedent-survey.md](./04-precedent-survey.md) | 30+ tools: which wheels they use, whether users can switch, what the control is called |
| [05-implementation-design.md](./05-implementation-design.md) | The abstraction, library landscape with sizes and licences, test contract, and the stakes measured |
| [06-recommendation.md](./06-recommendation.md) | **The synthesis:** candidate matrix, reconciled disagreements, design sketch, traps, decisions |
| [probes/](./probes/) | The scripts behind every number quoted, runnable from this folder with `node` |

Start with [06-recommendation.md](./06-recommendation.md).

## Headline

- **Recommend a `Color wheel` selector: `RGB (screen)` as the unchanged default and `RYB (artist's)`
  as the opt-in, with `OKLCH` designed for as a second increment.** Everything else researched is the
  same circle renamed (CMYK, HSL, HWB), a worse near-duplicate (CIELCH, HSLuv, HCT, IPT), licence-blocked
  (Munsell data, NCS, PCCS) or a research project (Coloroid, mixing-defined wheels).
- **Material, not cosmetic:** the RYB wheel changes the chosen partner dye in **45.3 %** of the 625
  dye × harmony slots measured, by a mean CIEDE2000 of 15; OKLCH rotation changes 61.6 %.
- **Small to build:** a pair of monotone hue maps in core, a three-line change in the one shared
  selector, ring stops and node angles from the same functions. No new runtime dependency; the RYB
  wheel is 25 integer pairs.
- **A real differentiator:** no other game-dye tool offers a selectable harmony wheel; the only one
  with harmony at all (Warframe) has a fixed wheel.
- **Four hard requirements** so the feature cannot quietly lie: assert the RYB table by value (red's
  complement ≈ 138°, yellow at 60°), paint the ring from the same function as the geometry, prove every
  hue map monotone at module load, and carry the wheel in share URLs, the `/harmony` option, the OG
  parameter and a card token.

## Decisions needed

1. RYB mapping — Adobe-parity table (recommended) or core's existing mixer model.
2. Release-1 scope — RGB + RYB (recommended) or include the OKLCH warp.
3. OKLCH flavour later — hue warp keeping the base's saturation/value (recommended) or constant-L/C
   rotation, which is a separate "keep lightness" product decision.
4. English labels and blurbs to translate into the other five locales.
5. Whether the Japanese-audience case for a Munsell (JIS) wheel justifies a data-licence call.

## Method

Five parallel research passes (artist wheels, perceptual wheels, device wheels, precedent survey,
implementation) with web sources listed at the end of each document, every claim tagged as fetched,
derived or unverified. All quantitative claims were reproduced from this repository's dye data with the
scripts in `probes/`; the outputs sit beside them as `*.output.txt`.
