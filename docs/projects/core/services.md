# Core Library Services

**API reference for @xivdyetools/core services**

---

## Service Architecture

The library uses the facade pattern - high-level service classes delegate to focused sub-services:

```
ColorService (facade)
├── ColorConverter      - Format conversion (hex, RGB, HSV, HSL, LAB)
├── ColorAccessibility  - WCAG contrast, readability
├── ColorManipulator    - Lighten, darken, saturate
└── ColorblindnessSimulator - Protanopia, deuteranopia, tritanopia

DyeService (facade)
├── DyeDatabase        - k-d tree indexed dye lookup
├── DyeSearch          - Name/category search
└── HarmonyGenerator   - Color harmony calculations

APIService            - Universalis market price API
PaletteService        - K-means++ palette extraction
PresetService         - Curated dye presets
LocalizationService   - 6-language i18n support
```

---

## ColorService

Static class for color operations. No instantiation needed.

### Color Conversion

```typescript
import { ColorService } from '@xivdyetools/core';

// Hex ↔ RGB
ColorService.hexToRgb('#FF6B6B');      // { r: 255, g: 107, b: 107 }
ColorService.rgbToHex({ r: 255, g: 107, b: 107 });  // '#FF6B6B'

// RGB ↔ HSV
ColorService.rgbToHsv({ r: 255, g: 107, b: 107 });  // { h: 0, s: 58, v: 100 }
ColorService.hsvToRgb({ h: 0, s: 58, v: 100 });     // { r: 255, g: 107, b: 107 }

// RGB ↔ HSL
ColorService.rgbToHsl({ r: 255, g: 107, b: 107 });  // { h: 0, s: 100, l: 71 }
ColorService.hslToRgb({ h: 0, s: 100, l: 71 });     // { r: 255, g: 107, b: 107 }

// RGB ↔ LAB (CIE L*a*b*)
ColorService.rgbToLab({ r: 255, g: 107, b: 107 });  // { l: 62.4, a: 56.2, b: 28.1 }
ColorService.labToRgb({ l: 62.4, a: 56.2, b: 28.1 });
```

### Color Manipulation

```typescript
// Lighten/darken (amount: 0-100)
ColorService.lighten('#FF6B6B', 20);   // '#FF9999'
ColorService.darken('#FF6B6B', 20);    // '#CC5555'

// Saturate/desaturate
ColorService.saturate('#FF6B6B', 20);
ColorService.desaturate('#FF6B6B', 20);

// Invert
ColorService.invert('#FF6B6B');        // '#009494'

// Blend two colors
ColorService.blend('#FF6B6B', '#4ECDC4', 0.5);  // Midpoint
```

### Accessibility

```typescript
// WCAG contrast ratio (1:1 to 21:1)
const ratio = ColorService.getContrastRatio('#FF6B6B', '#FFFFFF');  // 4.5

// WCAG compliance check
const wcag = ColorService.evaluateWCAG(ratio);
// {
//   AA: true,        // 4.5:1 for normal text
//   AAA: false,      // 7:1 for normal text
//   AALarge: true,   // 3:1 for large text
//   AAALarge: true   // 4.5:1 for large text
// }

// Get relative luminance
const luminance = ColorService.getRelativeLuminance('#FF6B6B');  // 0.24
```

### Colorblindness Simulation

Based on Brettel 1997 algorithm for accurate simulation:

```typescript
// Simulate how color appears to colorblind users
ColorService.simulateColorblindness('#FF6B6B', 'protanopia');    // Red-green (L-cone)
ColorService.simulateColorblindness('#FF6B6B', 'deuteranopia');  // Red-green (M-cone)
ColorService.simulateColorblindness('#FF6B6B', 'tritanopia');    // Blue-yellow
```

---

## DyeService

Instance class for dye operations. Requires database injection.

### Instantiation

```typescript
import { DyeService, dyeDatabase } from '@xivdyetools/core';

const dyeService = new DyeService(dyeDatabase);
```

### Dye Matching

```typescript
// Find closest dye to a color
const match = dyeService.findClosestDye('#FF6B6B');
// {
//   dye: { id: 12, name: 'Dalamud Red', hex: '#FF5050', category: 'red' },
//   distance: 27.4,    // RGB Euclidean distance
//   deltaE: 12.5       // CIE deltaE (perceptual)
// }

// Find top N closest dyes
const top5 = dyeService.findClosestDyes('#FF6B6B', 5);
// Array of matches sorted by distance

// Find by exact ID
const dye = dyeService.getDyeById(12);

// Search by name (fuzzy)
const reds = dyeService.searchByName('red');

// Get by category
const browns = dyeService.getByCategory('brown');
```

### Color Harmonies

```typescript
// Complementary (opposite on color wheel)
const complementary = dyeService.findComplementaryDyes('#FF6B6B');
// [{ dye: ..., distance: ... }, ...]

// Triadic (120° apart)
const triadic = dyeService.findTriadicDyes('#FF6B6B');

// Analogous (adjacent on color wheel)
const analogous = dyeService.findAnalogousDyes('#FF6B6B');

// Split-complementary (complementary + neighbors)
const splitComp = dyeService.findSplitComplementaryDyes('#FF6B6B');

// Tetradic/square (90° apart)
const tetradic = dyeService.findTetradicDyes('#FF6B6B');
```

### Database Access

```typescript
// Get all dyes
const allDyes = dyeService.getAllDyes();  // 136 dyes

// Get categories
const categories = dyeService.getCategories();
// ['basic', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'metallic']
```

---

## APIService

Universalis API wrapper with pluggable caching.

### Basic Usage

```typescript
import { APIService } from '@xivdyetools/core';

const api = new APIService();

// Get price data for an item
const prices = await api.getPriceData(19952, 'Gilgamesh');
// {
//   itemId: 19952,
//   server: 'Gilgamesh',
//   listings: [...],
//   recentHistory: [...],
//   averagePrice: 1234,
//   minPrice: 1000,
//   maxPrice: 2000
// }

// Bulk price lookup
const bulk = await api.getPricesForItems([19952, 19953, 19954], 'Gilgamesh');
```

### Custom Cache Backend

Implement `ICacheBackend` for custom caching (Redis, KV, etc.):

```typescript
interface ICacheBackend {
  get(key: string): Promise<CachedData | null>;
  set(key: string, value: CachedData): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// Example: Cloudflare KV cache
class KVCacheBackend implements ICacheBackend {
  constructor(private kv: KVNamespace) {}

  async get(key: string) {
    const data = await this.kv.get(key, 'json');
    return data as CachedData | null;
  }

  async set(key: string, value: CachedData) {
    await this.kv.put(key, JSON.stringify(value), { expirationTtl: 900 });
  }

  // ... delete, clear
}

const api = new APIService({ cacheBackend: new KVCacheBackend(env.KV) });
```

---

## PaletteService

K-means++ palette extraction from images.

### Extract from ImageData

```typescript
import { PaletteService } from '@xivdyetools/core';

// From canvas ImageData
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

const palette = await PaletteService.extractPalette(imageData, {
  numColors: 5,      // Number of colors to extract
  quality: 'high',   // 'low' | 'medium' | 'high'
  maxIterations: 100 // K-means iterations
});
// ['#FF6B6B', '#4ECDC4', '#FFE66D', '#2C3E50', '#95A5A6']
```

### Match Palette to Dyes

```typescript
// Extract palette then match each color to closest dye
const palette = await PaletteService.extractPalette(imageData, { numColors: 5 });

const dyeService = new DyeService(dyeDatabase);
const dyeMatches = palette.map(hex => dyeService.findClosestDye(hex));
```

---

## PresetService

Curated dye preset palettes.

```typescript
import { PresetService } from '@xivdyetools/core';

// Get all presets
const presets = PresetService.getPresets();

// Get by category
const glamourPresets = PresetService.getPresetsByCategory('glamour');

// Get featured presets
const featured = PresetService.getFeaturedPresets();
```

---

## LocalizationService

6-language support for dye names and UI text.

```typescript
import { LocalizationService } from '@xivdyetools/core';

// Set locale
LocalizationService.setLocale('ja');

// Translate key
const text = LocalizationService.translate('dye.dalamud_red');  // 'ダラガブレッド'

// Get available locales
const locales = LocalizationService.getAvailableLocales();
// ['en', 'ja', 'de', 'fr', 'ko', 'zh']

// Get current locale
const current = LocalizationService.getLocale();  // 'ja'
```

---

## Type Definitions

All services use types from `@xivdyetools/types`:

```typescript
import type {
  RGB,           // { r: number, g: number, b: number }
  HSV,           // { h: number, s: number, v: number }
  HSL,           // { h: number, s: number, l: number }
  LAB,           // { l: number, a: number, b: number }
  HexColor,      // Branded string type
  Dye,           // Full dye object
  DyeMatch,      // Match result with distance
  HarmonyResult, // Array of harmony matches
  PriceData,     // Market price response
} from '@xivdyetools/core';
```

See [Types](types.md) for complete type documentation.

---

## Related Documentation

- [Overview](overview.md) - Quick start and installation
- [Types](types.md) - Type system and branded types
- [Algorithms](algorithms.md) - Implementation details
