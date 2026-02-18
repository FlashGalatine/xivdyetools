# Discord Bot Architecture

**XIV Dye Tools Discord Bot** - System Design & Implementation Guide

**Version**: 1.0.0
**Last Updated**: November 22, 2025
**Status**: Planning Phase

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Service Reuse Strategy](#service-reuse-strategy)
4. [Technology Stack](#technology-stack)
5. [Data Flow Architecture](#data-flow-architecture)
6. [Caching Layer](#caching-layer)
7. [Image Rendering System](#image-rendering-system)
8. [Error Handling](#error-handling)
9. [Performance Considerations](#performance-considerations)
10. [Security](#security)

---

## Overview

The XIV Dye Tools Discord Bot brings the functionality of the XIV Dye Tools web application (v2.0.0) to Discord servers, allowing users to access color harmony generation, dye matching, accessibility checking, and more directly from Discord.

### Design Principles

1. **Maximum Code Reuse** - Leverage the existing TypeScript service layer from the web app
2. **Type Safety** - Maintain full TypeScript strict mode compliance
3. **Stateless Commands** - Each command execution is independent
4. **Fast Response Times** - Aggressive caching and optimized rendering
5. **Graceful Degradation** - Handle API failures without crashing

### Key Features

- ✅ **Color Harmony Explorer** - Generate complementary, triadic, analogous, etc. color schemes
- ✅ **Color Matcher** - Find FFXIV dyes matching hex colors or uploaded images
- ✅ **Accessibility Checker** - Simulate colorblindness and check WCAG compliance
- ✅ **Dye Comparison** - Compare up to 4 dyes side-by-side
- ✅ **Dye Mixer** - Find intermediate dyes for smooth color transitions
- ✅ **Market Board Pricing** - Optional Universalis API integration

---

## Project Structure

### Monorepo Layout

```
xivdyetools-discord-bot/
├── packages/
│   ├── core/                          # Shared business logic (extracted from web app)
│   │   ├── src/
│   │   │   ├── services/
│   │   │   │   ├── color.service.ts   # Color algorithms (reused 100%)
│   │   │   │   ├── dye.service.ts     # Dye database & harmony (minor mods)
│   │   │   │   └── api.service.ts     # Universalis API (refactored for Node.js)
│   │   │   ├── types/
│   │   │   │   └── index.ts           # Type definitions
│   │   │   ├── constants/
│   │   │   │   └── index.ts           # Constants & matrices
│   │   │   ├── utils/
│   │   │   │   └── index.ts           # Helper functions
│   │   │   └── data/
│   │   │       └── colors_xiv.json    # Dye database
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── discord-bot/                    # Discord-specific implementation
│       ├── src/
│       │   ├── commands/
│       │   │   ├── harmony.ts         # /harmony command handler
│       │   │   ├── match.ts           # /match command handler
│       │   │   ├── match-image.ts     # /match_image command handler
│       │   │   ├── accessibility.ts   # /accessibility command handler
│       │   │   ├── comparison.ts      # /comparison command handler
│       │   │   ├── mixer.ts           # /mixer command handler
│       │   │   └── index.ts           # Command registry
│       │   ├── renderers/
│       │   │   ├── color-wheel.ts     # Color wheel PNG generation
│       │   │   ├── gradient.ts        # Gradient line rendering
│       │   │   ├── swatches.ts        # Colorblind swatch grid
│       │   │   ├── charts.ts          # Comparison charts
│       │   │   └── index.ts           # Renderer exports
│       │   ├── utils/
│       │   │   ├── embed-builder.ts   # Discord embed helpers
│       │   │   ├── cache-manager.ts   # Redis/in-memory caching
│       │   │   └── image-processor.ts # Sharp-based image handling
│       │   ├── database/
│       │   │   ├── schema.ts          # User preferences schema
│       │   │   └── repository.ts      # Database operations
│       │   ├── config/
│       │   │   └── env.ts             # Environment configuration
│       │   └── bot.ts                 # Main bot entry point
│       ├── package.json
│       └── tsconfig.json
├── .env.example
├── docker-compose.yml
└── README.md
```

### Repository Strategy

**Option A: Separate Repository (Recommended)**
- New repo: `xivdyetools-discord-bot`
- Copies `src/services/`, `src/types/`, `src/constants/` from web app
- Easier to manage Discord-specific dependencies
- Can evolve independently

**Option B: Monorepo in Existing Repo**
- Add `packages/` folder to existing `xivdyetools` repo
- Share code via workspace references
- Single source of truth for services
- More complex build setup

**Recommendation**: Start with **Option A** for simplicity, revisit if services need frequent syncing.

---

## Service Reuse Strategy

### ColorService (100% Reusable)

**Source**: `src/services/color-service.ts` (web app)

**No modifications needed** - This service has zero browser dependencies:

```typescript
// Copy directly from web app
export class ColorService {
  static hexToRgb(hex: string): RGB { ... }
  static rgbToHex(rgb: RGB): string { ... }
  static simulateColorblindness(rgb: RGB, type: VisionType): RGB { ... }
  static getColorDistance(rgb1: RGB, rgb2: RGB): number { ... }
  static getContrastRatio(rgb1: RGB, rgb2: RGB): number { ... }
  // ... 20+ pure functions
}
```

**Why it's perfect**:
- All static methods (no state)
- Pure mathematical transformations
- No DOM/Canvas/localStorage dependencies
- Fully tested (100+ unit tests)

### DyeService (Minor Modifications)

**Source**: `src/services/dye-service.ts` (web app)

**Changes needed**:

```typescript
// Before (web app - browser):
import dyesJSON from '../../assets/json/colors_xiv.json';

export class DyeService {
  private static instance: DyeService;
  private dyes: Dye[] = dyesJSON as Dye[];

  static getInstance(): DyeService {
    if (!DyeService.instance) {
      DyeService.instance = new DyeService();
    }
    return DyeService.instance;
  }
}

// After (Discord bot - Node.js):
import { readFileSync } from 'fs';
import { join } from 'path';

export class DyeService {
  private dyes: Dye[];

  constructor(dyesData?: Dye[]) {
    if (dyesData) {
      this.dyes = dyesData;
    } else {
      const jsonPath = join(__dirname, '../data/colors_xiv.json');
      this.dyes = JSON.parse(readFileSync(jsonPath, 'utf-8')) as Dye[];
    }
    this.initialize();
  }

  // All harmony methods remain unchanged
  findComplementaryPair(baseColor: string): Dye[] { ... }
  findTriadicDyes(baseColor: string): Dye[] { ... }
  // ... etc
}
```

**Why these changes**:
- Remove singleton pattern (allows dependency injection for testing)
- Replace JSON import with file system read (Node.js compatible)
- Keep all harmony/matching algorithms identical

### APIService (Major Refactoring)

**Source**: `src/services/api-service.ts` (web app)

**Changes needed**:

```typescript
// Before (web app):
export class APIService {
  private static cache = new Map<string, CachedData>();

  static async getPriceData(itemID: number, dataCenterID?: string) {
    const cached = StorageService.getItem(cacheKey, null);
    if (cached) return cached;

    const response = await fetch(url);
    StorageService.setItem(cacheKey, data);
  }
}

// After (Discord bot):
import fetch from 'node-fetch';
import Redis from 'ioredis';

export class APIService {
  private redis: Redis;
  private static CACHE_TTL = 300; // 5 minutes

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async getPriceData(itemID: number, dataCenterID?: string) {
    const cacheKey = `price:${itemID}:${dataCenterID || 'global'}`;

    // Check Redis cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from Universalis API
    const url = `https://universalis.app/api/v2/aggregated/${dataCenterID || 'North-America'}/${itemID}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache in Redis
    await this.redis.setex(cacheKey, APIService.CACHE_TTL, JSON.stringify(data));

    return data;
  }

  async disconnect() {
    await this.redis.quit();
  }
}
```

**Why these changes**:
- Replace browser `fetch()` with `node-fetch`
- Replace localStorage with Redis for persistent caching
- Add connection management (connect/disconnect)
- Keep rate limiting and retry logic

**CJK Character Support**:
Universalis API uses CJK characters as official identifiers for Chinese and Korean data centers:
- Chinese: `陆行鸟`, `莫古力`, `猫小胖`, `豆豆柴`
- Korean: `한국`

Modern `fetch()` implementations (Node.js 18+) automatically handle URL encoding for Unicode characters:
```typescript
// This works correctly - no manual encoding needed
const url = `https://universalis.app/api/v2/aggregated/陆行鸟/5729`;
const response = await fetch(url); // ✅ Automatic URL encoding
```

### Shared Types & Constants

**Copy directly** from web app:
- `src/shared/types.ts` → `packages/core/src/types/index.ts`
- `src/shared/constants.ts` → `packages/core/src/constants/index.ts`
- `src/data/json/colors_xiv.json` → `packages/core/src/data/colors_xiv.json`

---

## Technology Stack

### Core Dependencies

```json
{
  "dependencies": {
    // Discord Integration
    "discord.js": "^14.14.1",

    // Image Processing & Generation
    "sharp": "^0.33.0",           // Image uploads (color sampling)
    "canvas": "^2.11.2",          // Chart/wheel rendering

    // HTTP & API
    "node-fetch": "^3.3.2",       // Universalis API calls
    "p-limit": "^5.0.0",          // Rate limiting for API requests

    // Caching & Storage
    "ioredis": "^5.3.2",          // Redis client
    "node-cache": "^5.1.2",       // In-memory fallback cache

    // Database (User Preferences)
    "@prisma/client": "^5.7.0",   // ORM for PostgreSQL

    // TypeScript & Utilities
    "dotenv": "^16.3.1",          // Environment variables
    "zod": "^3.22.4"              // Schema validation
  },
  "devDependencies": {
    "@types/node": "^20.10.5",
    "@types/sharp": "^0.32.0",
    "typescript": "^5.3.3",
    "vitest": "^1.0.4",
    "prisma": "^5.7.0"
  }
}
```

### Technology Choices

| Component | Technology | Reason |
|-----------|-----------|--------|
| **Bot Framework** | discord.js v14 | Most mature, best TypeScript support |
| **Image Sampling** | Sharp | Fast, reliable, supports all formats |
| **Image Rendering** | node-canvas | Native Canvas API, familiar to web devs |
| **API Client** | node-fetch | Drop-in replacement for browser fetch() |
| **Caching** | Redis (ioredis) | Persistent, fast, shared across instances |
| **Database** | PostgreSQL + Prisma | Type-safe ORM, good for user prefs |
| **Validation** | Zod | Runtime type checking for commands |

---

## Data Flow Architecture

### Command Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Discord User Input                           │
│         /harmony base_color:#FF0000 type:triadic               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Discord.js Command Handler                         │
│  - Parse command parameters                                     │
│  - Validate input (Zod schema)                                  │
│  - Extract color, harmony type, options                         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Core Services Layer                            │
│  ┌───────────────────────────────────────────────────┐          │
│  │  DyeService.findTriadicDyes(baseColor)            │          │
│  │    ├─> ColorService.hexToHsv(baseColor)           │          │
│  │    ├─> Find closest dye in database                │          │
│  │    ├─> Calculate +120°, +240° hue targets         │          │
│  │    └─> Find matching dyes for each target         │          │
│  └───────────────────────────────────────────────────┘          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│               Rendering Layer (if needed)                       │
│  ┌───────────────────────────────────────────────────┐          │
│  │  ColorWheelRenderer.generate(baseDye, harmonyDyes)│          │
│  │    ├─> Create 400x400 canvas                      │          │
│  │    ├─> Draw 60 color segments                     │          │
│  │    ├─> Mark harmony angles                        │          │
│  │    └─> Export as PNG buffer                       │          │
│  └───────────────────────────────────────────────────┘          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Optional: Price Data Enrichment                    │
│  ┌───────────────────────────────────────────────────┐          │
│  │  APIService.getPriceData(dye.itemID, 'Aether')    │          │
│  │    ├─> Check Redis cache                          │          │
│  │    ├─> If miss: Fetch from Universalis API        │          │
│  │    └─> Cache result for 5 minutes                 │          │
│  └───────────────────────────────────────────────────┘          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Discord Embed Builder                          │
│  - Format dye names, colors, prices                             │
│  - Add color field indicators (████)                            │
│  - Attach rendered image (if generated)                         │
│  - Set embed color to base dye's hex                            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Discord Response                               │
│            Embed + Optional Image Attachment                    │
└─────────────────────────────────────────────────────────────────┘
```

### Image Upload Flow (Color Matcher)

```
┌─────────────────────────────────────────────────────────────────┐
│              User uploads image to Discord                      │
│         /match_image [attachment: screenshot.png]              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Download Image from Discord CDN                    │
│  - Get attachment URL from interaction                          │
│  - Fetch image buffer using node-fetch                          │
│  - Validate file size (< 8 MB) & format (PNG/JPG/WEBP)         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│           Extract Color Using Sharp                             │
│  ┌───────────────────────────────────────────────────┐          │
│  │  sharp(buffer)                                     │          │
│  │    .extract({ left: x, top: y, width: 5, height: 5 })        │
│  │    .raw()                                          │          │
│  │    .toBuffer()                                     │          │
│  │                                                    │          │
│  │  // Average RGB values                            │          │
│  │  avgR = sum(red) / pixelCount                     │          │
│  │  avgG = sum(green) / pixelCount                   │          │
│  │  avgB = sum(blue) / pixelCount                    │          │
│  └───────────────────────────────────────────────────┘          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│               Find Matching Dye                                 │
│  DyeService.findClosestDye({ r: avgR, g: avgG, b: avgB })      │
│    ├─> Calculate Euclidean distance to all dyes                │
│    └─> Return dye with minimum distance                        │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Discord Response                               │
│  - Show extracted color swatch                                  │
│  - Display matched dye                                          │
│  - Show color distance metric                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Caching Layer

### Multi-Tier Caching Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                     Caching Layers                           │
├──────────────────────────────────────────────────────────────┤
│  Layer 1: In-Memory Cache (node-cache)                       │
│    - Hot data: Dye database (loaded at startup)             │
│    - TTL: Infinite (static data)                            │
│    - Size: ~125 dyes × 500 bytes = 62.5 KB                  │
│                                                              │
│  Layer 2: Redis Cache (ioredis)                             │
│    - Market board prices (Universalis API)                  │
│    - TTL: 5 minutes                                          │
│    - Key format: "price:{itemID}:{dataCenter}"              │
│    - Eviction: LRU when maxmemory reached                   │
│                                                              │
│  Layer 3: PostgreSQL (Prisma)                               │
│    - User preferences (favorite dyes, default DC)           │
│    - Saved palettes                                          │
│    - Usage analytics                                         │
└──────────────────────────────────────────────────────────────┘
```

### Cache Implementation

**In-Memory Dye Cache**:
```typescript
import NodeCache from 'node-cache';

export class DyeCacheService {
  private cache = new NodeCache({ stdTTL: 0 }); // No TTL for static data

  constructor(private dyeService: DyeService) {
    this.warmCache();
  }

  private warmCache() {
    const allDyes = this.dyeService.getAllDyes();
    this.cache.set('all_dyes', allDyes);

    // Index by category for faster filtering
    const byCategory = new Map<string, Dye[]>();
    allDyes.forEach(dye => {
      if (!byCategory.has(dye.category)) {
        byCategory.set(dye.category, []);
      }
      byCategory.get(dye.category)!.push(dye);
    });
    this.cache.set('dyes_by_category', byCategory);
  }

  getAllDyes(): Dye[] {
    return this.cache.get('all_dyes') || [];
  }
}
```

**Redis Price Cache**:
```typescript
import Redis from 'ioredis';

export class PriceCacheService {
  private redis: Redis;
  private static PRICE_TTL = 300; // 5 minutes

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
  }

  async get(itemID: number, dataCenter: string): Promise<PriceData | null> {
    const key = `price:${itemID}:${dataCenter}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(itemID: number, dataCenter: string, data: PriceData): Promise<void> {
    const key = `price:${itemID}:${dataCenter}`;
    await this.redis.setex(key, PriceCacheService.PRICE_TTL, JSON.stringify(data));
  }
}
```

---

## Image Rendering System

### Color Wheel Renderer

**Purpose**: Generate 400x400px color wheel with harmony indicators

```typescript
import { createCanvas } from 'canvas';

export class ColorWheelRenderer {
  private static CANVAS_SIZE = 400;
  private static WHEEL_RADIUS = 180;
  private static INNER_RADIUS = 80;

  static generate(baseDye: Dye, harmonyDyes: Dye[]): Buffer {
    const canvas = createCanvas(this.CANVAS_SIZE, this.CANVAS_SIZE);
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, this.CANVAS_SIZE, this.CANVAS_SIZE);

    // Draw color wheel (60 segments)
    const centerX = this.CANVAS_SIZE / 2;
    const centerY = this.CANVAS_SIZE / 2;

    for (let i = 0; i < 60; i++) {
      const startAngle = (i / 60) * 2 * Math.PI - Math.PI / 2;
      const endAngle = ((i + 1) / 60) * 2 * Math.PI - Math.PI / 2;
      const hue = (i / 60) * 360;

      // Draw outer arc (full saturation)
      ctx.beginPath();
      ctx.arc(centerX, centerY, this.WHEEL_RADIUS, startAngle, endAngle);
      ctx.arc(centerX, centerY, this.INNER_RADIUS, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fill();
    }

    // Draw harmony indicators
    const allDyes = [baseDye, ...harmonyDyes];
    allDyes.forEach((dye, index) => {
      const angle = (dye.hsv.h / 360) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + Math.cos(angle) * this.WHEEL_RADIUS;
      const y = centerY + Math.sin(angle) * this.WHEEL_RADIUS;

      // Draw indicator dot
      ctx.beginPath();
      ctx.arc(x, y, index === 0 ? 12 : 8, 0, 2 * Math.PI);
      ctx.fillStyle = index === 0 ? '#ffffff' : '#000000';
      ctx.fill();
      ctx.strokeStyle = index === 0 ? '#000000' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw line from center
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    return canvas.toBuffer('image/png');
  }
}
```

### Gradient Renderer (Dye Mixer)

```typescript
export class GradientRenderer {
  static generate(startDye: Dye, endDye: Dye, steps: Dye[]): Buffer {
    const canvas = createCanvas(600, 100);
    const ctx = canvas.getContext('2d');

    const segmentWidth = 600 / steps.length;

    steps.forEach((dye, index) => {
      ctx.fillStyle = dye.hex;
      ctx.fillRect(index * segmentWidth, 0, segmentWidth, 100);
    });

    return canvas.toBuffer('image/png');
  }
}
```

### Swatch Grid Renderer (Accessibility)

```typescript
export class SwatchGridRenderer {
  static generate(dyes: Dye[], visionTypes: VisionType[]): Buffer {
    const swatchSize = 80;
    const cols = dyes.length;
    const rows = visionTypes.length;
    const canvas = createCanvas(cols * swatchSize, rows * swatchSize);
    const ctx = canvas.getContext('2d');

    visionTypes.forEach((visionType, row) => {
      dyes.forEach((dye, col) => {
        const simulated = ColorService.simulateColorblindness(dye.rgb, visionType);
        const hex = ColorService.rgbToHex(simulated);

        ctx.fillStyle = hex;
        ctx.fillRect(col * swatchSize, row * swatchSize, swatchSize, swatchSize);
      });
    });

    return canvas.toBuffer('image/png');
  }
}
```

---

## Error Handling

### Error Types & Responses

```typescript
export enum ErrorCode {
  INVALID_COLOR = 'INVALID_COLOR',
  DYE_NOT_FOUND = 'DYE_NOT_FOUND',
  API_TIMEOUT = 'API_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  RENDERING_FAILED = 'RENDERING_FAILED'
}

export class BotError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public userMessage: string
  ) {
    super(message);
  }
}

// Usage in command handler
try {
  const dyes = dyeService.findTriadicDyes(baseColor);
} catch (error) {
  if (error instanceof BotError) {
    return interaction.reply({
      content: `❌ ${error.userMessage}`,
      ephemeral: true
    });
  }
  // Log unexpected errors, show generic message
  logger.error('Unexpected error', error);
  return interaction.reply({
    content: '❌ An unexpected error occurred. Please try again.',
    ephemeral: true
  });
}
```

### Graceful Degradation

```typescript
// Price fetching with fallback
async function enrichWithPrices(dyes: Dye[], dataCenter?: string) {
  if (!dataCenter) return dyes; // Skip if no DC specified

  try {
    const prices = await apiService.getPrices(dyes.map(d => d.itemID), dataCenter);
    return dyes.map(dye => ({
      ...dye,
      price: prices.get(dye.itemID) || dye.price // Fallback to static price
    }));
  } catch (error) {
    logger.warn('Price fetch failed, using static prices', error);
    return dyes; // Continue without live prices
  }
}
```

---

## Performance Considerations

### Response Time Targets

| Command | Target | Notes |
|---------|--------|-------|
| `/harmony` | < 500ms | No API calls needed |
| `/match` | < 300ms | Pure computation |
| `/match_image` | < 2s | Image download + processing |
| `/accessibility` | < 1s | Includes image rendering |
| `/comparison` | < 800ms | With pricing: < 2s |
| `/mixer` | < 600ms | Interpolation + matching |

### Optimization Strategies

1. **Dye Database Indexing**
   ```typescript
   // Pre-calculate color distances at startup
   const dyeTree = new KDTree(dyes, (a, b) => colorDistance(a.rgb, b.rgb));
   // O(log n) lookup instead of O(n)
   ```

2. **Image Processing**
   - Limit upload size: 8 MB max
   - Downscale large images before processing
   - Sample 5×5 pixel average (not single pixel)

3. **Concurrent Operations**
   ```typescript
   // Fetch prices for all dyes in parallel
   const pricePromises = dyes.map(d => apiService.getPrice(d.itemID, dc));
   const prices = await Promise.allSettled(pricePromises);
   ```

4. **Render Caching**
   - Cache generated color wheels (keyed by harmony type + base hue)
   - TTL: 1 hour
   - Saves ~200ms per render

---

## Security

### Input Validation

```typescript
import { z } from 'zod';

const harmonyCommandSchema = z.object({
  base_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  type: z.enum(['complementary', 'triadic', 'analogous', ...]),
  data_center: z.enum(['Aether', 'Crystal', ...]).optional(),
  show_prices: z.boolean().optional()
});

// In command handler
const validated = harmonyCommandSchema.parse(interaction.options.data);
```

### Rate Limiting

```typescript
import { RateLimiter } from 'discord.js-rate-limiter';

const limiter = new RateLimiter(5, 60000); // 5 commands per minute per user

// In command handler
if (limiter.take(interaction.user.id)) {
  return interaction.reply({
    content: '⏱️ You are being rate limited. Please try again in a moment.',
    ephemeral: true
  });
}
```

### Environment Variables

```typescript
// .env
DISCORD_TOKEN=your_bot_token_here
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/xivdyetools
MAX_IMAGE_SIZE_MB=8
NODE_ENV=production

// Universalis API rate limits (no auth required)
// Rate limit: 25 req/s (50 req/s burst)
// Max simultaneous connections: 8 per IP
```

---

## Next Steps

1. **Review**: [COMMANDS.md](./COMMANDS.md) for detailed command specifications
2. **Review**: [RENDERING.md](./RENDERING.md) for image generation algorithms
3. **Review**: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for service extraction steps
4. **Review**: [DEPLOYMENT.md](./DEPLOYMENT.md) for hosting & infrastructure setup

---

**Last Updated**: November 22, 2025
**Author**: XIV Dye Tools Team
**Version**: 1.0.0
