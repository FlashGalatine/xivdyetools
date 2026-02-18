# Color Matching Implementation Guide

> **Purpose:** Code examples and implementation steps for new matching algorithms
> **Target:** xivdyetools-core and xivdyetools-web-app

---

## Quick Start: Code Examples

### 1. OKLAB Euclidean Distance

Add to `ColorConverter.ts`:

```typescript
/**
 * Calculate color difference using OKLAB Euclidean distance.
 *
 * OKLAB provides better perceptual uniformity than LAB with simpler math
 * than CIEDE2000. Adopted by Safari, Photoshop, and CSS Color Level 4.
 *
 * @param hex1 - First color in hex format
 * @param hex2 - Second color in hex format
 * @returns Distance value (0 = identical, higher = more different)
 */
static getDeltaE_Oklab(hex1: string, hex2: string): number {
  const lab1 = this.hexToOklab(hex1);
  const lab2 = this.hexToOklab(hex2);

  const dL = lab2.L - lab1.L;
  const da = lab2.a - lab1.a;
  const db = lab2.b - lab1.b;

  return Math.sqrt(dL * dL + da * da + db * db);
}
```

**Usage:**
```typescript
const distance = ColorConverter.getDeltaE_Oklab('#FF5733', '#C70039');
// Returns: ~0.15 (OKLAB scale is 0-1 for L, small values for a/b)
```

---

### 2. HyAB Distance (Hybrid)

Add to `ColorConverter.ts`:

```typescript
/**
 * Calculate color difference using HyAB (Hybrid) algorithm.
 *
 * HyAB uses taxicab distance for lightness and Euclidean for chroma.
 * Research shows it outperforms CIEDE2000 for large color differences (>10 units).
 *
 * Reference: Abasi, Tehran & Fairchild (2019) - "Distance metrics for very large color differences"
 *
 * @param hex1 - First color in hex format
 * @param hex2 - Second color in hex format
 * @param kL - Lightness weight (default 1.0). Higher = prioritize lightness matching.
 * @returns Distance value (0 = identical, higher = more different)
 */
static getDeltaE_HyAB(hex1: string, hex2: string, kL: number = 1.0): number {
  const lab1 = this.hexToOklab(hex1);
  const lab2 = this.hexToOklab(hex2);

  // Taxicab distance for lightness (weighted)
  const dL = Math.abs(lab2.L - lab1.L) * kL;

  // Euclidean distance for chroma plane
  const da = lab2.a - lab1.a;
  const db = lab2.b - lab1.b;
  const dChroma = Math.sqrt(da * da + db * db);

  return dL + dChroma;
}
```

**Usage:**
```typescript
// Standard usage
const distance = ColorConverter.getDeltaE_HyAB('#FF5733', '#C70039');

// Prioritize lightness matching (kL = 2)
const distanceWithLightness = ColorConverter.getDeltaE_HyAB('#FF5733', '#C70039', 2.0);

// Tolerate lightness differences (kL = 0.5)
const distanceIgnoreLightness = ColorConverter.getDeltaE_HyAB('#FF5733', '#C70039', 0.5);
```

---

### 3. OKLCH Weighted Distance

Add to `ColorConverter.ts`:

```typescript
/**
 * Calculate color difference using OKLCH with customizable weights.
 *
 * Allows users to prioritize different color attributes:
 * - Lightness (L): Brightness/darkness
 * - Chroma (C): Saturation/vividness
 * - Hue (H): The actual color (red, blue, green, etc.)
 *
 * @param hex1 - First color in hex format
 * @param hex2 - Second color in hex format
 * @param weights - Object with kL, kC, kH weights (default 1.0 each)
 * @returns Distance value (0 = identical, higher = more different)
 */
static getDeltaE_OklchWeighted(
  hex1: string,
  hex2: string,
  weights: { kL?: number; kC?: number; kH?: number } = {}
): number {
  const { kL = 1.0, kC = 1.0, kH = 1.0 } = weights;

  const lch1 = this.hexToOklch(hex1);
  const lch2 = this.hexToOklch(hex2);

  // Lightness difference
  const dL = (lch2.L - lch1.L) * kL;

  // Chroma difference
  const dC = (lch2.C - lch1.C) * kC;

  // Hue difference with wraparound (circular)
  let dH = lch2.h - lch1.h;
  if (dH > 180) dH -= 360;
  if (dH < -180) dH += 360;

  // Scale hue by average chroma for perceptual accuracy
  const avgC = (lch1.C + lch2.C) / 2;
  const dHScaled = (dH / 180) * avgC * kH; // Normalize to similar scale

  return Math.sqrt(dL * dL + dC * dC + dHScaled * dHScaled);
}
```

**Usage:**
```typescript
// Balanced (default)
const balanced = ColorConverter.getDeltaE_OklchWeighted('#FF5733', '#C70039');

// Match hue primarily (ignore brightness differences)
const matchHue = ColorConverter.getDeltaE_OklchWeighted('#FF5733', '#C70039', {
  kL: 0.5, kC: 0.8, kH: 2.0
});

// Match brightness primarily (for armor visibility)
const matchBrightness = ColorConverter.getDeltaE_OklchWeighted('#FF5733', '#C70039', {
  kL: 2.0, kC: 1.0, kH: 0.5
});
```

---

### 4. Unified getDeltaE Interface

Update the existing `getDeltaE` function:

```typescript
/**
 * Delta-E formula options
 */
export type DeltaEFormula = 'cie76' | 'cie2000' | 'oklab' | 'hyab';

/**
 * Calculate color difference using specified formula.
 *
 * @param hex1 - First color in hex format
 * @param hex2 - Second color in hex format
 * @param formula - Algorithm to use (default: 'oklab')
 * @returns Distance value (scale varies by formula)
 */
static getDeltaE(hex1: string, hex2: string, formula: DeltaEFormula = 'oklab'): number {
  switch (formula) {
    case 'cie76':
      return this.getDeltaE76(this.hexToLab(hex1), this.hexToLab(hex2));

    case 'cie2000':
      return this.getDeltaE2000(this.hexToLab(hex1), this.hexToLab(hex2));

    case 'oklab':
      return this.getDeltaE_Oklab(hex1, hex2);

    case 'hyab':
      return this.getDeltaE_HyAB(hex1, hex2);

    default:
      return this.getDeltaE_Oklab(hex1, hex2);
  }
}
```

---

## Type Definitions

Add to `types/index.ts`:

```typescript
/**
 * Available color matching algorithms
 */
export type MatchingMethod =
  | 'rgb'       // RGB Euclidean (fastest, least accurate)
  | 'cie76'     // CIE76 LAB Euclidean (fast, fair accuracy)
  | 'ciede2000' // CIEDE2000 (industry standard, accurate)
  | 'oklab'     // OKLAB Euclidean (recommended, good balance)
  | 'hyab'      // HyAB hybrid (best for large differences)
  | 'oklch-weighted'; // OKLCH with custom L/C/H weights

/**
 * Configuration for OKLCH weighted matching
 */
export interface OklchWeights {
  /** Lightness weight (default 1.0). Higher = prioritize brightness matching */
  kL: number;
  /** Chroma weight (default 1.0). Higher = prioritize saturation matching */
  kC: number;
  /** Hue weight (default 1.0). Higher = prioritize color matching */
  kH: number;
}

/**
 * Matching configuration options
 */
export interface MatchingConfig {
  method: MatchingMethod;
  /** Only used when method is 'oklch-weighted' */
  weights?: OklchWeights;
}

/**
 * Default matching weights for common presets
 */
export const MATCHING_PRESETS = {
  balanced: { kL: 1.0, kC: 1.0, kH: 1.0 },
  matchHue: { kL: 0.5, kC: 0.8, kH: 2.0 },
  matchBrightness: { kL: 2.0, kC: 1.0, kH: 0.5 },
  matchSaturation: { kL: 0.5, kC: 2.0, kH: 0.8 },
} as const;
```

---

## DyeSearch Integration

Update `DyeSearch.ts`:

```typescript
import type { MatchingMethod, MatchingConfig } from '../types';

interface FindClosestOptions {
  excludeIds?: number[];
  matchingMethod?: MatchingMethod;
  weights?: { kL?: number; kC?: number; kH?: number };
}

/**
 * Find the closest dye to a given hex color using configurable matching.
 */
findClosestDye(hex: string, options: FindClosestOptions = {}): Dye | null {
  const {
    excludeIds = [],
    matchingMethod = 'oklab',  // New default
    weights
  } = options;

  // K-d tree for initial candidates (always uses RGB for speed)
  const candidates = this.kdTree.nearest(hexToRgb(hex), 10);

  // Re-rank using perceptual distance
  let bestDye: Dye | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    if (excludeIds.includes(candidate.dye.id)) continue;
    if (candidate.dye.category === 'Facewear') continue;

    const distance = this.calculateDistance(hex, candidate.dye.hex, matchingMethod, weights);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestDye = candidate.dye;
    }
  }

  return bestDye;
}

/**
 * Calculate distance using specified method
 */
private calculateDistance(
  hex1: string,
  hex2: string,
  method: MatchingMethod,
  weights?: { kL?: number; kC?: number; kH?: number }
): number {
  switch (method) {
    case 'rgb':
      return ColorConverter.getColorDistance(hex1, hex2);
    case 'cie76':
      return ColorConverter.getDeltaE(hex1, hex2, 'cie76');
    case 'ciede2000':
      return ColorConverter.getDeltaE(hex1, hex2, 'cie2000');
    case 'oklab':
      return ColorConverter.getDeltaE_Oklab(hex1, hex2);
    case 'hyab':
      return ColorConverter.getDeltaE_HyAB(hex1, hex2);
    case 'oklch-weighted':
      return ColorConverter.getDeltaE_OklchWeighted(hex1, hex2, weights);
    default:
      return ColorConverter.getDeltaE_Oklab(hex1, hex2);
  }
}
```

---

## Web App Integration

### Tool Config Types

Update `tool-config-types.ts`:

```typescript
import type { MatchingMethod } from '@xivdyetools/core';

export interface MatcherConfig {
  matchingMethod: MatchingMethod;
  // ... existing fields
}

export interface HarmonyConfig {
  matchingMethod: MatchingMethod;
  // ... existing fields
}

export interface GradientConfig {
  matchingMethod: MatchingMethod;
  interpolation: InterpolationMode;
  stepCount: number;
  // ... existing fields
}

export interface MixerConfig {
  matchingMethod: MatchingMethod;
  mixingMode: MixingMode;
  maxResults: number;
  // ... existing fields
}
```

### Config Sidebar UI

Add to `config-sidebar.ts`:

```typescript
private renderMatchingMethodSection(config: ToolConfig): HTMLElement {
  const section = this.createElement('div', { className: 'config-section' });

  const label = this.createElement('label', {
    className: 'config-label',
    textContent: LanguageService.t('config.matchingMethod'),
  });

  const select = this.createElement('select', {
    className: 'config-select',
    attributes: { 'data-config': 'matchingMethod' },
  }) as HTMLSelectElement;

  const options = [
    { value: 'oklab', label: 'OKLAB (Recommended)', description: 'Best balance of accuracy and speed' },
    { value: 'hyab', label: 'HyAB (Best for palettes)', description: 'Optimal for finding closest dye matches' },
    { value: 'ciede2000', label: 'CIEDE2000 (Industry standard)', description: 'Classic perceptual formula' },
    { value: 'cie76', label: 'CIE76 (Fast)', description: 'Simple LAB distance' },
  ];

  for (const opt of options) {
    const option = this.createElement('option', {
      textContent: opt.label,
      attributes: { value: opt.value, title: opt.description },
    });
    if (opt.value === config.matchingMethod) {
      (option as HTMLOptionElement).selected = true;
    }
    select.appendChild(option);
  }

  section.appendChild(label);
  section.appendChild(select);

  return section;
}
```

---

## Localization Keys

Add to locale files:

```json
{
  "config": {
    "matchingMethod": "Color Matching Algorithm",
    "matchingMethodDescription": "Algorithm used to find closest matching dyes"
  },
  "matching": {
    "oklab": "OKLAB",
    "oklabDesc": "Modern perceptual color space. Best balance of accuracy and simplicity.",
    "hyab": "HyAB",
    "hyabDesc": "Hybrid algorithm optimized for large color differences. Best for palette matching.",
    "ciede2000": "CIEDE2000",
    "ciede2000Desc": "Industry standard perceptual formula with correction factors.",
    "cie76": "CIE76",
    "cie76Desc": "Simple LAB Euclidean distance. Fast but less accurate."
  }
}
```

---

## Testing

### Unit Tests

```typescript
describe('ColorConverter - New Distance Functions', () => {
  describe('getDeltaE_Oklab', () => {
    it('returns 0 for identical colors', () => {
      expect(ColorConverter.getDeltaE_Oklab('#FF0000', '#FF0000')).toBe(0);
    });

    it('returns positive value for different colors', () => {
      const distance = ColorConverter.getDeltaE_Oklab('#FF0000', '#00FF00');
      expect(distance).toBeGreaterThan(0);
    });

    it('is symmetric', () => {
      const d1 = ColorConverter.getDeltaE_Oklab('#FF0000', '#00FF00');
      const d2 = ColorConverter.getDeltaE_Oklab('#00FF00', '#FF0000');
      expect(d1).toBeCloseTo(d2, 10);
    });
  });

  describe('getDeltaE_HyAB', () => {
    it('separates lightness and chroma', () => {
      // Two colors with same chroma, different lightness
      const sameChromaticity = ColorConverter.getDeltaE_HyAB('#808080', '#C0C0C0');

      // Two colors with same lightness, different chroma
      const sameLightness = ColorConverter.getDeltaE_HyAB('#FF8080', '#80FF80');

      // Both should have positive distance
      expect(sameChromaticity).toBeGreaterThan(0);
      expect(sameLightness).toBeGreaterThan(0);
    });

    it('respects lightness weight', () => {
      const base = ColorConverter.getDeltaE_HyAB('#FF0000', '#800000');
      const highL = ColorConverter.getDeltaE_HyAB('#FF0000', '#800000', 2.0);
      const lowL = ColorConverter.getDeltaE_HyAB('#FF0000', '#800000', 0.5);

      expect(highL).toBeGreaterThan(base);
      expect(lowL).toBeLessThan(base);
    });
  });
});
```

---

## Migration Notes

### Breaking Changes

None - all new functions are additive. Existing code continues to work.

### Recommended Changes

1. **Change default** from `ciede2000` to `oklab` for general use
2. **Add user preference** to allow switching algorithms
3. **Update harmony matching** to use configurable method

### Backwards Compatibility

The existing `getDeltaE(hex1, hex2, 'cie76' | 'cie2000')` signature is preserved. New options are additive.

---

## Performance Considerations

| Algorithm | Relative Speed | Notes |
|-----------|---------------|-------|
| RGB Euclidean | 1x (baseline) | Direct calculation |
| CIE76 | ~2x | Requires RGB→LAB conversion |
| CIEDE2000 | ~5x | Complex formula with sqrt, trig |
| **OKLAB** | ~2x | Similar to CIE76 |
| **HyAB** | ~2x | Similar to OKLAB |
| OKLCH Weighted | ~3x | Extra cylindrical conversion |

All are O(1) and negligible for typical use. K-d tree lookup remains the performance-critical path.

---

*Implementation guide for XIV Dye Tools color matching research*
