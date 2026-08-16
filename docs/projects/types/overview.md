# Types Package Overview

**@xivdyetools/types** v2.0.0 - Shared TypeScript type definitions

> **2.0.0 (5.0 wave):** `FacewearColor` (string slug `id`, `name`, `hex` — the 11 Facewear colours are
> not dyes), `CMYK`, `invertedTetradic`, `SubRace 'Helions'` (was `'Helion'`), the widened
> `CommunityPreset` (`secondary_categories`, `preview_image_*`, `example_link`, `rejection_reason`),
> and `PresetCategory` without `community` (+ `appearance`, `zones`, `raids-trials`). The snippets
> below are illustrative and simplified — `packages/types/src/` is the source of truth.

---

## What is @xivdyetools/types?

A TypeScript package containing all shared type definitions for the XIV Dye Tools ecosystem. Provides type safety and consistency across all projects.

---

## Installation

```bash
npm install @xivdyetools/types
```

---

## Key Types

### Color Types

```typescript
import { RGB, HSV, HSL, LAB, HexColor } from '@xivdyetools/types';

interface RGB {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
}

interface HSV {
  h: number;  // 0-360
  s: number;  // 0-100
  v: number;  // 0-100
}

// HexColor is a branded string type
type HexColor = string & { __brand: 'HexColor' };
```

### Dye Types

```typescript
import { Dye, DyeId, DyeCategory, DyeMatch } from '@xivdyetools/types';

// Simplified — see packages/types/src/dye/dye.ts for the full runtime shape
interface Dye {
  itemID: number;          // legacy market itemID (always a number; use itemID > 0 for market checks)
  stainID: number | null;  // the game's Stain sheet ID — the canonical key since schema v2
  id: number;
  name: string;
  hex: string;
  rgb: RGB;
  hsv: HSV;
  category: string;        // 'Neutral' | 'Reds' | 'Browns' | 'Yellows' | 'Greens' | 'Blues' | 'Purples' | 'Special'
  acquisition: string;
  cost: number;
  currency: string | null;
  isMetallic: boolean; isPastel: boolean; isDark: boolean; isCosmic: boolean; isIshgardian: boolean;
}

interface FacewearColor { id: string; name: string; hex: string; }  // not a Dye

// MatchingMethod ('ciede2000' | 'oklab' | 'cie76' | 'redmean' | 'rgb' | 'distinguish') lives in @xivdyetools/core, not here
```

### Preset Types

```typescript
import { Preset, PresetColor, PresetStatus } from '@xivdyetools/types';

interface Preset {
  id: string;
  name: string;
  description?: string;
  colors: PresetColor[];
  category: PresetCategory;
  author?: PresetAuthor;
  upvotes: number;
  downvotes: number;
  status: PresetStatus;
  isCurated: boolean;
  createdAt: string;
}

type PresetStatus = 'pending' | 'approved' | 'rejected';
```

### Auth Types

```typescript
import { JWTPayload, AuthProvider } from '@xivdyetools/types';

interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  username: string;
  global_name?: string;
  avatar?: string;
  auth_provider: AuthProvider;
  discord_id: string;
}

type AuthProvider = 'discord' | 'xivauth';
```

---

## Branded Types

The package provides branded types for compile-time safety:

```typescript
import {
  HexColor,
  DyeId,
  Hue,
  Saturation,
  createHexColor,
  createDyeId
} from '@xivdyetools/types';

// Creating branded values
const hex: HexColor = createHexColor('#FF6B6B');
const dyeId: DyeId = createDyeId(42);

// Type safety prevents raw values
function processColor(hex: HexColor) { ... }
processColor('#FF6B6B');                    // ❌ Type error
processColor(createHexColor('#FF6B6B'));    // ✅ Works
```

---

## Usage in Projects

All projects import types from this package:

```typescript
// In @xivdyetools/core
import type { Dye, RGB, HexColor } from '@xivdyetools/types';

// In xivdyetools-web-app
import type { Preset, PresetColor } from '@xivdyetools/types';

// In xivdyetools-oauth
import type { JWTPayload, AuthProvider } from '@xivdyetools/types';
```

---

## Related Documentation

- [Core Library Types](../core/types.md) - Detailed type documentation
- [API Contracts](../../architecture/api-contracts.md) - API type usage
