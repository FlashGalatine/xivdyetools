# Core Library Types

**The type surface around @xivdyetools/core**

---

## Where a type actually lives

Since core 2.0.0 the **shared** types live in `@xivdyetools/types`; core exports
only the types that describe its own behaviour. Getting this wrong is the single
most common import error in this repo.

| Type | Package |
|------|---------|
| `RGB`, `HSV`, `HSL`, `LAB`, `OKLAB`, `OKLCH`, `LCH`, `CMYK` | `@xivdyetools/types` |
| `HexColor`, `DyeId`, `Hue`, `Saturation` (+ their `create*`) | `@xivdyetools/types` |
| `Dye`, `DyeWithDistance`, `LocalizedDye`, `FacewearColor`, `DyeTypeFilters` | `@xivdyetools/types` |
| `VisionType`, `ColorblindMatrices`, `MatchQualityKey` | `@xivdyetools/types` |
| `Matrix3x3` | `@xivdyetools/types/color` (subpath only — not on the root barrel) |
| `PriceData`, `CachedData`, `RateLimitResult` | `@xivdyetools/types` |
| `PresetPalette`, `PresetData`, `CommunityPreset`, `PresetCategory`, `PresetStatus` | `@xivdyetools/types` |
| `LocaleCode`, `TranslationKey`, `HarmonyTypeKey`, `ColorWheelId` | `@xivdyetools/types` |
| `MatchingMethod`, `DyeCategory`, `DyeAcquisition` | `@xivdyetools/core` |
| `HarmonyOptions`, `HarmonySlot`, `HarmonySelectionConfig`, `ColorWheel` | `@xivdyetools/core` |
| `ICacheBackend`, `APIServiceOptions`, `ResolvedPreset` | `@xivdyetools/core` |
| `PaletteExtractionOptions`, `ExtractedColor`, `PaletteMatch` | `@xivdyetools/core` |
| `BandTier`, `BandMethod`, `BandContext`, `DeltaEFormula`, `RYB` | `@xivdyetools/core` |

The runtime **validators** (`isValidHexColor`, `isValidRGB`, `isValidHSV`) are
core's; the branded-type **constructors** are types'.

---

## Branded Types

```typescript
import { createHexColor, createDyeId, createHue, createSaturation } from '@xivdyetools/types';
import type { HexColor, DyeId, Hue, Saturation } from '@xivdyetools/types';
import { isValidHexColor } from '@xivdyetools/core';

const hex: HexColor = createHexColor('#FF6B6B');   // throws on an invalid format
const id: DyeId | null = createDyeId(102);         // null outside the 1-254 stainID window
const hue: Hue = createHue(370);                   // normalised to 0-360
const sat: Saturation = createSaturation(120);     // clamped to 0-100

isValidHexColor('#FF6B6B');                        // boolean — no throw, no branding
```

`createDyeId` validates a **stainID** (1-254), not an itemID such as 5729.
There is no `Value` / `createValue`.

---

## Colour Types

```typescript
interface RGB { r: number; g: number; b: number }      // 0-255
interface HSV { h: number; s: number; v: number }      // 0-360, 0-100, 0-100
interface LAB { L: number; a: number; b: number }      // NOTE: capital L
interface OKLCH { L: number; C: number; h: number }
```

`LAB.L` is capitalised — a lower-case `l` is a compile error.

---

## Dye Types

The runtime `Dye` has 17 fields. Only seven are stored in `dyes.json`
(`stainID`, `name`, `hex`, `category`, `acquisition`, `consolidationType`,
`legacyItemID`); the rest are derived at `DyeDatabase.initialize()`.

```typescript
interface Dye {
  itemID: number;              // always a number — use `itemID > 0` for market checks
  stainID: number | null;      // the canonical key since schema v2
  id: number;                  // equals itemID after normalisation
  name: string;
  hex: string;
  rgb: RGB;
  hsv: HSV;
  category: string;
  acquisition: string;
  cost: number;
  currency: string | null;
  isMetallic: boolean;
  isPastel: boolean;
  isDark: boolean;
  isCosmic: boolean;
  isIshgardian: boolean;
  consolidationType: 'A' | 'B' | 'C' | null;
}

interface DyeWithDistance extends Dye { distance: number }
```

There is no `sellable` field and no `DyeMatch` type. `lab` is computed but lives
on core's internal `DyeInternal`, not on the public `Dye`.

`DyeCategory` (core, `config/dye-vocabulary.ts`) is the closed set actually
present in the data:

```typescript
type DyeCategory =
  | 'Neutral' | 'Reds' | 'Browns' | 'Yellows'
  | 'Greens' | 'Blues' | 'Purples' | 'Special';

type DyeAcquisition =
  | 'Dye Vendor' | 'The Firmament' | 'Cosmic Exploration' | 'Venture Coffers';
```

---

## Harmony Types

`HARMONY_OFFSETS` has **ten** keys — `complementary`, `analogous`, `triadic`,
`split-complementary`, `tetradic`, `inverted-tetradic`, `square`,
`monochromatic`, `compound`, `shades` — and a harmony type is simply a key of
that table (`isKnownHarmonyType(s)`). There is no `HarmonyResult`; selection
returns `HarmonySlot[]`.

```typescript
interface HarmonySlot {
  index: number;         // position in HARMONY_OFFSETS[type]
  offset: number;        // ideal hue offset, 0-359
  targetHue: number;     // absolute ideal hue, 0-359
  wheelHue: number;      // the slot's angle on the SELECTED wheel's ring
  targetHex: string;     // the ideal colour (base S/V on the target hue)
  dye: Dye | null;       // the dye chosen, or null when no candidate fit
  deviance: number;      // distance from `dye` to the ideal, in the config's units
  companions: Dye[];     // runners-up, nearest first
}

interface HarmonySelectionConfig {
  usePerceptualMatching: boolean;
  matchingMethod: MatchingMethod;
  companionCount?: number;
  preventDuplicates?: boolean;
  wheel?: ColorWheelId;          // default 'rgb'
}
```

`ColorWheelId` = `'rgb' | 'ryb' | 'munsell' | 'oklch-hue' | 'oklch-lightness'`.

---

## Matching and Bands

```typescript
type MatchingMethod =
  'ciede2000' | 'oklab' | 'cie76' | 'redmean' | 'rgb' | 'distinguish';
// DEFAULT_MATCHING_METHOD === 'ciede2000'
```

`classifyBandTier` maps a distance to a `BandTier` using the calibrated,
per-method cuts in `BAND_VOCABULARY` (contexts `match` / `harmony` /
`separation`). `@xivdyetools/types` separately ships the coarser RGB-distance
`classifyMatchDistance` → `MatchQualityKey`.

---

## Accessibility Types

There is no `WCAGResult`. Contrast is read as numbers and booleans:
`getContrastRatio(hex1, hex2)`, `meetsWCAGAA(hex1, hex2, largeText?)`,
`meetsWCAGAAA(hex1, hex2, largeText?)`.

`VisionType` (types) has five members: `normal`, `protanopia`, `deuteranopia`,
`tritanopia`, `achromatopsia`. There is no `ColorblindnessType`.

---

## API Types

```typescript
interface PriceData {
  itemID: number;
  currentAverage: number;
  currentMinPrice: number;
  currentMaxPrice: number;
  lastUpdate: number;
  worldId?: number;
  worldName?: string;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version?: string;
  checksum?: string;
}
```

There is no `PriceListing` type — listings are not part of the shape core caches.

---

## Localization Types

```typescript
type LocaleCode = 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';

// A flat union of seven UI labels, not a template literal
type TranslationKey =
  'dye' | 'dark' | 'metallic' | 'pastel' | 'cosmic' | 'cosmicExploration' | 'cosmicFortunes';
```

There is no `Locale` type — it is `LocaleCode`.

---

## Not in this ecosystem

`Result<T, E>`, `isOk`, `isErr`, `Nullable` and `DeepReadonly` do **not** exist
in any xivdyetools package. Error handling goes through `AppError` / `ErrorCode`
from `@xivdyetools/types`, and services return `null` or throw.

---

## Full reference

Package READMEs: [`packages/types/README.md`](../../../packages/types/README.md),
[`packages/core/README.md`](../../../packages/core/README.md)

## Related Documentation

- [Services](services.md) - Service API reference
- [Overview](overview.md) - Quick start guide
- [Algorithms](algorithms.md) - Implementation details
