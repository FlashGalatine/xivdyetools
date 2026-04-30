# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/svg` is a collection of **pure SVG card generators**: each top-level export is a function that takes data (dyes, colors, options) and returns an SVG **string**. The package never touches the filesystem, never opens a network connection, and never rasterizes — turning the SVG into a PNG (via `resvg-wasm`, `@resvg/resvg-js`, or any other rasterizer) is the consumer's responsibility. This boundary keeps the package safe for Cloudflare Workers (which use `resvg-wasm`), Node bots, and any other runtime.

The cards cover every visual the Discord bot and stoat (Revolt) bot need: harmony wheel, gradient bar, palette grid, accessibility/colorblind comparison, WCAG contrast matrix, random-dyes grid, dye-comparison grid, dye-info card, preset swatch, and budget comparison.

## Commands

```bash
pnpm --filter @xivdyetools/svg run build
pnpm --filter @xivdyetools/svg run test
pnpm --filter @xivdyetools/svg run test:coverage
pnpm --filter @xivdyetools/svg run type-check
pnpm --filter @xivdyetools/svg run lint
pnpm --filter @xivdyetools/svg run clean
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/svg
pnpm turbo run test --filter=@xivdyetools/svg
pnpm --filter @xivdyetools/svg exec vitest run src/harmony-wheel.test.ts
```

## Architecture

Every generator is a **standalone module** named after its output (e.g., `harmony-wheel.ts`, `palette-grid.ts`). Generators import shared layout primitives from `base.ts` (`rect`, `circle`, `line`, `text`, `arcPath`, `group`, `createSvgDocument`, theme/font constants, XML escaping, color helpers). There is no class hierarchy, no shared base generator — each module is independently testable and composable.

Rendering to PNG happens **outside** this package. Consuming workers feed the generated SVG string into `resvg-wasm` (Cloudflare) or `@resvg/resvg-js` (Node), supplying the bundled font files (Onest, Space Grotesk, Habibi, Noto Sans SC + KR subsets). Subset CJK fonts must be regenerated whenever new dye names introduce previously-unseen glyphs — see the workspace `MEMORY.md` for the `fonttools` workflow.

### Key Directories

```
src/
├── index.ts                       # Public API re-exports
├── base.ts                        # XML escape, hex/RGB helpers, primitives, THEME, FONTS
├── harmony-wheel.ts               # Color-wheel SVG (triadic/complementary/analogous/...)
├── gradient.ts                    # Gradient bar + interpolation helpers
├── palette-grid.ts                # K-means extraction match results grid
├── accessibility-comparison.ts    # Side-by-side colorblind simulation card
├── contrast-matrix.ts             # WCAG AA/AAA contrast grid
├── random-dyes-grid.ts            # /random output grid
├── comparison-grid.ts             # /compare output grid
├── dye-info-card.ts               # Single-dye detail card
├── preset-swatch.ts               # Curated preset display + compact variant
└── budget-comparison.ts           # Universalis budget/price comparison + error/no-data variants
```

`src/fonts/` (when present) holds the subset CJK font files used by consumers; the bundled font names are referenced by `FONTS.cjk` / `FONTS.headerCjk` / `FONTS.primaryCjk`.

## Public API

### Base utilities (`base.ts`)

```ts
function escapeXml(str: string): string;
function hexToRgb(hex: string): { r: number; g: number; b: number };
function rgbToHex(r: number, g: number, b: number): string;
function getLuminance(hex: string): number;                  // WCAG relative luminance
function getContrastTextColor(bgHex: string): '#000000' | '#ffffff';
function rgbToHsv(r, g, b): { h, s, v };
function createSvgDocument(width, height, content): string;
function rect(x, y, w, h, fill, options?): string;
function circle(cx, cy, r, fill, options?): string;
function line(x1, y1, x2, y2, stroke, strokeWidth?, options?): string;
function text(x, y, content, options?): string;              // auto-XML-escapes content
function arcPath(cx, cy, r, startAngle, endAngle): string;
function group(content, transform?): string;
function truncateText(s, maxLength): string;                 // appends U+2026 …
function estimateTextWidth(s, charWidth): number;            // counts CJK as 2x

const THEME: { background, backgroundLight, text, textMuted, textDim,
                accent, border, success, warning, error };  // dark-themed palette
const FONTS: {
  header: 'Space Grotesk',
  primary: 'Onest',
  mono: 'Habibi',
  cjk: 'Noto Sans SC, Noto Sans KR',
  headerCjk: 'Space Grotesk, Noto Sans SC, Noto Sans KR',
  primaryCjk: 'Onest, Noto Sans SC, Noto Sans KR',
};
```

### Generators (one per card)

```ts
generateHarmonyWheel(opts: HarmonyWheelOptions): string;
  type HarmonyDye, HarmonyWheelOptions;

generateGradientBar(opts: GradientBarOptions): string;
interpolateColor(hex1, hex2, t): string;
generateGradientColors(hex1, hex2, steps): string[];
  type GradientStep, GradientBarOptions;

generatePaletteGrid(opts: PaletteGridOptions): string;
getMatchQuality(distance: number): MatchQuality;
const MATCH_QUALITIES;
  type PaletteEntry, PaletteGridOptions, PaletteGridLabels, MatchQuality;

generateAccessibilityComparison(opts: AccessibilityComparisonOptions): string;
generateCompactAccessibilityRow(opts): string;
  type AccessibilityComparisonOptions, VisionType, AllVisionTypes;

generateContrastMatrix(opts: ContrastMatrixOptions): string;
calculateContrast(hex1, hex2): number;
  type ContrastDye, ContrastMatrixOptions, ContrastResult, WCAGLevel;

generateRandomDyesGrid(opts: RandomDyesGridOptions): string;
  type RandomDyeInfo, RandomDyesGridOptions;

generateComparisonGrid(opts: ComparisonGridOptions): string;
  type ComparisonGridOptions;

generateDyeInfoCard(opts: DyeInfoCardOptions): string;
  type DyeInfoCardOptions;

generatePresetSwatch(opts: PresetSwatchOptions): string;
generateCompactPresetSwatch(opts): string;
const CATEGORY_DISPLAY;
  type PresetSwatchOptions;

generateBudgetComparison(opts: BudgetComparisonOptions): string;
generateNoWorldSetSvg(labels): string;
generateErrorSvg(message): string;
formatGil(amount: number): string;
  type DyePriceData, BudgetSuggestion, BudgetSortOption,
       BudgetSvgLabels, BudgetComparisonOptions;
```

## Key Patterns / Algorithms

### Pure function contract
Every `generate*` returns a self-contained `<svg>` string with all required namespace attributes (`xmlns="http://www.w3.org/2000/svg"`, `viewBox`). There is no shared mutable state — calling a generator twice with the same input produces byte-identical output, which makes snapshot testing the natural choice for `*.test.ts`.

### XML escaping
`base.ts::text()` always feeds its content through `escapeXml`. **Do not** manually concatenate user-supplied strings into raw `<text>` blocks — call `text()` or run `escapeXml()` first.

### CJK-safe text widths
`estimateTextWidth(s, charWidth)` counts CJK ideographs (U+3000-U+9FFF), Hangul (U+AC00-U+D7AF), and CJK compatibility (U+F900-U+FAFF) as **2x** Latin width. This is what the truncation logic in `comparison-grid`, `dye-info-card`, etc. uses to decide where to slice with the U+2026 ellipsis.

### Font fallback chain
Localized text (dye names, category labels) uses `FONTS.primaryCjk` or `FONTS.headerCjk`. Static English chrome (footers, axis labels) can use the plain `FONTS.primary` / `FONTS.header`. The fallback chain `'Onest, Noto Sans SC, Noto Sans KR'` covers Latin → SC (Chinese + Japanese katakana) → KR (Korean Hangul) — Noto Sans SC has **zero Hangul glyphs**, so KR must come after it.

### Rendering boundary (consumer's responsibility)
`generate*` produces SVG only. Consuming code must:
1. Load font files (Onest variable, Space Grotesk variable, Habibi regular, Noto Sans SC + KR subsets).
2. Pass the SVG and font byte buffers into `resvg-wasm` / `@resvg/resvg-js` / similar.
3. Return the resulting PNG bytes to Discord, Revolt, etc.

If a new dye introduces a glyph outside the current Noto subset, the rasterizer will fall back to `.notdef` (a tofu box). Re-subset the fonts using the workflow in the workspace memory.

## Consumers

- `apps/discord-worker` — uses every generator; rasterizes via `resvg-wasm`.
- `apps/stoat-worker` — Revolt bot mirror.
- `@xivdyetools/bot-logic` — orchestrates command flows that call into these generators.

## Internal Dependencies

- `@xivdyetools/core` — color algorithms, dye database (read-only).
- `@xivdyetools/color-blending` — in-card color mixing.
- `@xivdyetools/types` — shared `Dye`, `HexColor`, etc.
- `@xivdyetools/test-utils` (devDependency) — fixtures for snapshot tests.

## Publishing

```bash
# 1. Bump version in packages/svg/package.json
# 2. Build + test
pnpm turbo run build test --filter=@xivdyetools/svg

# 3. Publish
pnpm --filter @xivdyetools/svg publish --provenance --access public --no-git-checks
```
