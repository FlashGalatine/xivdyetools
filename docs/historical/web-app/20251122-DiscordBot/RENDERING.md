# Image Rendering System

**XIV Dye Tools Discord Bot** - Visual Output Generation Guide

**Version**: 1.0.0
**Last Updated**: November 22, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Rendering Architecture](#rendering-architecture)
4. [Color Wheel Renderer](#color-wheel-renderer)
5. [Gradient Renderer](#gradient-renderer)
6. [Swatch Grid Renderer](#swatch-grid-renderer)
7. [Comparison Chart Renderer](#comparison-chart-renderer)
8. [Image Processing](#image-processing)
9. [Performance Optimization](#performance-optimization)
10. [Testing Strategy](#testing-strategy)

---

## Overview

The Discord bot generates **PNG images** for visual outputs using the **node-canvas** library, which implements the HTML5 Canvas API in Node.js. This allows us to use familiar canvas drawing methods while running server-side.

### Renderer Types

| Renderer | Purpose | Output Size | Used By |
|----------|---------|-------------|---------|
| **ColorWheelRenderer** | Show harmony relationships | 400×400px | `/harmony` |
| **GradientRenderer** | Display color transitions | 600×100px | `/mixer` |
| **SwatchGridRenderer** | Colorblind simulation | Variable | `/accessibility` |
| **ComparisonChartRenderer** | HSV scatter plot | 500×500px | `/comparison` |
| **ImageProcessor** | Extract colors from uploads | N/A | `/match_image` |

---

## Technology Stack

### Core Dependencies

```json
{
  "dependencies": {
    "canvas": "^2.11.2",        // Canvas API for Node.js
    "sharp": "^0.33.0"          // Image processing & optimization
  },
  "devDependencies": {
    "@types/canvas": "^2.11.1"
  }
}
```

### Why These Libraries?

**node-canvas**:
- Native implementation of HTML5 Canvas API
- Familiar API for web developers
- Hardware-accelerated rendering
- Supports text, gradients, patterns, transforms

**sharp**:
- Fastest image processing library for Node.js
- Resize, crop, extract regions from images
- Convert between formats (PNG, JPG, WEBP)
- Low memory footprint

---

## Rendering Architecture

### Base Renderer Class

```typescript
import { createCanvas, Canvas, CanvasRenderingContext2D } from 'canvas';

export abstract class BaseRenderer {
  protected canvas: Canvas;
  protected ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.canvas = createCanvas(width, height);
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Render the image and return PNG buffer
   */
  abstract render(): Buffer;

  /**
   * Convert canvas to PNG buffer
   */
  protected toBuffer(): Buffer {
    return this.canvas.toBuffer('image/png');
  }

  /**
   * Set default styles
   */
  protected setDefaults() {
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  /**
   * Draw text with consistent styling
   */
  protected drawText(
    text: string,
    x: number,
    y: number,
    fontSize: number = 14,
    color: string = '#ffffff',
    align: CanvasTextAlign = 'left'
  ) {
    this.ctx.font = `${fontSize}px sans-serif`;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.fillText(text, x, y);
  }

  /**
   * Draw rounded rectangle
   */
  protected roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }
}
```

---

## Color Wheel Renderer

### Purpose

Generate a 400×400px color wheel showing:
- 60 color segments (6° each) in a donut shape
- Base dye indicator (white dot with black border)
- Harmony dye indicators (black dots with white border)
- Lines connecting center to harmony positions

### Algorithm

```typescript
import { BaseRenderer } from './base-renderer';
import { Dye } from '@xivdyetools/core';

export class ColorWheelRenderer extends BaseRenderer {
  private static readonly SIZE = 400;
  private static readonly OUTER_RADIUS = 180;
  private static readonly INNER_RADIUS = 80;
  private static readonly SEGMENTS = 60;

  constructor() {
    super(ColorWheelRenderer.SIZE, ColorWheelRenderer.SIZE);
  }

  /**
   * Render color wheel with harmony indicators
   */
  render(baseDye: Dye, harmonyDyes: Dye[]): Buffer {
    this.setDefaults();
    this.drawBackground();
    this.drawColorWheel();
    this.drawHarmonyLines(baseDye, harmonyDyes);
    this.drawHarmonyIndicators(baseDye, harmonyDyes);
    return this.toBuffer();
  }

  /**
   * Draw dark background
   */
  private drawBackground() {
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, ColorWheelRenderer.SIZE, ColorWheelRenderer.SIZE);
  }

  /**
   * Draw 60-segment color wheel donut
   */
  private drawColorWheel() {
    const centerX = ColorWheelRenderer.SIZE / 2;
    const centerY = ColorWheelRenderer.SIZE / 2;

    for (let i = 0; i < ColorWheelRenderer.SEGMENTS; i++) {
      const startAngle = (i / ColorWheelRenderer.SEGMENTS) * 2 * Math.PI - Math.PI / 2;
      const endAngle = ((i + 1) / ColorWheelRenderer.SEGMENTS) * 2 * Math.PI - Math.PI / 2;
      const hue = (i / ColorWheelRenderer.SEGMENTS) * 360;

      // Draw segment
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, ColorWheelRenderer.OUTER_RADIUS, startAngle, endAngle);
      this.ctx.arc(centerX, centerY, ColorWheelRenderer.INNER_RADIUS, endAngle, startAngle, true);
      this.ctx.closePath();

      // Fill with gradient (saturation decreases toward center)
      const gradient = this.ctx.createRadialGradient(
        centerX, centerY, ColorWheelRenderer.INNER_RADIUS,
        centerX, centerY, ColorWheelRenderer.OUTER_RADIUS
      );
      gradient.addColorStop(0, `hsl(${hue}, 30%, 70%)`);  // Desaturated center
      gradient.addColorStop(1, `hsl(${hue}, 100%, 50%)`); // Fully saturated edge

      this.ctx.fillStyle = gradient;
      this.ctx.fill();
    }
  }

  /**
   * Draw lines from center to harmony positions
   */
  private drawHarmonyLines(baseDye: Dye, harmonyDyes: Dye[]) {
    const centerX = ColorWheelRenderer.SIZE / 2;
    const centerY = ColorWheelRenderer.SIZE / 2;
    const allDyes = [baseDye, ...harmonyDyes];

    allDyes.forEach((dye) => {
      const angle = (dye.hsv.h / 360) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + Math.cos(angle) * ColorWheelRenderer.OUTER_RADIUS;
      const y = centerY + Math.sin(angle) * ColorWheelRenderer.OUTER_RADIUS;

      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.lineTo(x, y);
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    });
  }

  /**
   * Draw indicator dots at dye positions
   */
  private drawHarmonyIndicators(baseDye: Dye, harmonyDyes: Dye[]) {
    const centerX = ColorWheelRenderer.SIZE / 2;
    const centerY = ColorWheelRenderer.SIZE / 2;

    // Draw base dye (larger white dot)
    this.drawIndicator(baseDye, centerX, centerY, 12, '#ffffff', '#000000');

    // Draw harmony dyes (smaller black dots)
    harmonyDyes.forEach((dye) => {
      this.drawIndicator(dye, centerX, centerY, 8, '#000000', '#ffffff');
    });
  }

  /**
   * Draw a single indicator dot
   */
  private drawIndicator(
    dye: Dye,
    centerX: number,
    centerY: number,
    radius: number,
    fillColor: string,
    strokeColor: string
  ) {
    const angle = (dye.hsv.h / 360) * 2 * Math.PI - Math.PI / 2;
    const x = centerX + Math.cos(angle) * ColorWheelRenderer.OUTER_RADIUS;
    const y = centerY + Math.sin(angle) * ColorWheelRenderer.OUTER_RADIUS;

    // Draw dot
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();

    // Draw border
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }
}
```

### Usage Example

```typescript
import { ColorWheelRenderer } from './renderers/color-wheel';
import { DyeService } from '@xivdyetools/core';

const dyeService = new DyeService();
const baseDye = dyeService.getDyeByName('Dalamud Red');
const harmonyDyes = dyeService.findTriadicDyes(baseDye.hex);

const renderer = new ColorWheelRenderer();
const pngBuffer = renderer.render(baseDye, harmonyDyes);

// Attach to Discord message
await interaction.reply({
  files: [{
    attachment: pngBuffer,
    name: 'color_wheel_triadic.png'
  }]
});
```

---

## Gradient Renderer

### Purpose

Generate a 600×100px horizontal gradient showing color transitions between start and end dyes, with intermediate dye segments.

### Algorithm

```typescript
import { BaseRenderer } from './base-renderer';
import { Dye } from '@xivdyetools/core';

export class GradientRenderer extends BaseRenderer {
  private static readonly WIDTH = 600;
  private static readonly HEIGHT = 100;

  constructor() {
    super(GradientRenderer.WIDTH, GradientRenderer.HEIGHT);
  }

  /**
   * Render gradient with intermediate dyes
   */
  render(steps: Dye[]): Buffer {
    this.setDefaults();
    this.drawGradient(steps);
    this.drawLabels(steps);
    return this.toBuffer();
  }

  /**
   * Draw gradient segments
   */
  private drawGradient(steps: Dye[]) {
    const segmentWidth = GradientRenderer.WIDTH / steps.length;

    steps.forEach((dye, index) => {
      this.ctx.fillStyle = dye.hex;
      this.ctx.fillRect(
        index * segmentWidth,
        0,
        segmentWidth,
        GradientRenderer.HEIGHT
      );
    });
  }

  /**
   * Draw percentage labels at key positions
   */
  private drawLabels(steps: Dye[]) {
    const segmentWidth = GradientRenderer.WIDTH / steps.length;

    // Draw 0%, 50%, 100% labels
    const positions = [
      { index: 0, label: '0%' },
      { index: Math.floor(steps.length / 2), label: '50%' },
      { index: steps.length - 1, label: '100%' }
    ];

    positions.forEach(({ index, label }) => {
      const x = (index + 0.5) * segmentWidth;
      const y = GradientRenderer.HEIGHT / 2;

      // Draw background for text
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      this.roundRect(x - 20, y - 12, 40, 24, 4);
      this.ctx.fill();

      // Draw text
      this.drawText(label, x, y + 5, 14, '#ffffff', 'center');
    });
  }

  /**
   * Advanced: Draw smooth gradient using Canvas gradient API
   */
  renderSmooth(startDye: Dye, endDye: Dye): Buffer {
    this.setDefaults();

    const gradient = this.ctx.createLinearGradient(
      0,
      0,
      GradientRenderer.WIDTH,
      0
    );

    gradient.addColorStop(0, startDye.hex);
    gradient.addColorStop(1, endDye.hex);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, GradientRenderer.WIDTH, GradientRenderer.HEIGHT);

    return this.toBuffer();
  }
}
```

### Usage Example

```typescript
import { GradientRenderer } from './renderers/gradient';
import { ColorService, DyeService } from '@xivdyetools/core';

const dyeService = new DyeService();
const startDye = dyeService.getDyeByName('Snow White');
const endDye = dyeService.getDyeByName('Jet Black');

// Interpolate 10 steps
const steps: Dye[] = [];
for (let i = 0; i <= 10; i++) {
  const ratio = i / 10;
  const interpolated = ColorService.interpolateRGB(startDye.rgb, endDye.rgb, ratio);
  const closestDye = dyeService.findClosestDye(interpolated);
  steps.push(closestDye);
}

const renderer = new GradientRenderer();
const pngBuffer = renderer.render(steps);
```

---

## Swatch Grid Renderer

### Purpose

Generate a grid of color swatches showing how dyes appear under different vision types (normal, deuteranopia, protanopia, tritanopia, achromatopsia).

### Algorithm

```typescript
import { BaseRenderer } from './base-renderer';
import { Dye, VisionType, ColorService } from '@xivdyetools/core';

export class SwatchGridRenderer extends BaseRenderer {
  private static readonly SWATCH_SIZE = 80;
  private static readonly LABEL_HEIGHT = 30;

  constructor(cols: number, rows: number) {
    const width = cols * SwatchGridRenderer.SWATCH_SIZE;
    const height = rows * SwatchGridRenderer.SWATCH_SIZE + SwatchGridRenderer.LABEL_HEIGHT;
    super(width, height);
  }

  /**
   * Render swatch grid for colorblind simulation
   */
  render(dyes: Dye[], visionTypes: VisionType[]): Buffer {
    this.setDefaults();
    this.drawBackground();
    this.drawColumnLabels(dyes);
    this.drawSwatches(dyes, visionTypes);
    this.drawRowLabels(visionTypes);
    return this.toBuffer();
  }

  /**
   * Draw dark background
   */
  private drawBackground() {
    this.ctx.fillStyle = '#2a2a2a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw dye names at top
   */
  private drawColumnLabels(dyes: Dye[]) {
    dyes.forEach((dye, col) => {
      const x = (col + 0.5) * SwatchGridRenderer.SWATCH_SIZE;
      const y = 20;

      // Truncate long names
      const name = dye.name.length > 10 ? dye.name.substring(0, 8) + '...' : dye.name;
      this.drawText(name, x, y, 12, '#ffffff', 'center');
    });
  }

  /**
   * Draw vision type labels on left
   */
  private drawRowLabels(visionTypes: VisionType[]) {
    const labels: Record<VisionType, string> = {
      normal: 'Normal',
      deuteranopia: 'Deuter.',
      protanopia: 'Protan.',
      tritanopia: 'Tritan.',
      achromatopsia: 'Achrom.'
    };

    visionTypes.forEach((visionType, row) => {
      const x = 5;
      const y = SwatchGridRenderer.LABEL_HEIGHT + (row + 0.5) * SwatchGridRenderer.SWATCH_SIZE + 5;

      // Draw text with background
      this.ctx.save();
      this.ctx.rotate(-Math.PI / 2);
      this.drawText(labels[visionType], -y, x + 10, 10, '#ffffff', 'center');
      this.ctx.restore();
    });
  }

  /**
   * Draw color swatches
   */
  private drawSwatches(dyes: Dye[], visionTypes: VisionType[]) {
    visionTypes.forEach((visionType, row) => {
      dyes.forEach((dye, col) => {
        const x = col * SwatchGridRenderer.SWATCH_SIZE;
        const y = SwatchGridRenderer.LABEL_HEIGHT + row * SwatchGridRenderer.SWATCH_SIZE;

        // Simulate colorblindness
        const simulated = ColorService.simulateColorblindness(dye.rgb, visionType);
        const hex = ColorService.rgbToHex(simulated);

        // Draw swatch with border
        this.ctx.fillStyle = hex;
        this.ctx.fillRect(x + 2, y + 2, SwatchGridRenderer.SWATCH_SIZE - 4, SwatchGridRenderer.SWATCH_SIZE - 4);

        // Draw border
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x + 2, y + 2, SwatchGridRenderer.SWATCH_SIZE - 4, SwatchGridRenderer.SWATCH_SIZE - 4);
      });
    });
  }
}
```

### Usage Example

```typescript
import { SwatchGridRenderer } from './renderers/swatch-grid';
import { DyeService, VisionType } from '@xivdyetools/core';

const dyeService = new DyeService();
const dyes = [
  dyeService.getDyeByName('Snow White'),
  dyeService.getDyeByName('Jet Black'),
  dyeService.getDyeByName('Dalamud Red')
];

const visionTypes: VisionType[] = [
  'normal',
  'deuteranopia',
  'protanopia',
  'tritanopia',
  'achromatopsia'
];

const renderer = new SwatchGridRenderer(dyes.length, visionTypes.length);
const pngBuffer = renderer.render(dyes, visionTypes);
```

---

## Comparison Chart Renderer

### Purpose

Generate a 500×500px scatter plot showing dyes plotted on HSV axes (hue vs. saturation).

### Algorithm

```typescript
import { BaseRenderer } from './base-renderer';
import { Dye } from '@xivdyetools/core';

export class ComparisonChartRenderer extends BaseRenderer {
  private static readonly SIZE = 500;
  private static readonly PADDING = 60;
  private static readonly PLOT_SIZE = ComparisonChartRenderer.SIZE - 2 * ComparisonChartRenderer.PADDING;

  constructor() {
    super(ComparisonChartRenderer.SIZE, ComparisonChartRenderer.SIZE);
  }

  /**
   * Render HSV scatter plot
   */
  render(dyes: Dye[]): Buffer {
    this.setDefaults();
    this.drawBackground();
    this.drawAxes();
    this.drawGrid();
    this.drawPoints(dyes);
    this.drawLegend(dyes);
    return this.toBuffer();
  }

  /**
   * Draw white background
   */
  private drawBackground() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, ComparisonChartRenderer.SIZE, ComparisonChartRenderer.SIZE);
  }

  /**
   * Draw X and Y axes
   */
  private drawAxes() {
    const padding = ComparisonChartRenderer.PADDING;
    const size = ComparisonChartRenderer.SIZE;

    // X-axis (Hue: 0-360°)
    this.ctx.beginPath();
    this.ctx.moveTo(padding, size - padding);
    this.ctx.lineTo(size - padding, size - padding);
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Y-axis (Saturation: 0-100%)
    this.ctx.beginPath();
    this.ctx.moveTo(padding, padding);
    this.ctx.lineTo(padding, size - padding);
    this.ctx.stroke();

    // Axis labels
    this.drawText('Hue (°)', size / 2, size - 20, 14, '#333333', 'center');

    this.ctx.save();
    this.ctx.rotate(-Math.PI / 2);
    this.drawText('Saturation (%)', -(size / 2), 20, 14, '#333333', 'center');
    this.ctx.restore();
  }

  /**
   * Draw grid lines
   */
  private drawGrid() {
    const padding = ComparisonChartRenderer.PADDING;
    const plotSize = ComparisonChartRenderer.PLOT_SIZE;

    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 1;

    // Vertical grid lines (every 60°)
    for (let hue = 0; hue <= 360; hue += 60) {
      const x = padding + (hue / 360) * plotSize;

      this.ctx.beginPath();
      this.ctx.moveTo(x, padding);
      this.ctx.lineTo(x, padding + plotSize);
      this.ctx.stroke();

      // Label
      this.drawText(hue.toString(), x, padding + plotSize + 15, 10, '#666666', 'center');
    }

    // Horizontal grid lines (every 25%)
    for (let sat = 0; sat <= 100; sat += 25) {
      const y = padding + plotSize - (sat / 100) * plotSize;

      this.ctx.beginPath();
      this.ctx.moveTo(padding, y);
      this.ctx.lineTo(padding + plotSize, y);
      this.ctx.stroke();

      // Label
      this.drawText(sat.toString(), padding - 20, y + 5, 10, '#666666', 'right');
    }
  }

  /**
   * Plot dye points
   */
  private drawPoints(dyes: Dye[]) {
    const padding = ComparisonChartRenderer.PADDING;
    const plotSize = ComparisonChartRenderer.PLOT_SIZE;

    dyes.forEach((dye, index) => {
      const x = padding + (dye.hsv.h / 360) * plotSize;
      const y = padding + plotSize - (dye.hsv.s / 100) * plotSize;

      // Draw point
      this.ctx.beginPath();
      this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
      this.ctx.fillStyle = dye.hex;
      this.ctx.fill();

      // Draw border
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Draw label (number)
      this.drawText((index + 1).toString(), x, y + 4, 10, '#ffffff', 'center');
    });
  }

  /**
   * Draw legend
   */
  private drawLegend(dyes: Dye[]) {
    const startX = 10;
    const startY = 10;

    dyes.forEach((dye, index) => {
      const y = startY + index * 20;

      // Draw color box
      this.ctx.fillStyle = dye.hex;
      this.ctx.fillRect(startX, y, 15, 15);
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(startX, y, 15, 15);

      // Draw label
      this.drawText(`${index + 1}. ${dye.name}`, startX + 20, y + 12, 12, '#333333', 'left');
    });
  }
}
```

---

## Image Processing

### Color Extraction from Uploaded Images

```typescript
import sharp from 'sharp';
import { RGB } from '@xivdyetools/core';

export class ImageProcessor {
  /**
   * Extract average color from a region of an image
   */
  static async extractColor(
    imageBuffer: Buffer,
    x: number,
    y: number,
    sampleSize: number = 5
  ): Promise<RGB> {
    // Extract region
    const { data, info } = await sharp(imageBuffer)
      .extract({
        left: Math.max(0, x),
        top: Math.max(0, y),
        width: sampleSize,
        height: sampleSize
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate average RGB
    let r = 0, g = 0, b = 0;
    const pixelCount = data.length / info.channels;

    for (let i = 0; i < data.length; i += info.channels) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      // Ignore alpha channel (i + 3) if present
    }

    return {
      r: Math.round(r / pixelCount),
      g: Math.round(g / pixelCount),
      b: Math.round(b / pixelCount)
    };
  }

  /**
   * Generate preview image showing sample region
   */
  static async generatePreview(
    imageBuffer: Buffer,
    x: number,
    y: number,
    sampleSize: number,
    extractedColor: RGB
  ): Buffer {
    // Resize image to max 400px width while maintaining aspect ratio
    const resized = await sharp(imageBuffer)
      .resize(400, 400, { fit: 'inside' })
      .toBuffer();

    // Create canvas with image + color swatch
    const canvas = createCanvas(400, 450);
    const ctx = canvas.getContext('2d');

    // Draw resized image
    const img = await loadImage(resized);
    ctx.drawImage(img, 0, 0);

    // Draw crosshair at sample location
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, sampleSize, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw extracted color swatch below
    const hex = ColorService.rgbToHex(extractedColor);
    ctx.fillStyle = hex;
    ctx.fillRect(0, 400, 400, 50);

    return canvas.toBuffer('image/png');
  }

  /**
   * Validate image before processing
   */
  static async validateImage(buffer: Buffer): Promise<{ valid: boolean; error?: string }> {
    try {
      const metadata = await sharp(buffer).metadata();

      // Check format
      const validFormats = ['png', 'jpg', 'jpeg', 'webp'];
      if (!metadata.format || !validFormats.includes(metadata.format)) {
        return { valid: false, error: `Invalid format. Supported: ${validFormats.join(', ')}` };
      }

      // Check dimensions
      if (!metadata.width || !metadata.height) {
        return { valid: false, error: 'Could not read image dimensions' };
      }

      if (metadata.width > 4096 || metadata.height > 4096) {
        return { valid: false, error: 'Image too large. Max dimensions: 4096×4096' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid image file' };
    }
  }
}
```

---

## Performance Optimization

### Rendering Performance

**Target**: All renders < 200ms

**Strategies**:

1. **Pre-calculate Constants**
   ```typescript
   // Bad: Calculate every frame
   for (let i = 0; i < 60; i++) {
     const angle = (i / 60) * 2 * Math.PI;
   }

   // Good: Calculate once
   const angles = Array.from({ length: 60 }, (_, i) => (i / 60) * 2 * Math.PI);
   ```

2. **Use Hardware Acceleration**
   ```typescript
   // Enable image smoothing (GPU-accelerated)
   ctx.imageSmoothingEnabled = true;
   ctx.imageSmoothingQuality = 'high';
   ```

3. **Optimize Sharp Processing**
   ```typescript
   // Chain operations for better performance
   await sharp(buffer)
     .resize(400, 400)
     .extract({ left: x, top: y, width: 5, height: 5 })
     .raw()
     .toBuffer();
   ```

4. **Cache Rendered Images**
   ```typescript
   import NodeCache from 'node-cache';

   const renderCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL

   function getCachedRender(key: string, renderFn: () => Buffer): Buffer {
     const cached = renderCache.get<Buffer>(key);
     if (cached) return cached;

     const rendered = renderFn();
     renderCache.set(key, rendered);
     return rendered;
   }

   // Usage
   const cacheKey = `wheel_${baseDye.hex}_${harmonyType}`;
   const buffer = getCachedRender(cacheKey, () => renderer.render(baseDye, harmonyDyes));
   ```

### Memory Management

```typescript
// Dispose of canvas after use
function renderAndCleanup(): Buffer {
  const renderer = new ColorWheelRenderer();
  const buffer = renderer.render(baseDye, harmonyDyes);

  // Canvas is garbage collected automatically
  // But explicitly null references if needed
  renderer = null;

  return buffer;
}
```

---

## Testing Strategy

### Unit Tests for Renderers

```typescript
import { describe, it, expect } from 'vitest';
import { ColorWheelRenderer } from './color-wheel';
import sharp from 'sharp';

describe('ColorWheelRenderer', () => {
  it('should generate 400x400 PNG', async () => {
    const renderer = new ColorWheelRenderer();
    const buffer = renderer.render(baseDye, harmonyDyes);

    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(400);
    expect(metadata.format).toBe('png');
  });

  it('should render without errors for all harmony types', () => {
    const renderer = new ColorWheelRenderer();
    const types = ['complementary', 'triadic', 'analogous', 'square'];

    types.forEach(type => {
      const harmonyDyes = dyeService.findHarmonyDyes(baseDye.hex, type);
      expect(() => renderer.render(baseDye, harmonyDyes)).not.toThrow();
    });
  });

  it('should include all dye indicators', async () => {
    // Render image
    const buffer = renderer.render(baseDye, harmonyDyes);

    // Use sharp to analyze pixel data
    // (This is a simplified example - actual testing would be more complex)
    const { data } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });

    // Verify that specific pixels match expected colors
    // (Check for white and black indicator dots)
  });
});
```

### Visual Regression Testing

```typescript
import { toMatchImageSnapshot } from 'jest-image-snapshot';
expect.extend({ toMatchImageSnapshot });

it('should match snapshot', () => {
  const buffer = renderer.render(baseDye, harmonyDyes);
  expect(buffer).toMatchImageSnapshot({
    customDiffConfig: { threshold: 0.1 },
    failureThreshold: 0.01,
    failureThresholdType: 'percent'
  });
});
```

---

## Next Steps

1. **Review**: [ARCHITECTURE.md](./ARCHITECTURE.md) for overall system design
2. **Review**: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for extracting services
3. **Implement**: Renderer classes in `packages/discord-bot/src/renderers/`
4. **Test**: Use visual regression testing to validate output

---

**Last Updated**: November 22, 2025
**Author**: XIV Dye Tools Team
**Version**: 1.0.0
