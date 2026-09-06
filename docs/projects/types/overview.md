# Types Package Overview

**@xivdyetools/types** - Shared TypeScript type definitions

> Current version: see [versions.md](../../versions.md).

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
import { Dye, DyeId, DyeWithDistance, FacewearColor } from '@xivdyetools/types';

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
  consolidationType: 'A' | 'B' | 'C' | null;
}

// A search result: the dye plus its distance from the query colour
interface DyeWithDistance extends Dye { distance: number }

interface FacewearColor { id: string; name: string; hex: string; }  // not a Dye

// Neither `DyeCategory` nor `MatchingMethod` lives here — both are
// @xivdyetools/core (config/dye-vocabulary.ts and types/, respectively).
// There is no `DyeMatch` type anywhere; use `DyeWithDistance`.
```

### Preset Types

There is no `Preset`, `PresetColor` or `PresetAuthor` type. Two shapes carry a
palette: `PresetPalette` (the curated `presets.json` row) and `CommunityPreset`
(the presets-API row, with voting and moderation).

```typescript
import { PresetPalette, CommunityPreset, PresetStatus, PresetCategory } from '@xivdyetools/types';

// Curated palette — packages/types/src/preset/core.ts
interface PresetPalette {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  dyes: number[];        // 3-6 stainIDs
  tags: string[];
  author?: string;
  version?: string;
}

// Community submission — packages/types/src/preset/community.ts (abridged)
interface CommunityPreset {
  id: string;
  name: string;
  description: string;
  category_id: PresetCategory;
  secondary_categories: PresetCategory[];   // at most two, never the primary
  dyes: number[];                           // 3-6 stainIDs
  tags: string[];
  author_discord_id: string | null;
  author_name: string | null;
  vote_count: number;
  status: PresetStatus;
  is_curated: boolean;
  created_at: string;
}

type PresetStatus = 'pending' | 'approved' | 'rejected' | 'flagged' | 'hidden';
type PresetCategory =
  | 'jobs' | 'grand-companies' | 'seasons' | 'events'
  | 'aesthetics' | 'appearance' | 'zones' | 'raids-trials';
```

### Auth Types

```typescript
import { JWTPayload, AuthProvider } from '@xivdyetools/types';

interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  jti?: string;
  orig_iat?: number;          // anchors absolute session age across refreshes
  username: string;
  global_name: string | null;
  avatar: string | null;
  auth_provider: AuthProvider;
  discord_id?: string;
  xivauth_id?: string;
  primary_character?: PrimaryCharacter;
}

type AuthProvider = 'discord' | 'xivauth';
```

> `@xivdyetools/auth` exports a **different** `JWTPayload` — the verifier's view,
> with `type?`, `nbf?` and `aud?` and without the `auth_provider` / character
> claims. Import from the package whose shape you actually mean.

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
const hex: HexColor = createHexColor('#FF6B6B');   // throws on an invalid format
const dyeId: DyeId | null = createDyeId(42);       // returns null outside the 1-254 stainID window

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
import type { PresetPalette, CommunityPreset } from '@xivdyetools/types';

// In xivdyetools-oauth
import type { JWTPayload, AuthProvider } from '@xivdyetools/types';
```

---

## Related Documentation

- [Core Library Types](../core/types.md) - Detailed type documentation
- [API Contracts](../../architecture/api-contracts.md) - API type usage
