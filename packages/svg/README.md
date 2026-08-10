# @xivdyetools/svg

> Platform-agnostic SVG card generators for the XIV Dye Tools ecosystem — pure functions: data in, SVG string out.

[![npm version](https://img.shields.io/npm/v/@xivdyetools/svg)](https://www.npmjs.com/package/@xivdyetools/svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@xivdyetools/svg` generates all visual output for XIV Dye Tools bots as SVG strings. Every generator is a **pure function** — it takes data and returns an SVG string. PNG rasterization is handled by consumers using their platform's renderer (`@resvg/resvg-wasm` for Cloudflare Workers, `@resvg/resvg-js` for Node.js).

Since **2.0** the cards are not free-form drawings. They are compositions of one shared vocabulary defined in `frame.ts` — read that file before changing any generator.

## Installation

```bash
npm install @xivdyetools/svg
```

## The frame system

The whole design rests on one measurement: **the canvas width IS the display width.** Four constants encode it, and changing any of them changes every card:

| Constant | Value | Why |
|----------|-------|-----|
| `CARD_WIDTH` | `400` | Discord's embed image box. Draw here, raster at 2× for sharpness. |
| `CARD_MAX_HEIGHT` | `350` | A wall, not a guideline. Past 350 the client contracts the box *horizontally*, shrinking every type size in it. |
| `CARD_TYPE` | `{ label: 11, value: 13, name: 16 }` | The type floor. Nothing below 11 px. |
| `ROW_CAP` | `5` | Every list graphic holds five rows at full size; the tail becomes a swatch strip plus a count in the embed. |

`HARMONY_ROW_CAP` is `4` — harmony's taller 39 px slot rows. Height grows with the result and stops at the ceiling; 350 is a maximum, never a target.

## Generators

Several commands **route** rather than scale — `/contrast`, `/compare` and `/accessibility` each pick a different frame from their input (pair count, dye count, `vision:`).

| Function | Command | Description |
|----------|---------|-------------|
| `generateHarmonyCard(options)` | `/harmony` | Harmony palette — found dye vs. computed ideal |
| `generateDyeInfoCard(options)` | `/dye info` | Single dye sheet with color values |
| `generateRandomDyesGrid(options)` | `/dye random` | Table of randomly selected dyes |
| `generateComparisonCard(options)` | `/comparison` | Side-by-side comparison (routes on dye count, 2–4) |
| `generateContrastCard(options)` | `/contrast` | WCAG contrast ratios (routes on pair count) |
| `generateA11yCard(options)` | `/accessibility` | Color-vision lenses (routes on `vision:`) |
| `generateMixerCard(options)` | `/mixer` | Ratio-sweep blending card |
| `generateGradientCard(options)` | `/gradient` | Gradient strip over distinct dyes |
| `generatePaletteGrid(options)` | `/extractor image` | Extracted palette ramp |
| `generateNearestSheet(options)` | `/extractor color` | Nearest-dye color sheet |
| `generateSwatchCard(options)` | `/swatch` | `.chara` character-file sheet |
| `generateBudgetLedger(options)` | `/budget` | Market price ledger, tier-grouped |
| `generatePresetSwatch(options)` | `/preset` | Preset swatch (pre-frame; redesign deferred) |

## Usage

```typescript
import { generateDyeInfoCard, generateHarmonyCard } from '@xivdyetools/svg';

// Generate a dye info card
const svg = generateDyeInfoCard({
  dye: { name: 'Snow White', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, /* ... */ },
  localizedName: 'Snow White',
  localizedCategory: 'White',
});
// → '<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>'

// Generate a harmony card
const harmonySvg = generateHarmonyCard({
  baseDye: { name: 'Coral Pink', hex: '#FF6B6B', /* ... */ },
  slots: [/* complementary / triadic slots */],
  harmonyType: 'triadic',
});
```

### Frame primitives

The vocabulary every generator is built from:

```typescript
import {
  CARD_WIDTH, CARD_MAX_HEIGHT, CARD_TYPE, ROW_CAP,
  cardTheme, cardShell, cardText, textWidth, fitText,
  commandChip, appIcon, markFooter,
  swatch, idealSwatch, measuredRow, dashedRule, hairline,
} from '@xivdyetools/svg';

const theme = cardTheme('dark');
const svg = cardShell(320, theme, /* content */);
```

`measuredRow` has **no variants and no optional slots** — lead value, source→dye pair, name, tier bar, measure. Every argument is required. A consumer that cannot fill all five is a signal the abstraction needs revisiting, not a reason to add a flag.

`swatch` is solid for a buyable dye and `idealSwatch` is outlined for "the hue the maths asked for" — an ideal gradient step, a blend, a harmony's target hue.

### Low-level SVG primitives

```typescript
import { createSvgDocument, rect, circle, line, text, group, arcPath, THEME, FONTS } from '@xivdyetools/svg';

const svg = createSvgDocument(400, 300,
  rect(0, 0, 400, 300, { fill: THEME.background }),
  circle(200, 150, 50, { fill: '#FF6B6B' }),
  text(200, 150, 'Hello', { fill: '#FFFFFF', fontFamily: FONTS.primary }),
);
```

### Color and text utilities

```typescript
import {
  hexToRgb, rgbToHex, rgbToHsv,
  getLuminance, getContrastTextColor,
  interpolateColor, generateGradientColors,
  contrastRatio, escapeXml, estimateTextWidth, truncateText,
} from '@xivdyetools/svg';

// Contrast-safe text color
const textColor = getContrastTextColor('#1a1a2e');   // → '#FFFFFF'

// WCAG contrast ratio
const ratio = contrastRatio('#FFFFFF', '#000000');   // → 21

// Gradient interpolation
const colors = generateGradientColors('#FF0000', '#0000FF', 5);
```

## Constants

| Export | Description |
|--------|-------------|
| `THEME` / `CARD_DARK` / `CARD_LIGHT` | Shared theme tokens; light ships via `/preferences` |
| `FONTS` | Font stacks (see below) |
| `ACCENT` | The product accent |
| `NUMFMT` / `num` / `grp` | Number formatting helpers |
| `CATEGORY_DISPLAY` | Dye category display-name mapping |
| `LEDGER_*_H` | Budget ledger row/section heights |

## Design Principles

- **Pure functions** — no side effects, no file I/O, no network calls. Same input, byte-identical output.
- **No rendering** — outputs SVG strings only; consumers handle PNG rasterization.
- **The PNG must be self-contained.** These get saved and reposted into servers that never ran the command, so never burn an instruction into an image — actionable, context-dependent lines belong in the embed.
- **Never ellipsise to a character count.** Use `fitText` / `estimateTextWidth`: CJK counts 2× and German compounds run ~3× English.
- **Blanks, never inventions.** A missing price is an em dash; a ratio with no numerator is an empty cell.
- **XML escaping is automatic** in `cardText` and `text()` — never concatenate user strings into raw `<text>` blocks.

### Font stacks

`Fragment Mono` (mono), `Onest` (body), `Space Grotesk` (display), each falling back through `Noto Sans JP → SC → KR`. **Order matters:** JP must precede SC or Japanese renders in Chinese letterforms, and SC has zero Hangul glyphs so KR must come last.

### Rendering boundary (consumer's responsibility)

1. Load the font files (Onest, Space Grotesk, Fragment Mono, Noto Sans JP + SC + KR subsets).
2. Feed the SVG and font buffers to `resvg-wasm` / `@resvg/resvg-js`.
3. Return the PNG bytes to Discord, Revolt, etc.

A dye name introducing a glyph outside the current Noto subsets renders as `.notdef` tofu — re-subset via `apps/discord-worker/scripts/subset-cjk-fonts.py`.

## Dependencies

| Package | Purpose |
|---------|---------|
| `@xivdyetools/core` | Color algorithms, `classifyBandTier`, `abbreviateDyeName`, dye database (read-only) |
| `@xivdyetools/core/blending` | In-card color mixing |
| `@xivdyetools/types` | Shared type definitions (`Dye`, `HexColor`, `RGB`, `HSV`) |
| `@xivdyetools/test-utils` | Snapshot-test fixtures (devDependency) |

## Consumers

- [`apps/discord-worker`](../../apps/discord-worker/) — every generator; rasterizes via `resvg-wasm`.
- [`apps/stoat-worker`](../../apps/stoat-worker/) — Revolt bot mirror.
- [`@xivdyetools/bot-logic`](../bot-logic/) — orchestrates the command flows that call these generators.

`apps/og-worker` keeps its **own** local theme and SVG services; it is on the OG card directions, not this frame system.

## Credits & Acknowledgements

- **[resvg](https://github.com/linebender/resvg)** (MPL-2.0) — the rasterizer these SVG strings are designed for.
- Fonts, all under the [SIL Open Font License 1.1](https://openfontlicense.org/): [Noto Sans JP / SC / KR](https://fonts.google.com/noto), [Onest](https://fonts.google.com/specimen/Onest), [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), [Fragment Mono](https://fonts.google.com/specimen/Fragment+Mono).
- WCAG contrast ratios follow **WCAG 2.2 §1.4.3 / §1.4.11** (W3C).

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
