# Color Spaces & Mixing Algorithms Research

**Status**: Research Document
**Date**: January 2026
**Author**: XIV Dye Tools Team

---

## Executive Summary

This document explores color space and mixing algorithm options for expanding the XIV Dye Tools **Gradient Builder** and **Dye Mixer** tools. Based on research into modern color science and existing implementations, we recommend:

1. **Priority 1**: Add OKLAB/OKLCH support (modern perceptual standard)
2. **Priority 2**: Add LCH interpolation for gradients (cylindrical LAB)
3. **Priority 3**: Consider Spectral.js integration for realistic paint mixing
4. **Priority 4**: HSL mixing mode (simple, intuitive)

---

## 1. Current Implementation

### ColorService (xivdyetools-core)

| Feature | Status | Location |
|---------|--------|----------|
| RGB ↔ Hex | ✅ Cached | ColorConverter.ts |
| RGB ↔ HSV | ✅ Cached | ColorConverter.ts |
| RGB ↔ LAB | ✅ Cached | ColorConverter.ts |
| RGB ↔ RYB | ✅ Gossett-Chen | RybColorMixer.ts |
| DeltaE CIE76 | ✅ | ColorConverter.ts |
| DeltaE CIEDE2000 | ✅ | ColorConverter.ts |
| **RGB ↔ OKLAB** | ❌ Missing | - |
| **RGB ↔ LCH** | ❌ Missing | - |
| **RGB ↔ HSL** | ❌ Missing | - |

### Mixing Modes (Mixer Tool)

| Mode | Status | Behavior |
|------|--------|----------|
| RGB | ✅ `mixColorsRgb()` | Additive light mixing (Blue + Yellow = Gray) |
| LAB | ✅ `mixColorsLab()` | Perceptual mixing (may produce pink for B+Y) |
| RYB | ✅ `mixColorsRyb()` | Subtractive paint mixing (Blue + Yellow = Green) |
| **OKLAB** | ❌ Missing | Modern perceptual (B+Y = Green via correct hue path) |
| **HSL** | ❌ Missing | Hue averaging (B+Y = Neon Green) |

### Interpolation Modes (Gradient Tool)

| Mode | Status | Behavior |
|------|--------|----------|
| RGB | ✅ | Linear interpolation (muddy midpoints) |
| HSV | ✅ | Hue wheel interpolation |
| **LAB** | ❌ Missing | Perceptual interpolation |
| **OKLAB/OKLCH** | ❌ Missing | Modern perceptual (best gradients) |
| **LCH** | ❌ Missing | Cylindrical LAB with hue control |

---

## 2. Color Space Options Analysis

### 2.1 OKLAB/OKLCH (Recommended)

**What it is**: A perceptually uniform color space developed by Björn Ottosson (2020) that fixes issues with CIELAB, particularly for blue colors.

**Why it matters for XIV Dye Tools**:
- **Gradients**: Produces smooth, vivid gradients without muddy midpoints
- **Mixing**: Blue + Yellow naturally produces Green (correct hue path)
- **Modern Standard**: Now supported in CSS Color Level 4, all major browsers

**Blue + Yellow Test Results** (from Research_GoogleGemini.pdf):

| Color Space | Result | Quality |
|-------------|--------|---------|
| RGB | Gray | ❌ Incorrect |
| HSL | Neon Green | ⚠️ Over-saturated |
| LAB | Pink/Purple | ❌ Incorrect (red bias of sRGB blue) |
| LCH | Pink/Orange | ❌ Shortest path goes through red |
| **OKLCH** | **Green** | ✅ Correct |
| RYB | Dark Green | ✅ Correct (already implemented) |

**Implementation Complexity**: Medium
- Conversion formulas are well-documented
- Color.js library provides reference implementation
- ~100-150 lines of TypeScript

### 2.2 LCH (Cylindrical LAB)

**What it is**: LAB expressed in cylindrical coordinates (Lightness, Chroma, Hue angle).

**Why it matters**:
- **Hue Control**: Allows specifying hue interpolation direction (shortest/longest path)
- **Gradient Options**: User can choose whether to go "through red" or "through green"
- **Familiar Model**: Similar to HSV but perceptually uniform

**Implementation Complexity**: Low
- LAB → LCH is simple trigonometry
- ~30-40 lines of TypeScript
- Builds on existing LAB support

### 2.3 HSL (Hue-Saturation-Lightness)

**What it is**: Cylindrical RGB transformation (similar to HSV but with Lightness instead of Value).

**Why it matters**:
- **User Familiarity**: Common in design tools (Photoshop, Figma)
- **Simple Mixing**: Average hue angles for intuitive results
- **Fast**: No complex color space conversion

**Blue + Yellow Result**: Neon Green (Hue 150°)
- Technically green, but over-saturated
- May be useful for some artistic effects

**Implementation Complexity**: Very Low
- Similar to existing HSV code
- ~50 lines of TypeScript

### 2.4 Spectral/Kubelka-Munk

**What it is**: Physics-based paint mixing that models light absorption and scattering through pigment layers.

**Why it matters**:
- **Most Realistic**: Produces results identical to real paint mixing
- **Dynamic Results**: Different pigments produce different greens (warm vs cool)
- **Library Available**: Spectral.js (MIT license, ~8KB gzipped)

**Implementation Options**:
1. **Spectral.js Integration**: Import library, minimal code
2. **Custom Implementation**: More control, larger codebase

**Implementation Complexity**: Low (with library) / High (custom)

**Decision**: ✅ Add Spectral.js as a dependency for "Realistic Paint" mixing mode.

**Integration Approach**:
```typescript
// SpectralMixer.ts wrapper
import spectral from 'spectral.js';

export class SpectralMixer {
  static mixColors(hex1: string, hex2: string, ratio: number = 0.5): HexColor {
    const rgb1 = ColorConverter.hexToRgb(hex1);
    const rgb2 = ColorConverter.hexToRgb(hex2);
    const mixed = spectral.mix(
      [rgb1.r, rgb1.g, rgb1.b],
      [rgb2.r, rgb2.g, rgb2.b],
      ratio
    );
    return ColorConverter.rgbToHex(mixed[0], mixed[1], mixed[2]);
  }
}
```

### 2.5 CAM16 / JzAzBz (Not Recommended)

**What they are**: Advanced color appearance models used in Material Design and HDR applications.

**Why not recommended for XIV Dye Tools**:
- **Overkill**: OKLAB provides 90% of the benefit at 10% complexity
- **HDR Focus**: JzAzBz optimized for wide gamut, not needed for sRGB game colors
- **Implementation Complexity**: Very High

---

## 3. Recommendations by Tool

### 3.1 Gradient Builder (gradient-tool.ts)

**Current**: RGB, HSV interpolation

**Recommended Additions** (in priority order):

1. **OKLCH Interpolation** (Priority 1)
   - Perceptually smooth gradients
   - No muddy midpoints
   - Correct hue transitions

2. **LAB Interpolation** (Priority 2)
   - Already have LAB conversion
   - Good fallback for browsers without OKLCH support

3. **LCH with Hue Direction** (Priority 3)
   - Advanced option for users who want control
   - "Shortest path" vs "Longest path" toggle

**UI Suggestion**: Keep current RGB/HSV toggle, add "Perceptual (OKLCH)" option.

### 3.2 Dye Mixer (mixer-tool.ts)

**Current**: RGB, LAB, RYB mixing modes

**Recommended Additions** (in priority order):

1. **OKLAB Mixing** (Priority 1)
   - Replace or supplement LAB mode
   - Better results for complementary colors
   - Label: "Perceptual" or "OKLAB"

2. **HSL Mixing** (Priority 2)
   - Simple hue averaging
   - Familiar to designers
   - Label: "HSL (Hue Average)"

3. **Spectral Mixing** (Priority 3)
   - Optional "Realistic Paint" mode
   - Requires Spectral.js dependency
   - Label: "Realistic Paint" or "Pigment Mix"

**UI Suggestion**:
- Rename current modes for clarity:
  - "RGB" → "Light Mix (RGB)"
  - "LAB" → "Perceptual (OKLAB)" [after implementation]
  - "RYB" → "Paint Mix (RYB)"

---

## 4. Implementation Estimates

### Phase 1: OKLAB/OKLCH Support (Core)

**Files to modify**:
- `xivdyetools-core/src/services/color/ColorConverter.ts`
- `xivdyetools-core/src/services/ColorService.ts` (facade methods)
- `xivdyetools-core/src/types/index.ts` (OKLAB/OKLCH types)

**New methods**:
```typescript
// ColorConverter.ts
static rgbToOklab(r, g, b): OKLAB
static oklabToRgb(L, a, b): RGB
static rgbToOklch(r, g, b): OKLCH
static oklchToRgb(L, C, h): RGB
static hexToOklab(hex): OKLAB
static oklabToHex(L, a, b): HexColor
static hexToOklch(hex): OKLCH
static oklchToHex(L, C, h): HexColor

// ColorService.ts (facade)
static mixColorsOklab(hex1, hex2, ratio): HexColor
static mixColorsOklch(hex1, hex2, ratio, hueMethod): HexColor
```

**Estimated LOC**: ~200

### Phase 2: LCH Support

**New methods**:
```typescript
static labToLch(L, a, b): LCH
static lchToLab(L, C, h): LAB
static hexToLch(hex): LCH
static lchToHex(L, C, h): HexColor
static mixColorsLch(hex1, hex2, ratio, hueMethod): HexColor
```

**Estimated LOC**: ~80

### Phase 3: HSL Support

**New methods**:
```typescript
static rgbToHsl(r, g, b): HSL
static hslToRgb(h, s, l): RGB
static hexToHsl(hex): HSL
static hslToHex(h, s, l): HexColor
static mixColorsHsl(hex1, hex2, ratio): HexColor
```

**Estimated LOC**: ~70

### Phase 4: Tool Integration

**Gradient Builder**:
- Add OKLCH/LAB/LCH interpolation options
- Update UI toggles
- ~50-100 LOC changes

**Dye Mixer**:
- Add OKLAB/HSL mixing modes
- Update `MixingMode` type
- ~30-50 LOC changes

---

## 5. Technical References

### OKLAB Formulas

```
// RGB to linear sRGB
r_lin = r <= 0.04045 ? r/12.92 : ((r+0.055)/1.055)^2.4

// Linear sRGB to OKLAB
l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

l_ = cbrt(l)
m_ = cbrt(m)
s_ = cbrt(s)

L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
```

### LCH from LAB

```
C = sqrt(a² + b²)
h = atan2(b, a) * 180 / π
// Normalize h to 0-360
h = h < 0 ? h + 360 : h
```

### Hue Interpolation Methods

```typescript
function interpolateHue(h1: number, h2: number, t: number, method: 'shorter' | 'longer'): number {
  let diff = h2 - h1;

  if (method === 'shorter') {
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
  } else { // longer
    if (diff > 0 && diff < 180) diff -= 360;
    if (diff < 0 && diff > -180) diff += 360;
  }

  return (h1 + diff * t + 360) % 360;
}
```

---

## 6. External Resources

- [OKLAB Original Paper](https://bottosson.github.io/posts/oklab/)
- [Spectral.js Library](https://spectraljs.com/)
- [Color.js Documentation](https://colorjs.io/docs/spaces)
- [CSS Color Level 4 Spec](https://www.w3.org/TR/css-color-4/)
- [Research_GoogleGemini.pdf](./Research_GoogleGemini.pdf) - Detailed mixing model analysis

---

## Appendix: Test Cases

### Blue + Yellow Mixing Reference

| Input | Expected Result |
|-------|-----------------|
| Blue: #0000FF | - |
| Yellow: #FFFF00 | - |
| **RGB Mix** | #808080 (Gray) |
| **HSL Mix** | ~#00FF80 (Spring Green) |
| **LAB Mix** | ~#CA8AAA (Pink) |
| **LCH Mix** | ~#FF6A00 (Orange via red) |
| **OKLCH Mix** | ~#00C060 (Green) |
| **RYB Mix** | ~#00A833 (Dark Green) |

### Gradient Quality Reference

For Red (#FF0000) → Cyan (#00FFFF):

| Space | Midpoint | Quality |
|-------|----------|---------|
| RGB | Gray | ❌ Muddy |
| HSV | Yellow/Green | ⚠️ Brightness dip |
| LAB | ~Pink | ⚠️ Unexpected hue |
| OKLCH | Vibrant Green | ✅ Perceptually uniform |
