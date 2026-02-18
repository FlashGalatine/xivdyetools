> **⚠️ DEPRECATED:** This document has been superseded by the Documentation Bible.
> See: [specifications/multi-color-extraction.md](specifications/multi-color-extraction.md)

# Multi-Color Palette Extraction - Technical Specification

> Feature Status: Planned
> Platforms: Web App + Discord Bot
> Core Library Changes: Yes (clustering algorithm)

## Overview

Extract multiple dominant colors from an image (3-5 colors) instead of just one. This is an enhancement to the existing Color Matcher tool - "Color Matcher on steroids."

### User Value

- **Match entire glamour screenshots** - Not just single pieces, capture the full outfit palette
- **Create palettes from inspiration images** - Artwork, photos, other games
- **Capture the "vibe"** - Get a full palette that represents an image's aesthetic

---

## Algorithm Options

### Option A: K-Means Clustering (Recommended)

**How it works:**
1. Sample pixels from image (downsample to ~256×256 for performance)
2. Convert to RGB color space
3. Initialize K centroids randomly (K = desired palette size)
4. Iterate until convergence:
   - Assign each pixel to nearest centroid
   - Recalculate centroids as mean of assigned pixels
5. Return final centroids as dominant colors
6. Sort by cluster size (most dominant first)

**Pros:**
- Well-understood algorithm
- Configurable number of colors (K)
- Good at finding "average" representative colors

**Cons:**
- Random initialization can produce different results
- May not capture small but visually important colors
- Converges to local optima

**Implementation Notes:**
- Use K-means++ initialization for better starting centroids
- Limit iterations (max 20-30) for performance
- Consider using LAB color space for perceptually uniform clustering

### Option B: Median Cut Quantization

**How it works:**
1. Place all pixels in a single "bucket"
2. Find the color channel with greatest range
3. Sort pixels by that channel and split at median
4. Repeat until desired number of buckets reached
5. Average each bucket to get palette color

**Pros:**
- Deterministic results
- Fast execution
- Good for images with distinct color regions

**Cons:**
- Number of colors must be power of 2 (2, 4, 8, 16...)
- May miss small color populations

### Option C: Octree Quantization

**How it works:**
1. Build octree structure from pixel colors
2. Merge least significant nodes until target count reached
3. Extract colors from remaining leaf nodes

**Pros:**
- Memory efficient
- Good for large images
- Preserves color fidelity

**Cons:**
- More complex to implement
- May produce less intuitive palettes

---

## Recommended Approach

**Use K-Means Clustering** with the following parameters:

```typescript
interface PaletteExtractionOptions {
  colorCount: number;      // 3, 4, or 5 (user configurable)
  maxIterations: number;   // 25 (balance accuracy vs speed)
  convergenceThreshold: number; // 1.0 (RGB distance)
  sampleSize: number;      // 10000 pixels max
  colorSpace: 'rgb' | 'lab'; // 'lab' for perceptual accuracy
}
```

**Why K-Means:**
- Most flexible for our 3-5 color requirement
- Well-supported in both JavaScript (web) and Node.js (bot)
- Existing libraries available, or straightforward to implement

---

## Implementation Location

### Option A: Core Library (Recommended)

Add to `xivdyetools-core`:

```typescript
// src/services/PaletteService.ts
export class PaletteService {
  /**
   * Extract dominant colors from pixel data
   * @param pixels - Array of RGB values [{r, g, b}, ...]
   * @param colorCount - Number of colors to extract (3-5)
   * @returns Array of extracted RGB colors, sorted by dominance
   */
  extractPalette(pixels: RGB[], colorCount: number): RGB[];

  /**
   * Extract palette and match to closest dyes
   * @param pixels - Array of RGB values
   * @param colorCount - Number of colors to extract
   * @param dyeService - DyeService instance for matching
   * @returns Array of {extracted: RGB, matchedDye: Dye, distance: number}
   */
  extractAndMatchPalette(
    pixels: RGB[],
    colorCount: number,
    dyeService: DyeService
  ): PaletteMatch[];
}

interface PaletteMatch {
  extracted: RGB;
  matchedDye: Dye;
  distance: number;
  dominance: number; // Percentage of pixels in this cluster
}
```

**Benefits of Core Library:**
- Reusable across web app and Discord bot
- Consistent results on both platforms
- Centralized testing and maintenance

### Option B: App-Level Implementation

If core library changes are deferred:

**Web App:** Use Canvas API to read pixels, implement K-means in TypeScript
**Discord Bot:** Use Sharp to read pixels, implement K-means in TypeScript

---

## Web App Implementation

### UI Changes to Color Matcher

```
┌─────────────────────────────────────────────┐
│  Color Matcher                              │
├─────────────────────────────────────────────┤
│  Mode: [● Single Color] [○ Extract Palette] │
│                                             │
│  [When "Extract Palette" selected:]         │
│  Colors to extract: [3] [4] [5]             │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │         [Drop image here]           │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Extracted Palette:                         │
│  ┌─────┬─────┬─────┬─────┬─────┐           │
│  │ #1  │ #2  │ #3  │ #4  │ #5  │           │
│  │45%  │28%  │15%  │ 8%  │ 4%  │           │
│  └─────┴─────┴─────┴─────┴─────┘           │
│                                             │
│  Matched Dyes:                              │
│  ┌──────────────────────────────────────┐   │
│  │ Dalamud Red    │ #AA1111 │ Δ12.3    │   │
│  │ Jet Black      │ #0A0A0A │ Δ 5.7    │   │
│  │ Snow White     │ #F5F5F5 │ Δ 8.2    │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  [Save Palette] [Copy All] [Export]         │
└─────────────────────────────────────────────┘
```

### File Changes

| File | Changes |
|------|---------|
| `color-matcher-tool.ts` | Add mode toggle, palette UI |
| `palette-extraction-service.ts` | New service (or use core) |
| `palette-results.ts` | New component for palette display |

### User Flow

1. User toggles to "Extract Palette" mode
2. User selects color count (3, 4, or 5)
3. User uploads/pastes/captures image
4. System extracts palette using K-means
5. System matches each color to closest dye
6. Results displayed with dominance percentages
7. User can save palette or export

---

## Discord Bot Implementation

### Enhanced `/match_image` Command

```
/match_image image:<attachment> [colors:<1-5>]
```

**Parameters:**
- `image` (required): Image file (PNG, JPG, GIF, WebP)
- `colors` (optional, default: 1): Number of colors to extract (1-5)

### Response Format

**Single Color (colors=1)** - Current behavior unchanged

**Multi-Color (colors=3-5):**
```
🎨 Palette Extraction Results

Extracted 4 colors from your image:

Color 1 (42%) → Dalamud Red
  Extracted: #B01515 | Matched: #AA1111 | Distance: 12.3

Color 2 (31%) → Jet Black
  Extracted: #0C0C0C | Matched: #0A0A0A | Distance: 5.7

Color 3 (18%) → Snow White
  Extracted: #F0F0F0 | Matched: #F5F5F5 | Distance: 8.2

Color 4 (9%) → Metallic Gold
  Extracted: #C9A227 | Matched: #CBA135 | Distance: 14.1

[Attached: palette_grid.png]
```

### New Renderer: Palette Grid

Create `src/renderers/palette-grid.ts`:

```typescript
interface PaletteGridOptions {
  colors: Array<{
    extracted: RGB;
    matched: Dye;
    distance: number;
    dominance: number;
  }>;
  width?: number;  // Default: 800
  height?: number; // Default: 400
}

function renderPaletteGrid(options: PaletteGridOptions): Buffer;
```

**Visual Layout:**
```
┌────────────────────────────────────────────┐
│  EXTRACTED          MATCHED DYE            │
├────────────────────────────────────────────┤
│  [█████] 42%   →   [█████] Dalamud Red     │
│  #B01515           #AA1111  Δ12.3          │
├────────────────────────────────────────────┤
│  [█████] 31%   →   [█████] Jet Black       │
│  #0C0C0C           #0A0A0A  Δ5.7           │
├────────────────────────────────────────────┤
│  [█████] 18%   →   [█████] Snow White      │
│  #F0F0F0           #F5F5F5  Δ8.2           │
├────────────────────────────────────────────┤
│  [█████] 9%    →   [█████] Metallic Gold   │
│  #C9A227           #CBA135  Δ14.1          │
└────────────────────────────────────────────┘
```

### File Changes

| File | Changes |
|------|---------|
| `match-image.ts` | Add `colors` parameter, handle multi-color |
| `palette-grid.ts` | New renderer |
| `palette-service.ts` | K-means implementation (or use core) |

---

## Performance Considerations

### Image Sampling

Don't process every pixel - sample for performance:

```typescript
function samplePixels(imageData: ImageData, maxSamples: number): RGB[] {
  const totalPixels = imageData.width * imageData.height;
  const step = Math.max(1, Math.floor(totalPixels / maxSamples));

  const samples: RGB[] = [];
  for (let i = 0; i < totalPixels; i += step) {
    const idx = i * 4;
    samples.push({
      r: imageData.data[idx],
      g: imageData.data[idx + 1],
      b: imageData.data[idx + 2]
    });
  }
  return samples;
}
```

**Recommended:** 10,000 samples max (sufficient for accurate clustering)

### Timeouts

- **Web App:** No hard timeout, but show loading indicator
- **Discord Bot:** 10 second timeout (existing), may need to increase to 15s

### Caching

- Don't cache palette extraction results (too many variations)
- Do cache dye matching results (already implemented in DyeService)

---

## Testing Strategy

### Unit Tests

```typescript
describe('PaletteService', () => {
  it('should extract correct number of colors', () => {
    const pixels = generateTestPixels();
    const palette = paletteService.extractPalette(pixels, 3);
    expect(palette).toHaveLength(3);
  });

  it('should return colors sorted by dominance', () => {
    const pixels = generateRedDominantPixels();
    const palette = paletteService.extractPalette(pixels, 3);
    // First color should be reddish
    expect(palette[0].r).toBeGreaterThan(palette[0].g);
    expect(palette[0].r).toBeGreaterThan(palette[0].b);
  });

  it('should handle single-color images', () => {
    const pixels = generateSolidColorPixels('#FF0000');
    const palette = paletteService.extractPalette(pixels, 3);
    // All colors should be similar to red
    palette.forEach(color => {
      expect(color.r).toBeGreaterThan(200);
    });
  });
});
```

### Integration Tests

- Test with real FFXIV screenshots
- Test with edge cases: single color, gradient, noisy images
- Test performance with large images

---

## Dependencies

### Web App
- No new dependencies (Canvas API is built-in)
- Optional: `quantize` npm package for median cut

### Discord Bot
- Existing: `sharp` (already used for image processing)
- No new dependencies needed

### Core Library
- No new dependencies
- Pure TypeScript implementation

---

## Rollout Plan

1. **Phase 1:** Implement in core library with unit tests
2. **Phase 2:** Integrate into Discord bot `/match_image` command
3. **Phase 3:** Integrate into web app Color Matcher
4. **Phase 4:** Add save/export functionality

---

## Future Enhancements

- **Color filtering:** Exclude background colors (e.g., UI elements)
- **Region selection:** Extract from selected area only
- **Preset matching:** Match extracted palette to preset palettes
- **Harmony analysis:** Analyze if extracted colors form harmonious palette
