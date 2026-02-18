# Technology Stack Analysis

This document provides detailed analysis of each technology component for the Cloudflare Workers Discord bot migration.

---

## Table of Contents

1. [Image Processing: photon-wasm](#image-processing-photon-wasm)
2. [Vector Graphics: SVG Generation](#vector-graphics-svg-generation)
3. [Color Extraction](#color-extraction)
4. [Hybrid Approach](#hybrid-approach-recommendation)
5. [Discord Integration](#discord-integration)
6. [Data Storage](#data-storage)

---

## Image Processing: photon-wasm

### Overview

[photon-wasm](https://silvia-odwyer.github.io/photon/) is a high-performance image processing library written in Rust and compiled to WebAssembly. It's designed specifically for browser and serverless environments.

### Capabilities

| Feature | Support | Notes |
|---------|---------|-------|
| Image loading | ✅ | PNG, JPEG, WebP input |
| Image saving | ✅ | PNG, JPEG output |
| Resize/crop | ✅ | Various resampling methods |
| Color manipulation | ✅ | Saturation, brightness, contrast |
| Filters | ✅ | Grayscale, sepia, invert, etc. |
| Blending | ✅ | Overlay images with blend modes |
| Colorblind simulation | ❌ | Must implement manually |
| Text rendering | ❌ | Not supported |
| Canvas drawing | ❌ | No drawing primitives |

### Performance in Workers

```
Memory usage: ~10-30MB per image operation
Execution time: 50-200ms for typical operations
Cold start impact: +20-50ms (WASM initialization)
```

### Relevant Use Cases

| Current Bot Feature | photon-wasm Approach | Feasibility |
|--------------------|----------------------|-------------|
| Resize user images | `photon.resize()` | ✅ Excellent |
| Generate swatches | Create colored pixels | ⚠️ Inefficient |
| Colorblind preview | Manual RGB matrix transformation | ✅ Doable |
| Harmony wheels | Draw circles/arcs | ❌ Not suited |
| Gradient bars | Generate gradient pixels | ⚠️ Possible but heavy |
| Text labels | N/A | ❌ Not supported |

### Code Example: Image Resize

```typescript
import { PhotonImage, resize } from '@aspect-ratio/photon';

async function resizeImage(imageBuffer: ArrayBuffer, maxWidth: number): Promise<Uint8Array> {
  const photonImage = PhotonImage.new_from_byteslice(new Uint8Array(imageBuffer));

  const width = photonImage.get_width();
  const height = photonImage.get_height();

  if (width > maxWidth) {
    const ratio = maxWidth / width;
    const newHeight = Math.floor(height * ratio);
    resize(photonImage, maxWidth, newHeight, 1); // 1 = Lanczos3
  }

  const output = photonImage.get_bytes_jpeg(85); // 85% quality
  photonImage.free(); // Important: free WASM memory

  return output;
}
```

### Code Example: Colorblind Simulation

```typescript
// Protanopia transformation matrix
const PROTANOPIA_MATRIX = {
  r: [0.567, 0.433, 0.000],
  g: [0.558, 0.442, 0.000],
  b: [0.000, 0.242, 0.758]
};

function simulateColorblindness(r: number, g: number, b: number, type: string): RGB {
  const matrix = COLORBLIND_MATRICES[type];
  return {
    r: Math.round(r * matrix.r[0] + g * matrix.r[1] + b * matrix.r[2]),
    g: Math.round(r * matrix.g[0] + g * matrix.g[1] + b * matrix.g[2]),
    b: Math.round(r * matrix.b[0] + g * matrix.b[1] + b * matrix.b[2])
  };
}
```

### Pros and Cons

**Pros:**
- Near-native performance (Rust compiled to WASM)
- Works in Cloudflare Workers (WASM compatible)
- Good for image manipulation tasks
- Well-documented with active maintenance
- Small bundle size (~200KB)

**Cons:**
- No text rendering (critical limitation)
- No vector drawing (circles, lines, arcs)
- Memory management required (manual `free()` calls)
- Limited to raster operations
- Not suited for generating graphics from scratch

---

## Vector Graphics: SVG Generation

### Overview

Server-side SVG generation creates vector graphics as XML strings that Discord renders in embeds via URL (data URI or hosted image).

### Capabilities

| Feature | Support | Notes |
|---------|---------|-------|
| Shapes | ✅ | rect, circle, ellipse, path, polygon |
| Text | ✅ | Full text support with fonts |
| Gradients | ✅ | Linear and radial gradients |
| Transparency | ✅ | Native alpha support |
| Animations | ✅ | CSS/SMIL (though not needed) |
| Resolution | ✅ | Vector = infinite resolution |
| File size | ✅ | Very small (typically 1-5KB) |

### Relevant Use Cases

| Current Bot Feature | SVG Approach | Feasibility |
|--------------------|--------------|-------------|
| Color swatches | Colored `<rect>` elements | ✅ Excellent |
| Harmony wheels | `<circle>` + `<path>` arcs | ✅ Excellent |
| Gradient bars | `<linearGradient>` + `<rect>` | ✅ Excellent |
| Text labels | `<text>` elements | ✅ Excellent |
| Dye name display | `<text>` with styling | ✅ Excellent |
| Colorblind preview | Multiple `<rect>` sets | ✅ Excellent |

### Code Example: Harmony Wheel

```typescript
function generateHarmonyWheel(dyes: Dye[]): string {
  const size = 400;
  const center = size / 2;
  const radius = 150;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;

  // Background circle
  svg += `<circle cx="${center}" cy="${center}" r="${radius + 10}" fill="#1a1a2e" stroke="#333" stroke-width="2"/>`;

  // Hue wheel (optional decorative ring)
  svg += generateHueRing(center, radius + 30, 15);

  // Dye markers
  dyes.forEach((dye, index) => {
    const angle = (index / dyes.length) * 2 * Math.PI - Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;

    // Marker circle
    svg += `<circle cx="${x}" cy="${y}" r="25" fill="${dye.hex}" stroke="#fff" stroke-width="3"/>`;

    // Connecting line to center
    svg += `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${dye.hex}" stroke-width="2" opacity="0.5"/>`;
  });

  // Center dot
  svg += `<circle cx="${center}" cy="${center}" r="8" fill="#fff"/>`;

  svg += '</svg>';
  return svg;
}

function generateHueRing(cx: number, cy: number, width: number): string {
  // Create a conic gradient effect using multiple arc segments
  let ring = '<g>';
  for (let i = 0; i < 360; i += 10) {
    const hue = i;
    const startAngle = (i - 90) * Math.PI / 180;
    const endAngle = (i + 10 - 90) * Math.PI / 180;

    // Path for arc segment
    ring += `<path d="${describeArc(cx, cy, cy - 30, startAngle, endAngle)}"
              fill="none" stroke="hsl(${hue}, 100%, 50%)" stroke-width="${width}"/>`;
  }
  ring += '</g>';
  return ring;
}
```

### Code Example: Color Swatches

```typescript
function generateSwatchGrid(dyes: Dye[], columns: number = 4): string {
  const swatchSize = 80;
  const padding = 10;
  const textHeight = 25;

  const rows = Math.ceil(dyes.length / columns);
  const width = columns * (swatchSize + padding) + padding;
  const height = rows * (swatchSize + textHeight + padding) + padding;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;

  // Background
  svg += `<rect width="100%" height="100%" fill="#2d2d3d" rx="8"/>`;

  // Swatches
  dyes.forEach((dye, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + col * (swatchSize + padding);
    const y = padding + row * (swatchSize + textHeight + padding);

    // Color square
    svg += `<rect x="${x}" y="${y}" width="${swatchSize}" height="${swatchSize}"
            fill="${dye.hex}" rx="4" stroke="#555" stroke-width="1"/>`;

    // Dye name
    svg += `<text x="${x + swatchSize / 2}" y="${y + swatchSize + 18}"
            text-anchor="middle" fill="#fff" font-family="Arial" font-size="11">
            ${escapeXml(dye.name)}
            </text>`;
  });

  svg += '</svg>';
  return svg;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

### Code Example: Gradient Bar

```typescript
function generateGradientBar(colors: string[], width: number = 400, height: number = 60): string {
  const gradientId = 'grad-' + Math.random().toString(36).substr(2, 9);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;

  // Define gradient
  svg += '<defs>';
  svg += `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">`;

  colors.forEach((color, index) => {
    const offset = (index / (colors.length - 1)) * 100;
    svg += `<stop offset="${offset}%" stop-color="${color}"/>`;
  });

  svg += '</linearGradient>';
  svg += '</defs>';

  // Gradient rectangle
  svg += `<rect width="${width}" height="${height}" fill="url(#${gradientId})" rx="4"/>`;

  svg += '</svg>';
  return svg;
}
```

### Serving SVG to Discord

Discord embeds can display images from URLs. Options:

1. **Data URI** (limited support):
   ```typescript
   const svgBase64 = btoa(svgString);
   const dataUri = `data:image/svg+xml;base64,${svgBase64}`;
   // May not work in all Discord contexts
   ```

2. **R2 Storage** (recommended):
   ```typescript
   await env.BUCKET.put(`images/${imageId}.svg`, svgString, {
     httpMetadata: { contentType: 'image/svg+xml' }
   });
   const imageUrl = `https://r2.xivdyetools.com/images/${imageId}.svg`;
   ```

3. **Convert to PNG** (most compatible):
   ```typescript
   // Use resvg-wasm to rasterize SVG
   import { Resvg } from '@aspect-ratio/resvg';

   const resvg = new Resvg(svgString, { fitTo: { mode: 'width', value: 800 } });
   const pngBuffer = resvg.render().asPng();
   ```

### Pros and Cons

**Pros:**
- Tiny file sizes (1-5KB vs 50-200KB PNG)
- Perfect for geometric graphics
- Full text rendering support
- No external dependencies
- CPU efficient (string manipulation only)
- Infinite resolution

**Cons:**
- Cannot manipulate user-uploaded images
- Discord SVG support is inconsistent
- May need PNG conversion for reliability
- Complex shapes require manual path generation
- Font rendering depends on client

---

## Color Extraction

### Overview

Extracting dominant colors from user-uploaded images is a core feature of `/match_image`. Several approaches are available for Workers:

### Option 1: Custom WASM Algorithm

Implement median-cut or k-means in Rust/WASM.

| Aspect | Details |
|--------|---------|
| Performance | Fast (~50-100ms for typical images) |
| Accuracy | High (can tune algorithm) |
| Bundle size | +50-100KB |
| Maintenance | High (custom code) |
| Dependencies | None (self-contained) |

```rust
// Pseudo-code for median-cut in Rust
pub fn extract_colors(pixels: &[u8], count: usize) -> Vec<[u8; 3]> {
    let mut buckets = vec![pixels.to_vec()];

    while buckets.len() < count {
        // Find bucket with largest color range
        let (idx, _) = buckets.iter().enumerate()
            .max_by_key(|(_, b)| color_range(b))
            .unwrap();

        // Split along longest axis
        let bucket = buckets.remove(idx);
        let (left, right) = split_bucket(bucket);
        buckets.push(left);
        buckets.push(right);
    }

    // Average each bucket
    buckets.iter().map(|b| average_color(b)).collect()
}
```

### Recommended Approach: WASM-Only

Use custom WASM for all color extraction. No external API dependencies.

| Aspect | Details |
|--------|---------|
| Performance | ~50-100ms |
| Accuracy | Good to Very Good |
| Cost | $0 (no API fees) |
| Maintenance | Self-contained |
| Dependencies | None |

```typescript
async function extractDominantColors(
  imageBuffer: ArrayBuffer,
  count: number = 5
): Promise<ExtractedColor[]> {
  try {
    // Resize image for faster processing
    const { photonImage, width, height } = await processImage(imageBuffer, 200);
    const imageData = photonImage.get_raw_pixels();

    // Extract colors using median-cut algorithm
    const colors = medianCutExtraction(imageData, width, height, count);

    photonImage.free(); // Clean up WASM memory

    // Validate and enhance results
    if (!hasColorDiversity(colors)) {
      // If colors are too similar, try k-means for better separation
      return kMeansExtraction(imageData, width, height, count);
    }

    return colors;

  } catch (error) {
    console.error('Color extraction failed:', error);
    // Graceful degradation: return neutral palette
    return generateFallbackPalette(count);
  }
}

// Ensure extracted colors are sufficiently different
function hasColorDiversity(colors: ExtractedColor[]): boolean {
  const MIN_DISTANCE = 30; // Minimum color distance threshold

  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const distance = colorDistance(colors[i].rgb, colors[j].rgb);
      if (distance < MIN_DISTANCE) return false;
    }
  }
  return true;
}
```

### Comparison Table

| Criteria | WASM (Median-Cut) | WASM (K-Means) |
|----------|-------------------|----------------|
| Speed | ~50ms | ~100-200ms |
| Accuracy | Good | Very Good |
| Cost | Free | Free |
| Reliability | High | High |
| Complex images | May struggle | Better |
| Bundle size | +50KB | +80KB |

**Decision:** Use median-cut as primary, fall back to k-means for images with poor color separation. No external API needed.

---

## Recommended Technology Stack

Based on the analysis, here's the recommended technology stack (photon-wasm + SVG + WASM color extraction):

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Discord Interaction                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Command Router                           │   │
│  │   /harmony, /match, /mixer, /comparison, /accessibility  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐            │
│         ▼                    ▼                    ▼            │
│  ┌────────────┐      ┌────────────┐      ┌────────────────┐   │
│  │ SVG Engine │      │photon-wasm │      │ Color Extract  │   │
│  │            │      │            │      │                │   │
│  │ • Wheels   │      │ • Resize   │      │ • Median-cut   │   │
│  │ • Swatches │      │ • Crop     │      │ • K-means      │   │
│  │ • Gradients│      │ • Colorblind│      │                │   │
│  │ • Labels   │      │   sim      │      │                │   │
│  └────────────┘      └────────────┘      └────────────────┘   │
│         │                    │                    │            │
│         └────────────────────┼────────────────────┘            │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   resvg-wasm                             │   │
│  │              SVG → PNG Conversion                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    R2 Storage                            │   │
│  │              Temporary image hosting                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Assignment by Feature

| Bot Feature | Primary Tech | Fallback | Output Format |
|-------------|-------------|----------|---------------|
| `/harmony` wheel | SVG | — | PNG (via resvg) |
| `/match` swatches | SVG | — | PNG (via resvg) |
| `/match_image` extraction | WASM median-cut | WASM k-means | — |
| `/match_image` swatches | SVG | — | PNG (via resvg) |
| `/mixer` preview | SVG | — | PNG (via resvg) |
| `/comparison` grid | SVG | — | PNG (via resvg) |
| `/accessibility` sim | photon-wasm | SVG-based | PNG |
| Image resize | photon-wasm | — | JPEG |

### Bundle Dependencies

```json
{
  "dependencies": {
    "@aspect-ratio/photon": "^0.3.0",
    "@aspect-ratio/resvg": "^2.0.0",
    "discord-interactions": "^4.0.0"
  }
}
```

**Total estimated bundle size:** ~500KB (acceptable for Workers)

---

## Discord Integration

### HTTP Interactions Model

Discord's HTTP Interactions allow bots to receive slash commands via HTTP POST instead of maintaining a WebSocket Gateway connection.

### Request Flow

```
User runs /harmony red
        │
        ▼
Discord API ──────────────────────────────┐
        │                                 │
        ▼                                 │
POST to Worker URL                        │
{                                         │
  "type": 2,  // APPLICATION_COMMAND      │
  "data": {                               │
    "name": "harmony",                    │
    "options": [{ "name": "color", "value": "red" }]
  }                                       │
}                                         │
        │                                 │
        ▼                                 │
Worker Handler                            │
  1. Verify signature                     │
  2. Parse interaction                    │
  3. Defer if needed                      │
  4. Generate image                       │
  5. Upload to R2                         │
  6. Return response                      │
        │                                 │
        ▼                                 │
Response to Discord                       │
{                                         │
  "type": 4,                              │
  "data": {                               │
    "embeds": [...],                      │
    "components": [...]                   │
  }                                       │
}                                         │
        │                                 │
        ▼                                 │
Discord displays response                 │
```

### Signature Verification

```typescript
import { verifyKey } from 'discord-interactions';

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  const body = await request.text();

  const isValid = verifyKey(body, signature!, timestamp!, env.DISCORD_PUBLIC_KEY);

  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const interaction = JSON.parse(body);
  // ... handle interaction
}
```

### Deferred Responses

For image generation (>3 seconds), use deferred responses:

```typescript
// Immediate response - defer
return Response.json({
  type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
});

// Then follow up within 15 minutes
await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    embeds: [...],
    components: [...]
  })
});
```

---

## Data Storage

### KV (Key-Value)

Best for: Rate limiting, user preferences, session data

```typescript
// Rate limiting example
const key = `rate:${userId}:${command}`;
const count = parseInt(await env.KV.get(key) || '0');

if (count >= LIMIT) {
  return rateLimitResponse();
}

await env.KV.put(key, String(count + 1), { expirationTtl: 60 });
```

### D1 (SQLite)

Best for: Presets, votes, moderation logs (already in use)

### R2 (Object Storage)

Best for: Generated images, cached API responses

```typescript
// Store generated image
const imageKey = `images/${interactionId}.png`;
await env.BUCKET.put(imageKey, pngBuffer, {
  httpMetadata: { contentType: 'image/png' }
});

// Public URL (requires public bucket or custom domain)
const imageUrl = `https://r2.xivdyetools.com/${imageKey}`;
```

### Durable Objects (Optional)

Best for: Complex stateful operations (not likely needed)

---

## Summary

| Component | Recommended Technology | Alternative |
|-----------|----------------------|-------------|
| Discord Integration | HTTP Interactions | — |
| Image Manipulation | photon-wasm | — |
| Vector Graphics | SVG Generation | — |
| SVG → PNG | resvg-wasm | — |
| Color Extraction | WASM (median-cut + k-means) | — |
| Caching | Cloudflare KV | — |
| Database | D1 (existing) | — |
| Image Hosting | R2 | — |
