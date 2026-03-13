# Core Library Overview

**@xivdyetools/core** v2.0.1 - The foundation of the XIV Dye Tools ecosystem

---

## What is @xivdyetools/core?

The core library is a TypeScript package that provides:

- **136 Official FFXIV Dyes** - Complete database with accurate hex colors
- **Facewear Dye Support** - Synthetic IDs (≤ -1000) for Facewear gear slot
- **Color Algorithms** - Conversion, accessibility, colorblindness simulation
- **Dye Matching** - O(log n) nearest-neighbor lookup via k-d tree
- **Color Harmonies** - Complementary, triadic, analogous, and more
- **Palette Extraction** - K-means++ clustering from images
- **Market Prices** - Universalis API integration with caching
- **Localization** - 6 languages (en, ja, de, fr, ko, zh)
- **Performance Optimized** - Pre-computed search indices, consolidated LRU cache

---

## Installation

```bash
npm install @xivdyetools/core
```

Or with other package managers:
```bash
yarn add @xivdyetools/core
pnpm add @xivdyetools/core
```

---

## Quick Start

```typescript
import {
  ColorService,
  DyeService,
  dyeDatabase,
  PaletteService
} from '@xivdyetools/core';

// Find the closest FFXIV dye to any color
const dyeService = new DyeService(dyeDatabase);
const match = dyeService.findClosestDye('#FF6B6B');
console.log(match.dye.name);  // "Dalamud Red"
console.log(match.deltaE);    // Color difference score

// Generate color harmonies
const harmonies = dyeService.findTriadicDyes('#FF6B6B');
console.log(harmonies);  // Array of harmonious dye combinations

// Convert between color formats
const rgb = ColorService.hexToRgb('#FF6B6B');  // { r: 255, g: 107, b: 107 }
const hsv = ColorService.rgbToHsv(rgb);        // { h: 0, s: 58, v: 100 }

// Check accessibility
const contrast = ColorService.getContrastRatio('#FF6B6B', '#FFFFFF');
const wcag = ColorService.evaluateWCAG(contrast);  // { AA: true, AAA: false, ... }

// Simulate colorblindness
const simulated = ColorService.simulateColorblindness('#FF6B6B', 'protanopia');

// Extract palette from image data
const palette = await PaletteService.extractPalette(imageData, { numColors: 5 });
```

---

## v2.0.0 Migration Guide

**Breaking change in v2.0.0**: All type re-exports have been removed from `@xivdyetools/core`. Import types from `@xivdyetools/types` directly.

### Before (v1.x)

```typescript
import { Dye, RGB, HexColor, DyeId, PresetCategory } from '@xivdyetools/core';
```

### After (v2.0.0+)

```typescript
// Types come from @xivdyetools/types
import { Dye, RGB, HexColor, DyeId, PresetCategory } from '@xivdyetools/types';

// Services still come from @xivdyetools/core
import { ColorService, DyeService, dyeDatabase } from '@xivdyetools/core';
```

### What was removed

The following categories of re-exports were removed from the core barrel:

- **Color space types**: `RGB`, `HSV`, `HSL`, `LAB`, `HexColor`, `OKLCH`, `OklchWeights`
- **Dye types**: `Dye`, `DyeId`, `DyeCategory`, `DyeMatch`
- **Character types**: `CharacterColorMatch`, `SubRace`, `Gender`, `Race`
- **Preset types**: `PresetCategory`, `PresetPalette`, `PresetData`, `CachedData`, `PriceData`
- **Auth types**: Various JWT and API response sub-types
- **Logger classes**: `Logger`, `NoOpLogger`, `ConsoleLogger` (use `@xivdyetools/logger`)

### New in v2.0.0

- **`ResolvedPreset`** — now exported from core's `PresetService` (migrated from types)
- **28 symbols marked `@internal`** — still accessible via subpath imports but excluded from the public barrel export
- **LRU cache for `rgbToOklab()`** — performance improvement for the recommended matching method

---

## Environment Compatibility

The library works everywhere JavaScript runs:

| Environment | Support | Notes |
|-------------|---------|-------|
| **Node.js** | ✅ Full | v16+ recommended |
| **Browser** | ✅ Full | Modern browsers, bundler required |
| **Cloudflare Workers** | ✅ Full | Edge runtime compatible |
| **Deno** | ✅ Full | npm compatibility mode |
| **Bun** | ✅ Full | Native support |

---

## Key Features

### 1. Dye Database

Complete database of 136 official FFXIV dyes with:
- Accurate hex colors
- Category classification (Basic, Brown, Red, etc.)
- Item IDs for market lookup
- Localized names in 6 languages

```typescript
import { dyeDatabase } from '@xivdyetools/core';

// Get all dyes
const allDyes = dyeDatabase.getAllDyes();

// Search by name
const reds = dyeDatabase.searchByName('red');

// Get by category
const browns = dyeDatabase.getByCategory('brown');
```

### 2. Color Matching

Find the closest FFXIV dye to any color with O(log n) performance:

```typescript
const dyeService = new DyeService(dyeDatabase);

// Single best match
const best = dyeService.findClosestDye('#FF6B6B');

// Top 5 matches
const top5 = dyeService.findClosestDyes('#FF6B6B', 5);

// Match returns distance metrics
console.log(best.distance);   // RGB distance
console.log(best.deltaE);     // CIE deltaE (perceptual difference)
```

### 3. Color Harmonies

Generate aesthetically pleasing dye combinations:

```typescript
const dyeService = new DyeService(dyeDatabase);

// Different harmony types
const complementary = dyeService.findComplementaryDyes('#FF6B6B');
const triadic = dyeService.findTriadicDyes('#FF6B6B');
const analogous = dyeService.findAnalogousDyes('#FF6B6B');
const splitComplementary = dyeService.findSplitComplementaryDyes('#FF6B6B');
const tetradic = dyeService.findTetradicDyes('#FF6B6B');
```

### 4. Accessibility Features

Check contrast ratios and simulate colorblindness:

```typescript
// WCAG contrast checking
const ratio = ColorService.getContrastRatio('#FF6B6B', '#FFFFFF');
const wcag = ColorService.evaluateWCAG(ratio);
// { AA: true, AAA: false, AALarge: true, AAALarge: true }

// Colorblindness simulation
const protanopia = ColorService.simulateColorblindness('#FF6B6B', 'protanopia');
const deuteranopia = ColorService.simulateColorblindness('#FF6B6B', 'deuteranopia');
const tritanopia = ColorService.simulateColorblindness('#FF6B6B', 'tritanopia');
```

### 5. Palette Extraction

Extract dominant colors from images using K-means++:

```typescript
import { PaletteService } from '@xivdyetools/core';

// From ImageData (canvas, browser)
const palette = await PaletteService.extractPalette(imageData, {
  numColors: 5,
  quality: 'high'
});

// Returns array of hex colors
console.log(palette);  // ['#FF6B6B', '#4ECDC4', ...]
```

### 6. Market Prices

Fetch real-time FFXIV market prices via Universalis:

```typescript
import { APIService } from '@xivdyetools/core';

const api = new APIService();

// Get price for a specific item
const prices = await api.getPriceData(19952, 'Gilgamesh');

// Get prices for multiple items
const bulkPrices = await api.getPricesForItems([19952, 19953], 'Gilgamesh');
```

---

## Architecture

The library uses a service layer pattern with facade classes:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Public API                                │
│  ColorService │ DyeService │ APIService │ PaletteService │ ...  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                       Sub-Services                               │
│  ColorConverter │ ColorblindnessSimulator │ DyeDatabase │ ...   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                   Data & Utilities                               │
│      dyes.json │ presets.json │ kd-tree │ validation │ ...      │
└─────────────────────────────────────────────────────────────────┘
```

See [Services](services.md) for detailed API documentation.

---

## Performance

Built for speed with algorithmic optimizations:

| Operation | Time Complexity | Typical Time |
|-----------|-----------------|--------------|
| Dye lookup by ID | O(1) | <0.01ms |
| Nearest neighbor match | O(log n) | <0.1ms |
| k-nearest neighbors | O(k log n) | <0.5ms |
| Color harmony generation | O(1) | <0.1ms |
| Color conversion | O(1) | <0.01ms |
| rgbToOklab (cached) | O(1) amortized | <0.01ms |

**v2.0.0 Performance Improvements**:
- **LRU cache for `rgbToOklab()`** — OKLAB is the recommended matching method; caching eliminates redundant conversions on the hot path (OPT-001)
- **APIService cache metrics** — hit/miss/eviction tracking for observability (OPT-002)

See [Algorithms](algorithms.md) for implementation details.

---

## Type Safety

The library uses TypeScript branded types for compile-time safety:

```typescript
import { createHexColor, createDyeId, HexColor, DyeId } from '@xivdyetools/types';

// Validated at runtime, typed at compile time
const hex: HexColor = createHexColor('#FF6B6B');  // ✅
const dyeId: DyeId = createDyeId(42);             // ✅

// Type errors prevent invalid values
const invalid: HexColor = '#invalid';              // ❌ Type error
```

See [Types](types.md) for the complete type system.

---

## Related Documentation

- [Services](services.md) - Detailed service API reference
- [Types](types.md) - Type system and branded types
- [Algorithms](algorithms.md) - k-d tree, K-means++, harmony generation
- [Publishing](publishing.md) - npm publishing workflow
