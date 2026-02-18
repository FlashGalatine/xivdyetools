# Shared Libraries — `@xivdyetools/svg`

**Parent document:** [06-shared-libraries.md](./06-shared-libraries.md)

Covers: SVG card generators, base primitives, font/theme configuration, rendering boundary, extraction plan.

---

## Purpose

Platform-agnostic SVG string generation for all dye visualization cards. Every function in this package is a **pure function**: structured data in, SVG string out. No rendering, no font file loading, no I/O, no WASM — just string manipulation.

The rendering step (SVG → PNG) stays **platform-specific**: `@resvg/resvg-wasm` for Cloudflare Workers, `@resvg/resvg-js` for Node.js. Each bot wraps this package's SVG output in its own ~20-line renderer.

---

## Current Location

**Source:** `xivdyetools-discord-worker/src/services/svg/` (12 source files + 9 test files)

| File | Lines | Export | Purpose |
|------|-------|--------|---------|
| `base.ts` | 265 | Primitives + constants | SVG element builders, `FONTS`, `THEME`, color utilities |
| `harmony-wheel.ts` | 244 | `generateHarmonyWheel()` | Color harmony wheel with conic gradient ring, connection lines, dye nodes |
| `gradient.ts` | 216 | `generateGradientBar()`, `interpolateColor()`, `generateGradientColors()` | Color gradient progression strip with hex labels and dye names |
| `dye-info-card.ts` | 319 | `generateDyeInfoCard()` | Individual dye detail card: large swatch + HEX/RGB/HSV/LAB/ID values |
| `palette-grid.ts` | ~200 | `generatePaletteGrid()` | Extracted color palette grid (from image extraction) |
| `comparison-grid.ts` | ~250 | `generateComparisonGrid()` | Multi-dye side-by-side comparison |
| `contrast-matrix.ts` | ~200 | `generateContrastMatrix()` | WCAG contrast analysis matrix |
| `accessibility-comparison.ts` | ~250 | `generateAccessibilityComparison()` | Colorblindness simulation comparison |
| `preset-swatch.ts` | ~150 | `generatePresetSwatch()` | Community preset color swatch card |
| `random-dyes-grid.ts` | ~150 | `generateRandomDyesGrid()` | Random dyes grid layout |
| `budget-comparison.ts` | ~200 | `generateBudgetComparison()` | Budget dye comparison visual |
| `renderer.ts` | 132 | `renderSvgToPng()`, `initRenderer()` | resvg-wasm rendering — **stays in Discord Worker** |
| `index.ts` | 15 | Barrel re-exports | Public API surface |

**Estimated total:** ~2,500 lines of card generators (excluding renderer and tests).

---

## Architecture: The SVG/Render Split

```
@xivdyetools/svg                    Platform-Specific
┌──────────────────────┐        ┌──────────────────────────────┐
│                      │        │  Discord Worker              │
│  generateHarmonyWheel()        │    renderer.ts (resvg-wasm)  │
│  generateDyeInfoCard()  ──SVG──▶   fonts.ts (binary imports)  │
│  generateGradientBar()  string │    renderSvgToPng(svg)       │
│  ... (11 generators)  │        │                              │
│                      │        ├──────────────────────────────┤
│  base.ts             │        │  Stoat Bot                   │
│    rect(), circle(),  │        │    renderer.ts (resvg-js)    │
│    text(), line(),    │        │    fonts loaded via fs       │
│    FONTS, THEME       │        │    renderSvgToPng(svg)       │
└──────────────────────┘        └──────────────────────────────┘
```

**Key principle:** The SVG generators don't know or care how the SVG will be rendered. They reference font family *names* (e.g., `'Space Grotesk'`), but the actual `.ttf` files are loaded by each bot's renderer.

---

## Base Primitives (`base.ts`)

### SVG Element Builders

These are thin wrappers that generate SVG element strings with proper attribute handling:

```typescript
// Rectangle with optional rounded corners, stroke, opacity
rect(x, y, width, height, fill, { rx?, ry?, stroke?, strokeWidth?, opacity? }): string

// Circle with optional stroke and opacity
circle(cx, cy, r, fill, { stroke?, strokeWidth?, opacity? }): string

// Line with optional opacity and dash pattern
line(x1, y1, x2, y2, stroke, strokeWidth?, { opacity?, dashArray? }): string

// Text element with typography options (fill, font, alignment)
text(x, y, content, { fill?, fontSize?, fontFamily?, fontWeight?, textAnchor?, dominantBaseline? }): string

// Arc path for pie/donut segments (returns path data string, not a full element)
arcPath(cx, cy, radius, startAngle, endAngle): string

// Group wrapper with optional transform
group(content, transform?): string

// Full SVG document wrapper with xmlns and viewBox
createSvgDocument(width, height, content): string

// XML escape for safe text inclusion
escapeXml(str): string
```

### Color Utilities

These simple helpers are used by the card generators for contrast decisions and color display:

```typescript
// Parse hex to RGB components
hexToRgb(hex: string): { r: number; g: number; b: number }

// Format RGB to hex string
rgbToHex(r: number, g: number, b: number): string

// Relative luminance (for WCAG contrast)
getLuminance(hex: string): number

// Choose black or white text based on background luminance
getContrastTextColor(bgHex: string): string
```

**Note:** `hexToRgb` and `rgbToHex` overlap with `@xivdyetools/core`'s `ColorService`. These are intentionally duplicated as lightweight local helpers (5 lines each) to avoid pulling the full `ColorService` into every SVG element. The base utilities need to work with just a hex string — no Dye objects, no database.

### Theme Constants

```typescript
export const THEME = {
  background: '#1a1a2e',        // Dark navy background
  backgroundLight: '#2d2d3d',   // Slightly lighter for sections
  text: '#ffffff',              // Primary text
  textMuted: '#909090',         // Secondary text (labels)
  textDim: '#666666',           // Tertiary text (footer, metadata)
  accent: '#5865f2',            // Brand accent (Discord Blurple — may change for Stoat)
  border: '#404050',            // Subtle borders
  success: '#57f287',           // Green
  warning: '#fee75c',           // Yellow
  error: '#ed4245',             // Red
} as const;
```

**Accent color note:** `THEME.accent` is currently `#5865f2` (Discord Blurple). For the Stoat bot, this may be overridden to match Stoat's branding. Options:

1. Keep Blurple as-is (XIV Dye Tools brand, not Discord brand)
2. Change to a neutral accent (e.g., the existing `#5865f2` is close enough to be "our" color)
3. Make it configurable per-consumer (via the `FontConfig` pattern below)

**Recommendation:** Keep as-is. The accent is used sparingly (a few badge backgrounds, the "XIV Dye Tools" footer tint). It reads as "tool brand" rather than "Discord brand."

### Font Configuration

```typescript
export const FONTS = {
  header: 'Space Grotesk',                           // Titles, headers
  primary: 'Onest',                                   // Body text, labels
  mono: 'Habibi',                                     // Hex codes, technical values
  cjk: 'Noto Sans SC, Noto Sans KR',                 // CJK fallback
  headerCjk: 'Space Grotesk, Noto Sans SC, Noto Sans KR',  // Headers with CJK
  primaryCjk: 'Onest, Noto Sans SC, Noto Sans KR',         // Body with CJK
} as const;
```

**Why these are in the SVG package:** Every SVG generator references `FONTS.headerCjk` or `FONTS.primaryCjk` in `font-family` attributes for localized dye names. The font *names* are part of the SVG contract — they must match what the renderer loads from `.ttf` files.

**Configurability:** The `FONTS` constant is exported as a default. If a consumer needs different fonts (unlikely, but possible), they can build a custom `FontConfig` and pass it via options. For v1, the hardcoded default is sufficient — both bots use the same fonts.

```typescript
// Future extensibility (not needed for v1):
export interface FontConfig {
  header: string;
  primary: string;
  mono: string;
  cjk: string;
  headerCjk: string;
  primaryCjk: string;
}
```

---

## Card Generator API Patterns

Every card generator follows the same pattern:

1. **Input:** An options object with typed data (dyes, colors, dimensions)
2. **Processing:** Build an array of SVG element strings using base primitives
3. **Output:** Wrap in `createSvgDocument()` and return the SVG string

```typescript
// Example: generateDyeInfoCard
export interface DyeInfoCardOptions {
  dye: Dye;                    // From @xivdyetools/core
  localizedName?: string;       // Pre-resolved localized name
  localizedCategory?: string;   // Pre-resolved localized category
  width?: number;               // Default: 500
}

export function generateDyeInfoCard(options: DyeInfoCardOptions): string {
  // 1. Calculate derived values (RGB, HSV, LAB from dye.hex)
  // 2. Build SVG elements array
  // 3. Return createSvgDocument(width, height, elements.join('\n'))
}
```

**Key design choice:** Localized names are passed *in*, not resolved internally. The SVG package doesn't import `LocalizationService` or know about user preferences. The caller (bot-logic or command handler) resolves the locale and passes the final display strings.

### Card Generator Reference

| Generator | Input | Output | Used By Commands |
|-----------|-------|--------|-----------------|
| `generateDyeInfoCard(opts)` | Single `Dye` + localized strings | 500×280 card with swatch + color values | `/dye info`, `!xd info` |
| `generateHarmonyWheel(opts)` | Base color + harmony dyes | 600×600 color wheel with nodes + lines | `/harmony`, `!xd harmony` |
| `generateGradientBar(opts)` | Array of gradient steps | 800×200 horizontal bar with labels | `/gradient`, `!xd gradient` |
| `generatePaletteGrid(opts)` | Array of extracted palette colors | Grid of matched dye swatches | `/extractor image`, `!xd extract` |
| `generateComparisonGrid(opts)` | 2–4 dyes | Side-by-side comparison layout | `/comparison`, `!xd comparison` |
| `generateContrastMatrix(opts)` | Array of dyes | NxN WCAG contrast ratio matrix | `/accessibility`, `!xd a11y` |
| `generateAccessibilityComparison(opts)` | Dye + colorblind simulations | Before/after simulation grid | `/accessibility`, `!xd a11y` |
| `generatePresetSwatch(opts)` | Preset with dye array | Multi-color swatch card | `/preset view` |
| `generateRandomDyesGrid(opts)` | 5 random dyes | 5-cell grid with names + values | `/dye random`, `!xd random` |
| `generateBudgetComparison(opts)` | Dye + price-ranked alternatives | Cost comparison visual | `/budget find` |
| `interpolateColor(c1, c2, ratio)` | Two hex colors + ratio | Interpolated hex string | Gradient helpers |
| `generateGradientColors(start, end, n)` | Start/end colors + step count | Array of hex strings | Gradient generation |

---

## Cross-Package Import: `rgbToLab`

`dye-info-card.ts` currently imports `rgbToLab` from `../color-blending.js` to display LAB values on the info card:

```typescript
import { rgbToLab } from '../color-blending.js';
```

After extraction, this becomes:

```typescript
import { rgbToLab } from '@xivdyetools/color-blending';
```

This is why `@xivdyetools/color-blending` must be extracted **before** `@xivdyetools/svg`.

---

## Package Structure

```
xivdyetools-svg/
  src/
    index.ts                       ← Barrel re-exports
    base.ts                        ← Primitives, FONTS, THEME, color utils
    cards/
      dye-info-card.ts
      harmony-wheel.ts
      gradient.ts
      palette-grid.ts
      comparison-grid.ts
      contrast-matrix.ts
      accessibility-comparison.ts
      preset-swatch.ts
      random-dyes-grid.ts
      budget-comparison.ts
  tests/
    base.test.ts
    dye-info-card.test.ts
    harmony-wheel.test.ts
    gradient.test.ts
    palette-grid.test.ts
    comparison-grid.test.ts
    contrast-matrix.test.ts
    accessibility-comparison.test.ts
    preset-swatch.test.ts
    random-dyes-grid.test.ts
    budget-comparison.test.ts
    integration/
      svg-pipeline.integration.test.ts   ← Visual regression with resvg-js
  package.json
  tsconfig.json
  vitest.config.ts
```

---

## Dependencies

```
@xivdyetools/types
        |
@xivdyetools/core ─────────────── @xivdyetools/color-blending
        |                                    |
        +────────────+──────────────────────+
                     |
              @xivdyetools/svg
```

- **`@xivdyetools/core`** — for the `Dye` type used in card generator option interfaces
- **`@xivdyetools/color-blending`** — for `rgbToLab()` used by `dye-info-card.ts`
- **`@xivdyetools/types`** — for shared type definitions

**Zero binary dependencies.** No WASM, no native modules, no font files.

---

## Extraction Plan

### Step 1: Extract `@xivdyetools/color-blending` first

This package depends on it. See [06a-color-blending.md](./06a-color-blending.md).

### Step 2: Create the package

Move all files from `discord-worker/src/services/svg/` **except**:
- `renderer.ts` — stays in Discord Worker (WASM-specific)
- `index.ts` — recreated in the new package (without renderer export)
- Test files — migrate to the new package's test directory

### Step 3: Update Discord Worker's SVG directory

After extraction, `discord-worker/src/services/svg/` contains only:

```
services/svg/
  renderer.ts        ← resvg-wasm rendering (stays)
  renderer.test.ts   ← Renderer tests (stays)
```

All card generator imports switch:

```typescript
// Before:
import { generateHarmonyWheel } from '../services/svg/harmony-wheel.js';
import { THEME, FONTS } from '../services/svg/base.js';

// After:
import { generateHarmonyWheel, THEME, FONTS } from '@xivdyetools/svg';
```

### Step 4: Update `renderer.ts` to import from the package

```typescript
// renderer.ts needs no changes to its rendering logic.
// It receives SVG strings from command handlers (who get them from @xivdyetools/svg).
// The renderer doesn't import from the SVG package — it just takes a string.
```

### Step 5: Stoat Bot renderer

The Stoat Bot writes its own renderer (~20 lines):

```typescript
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';

// Load font buffers once at startup
const fontBuffers = [
  fs.readFileSync('./fonts/Onest-VariableFont_wght.ttf'),
  fs.readFileSync('./fonts/SpaceGrotesk-VariableFont_wght.ttf'),
  fs.readFileSync('./fonts/Habibi-Regular.ttf'),
  fs.readFileSync('./fonts/NotoSansSC-Subset.ttf'),
  fs.readFileSync('./fonts/NotoSansKR-Variable.ttf'),
];

export function renderSvgToPng(svgString: string, scale: number = 2): Buffer {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'zoom', value: scale },
    font: {
      fontBuffers,
      defaultFontFamily: 'Onest',
    },
  });

  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}
```

That's it. Same SVG input, same PNG output, different runtime.

---

## Testing Strategy

### Unit Tests

Each card generator gets unit tests verifying:

1. **Expected SVG elements** — the output string contains the right `<rect>`, `<text>`, `<circle>` elements
2. **Layout dimensions** — output SVG width/height matches specified or default dimensions
3. **Text content** — dye names, hex values, labels appear correctly (XML-escaped)
4. **CJK font usage** — localized dye name elements use `FONTS.headerCjk` or `FONTS.primaryCjk`
5. **Edge cases** — very long dye names (truncation), achromatic colors (gray wheel positioning), missing optional fields

### Snapshot Tests

SVG output is deterministic (same input always produces same string), making snapshot tests ideal for regression detection:

```typescript
test('harmony wheel snapshot', () => {
  const svg = generateHarmonyWheel({
    baseColor: '#ECECEC',
    baseName: 'Snow White',
    harmonyType: 'triadic',
    dyes: [
      { id: 1, name: 'Rose Pink', hex: '#CC8899', category: 'Pinks' },
      { id: 2, name: 'Celeste Green', hex: '#88CCAA', category: 'Greens' },
      { id: 3, name: 'Ceruleum Blue', hex: '#8899CC', category: 'Blues' },
    ],
  });
  expect(svg).toMatchSnapshot();
});
```

### Visual Regression (Integration)

For catching visual bugs that snapshot tests miss (e.g., overlapping elements, color contrast issues), use `@resvg/resvg-js` in integration tests to render SVGs to PNG and compare against baseline images:

```typescript
test('dye info card renders without visual regressions', async () => {
  const svg = generateDyeInfoCard({ dye: mockDye, localizedName: 'スノウホワイト' });
  const png = renderSvgToPng(svg); // @resvg/resvg-js
  expect(png).toMatchImageSnapshot({ failureThreshold: 0.01 });
});
```

These integration tests live in the SVG package (not the Discord Worker) since they test the SVG output quality, not the Discord-specific rendering pipeline. They use `@resvg/resvg-js` (Node.js native) as a dev dependency.

### Existing Tests Migration

The Discord Worker currently has these SVG test files:
- `base.test.ts`, `harmony-wheel.test.ts`, `gradient.test.ts`
- `accessibility-comparison.test.ts`, `comparison-grid.test.ts`, `contrast-matrix.test.ts`
- `palette-grid.test.ts`, `preset-swatch.test.ts`
- `index.test.ts` (barrel export tests)
- `svg-pipeline.integration.test.ts` (end-to-end SVG→PNG test)

All of these migrate to the new package. The Discord Worker's SVG test coverage drops to just `renderer.test.ts`.
