# Core Package API Reference

**@xivdyetools/core** - Complete API Documentation

**Version**: 1.0.0
**Last Updated**: November 22, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [ColorService](#colorservice)
3. [DyeService](#dyeservice)
4. [APIService](#apiservice)
5. [Type Definitions](#type-definitions)
6. [Constants](#constants)
7. [Usage Examples](#usage-examples)

---

## Overview

The `@xivdyetools/core` package provides all business logic for color manipulation, dye matching, and harmony generation. It's designed to be framework-agnostic and works in both browser and Node.js environments.

### Installation

```bash
npm install @xivdyetools/core
```

### Basic Import

```typescript
import {
  ColorService,
  DyeService,
  APIService,
  type RGB,
  type HSV,
  type Dye
} from '@xivdyetools/core';
```

---

## ColorService

Static utility class for color conversions, colorblind simulation, and WCAG compliance checks.

### Color Conversions

#### `hexToRgb(hex: string): RGB`

Convert hex color to RGB object.

**Parameters:**
- `hex` (string) - Hex color code (e.g., "#FF0000" or "FF0000")

**Returns:** `RGB` object with r, g, b values (0-255)

**Example:**
```typescript
const rgb = ColorService.hexToRgb('#FF0000');
console.log(rgb); // { r: 255, g: 0, b: 0 }
```

**Throws:** Error if hex string is invalid

---

#### `rgbToHex(rgb: RGB): string`

Convert RGB object to hex color.

**Parameters:**
- `rgb` (RGB) - RGB object with r, g, b values (0-255)

**Returns:** Hex string with # prefix (e.g., "#FF0000")

**Example:**
```typescript
const hex = ColorService.rgbToHex({ r: 255, g: 0, b: 0 });
console.log(hex); // "#FF0000"
```

---

#### `rgbToHsv(rgb: RGB): HSV`

Convert RGB to HSV (Hue, Saturation, Value).

**Parameters:**
- `rgb` (RGB) - RGB object

**Returns:** `HSV` object:
- `h` (number) - Hue in degrees (0-360)
- `s` (number) - Saturation percentage (0-100)
- `v` (number) - Value/brightness percentage (0-100)

**Example:**
```typescript
const hsv = ColorService.rgbToHsv({ r: 255, g: 0, b: 0 });
console.log(hsv); // { h: 0, s: 100, v: 100 }
```

---

#### `hsvToRgb(hsv: HSV): RGB`

Convert HSV to RGB.

**Parameters:**
- `hsv` (HSV) - HSV object

**Returns:** `RGB` object

**Example:**
```typescript
const rgb = ColorService.hsvToRgb({ h: 0, s: 100, v: 100 });
console.log(rgb); // { r: 255, g: 0, b: 0 }
```

---

#### `hexToHsv(hex: string): HSV`

Convert hex color to HSV (convenience method).

**Parameters:**
- `hex` (string) - Hex color code

**Returns:** `HSV` object

**Example:**
```typescript
const hsv = ColorService.hexToHsv('#FF0000');
console.log(hsv); // { h: 0, s: 100, v: 100 }
```

---

#### `hsvToHex(hsv: HSV): string`

Convert HSV to hex color (convenience method).

**Parameters:**
- `hsv` (HSV) - HSV object

**Returns:** Hex string

**Example:**
```typescript
const hex = ColorService.hsvToHex({ h: 0, s: 100, v: 100 });
console.log(hex); // "#FF0000"
```

---

### Colorblind Simulation

#### `simulateColorblindness(rgb: RGB, type: VisionType): RGB`

Simulate how a color appears to people with different types of color vision deficiency using Brettel 1997 transformation matrices.

**Parameters:**
- `rgb` (RGB) - Original color
- `type` (VisionType) - Vision deficiency type:
  - `'normal'` - No transformation (returns input)
  - `'deuteranopia'` - Red-green (no green cones)
  - `'protanopia'` - Red-green (no red cones)
  - `'tritanopia'` - Blue-yellow (no blue cones)
  - `'achromatopsia'` - Total color blindness (grayscale)

**Returns:** Simulated `RGB` color

**Example:**
```typescript
const red = { r: 255, g: 0, b: 0 };
const deuteranopia = ColorService.simulateColorblindness(red, 'deuteranopia');
console.log(deuteranopia); // { r: 159, g: 95, b: 0 }

const achromatopsia = ColorService.simulateColorblindness(red, 'achromatopsia');
console.log(achromatopsia); // { r: 76, g: 76, b: 76 } (gray)
```

---

### Color Analysis

#### `getColorDistance(rgb1: RGB, rgb2: RGB): number`

Calculate Euclidean distance between two colors in RGB space.

**Parameters:**
- `rgb1` (RGB) - First color
- `rgb2` (RGB) - Second color

**Returns:** Distance value (0-441.67)
- 0 = Identical colors
- <30 = Excellent match
- <60 = Good match
- <100 = Fair match
- >100 = Poor match

**Example:**
```typescript
const red = { r: 255, g: 0, b: 0 };
const darkRed = { r: 200, g: 0, b: 0 };

const distance = ColorService.getColorDistance(red, darkRed);
console.log(distance); // 55.0 (good match)
```

---

#### `getPerceivedLuminance(rgb: RGB): number`

Calculate perceived luminance using sRGB formula (ITU-R BT.709).

**Parameters:**
- `rgb` (RGB) - Color to analyze

**Returns:** Luminance value (0-1)

**Example:**
```typescript
const white = { r: 255, g: 255, b: 255 };
const black = { r: 0, g: 0, b: 0 };

console.log(ColorService.getPerceivedLuminance(white)); // 1.0
console.log(ColorService.getPerceivedLuminance(black)); // 0.0
```

---

#### `getContrastRatio(rgb1: RGB, rgb2: RGB): number`

Calculate WCAG contrast ratio between two colors.

**Parameters:**
- `rgb1` (RGB) - Foreground color
- `rgb2` (RGB) - Background color

**Returns:** Contrast ratio (1-21)

**WCAG Standards:**
- 4.5:1 = AA (normal text)
- 3:1 = AA (large text, 18pt+)
- 7:1 = AAA (normal text)

**Example:**
```typescript
const white = { r: 255, g: 255, b: 255 };
const black = { r: 0, g: 0, b: 0 };

const ratio = ColorService.getContrastRatio(white, black);
console.log(ratio); // 21.0 (maximum contrast)
```

---

#### `meetsWCAGAA(rgb1: RGB, rgb2: RGB, largeText?: boolean): boolean`

Check if color pair meets WCAG AA standard.

**Parameters:**
- `rgb1` (RGB) - Foreground color
- `rgb2` (RGB) - Background color
- `largeText` (boolean, optional) - Large text (18pt+)? Default: false

**Returns:** `true` if meets AA standard

**Example:**
```typescript
const foreground = { r: 0, g: 0, b: 0 };
const background = { r: 255, g: 255, b: 255 };

const meetsAA = ColorService.meetsWCAGAA(foreground, background);
console.log(meetsAA); // true (21:1 ratio exceeds 4.5:1)
```

---

#### `meetsWCAGAAA(rgb1: RGB, rgb2: RGB, largeText?: boolean): boolean`

Check if color pair meets WCAG AAA standard (more strict).

**Parameters:**
- Same as `meetsWCAGAA()`

**Returns:** `true` if meets AAA standard

---

### Color Manipulation

#### `adjustBrightness(rgb: RGB, factor: number): RGB`

Adjust brightness by multiplying RGB values.

**Parameters:**
- `rgb` (RGB) - Original color
- `factor` (number) - Brightness multiplier (0.5 = darker, 2.0 = brighter)

**Returns:** Adjusted `RGB` color (clamped to 0-255)

**Example:**
```typescript
const red = { r: 255, g: 0, b: 0 };
const darkRed = ColorService.adjustBrightness(red, 0.5);
console.log(darkRed); // { r: 127, g: 0, b: 0 }
```

---

#### `adjustSaturation(rgb: RGB, factor: number): RGB`

Adjust saturation by manipulating HSV values.

**Parameters:**
- `rgb` (RGB) - Original color
- `factor` (number) - Saturation multiplier (0 = grayscale, 2.0 = more saturated)

**Returns:** Adjusted `RGB` color

**Example:**
```typescript
const red = { r: 255, g: 100, b: 100 };
const desaturated = ColorService.adjustSaturation(red, 0.5);
// Returns less saturated (more gray) version of red
```

---

#### `rotateHue(rgb: RGB, degrees: number): RGB`

Rotate hue on color wheel.

**Parameters:**
- `rgb` (RGB) - Original color
- `degrees` (number) - Rotation angle (-360 to 360)

**Returns:** Hue-rotated `RGB` color

**Example:**
```typescript
const red = { r: 255, g: 0, b: 0 };
const cyan = ColorService.rotateHue(red, 180); // Complementary color
console.log(cyan); // ~{ r: 0, g: 255, b: 255 }
```

---

#### `invert(rgb: RGB): RGB`

Invert color (255 - value for each channel).

**Parameters:**
- `rgb` (RGB) - Original color

**Returns:** Inverted `RGB` color

**Example:**
```typescript
const red = { r: 255, g: 0, b: 0 };
const inverted = ColorService.invert(red);
console.log(inverted); // { r: 0, g: 255, b: 255 }
```

---

#### `desaturate(rgb: RGB): RGB`

Convert color to grayscale (convenience method).

**Parameters:**
- `rgb` (RGB) - Original color

**Returns:** Grayscale `RGB` color

**Example:**
```typescript
const red = { r: 255, g: 0, b: 0 };
const gray = ColorService.desaturate(red);
console.log(gray); // { r: 76, g: 76, b: 76 }
```

---

#### `interpolateRGB(rgb1: RGB, rgb2: RGB, ratio: number): RGB`

Linearly interpolate between two colors in RGB space.

**Parameters:**
- `rgb1` (RGB) - Start color
- `rgb2` (RGB) - End color
- `ratio` (number) - Interpolation ratio (0-1)

**Returns:** Interpolated `RGB` color

**Example:**
```typescript
const red = { r: 255, g: 0, b: 0 };
const blue = { r: 0, g: 0, b: 255 };

const midpoint = ColorService.interpolateRGB(red, blue, 0.5);
console.log(midpoint); // { r: 127, g: 0, b: 127 } (purple)
```

---

#### `interpolateHSV(hsv1: HSV, hsv2: HSV, ratio: number): HSV`

Linearly interpolate between two colors in HSV space (better for perceptual gradients).

**Parameters:**
- `hsv1` (HSV) - Start color
- `hsv2` (HSV) - End color
- `ratio` (number) - Interpolation ratio (0-1)

**Returns:** Interpolated `HSV` color

**Example:**
```typescript
const redHSV = { h: 0, s: 100, v: 100 };
const blueHSV = { h: 240, s: 100, v: 100 };

const midpoint = ColorService.interpolateHSV(redHSV, blueHSV, 0.5);
console.log(midpoint); // { h: 120, s: 100, v: 100 } (green, via color wheel)
```

---

## DyeService

Service for managing the FFXIV dye database and finding color harmonies.

### Constructor

#### `new DyeService(dyesData?: Dye[])`

Create a new DyeService instance.

**Parameters:**
- `dyesData` (Dye[], optional) - Custom dye data. If omitted, loads from `colors_xiv.json`

**Example:**
```typescript
// Auto-load from JSON
const dyeService = new DyeService();

// Or inject custom data (for testing)
const mockDyes: Dye[] = [/* ... */];
const dyeService = new DyeService(mockDyes);
```

---

### Database Queries

#### `getAllDyes(): Dye[]`

Get all dyes in the database (~125 dyes).

**Returns:** Array of all `Dye` objects

**Example:**
```typescript
const allDyes = dyeService.getAllDyes();
console.log(allDyes.length); // 125
```

---

#### `getDyeById(itemID: number): Dye | undefined`

Find dye by FFXIV item ID.

**Parameters:**
- `itemID` (number) - FFXIV item ID (e.g., 5729 for Snow White)

**Returns:** `Dye` object or `undefined` if not found

**Example:**
```typescript
const snowWhite = dyeService.getDyeById(5729);
console.log(snowWhite?.name); // "Snow White"
```

---

#### `getDyeByName(name: string): Dye | undefined`

Find dye by name (case-insensitive, fuzzy matching).

**Parameters:**
- `name` (string) - Dye name (e.g., "Snow White", "snow_white", "snowwhite")

**Returns:** `Dye` object or `undefined` if not found

**Example:**
```typescript
const dye = dyeService.getDyeByName('dalamud red');
console.log(dye?.hex); // "#A21D21"
```

---

#### `getDyesByIds(itemIDs: number[]): Dye[]`

Get multiple dyes by IDs.

**Parameters:**
- `itemIDs` (number[]) - Array of item IDs

**Returns:** Array of found `Dye` objects (missing IDs are skipped)

**Example:**
```typescript
const dyes = dyeService.getDyesByIds([5729, 5736]);
console.log(dyes.map(d => d.name)); // ["Snow White", "Jet Black"]
```

---

#### `searchByName(query: string): Dye[]`

Search dyes by name (partial match, case-insensitive).

**Parameters:**
- `query` (string) - Search term

**Returns:** Array of matching `Dye` objects

**Example:**
```typescript
const purples = dyeService.searchByName('purple');
console.log(purples.map(d => d.name));
// ["Grape Purple", "Royal Violet", "Iris Purple", ...]
```

---

#### `searchByCategory(category: string): Dye[]`

Get all dyes in a category.

**Parameters:**
- `category` (string) - Category name (e.g., "Red", "Blue", "Neutral")

**Returns:** Array of `Dye` objects in that category

**Example:**
```typescript
const redDyes = dyeService.searchByCategory('Red');
console.log(redDyes.length); // ~15-20 red dyes
```

---

#### `filterDyes(filters: DyeFilter): Dye[]`

Filter dyes by multiple criteria.

**Parameters:**
- `filters` (DyeFilter) - Filter options:
  - `category?: string` - Filter by category
  - `minPrice?: number` - Minimum price
  - `maxPrice?: number` - Maximum price
  - `acquisition?: string` - Acquisition method
  - `excludeCategories?: string[]` - Exclude categories

**Returns:** Filtered array of `Dye` objects

**Example:**
```typescript
const affordableDyes = dyeService.filterDyes({
  maxPrice: 500,
  excludeCategories: ['Facewear']
});
```

---

### Color Matching

#### `findClosestDye(rgb: RGB, excludeCategories?: string[]): Dye`

Find dye with closest color match using Euclidean distance.

**Parameters:**
- `rgb` (RGB) - Target color
- `excludeCategories` (string[], optional) - Categories to exclude (default: ['Facewear'])

**Returns:** Closest matching `Dye` object

**Example:**
```typescript
const targetColor = { r: 255, g: 0, b: 0 };
const closestDye = dyeService.findClosestDye(targetColor);
console.log(closestDye.name); // "Dalamud Red"
```

---

#### `findDyesWithinDistance(rgb: RGB, maxDistance: number, limit?: number): Dye[]`

Find all dyes within a color distance threshold.

**Parameters:**
- `rgb` (RGB) - Target color
- `maxDistance` (number) - Maximum color distance (0-441)
- `limit` (number, optional) - Max results to return

**Returns:** Array of `Dye` objects sorted by distance (closest first)

**Example:**
```typescript
const targetColor = { r: 255, g: 0, b: 0 };
const nearbyDyes = dyeService.findDyesWithinDistance(targetColor, 50, 5);
// Returns top 5 dyes within distance 50
```

---

### Color Harmonies

#### `findComplementaryPair(baseColor: string): Dye[]`

Find complementary color (opposite on color wheel, 180° apart).

**Parameters:**
- `baseColor` (string) - Hex color code

**Returns:** Array of 2 dyes: [baseDye, complementaryDye]

**Example:**
```typescript
const harmony = dyeService.findComplementaryPair('#FF0000');
console.log(harmony.map(d => d.name));
// ["Dalamud Red", "Turquoise Green"] (red + cyan)
```

---

#### `findAnalogousDyes(baseColor: string, count?: number): Dye[]`

Find analogous colors (adjacent on color wheel, ±30°).

**Parameters:**
- `baseColor` (string) - Hex color code
- `count` (number, optional) - Number of companions (1-3, default: 2)

**Returns:** Array of dyes: [baseDye, ...analogousDyes]

**Example:**
```typescript
const harmony = dyeService.findAnalogousDyes('#FF0000', 2);
console.log(harmony.map(d => d.name));
// ["Dalamud Red", "Rust Orange", "Wine Red"] (red + neighbors)
```

---

#### `findTriadicDyes(baseColor: string): Dye[]`

Find triadic harmony (equilateral triangle on color wheel, 120° apart).

**Parameters:**
- `baseColor` (string) - Hex color code

**Returns:** Array of 3 dyes forming triadic harmony

**Example:**
```typescript
const harmony = dyeService.findTriadicDyes('#FF0000');
console.log(harmony.map(d => d.name));
// ["Dalamud Red", "Turquoise Green", "Royal Blue"]
// (red, green, blue - 120° spacing)
```

---

#### `findSplitComplementaryDyes(baseColor: string): Dye[]`

Find split-complementary harmony (base + two colors ±30° from complement).

**Parameters:**
- `baseColor` (string) - Hex color code

**Returns:** Array of 3 dyes

**Example:**
```typescript
const harmony = dyeService.findSplitComplementaryDyes('#FF0000');
// Red + (cyan±30° = teal & aqua)
```

---

#### `findTetradicDyes(baseColor: string): Dye[]`

Find tetradic harmony (rectangle: two complementary pairs, 60° apart).

**Parameters:**
- `baseColor` (string) - Hex color code

**Returns:** Array of 4 dyes

---

#### `findSquareDyes(baseColor: string): Dye[]`

Find square harmony (90° spacing).

**Parameters:**
- `baseColor` (string) - Hex color code

**Returns:** Array of 4 dyes

---

#### `findMonochromaticDyes(baseColor: string, count?: number): Dye[]`

Find monochromatic scheme (same hue, varying saturation/brightness).

**Parameters:**
- `baseColor` (string) - Hex color code
- `count` (number, optional) - Number of companions (default: 2-3)

**Returns:** Array of dyes with similar hue

---

#### `findCompoundDyes(baseColor: string): Dye[]`

Find compound harmony (analogous + complementary).

**Parameters:**
- `baseColor` (string) - Hex color code

**Returns:** Array of 4 dyes: base + 2 analogous + 1 complementary

---

#### `findShadesDyes(baseColor: string, count?: number): Dye[]`

Find shades (similar tones, ±15° hue variance).

**Parameters:**
- `baseColor` (string) - Hex color code
- `count` (number, optional) - Number of companions

**Returns:** Array of dyes with similar tones

---

### Sorting

#### `getDyesSortedByBrightness(ascending?: boolean): Dye[]`

Get all dyes sorted by brightness (HSV value).

**Parameters:**
- `ascending` (boolean, optional) - Sort order (default: false = bright to dark)

**Returns:** Sorted array of dyes

---

#### `getDyesSortedBySaturation(ascending?: boolean): Dye[]`

Get all dyes sorted by saturation.

**Parameters:**
- `ascending` (boolean, optional) - Sort order (default: false = saturated to desaturated)

**Returns:** Sorted array of dyes

---

#### `getDyesSortedByHue(): Dye[]`

Get all dyes sorted by hue (rainbow order: red → orange → yellow → green → blue → purple).

**Returns:** Sorted array of dyes

---

## APIService

Service for fetching market board prices from Universalis API.

### Constructor

#### `new APIService(redisUrl: string)`

Create a new APIService instance.

**Parameters:**
- `redisUrl` (string) - Redis connection URL (e.g., "redis://localhost:6379")

**Example:**
```typescript
const apiService = new APIService(process.env.REDIS_URL!);
```

---

### Methods

#### `getPriceData(itemID: number, dataCenterID?: string): Promise<PriceData | null>`

Fetch current market board price for a dye.

**Parameters:**
- `itemID` (number) - FFXIV item ID
- `dataCenterID` (string, optional) - Data center name (default: 'North-America')

**Returns:** Promise resolving to price data or `null` on error

**Example:**
```typescript
const priceData = await apiService.getPriceData(5729, 'Aether');
console.log(priceData?.minListing?.dc?.price); // Current price in Gil
```

---

#### `getBulkPrices(itemIDs: number[], dataCenterID?: string): Promise<BulkPriceResult[]>`

Fetch prices for multiple items in parallel.

**Parameters:**
- `itemIDs` (number[]) - Array of item IDs
- `dataCenterID` (string, optional) - Data center name

**Returns:** Promise resolving to array of price results

**Example:**
```typescript
const prices = await apiService.getBulkPrices([5729, 5736], 'Aether');
prices.forEach(({ itemID, data }) => {
  console.log(`Item ${itemID}: ${data?.minListing?.dc?.price} Gil`);
});
```

---

#### `disconnect(): Promise<void>`

Close Redis connection (call on shutdown).

**Example:**
```typescript
process.on('SIGTERM', async () => {
  await apiService.disconnect();
  process.exit(0);
});
```

---

## Type Definitions

### RGB

```typescript
interface RGB {
  r: number; // Red (0-255)
  g: number; // Green (0-255)
  b: number; // Blue (0-255)
}
```

### HSV

```typescript
interface HSV {
  h: number; // Hue in degrees (0-360)
  s: number; // Saturation percentage (0-100)
  v: number; // Value/brightness percentage (0-100)
}
```

### Dye

```typescript
interface Dye {
  itemID: number;        // FFXIV item ID
  category: string;      // Category (Red, Blue, etc.)
  name: string;          // Dye name
  hex: string;           // Hex color code (#RRGGBB)
  acquisition: string;   // How to obtain
  price: number;         // Base vendor price
  currency: string;      // Currency type (Gil)
  rgb: RGB;              // RGB color
  hsv: HSV;              // HSV color
}
```

### VisionType

```typescript
type VisionType =
  | 'normal'
  | 'deuteranopia'   // Red-green (no green cones)
  | 'protanopia'     // Red-green (no red cones)
  | 'tritanopia'     // Blue-yellow (no blue cones)
  | 'achromatopsia'; // Total color blindness
```

### HarmonyType

```typescript
type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split_complementary'
  | 'tetradic'
  | 'square'
  | 'monochromatic'
  | 'compound'
  | 'shades';
```

---

## Constants

### COLORBLIND_MATRICES

Brettel 1997 transformation matrices for colorblind simulation.

```typescript
export const COLORBLIND_MATRICES = {
  deuteranopia: [[0.625, 0.375, 0.0], [0.7, 0.3, 0.0], [0.0, 0.3, 0.7]],
  protanopia: [[0.567, 0.433, 0.0], [0.558, 0.442, 0.0], [0.0, 0.242, 0.758]],
  tritanopia: [[0.95, 0.05, 0.0], [0.0, 0.433, 0.567], [0.0, 0.475, 0.525]],
  achromatopsia: [[0.299, 0.587, 0.114], [0.299, 0.587, 0.114], [0.299, 0.587, 0.114]]
};
```

### DYE_CATEGORIES

```typescript
export const DYE_CATEGORIES = [
  'Neutral',
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Blue',
  'Purple',
  'Brown',
  'Special',
  'Facewear'
] as const;
```

---

## Usage Examples

### Example 1: Find Matching Dye from User Input

```typescript
import { ColorService, DyeService } from '@xivdyetools/core';

const dyeService = new DyeService();

// User provides hex color
const userColor = '#8A2BE2'; // Blue Violet

// Convert to RGB
const rgb = ColorService.hexToRgb(userColor);

// Find closest dye
const matchedDye = dyeService.findClosestDye(rgb);

// Calculate distance
const distance = ColorService.getColorDistance(rgb, matchedDye.rgb);

console.log(`Matched: ${matchedDye.name} (${matchedDye.hex})`);
console.log(`Distance: ${distance.toFixed(1)}`);
```

### Example 2: Generate Triadic Color Scheme

```typescript
const harmony = dyeService.findTriadicDyes('#FF0000');

harmony.forEach((dye, index) => {
  console.log(`${index + 1}. ${dye.name} (${dye.hex})`);
  console.log(`   Hue: ${dye.hsv.h.toFixed(0)}°`);
});
```

### Example 3: Check WCAG Compliance

```typescript
const foreground = ColorService.hexToRgb('#000000'); // Black
const background = ColorService.hexToRgb('#FFFFFF'); // White

const ratio = ColorService.getContrastRatio(foreground, background);
const meetsAA = ColorService.meetsWCAGAA(foreground, background);
const meetsAAA = ColorService.meetsWCAGAAA(foreground, background);

console.log(`Contrast Ratio: ${ratio.toFixed(1)}:1`);
console.log(`WCAG AA: ${meetsAA ? '✅' : '❌'}`);
console.log(`WCAG AAA: ${meetsAAA ? '✅' : '❌'}`);
```

### Example 4: Simulate Colorblindness

```typescript
const red = ColorService.hexToRgb('#FF0000');

const deuteranopia = ColorService.simulateColorblindness(red, 'deuteranopia');
const protanopia = ColorService.simulateColorblindness(red, 'protanopia');
const achromatopsia = ColorService.simulateColorblindness(red, 'achromatopsia');

console.log('Normal:', ColorService.rgbToHex(red));
console.log('Deuteranopia:', ColorService.rgbToHex(deuteranopia));
console.log('Protanopia:', ColorService.rgbToHex(protanopia));
console.log('Achromatopsia:', ColorService.rgbToHex(achromatopsia));
```

### Example 5: Interpolate Color Gradient

```typescript
const startDye = dyeService.getDyeByName('Snow White')!;
const endDye = dyeService.getDyeByName('Jet Black')!;

const steps = 10;
const gradient: Dye[] = [];

for (let i = 0; i <= steps; i++) {
  const ratio = i / steps;
  const interpolated = ColorService.interpolateRGB(startDye.rgb, endDye.rgb, ratio);
  const closestDye = dyeService.findClosestDye(interpolated);
  gradient.push(closestDye);
}

gradient.forEach((dye, i) => {
  const percentage = (i / steps) * 100;
  console.log(`${percentage.toFixed(0)}%: ${dye.name}`);
});
```

---

## Next Steps

1. **Install Package**: `npm install @xivdyetools/core`
2. **Import Services**: Use ColorService, DyeService, APIService
3. **Build Commands**: Integrate with Discord.js command handlers
4. **Test Thoroughly**: Ensure parity with web app

---

**Last Updated**: November 22, 2025
**Author**: XIV Dye Tools Team
**Version**: 1.0.0
