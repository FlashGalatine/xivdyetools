# @xivdyetools/types

Shared TypeScript type definitions for the xivdyetools ecosystem.

## Installation

```bash
npm install @xivdyetools/types
```

## Overview

This package is the single source of truth for cross-package data shapes across the monorepo. It sits at **Level 0** of the dependency graph with zero internal dependencies, and ships `sideEffects: false` so unused subpaths are tree-shaken.

It consolidates types used by:

- [`@xivdyetools/core`](../core/) — color types, dye types, error types
- [`apps/web-app`](../../apps/web-app/) — extended dye types, UI-specific types
- [`apps/discord-worker`](../../apps/discord-worker/) — preset types
- [`apps/presets-api`](../../apps/presets-api/) — API response types, moderation types
- [`apps/oauth`](../../apps/oauth/) — authentication types

Effectively every package and app consumes it.

## Usage

### Full Import

```typescript
import {
  Dye,
  RGB,
  HexColor,
  createHexColor,
  CommunityPreset,
  AppError,
  ErrorCode,
} from '@xivdyetools/types';
```

### Subpath Imports (Tree-Shaking)

For smaller bundle sizes, import from specific modules:

```typescript
// Color types
import { RGB, HSV, LAB, HexColor, createHexColor, VisionType } from '@xivdyetools/types/color';

// Dye types
import { Dye, LocalizedDye, DyeWithDistance, DyeTypeFilters } from '@xivdyetools/types/dye';

// Character color types
import { CharacterColor, SubRace, RACE_SUBRACES } from '@xivdyetools/types/character';

// Preset types
import {
  CommunityPreset,
  PresetSubmission,
  PresetFilters,
  PresetListResponse,
} from '@xivdyetools/types/preset';

// Auth types
import { AuthResponse, JWTPayload, DiscordUser } from '@xivdyetools/types/auth';

// Error types
import { AppError, ErrorCode, ErrorSeverity } from '@xivdyetools/types/error';

// API types
import { APIResponse, CachedData, ModerationResult } from '@xivdyetools/types/api';

// Localization types
import { LocaleCode, LocaleData, TranslationKey } from '@xivdyetools/types/localization';
```

## Type Categories

### Color Types

```typescript
import { RGB, HSV, HexColor, createHexColor, DyeId, createDyeId } from '@xivdyetools/types';

// RGB, HSV, and LAB interfaces
const red: RGB = { r: 255, g: 0, b: 0 };
const redHsv: HSV = { h: 0, s: 100, v: 100 };

// LAB color space (for perceptual color matching)
import { LAB } from '@xivdyetools/types';
const redLab: LAB = { L: 53.23, a: 80.11, b: 67.22 };

// Branded types with validation
const hex: HexColor = createHexColor('#ff6b6b'); // Validates and normalizes to "#FF6B6B"
const dyeId: DyeId | null = createDyeId(102);    // A stainID (1-254; 102 = Jet Black); itemIDs and negatives → null

// Colorblindness types
import { VisionType, ColorblindMatrices } from '@xivdyetools/types';
const vision: VisionType = 'deuteranopia';
```

### Dye Types

```typescript
import { Dye, LocalizedDye, DyeWithDistance, DyeDatabase } from '@xivdyetools/types';

// Full dye object. Since schema v2, `stainID` is the canonical key and most
// other fields are derived at DyeDatabase.initialize() in @xivdyetools/core.
// `itemID` is always a number at runtime — never null.
const dye: Dye = {
  itemID: 5729,
  stainID: 1,  // Game's internal stain table ID — the canonical key
  id: 5729,    // always equals itemID after core's normalisation
  name: 'Snow White',
  hex: '#FFFFFF',
  rgb: { r: 255, g: 255, b: 255 },
  hsv: { h: 0, s: 0, v: 100 },
  category: 'Neutral',
  acquisition: 'NPC',
  cost: 216,
  currency: 'Gil',
  isMetallic: false,
  isPastel: false,
  isDark: false,
  isCosmic: false,
  isIshgardian: false,
  consolidationType: 'A',
};

// Dye with color distance (for search results)
const match: DyeWithDistance = { ...dye, distance: 12.5 };
```

### Preset Types

```typescript
import {
  CommunityPreset,
  PresetSubmission,
  PresetFilters,
  PresetCategory,
  PresetStatus,
} from '@xivdyetools/types';

// Query presets
const filters: PresetFilters = {
  category: 'jobs',
  sort: 'popular',
  page: 1,
  limit: 20,
};

// Submit a new preset
const submission: PresetSubmission = {
  name: 'Red Mage Vibes',
  description: 'Crimson and black for the sophisticated caster',
  category_id: 'jobs',
  dyes: [102, 21, 45],   // stainIDs, 3–6 per preset (2.0.0 — was itemIDs)
  tags: ['rdm', 'red', 'elegant'],
};
```

### Auth Types

```typescript
import { AuthResponse, JWTPayload, AuthProvider } from '@xivdyetools/types';

// Check auth response
function handleAuthResponse(response: AuthResponse) {
  if (response.success && response.token) {
    localStorage.setItem('token', response.token);
  }
}

// JWT payload structure
const payload: JWTPayload = {
  sub: 'user-uuid',
  iat: Date.now() / 1000,
  exp: Date.now() / 1000 + 3600,
  iss: 'https://auth.xivdyetools.app',
  username: 'User',
  global_name: 'Display Name',
  avatar: null,
  auth_provider: 'discord',
  discord_id: '123456789',
};
```

### Error Types

```typescript
import { AppError, ErrorCode } from '@xivdyetools/types';

// Throw typed errors
throw new AppError(ErrorCode.DYE_NOT_FOUND, 'Dye with ID 999 not found');

// With severity
throw new AppError(ErrorCode.DATABASE_LOAD_FAILED, 'Failed to load dyes', 'critical');

// Serialize for API responses
catch (error) {
  if (error instanceof AppError) {
    return { error: error.toJSON() };
  }
}
```

### Utility Types

```typescript
import { Result, isOk, isErr, Nullable } from '@xivdyetools/types';

// Result type for operations that might fail
function findDye(id: number): Result<Dye> {
  const dye = database.find(d => d.id === id);
  if (dye) {
    return { ok: true, value: dye };
  }
  return { ok: false, error: new AppError(ErrorCode.DYE_NOT_FOUND, `Dye ${id} not found`) };
}

// Type guards
const result = findDye(1);
if (isOk(result)) {
  console.log(result.value.name); // TypeScript knows this is Dye
} else {
  console.error(result.error.message); // TypeScript knows this is AppError
}
```

## Migration Guide

### From xivdyetools-core

```typescript
// Before
import { Dye, RGB, HexColor, AppError, ErrorCode } from 'xivdyetools-core';

// After
import { Dye, RGB, HexColor, AppError, ErrorCode } from '@xivdyetools/types';
```

### From xivdyetools-web-app/src/shared/types.ts

```typescript
// Before
import { Dye, DyeWithDistance, AppError } from '../shared/types';

// After
import { Dye, DyeWithDistance, AppError } from '@xivdyetools/types';
```

### From xivdyetools-presets-api/src/types.ts

```typescript
// Before
import { CommunityPreset, PresetFilters, ModerationResult } from './types';

// After
import { CommunityPreset, PresetFilters, ModerationResult } from '@xivdyetools/types';
```

## API Reference

### Modules

| Module | Description |
|--------|-------------|
| `@xivdyetools/types` | All types (barrel export) |
| `@xivdyetools/types/color` | RGB, HSV, LAB, OKLAB, OKLCH, LCH, HSL, HexColor, branded types |
| `@xivdyetools/types/dye` | Dye, LocalizedDye, DyeWithDistance, DyeTypeFilters |
| `@xivdyetools/types/character` | CharacterColor, SubRace, RACE_SUBRACES, COLOR_GRID_DIMENSIONS |
| `@xivdyetools/types/preset` | Preset, community, filters, responses |
| `@xivdyetools/types/auth` | OAuth, JWT, Discord, XIVAuth |
| `@xivdyetools/types/api` | APIResponse, CachedData, moderation |
| `@xivdyetools/types/error` | AppError, ErrorCode enum |
| `@xivdyetools/types/localization` | LocaleCode, LocaleData |

### Helper Functions

| Function | Description |
|----------|-------------|
| `createHexColor(hex)` | Validate and normalize hex color (throws on invalid format) |
| `createDyeId(id)` | Validate a stainID — `1-254` (the loader window; not itemIDs like 5729, not the retired synthetic Facewear negatives); returns `null` otherwise |
| `createHue(hue)` | Normalize hue to 0-360 |
| `createSaturation(sat)` | Clamp saturation to 0-100 |
| `isOk(result)` | Type guard for successful Result |
| `isErr(result)` | Type guard for error Result |

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X/Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.**
