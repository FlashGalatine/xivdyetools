# Methodology

**Date:** 2026-09-03 · **Base commit:** `876cfc2f` (origin/main) · **Package:** `@xivdyetools/core` 4.3.0

## What was checked

Every algorithm core exposes for **mixing** two colours and for **matching** a colour against the dye
set, plus the colour-space conversions they stand on.

| Area | Symbols |
|---|---|
| Conversions | `rgbToXyz`, `rgbToLab`, `labToRgb`, `rgbToOklab`, `oklabToRgb`, `rgbToOklch`, `rgbToHsl`/`hslToRgb` |
| Matching | `getDeltaE76`, `getDeltaE2000`, `getDeltaE_Oklab`, `getDeltaE_OklchWeighted`, `getRedmeanDistance`, `getColorDistance`, `getDistinguishabilityPercent`, `DyeSearch.calculateDistance`, `KDTree` |
| Mixing (API 1) | `ColorService.mixColors{Rgb,Lab,Oklab,Ryb,Hsl,Spectral}` → `RybColorMixer`, `SpectralMixer` |
| Mixing (API 2) | `blending/blendColors()` → `blendRGB/LAB/OKLAB/RYB/HSL/Spectral` + `blending/conversions.ts` |
| Harmony geometry | `HarmonyGenerator` hue offsets, `rotateHueInSpace` |

Explicitly **out of scope**: `ColorblindnessSimulator`, `ColorAccessibility` (WCAG contrast),
`CharacterColorService`, the locale pipeline. They are neither mixing nor matching.

## How claims were established

Three independent lines of evidence, in decreasing order of authority:

1. **Against the published definition.** Each implementation was read line by line against the primary
   source for that algorithm (CIE 15:2004, CIE 142-2001, Sharma-Wu-Dalal 2005, Ottosson 2020,
   Gossett & Chen, Kubelka & Munk 1931). See [01-matching-algorithms.md](./01-matching-algorithms.md)
   and [02-mixing-algorithms.md](./02-mixing-algorithms.md) for the citation-by-citation comparison.

2. **Against algebraic laws the code must obey regardless of model.** These do not depend on which
   colour model is "right" — any mixing function must satisfy them:
   - **Identity**: `mix(A, B, 0) == A` and `mix(A, B, 1) == B`
   - **Commutativity**: `mix(A, B, 0.5) == mix(B, A, 0.5)`
   - **Idempotence**: `mix(A, A, t) == A`
   - **Round-trip**: `toSpace(fromSpace(c)) == c` for any invertible conversion
   A violation is a defect on its own terms, with no appeal to the literature needed.

3. **Against the other implementation of the same thing.** Where two code paths claim the same named
   mode, they were run head to head. Divergence proves at least one is wrong without having to say which.

A finding is only recorded as a defect when it has an executable probe behind it. Reasoning that was not
confirmed by running code is marked *Open* in [03-findings.md](./03-findings.md) rather than asserted.

## Probes

`probes/` holds the five scripts that produced every number quoted in the findings.

| Probe | Establishes |
|---|---|
| `01-blend-modes.mts` | All six modes × six canonical pigment pairs at 50/50; K/S sanity table |
| `02-surface-divergence.mts` | Bot API vs web API, same mode, same inputs |
| `03-numeric-checks.mts` | ε/κ rounding error; the two `rgbToLab`s; Oklch hue-term ratio; RYB round-trip ΔE₀₀; matching-method disagreement rate |
| `04-algebraic-laws.mts` | Identity and commutativity across 2 500 / 1 600 dye pairs per mode |
| `05-spectral-gradient.mts` | The full 11-stop spectral gradient, both implementations |

### Running them

The probes import core's TypeScript sources directly and need an **installed** checkout
(`node_modules` present). A freshly created git worktree has none — run them from the main checkout, or
`pnpm install` in the worktree first.

```bash
cd docs/research/2026-09-03-algorithm-fact-check/probes
npx tsx 05-spectral-gradient.mts
```

They must be `.mts` (not `.ts`): `@xivdyetools/types` publishes an `import`-only exports map, so tsx
resolving the file as CJS fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. `@xivdyetools/types` and
`@xivdyetools/logger` must be built first (`pnpm turbo run build --filter=@xivdyetools/types
--filter=@xivdyetools/logger`).

The outputs quoted throughout were captured from the main checkout at `876cfc2f`.

## Deliberate limits

- **No code was changed.** This pass is research and proposal only; the changes are set out in
  [04-proposed-changes.md](./04-proposed-changes.md) for a separate decision.
- **The dye set is the population.** Where a probe reports a rate ("53 % of pairs"), the population is
  the shipped 125-dye set or pseudo-random sRGB, stated per probe — not a claim about all colours.
- **"Correct" means "matches the published definition".** Where the literature itself is contested
  (RYB's status as a pigment model, whether harmony offsets have empirical support), the documents say
  so rather than picking a side.
