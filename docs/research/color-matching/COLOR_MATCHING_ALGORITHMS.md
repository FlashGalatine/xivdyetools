# Color Matching Algorithms Research

> **Research Date:** January 2026
> **Purpose:** Evaluate perceptual color matching algorithms beyond Delta-E for FFXIV dye matching
> **Status:** Complete - Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Implementation](#current-implementation)
3. [Alternative Algorithms](#alternative-algorithms)
4. [Algorithm Comparison](#algorithm-comparison)
5. [Recommendations](#recommendations)
6. [Implementation Guide](#implementation-guide)
7. [References](#references)

---

## Executive Summary

XIV Dye Tools currently uses **RGB Euclidean distance** for k-d tree lookups and **CIEDE2000** for perceptual matching. Research indicates several algorithms could improve user experience:

| Algorithm | Key Benefit | Effort | Priority |
|-----------|-------------|--------|----------|
| **OKLAB Euclidean** | Simple, accurate, CSS standard | Trivial | ⭐ High |
| **HyAB** | Best for large color differences | Low | ⭐ High |
| **OKLCH Weighted** | User-controllable L/C/H priority | Medium | Medium |

**Key Finding:** The **HyAB algorithm** (Abasi et al., 2019) outperforms both Euclidean and CIEDE2000 for large color differences, making it ideal for dye palette matching where colors can be 10+ units apart.

---

## Current Implementation

### xivdyetools-core Library

The core library already provides a solid foundation:

#### Color Distance Functions

| Function | Location | Description |
|----------|----------|-------------|
| `getColorDistance()` | ColorConverter.ts:447-456 | RGB Euclidean: `√(ΔR² + ΔG² + ΔB²)` |
| `getDeltaE76()` | ColorConverter.ts:653-658 | LAB Euclidean (CIE 1976) |
| `getDeltaE2000()` | ColorConverter.ts:673-759 | CIEDE2000 with corrections |
| `getDeltaE()` | ColorConverter.ts:787-792 | Unified interface (cie76/cie2000) |

#### Color Spaces Available

| Space | Conversions | Used For |
|-------|-------------|----------|
| RGB | hexToRgb, rgbToHex | Display, k-d tree |
| HSV/HSL | Full support | Hue-based matching |
| LAB | Via XYZ (D65 illuminant) | CIE76, CIEDE2000 |
| LCH | From LAB (cylindrical) | Hue operations |
| **OKLAB** | Direct RGB transform | Mixing ✓, Distance ✗ |
| **OKLCH** | From OKLAB (cylindrical) | Mixing ✓, Distance ✗ |
| RYB | Gossett-Chen algorithm | Paint mixing |

**Observation:** OKLAB and OKLCH are already implemented for color mixing but not yet used for distance calculations. This is a quick win!

#### Dye Matching Flow

```
User Input (Hex)
       ↓
   hexToRgb()
       ↓
  K-d Tree Lookup (RGB Euclidean)
       ↓
  Candidate Dyes
       ↓
  getDeltaE() for ranking (optional)
       ↓
  Return Closest Match
```

---

## Alternative Algorithms

### 1. OKLAB Euclidean Distance ⭐

**Source:** Björn Ottosson (2020) - [A perceptual color space for image processing](https://bottosson.github.io/posts/oklab/)

**Formula:**
```
ΔE_OK = √[(L₂-L₁)² + (a₂-a₁)² + (b₂-b₁)²]
```
Where L, a, b are OKLAB coordinates.

**Advantages:**
- ✅ Already have `hexToOklab()` in codebase
- ✅ Simpler than CIEDE2000 (no correction factors)
- ✅ Better hue linearity (fixes LAB's blue→purple shift)
- ✅ Adopted by Safari, Photoshop, CSS Color Level 4
- ✅ Consistent with your existing OKLAB mixing

**Why it works:** OKLAB was designed by optimizing against CAM16-UCS perceptual data while maintaining the simple LAB structure. It achieves similar perceptual uniformity with far less computational complexity.

**Implementation:**
```typescript
function getDeltaE_Oklab(hex1: string, hex2: string): number {
  const lab1 = hexToOklab(hex1);
  const lab2 = hexToOklab(hex2);
  return Math.sqrt(
    Math.pow(lab2.L - lab1.L, 2) +
    Math.pow(lab2.a - lab1.a, 2) +
    Math.pow(lab2.b - lab1.b, 2)
  );
}
```

---

### 2. HyAB (Hybrid) Distance ⭐

**Source:** Abasi, Tehran & Fairchild (2019) - [Distance metrics for very large color differences](https://onlinelibrary.wiley.com/doi/abs/10.1002/col.22451)

**Formula:**
```
ΔE_HyAB = |L₂ - L₁| + √[(a₂-a₁)² + (b₂-b₁)²]
```
Taxicab distance for Lightness + Euclidean for chroma plane.

**Why it's revolutionary:**
- ✅ **Outperforms CIEDE2000** for large color differences (>10 units)
- ✅ Still accurate for small differences
- ✅ Extremely simple implementation
- ✅ Allows weighting: multiply `|ΔL|` by factor to prioritize lightness

**Research finding:** Standard Euclidean measures work poorly for large color distances (>10 units). HyAB addresses this by separating lightness perception from chromatic perception.

**Use case:** When matching a user's hex color to your ~130 FFXIV dyes, the closest match may be 20+ ΔE units away. HyAB handles this better than any other metric tested.

**Implementation (OKLAB variant):**
```typescript
function getDeltaE_HyAB(hex1: string, hex2: string): number {
  const lab1 = hexToOklab(hex1);
  const lab2 = hexToOklab(hex2);
  const dL = Math.abs(lab2.L - lab1.L);
  const dChroma = Math.sqrt(
    Math.pow(lab2.a - lab1.a, 2) +
    Math.pow(lab2.b - lab1.b, 2)
  );
  return dL + dChroma;
}
```

**With lightness weight (optional):**
```typescript
function getDeltaE_HyAB(hex1: string, hex2: string, kL: number = 1): number {
  // kL > 1: prioritize lightness matching
  // kL < 1: tolerate lightness differences
  const dL = Math.abs(lab2.L - lab1.L) * kL;
  // ... rest same
}
```

---

### 3. OKLCH Weighted Distance

**Concept:** Allow users to prioritize Lightness, Chroma, or Hue independently.

**Formula:**
```
ΔE = √[(kL·ΔL)² + (kC·ΔC)² + (kH·Δh_deg·C_avg)²]
```
Where:
- kL, kC, kH are user weights (default 1.0)
- Δh_deg is hue angle difference
- C_avg is average chroma (for perceptual scaling)

**Use cases:**
| Preset | kL | kC | kH | Best For |
|--------|----|----|----|----|
| Balanced | 1.0 | 1.0 | 1.0 | General use |
| Match Hue | 0.5 | 0.8 | 2.0 | "Find same color, any brightness" |
| Match Brightness | 2.0 | 1.0 | 0.5 | "Armor visibility important" |
| Match Saturation | 0.5 | 2.0 | 0.8 | "Keep it vibrant" |

**Implementation complexity:** Medium - requires hue angle difference calculation with wraparound handling.

---

### 4. CAM16-UCS Distance (Advanced)

**Source:** CIE Color Appearance Model 2016

**Advantages:**
- Best overall perceptual uniformity in research
- Used in Google Material Design ("HCT" color system)

**Disadvantages:**
- Complex computation requiring viewing conditions
- Marginal benefit over OKLAB for our use case
- Not worth the complexity for dye matching

**Recommendation:** Skip for now. OKLAB achieves similar results with far simpler math.

---

### 5. Jzazbz Distance (HDR)

**Source:** Safdar et al. (2017)

**Advantages:**
- Best hue linearity of tested spaces
- Excellent for HDR/WCG applications

**Disadvantages:**
- Designed for HDR (FFXIV dyes are SDR)
- More complex than OKLAB
- Marginal benefit for our use case

**Recommendation:** Skip. Better suited for HDR content pipelines.

---

## Algorithm Comparison

### Perceptual Accuracy vs Complexity

```
Accuracy
   ↑
   │  CAM16-UCS ●
   │            ○ Jzazbz
   │  CIEDE2000 ●───○ HyAB (large Δ)
   │        ○ OKLAB
   │    ○ CIE76
   │
   │○ RGB Euclidean
   └──────────────────────→ Complexity
```

### Benchmark Summary

| Algorithm | Small ΔE (<5) | Medium ΔE (5-15) | Large ΔE (>15) | Compute |
|-----------|---------------|------------------|----------------|---------|
| RGB Euclidean | Poor | Poor | Poor | Fastest |
| CIE76 | Fair | Fair | Fair | Fast |
| CIEDE2000 | Excellent | Excellent | Good | Medium |
| **OKLAB** | Very Good | Very Good | Very Good | Fast |
| **HyAB** | Very Good | Excellent | **Excellent** | Fast |
| CAM16-UCS | Excellent | Excellent | Excellent | Slow |

**Key insight:** For palette matching (our use case), colors are often 15+ units apart. HyAB excels here while CIEDE2000's corrections become less beneficial.

---

## Recommendations

### Immediate Actions (Phase 1)

1. **Add OKLAB Euclidean** to ColorConverter.ts
   - Trivial implementation (5 lines)
   - Leverage existing `hexToOklab()`
   - Consistent with OKLAB mixing already in use

2. **Add HyAB distance** to ColorConverter.ts
   - Simple implementation (8 lines)
   - Best choice for dye palette matching
   - Can use OKLAB as base (HyAB-OKLAB)

### Configuration (Phase 2)

3. **Add MatchingMethod config option:**
```typescript
type MatchingMethod =
  | 'rgb'       // RGB Euclidean (legacy, k-d tree)
  | 'cie76'     // LAB Euclidean (fast approximation)
  | 'ciede2000' // Current default
  | 'oklab'     // Recommended new default
  | 'hyab';     // Best for palette matching
```

4. **Update tools** to use configurable matching method:
   - Harmony Tool
   - Gradient Tool
   - Mixer Tool
   - Extractor Tool
   - Swatch Matcher

### Advanced (Phase 3)

5. **Add OKLCH weighted** for power users
   - Presets: "Match Hue", "Match Brightness", "Balanced"
   - Custom sliders for kL, kC, kH

---

## Implementation Guide

### File Changes Required

#### xivdyetools-core

**ColorConverter.ts** - Add new functions:
```typescript
// OKLAB Euclidean
getDeltaE_Oklab(hex1: string, hex2: string): number

// HyAB (using OKLAB)
getDeltaE_HyAB(hex1: string, hex2: string, kL?: number): number

// Unified interface update
type DeltaEFormula = 'cie76' | 'cie2000' | 'oklab' | 'hyab';
getDeltaE(hex1: string, hex2: string, formula: DeltaEFormula): number
```

**DyeSearch.ts** - Make matching configurable:
```typescript
interface FindClosestOptions {
  matchingMethod?: MatchingMethod;
  excludeIds?: number[];
}

findClosestDye(hex: string, options?: FindClosestOptions): Dye | null
```

**types/index.ts** - Add types:
```typescript
export type MatchingMethod = 'rgb' | 'cie76' | 'ciede2000' | 'oklab' | 'hyab';
```

#### xivdyetools-web-app

**tool-config-types.ts** - Add to tool configs:
```typescript
interface MatcherConfig {
  matchingMethod: MatchingMethod;
  // ... existing options
}
```

**config-sidebar.ts** - Add dropdown:
```html
<select data-config="matchingMethod">
  <option value="oklab">OKLAB (Recommended)</option>
  <option value="hyab">HyAB (Best for palettes)</option>
  <option value="ciede2000">CIEDE2000 (Industry standard)</option>
  <option value="cie76">CIE76 (Fast)</option>
</select>
```

---

## References

### Primary Sources

1. **OKLAB Color Space**
   - Ottosson, B. (2020). "A perceptual color space for image processing"
   - https://bottosson.github.io/posts/oklab/

2. **HyAB Distance Metric**
   - Abasi, S., Tehran, M.A., & Fairchild, M.D. (2019). "Distance metrics for very large color differences"
   - Color Research & Application, 45(2), 208-223
   - https://onlinelibrary.wiley.com/doi/abs/10.1002/col.22451

3. **CIEDE2000 Formula**
   - Sharma, G., Wu, W., & Dalal, E.N. (2005). "The CIEDE2000 color-difference formula: Implementation notes"
   - Color Research & Application, 30(1), 21-30

4. **CAM16 Color Appearance Model**
   - Li, C., et al. (2017). "Comprehensive color solutions: CAM16, CAT16, and CAM16-UCS"
   - Color Research & Application, 42(6), 703-718

### Additional Resources

- [Color Difference - Wikipedia](https://en.wikipedia.org/wiki/Color_difference)
- [ColorAide Distance Documentation](https://facelessuser.github.io/coloraide/distance/)
- [W3C OKLAB Slides](https://www.w3.org/Graphics/Color/Workshop/slides/talk/lilley)
- [Color Quantization - Wikipedia](https://en.wikipedia.org/wiki/Color_quantization)
- [Raph Levien's OKLAB Critique](https://raphlinus.github.io/color/2021/01/18/oklab-critique.html)

---

## Appendix: Formula Reference

### OKLAB Conversion (already implemented)

```
RGB → Linear RGB → LMS → OKLAB
```

### CIEDE2000 (current)

Complex formula with 5 correction terms:
- SL, SC, SH: Weighting functions
- RT: Hue rotation for blue region
- kL, kC, kH: Parametric factors (default 1)

### HyAB (proposed)

```
ΔE_HyAB = |L₂ - L₁| + √[(a₂-a₁)² + (b₂-b₁)²]
```

Simple hybrid of taxicab (L) and Euclidean (a,b).

---

*Document generated from research conducted January 2026*
