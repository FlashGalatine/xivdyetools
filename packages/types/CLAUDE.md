# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/types` is the foundational type-only package for the entire xivdyetools ecosystem. It consolidates branded types (`HexColor`, `DyeId`, `Hue`, `Saturation`, `DiscordSnowflake`), domain interfaces (dyes, presets, character colors, auth payloads, API responses), and the shared `AppError`/`ErrorCode` runtime classes.

Splitting these out keeps every other package and app aligned on a single source of truth for cross-package data shapes and lets every consumer share branded-type guarantees without runtime cost. The package has zero internal dependencies and ships with `sideEffects: false` so unused subpaths are tree-shaken.

## Commands

```bash
pnpm build         # tsc -p tsconfig.build.json
pnpm test          # vitest run
pnpm test:watch    # vitest
pnpm test:coverage # vitest run --coverage
pnpm type-check    # tsc --noEmit
pnpm lint          # eslint src
pnpm clean         # rimraf dist
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/types
pnpm --filter @xivdyetools/types exec vitest run src/color/branded.test.ts
```

## Architecture

The package is organized into per-domain subpath exports. Each subpath has its own entry in the `exports` field of `package.json`, so consumers can import either from the root (`@xivdyetools/types`) or from a focused subpath (`@xivdyetools/types/color`, `@xivdyetools/types/preset`, etc.).

### Key Directories

```
src/
├── color/         # RGB/HSV/LAB/OKLAB/OKLCH/LCH/HSL + branded HexColor/DyeId/Hue/Saturation
├── dye/           # Dye, LocalizedDye, DyeWithDistance, DyeTypeFilters
├── character/     # CharacterColor, CharacterColorMatch, SubRace, RACE_SUBRACES, COLOR_GRID_DIMENSIONS
├── preset/        # Community preset shapes + every API request/response variant
├── auth/          # JWT payload, Discord/XIVAuth user shapes, isValidSnowflake validator
├── api/           # CachedData, ModerationResult/Stats, PriceData, RateLimitResult
├── error/         # ErrorCode enum + AppError runtime class (only runtime export)
└── localization/  # LocaleCode, TranslationKey, JobKey, GrandCompanyKey, etc.
```

## Public API

Grouped by category (see `src/index.ts` for the canonical export list).

### Branded color types (runtime helpers + types)

```typescript
type HexColor = string & { readonly __brand: 'HexColor' };
type DyeId = number & { readonly __brand: 'DyeId' };
type Hue = number & { readonly __brand: 'Hue' };
type Saturation = number & { readonly __brand: 'Saturation' };

function createHexColor(hex: string): HexColor;          // throws on invalid format
function createDyeId(id: number): DyeId | null;          // 1-200 or <= -1000 (synthetic)
function createHue(hue: number): Hue;                     // wraps to 0-360
function createSaturation(saturation: number): Saturation; // clamps to 0-100
```

### Color spaces and vision

```typescript
type RGB; type HSV; type LAB; type OKLAB; type OKLCH; type LCH; type HSL;
type VisionType; type ColorblindMatrices;
```

### Dye types

```typescript
type Dye; type LocalizedDye; type DyeWithDistance; type DyeTypeFilters;
```

### Character types

```typescript
type CharacterColor; type CharacterColorMatch;
type SharedColorCategory; type RaceSpecificColorCategory;
type SubRace; type Gender;
const RACE_SUBRACES; const SUBRACE_TO_RACE; const COLOR_GRID_DIMENSIONS;
```

### Preset types

23 types covering `CommunityPreset`, `PresetSubmission`, `PresetFilters`, plus full request/response shapes for the presets API (`PresetListResponse`, `PresetSubmitResponse`, `PresetEditResponse`, `VoteResponse`, `ModerationResponse`, `CategoryListResponse`).

### Auth types

```typescript
type AuthProvider; type AuthSource; type AuthContext; type PrimaryCharacter;
type JWTPayload; type OAuthState;
type DiscordTokenResponse; type DiscordUser;
type XIVAuthTokenResponse; type XIVAuthUser; type XIVAuthCharacter;
type XIVAuthCharacterRegistration; type XIVAuthSocialIdentity;
type AuthUser; type AuthResponse; type RefreshResponse; type UserInfoResponse;

function isValidSnowflake(id: string): boolean;  // /^\d{17,20}$/
```

### API types

```typescript
type CachedData; type ModerationResult; type ModerationLogEntry;
type ModerationStats; type PriceData; type RateLimitResult;
```

### Localization types

```typescript
type LocaleCode;       // 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh'
type TranslationKey; type HarmonyTypeKey; type ToolKey; type SheetKey;
type JobKey; type GrandCompanyKey; type RaceKey; type ClanKey;
type LocaleData; type LocalePreference;
```

### Error types (runtime exports)

```typescript
enum ErrorCode { /* validation, network, auth, rate-limit, etc. */ }
class AppError extends Error { /* code, severity, context */ }
type ErrorSeverity;
```

## Key Patterns

### Branded type technique

Every branded type follows the same recipe:

```typescript
export type DyeId = number & { readonly __brand: 'DyeId' };
export function createDyeId(id: number): DyeId | null { /* validate, return id as DyeId */ }
```

The brand is structural-only — it has no runtime cost, and the `as` cast inside the helper is the *only* place a value should be coerced into the branded type. Consumers must never write `value as DyeId` directly; that bypasses validation. This is documented as **TYPES-101** in `src/color/branded.ts`.

### When to add a new branded type

Add a brand when a primitive type is being passed across a boundary where mixing it up with a similarly-typed primitive would be a bug — for example: a Discord Snowflake vs. a generic string ID, or a `DyeId` vs. an arbitrary number. Add a `create*` helper that performs validation and returns either the branded value or `null`/throws.

### Synthetic Facewear IDs

`createDyeId` accepts both regular IDs (1-200) and synthetic Facewear IDs (`<= -1000`). The 11 Facewear dyes lack real `itemID` values in `colors_xiv.json`, so `DyeDatabase.initialize()` (in `@xivdyetools/core`) assigns `-(1000 + nameHash)`. Anything filtering for market-board operations must use `dye.itemID > 0`, never a null check — `Dye.itemID` is always a number.

### Subpath exports

Every subdirectory under `src/` has its own export entry in `package.json`. Prefer importing from the focused subpath (`@xivdyetools/types/preset`) when you only need one domain — it's documentation, not enforcement, but it keeps imports honest.

## Consumers

Grepped from `package.json` files in the monorepo:

- Packages: `@xivdyetools/core`, `@xivdyetools/svg`, `@xivdyetools/bot-logic`, `@xivdyetools/test-utils`
- Apps: `xivdyetools-web-app`, `xivdyetools-discord-worker`, `xivdyetools-presets-api`, `xivdyetools-oauth`, `xivdyetools-moderation-worker`, `xivdyetools-og-worker`, `xivdyetools-api-worker`, `xivdyetools-stoat-worker`

Effectively every package and app consumes this — it sits at the bottom of the dependency graph.

## Internal Dependencies

None. This package is at Level 0 of the dependency flow and intentionally has zero `dependencies` or `peerDependencies` so it can be imported by anything.

## Publishing

```bash
# 1. Make changes in packages/types/
# 2. Build and test
pnpm turbo run build test --filter=@xivdyetools/types

# 3. Bump version in packages/types/package.json
# 4. Publish
pnpm --filter @xivdyetools/types publish --provenance --access public --no-git-checks
```

`prepublishOnly` runs `clean` then `build` automatically. Because so many other packages depend on this one, a breaking change here cascades — bump majors deliberately and update the dependent `workspace:*` consumers in the same PR.
