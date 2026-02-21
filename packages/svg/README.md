# @xivdyetools/svg

> Platform-agnostic SVG card generators for the XIV Dye Tools ecosystem — pure functions: data in, SVG string out.

[![npm version](https://img.shields.io/npm/v/@xivdyetools/svg)](https://www.npmjs.com/package/@xivdyetools/svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@xivdyetools/svg` generates all visual output for XIV Dye Tools bots and the web app as SVG strings. Every generator is a **pure function** — it takes data and returns an SVG string. PNG rasterization is handled by consumers using their platform's renderer (`@resvg/resvg-wasm` for Cloudflare Workers, `@resvg/resvg-js` for Node.js).

## Installation

```bash
npm install @xivdyetools/svg
```

## Generators

### Card Generators

| Function | Description |
|----------|-------------|
| `generateDyeInfoCard(options)` | Single dye info card with color values |
| `generateRandomDyesGrid(options)` | Grid of randomly selected dyes |
| `generateComparisonGrid(options)` | Side-by-side dye comparison |
| `generatePresetSwatch(options)` | Full preset swatch with all dye slots |
| `generateCompactPresetSwatch(options)` | Compact single-row preset swatch |

### Color Tool Generators

| Function | Description |
|----------|-------------|
| `generateHarmonyWheel(options)` | Color harmony wheel (triadic, complementary, etc.) |
| `generateGradientBar(options)` | Gradient bar between two colors |
| `generatePaletteGrid(options)` | Color match palette grid with quality labels |
| `generateAccessibilityComparison(options)` | Colorblind simulation comparison |
| `generateCompactAccessibilityRow(options)` | Compact single-row accessibility view |
| `generateContrastMatrix(options)` | WCAG contrast ratio matrix |
| `generateBudgetComparison(options)` | Market price comparison chart |

### Utility Generators

| Function | Description |
|----------|-------------|
| `generateErrorSvg(message)` | Generic error message SVG |
| `generateNoWorldSetSvg()` | "No world set" prompt SVG |

## Usage

```typescript
import { generateDyeInfoCard, generateHarmonyWheel } from '@xivdyetools/svg';

// Generate a dye info card
const svg = generateDyeInfoCard({
  dye: { name: 'Snow White', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, ... },
  localizedName: 'Snow White',
  localizedCategory: 'White',
});
// → '<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>'

// Generate a harmony wheel
const wheelSvg = generateHarmonyWheel({
  baseDye: { name: 'Coral Pink', hex: '#FF6B6B', ... },
  harmonyDyes: [/* complementary, triadic dyes */],
  harmonyType: 'triadic',
});
```

### SVG Primitives

The package also exports low-level SVG building blocks for custom compositions:

```typescript
import { createSvgDocument, rect, circle, text, group, THEME, FONTS } from '@xivdyetools/svg';

// Build custom SVG
const svg = createSvgDocument(400, 300,
  rect(0, 0, 400, 300, { fill: THEME.background }),
  circle(200, 150, 50, { fill: '#FF6B6B' }),
  text(200, 150, 'Hello', { fill: '#FFFFFF', fontFamily: FONTS.primary }),
);
```

### Color Utilities

```typescript
import {
  hexToRgb, rgbToHex,
  getLuminance, getContrastTextColor,
  interpolateColor, generateGradientColors,
  calculateContrast, getMatchQuality,
  escapeXml, formatGil,
} from '@xivdyetools/svg';

// Contrast-safe text color
const textColor = getContrastTextColor('#1a1a2e');
// → '#FFFFFF' (white text on dark background)

// WCAG contrast ratio
const ratio = calculateContrast('#FFFFFF', '#000000');
// → 21 (maximum contrast)

// Gradient interpolation
const colors = generateGradientColors('#FF0000', '#0000FF', 5);
// → ['#FF0000', '#BF003F', '#7F007F', '#3F00BF', '#0000FF']
```

## Constants

| Export | Description |
|--------|-------------|
| `THEME` | Shared theme (background, text, accent colors, spacing) |
| `FONTS` | Font family definitions (primary, mono, CJK) |
| `MATCH_QUALITIES` | Color match quality thresholds |
| `CATEGORY_DISPLAY` | Dye category display name mapping |

## Design Principles

- **Pure functions** — no side effects, no file I/O, no network calls
- **No rendering** — outputs SVG strings only; consumers handle PNG rasterization
- **CJK support** — subset Noto Sans SC/KR fonts for Chinese and Korean text
- **Consistent theming** — all generators share `THEME` and `FONTS` constants
- **Accessible** — contrast-safe text colors, WCAG ratio calculations built in

## Dependencies

| Package | Purpose |
|---------|---------|
| `@xivdyetools/core` | Dye database, color algorithms |
| `@xivdyetools/types` | Shared type definitions (Dye, RGB, HSV) |
| `@xivdyetools/color-blending` | Color interpolation for gradients |

## Connect With Me

**Flash Galatine** | Balmung (Midgardsormr)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
📝 **Blog**: [Project Galatine](https://blog.projectgalatine.com/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine
