# Font Strategy

This document outlines the font handling approach for SVG generation in the Cloudflare Workers Discord bot.

---

## Brand Fonts

| Font | Usage | File | Weight Range |
|------|-------|------|--------------|
| **Space Grotesk** | Headers (H1, H2, H3) | `SpaceGrotesk-VariableFont_wght.ttf` | 300-700 |
| **Onest** | Body text, labels | `Onest-VariableFont_wght.ttf` | 100-900 |
| **Habibi** | Hex codes | `Habibi-Regular.ttf` | 400 (Regular only) |

Space Grotesk and Onest are variable fonts from Google Fonts. Habibi is a static font (single weight). All are open source (OFL license).

---

## Font File Strategy

### Option A: Use Variable Fonts + Static Font (Recommended)
**Simpler setup, full flexibility**

| Font | Size | Notes |
|------|------|-------|
| Space Grotesk (variable) | ~85KB | Supports weight 300-700 |
| Onest (variable) | ~95KB | Supports weight 100-900 |
| Habibi (static) | ~25KB | Regular weight only |
| **Total** | **~205KB** | Added to Worker bundle |

```typescript
// Load all fonts at Worker startup
const fonts = await Promise.all([
  env.FONTS.get('SpaceGrotesk-VariableFont_wght.ttf', 'arrayBuffer'),
  env.FONTS.get('Onest-VariableFont_wght.ttf', 'arrayBuffer'),
  env.FONTS.get('Habibi-Regular.ttf', 'arrayBuffer'),
]);
```

### Option B: Extract Static Weights
**Smaller bundle, limited weights**

Use a tool like `fonttools` to extract only needed weights:

```bash
# Install fonttools
pip install fonttools

# Extract specific weights from variable font
fonttools varLib.instancer SpaceGrotesk-VariableFont_wght.ttf wght=700 -o SpaceGrotesk-Bold.ttf
fonttools varLib.instancer Onest-VariableFont_wght.ttf wght=400 -o Onest-Regular.ttf
fonttools varLib.instancer Onest-VariableFont_wght.ttf wght=500 -o Onest-Medium.ttf
# Habibi is already static, no extraction needed
```

| Font | Static Size | Usage |
|------|------------|-------|
| SpaceGrotesk-Bold | ~25KB | Headers |
| Onest-Regular | ~25KB | Body text |
| Onest-Medium | ~25KB | Labels, emphasis |
| Habibi-Regular | ~25KB | Hex codes |
| **Total** | **~100KB** | 50% smaller than variable |

---

## Recommended Weights for Discord Bot

Based on typical Discord embed layouts:

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Command title | Space Grotesk | 700 (Bold) | 24px |
| Section headers | Space Grotesk | 600 (SemiBold) | 18px |
| Dye names | Onest | 500 (Medium) | 14px |
| Hex codes | Habibi | 400 (Regular) | 12px |
| Small labels | Onest | 400 (Regular) | 11px |

---

## Implementation

### 1. Store Fonts in R2

```bash
# Create fonts bucket or use existing assets bucket
wrangler r2 object put xivdyetools-assets/fonts/SpaceGrotesk-VariableFont_wght.ttf \
  --file ./fonts/SpaceGrotesk-VariableFont_wght.ttf

wrangler r2 object put xivdyetools-assets/fonts/Onest-VariableFont_wght.ttf \
  --file ./fonts/Onest-VariableFont_wght.ttf

wrangler r2 object put xivdyetools-assets/fonts/Habibi-Regular.ttf \
  --file ./fonts/Habibi-Regular.ttf
```

### 2. Font Loading Service

```typescript
// src/services/fonts.ts

interface FontCache {
  spaceGrotesk: ArrayBuffer | null;
  onest: ArrayBuffer | null;
  habibi: ArrayBuffer | null;
  loaded: boolean;
}

const fontCache: FontCache = {
  spaceGrotesk: null,
  onest: null,
  habibi: null,
  loaded: false,
};

export async function loadFonts(env: Env): Promise<void> {
  if (fontCache.loaded) return;

  const [spaceGrotesk, onest, habibi] = await Promise.all([
    env.ASSETS.get('fonts/SpaceGrotesk-VariableFont_wght.ttf', 'arrayBuffer'),
    env.ASSETS.get('fonts/Onest-VariableFont_wght.ttf', 'arrayBuffer'),
    env.ASSETS.get('fonts/Habibi-Regular.ttf', 'arrayBuffer'),
  ]);

  if (!spaceGrotesk || !onest || !habibi) {
    throw new Error('Failed to load fonts from R2');
  }

  fontCache.spaceGrotesk = spaceGrotesk;
  fontCache.onest = onest;
  fontCache.habibi = habibi;
  fontCache.loaded = true;
}

export function getFontFiles(): Uint8Array[] {
  if (!fontCache.loaded) {
    throw new Error('Fonts not loaded. Call loadFonts() first.');
  }

  return [
    new Uint8Array(fontCache.spaceGrotesk!),
    new Uint8Array(fontCache.onest!),
    new Uint8Array(fontCache.habibi!),
  ];
}
```

### 3. SVG Constants

```typescript
// src/services/svg/constants.ts

export const FONTS = {
  header: 'Space Grotesk',
  body: 'Onest',
  mono: 'Habibi',  // Used for hex codes
  // Fallback stacks for safety
  headerStack: '"Space Grotesk", Arial, sans-serif',
  bodyStack: '"Onest", Arial, sans-serif',
  monoStack: '"Habibi", Georgia, serif',  // Habibi is serif-like
} as const;

export const FONT_WEIGHTS = {
  bold: 700,
  semibold: 600,
  medium: 500,
  regular: 400,
} as const;

export const TEXT_STYLES = {
  // Headers (Space Grotesk)
  h1: {
    fontFamily: FONTS.headerStack,
    fontSize: 24,
    fontWeight: FONT_WEIGHTS.bold,
    fill: '#ffffff',
  },
  h2: {
    fontFamily: FONTS.headerStack,
    fontSize: 18,
    fontWeight: FONT_WEIGHTS.semibold,
    fill: '#ffffff',
  },
  h3: {
    fontFamily: FONTS.headerStack,
    fontSize: 16,
    fontWeight: FONT_WEIGHTS.semibold,
    fill: '#e0e0e0',
  },

  // Body text (Onest)
  dyeName: {
    fontFamily: FONTS.bodyStack,
    fontSize: 14,
    fontWeight: FONT_WEIGHTS.medium,
    fill: '#ffffff',
  },
  label: {
    fontFamily: FONTS.bodyStack,
    fontSize: 11,
    fontWeight: FONT_WEIGHTS.regular,
    fill: '#909090',
  },

  // Hex codes (Habibi)
  hexCode: {
    fontFamily: FONTS.monoStack,
    fontSize: 12,
    fontWeight: FONT_WEIGHTS.regular,
    fill: '#b0b0b0',
  },
} as const;
```

### 4. SVG Text Helper

```typescript
// src/services/svg/text.ts

import { TEXT_STYLES } from './constants';

type TextStyle = keyof typeof TEXT_STYLES;

interface TextOptions {
  x: number;
  y: number;
  text: string;
  style: TextStyle;
  anchor?: 'start' | 'middle' | 'end';
  maxWidth?: number;
}

export function svgText(options: TextOptions): string {
  const { x, y, text, style, anchor = 'start', maxWidth } = options;
  const s = TEXT_STYLES[style];

  const escapedText = escapeXml(text);

  // Truncate if maxWidth specified
  const displayText = maxWidth
    ? truncateText(escapedText, maxWidth, s.fontSize)
    : escapedText;

  return `<text
    x="${x}"
    y="${y}"
    font-family="${s.fontFamily}"
    font-size="${s.fontSize}"
    font-weight="${s.fontWeight}"
    fill="${s.fill}"
    text-anchor="${anchor}"
  >${displayText}</text>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateText(text: string, maxWidth: number, fontSize: number): string {
  // Approximate character width (varies by font, this is a rough estimate)
  const avgCharWidth = fontSize * 0.6;
  const maxChars = Math.floor(maxWidth / avgCharWidth);

  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}
```

### 5. Resvg Renderer with Fonts

```typescript
// src/services/svg/renderer.ts

import { Resvg } from '@aspect-ratio/resvg';
import { getFontFiles } from '../fonts';

interface RenderOptions {
  width?: number;
  height?: number;
  scale?: number;
}

export async function renderSvgToPng(
  svgString: string,
  options: RenderOptions = {}
): Promise<Uint8Array> {
  const { width = 800, scale = 2 } = options;

  const resvg = new Resvg(svgString, {
    font: {
      fontFiles: getFontFiles(),
      defaultFontFamily: 'Onest',
    },
    fitTo: { mode: 'width', value: width * scale },
  });

  const rendered = resvg.render();
  return rendered.asPng();
}
```

### 6. Usage Example: Harmony Wheel

```typescript
// src/commands/harmony.ts

import { svgText, TEXT_STYLES } from '../services/svg/text';
import { renderSvgToPng } from '../services/svg/renderer';

function generateHarmonyWheelSvg(dyes: Dye[], title: string): string {
  const width = 500;
  const height = 400;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // Background
  svg += `<rect width="100%" height="100%" fill="#1a1a2e" rx="12"/>`;

  // Title (Space Grotesk Bold)
  svg += svgText({
    x: width / 2,
    y: 40,
    text: title,
    style: 'h1',
    anchor: 'middle',
  });

  // ... wheel generation ...

  // Dye labels (Onest Medium)
  dyes.forEach((dye, i) => {
    const labelY = 320 + i * 20;

    svg += svgText({
      x: 20,
      y: labelY,
      text: dye.name,
      style: 'dyeName',
    });

    svg += svgText({
      x: width - 20,
      y: labelY,
      text: dye.hex,
      style: 'hexCode',
      anchor: 'end',
    });
  });

  svg += '</svg>';
  return svg;
}
```

---

## Font Loading Timing

```typescript
// src/index.ts

import { loadFonts } from './services/fonts';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Load fonts on first request (cached after)
    await loadFonts(env);

    // ... handle interaction
  }
};
```

For optimal performance, fonts are cached in memory after first load. Since Workers can be reused across requests, subsequent requests skip the R2 fetch.

---

## Alternative: Bundle Fonts Directly

Instead of loading from R2, you can bundle fonts with the Worker:

```typescript
// src/fonts/index.ts
import spaceGroteskData from './SpaceGrotesk-VariableFont_wght.ttf';
import onestData from './Onest-VariableFont_wght.ttf';
import habibiData from './Habibi-Regular.ttf';

export const FONT_FILES = [
  new Uint8Array(spaceGroteskData),
  new Uint8Array(onestData),
  new Uint8Array(habibiData),
];
```

**Pros:** No R2 dependency, faster cold start
**Cons:** Larger Worker bundle (~205KB), redeployment needed for font updates

---

## Visual Consistency Checklist

To ensure Discord bot output matches web app styling:

- [ ] Same fonts (Space Grotesk + Onest + Habibi)
- [ ] Same weight usage (Bold headers, Medium labels, Regular hex codes)
- [ ] Same color palette (from web app themes)
- [ ] Same spacing ratios
- [ ] Test rendering in Discord light/dark themes

---

## File Locations

```
xivdyetools-discord-worker/
├── src/
│   ├── services/
│   │   ├── fonts.ts           # Font loading
│   │   └── svg/
│   │       ├── constants.ts   # Font definitions
│   │       ├── text.ts        # Text helpers
│   │       └── renderer.ts    # SVG → PNG
│   └── fonts/                 # (if bundling)
│       ├── SpaceGrotesk-VariableFont_wght.ttf
│       ├── Onest-VariableFont_wght.ttf
│       └── Habibi-Regular.ttf
└── wrangler.toml
```

Or store in R2:

```
R2: xivdyetools-assets/
└── fonts/
    ├── SpaceGrotesk-VariableFont_wght.ttf
    ├── Onest-VariableFont_wght.ttf
    └── Habibi-Regular.ttf
```
