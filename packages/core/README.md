# @xivdyetools/core

> Core color algorithms and dye database for XIV Dye Tools — environment-agnostic TypeScript library for FFXIV dye color matching, harmony generation, and accessibility checking.

[![npm version](https://img.shields.io/npm/v/@xivdyetools/core)](https://www.npmjs.com/package/@xivdyetools/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%2B-blue)](https://www.typescriptlang.org/)

## Features

✨ **Color Conversion** - RGB ↔ HSV ↔ Hex ↔ LAB ↔ RYB ↔ OKLAB ↔ OKLCH ↔ LCH ↔ HSL ↔ CMYK
🎨 **125 FFXIV Dyes** - Complete database (schema v2, stainID-keyed) plus 11 Facewear colors
🖌️ **Advanced Color Mixing** - RYB, OKLAB, HSL, and Spectral (Kubelka-Munk); six blending modes via `@xivdyetools/core/blending`
🔬 **Spectral.js Integration** - Physics-based paint mixing (Blue + Yellow = Green!)
🎯 **Dye Matching** - Find closest dyes to any color
🌈 **Color Harmonies** - Triadic, complementary, analogous, and more
🖼️ **Palette Extraction** - K-means++ clustering for multi-color extraction from images
♿ **Accessibility** - Colorblindness simulation (Brettel 1997)
📡 **Universalis API** - Price data integration with caching
🔌 **Pluggable Cache** - Memory, localStorage, Redis support
🌍 **Environment Agnostic** - Works in Node.js, browsers, edge runtimes
🗣️ **6 Languages** - English, Japanese, German, French, Korean, Chinese

## Installation

```bash
npm install @xivdyetools/core
```

## Quick Start

### Browser (with bundler)

```typescript
import { ColorService, DyeService, dyeDatabase } from '@xivdyetools/core';

// Initialize services
const dyeService = new DyeService(dyeDatabase);

// Find closest dye to a color
const closestDye = dyeService.findClosestDye('#FF6B6B');
console.log(closestDye.name); // "Coral Pink"

// Generate color harmonies
const triadicDyes = dyeService.findTriadicDyes('#FF6B6B');
console.log(triadicDyes.map(d => d.name)); // ["Turquoise Green", "Grape Purple"]

// Color conversions
const rgb = ColorService.hexToRgb('#FF6B6B');
const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);
console.log(hsv); // { h: 0, s: 58.04, v: 100 }
```

### Node.js (Discord bot, API, CLI)

```typescript
import {
  DyeService,
  APIService,
  dyeDatabase,
  getMarketItemID
} from '@xivdyetools/core';
import Redis from 'ioredis';
// RedisCacheBackend is your own ICacheBackend implementation — see "Custom Cache Backends" below

// Initialize with Redis cache (for Discord bots)
const redis = new Redis();
const cacheBackend = new RedisCacheBackend(redis);
const apiService = new APIService(cacheBackend);
const dyeService = new DyeService(dyeDatabase);

// Fetch live market prices.
// NOTE: since Patch 7.5, most dyes share a consolidated market itemID —
// use getMarketItemID(dye) rather than a hard-coded legacy itemID.
const priceData = await apiService.getPriceData(getMarketItemID(jetBlack));
console.log(`${priceData.currentMinPrice} Gil`);

// Find harmony with pricing
const baseDye = dyeService.findClosestDye('#000000');
const harmonyDyes = dyeService.findComplementaryPair(baseDye.hex);
```

## Core Services

### ColorService

Pure color conversion and manipulation algorithms.

> **Memory Note**: ColorService uses LRU caches (5 caches × 1000 entries each = up to 5000 cached entries) for performance optimization. For long-running applications or memory-constrained environments, call `ColorService.clearCaches()` periodically to free memory. Each cache entry is approximately 50-100 bytes, so maximum memory usage is ~500KB.

```typescript
import { ColorService } from '@xivdyetools/core';

// Hex ↔ RGB
const rgb = ColorService.hexToRgb('#FF6B6B');
const hex = ColorService.rgbToHex(255, 107, 107);

// RGB ↔ HSV
const hsv = ColorService.rgbToHsv(255, 107, 107);
const rgbFromHsv = ColorService.hsvToRgb(0, 58.04, 100);

// Colorblindness simulation
const simulated = ColorService.simulateColorblindness(
  { r: 255, g: 0, b: 0 },
  'deuteranopia'
);

// Color distance (Euclidean in RGB space)
const distance = ColorService.getColorDistance('#FF0000', '#00FF00');

// LAB color space and DeltaE (perceptual color difference)
const lab = ColorService.hexToLab('#FF6B6B');
const deltaE = ColorService.getDeltaE('#FF0000', '#FF6B6B'); // CIE76 by default
const deltaE2000 = ColorService.getDeltaE('#FF0000', '#FF6B6B', 'cie2000'); // CIEDE2000

// Color inversion
const inverted = ColorService.invert('#FF6B6B');

// Cache management (for memory-constrained environments)
ColorService.clearCaches();
const cacheStats = ColorService.getCacheStats();

// RYB Subtractive Color Mixing (paint-like mixing)
// Blue + Yellow = Green (not gray like RGB!)
const mixed = ColorService.mixColorsRyb('#0000FF', '#FFFF00');
const partialMix = ColorService.mixColorsRyb('#FF0000', '#FFFF00', 0.3); // 30% yellow

// RYB ↔ RGB conversions
const ryb = ColorService.hexToRyb('#00FF00');
const rgb = ColorService.rybToRgb(0, 255, 255); // Yellow+Blue = Green
const hex = ColorService.rybToHex(255, 255, 0); // Red+Yellow = Orange
```

### DyeService

FFXIV dye database management and color matching.

```typescript
import { DyeService, dyeDatabase } from '@xivdyetools/core';

const dyeService = new DyeService(dyeDatabase);

// Database access
const allDyes = dyeService.getAllDyes(); // 125 dyes
const dyeById = dyeService.getDyeById(13115); // By itemID (= Dye.id) - Jet Black; prefer getByStainId(102)
const dyeByStain = dyeService.getByStainId(1); // By stainID (canonical key) - Snow White
const categories = dyeService.getCategories(); // ['Neutral', 'Red', 'Blue', ...]

// Color matching — matchingMethod is one of the 5.0 suite:
// 'ciede2000' (default) | 'oklab' | 'cie76' | 'redmean' | 'rgb' | 'distinguish'
const closest = dyeService.findClosestDye('#FF6B6B');
const closestOk = dyeService.findClosestDye('#FF6B6B', { matchingMethod: 'oklab' });
const nearby = dyeService.findDyesWithinDistance('#FF6B6B', 50, 5);

// Harmony generation (default: fast hue-based matching)
const triadic = dyeService.findTriadicDyes('#FF6B6B');
const complementary = dyeService.findComplementaryPair('#FF6B6B');
const analogous = dyeService.findAnalogousDyes('#FF6B6B', 30);
const monochromatic = dyeService.findMonochromaticDyes('#FF6B6B', 6);
const splitComplementary = dyeService.findSplitComplementaryDyes('#FF6B6B');

// DeltaE-based harmony (perceptually accurate matching)
const triadicDeltaE = dyeService.findTriadicDyes('#FF6B6B', {
  algorithm: 'deltaE',
  deltaEFormula: 'cie2000', // or 'cie76' (faster, default)
});

// Color space selection for hue rotation
// OKLCH produces more perceptually balanced harmonies
const triadicOklch = dyeService.findTriadicDyes('#FF6B6B', { colorSpace: 'oklch' });
const compLch = dyeService.findComplementaryPair('#FF6B6B', { colorSpace: 'lch' });
// Available spaces: 'hsv' (default), 'oklch', 'lch', 'hsl'

// Filtering
const redDyes = dyeService.searchByCategory('Red');
const searchResults = dyeService.searchByName('black');
const filtered = dyeService.filterDyes({
  category: 'Special',
  excludeIds: [5752, 5753],
  minPrice: 0,
  maxPrice: 10000
});
```

### PaletteService

Multi-color palette extraction from images using K-means++ clustering.

```typescript
import { PaletteService, DyeService, dyeDatabase } from '@xivdyetools/core';

const paletteService = new PaletteService();
const dyeService = new DyeService(dyeDatabase);

// Extract from Canvas ImageData
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const pixels = PaletteService.pixelDataToRGBFiltered(imageData.data);

// Extract dominant colors only
const palette = paletteService.extractPalette(pixels, { colorCount: 4 });
// Returns: Array<{ color: RGB, dominance: number }>

// Extract and match to FFXIV dyes
const matches = paletteService.extractAndMatchPalette(pixels, dyeService, {
  colorCount: 4,
  maxIterations: 25,
  convergenceThreshold: 1.0,
  maxSamples: 10000
});
// Returns: Array<{ extracted: RGB, matchedDye: Dye, distance: number, dominance: number }>

// Helper: Convert raw pixel buffer (RGB, 3 bytes per pixel)
const pixelsFromBuffer = PaletteService.pixelDataToRGB(buffer);

// Helper: Convert RGBA ImageData, filtering transparent pixels
const pixelsFromCanvas = PaletteService.pixelDataToRGBFiltered(imageData.data);
```

### APIService

Universalis API integration with pluggable cache backends.

```typescript
import { APIService, MemoryCacheBackend } from '@xivdyetools/core';

// With memory cache (default)
const apiService = new APIService();

// With custom cache backend
const cache = new MemoryCacheBackend();
const apiService = new APIService(cache);

// Fetch price data
const priceData = await apiService.getPriceData(5752); // itemID
const pricesWithDC = await apiService.getPriceData(5752, undefined, 'Aether');

// Batch operations
const prices = await apiService.getPricesForItems([5752, 5753, 5754]);

// Cache management
await apiService.clearCache();
const stats = await apiService.getCacheStats();

// API health check
const { available, latency } = await apiService.getAPIStatus();

// Utility methods
const formatted = APIService.formatPrice(123456); // "123,456G"
const trend = APIService.getPriceTrend(100, 80); // { trend: 'up', ... }
```

## Custom Cache Backends

Implement the `ICacheBackend` interface for custom storage:

```typescript
import { ICacheBackend, CachedData, PriceData } from '@xivdyetools/core';
import Redis from 'ioredis';

class RedisCacheBackend implements ICacheBackend {
  constructor(private redis: Redis) {}

  async get(key: string): Promise<CachedData<PriceData> | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: CachedData<PriceData>): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', value.ttl / 1000);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    await this.redis.flushdb();
  }

  async keys(): Promise<string[]> {
    return await this.redis.keys('*');
  }
}

// Use with APIService
const redis = new Redis();
const cache = new RedisCacheBackend(redis);
const apiService = new APIService(cache);
```

## TypeScript Types

All services are fully typed with TypeScript:

```typescript
import type {
  Dye,
  RGB,
  HSV,
  LAB,
  RYB,
  HexColor,
  PriceData,
  CachedData,
  VisionType,
  ErrorSeverity,
  ICacheBackend,
  HarmonyOptions,
  HarmonyMatchingAlgorithm,
  HarmonyColorSpace,
  DeltaEFormula
} from '@xivdyetools/core';
```

## Constants

Access color theory and API configuration constants:

```typescript
import {
  RGB_MAX,
  HUE_MAX,
  BRETTEL_MATRICES,
  UNIVERSALIS_API_BASE,
  API_CACHE_TTL
} from '@xivdyetools/core';
```

## Utilities

Helper functions for common tasks:

```typescript
import {
  clamp,
  isValidHexColor,
  isValidRGB,
  retry,
  sleep,
  generateChecksum
} from '@xivdyetools/core';

// Validation
const isValid = isValidHexColor('#FF6B6B'); // true

// Math
const clamped = clamp(150, 0, 100); // 100

// Async utilities
await sleep(1000); // Wait 1 second
const result = await retry(() => fetchData(), 3, 1000); // Retry with backoff
```

## Use Cases

### Discord Bot
```typescript
// Implement /harmony command
import { DyeService, dyeDatabase } from '@xivdyetools/core';

const dyeService = new DyeService(dyeDatabase);
const baseDye = dyeService.findClosestDye(userColor);
const harmonyDyes = dyeService.findTriadicDyes(userColor);
// Render color wheel, send Discord embed
```

### Web App
```typescript
// Color matcher tool
import { DyeService, dyeDatabase } from '@xivdyetools/core';

const dyeService = new DyeService(dyeDatabase);
const matchingDyes = dyeService.findDyesWithinDistance(imageColor, 50, 10);
// Display results in UI
```

### CLI Tool
```typescript
// Color conversion utility
import { ColorService } from '@xivdyetools/core';

const hex = process.argv[2];
const rgb = ColorService.hexToRgb(hex);
console.log(`RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`);
```

## Dye Database Composition

The database is **125 standard dyes** (`src/data/dyes.json`, schema v2) keyed by `stainID`. Seven fields are stored per entry — `stainID`, `name`, `hex`, `category`, `acquisition`, `consolidationType`, `legacyItemID` — and everything else (`rgb` / `hsv` / `lab`, `cost` / `currency`, the `is*` flags) is **derived** at `DyeDatabase.initialize()`. The runtime `Dye` object still has its full shape, and `Dye.itemID` is always a `number`.

The **11 Facewear colors are not dyes.** They live separately in `facewear_colors.json` / the `facewearColors` export as `FacewearColor` objects (string slug `id`, `name`, `hex`) and are excluded from the k-d tree, since they are not market-tradeable.

Since **Patch 7.5**, 105 of the 125 dyes share three consolidated market itemIDs (Type-A `52254`, Type-B `52255`, Type-C `52256`). Use `getMarketItemID(dye)` for any market-board lookup — a hard-coded legacy itemID will not price correctly.

## Requirements

- **Node.js** 22.0.0 or higher
- **TypeScript** 5.9 or higher (for development)

## Browser Compatibility

Works in all modern browsers with ES6 module support:
- Chrome/Edge 89+
- Firefox 88+
- Safari 15+

## Related Projects

This package lives in the [xivdyetools monorepo](https://github.com/FlashGalatine/xivdyetools). Its direct consumers:

- [`apps/web-app`](../../apps/web-app/) — interactive color tools for FFXIV
- [`apps/discord-worker`](../../apps/discord-worker/) — Cloudflare Worker Discord bot
- [`apps/api-worker`](../../apps/api-worker/) — public REST API
- [`apps/og-worker`](../../apps/og-worker/) — OpenGraph cards (stateless localization trio)
- [`apps/stoat-worker`](../../apps/stoat-worker/) — Revolt bot (parked)
- [`@xivdyetools/svg`](../svg/), [`@xivdyetools/bot-logic`](../bot-logic/)

## Support

- **Issues**: [GitHub Issues](https://github.com/FlashGalatine/xivdyetools/issues)
- **NPM Package**: [@xivdyetools/core](https://www.npmjs.com/package/@xivdyetools/core)
- **API Docs**: [developers.xivdyetools.app](https://developers.xivdyetools.app)

## Credits & Acknowledgements

- **[XIVAPI](https://xivapi.com/)** — dye names in English, Japanese, German, and French. Korean and Chinese names are manually sourced; XIVAPI does not serve them.
- **[Universalis](https://universalis.app/)** (MIT) — market board price data consumed by `APIService`.
- **[spectral.js](https://github.com/rvanwijnen/spectral.js)** (MIT) — Kubelka-Munk spectral paint mixing.
- Color-vision deficiency simulation uses the matrices from **Brettel, Viénot & Mollon (1997)**, *"Computerized simulation of color appearance for dichromats"*, JOSA A 14(10).
- Perceptual color difference uses **CIE76** and **CIEDE2000** as published by the International Commission on Illumination.

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X/Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.** All FINAL FANTASY XIV content, including dye names and color values, is the property of Square Enix.

---

**Made with ❤️ for the FFXIV community**
