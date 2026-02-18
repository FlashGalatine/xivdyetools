# Types Package Overview

**@xivdyetools/types** - Shared TypeScript type definitions

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

interface Dye {
  id: DyeId;
  name: string;
  hex: HexColor;
  rgb: RGB;
  category: DyeCategory;
  itemId?: number;
  sellable: boolean;
}

type DyeCategory =
  | 'basic' | 'brown' | 'red' | 'orange'
  | 'yellow' | 'green' | 'blue' | 'purple' | 'metallic';
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
