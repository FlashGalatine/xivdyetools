# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/core` is the heart of the XIV Dye Tools ecosystem: a Node + browser-compatible TypeScript library that bundles the FFXIV dye database (136 entries), color-science algorithms (RGB/HSV/HSL/LAB/OKLAB/OKLCH/LCH/RYB conversions, DeltaE variants, Kubelka-Munk spectral mixing), color-vision-deficiency simulation, k-d tree dye matching, harmony generation, palette extraction, character-color matching, the Universalis market-board API client, and a 6-language localization service.

It is consumed by every downstream library and app — `@xivdyetools/color-blending`, `@xivdyetools/svg`, `@xivdyetools/bot-logic`, the Vite web app, the public API worker, the Discord bot, the Revolt (stoat) bot, the OG image worker, and the maintainer tool. Because so much depends on it, refactors here ripple everywhere — be conservative and run the full workspace test suite (`pnpm turbo run test`) for any non-trivial change.

## Commands

```bash
pnpm --filter @xivdyetools/core run build         # build:version → build:locales → tsc → copy:locales
pnpm --filter @xivdyetools/core run test
pnpm --filter @xivdyetools/core run test:integration
pnpm --filter @xivdyetools/core run test:coverage
pnpm --filter @xivdyetools/core run type-check
pnpm --filter @xivdyetools/core run lint
pnpm --filter @xivdyetools/core run docs          # TypeDoc → markdown
pnpm --filter @xivdyetools/core run clean
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/core
pnpm turbo run test --filter=@xivdyetools/core
pnpm --filter @xivdyetools/core exec vitest run src/services/__tests__/ColorService.test.ts
```

## Architecture

`@xivdyetools/core` follows a **facade + focused-class** pattern (per the internal "R-4" refactor): top-level service classes (`ColorService`, `DyeService`, `LocalizationService`) are thin façades that delegate to single-responsibility classes (`ColorConverter`, `ColorblindnessSimulator`, `ColorAccessibility`, `ColorManipulator`, `RybColorMixer`, `SpectralMixer`, `DyeDatabase`, `DyeSearch`, `HarmonyGenerator`, `LocaleLoader`, `LocaleRegistry`, `TranslationProvider`).

The dye database, presets, and per-locale translation files are bundled as JSON imports — there is no runtime I/O, which keeps the package safe for Cloudflare Workers, Vite browser bundles, and Node alike.

### Key Directories

```
src/
├── index.ts                       # Public API surface
├── version.ts                     # Auto-generated from package.json on build
├── constants/                     # RGB/HSV ranges, Universalis API config, Brettel matrices
├── types/                         # MatchingMethod, OklchWeights, MatchingConfig, MATCHING_PRESETS
├── config/consolidated-ids.ts     # Patch 7.5 dye consolidation (A=52254, B=52255, C=52256)
├── data/
│   ├── colors_xiv.json            # 136 dyes (raw)
│   ├── colors_xiv.csv             # CSV mirror
│   ├── presets.json               # Curated palette/harmony presets
│   ├── character_colors.json      # FFXIV skin/hair color tables
│   ├── character_colors/          # Per-race split files
│   └── locales/                   # Generated en/ja/de/fr/ko/zh JSON (after build:locales)
├── services/
│   ├── ColorService.ts            # Facade: conversion, mixing, simulation
│   ├── DyeService.ts              # Facade: database, search, harmony
│   ├── LocalizationService.ts     # Facade: 6-locale translation
│   ├── APIService.ts              # Universalis client + ICacheBackend
│   ├── PresetService.ts           # Resolve curated presets
│   ├── PaletteService.ts          # K-means palette extraction + dye matching
│   ├── CharacterColorService.ts   # FFXIV skin/hair color lookup
│   ├── color/                     # ColorConverter, ColorblindnessSimulator,
│   │                              # ColorAccessibility, ColorManipulator,
│   │                              # RybColorMixer, SpectralMixer
│   ├── dye/                       # DyeDatabase, DyeSearch, HarmonyGenerator, DyeFilter
│   └── localization/              # LocaleLoader, LocaleRegistry, TranslationProvider
├── utils/
│   ├── kd-tree.ts                 # 3D k-d tree (RGB nearest neighbour)
│   └── index.ts                   # clamp, lerp, retry, sleep, generateChecksum, validators
└── __tests__/integration/         # End-to-end workflow + perf benchmarks
scripts/
├── fetch_dye_names.py             # Pulls XIVAPI v2 names → dyenames.csv (en/ja/de/fr only)
├── build-locales.ts               # YAML + CSV + colors_xiv.json → src/data/locales/*.json
├── copy-locales.ts                # Copies generated locales into dist/
└── generate-version.ts            # Stamps package.json version into src/version.ts
```

## Public API

### Services (classes)

```ts
class ColorService              // Facade — see below
class DyeService                // Facade — see below
class LocalizationService       // Facade — see below
class ColorConverter            // hex/RGB/HSV/HSL/LAB/OKLAB/OKLCH/LCH conversions, DeltaE
class APIService                // Universalis market-board API
class MemoryCacheBackend        // In-process ICacheBackend impl
class PresetService             // Resolve presets.json entries
class PaletteService            // extractPalette / extractAndMatchPalette
class CharacterColorService     // FFXIV skin/hair lookups
class LocaleLoader              // Stateless — loads a single locale's JSON
class LocaleRegistry            // Stateless — manages multiple loaded locales
class TranslationProvider       // Stateless — performs translations from a registry
```

### `ColorService` (static methods)

Conversion: `hexToRgb`, `rgbToHex`, `rgbToHsv`, `hsvToRgb`, `hexToHsv`, `hsvToHex`, `normalizeHex`, `rgbToLab`, `hexToLab`, `labToRgb`, `labToHex`, `rgbToOklab`, `hexToOklab`, `oklabToRgb`, `oklabToHex`, `rgbToOklch`, `hexToOklch`, `oklchToRgb`, `oklchToHex`, `labToLch`, `lchToLab`, `rgbToLch`, `hexToLch`, `lchToRgb`, `lchToHex`, `rgbToHsl`, `hexToHsl`, `hslToRgb`, `hslToHex`, `rybToRgb`, `rgbToRyb`, `hexToRyb`, `rybToHex`.

Distance: `getColorDistance` (Euclidean RGB), `getDeltaE` (CIE76 / CIE2000).

Accessibility: `getPerceivedLuminance`, `getContrastRatio`, `meetsWCAGAA`, `meetsWCAGAAA`, `isLightColor`, `getOptimalTextColor`.

Manipulation: `adjustBrightness`, `adjustSaturation`, `rotateHue`, `invert`, `desaturate`.

CVD simulation: `simulateColorblindness`, `simulateColorblindnessHex` (Brettel matrices for protan/deuter/tritanopia).

Mixing: `mixColorsRgb`, `mixColorsLab`, `mixColorsOklab`, `mixColorsOklch`, `mixColorsLch`, `mixColorsHsl`, `mixColorsHsv`, `mixColorsRyb`, `mixColorsSpectral`, `mixMultipleSpectral`, `gradientSpectral`, `interpolateHue` (`shorter` | `longer` | `increasing` | `decreasing`), `isSpectralAvailable`.

Cache: `clearCaches`, `getCacheStats`.

### `DyeService` (instance methods, constructor `new DyeService(dyeData?, options?)`)

`getAllDyes`, `getDyeById`, `getByStainId`, `getDyesByIds`, `getDyesByStainIds`, `getDyeCount`, `getCategories`, `findClosestDye`, `findDyesWithinDistance`, `searchByName`, `findTriadicDyes`, `findComplementaryPair`, `findAnalogousDyes`, `findSplitComplementaryDyes`, `findTetradicDyes`, `findSquareDyes`, `findMonochromaticDyes`, plus types `FindClosestOptions`, `FindWithinDistanceOptions`, `HarmonyOptions`, `HarmonyMatchingAlgorithm`, `HarmonyColorSpace`.

### `LocalizationService` + helpers

```ts
const SUPPORTED_LOCALES: readonly LocaleCode[]   // ['en','ja','de','fr','ko','zh']
function extractLocaleCode(locale: string): LocaleCode | null
function resolveLocaleFromPreference(p: LocalePreference): LocaleCode  // explicit > guild > system > fallback
class LocalizationService {
  setLocale(code: LocaleCode): Promise<void>
  getDyeName(itemID: number): string | null
  getCategory(key: string): string
  // + harmony types, vision types, tool/sheet/job/grand-company/race/clan keys
}
```

`LocaleLoader` / `LocaleRegistry` / `TranslationProvider` are also exported for **stateless** callers (e.g., `og-worker`) that want explicit-locale APIs without the singleton + `setLocale` pattern.

### `APIService` — Universalis market board

```ts
interface ICacheBackend {
  get(key): Promise<CachedData<PriceData> | null> | CachedData<PriceData> | null
  set(key, value): Promise<void> | void
  delete(key): Promise<void> | void
}
interface APIServiceOptions { cache?: ICacheBackend; logger?: Logger; fetchClient?: FetchClient; rateLimiter?: RateLimiter }
class APIService {
  fetchPrices(itemIds: number[], world: string): Promise<PriceData>     // ≤100 ids per call
  fetchPricesBatched(itemIds: number[], world: string): Promise<PriceData> // chunks of 100
  // + cache stats / metrics
}
```

### Dye filtering / consolidation / matching presets

```ts
isDyeExcluded, filterDyes, hasActiveFilters
EXPENSIVE_DYE_IDS, VENDOR_ACQUISITIONS, CRAFT_ACQUISITIONS  // ['The Firmament','Venture Coffers']
CONSOLIDATED_IDS, CONSOLIDATED_DYES, isConsolidationActive,
  getMarketItemID, getConsolidatedDyeName
type ConsolidationType, ConsolidatedDye, LocalizedDyeName
MATCHING_PRESETS, type MatchingMethod, OklchWeights, MatchingConfig
type DeltaEFormula = 'cie76' | 'cie2000'
type RYB
```

### Constants

`RGB_MIN/MAX`, `HUE_MIN/MAX`, `SATURATION_MIN/MAX`, `VALUE_MIN/MAX`, `COLOR_DISTANCE_MAX`, `VISION_TYPES`, `VISION_TYPE_LABELS`, `BRETTEL_MATRICES`, `PATTERNS`, `UNIVERSALIS_API_BASE`, `UNIVERSALIS_API_TIMEOUT`, `UNIVERSALIS_API_RETRY_COUNT`, `UNIVERSALIS_API_RETRY_DELAY`, `API_CACHE_TTL`, `API_DEBOUNCE_DELAY`, `API_CACHE_VERSION`, `API_MAX_RESPONSE_SIZE`, `API_RATE_LIMIT_DELAY`.

### Utils

`clamp`, `lerp`, `round`, `distance`, `unique`, `groupBy`, `sortByProperty`, `filterNulls`, `isValidHexColor`, `isValidRGB`, `isValidHSV`, `isString`, `isNumber`, `isArray`, `isObject`, `isNullish`, `sleep`, `retry`, `isAbortError`, `generateChecksum`.

### Bundled data + version

```ts
import { dyeDatabase, presetData, VERSION } from '@xivdyetools/core';
```

## Key Patterns / Algorithms

### `DyeDatabase.initialize()` — the singleton init step
- Validates each entry (id/itemID, name, hex `^#[A-Fa-f0-9]{6}$`, RGB 0-255, HSV ranges, category).
- **Synthetic IDs for Facewear**: 11 Facewear dyes have `itemID: null` in the JSON. The init step assigns negative IDs computed from a name hash (`-(1000 + Σ charCode)`), so `Dye.itemID: number` is **never null at runtime**. For market-board filters use `dye.itemID > 0` — **never** a null check.
- Builds three indexes: `dyesByIdMap`, `dyesByStainIdMap` (for Glamourer / Mare plugin interop), and `dyesByHueBucket` (36 × 10° buckets — 70-90% speedup on harmony lookups).
- Builds a 3D k-d tree (RGB) for nearest-neighbour matching; **Facewear dyes are excluded** from the k-d tree (not market-tradeable).
- Pre-computes `nameLower`, `categoryLower` (search optimization) and `lab` (DeltaE pre-computation) on each entry.
- Defends against prototype pollution by stripping `__proto__`, `constructor`, `prototype` keys via `safeClone`.

### k-d Tree (`utils/kd-tree.ts`)
3D RGB k-d tree with index-based construction (no point-array slicing → less GC pressure). O(log n) average for nearest-neighbour queries vs O(n) linear search.

### Harmony color spaces
`HarmonyGenerator` supports both `'hue'` and `'deltaE'` matching, in any of 4 color spaces: `'hsv'` (default, fast bucket lookup), `'oklch'` (perceptually uniform, recommended), `'lch'`, `'hsl'`. DeltaE tolerance defaults differ per formula (`cie76: 40`, `cie2000: 25`).

### Spectral mixing (Kubelka-Munk)
`SpectralMixer` wraps `spectral.js` and reflects light absorption/scattering across 380-750nm. Blue + Yellow = Green like real paint. `isSpectralAvailable()` lets callers gate fallbacks for environments where the dependency is unavailable.

### Locale build pipeline
1. `scripts/fetch_dye_names.py` (Python, run **manually**) hits XIVAPI v2 → `dyenames.csv`. XIVAPI only serves en/ja/de/fr — **Korean and Chinese names are sourced manually** from market-board HTML and pasted into the CSV.
2. `scripts/build-locales.ts` reads `localize.yaml` (label structure), `dyenames.csv` (per-language names), and `src/data/colors_xiv.json` (metallic flags, categories) → emits `src/data/locales/{en,ja,de,fr,ko,zh}.json`.
3. `tsc -p tsconfig.build.json` compiles to `dist/`.
4. `scripts/copy-locales.ts` copies the generated JSON into `dist/`.

`build-locales.ts` re-stamps `meta.generated` (an ISO timestamp) on every run, so locale files have a noisy diff after every build. Stage release commits explicitly to skip the timestamp churn.

## Consumers

Internal apps:
- `apps/web-app` — Vite browser bundle, uses `dyeDatabase` JSON import, `ColorService`, `DyeService`, `LocalizationService`, `PaletteService`, `APIService`.
- `apps/discord-worker` — Cloudflare Worker, uses `DyeService`, `LocalizationService`, `APIService` with a KV-backed `ICacheBackend`.
- `apps/api-worker` — public dye/color-matching API.
- `apps/og-worker` — uses the stateless `LocaleLoader/Registry/TranslationProvider` trio.
- `apps/stoat-worker` — Revolt bot.
- `apps/maintainer` — Vue tool that reads/writes `colors_xiv.json` and rebuilds locales.

Internal packages:
- `@xivdyetools/color-blending` — wraps `ColorService` mixing.
- `@xivdyetools/svg` — uses `ColorService`, `DyeService`.
- `@xivdyetools/bot-logic` — uses `DyeService`, `LocalizationService`, `filterDyes`, harmony types.

## Internal Dependencies

- `@xivdyetools/types` — branded types (`HexColor`, `Dye`, `LocaleCode`, etc.) and `AppError` / `ErrorCode`.
- `@xivdyetools/logger` — pluggable `Logger` with `NoOpLogger` default.

External: `spectral.js` (Kubelka-Munk).

## Publishing

```bash
# 1. Bump version in packages/core/package.json
# 2. Build + test
pnpm turbo run build test --filter=@xivdyetools/core

# 3. Publish (or use the GitHub Actions workflow_dispatch).
#    If you've made manual locale fixes (e.g., Korean/Chinese name corrections),
#    add --ignore-scripts so build:locales doesn't regenerate over them.
pnpm --filter @xivdyetools/core publish --provenance --access public --no-git-checks
# or, after manual locale edits:
pnpm --filter @xivdyetools/core publish --provenance --access public --no-git-checks --ignore-scripts
```

`build:version` runs first and stamps `src/version.ts` from `package.json` — keep `version.ts` in source control but treat it as auto-generated.
