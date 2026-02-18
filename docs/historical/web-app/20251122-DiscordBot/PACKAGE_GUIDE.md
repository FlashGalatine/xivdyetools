# Core Package Guide

**@xivdyetools/core** - Creating and Publishing the Shared Color Science Library

**Version**: 1.0.0
**Last Updated**: November 22, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Repository Setup](#repository-setup)
3. [Extracting Services](#extracting-services)
4. [Making Services Pure](#making-services-pure)
5. [Creating Public API](#creating-public-api)
6. [Building & Testing](#building--testing)
7. [Publishing](#publishing)
8. [Versioning Strategy](#versioning-strategy)
9. [Consuming the Package](#consuming-the-package)
10. [Future Projects](#future-projects)

---

## Overview

The `@xivdyetools/core` package is a standalone npm package containing all the color science algorithms, dye database, and business logic from the XIV Dye Tools web application. This architecture enables:

- ✅ **Multiple Projects** - Web app, Discord bot, Dalamud plugins, APIs, etc.
- ✅ **Single Source of Truth** - Update algorithms in one place
- ✅ **Community Sharing** - Others can use your color algorithms
- ✅ **Clean Separation** - Pure business logic, no framework dependencies

### Architecture

```
📦 @xivdyetools/core (npm package)
   ↓ consumed by
├── xivdyetools (web app)
├── xivdyetools-discord-bot (Discord bot)
├── xivdyetools-dalamud (future: game plugin)
└── xivdyetools-api (future: REST API)
```

---

## Repository Setup

### Step 1: Create New Repository

```bash
# Create new directory
mkdir xivdyetools-core
cd xivdyetools-core

# Initialize git
git init
git branch -M main

# Create GitHub repo (via GitHub CLI or web UI)
gh repo create xivdyetools-core --public --source=. --remote=origin

# Or manually:
# 1. Go to github.com/new
# 2. Name: xivdyetools-core
# 3. Public
# 4. Don't initialize with README
# 5. git remote add origin https://github.com/FlashGalatine/xivdyetools-core.git
```

### Step 2: Initialize npm Package

```bash
npm init --scope=@xivdyetools
```

**`package.json`:**
```json
{
  "name": "@xivdyetools/core",
  "version": "1.0.0",
  "description": "Core color algorithms and dye database for XIV Dye Tools",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": [
    "ffxiv",
    "final-fantasy-xiv",
    "color",
    "dye",
    "harmony",
    "accessibility",
    "colorblind"
  ],
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/FlashGalatine/xivdyetools-core.git"
  },
  "bugs": {
    "url": "https://github.com/FlashGalatine/xivdyetools-core/issues"
  },
  "homepage": "https://github.com/FlashGalatine/xivdyetools-core#readme",
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Step 3: Configure TypeScript

**`tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2020"],

    "outDir": "./dist",
    "rootDir": "./src",

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,

    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Step 4: Create Directory Structure

```bash
mkdir -p src/{services,types,constants,data,utils}
mkdir -p tests/{services,utils}
```

**Final structure:**
```
xivdyetools-core/
├── src/
│   ├── services/
│   │   ├── ColorService.ts
│   │   ├── DyeService.ts
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts
│   ├── constants/
│   │   └── index.ts
│   ├── data/
│   │   └── colors_xiv.json
│   ├── utils/
│   │   └── index.ts
│   └── index.ts
├── tests/
│   ├── services/
│   │   ├── ColorService.test.ts
│   │   └── DyeService.test.ts
│   └── utils/
├── package.json
├── tsconfig.json
├── .gitignore
├── .npmignore
├── LICENSE
└── README.md
```

---

## Extracting Services

### Copy Files from Web App

```bash
# From your web app repository
cd /path/to/xivdyetools

# Copy services (these are pure TypeScript, no changes needed for ColorService)
cp src/services/color-service.ts ../xivdyetools-core/src/services/ColorService.ts

# Copy DyeService (will need modifications)
cp src/services/dye-service.ts ../xivdyetools-core/src/services/DyeService.ts

# Copy shared types
cp src/shared/types.ts ../xivdyetools-core/src/types/index.ts

# Copy constants
cp src/shared/constants.ts ../xivdyetools-core/src/constants/index.ts

# Copy dye database
cp src/data/json/colors_xiv.json ../xivdyetools-core/src/data/
```

---

## Making Services Pure

The key to making services reusable is removing environment-specific dependencies (singletons, DOM, localStorage, etc.).

### ColorService (100% Reusable)

**No changes needed!** ColorService is already pure:

```typescript
// src/services/ColorService.ts
export class ColorService {
  // Static methods only - no state, no dependencies
  static rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    // ... pure algorithm
  }

  static generateHarmony(baseColor: string, harmonyType: string): string[] {
    // ... pure algorithm
  }

  static simulateColorblindness(color: string, visionType: string): string {
    // ... pure algorithm
  }
}
```

✅ **Already environment-agnostic** - Works in browsers, Node.js, Deno, Bun, etc.

### DyeService (Minor Changes)

**Before (Web App Version):**
```typescript
// ❌ Singleton pattern, browser-specific
import dyesJSON from '../../assets/json/colors_xiv.json';

class DyeService {
  private static instance: DyeService;
  private dyes: Dye[];

  private constructor() {
    this.dyes = dyesJSON as Dye[];
  }

  static getInstance(): DyeService {
    if (!this.instance) {
      this.instance = new DyeService();
    }
    return this.instance;
  }

  findClosestDyes(color: string, count: number = 5): Dye[] {
    // ... algorithm
  }
}

export default DyeService.getInstance();
```

**After (Core Package Version):**
```typescript
// ✅ Stateless, environment-agnostic
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Dye } from '../types';

export class DyeService {
  private dyes: Dye[];

  constructor(dyesData?: Dye[]) {
    // Allow injecting data (browser) or load from file (Node.js)
    this.dyes = dyesData || this.loadDyes();
  }

  private loadDyes(): Dye[] {
    // Node.js environment
    if (typeof window === 'undefined') {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const jsonPath = join(__dirname, '../data/colors_xiv.json');
      return JSON.parse(readFileSync(jsonPath, 'utf-8'));
    }

    // Browser environment - must be injected
    throw new Error('Dye data must be provided in browser environments');
  }

  findClosestDyes(color: string, count: number = 5): Dye[] {
    // ... exact same algorithm as web app
  }

  generateHarmony(baseDye: string, harmonyType: string): Dye[] {
    // ... exact same algorithm
  }
}
```

**Key changes:**
1. ✅ Removed singleton pattern → Regular class with constructor
2. ✅ Added data injection for browsers → `new DyeService(dyeDatabase)`
3. ✅ Added file loading for Node.js → Auto-loads from `data/colors_xiv.json`
4. ✅ Kept all algorithms identical → Ensures parity

---

## Creating Public API

### Main Entry Point

**`src/index.ts`:**
```typescript
// Services
export { ColorService } from './services/ColorService';
export { DyeService } from './services/DyeService';

// Types
export type {
  Dye,
  DyeCategory,
  ColorHarmony,
  HSVColor,
  RGBColor,
  LABColor,
  VisionType,
  AccessibilityResult,
  ContrastRatio
} from './types';

// Constants
export {
  COLOR_HARMONIES,
  VISION_TYPES,
  DYE_CATEGORIES,
  COLORBLIND_MATRICES
} from './constants';

// Data (for browser environments)
export { default as dyeDatabase } from './data/colors_xiv.json';

// Version
export const VERSION = '1.0.0';
```

### Service Exports

**`src/services/index.ts`:**
```typescript
export { ColorService } from './ColorService';
export { DyeService } from './DyeService';
```

---

## Building & Testing

### Install Dependencies

```bash
npm install
```

### Build Package

```bash
npm run build
```

**Output:**
```
dist/
├── index.js
├── index.d.ts
├── services/
│   ├── ColorService.js
│   ├── ColorService.d.ts
│   ├── DyeService.js
│   └── DyeService.d.ts
├── types/
│   └── index.d.ts
└── ...
```

### Write Tests

**`tests/services/ColorService.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { ColorService } from '../../src/services/ColorService';

describe('ColorService', () => {
  it('should convert RGB to HSV correctly', () => {
    const result = ColorService.rgbToHsv(255, 0, 0);
    expect(result).toEqual({ h: 0, s: 100, v: 100 });
  });

  it('should generate complementary harmony', () => {
    const result = ColorService.generateHarmony('#3B82F6', 'complementary');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('#3B82F6'); // Base color
  });

  it('should simulate deuteranopia correctly', () => {
    const result = ColorService.simulateColorblindness('#FF0000', 'deuteranopia');
    expect(result).toMatch(/^#[0-9A-F]{6}$/);
  });
});
```

**`tests/services/DyeService.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { DyeService } from '../../src/services/DyeService';
import dyeDatabase from '../../src/data/colors_xiv.json';

describe('DyeService', () => {
  const dyeService = new DyeService(dyeDatabase);

  it('should find closest dyes to a color', () => {
    const result = dyeService.findClosestDyes('#FF6B6B', 5);
    expect(result).toHaveLength(5);
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('hex');
  });

  it('should generate triadic harmony', () => {
    const result = dyeService.generateHarmony('Dalamud Red', 'triadic');
    expect(result).toHaveLength(3);
  });
});
```

### Run Tests

```bash
npm test
```

---

## Publishing

### Option 1: npm Registry (Public)

**Advantages:**
- ✅ Easy installation: `npm install @xivdyetools/core`
- ✅ CDN support (unpkg, jsDelivr)
- ✅ Community discovery
- ✅ Free for public packages

**Steps:**

```bash
# 1. Create npm account
npm adduser

# 2. Login
npm login

# 3. Publish (first time)
npm publish --access public

# 4. Update .gitignore
echo "node_modules/" >> .gitignore
echo "dist/" >> .gitignore

# 5. Create .npmignore (what NOT to publish)
echo "tests/" >> .npmignore
echo "src/" >> .npmignore
echo ".github/" >> .npmignore
echo "tsconfig.json" >> .npmignore
```

### Option 2: GitHub Packages (Private or Public)

**Advantages:**
- ✅ Can be private
- ✅ Integrated with GitHub
- ✅ Free for public repos

**Steps:**

```bash
# 1. Create .npmrc in package root
echo "@xivdyetools:registry=https://npm.pkg.github.com" > .npmrc

# 2. Update package.json
```

```json
{
  "name": "@xivdyetools/core",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

```bash
# 3. Create GitHub token (repo permissions)
# Go to: Settings → Developer settings → Personal access tokens

# 4. Login to GitHub Packages
npm login --registry=https://npm.pkg.github.com
# Username: your-github-username
# Password: your-github-token

# 5. Publish
npm publish
```

---

## Versioning Strategy

Use [Semantic Versioning](https://semver.org):

- **Major (X.0.0)** - Breaking changes (API changes, removed features)
- **Minor (1.X.0)** - New features (new harmonies, new methods)
- **Patch (1.0.X)** - Bug fixes (algorithm corrections, typos)

### Examples

```bash
# Patch release (bug fix)
npm version patch  # 1.0.0 → 1.0.1
npm publish

# Minor release (new feature)
npm version minor  # 1.0.1 → 1.1.0
npm publish

# Major release (breaking change)
npm version major  # 1.1.0 → 2.0.0
npm publish
```

### Version Tags

```bash
# Tag stable releases
git tag v1.0.0
git push origin v1.0.0

# Tag beta releases
npm version 1.1.0-beta.1
npm publish --tag beta
```

---

## Consuming the Package

### In Web App (Browser)

```typescript
// Install
npm install @xivdyetools/core

// Import
import { ColorService, DyeService, dyeDatabase } from '@xivdyetools/core';

// Use in browser (inject dye data)
const dyeService = new DyeService(dyeDatabase);

// Call methods
const matches = dyeService.findClosestDyes('#FF6B6B', 5);
const harmony = ColorService.generateHarmony('#3B82F6', 'complementary');
```

### In Discord Bot (Node.js)

```typescript
// Install
npm install @xivdyetools/core

// Import
import { ColorService, DyeService } from '@xivdyetools/core';

// Use in Node.js (auto-loads data)
const dyeService = new DyeService();

// Call methods
const matches = dyeService.findClosestDyes('#FF6B6B', 5);
```

### In Dalamud Plugin (C# via JavaScript Interop)

```csharp
// Install ClearScript (V8 JavaScript engine for .NET)
using Microsoft.ClearScript.V8;

var engine = new V8ScriptEngine();

// Load package
engine.Execute(@"
  const { ColorService, DyeService } = require('@xivdyetools/core');
  const dyeService = new DyeService();
");

// Call from C#
var result = engine.Evaluate(@"
  dyeService.findClosestDyes('#FF6B6B', 5)
");
```

**Or port to C#** (recommended for performance):

```csharp
// Port ColorService to C#
public class ColorService
{
    public static (double h, double s, double v) RgbToHsv(int r, int g, int b)
    {
        // ... same algorithm as TypeScript version
    }
}
```

---

## Future Projects

### External API

```typescript
// server.ts
import express from 'express';
import { ColorService, DyeService } from '@xivdyetools/core';

const app = express();
const dyeService = new DyeService();

app.get('/api/match/:color', (req, res) => {
  const matches = dyeService.findClosestDyes(req.params.color, 5);
  res.json(matches);
});

app.listen(3000);
```

### CLI Tool

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { ColorService, DyeService } from '@xivdyetools/core';

const program = new Command();
const dyeService = new DyeService();

program
  .command('match <color>')
  .description('Find closest dyes to a color')
  .action((color) => {
    const matches = dyeService.findClosestDyes(color, 5);
    console.table(matches);
  });

program.parse();
```

```bash
# Install globally
npm install -g @xivdyetools/cli

# Use
xiv-dye match "#FF6B6B"
```

### Mobile App (React Native)

```typescript
import { ColorService, DyeService, dyeDatabase } from '@xivdyetools/core';

function ColorMatcherScreen() {
  const dyeService = new DyeService(dyeDatabase);

  const [color, setColor] = useState('#FF6B6B');
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    setMatches(dyeService.findClosestDyes(color, 5));
  }, [color]);

  return <View>...</View>;
}
```

---

## Maintenance

### Updating the Package

```bash
# 1. Make changes in src/
# 2. Update tests
npm test

# 3. Bump version
npm version patch  # or minor, major

# 4. Build
npm run build

# 5. Publish
npm publish

# 6. Update consumers
cd ../xivdyetools
npm update @xivdyetools/core

cd ../xivdyetools-discord-bot
npm update @xivdyetools/core
```

### Keeping Consumers in Sync

**Option 1: Manual** (Simple)
- Update core package
- Manually run `npm update @xivdyetools/core` in each project

**Option 2: Renovate Bot** (Automated)
- Install [Renovate](https://github.com/renovatebot/renovate)
- Auto-creates PRs when core package updates

**Option 3: GitHub Actions** (Semi-automated)
```yaml
# .github/workflows/update-core.yml (in consumer repos)
name: Update Core Package

on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm update @xivdyetools/core
      - uses: peter-evans/create-pull-request@v5
        with:
          title: "Update @xivdyetools/core"
```

---

## Best Practices

### ✅ Do

- Keep services pure (no side effects)
- Write comprehensive tests
- Document all public methods
- Use semantic versioning
- Maintain CHANGELOG.md
- Include TypeScript types

### ❌ Don't

- Add framework dependencies (React, Vue, etc.)
- Add DOM/browser-specific APIs
- Add Node.js-specific APIs (unless feature-detected)
- Break backward compatibility without major version bump
- Publish without tests passing

---

## Resources

- **npm Docs**: [npmjs.com/docs](https://docs.npmjs.com)
- **Semantic Versioning**: [semver.org](https://semver.org)
- **TypeScript Handbook**: [typescriptlang.org](https://www.typescriptlang.org/docs/)
- **GitHub Packages**: [docs.github.com/packages](https://docs.github.com/en/packages)

---

**Last Updated**: November 22, 2025
**Author**: XIV Dye Tools Team
**Version**: 1.0.0
