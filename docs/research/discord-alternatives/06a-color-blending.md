# Shared Libraries — `@xivdyetools/color-blending`

**Parent document:** [06-shared-libraries.md](./06-shared-libraries.md)

Covers: Package scope, API surface, color space conversions, extraction plan, testing.

---

## Purpose

Six color blending algorithms as pure functions. Used by the `/mixer` and `/gradient` commands to blend two colors in different perceptual color spaces. Each mode produces visually distinct results — from simple RGB averaging to physics-based Kubelka-Munk pigment simulation.

This is the **first package to extract** because it is entirely self-contained: one source file (`discord-worker/src/services/color-blending.ts`), all pure functions, zero I/O, zero platform dependencies.

---

## Current Location

**Source:** `xivdyetools-discord-worker/src/services/color-blending.ts` (582 lines)

**Current imports:**
- `ColorService` from `@xivdyetools/core` — used only for `hexToRgb()` (converting input hex strings to `{r, g, b}`)
- `BlendingMode` from `../types/preferences.js` — the type union `'rgb' | 'lab' | 'oklab' | 'ryb' | 'hsl' | 'spectral'`

**Current consumers:**
- `handlers/commands/mixer-v4.ts` — uses `blendColors()` and `getBlendingModeDescription()`
- `handlers/commands/gradient.ts` (indirectly, via SVG gradient generation)
- `services/svg/dye-info-card.ts` — imports `rgbToLab()` for LAB color display

---

## Package API

### Types

```typescript
export interface RGB {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
}

export interface LAB {
  l: number;  // Lightness: 0-100
  a: number;  // Green–Red: ~-128 to +128
  b: number;  // Blue–Yellow: ~-128 to +128
}

export interface HSL {
  h: number;  // Hue: 0-360
  s: number;  // Saturation: 0-1
  l: number;  // Lightness: 0-1
}

export interface BlendResult {
  hex: string;  // e.g., '#8B4513'
  rgb: RGB;
}

export type BlendingMode = 'rgb' | 'lab' | 'oklab' | 'ryb' | 'hsl' | 'spectral';
```

### Functions

```typescript
/**
 * Blend two colors using the specified blending mode.
 *
 * @param hex1 - First color hex code (with or without #)
 * @param hex2 - Second color hex code (with or without #)
 * @param mode - Blending algorithm to use
 * @param ratio - Blend ratio: 0.0 = all hex1, 0.5 = equal mix, 1.0 = all hex2
 * @returns Blended color as hex + RGB
 */
export function blendColors(hex1: string, hex2: string, mode: BlendingMode, ratio?: number): BlendResult;

/**
 * RGB to CIELAB conversion.
 * Exported because dye-info-card.ts uses it for LAB display values.
 */
export function rgbToLab(rgb: RGB): LAB;

/**
 * Get a human-readable description of a blending mode.
 */
export function getBlendingModeDescription(mode: BlendingMode): string;
```

### Internal (not exported)

All individual blend functions and color space conversions remain internal:

| Function | Purpose |
|----------|---------|
| `blendRGB(rgb1, rgb2, t)` | Simple additive channel averaging |
| `blendLAB(rgb1, rgb2, t)` | Perceptually uniform CIELAB blending |
| `blendOKLAB(rgb1, rgb2, t)` | Modern perceptual (fixes LAB's blue→purple issue) |
| `blendRYB(rgb1, rgb2, t)` | Traditional artist's color wheel mixing |
| `blendHSL(rgb1, rgb2, t)` | Hue-Saturation-Lightness interpolation with shortest-arc hue wrapping |
| `blendSpectral(rgb1, rgb2, t)` | Kubelka-Munk reflectance-based pigment simulation |
| `rgbToOklab` / `oklabToRgb` | OKLAB↔RGB conversion matrices |
| `rgbToRyb` / `rybToRgb` | RYB↔RGB approximate conversion (whiteness removal + normalization) |
| `rgbToHsl` / `hslToRgb` | HSL↔RGB with proper hue sector handling |
| `labToRgb` | LAB→XYZ→RGB with D65 illuminant |
| `rgbToReflectance` / `reflectanceToRgb` | Linear 0-1 reflectance ↔ 0-255 RGB |
| `reflectanceToKS` / `ksToReflectance` | Kubelka-Munk K/S ratio conversion: `(1-R)²/(2R)` |
| `rgbToHex` | Internal hex formatting |

---

## Blending Mode Reference

| Mode | Color Space | Description | Best For |
|------|------------|-------------|----------|
| `rgb` | RGB | Linear channel averaging | Quick preview, technical mixing |
| `lab` | CIELAB | Perceptually uniform blending via D65 XYZ | General-purpose perceptual mixing |
| `oklab` | OKLAB | Modern perceptual (Björn Ottosson, 2020) | Blue–green blends (fixes LAB's purple artifact) |
| `ryb` | RYB | Artist's color wheel via whiteness extraction | Painterly results (red+yellow=orange, not brown) |
| `hsl` | HSL | Shortest-arc hue interpolation | Preserving saturation while shifting hue |
| `spectral` | Reflectance | Kubelka-Munk pigment physics simulation | Most realistic physical mixing |

### Visual Comparison

Mixing **Pure White** (`#ECECEC`) and **Jet Black** (`#3B3B3B`) at ratio 0.5:

| Mode | Result | Notes |
|------|--------|-------|
| RGB | `#939393` | Arithmetic mean of each channel |
| LAB | `#8F8F8F` | Slightly darker (perceptual midpoint ≠ arithmetic midpoint) |
| OKLAB | `#909090` | Similar to LAB, better hue preservation |
| RYB | `#939393` | Identical to RGB for achromatic colors |
| HSL | `#939393` | Identical to RGB for achromatic colors |
| Spectral | `#8B8B8B` | Darkest — pigment mixing is subtractive |

The differences become dramatic with saturated colors (e.g., `#FF0000` + `#0000FF`):

| Mode | Result | Notes |
|------|--------|-------|
| RGB | `#800080` | Purple (channel average) |
| LAB | `#CA0089` | Magenta-pink (LAB's known blue→purple bias) |
| OKLAB | `#C6006B` | Pinkish-red (corrects LAB's bias) |
| RYB | `#800080` | Purple (approximate) |
| HSL | `#FF00FF` | Bright magenta (full saturation preserved) |
| Spectral | `#5F004F` | Dark purple (subtractive, like real paint) |

---

## Dependencies

```
@xivdyetools/core
        |
        v
@xivdyetools/color-blending
```

**Runtime dependency:** `@xivdyetools/core` — only for `ColorService.hexToRgb()`. This is a thin function that parses a hex string to `{r, g, b}`. If needed, this dependency could be eliminated by inlining the 5-line hex parser, but keeping it maintains consistency with how the rest of the codebase handles hex↔RGB.

**Dev dependencies:** `vitest`, `@xivdyetools/test-utils`

---

## Type Promotion: `BlendingMode`

The `BlendingMode` type currently lives in `discord-worker/src/types/preferences.ts`. Since both bots need this type, it should be promoted to **either**:

1. **`@xivdyetools/types`** — alongside other shared types (preferred, since `MatchingMethod`, `Gender`, `UserPreferences`, etc. also need promotion)
2. **This package** — exported as `BlendingMode`, re-exported by `@xivdyetools/types`

**Recommendation:** Define `BlendingMode` in this package (it's most semantically coupled to blending), and re-export it from `@xivdyetools/types` for convenience.

The related `BLENDING_MODES` array (with display names and descriptions) and `isValidBlendingMode()` validator should also move here, since they describe blending behavior:

```typescript
export const BLENDING_MODES: Array<{ value: BlendingMode; name: string; description: string }> = [
  { value: 'rgb', name: 'RGB', description: 'Additive channel averaging (default)' },
  { value: 'lab', name: 'LAB', description: 'Perceptually uniform CIELAB blending' },
  { value: 'oklab', name: 'OKLAB', description: 'Modern perceptual (fixes LAB blue→purple)' },
  { value: 'ryb', name: 'RYB', description: "Traditional artist's color wheel" },
  { value: 'hsl', name: 'HSL', description: 'Hue-Saturation-Lightness interpolation' },
  { value: 'spectral', name: 'Spectral', description: 'Kubelka-Munk physics simulation' },
];

export function isValidBlendingMode(mode: string): mode is BlendingMode {
  return BLENDING_MODES.some((m) => m.value === mode);
}
```

---

## Extraction Plan

### Step 1: Create the package

```
xivdyetools-color-blending/
  src/
    index.ts          ← Re-exports public API
    blending.ts       ← blendColors(), getBlendingModeDescription()
    conversions.ts    ← rgbToLab(), labToRgb(), rgbToOklab(), etc.
    types.ts          ← BlendingMode, BlendResult, RGB, LAB, HSL
    spectral.ts       ← Kubelka-Munk functions (reflectanceToKS, ksToReflectance, etc.)
  tests/
    blending.test.ts
    conversions.test.ts
    spectral.test.ts
  package.json
  tsconfig.json
  vitest.config.ts
```

**Alternative:** Keep it as a single `index.ts` file (the current source is only 582 lines). Split into multiple files only if it grows.

### Step 2: Move existing tests

The Discord Worker likely has tests for blending in its test suite. These migrate to the package's test suite.

### Step 3: Update Discord Worker imports

```typescript
// Before:
import { blendColors, rgbToLab, getBlendingModeDescription } from '../services/color-blending.js';
import type { BlendingMode } from '../types/preferences.js';

// After:
import { blendColors, rgbToLab, getBlendingModeDescription } from '@xivdyetools/color-blending';
import type { BlendingMode } from '@xivdyetools/color-blending';
```

### Step 4: Remove old file

Delete `discord-worker/src/services/color-blending.ts` and update all imports.

---

## Testing

### Unit Tests

Each blending mode should be tested with:

1. **Known color pairs** — verify output matches hand-calculated expected values
2. **Boundary ratios** — `ratio=0` returns hex1, `ratio=1` returns hex2
3. **Midpoint** — `ratio=0.5` produces a reasonable middle value
4. **Achromatic colors** — black/white/gray (where some modes produce identical results)
5. **Saturated complementary colors** — red+blue, red+green (where modes diverge most)

### Conversion Tests

- `rgbToLab → labToRgb` round-trip should return original RGB within ±1 (rounding)
- `rgbToOklab → oklabToRgb` same round-trip property
- `rgbToRyb → rybToRgb` approximate round-trip (RYB is lossy)
- `rgbToHsl → hslToRgb` round-trip within ±1

### Edge Cases

- Hex with/without `#` prefix
- 3-digit shorthand hex (should work after `blendColors` normalizes via `ColorService.hexToRgb`)
- Ratio clamping: negative ratios clamp to 0, ratios >1 clamp to 1
- Identical colors: all modes should return the same color unchanged
- Pure black (`#000000`) and pure white (`#FFFFFF`) handling in Kubelka-Munk (avoid division by zero via `Math.max(0.001, ...)`)

---

## Relationship to `@xivdyetools/core`

Core already has color conversion functions in its `ColorService` — including `hexToRgb`, `rgbToHsv`, `rgbToLab`, `rgbToOklab`, etc. There is some **overlap** between core's conversions and this package's internal conversions.

**Why not just use core's conversions?**

The color-blending module's conversions are **self-contained implementations** optimized for the blending pipeline. They use internal `RGB`, `LAB`, `HSL` interfaces that are simpler than core's types. Coupling every internal conversion to core's API would:

1. Add import complexity for what are fundamentally local helper functions
2. Risk breakage if core refactors its color conversion internals
3. Not reduce code — the implementations are identical, just 5-10 lines each

**What we DO share:** `ColorService.hexToRgb()` for the initial hex→RGB parsing at the `blendColors()` entry point. This is the only external dependency.

**Public export overlap:** `rgbToLab()` is exported from this package because `dye-info-card.ts` needs it. Core also exports a LAB conversion. The implementations are identical (both use the D65 illuminant and standard sRGB linearization). Consumers should prefer this package's export when working with blending-related code, and core's export when working with dye matching/database code. A future consolidation into core is possible but not urgent.
