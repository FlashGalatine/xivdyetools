# @xivdyetools/bot-logic

> Platform-agnostic command business logic for XIV Dye Tools bots — pure functions that take typed inputs and return structured results with SVG strings and embed data.

[![npm version](https://img.shields.io/npm/v/@xivdyetools/bot-logic)](https://www.npmjs.com/package/@xivdyetools/bot-logic)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@xivdyetools/bot-logic` is the shared command layer between the Discord bot and the Stoat bot. Each command is a pure `execute*` function:

```
Input → execute*(input) → Result (SVG string + embed data)
```

The package handles **all business logic** — color resolution, localization, SVG generation — so platform adapters only need to handle message I/O and image rendering.

## Installation

```bash
npm install @xivdyetools/bot-logic
```

## Commands

| Function | Description |
|----------|-------------|
| `executeDyeInfo(input)` | Dye info card with color values |
| `executeRandom(input)` | Grid of random dyes |
| `executeHarmony(input)` | Color harmony wheel (triadic, complementary, etc.) |
| `executeGradient(input)` | Gradient bar between two colors |
| `executeMixer(input)` | Blend two colors (6 blending modes) |
| `executeMatch(input)` | Find closest dyes to a color |
| `executeComparison(input)` | Side-by-side dye comparison grid |
| `executeAccessibility(input)` | Colorblind simulation + WCAG contrast matrix |

Each function returns a discriminated union (`{ ok: true; ... } | { ok: false; error: ...; errorMessage: string }`).

## Usage

```typescript
import { executeDyeInfo, resolveDyeInput } from '@xivdyetools/bot-logic';

// Resolve a dye name to a Dye object
const dye = resolveDyeInput('Snow White');
if (!dye) throw new Error('Dye not found');

// Generate an info card
const result = await executeDyeInfo({ dye, locale: 'en' });

if (result.ok) {
  console.log(result.svgString);       // SVG markup for the info card
  console.log(result.embed.title);     // "Snow White"
  console.log(result.localizedName);   // "Snow White" (or localized)
  console.log(result.dye.hex);         // "#FFFFFF"
}
```

### Input Resolution

```typescript
import {
  resolveColorInput,
  resolveDyeInput,
  isValidHex,
  normalizeHex,
} from '@xivdyetools/bot-logic';

// Resolve arbitrary input (hex, dye name, or CSS color name)
const color = resolveColorInput('#FF6B6B', { findClosestForHex: true });
// → { hex: '#FF6B6B', name: 'Coral Pink', id: 42, itemID: 5729, dye: Dye }

// Resolve directly to a Dye object
const dye = resolveDyeInput('jet black');
// → Dye { name: 'Jet Black', hex: '#000000', ... }

// CSS color names work too
const css = resolveColorInput('coral');
// → { hex: '#FF7F50' }
```

### Multi-Dye Commands

```typescript
import { executeGradient, executeComparison } from '@xivdyetools/bot-logic';

// Gradient between two dyes
const gradient = await executeGradient({
  startDye: pureWhite,
  endDye: jetBlack,
  steps: 7,
  interpolation: 'oklch',
  locale: 'en',
});

// Comparison grid
const comparison = await executeComparison({
  dyes: [snowWhite, pureWhite, pearlWhite],
  locale: 'en',
});
```

## API

### Input Resolution

- `resolveColorInput(input, options?)` — Resolves hex codes, dye names, or CSS color names to a `ResolvedColor`
- `resolveDyeInput(input)` — Resolves input directly to a `Dye` object (or `null`)
- `isValidHex(input)` — Validates hex color strings
- `normalizeHex(input)` — Normalizes to `#RRGGBB` format

### Localization

- `initializeLocale(locale)` — Loads locale data for dye name lookups
- `getLocalizedDyeName(itemID, fallback, locale)` — Returns localized dye name
- `getLocalizedCategory(category, locale)` — Returns localized category name

### Constants

- `dyeService` — Shared `DyeService` singleton instance
- `HARMONY_TYPES` — Available color harmony types
- `VISION_TYPES` — Colorblindness simulation types

## Dependencies

| Package | Purpose |
|---------|---------|
| `@xivdyetools/core` | Dye database, `DyeService`, `LocalizationService`, `filterDyes`, harmony types |
| `@xivdyetools/core/blending` | Color blending algorithms (RGB, LAB, OKLAB, RYB, HSL, Spectral) |
| `@xivdyetools/svg` | SVG card generators (info cards, grids, harmony cards) |
| `@xivdyetools/types` | `Dye`, `DyeTypeFilters`, `LocaleCode`, branded color types |

The bot UI translation engine is **built in** at `@xivdyetools/bot-logic/i18n` — `Translator`, `createTranslator`, and six locale JSONs, absorbed from the retired `@xivdyetools/bot-i18n`. Color blending moved from the retired `@xivdyetools/color-blending` into `@xivdyetools/core/blending`. See [`DEPRECATIONS.md`](../../DEPRECATIONS.md).

```typescript
import { createTranslator } from '@xivdyetools/bot-logic/i18n';

const t = createTranslator('ja');
t.t('about.title');
```

## Consumers

- [`apps/discord-worker`](../../apps/discord-worker/) — primary consumer. Each slash command handler calls one `execute*` and renders the result.
- [`apps/stoat-worker`](../../apps/stoat-worker/) — Revolt bot. Same `execute*` calls, different rendering shim.

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

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.**
