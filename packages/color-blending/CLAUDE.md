# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/color-blending` is a focused library that exposes **six color-blending algorithms** (RGB, LAB, OKLAB, RYB, HSL, Spectral/Kubelka-Munk) behind a single unified entry point: `blendColors(hex1, hex2, mode, ratio)`. It exists as its own package so consumers that only need pairwise blending (the Discord `mixer` command, the Revolt bot, future tools) don't have to pull in `@xivdyetools/core`'s full dye database, k-d tree, and Universalis client.

The package is intentionally tiny — one public function, one helper, six algorithm implementations, and a handful of conversion utilities. It has **zero internal dependencies** (REFACTOR-005, 2026-07-19): hex parsing is a local strict `hexToRgb` in `conversions.ts` that throws on malformed input.

## Commands

```bash
pnpm --filter @xivdyetools/color-blending run build
pnpm --filter @xivdyetools/color-blending run test
pnpm --filter @xivdyetools/color-blending run test:coverage
pnpm --filter @xivdyetools/color-blending run type-check
pnpm --filter @xivdyetools/color-blending run lint
pnpm --filter @xivdyetools/color-blending run clean
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/color-blending
pnpm turbo run test --filter=@xivdyetools/color-blending
pnpm --filter @xivdyetools/color-blending exec vitest run src/blending.test.ts
```

## Architecture

The package is a single-file public API plus a private conversions module. The dispatcher (`blendColors`) accepts a `BlendingMode` and routes to one of six private blend implementations; each implementation converts both inputs into the relevant color space, lerps the channels (with appropriate hue-arc handling for HSL), and converts back to RGB → hex.

### Key Directories

```
src/
├── index.ts        # Public API re-exports
├── types.ts        # BlendingMode, BLENDING_MODES, isValidBlendingMode, RGB, LAB, HSL, BlendResult
├── blending.ts     # blendColors dispatcher + 6 private blend* implementations
└── conversions.ts  # rgbToLab/labToRgb, rgbToOklab/oklabToRgb, rgbToRyb/rybToRgb,
                    # rgbToHsl/hslToRgb, rgbToReflectance/reflectanceToRgb,
                    # reflectanceToKS/ksToReflectance, rgbToHex
```

## Public API

```ts
type BlendingMode = 'rgb' | 'lab' | 'oklab' | 'ryb' | 'hsl' | 'spectral';

interface RGB { r: number; g: number; b: number; }    // 0–255
interface LAB { l: number; a: number; b: number; }    // L: 0–100, a/b: ~±128
interface HSL { h: number; s: number; l: number; }    // h: 0–360, s/l: 0–1
interface BlendResult { hex: string; rgb: RGB; }      // e.g. { hex: '#8B4513', rgb: {…} }

const BLENDING_MODES: Array<{ value: BlendingMode; name: string; description: string; }>;

function isValidBlendingMode(mode: string): mode is BlendingMode;
function blendColors(hex1: string, hex2: string, mode: BlendingMode, ratio?: number): BlendResult;
function getBlendingModeDescription(mode: BlendingMode): string;
function rgbToLab(rgb: RGB): LAB;   // Re-exported from conversions
```

`ratio` is clamped to `[0, 1]`: `0` returns `hex1`, `0.5` is an even mix, `1` returns `hex2`. `#` is optional in the inputs.

## Key Patterns / Algorithms

### When to pick which mode

| Mode       | Strength                                                              | Watch out for                              |
|------------|-----------------------------------------------------------------------|--------------------------------------------|
| `rgb`      | Cheapest, predictable channel averaging                               | Muddy mid-points; not perceptual           |
| `lab`      | CIELAB-uniform; legacy default                                        | Blue+Yellow trends purple-pink (LAB bias)  |
| `oklab`    | Modern perceptual; **Blue+Yellow = Green** as expected                | Slightly more compute than LAB             |
| `ryb`      | Artist's color wheel; intuitive for traditional palettes              | Not physically accurate                    |
| `hsl`      | Hue-shortest-arc interpolation; vivid                                 | Can over-saturate mid-points               |
| `spectral` | Kubelka-Munk per-channel reflectance → realistic pigment mixing       | Slowest; needs the K-M conversion path     |

### HSL hue interpolation
`blendHSL` uses a shortest-arc rule: if `|h2 - h1| > 180°`, it wraps in the other direction so blends never take the "long way around" the wheel.

### Spectral path
`blendSpectral` converts each channel via `rgbToReflectance` → `reflectanceToKS` (Kubelka-Munk transform K/S = (1-R)²/(2R)) → linear mix in K/S space → `ksToReflectance` → `reflectanceToRgb`. This is a per-channel approximation rather than a full spectral curve; for the full 380-750nm spectral mixer use `ColorService.mixColorsSpectral` from `@xivdyetools/core` (powered by `spectral.js`).

## Consumers

- `@xivdyetools/bot-logic` — drives the Discord `/mixer` command.
- `@xivdyetools/svg` — used by SVG card generators that need on-the-fly blends.
- `apps/discord-worker` — direct dependency for hex-input mixer flows.
- `apps/stoat-worker` — Revolt bot, same `/mixer`-style command.

## Internal Dependencies

None (REFACTOR-005, 2026-07-19 — the former `@xivdyetools/core` dependency for `ColorService.hexToRgb` was replaced with a local parser).

This package intentionally does **not** depend on `@xivdyetools/types` — its interface types (`RGB`, `LAB`, `HSL`, `BlendResult`) are local and lowercase-channel (`l`, not `L`), distinct from the branded types in `@xivdyetools/types`.

## Publishing

```bash
# 1. Bump version in packages/color-blending/package.json
# 2. Build + test
pnpm turbo run build test --filter=@xivdyetools/color-blending

# 3. Publish
pnpm --filter @xivdyetools/color-blending publish --provenance --access public --no-git-checks
```
