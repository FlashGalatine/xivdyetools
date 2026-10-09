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
| `executeDyeInfo(input)` | Dye info card (11B) with color values |
| `executeRandom(input)` | Row of up to 5 random dyes |
| `executeHarmony(input)` | Harmony palette (11A — found dye vs computed ideal; triadic, complementary, inverted-tetradic, …) |
| `executeGradient(input)` | N-step gradient (12H) with a ΔE2000 dye match per stop |
| `executeMixer(input)` | Ratio-sweep blend of two colors (12F; 6 blending modes) |
| `executeComparison(input)` | Side-by-side comparison of 2–4 dyes (14A / 14C) |
| `executeContrast(input)` | WCAG 1.4.11 contrast ratios for 2–4 dyes (13A/13B/13C) — new in 2.0.0 |
| `executeAccessibility(input)` | Colour-vision lens for one or two dyes, routed on `vision` (13D/13E/13H) |
| `executeSwatch(input)` | `.chara` character-file colour matching — new in 2.0.0 |
| `executeGlamour(input)` | `.chara` glamour reader — the gear, its dyes and what the file's character can wear; the caller injects `input.resolve` |

`executeMatch` was **removed in 2.0.0** (the v4 `/match` command is gone; colour → dye matching lives in discord-worker's `/extractor color` sheet). All distances are ΔE2000 and every result carries a card rendered by `@xivdyetools/svg` 2.0.0's frame system; every input accepts an optional `theme: 'dark' | 'light'`.

### Results and error codes

Each function returns a discriminated union (`{ ok: true; ... } | { ok: false; error: ...; errorMessage: string }`) and never throws across the boundary. On failure, `errorMessage` is already localized for the input's `locale`, and `error` is one of these codes:

| Function | `error` codes |
|----------|---------------|
| `executeDyeInfo` | `GENERATION_FAILED` |
| `executeRandom` | `NO_DYES`, `GENERATION_FAILED` |
| `executeHarmony` | `NO_MATCHES`, `GENERATION_FAILED` |
| `executeGradient` | `GENERATION_FAILED` |
| `executeMixer` | `NO_MATCHES`, `GENERATION_FAILED` |
| `executeComparison` | `NOT_ENOUGH_DYES`, `GENERATION_FAILED` |
| `executeContrast` | `NOT_ENOUGH_DYES`, `GENERATION_FAILED` |
| `executeAccessibility` | `NOT_ENOUGH_DYES`, `GENERATION_FAILED` |
| `executeSwatch` | `PARSE_FAILED`, `NO_LIVE_SLOTS`, `SLOT_MISSING`, `GENERATION_FAILED` |
| `executeGlamour` | `PARSE_FAILED`, `NO_GEAR`, `RESOLVE_FAILED`, `RESOLVE_BUSY`, `GENERATION_FAILED` |

`NOT_ENOUGH_DYES` is the caller's mistake, refused before any rendering: `executeComparison` and `executeContrast` need at least two dyes, and `executeAccessibility` needs at least one. A missing or non-array `dyes` gets the same code. If your code switches exhaustively on `error`, give it a `NOT_ENOUGH_DYES` case.

### Logging

Every input takes an optional `logger: { warn(message: string): void }`. It receives the translator's missing-key warnings, `executeHarmony`'s `[harmony] unknown colour wheel "<wheel>" — using rgb` when `wheel` is not a known id, and one line for each failure the command catches:

```
[mixer] generation failed: TypeError
[gradient] generation failed: AppError INVALID_HEX_COLOR
[swatch] parse failed: AppError INVALID_INPUT
[glamour] generation failed: string
[glamour] resolve failed: Error (status 503)
```

Each command logs under its own tag (`[dye info]` and `[dye random]` for the two dye commands). The line gives the error's class, plus its `code` when it carries a string one (an `AppError`'s code, for example). A thrown non-Error is named by its `typeof`. The line never includes the error message, because a message can quote what the user typed or a value from their `.chara` file. `[glamour] resolve failed` is written only for `RESOLVE_FAILED`: a busy resolver (HTTP 429) and a refused file (400/413/422) are expected answers and are not logged.

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
// → { hex: '#FF6B6B', name: 'Coral Pink', id: 5741, itemID: 5741, dye: Dye }   // id === itemID (Coral Pink, stainID 13)

// Resolve directly to a Dye object (second arg is the locale whose dye names
// should also match; English-only by default)
const dye = resolveDyeInput('jet black');
// → Dye { name: 'Jet Black', hex: '#1e1e1e', ... }

// A bare number of 1–5 digits is a dye id: a stainID (1–254) or a legacy
// item id (5729 and up). Six bare digits are always a hex colour.
resolveColorInput('101');      // → { name: 'Pure White', stainID: 101, dye, ... }
resolveColorInput('13114');    // → Pure White again, by its legacy item id
resolveColorInput('013114');   // → { hex: '#013114' }: a colour, never a padded id

// CSS color names work too — but only when no dye name matches first, so
// 'coral' resolves to the DYE Coral Pink, not to CSS coral (#FF7F50).
const css = resolveColorInput('burlywood');
// → { hex: '#DEB887' }
```

`resolveColorInput` trims the input, then tries these in order. The first one that applies decides:

1. **A bare number other than six digits** is a dye id. 1–5 digits look up a stainID (1–254) or a legacy item id (5729 and up). Any other number, including zero, the gap between the two ranges and seven or more digits, resolves to `null`. It never falls through to the hex or name steps, so `'101'` is Pure White rather than the shorthand for `#110011`.
2. **Hex**: `#FF0000`, `FF0000`, `#F00`, `F00`, and six bare digits such as `'000000'`. A 3-character shorthand without `#` must contain a hex letter, since three bare digits are an id.
3. **Dye name**: a case-insensitive partial match on the English name, and on the localized name when `options.locale` is set and `initializeLocale(locale)` has run.
4. **CSS color name**: one of the 148 standard names.

`resolveDyeInput` returns a `Dye` or `null`. It trims the input and tries 1–5 digit ids, then dye names (English plus `locale`), then a full six-character hex code (`#FF0000`, `FF0000`, or six bare digits), which it answers with the closest dye. It has no shorthand step and no CSS step, so anything else returns `null`.

### Multi-Dye Commands

```typescript
import { executeGradient, executeComparison } from '@xivdyetools/bot-logic';

// Gradient between two dyes
const gradient = await executeGradient({
  startColor: resolveColorInput('Pure White')!,
  endColor: resolveColorInput('Jet Black')!,
  stepCount: 7,           // default 6, including both ends
  colorSpace: 'oklch',    // InterpolationMode
  matchingMethod: 'ciede2000',
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

- `resolveColorInput(input, options?)` — Resolves dye ids, hex codes, dye names, or CSS color names to a `ResolvedColor`. Order is 1–5 digit id → hex (six bare digits included) → dye name → CSS name, so a dye name always beats a CSS name. Surrounding whitespace is ignored. See [Input Resolution](#input-resolution) above.
- `resolveDyeInput(input, locale = 'en')` — Resolves input directly to a `Dye` object (or `null`): 1–5 digit id → dye name → closest dye to a six-character hex
- `isValidHex(input)` — Validates hex color strings
- `normalizeHex(input)` — Normalizes to `#RRGGBB` format

### Localization

- `initializeLocale(locale)` — Loads locale data for dye name lookups
- `getLocalizedDyeName(itemID, fallback, locale)` — Returns localized dye name
- `getLocalizedCategory(category, locale)` — Returns localized category name

### Constants

- `dyeService` — Shared `DyeService` singleton instance
- `HARMONY_TYPES` — The ten color harmony types: `triadic`, `complementary`, `analogous`, `split-complementary`, `tetradic`, `inverted-tetradic`, `square`, `monochromatic`, `compound`, `shades`
- `VISION_TYPES` — Colorblindness simulation types

`HarmonyInput` also takes `wheel?: ColorWheelId` — the colour wheel the harmony
offsets are measured on (`'rgb'` default, plus `'ryb'`, `'munsell'`,
`'oklch-hue'`, `'oklch-lightness'`; the list lives in core's `COLOR_WHEEL_IDS`).
The older `harmonyOptions` field is ignored since PR #159.

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

The same subpath exports `resolveUserLocale`, which both Discord bots use to pick a user's language:

```typescript
import { resolveUserLocale } from '@xivdyetools/bot-logic/i18n';

// kv: anything with get(key): Promise<string | null>, e.g. a Workers KVNamespace
const locale = await resolveUserLocale(kv, userId, interaction.locale, logger);
```

It tries the unified preferences blob (`prefs:v1:<id>`), then the legacy key (`i18n:user:<id>`), then the Discord client locale, then English. A failed KV read or a malformed blob falls through to the next step and never throws. The fourth argument, `logger?: { error(message: string, error?: Error): void }`, is optional, and `@xivdyetools/logger`'s `ExtendedLogger` fits it. When it is passed, each degraded step gets one line. The messages are fixed and do not include the user id. A failed KV read passes the KV's own `Error` through unchanged, or no error object if the KV rejected with something that is not an `Error`. A malformed blob is logged without its contents. Without a logger, those failures are silent.

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
