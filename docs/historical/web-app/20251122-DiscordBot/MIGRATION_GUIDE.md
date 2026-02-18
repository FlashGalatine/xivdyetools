# Service Migration Guide

**XIV Dye Tools Discord Bot** - Extracting Services from Web App

**Version**: 1.0.0
**Last Updated**: November 22, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Project Setup](#project-setup)
4. [Migrating ColorService](#migrating-colorservice)
5. [Migrating DyeService](#migrating-dyeservice)
6. [Migrating APIService](#migrating-apiservice)
7. [Migrating Types & Constants](#migrating-types--constants)
8. [Migrating Dye Database](#migrating-dye-database)
9. [Testing Parity](#testing-parity)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide walks through extracting the business logic from the XIV Dye Tools web app (v2.0.0) and adapting it for use in a Discord bot. The goal is to **reuse as much code as possible** while making minimal changes for Node.js compatibility.

### Migration Summary

| Component | Reusability | Changes Required | Effort |
|-----------|-------------|------------------|--------|
| ColorService | 100% | None (copy as-is) | Low ✅ |
| DyeService | 95% | Remove singleton, change JSON import | Low ✅ |
| APIService | 60% | Replace fetch & localStorage | Medium ⚠️ |
| Types | 100% | None (copy as-is) | Low ✅ |
| Constants | 100% | None (copy as-is) | Low ✅ |
| Dye Database | 100% | None (copy as-is) | Low ✅ |

---

## Prerequisites

### Required Tools

- **Node.js** 18+ (for native fetch support)
- **npm** or **pnpm** (package manager)
- **Git** (for version control)
- **TypeScript** 5.3+ (for strict mode)

### Required Knowledge

- TypeScript basics
- Node.js module system (ESM/CommonJS)
- Discord.js fundamentals
- Git workflow

---

## Project Setup

### Step 1: Create Monorepo Structure

```bash
# Create project directory
mkdir xivdyetools-discord-bot
cd xivdyetools-discord-bot

# Initialize npm workspace
npm init -y

# Create packages
mkdir -p packages/core/src
mkdir -p packages/discord-bot/src
```

### Step 2: Configure Workspace

**Root `package.json`:**
```json
{
  "name": "xivdyetools-discord-bot",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "dev": "npm run dev -w discord-bot"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vitest": "^1.0.4"
  }
}
```

### Step 3: Initialize Core Package

**`packages/core/package.json`:**
```json
{
  "name": "@xivdyetools/core",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "devDependencies": {
    "@types/node": "^20.10.5",
    "typescript": "^5.3.3"
  }
}
```

**`packages/core/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Migrating ColorService

### Step 1: Copy Service File

**From Web App:**
```
src/services/color-service.ts
```

**To Discord Bot:**
```
packages/core/src/services/color-service.ts
```

### Step 2: No Changes Required! ✅

ColorService is **100% browser-agnostic** and can be copied as-is.

```bash
# From XIV Dye Tools web app directory
cp src/services/color-service.ts ../xivdyetools-discord-bot/packages/core/src/services/
```

### Step 3: Verify Import Paths

Ensure all imports use relative paths:

```typescript
// color-service.ts
import type { RGB, HSV, VisionType } from '../types';
import { COLORBLIND_MATRICES } from '../constants';
```

### Step 4: Export from Index

**`packages/core/src/services/index.ts`:**
```typescript
export { ColorService } from './color-service';
export { DyeService } from './dye-service';
export { APIService } from './api-service';
```

### Testing ColorService

```typescript
// packages/core/src/services/__tests__/color-service.test.ts
import { describe, it, expect } from 'vitest';
import { ColorService } from '../color-service';

describe('ColorService', () => {
  describe('hexToRgb', () => {
    it('should convert hex to RGB', () => {
      const result = ColorService.hexToRgb('#FF0000');
      expect(result).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should handle lowercase hex', () => {
      const result = ColorService.hexToRgb('#ff0000');
      expect(result).toEqual({ r: 255, g: 0, b: 0 });
    });
  });

  describe('simulateColorblindness', () => {
    it('should simulate deuteranopia', () => {
      const red = { r: 255, g: 0, b: 0 };
      const simulated = ColorService.simulateColorblindness(red, 'deuteranopia');

      // Result should be different from input
      expect(simulated).not.toEqual(red);

      // Result should be valid RGB
      expect(simulated.r).toBeGreaterThanOrEqual(0);
      expect(simulated.r).toBeLessThanOrEqual(255);
    });
  });
});
```

---

## Migrating DyeService

### Step 1: Copy Service File

```bash
cp src/services/dye-service.ts ../xivdyetools-discord-bot/packages/core/src/services/
```

### Step 2: Modify for Node.js

**Before (Web App):**
```typescript
// dye-service.ts (web app)
import dyesJSON from '../../assets/json/colors_xiv.json';
import { ColorService } from './color-service';
import type { Dye, RGB, HSV } from '../types';

export class DyeService {
  private static instance: DyeService;
  private dyes: Dye[] = dyesJSON as Dye[];

  private constructor() {
    this.initialize();
  }

  static getInstance(): DyeService {
    if (!DyeService.instance) {
      DyeService.instance = new DyeService();
    }
    return DyeService.instance;
  }

  // ... methods
}
```

**After (Discord Bot):**
```typescript
// dye-service.ts (Discord bot)
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ColorService } from './color-service.js';
import type { Dye, RGB, HSV } from '../types/index.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DyeService {
  private dyes: Dye[];

  constructor(dyesData?: Dye[]) {
    if (dyesData) {
      this.dyes = dyesData;
    } else {
      // Load from JSON file
      const jsonPath = join(__dirname, '../data/colors_xiv.json');
      const jsonContent = readFileSync(jsonPath, 'utf-8');
      this.dyes = JSON.parse(jsonContent) as Dye[];
    }
    this.initialize();
  }

  private initialize(): void {
    // Keep existing initialization logic
    this.dyes.forEach(dye => {
      if (!dye.hsv) {
        dye.hsv = ColorService.rgbToHsv(dye.rgb);
      }
    });
  }

  // All other methods remain unchanged
  getAllDyes(): Dye[] { ... }
  findComplementaryPair(baseColor: string): Dye[] { ... }
  findTriadicDyes(baseColor: string): Dye[] { ... }
  // ... etc
}
```

### Step 3: Key Changes Explained

| Change | Reason | Impact |
|--------|--------|--------|
| Remove singleton pattern | Easier testing & DI | **Low** - Usage changes slightly |
| `import dyesJSON` → `readFileSync` | Node.js file system API | **Low** - Works in Node.js |
| Add constructor parameter | Allow injecting test data | **Low** - More flexible |
| Add `.js` extensions to imports | Required for ESM in Node.js | **Low** - TypeScript handles it |

### Step 4: Usage Examples

**Before (Web App):**
```typescript
const dyeService = DyeService.getInstance();
const dyes = dyeService.getAllDyes();
```

**After (Discord Bot):**
```typescript
// Option 1: Auto-load from JSON
const dyeService = new DyeService();
const dyes = dyeService.getAllDyes();

// Option 2: Inject data (for testing)
const mockDyes: Dye[] = [/* test data */];
const dyeService = new DyeService(mockDyes);
```

### Testing DyeService

```typescript
// packages/core/src/services/__tests__/dye-service.test.ts
import { describe, it, expect } from 'vitest';
import { DyeService } from '../dye-service';

describe('DyeService', () => {
  let dyeService: DyeService;

  beforeEach(() => {
    dyeService = new DyeService();
  });

  it('should load dyes from JSON', () => {
    const dyes = dyeService.getAllDyes();
    expect(dyes.length).toBeGreaterThan(0);
  });

  it('should find complementary pair', () => {
    const result = dyeService.findComplementaryPair('#FF0000');
    expect(result.length).toBe(2);
    expect(result[0].hsv.h).toBeCloseTo(0, 15); // Red (~0°)
    expect(result[1].hsv.h).toBeCloseTo(180, 15); // Cyan (~180°)
  });

  it('should find triadic dyes', () => {
    const result = dyeService.findTriadicDyes('#FF0000');
    expect(result.length).toBe(3);

    // Check 120° spacing
    const hues = result.map(d => d.hsv.h).sort((a, b) => a - b);
    expect(hues[1] - hues[0]).toBeCloseTo(120, 20);
    expect(hues[2] - hues[1]).toBeCloseTo(120, 20);
  });
});
```

---

## Migrating APIService

### Step 1: Copy & Refactor

**Before (Web App):**
```typescript
// api-service.ts (web app)
import { StorageService } from './storage-service';

export class APIService {
  private static cache = new Map<string, any>();

  static async getPriceData(itemID: number, dataCenterID?: string) {
    const cacheKey = `price_${itemID}_${dataCenterID}`;

    // Check localStorage
    const cached = StorageService.getItem(cacheKey, null);
    if (cached && Date.now() - cached.timestamp < 300000) {
      return cached.data;
    }

    // Fetch from API
    const url = `https://universalis.app/api/v2/aggregated/${dataCenterID}/${itemID}`;
    const response = await fetch(url);
    const data = await response.json();

    // Cache result
    StorageService.setItem(cacheKey, { data, timestamp: Date.now() });

    return data;
  }
}
```

**After (Discord Bot):**
```typescript
// api-service.ts (Discord bot)
import fetch from 'node-fetch';
import Redis from 'ioredis';

export class APIService {
  private redis: Redis;
  private static readonly CACHE_TTL = 300; // 5 minutes

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
  }

  async getPriceData(itemID: number, dataCenterID?: string) {
    const cacheKey = `price:${itemID}:${dataCenterID || 'global'}`;

    // Check Redis cache
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Cache read failed:', error);
    }

    // Fetch from Universalis API
    const dc = dataCenterID || 'North-America';
    const url = `https://universalis.app/api/v2/aggregated/${dc}/${itemID}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      // Cache in Redis
      await this.redis.setex(cacheKey, APIService.CACHE_TTL, JSON.stringify(data));

      return data;
    } catch (error) {
      console.error('Price fetch failed:', error);
      return null; // Graceful degradation
    }
  }

  /**
   * Fetch prices for multiple items in parallel
   */
  async getBulkPrices(itemIDs: number[], dataCenterID?: string) {
    const promises = itemIDs.map(id => this.getPriceData(id, dataCenterID));
    const results = await Promise.allSettled(promises);

    return results.map((result, index) => ({
      itemID: itemIDs[index],
      data: result.status === 'fulfilled' ? result.value : null
    }));
  }

  /**
   * Clean up Redis connection
   */
  async disconnect() {
    await this.redis.quit();
  }
}
```

### Step 2: Install Dependencies

```bash
cd packages/core
npm install node-fetch ioredis
npm install -D @types/node-fetch @types/ioredis
```

### Step 3: Environment Configuration

**`.env`:**
```bash
REDIS_URL=redis://localhost:6379
```

**Usage:**
```typescript
import { APIService } from '@xivdyetools/core';
import dotenv from 'dotenv';

dotenv.config();

const apiService = new APIService(process.env.REDIS_URL!);

// Use in commands
const priceData = await apiService.getPriceData(5729, 'Aether');

// Clean up on shutdown
process.on('SIGTERM', async () => {
  await apiService.disconnect();
  process.exit(0);
});
```

---

## Migrating Types & Constants

### Step 1: Copy Type Definitions

```bash
cp src/shared/types.ts ../xivdyetools-discord-bot/packages/core/src/types/index.ts
```

**No changes needed** - Types are environment-agnostic.

**`packages/core/src/types/index.ts`:**
```typescript
export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSV {
  h: number;
  s: number;
  v: number;
}

export interface Dye {
  itemID: number;
  category: string;
  name: string;
  hex: string;
  acquisition: string;
  price: number;
  currency: string;
  rgb: RGB;
  hsv: HSV;
}

export type VisionType = 'normal' | 'deuteranopia' | 'protanopia' | 'tritanopia' | 'achromatopsia';

export type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split_complementary'
  | 'tetradic'
  | 'square'
  | 'monochromatic'
  | 'compound'
  | 'shades';
```

### Step 2: Copy Constants

```bash
cp src/shared/constants.ts ../xivdyetools-discord-bot/packages/core/src/constants/index.ts
```

**No changes needed** - Constants are pure data.

**`packages/core/src/constants/index.ts`:**
```typescript
// Colorblind simulation matrices (Brettel 1997)
export const COLORBLIND_MATRICES = {
  deuteranopia: [
    [0.625, 0.375, 0.0],
    [0.7, 0.3, 0.0],
    [0.0, 0.3, 0.7]
  ],
  protanopia: [
    [0.567, 0.433, 0.0],
    [0.558, 0.442, 0.0],
    [0.0, 0.242, 0.758]
  ],
  tritanopia: [
    [0.95, 0.05, 0.0],
    [0.0, 0.433, 0.567],
    [0.0, 0.475, 0.525]
  ],
  achromatopsia: [
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114]
  ]
};

export const DYE_CATEGORIES = [
  'Neutral',
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Blue',
  'Purple',
  'Brown',
  'Special',
  'Facewear'
] as const;
```

---

## Migrating Dye Database

### Step 1: Copy JSON File

```bash
mkdir -p ../xivdyetools-discord-bot/packages/core/src/data
cp src/assets/json/colors_xiv.json ../xivdyetools-discord-bot/packages/core/src/data/
```

### Step 2: Verify JSON Structure

Ensure the JSON file is valid and includes all required fields:

```json
[
  {
    "itemID": 5729,
    "category": "Neutral",
    "name": "Snow White",
    "hex": "#e4dfd0",
    "acquisition": "Dye Vendor",
    "price": 216,
    "currency": "Gil",
    "rgb": { "r": 228, "g": 223, "b": 208 },
    "hsv": { "h": 45, "s": 8.77, "v": 89.41 }
  }
]
```

### Step 3: TypeScript Configuration

Ensure `tsconfig.json` allows JSON imports:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

---

## Testing Parity

### Goal: Ensure Discord Bot Produces Identical Results to Web App

### Step 1: Create Parity Test Suite

**`packages/core/src/__tests__/parity.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { ColorService, DyeService } from '../services';

describe('Parity Tests', () => {
  const dyeService = new DyeService();

  describe('Color Matching', () => {
    it('should find same closest dye as web app', () => {
      const testCases = [
        { input: '#FF0000', expected: 'Dalamud Red' },
        { input: '#0000FF', expected: 'Royal Blue' },
        { input: '#00FF00', expected: 'Lime Green' }
      ];

      testCases.forEach(({ input, expected }) => {
        const rgb = ColorService.hexToRgb(input);
        const result = dyeService.findClosestDye(rgb);
        expect(result.name).toBe(expected);
      });
    });
  });

  describe('Harmony Generation', () => {
    it('should find same triadic dyes as web app', () => {
      const result = dyeService.findTriadicDyes('#FF0000');
      const names = result.map(d => d.name);

      // These should match web app results
      expect(names).toContain('Dalamud Red');
      expect(result.length).toBe(3);
    });
  });

  describe('Colorblind Simulation', () => {
    it('should produce same deuteranopia simulation as web app', () => {
      const red = { r: 255, g: 0, b: 0 };
      const simulated = ColorService.simulateColorblindness(red, 'deuteranopia');

      // Expected values from web app
      expect(simulated.r).toBeCloseTo(159, 1);
      expect(simulated.g).toBeCloseTo(95, 1);
      expect(simulated.b).toBeCloseTo(0, 1);
    });
  });
});
```

### Step 2: Run Tests

```bash
npm run test -w core
```

Expected output:
```
✓ packages/core/src/__tests__/parity.test.ts (15)
  ✓ Parity Tests (15)
    ✓ Color Matching (3)
    ✓ Harmony Generation (1)
    ✓ Colorblind Simulation (1)

Test Files  1 passed (1)
     Tests  15 passed (15)
  Start at  12:00:00
  Duration  1.23s
```

---

## Troubleshooting

### Issue: `Cannot find module 'colors_xiv.json'`

**Cause**: JSON file not in correct location

**Solution**:
```bash
# Verify file exists
ls packages/core/src/data/colors_xiv.json

# Check tsconfig.json
cat packages/core/tsconfig.json | grep resolveJsonModule
```

### Issue: `TypeError: fetch is not defined`

**Cause**: Using Node.js < 18 (no native fetch)

**Solution**:
```bash
# Check Node version
node --version

# If < 18, install node-fetch
npm install node-fetch

# Import in api-service.ts
import fetch from 'node-fetch';
```

### Issue: Tests Fail with Different Results

**Cause**: Floating-point precision differences

**Solution**:
```typescript
// Use toBeCloseTo for float comparisons
expect(result.hsv.h).toBeCloseTo(180, 1); // Within 1 decimal place
```

### Issue: Redis Connection Errors

**Cause**: Redis not running

**Solution**:
```bash
# Start Redis (Docker)
docker run -d -p 6379:6379 redis:7-alpine

# Or install locally
brew install redis  # macOS
sudo apt install redis  # Ubuntu
```

---

## Next Steps

1. **Review**: [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
2. **Review**: [COMMANDS.md](./COMMANDS.md) for Discord command specs
3. **Review**: [DEPLOYMENT.md](./DEPLOYMENT.md) for hosting setup
4. **Implement**: Discord bot commands using migrated services

---

## Checklist

- [ ] Project structure created
- [ ] ColorService copied (no changes)
- [ ] DyeService migrated (singleton removed)
- [ ] APIService refactored (Redis + node-fetch)
- [ ] Types & constants copied
- [ ] Dye database JSON copied
- [ ] All tests passing
- [ ] Parity tests confirm identical results to web app

---

**Last Updated**: November 22, 2025
**Author**: XIV Dye Tools Team
**Version**: 1.0.0
