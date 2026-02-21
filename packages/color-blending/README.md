# @xivdyetools/color-blending

> Six color blending algorithms (RGB, LAB, OKLAB, RYB, HSL, Spectral/Kubelka-Munk) for the XIV Dye Tools ecosystem.

[![npm version](https://img.shields.io/npm/v/@xivdyetools/color-blending)](https://www.npmjs.com/package/@xivdyetools/color-blending)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@xivdyetools/color-blending` provides six distinct color blending algorithms, each producing different results for the same pair of colors. Used by the Mixer command and gradient interpolation in XIV Dye Tools bots.

## Installation

```bash
npm install @xivdyetools/color-blending
```

## Blending Modes

| Mode | Name | Description |
|------|------|-------------|
| `rgb` | RGB | Simple additive channel averaging (default) |
| `lab` | LAB | Perceptually uniform CIELAB blending |
| `oklab` | OKLAB | Modern perceptual — fixes LAB's blue→purple issue |
| `ryb` | RYB | Traditional artist's color wheel (blue + yellow = green) |
| `hsl` | HSL | Hue-Saturation-Lightness interpolation |
| `spectral` | Spectral | Kubelka-Munk physics simulation (paint-like mixing) |

## Usage

```typescript
import { blendColors, BLENDING_MODES, isValidBlendingMode } from '@xivdyetools/color-blending';

// Blend two colors (equal 50/50 mix)
const result = blendColors('#FF0000', '#0000FF', 'oklab');
console.log(result.hex); // → '#C2007E' (perceptually balanced purple)
console.log(result.rgb); // → { r: 194, g: 0, b: 126 }

// Adjust blend ratio (0.0 = all first, 1.0 = all second)
const mostly_red = blendColors('#FF0000', '#0000FF', 'oklab', 0.25);

// Compare all modes
for (const mode of BLENDING_MODES) {
  const blend = blendColors('#FF0000', '#FFFF00', mode.value);
  console.log(`${mode.name}: ${blend.hex} — ${mode.description}`);
}

// Validate user input
if (isValidBlendingMode(userInput)) {
  const result = blendColors(color1, color2, userInput);
}
```

### Why Different Modes Produce Different Results

```
Red (#FF0000) + Blue (#0000FF):
  RGB:      #7F007F  (dark purple — channel averaging)
  LAB:      #CA0088  (magenta — perceptual, but blue bias)
  OKLAB:    #C2007E  (magenta — perceptual, corrected)
  RYB:      #800080  (purple — artist color wheel)
  HSL:      #FF00FF  (bright magenta — hue rotation)
  Spectral: #6A1B9A  (deep purple — physics-based paint mixing)
```

## API

### Core

- `blendColors(hex1, hex2, mode, ratio?)` — Blend two colors. Returns `BlendResult` (`{ hex, rgb }`).
- `getBlendingModeDescription(mode)` — Returns human-readable description for a mode.

### Validation

- `isValidBlendingMode(mode)` — Type guard: checks if a string is a valid `BlendingMode`.
- `BLENDING_MODES` — Array of `{ value, name, description }` for all modes.

### Color Conversions

- `rgbToLab(rgb)` — Convert RGB to CIELAB color space.

### Types

| Type | Description |
|------|-------------|
| `BlendingMode` | `'rgb' \| 'lab' \| 'oklab' \| 'ryb' \| 'hsl' \| 'spectral'` |
| `BlendResult` | `{ hex: string; rgb: RGB }` |
| `RGB` | `{ r: number; g: number; b: number }` (0–255) |
| `LAB` | `{ l: number; a: number; b: number }` (CIELAB) |
| `HSL` | `{ h: number; s: number; l: number }` (0–360, 0–1, 0–1) |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@xivdyetools/core` | `ColorService` for hex↔RGB conversions |

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
