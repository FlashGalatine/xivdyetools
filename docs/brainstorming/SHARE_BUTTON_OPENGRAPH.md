# Feature Proposal: Share Button with Dynamic OpenGraph Metadata

**Date**: January 19, 2026
**Status**: Brainstorming
**Author**: XIV Dye Tools Team

---

## Concept Overview

Add a "Share" button to all dye tools that:
1. **Generates deep-link URLs** with tool state encoded as query parameters
2. **Copies URL to clipboard** for easy sharing
3. **Displays dynamic OpenGraph metadata** when shared on Discord, Twitter, Facebook, etc.
4. **Generates custom preview images** styled like the Results Card component

### The Challenge: SPA vs OpenGraph

**Problem**: OpenGraph crawlers (Discord, Twitter, Facebook) **do not execute JavaScript**. They fetch raw HTML and extract `<meta>` tags. Our Vite + Lit SPA renders everything client-side, so crawlers see only static generic meta tags.

**Solution Required**: Server-side meta tag generation or edge function image generation.

---

## URL Deep-Link Structure

### Universal Parameters

All shareable URLs should follow a consistent pattern:

```
https://xivdyetools.app/{tool}/?{params}&v=1
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `v` | number | Share URL schema version (for future compatibility) |
| `algo` | string | Color matching algorithm: `oklab`, `ciede2000`, `hyab`, etc. |
| `perceptual` | boolean | Whether perceptual matching is enabled |

### Tool-Specific URL Structures

#### Harmony Explorer

```
/harmony/?dye={itemID}&harmony={type}&algo={algo}&perceptual={bool}
```

**Example**: Carmine Red's Complementary Harmonies
```
https://xivdyetools.app/harmony/?dye=48227&harmony=Complementary&algo=oklab&perceptual=true&v=1
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `dye` | itemID (number) | Selected dye's FFXIV item ID |
| `harmony` | `Complementary`, `Analogous`, `Triadic`, `Square`, `Tetradic`, `Monochromatic`, `Compound`, `Split-Complementary`, `Shades` | Harmony type |

#### Gradient Builder

```
/gradient/?start={itemID}&end={itemID}&steps={n}&algo={algo}
```

**Example**: Pure White to Jet Black gradient with 5 steps
```
https://xivdyetools.app/gradient/?start=5729&end=5736&steps=5&algo=oklab&v=1
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `start` | itemID | Starting dye |
| `end` | itemID | Ending dye |
| `steps` | 3-10 | Number of gradient steps |

#### Dye Mixer

```
/mixer/?dyeA={itemID}&dyeB={itemID}&ratio={percent}&algo={algo}
```

**Example**: 60% Dalamud Red + 40% Snow White
```
https://xivdyetools.app/mixer/?dyeA=27869&dyeB=5729&ratio=60&algo=ciede2000&v=1
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `dyeA` | itemID | First dye |
| `dyeB` | itemID | Second dye |
| `ratio` | 0-100 | Percentage of dyeA in mix |

#### Swatch Matcher

```
/swatch/?color={hex}&algo={algo}&limit={n}
```

**Example**: Match #8B4513 (saddle brown)
```
https://xivdyetools.app/swatch/?color=8B4513&algo=oklab&limit=5&v=1
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `color` | hex (no #) | Input color to match |
| `limit` | 1-10 | Number of results to show |

#### Dye Comparison

```
/comparison/?dyes={id1,id2,id3,id4}
```

**Example**: Compare four popular reds
```
https://xivdyetools.app/comparison/?dyes=27869,48227,5851,5853&v=1
```

#### Accessibility Checker

```
/accessibility/?dyes={id1,id2}&vision={type}
```

**Example**: Check Dalamud Red accessibility
```
https://xivdyetools.app/accessibility/?dyes=27869,5729&vision=deuteranopia&v=1
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `vision` | `normal`, `protanopia`, `deuteranopia`, `tritanopia`, `achromatopsia` | Vision simulation type |

---

## Dynamic OpenGraph Generation Approaches

### Option 1: Cloudflare Workers (Recommended)

**Architecture**:
```
User shares URL → Discord/Twitter fetches → Cloudflare Worker intercepts
                                          → Detects bot user-agent
                                          → Returns dynamic HTML with meta tags
                                          → Generates image via @cloudflare/og
```

**Pros**:
- Low latency (edge-deployed globally)
- Built-in image generation support
- Free tier generous (100K requests/day)
- No changes to main app hosting

**Cons**:
- Requires Cloudflare setup
- Learning curve for Workers

**Implementation Sketch**:
```typescript
// workers/opengraph.ts
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // Detect social media crawlers
    const isCrawler = /Twitterbot|facebookexternalhit|Discordbot|LinkedInBot|Slackbot/i.test(userAgent);

    if (!isCrawler) {
      // Regular user - serve SPA
      return fetch(request);
    }

    // Crawler - generate dynamic meta tags
    const tool = url.pathname.split('/')[1];
    const params = url.searchParams;

    const ogData = await generateOGData(tool, params);

    return new Response(generateHTML(ogData), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};
```

### Option 2: Vercel Edge Functions + @vercel/og

**Architecture**:
```
User shares URL → Crawler fetches → Vercel Edge intercepts
                                  → Satori generates SVG
                                  → Resvg converts to PNG
                                  → Returns image
```

**Pros**:
- Excellent developer experience
- `@vercel/og` uses Satori (JSX → SVG → PNG)
- Well-documented

**Cons**:
- Requires Vercel hosting (or hybrid approach)
- Satori has font/styling limitations

### Option 3: Dedicated OG Image API

**Architecture**:
```
Share URL includes og:image pointing to:
https://og.xivdyetools.app/harmony?dye=48227&harmony=Complementary

API generates image on-demand, caches result
```

**Pros**:
- Decoupled from main app
- Can use any image generation tech (Puppeteer, Sharp, Canvas)
- Easy to cache at CDN level

**Cons**:
- Separate service to maintain
- Cold start latency
- More infrastructure

### Option 4: Pre-rendered Static Images (Limited)

**Architecture**:
```
Pre-generate common combinations at build time
Store in /og-images/{hash}.png
Share URLs reference pre-generated images
```

**Pros**:
- No runtime generation
- Fastest possible delivery
- Zero infrastructure

**Cons**:
- Cannot handle dynamic combinations (136 dyes × 9 harmonies = 1,224 images just for Harmony tool)
- Disk space concerns
- Stale images if data changes

**Verdict**: Only viable for "most popular" shares, not as primary solution.

---

## OpenGraph Image Design Specification

### Dimensions & Format

| Property | Value | Reason |
|----------|-------|--------|
| Width | 1200px | Twitter/Discord standard |
| Height | 630px | 1.91:1 aspect ratio (og:image standard) |
| Format | PNG | Best for graphics with text |
| Alt Format | JPEG | Fallback for photos |

### Visual Design (Based on Results Card)

The OG image should share the Results Card's design language:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                         XIV DYE TOOLS                                       │ │ 40px header
│  │                     HARMONY EXPLORER                                         │ │ Glassmorphism bg
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────────┐ │
│  │                                 │    │                                     │ │
│  │     INPUT DYE                   │    │     COMPLEMENTARY HARMONY           │ │
│  │                                 │    │                                     │ │
│  │  ┌─────────┐                    │    │  ┌─────────┐  ┌─────────┐           │ │
│  │  │         │  Carmine Red       │    │  │         │  │         │           │ │
│  │  │ #A52A2A │  Δ 0.0             │    │  │ #2AA552 │  │ #52A52A │           │ │
│  │  │         │                    │    │  │         │  │         │           │ │
│  │  └─────────┘                    │    │  └─────────┘  └─────────┘           │ │
│  │                                 │    │  Gloom Green   Meadow Green         │ │
│  │                                 │    │  Δ 2.4         Δ 3.1                │ │
│  │                                 │    │                                     │ │
│  └─────────────────────────────────┘    └─────────────────────────────────────┘ │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  🎨 xivdyetools.app                           Algorithm: OKLAB            │ │ 32px footer
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Design Elements to Carry Over

| Element | Value | Notes |
|---------|-------|-------|
| Header bg | `rgba(0, 0, 0, 0.4)` | Dark overlay |
| Card bg | `--v4-glass-bg` or `rgba(30, 30, 30, 0.7)` | Glassmorphism |
| Title font | Space Grotesk, 24px, bold | |
| Body font | Onest, 14px | |
| Numeric font | Habibi, 12px, monospace | For hex/delta values |
| Color swatch | 80×80px with 4px border-radius | |
| Delta badge | Color-coded (green < 3, yellow 3-5, orange 5-10, red > 10) | |

### Tool-Specific Layouts

#### Harmony Tool OG Image

```
┌──────────────────────────────────────────────────────────────────┐
│  Header: "HARMONY EXPLORER - COMPLEMENTARY"                      │
├─────────────────────────┬────────────────────────────────────────┤
│  LEFT (400px)           │  RIGHT (750px)                         │
│  ┌────────────────────┐ │  ┌──────────────────────────────────┐  │
│  │   INPUT            │ │  │    COLOR WHEEL VISUALIZATION     │  │
│  │   [Large Swatch]   │ │  │                                  │  │
│  │   Carmine Red      │ │  │         ○ ← Input               │  │
│  │   #A52A2A          │ │  │        / \                       │  │
│  │                    │ │  │       /   \                      │  │
│  │                    │ │  │      ●─────●  ← Harmonies        │  │
│  └────────────────────┘ │  │                                  │  │
│                         │  └──────────────────────────────────┘  │
│                         │  ┌──────────────────────────────────┐  │
│                         │  │  Results: Gloom Green Δ2.4, ...  │  │
│                         │  └──────────────────────────────────┘  │
├─────────────────────────┴────────────────────────────────────────┤
│  Footer: xivdyetools.app | OKLAB Algorithm                       │
└──────────────────────────────────────────────────────────────────┘
```

#### Gradient Tool OG Image

```
┌──────────────────────────────────────────────────────────────────┐
│  Header: "GRADIENT BUILDER - 5 STEPS"                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  START          STEP 1         STEP 2         STEP 3         END │
│  ┌────┐         ┌────┐         ┌────┐         ┌────┐       ┌────┐│
│  │    │─────────│    │─────────│    │─────────│    │───────│    ││
│  └────┘         └────┘         └────┘         └────┘       └────┘│
│  Pure White     Ash Grey       Storm Blue     Jet Black          │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Footer: xivdyetools.app                                         │
└──────────────────────────────────────────────────────────────────┘
```

#### Mixer Tool OG Image

```
┌──────────────────────────────────────────────────────────────────┐
│  Header: "DYE MIXER - 60/40 BLEND"                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────┐    60%    ┌─────────────┐    40%    ┌────┐              │
│  │    │───────────│             │───────────│    │              │
│  └────┘           │   RESULT    │           └────┘              │
│  Dalamud Red      │   [Large]   │           Snow White          │
│  #B22222          │   #D46A6A   │           #FAFAFA             │
│                   │             │                                │
│                   │  ≈ Coral Pink (Δ 2.1)                       │
│                   └─────────────┘                                │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Footer: xivdyetools.app | CIEDE2000 Algorithm                   │
└──────────────────────────────────────────────────────────────────┘
```

#### Swatch Tool OG Image

```
┌──────────────────────────────────────────────────────────────────┐
│  Header: "SWATCH MATCHER - #8B4513"                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT COLOR              TOP 5 MATCHES                          │
│  ┌──────────────┐        ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │              │        │    │ │    │ │    │ │    │ │    │    │
│  │   #8B4513    │        └────┘ └────┘ └────┘ └────┘ └────┘    │
│  │              │        Ches.  Orch.  Bark   Mesa   Rust      │
│  └──────────────┘        Δ1.2   Δ2.8   Δ3.4   Δ4.1   Δ5.0      │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Footer: xivdyetools.app | OKLAB Algorithm                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Architecture

### New Files & Components

```
xivdyetools-web-app/
├── src/
│   ├── services/
│   │   └── share-service.ts        # URL generation, clipboard API
│   ├── components/
│   │   ├── v4/
│   │   │   └── share-button.ts     # Lit component for share UI
│   │   └── share-modal.ts          # Optional preview modal
│   └── shared/
│       └── share-url-builder.ts    # URL construction logic
│
xivdyetools-og-worker/              # New: Cloudflare Worker project
├── src/
│   ├── index.ts                    # Main worker entry
│   ├── crawler-detector.ts         # User-agent detection
│   ├── og-data-generator.ts        # Meta tag data generation
│   ├── image-generator.ts          # Canvas/Satori image rendering
│   └── templates/
│       ├── harmony.ts              # Harmony-specific image
│       ├── gradient.ts
│       ├── mixer.ts
│       └── swatch.ts
├── wrangler.toml                   # Cloudflare config
└── package.json
```

### ShareService API Design

```typescript
// share-service.ts

export interface ShareOptions {
  tool: ToolId;
  params: Record<string, string | number | boolean>;
  includeAlgorithm?: boolean;
}

export interface ShareResult {
  url: string;
  title: string;
  description: string;
}

export class ShareService {
  private static instance: ShareService | null = null;

  static getInstance(): ShareService {
    if (!ShareService.instance) {
      ShareService.instance = new ShareService();
    }
    return ShareService.instance;
  }

  /**
   * Generate shareable URL for current tool state
   */
  generateShareUrl(options: ShareOptions): ShareResult {
    const url = new URL(`https://xivdyetools.app/${options.tool}/`);

    // Add tool-specific params
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    // Add version for future compatibility
    url.searchParams.set('v', '1');

    return {
      url: url.toString(),
      title: this.generateTitle(options),
      description: this.generateDescription(options)
    };
  }

  /**
   * Copy URL to clipboard and show toast
   */
  async copyToClipboard(url: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(url);
      ToastService.getInstance().show({
        message: 'Link copied to clipboard!',
        type: 'success',
        duration: 3000
      });
      return true;
    } catch (err) {
      ToastService.getInstance().show({
        message: 'Failed to copy link',
        type: 'error',
        duration: 3000
      });
      return false;
    }
  }

  /**
   * Parse shared URL and restore tool state
   */
  parseShareUrl(url: string): ShareOptions | null {
    // Validation and parsing logic
  }
}
```

### Share Button Component

```typescript
// share-button.ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('v4-share-button')
export class ShareButton extends LitElement {
  @property({ type: String }) tool: ToolId = 'harmony';
  @property({ type: Object }) params: Record<string, any> = {};

  static styles = css`
    :host {
      display: inline-flex;
    }

    button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--v4-glass-bg);
      border: 1px solid var(--theme-border);
      border-radius: 8px;
      color: var(--theme-text);
      font-family: var(--font-body);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    button:hover {
      background: var(--theme-card-hover);
      transform: translateY(-1px);
    }

    .icon {
      width: 16px;
      height: 16px;
    }
  `;

  private async handleShare() {
    const shareService = ShareService.getInstance();
    const result = shareService.generateShareUrl({
      tool: this.tool,
      params: this.params
    });

    await shareService.copyToClipboard(result.url);

    // Dispatch event for analytics or parent handling
    this.dispatchEvent(new CustomEvent('share', {
      detail: result,
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <button @click=${this.handleShare} title="Copy shareable link">
        <svg class="icon" viewBox="0 0 24 24">
          <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
        </svg>
        Share
      </button>
    `;
  }
}
```

---

## OpenGraph Meta Tags Structure

When a crawler visits a shared URL, the Cloudflare Worker returns:

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Primary Meta Tags -->
  <title>Carmine Red - Complementary Harmony | XIV Dye Tools</title>
  <meta name="title" content="Carmine Red - Complementary Harmony | XIV Dye Tools">
  <meta name="description" content="Explore Carmine Red's complementary color harmonies. Best matches: Gloom Green (Δ2.4), Meadow Green (Δ3.1).">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://xivdyetools.app/harmony/?dye=48227&harmony=Complementary">
  <meta property="og:title" content="Carmine Red - Complementary Harmony">
  <meta property="og:description" content="Explore Carmine Red's complementary color harmonies. Best matches: Gloom Green (Δ2.4), Meadow Green (Δ3.1).">
  <meta property="og:image" content="https://og.xivdyetools.app/harmony/48227/complementary.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="XIV Dye Tools">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@AsheJunius">
  <meta name="twitter:title" content="Carmine Red - Complementary Harmony">
  <meta name="twitter:description" content="Explore Carmine Red's complementary color harmonies.">
  <meta name="twitter:image" content="https://og.xivdyetools.app/harmony/48227/complementary.png">

  <!-- Discord-specific (optional) -->
  <meta name="theme-color" content="#A52A2A">

  <!-- Redirect for JavaScript-enabled browsers -->
  <meta http-equiv="refresh" content="0;url=https://xivdyetools.app/harmony/?dye=48227&harmony=Complementary">
</head>
<body>
  <p>Redirecting to XIV Dye Tools...</p>
</body>
</html>
```

---

## Image Generation Technical Details

### Option A: Cloudflare Workers with @cloudflare/og (Satori-based)

```typescript
// image-generator.ts
import { ImageResponse } from '@cloudflare/og';

export async function generateHarmonyImage(params: HarmonyParams): Promise<Response> {
  const dye = await getDyeById(params.dyeId);
  const harmonies = calculateHarmonies(dye, params.harmonyType);

  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '1200px',
        height: '630px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        fontFamily: 'Space Grotesk, sans-serif',
        color: 'white',
        padding: '40px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <span style={{ fontSize: '28px', fontWeight: 'bold' }}>
            HARMONY EXPLORER
          </span>
          <span style={{ fontSize: '18px', opacity: 0.7 }}>
            {params.harmonyType.toUpperCase()}
          </span>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, gap: '40px' }}>
          {/* Input Dye */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px'
          }}>
            <div style={{
              width: '120px',
              height: '120px',
              background: dye.hex,
              borderRadius: '8px',
              marginBottom: '16px'
            }} />
            <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{dye.name}</span>
            <span style={{ fontSize: '14px', opacity: 0.7 }}>{dye.hex}</span>
          </div>

          {/* Harmony Results */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {harmonies.map((h) => (
              <div key={h.dye.id} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '16px'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: h.dye.hex,
                  borderRadius: '8px',
                  marginBottom: '8px'
                }} />
                <span style={{ fontSize: '14px' }}>{h.dye.name}</span>
                <span style={{
                  fontSize: '12px',
                  color: getDeltaColor(h.delta)
                }}>Δ {h.delta.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '24px',
          opacity: 0.7
        }}>
          <span>🎨 xivdyetools.app</span>
          <span>Algorithm: {params.algo.toUpperCase()}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Space Grotesk',
          data: await loadFont('SpaceGrotesk-Bold.ttf'),
          weight: 700
        }
      ]
    }
  );
}
```

### Option B: Node.js Canvas (Sharp + node-canvas)

For a self-hosted solution:

```typescript
// image-generator-canvas.ts
import { createCanvas, loadImage, registerFont } from 'canvas';
import sharp from 'sharp';

registerFont('./fonts/SpaceGrotesk-Bold.ttf', { family: 'Space Grotesk' });

export async function generateHarmonyImage(params: HarmonyParams): Promise<Buffer> {
  const canvas = createCanvas(1200, 630);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 630);

  // Header
  ctx.font = 'bold 28px "Space Grotesk"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HARMONY EXPLORER', 40, 60);

  // ... rest of rendering

  // Convert to PNG buffer
  return await sharp(canvas.toBuffer()).png().toBuffer();
}
```

---

## Caching Strategy

### Image Caching

```typescript
// Cloudflare Worker cache headers
const imageResponse = new Response(imageBuffer, {
  headers: {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=86400, s-maxage=604800', // 1 day browser, 7 days edge
    'CDN-Cache-Control': 'max-age=604800' // Cloudflare-specific
  }
});
```

### Cache Key Structure

```
og-image:{tool}:{params-hash}
og-image:harmony:dye48227-complementary-oklab
og-image:gradient:start5729-end5736-steps5
```

### Cache Invalidation

- **On dye data update**: Purge all cached images (rare, only with game patches)
- **On algorithm change**: Version bump in URL schema

---

## Analytics Tracking

### Events to Track

#### Client-Side (Share Button)

```typescript
interface ShareEvent {
  event: 'share_initiated';
  tool: ToolId;
  params: {
    dyeId?: number;
    harmonyType?: string;
    algorithm?: string;
    // ... tool-specific
  };
  timestamp: number;
}
```

Track via:
- Custom analytics service (if exists)
- Google Analytics 4 events
- Plausible/Fathom (privacy-friendly alternatives)

#### Server-Side (Cloudflare Worker)

```typescript
interface OGImageEvent {
  event: 'og_image_requested';
  tool: ToolId;
  crawler: 'discord' | 'twitter' | 'facebook' | 'linkedin' | 'other';
  params: Record<string, string>;
  cacheHit: boolean;
  timestamp: number;
}
```

Track via:
- Cloudflare Analytics (built-in)
- Cloudflare Workers Analytics Engine (for custom events)
- Forward to main analytics service

### Metrics Dashboard

| Metric | Description |
|--------|-------------|
| Shares per tool | Which tools are shared most? |
| Popular dyes | Which dyes appear in shares? |
| Platform distribution | Discord vs Twitter vs Facebook |
| Share → Visit conversion | Do people click through from previews? |
| Cache hit rate | Is image caching effective? |

### Implementation Notes

- Use Cloudflare Workers Analytics Engine for low-latency event ingestion
- Aggregate daily for dashboard (don't store per-request PII)
- Consider privacy: no IP addresses, no user identification
- Opt-out respect: honor DNT headers

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

1. [ ] Create `share-service.ts` with URL generation logic
2. [ ] Create `share-button.ts` Lit component
3. [ ] Add share buttons to Harmony, Gradient, Mixer, Swatch tools
4. [ ] Implement URL parsing to restore tool state on page load
5. [ ] Test deep-linking works in SPA router

### Phase 2: OpenGraph Worker (Week 2)

1. [ ] Set up Cloudflare Workers project
2. [ ] Implement crawler detection
3. [ ] Create HTML template generator with dynamic meta tags
4. [ ] Configure DNS/routing to intercept crawler requests
5. [ ] Test with Discord, Twitter, Facebook preview tools

### Phase 3: Image Generation (Week 3)

1. [ ] Implement Harmony tool image template
2. [ ] Implement Gradient tool image template
3. [ ] Implement Mixer tool image template
4. [ ] Implement Swatch tool image template
5. [ ] Add font loading and styling
6. [ ] Set up image caching

### Phase 4: Polish & Remaining Tools (Week 4)

1. [ ] Add share functionality to Comparison, Accessibility, Budget tools
2. [ ] Create images for remaining tools
3. [ ] Add analytics tracking for shares
4. [ ] Documentation and user guide
5. [ ] Performance optimization

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Edge Platform** | Cloudflare Workers | Free tier (100K req/day), global edge, built-in `@cloudflare/og` |
| **Analytics** | Yes, track shares | Track share button clicks and OG image requests |
| **Localization** | English only (MVP) | Simpler implementation, can add i18n later |

## Remaining Open Questions

1. **Domain Structure**: Should OG images be served from `og.xivdyetools.app` subdomain or same domain with path-based routing?

2. **Font Licensing**: Can we bundle Space Grotesk and Onest fonts in the Worker? (Both are open source, should be fine)

3. **Fallback Images**: What static image should be shown if dynamic generation fails?

4. **Rate Limiting**: Protect image generation endpoint from abuse?

5. **Discord Bot Integration**: Should shares also work with the Discord bot for enhanced previews?

---

## Estimated Effort

| Phase | Hours | Dependencies |
|-------|-------|--------------|
| Phase 1: Foundation | 8-12h | None |
| Phase 2: OpenGraph Worker | 12-16h | Cloudflare account |
| Phase 3: Image Generation | 16-24h | Font files |
| Phase 4: Polish | 8-12h | Phases 1-3 |

**Total**: 44-64 hours (1.5-2 weeks focused work)

---

## Related Documentation

- [V4 Layout Architecture](../projects/xivdyetools-web-app/components.md)
- [Router Service](../architecture/data-flow.md)
- [Results Card Component](../projects/xivdyetools-web-app/components.md#result-card)
- [Color Algorithms](../research/color-matching/)

---

## Next Steps

1. Review this proposal and provide feedback
2. Decide on hosting approach (Cloudflare Workers recommended)
3. Design mockups for OG images (optional - ASCII art above may suffice)
4. Begin Phase 1 implementation
