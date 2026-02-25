# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **ESLint v10 compatibility**: Fix lint errors for new `eslint:recommended` rules
  - `no-useless-assignment`: Remove dead initializers (`rNorm`, `gNorm`, `bNorm`) in `ColorConverter.hsvToRgb()`
  - `preserve-caught-error`: Add `{ cause: parseError }` to re-thrown error in `APIService.get()`
  - `preserve-caught-error`: Add `{ cause: e }` in `types.test.ts`

## [1.17.2] - 2026-02-21

### Added

- `spectral-js.d.ts` type declarations for untyped spectral.js library

### Performance

- **OPT-001**: Add LRU cache for `rgbToOklab()` conversions — OKLAB is the recommended matching method and was the only uncached color space conversion on the hot path

## [1.17.1] - 2026-02-21

### Changed

- Patch version bump for lint-only changes
- Resolve type-check errors in tests — add missing Dye properties, fix type-only imports, rename OklchWeights `L/C/H` → `kL/kC/kH`

## [1.17.0] - 2026-02-19

### Added

- **OPT-002**: Cache hit/miss/eviction/error metrics in `APIService`
  - New `CacheMetrics` interface exported from `@xivdyetools/core`
  - `getCacheStats()` now returns `{ size, keys, metrics }` with hit/miss/eviction/error counters
  - New `resetMetrics()` method to reset counters independently
  - `clearCache()` automatically resets metrics
  - Metrics are tracked per-instance and returned as a snapshot (copy, not reference)

---

## [1.16.0] - 2026-02-05

### Added

- **HARMONY-CS-001**: Color space selection for harmony generation
  - New `colorSpace` option in `HarmonyOptions`: `'hsv'` (default), `'oklch'`, `'lch'`, `'hsl'`
  - New `HarmonyColorSpace` exported type
  - Hue rotation is performed in the selected color space, producing perceptually different harmony results
  - Non-HSV spaces use k-d tree matching (O(log n)) instead of HSV-specific hue buckets
  - Complementary harmony uses 180° hue rotation in the selected space (instead of RGB inversion) for non-HSV modes
  - **OKLCH** (recommended): Perceptually uniform hue - equal angles produce equal perceptual differences
  - **LCH**: CIELCHab cylindrical perceptual space - traditional color science standard
  - **HSL**: Similar to HSV with different lightness mapping
  - Fully backward compatible: default behavior unchanged (`'hsv'`)
  - **Usage**: `dyeService.findTriadicDyes('#FF6B6B', { colorSpace: 'oklch' })`

---

## [1.15.4] - 2026-02-04

### Fixed

- **I18N-001**: Populated Korean and Chinese locale files with actual translated dye names
  - **Issue**: `ko.json` and `zh.json` contained English dye names due to XIVAPI v2 not serving Korean/Chinese item data
  - `build-locales.ts` silently fell back to English when locale columns were missing from CSV
  - **Korean (ko.json)**: All 125 dye names now use official Korean translations (e.g., "Snow White" → "하얀 눈색")
  - **Chinese (zh.json)**: All 125 dye names now use official Chinese translations (e.g., "Snow White" → "素雪白")
  - UI labels, categories, acquisitions, and other sections were already correctly translated
  - **Impact**: `/gradient`, `/dye info`, and all other commands now display localized dye names for Korean and Chinese users

---

## [1.15.3] - 2026-01-26

### Fixed

- **BUG-006**: Added missing required Dye fields to HarmonyGenerator test mocks
  - Added `stainID`, `isMetallic`, `isPastel`, `isDark`, `isCosmic` fields
  - Ensures type safety with strict TypeScript checking
  - Facewear dye mock correctly uses `stainID: null` per type definition

---

## [1.15.2] - 2026-01-25

### Added

- **OPT-001**: New `AsyncLRUCache` class for async-safe caching with request deduplication
  - Addresses the concurrency limitation documented in `LRUCache` warning
  - Uses pending promises Map pattern for request deduplication
  - Critical: Promise is stored synchronously before any await (race-safe)
  - Handles errors gracefully - removes from pending but doesn't cache failures
  - Includes `getOrCompute(key, compute)` method for async value computation
  - Includes `pendingSize` getter for monitoring in-flight operations
  - **Reference**: Security audit OPT-001 (2026-01-25)

---

## [1.15.1] - 2026-01-22

### Fixed

- **AUDIT-FINDING-001**: Replaced `console.warn()` calls with logger interface (Security)
  - **Issue**: Direct console output bypassed logger abstraction, leaked implementation details
  - **Severity**: LOW (CWE-532: Information Disclosure)
  - **Changes**:
    - `retry()` utility now accepts optional `logger` parameter
    - `DyeSearch` now uses injected logger from `DyeDatabase` instead of `console.warn()`
    - `APIService` passes logger to `retry()` function
    - Added `getLogger()` getter to `DyeDatabase` for service delegation
  - **Impact**: Consistent logging, configurable output, no information leakage in production
  - **Files Modified**:
    - `src/utils/index.ts` (retry function)
    - `src/services/dye/DyeDatabase.ts` (added logger getter)
    - `src/services/dye/DyeSearch.ts` (replaced 2 console.warn calls)
    - `src/services/APIService.ts` (pass logger to retry)
  - **Reference**: Security audit FINDING-001 (2026-01-22)

### Documentation

- **AUDIT-BUG-001**: Added concurrency limitation warning to `LRUCache` class
  - Documented potential race conditions when used in async contexts
  - Added warning about cache stampede (duplicate expensive computations)
  - Added warning about incorrect LRU ordering under concurrent access
  - Recommended mitigation strategies:
    - Use `lru-cache` npm package for high-concurrency scenarios
    - Implement request deduplication pattern (see `APIService.getPriceData`)
  - Updated inline comment to reference concurrency warning
  - **Impact**: No code changes, documentation-only update
  - **Rationale**: Current implementation is adequate for synchronous color conversion use case, but future async-heavy scenarios should be aware of limitations
  - **Reference**: Deep-dive analysis BUG-001 (2026-01-22)

---

## [1.15.0] - 2026-01-20

### Changed

- **Character Color Data Refactoring**: Split `character_colors.json` (779KB) into granular files for better performance
  - **New file structure**: `src/data/character_colors/` with organized subdirectories
    - `index.json` - Metadata and subrace manifest
    - `shared/` - 7 race-agnostic color files (eye, highlight, lip, tattoo, face paint)
    - `race_specific/` - 2 lazy-loaded files (hair_colors.json, skin_colors.json)
  - **Hybrid loading strategy**: Shared colors load synchronously, race-specific colors load on-demand
  - **Bundle size optimization**: Initial load reduced by ~87% (shared colors only ~108KB vs full 779KB)

### Breaking Changes

- **CharacterColorService API changes** - Race-specific methods are now async:
  - `getHairColors(subrace, gender)` → returns `Promise<CharacterColor[]>`
  - `getSkinColors(subrace, gender)` → returns `Promise<CharacterColor[]>`
  - `getRaceSpecificColors(category, subrace, gender)` → returns `Promise<CharacterColor[]>`
  - `getRaceSpecificColorByIndex(category, subrace, gender, index)` → returns `Promise<CharacterColor | null>`
  - All shared color methods remain synchronous (unchanged API)

### Added

- **New exports for tree-shaking**: Individual color data exports
  - `characterColorMeta`, `eyeColorsData`, `highlightColorsData`, `lipColorsDarkData`, `lipColorsLightData`
  - `tattooColorsData`, `facePaintDarkData`, `facePaintLightData`, `hairColorsData`, `skinColorsData`
- **`preloadRaceData()` method**: Preload race-specific data to avoid latency on first access
- **Promise deduplication**: Concurrent calls to lazy-loaded data share the same Promise

### Deprecated

- **`characterColorData` export**: Use `CharacterColorService` or individual exports instead

### Migration Guide

```typescript
// Before (sync)
const hairColors = characterColors.getHairColors('Midlander', 'Male');

// After (async)
const hairColors = await characterColors.getHairColors('Midlander', 'Male');

// Optional: Preload on app init to avoid first-access latency
await characterColors.preloadRaceData();
```

---

## [1.14.0] - 2026-01-19

### Fixed

- **CORE-BUG-001/002**: Fixed race condition in APIService request deduplication using deferred promise pattern to ensure map entry exists before any async operations
- **CORE-BUG-003**: Fixed KDTree `nearestNeighbor` skipping far side search when `best` was null (all nodes excluded). Now searches far side when no valid candidate found yet
- **CORE-BUG-004**: Made HSV validation required in DyeDatabase - previously optional validation allowed dyes without HSV to pass, causing crashes when accessing `dye.hsv.h` for hue bucket indexing

### Improved

- **CORE-REF-001**: Added `console.warn` logging for complete search failures in DyeSearch while documenting intentional silent handling for per-dye errors

### Refactored

- **CORE-REF-002**: Extracted duplicated price parsing logic (~65 lines) into shared `extractPriceFromApiItem()` helper function. Added `UniversalisItemResult` type for consistency. Price extraction priority (NQ only: DC → World → Region) now documented in single source of truth

---

## [1.13.0] - 2026-01-18

### Added

- **Configurable Color Matching Algorithms** (COLOR-MATCH-001)
  - New `MatchingMethod` type: `'rgb' | 'cie76' | 'ciede2000' | 'oklab' | 'hyab' | 'oklch-weighted'`
  - `ColorConverter.getDeltaE_Oklab(hex1, hex2)` - OKLAB Euclidean distance (recommended default)
  - `ColorConverter.getDeltaE_HyAB(hex1, hex2)` - HyAB hybrid algorithm (best for large color differences)
  - `ColorConverter.getDeltaE_OklchWeighted(hex1, hex2, weights?)` - OKLCH with customizable L/C/H weights
  - All algorithms accessible via unified `ColorConverter.getColorDistanceByMethod(hex1, hex2, method, weights?)`

- **DyeSearch Matching Method Support**
  - `findClosestDye(hex, options)` now accepts `matchingMethod` and `weights` options
  - `findDyesWithinDistance(hex, options)` now accepts `matchingMethod` and `weights` options
  - K-d tree used for candidate selection, then perceptual re-ranking for accurate results

- **DyeService Matching Method Proxy**
  - `findClosestDye(hex, options)` forwards matching method to DyeSearch
  - Backwards compatible: existing code continues to work

- **CharacterColorService Matching Method Support**
  - `findClosestDyes(hex, options)` now accepts `matchingMethod` for perceptual matching

- **New Types** (exported from `@xivdyetools/core`)
  - `MatchingMethod` - Union type for all supported algorithms
  - `OklchWeights` - Interface for custom L/C/H weight configuration
  - `MatchingConfig` - Combined config interface
  - `MATCHING_PRESETS` - Pre-configured weight presets for common use cases

- **New i18n Keys** (all 6 languages: EN, JA, DE, FR, KO, ZH)
  - `config.matchingMethod` - "Matching Algorithm"
  - `config.matchingOklab` / `config.matchingOklabDesc` - OKLAB descriptions
  - `config.matchingHyab` / `config.matchingHyabDesc` - HyAB descriptions
  - `config.matchingCiede2000` / `config.matchingCiede2000Desc` - CIEDE2000 descriptions
  - `config.matchingCie76` / `config.matchingCie76Desc` - CIE76 descriptions
  - `config.matchingRgb` / `config.matchingRgbDesc` - RGB descriptions

### Algorithm Comparison

| Algorithm | Best For | Speed | Perceptual Accuracy |
|-----------|----------|-------|---------------------|
| `rgb` | K-d tree optimization | Fastest | Low |
| `cie76` | Quick approximations | Fast | Fair |
| `ciede2000` | Industry standard | Medium | High |
| `oklab` | General use (recommended) | Fast | Very Good |
| `hyab` | Palette matching | Fast | Excellent for large Δ |
| `oklch-weighted` | Custom L/C/H priority | Fast | Configurable |

### Usage Example

```typescript
import { DyeService, type MatchingMethod } from '@xivdyetools/core';

const dyeService = new DyeService();

// Find closest dye using OKLAB (recommended)
const closest = dyeService.findClosestDye('#FF5733', { matchingMethod: 'oklab' });

// Find closest using HyAB (best for palette matching)
const paletteMatch = dyeService.findClosestDye('#FF5733', { matchingMethod: 'hyab' });

// Find with custom OKLCH weights (prioritize hue matching)
const hueMatch = dyeService.findClosestDye('#FF5733', {
  matchingMethod: 'oklch-weighted',
  weights: { lightness: 0.5, chroma: 1.0, hue: 2.0 }
});
```

---

## [1.11.0] - 2026-01-17

### Added

- **OKLAB/OKLCH Color Space Support**: Modern perceptually uniform color space (Björn Ottosson, 2020)
  - `ColorService.rgbToOklab(r, g, b)` / `ColorService.oklabToRgb(L, a, b)` - OKLAB conversions
  - `ColorService.hexToOklab(hex)` / `ColorService.oklabToHex(L, a, b)` - Hex ↔ OKLAB
  - `ColorService.rgbToOklch(r, g, b)` / `ColorService.oklchToRgb(L, C, h)` - OKLCH cylindrical form
  - `ColorService.hexToOklch(hex)` / `ColorService.oklchToHex(L, C, h)` - Hex ↔ OKLCH
  - `ColorService.mixColorsOklab(hex1, hex2, ratio)` - OKLAB perceptual mixing
  - `ColorService.mixColorsOklch(hex1, hex2, ratio, hueMethod)` - OKLCH with hue direction control
  - Fixes CIELAB's blue color distortion (Blue + Yellow = Green, not Pink)

- **LCH Color Space Support**: Cylindrical form of CIE LAB for hue-based operations
  - `ColorService.labToLch(L, a, b)` / `ColorService.lchToLab(L, C, h)` - LAB ↔ LCH
  - `ColorService.rgbToLch(r, g, b)` / `ColorService.lchToRgb(L, C, h)` - RGB ↔ LCH
  - `ColorService.hexToLch(hex)` / `ColorService.lchToHex(L, C, h)` - Hex ↔ LCH
  - `ColorService.mixColorsLch(hex1, hex2, ratio, hueMethod)` - LCH cylindrical mixing

- **HSL Color Space Support**: Hue-Saturation-Lightness common in design tools
  - `ColorService.rgbToHsl(r, g, b)` / `ColorService.hslToRgb(h, s, l)` - RGB ↔ HSL
  - `ColorService.hexToHsl(hex)` / `ColorService.hslToHex(h, s, l)` - Hex ↔ HSL
  - `ColorService.mixColorsHsl(hex1, hex2, ratio, hueMethod)` - HSL hue-based mixing

- **Spectral.js Integration**: Kubelka-Munk theory-based realistic paint mixing
  - `ColorService.mixColorsSpectral(hex1, hex2, ratio)` - Physics-based paint mixing
  - `ColorService.mixMultipleSpectral(colors, weights)` - Mix multiple colors
  - `ColorService.gradientSpectral(hex1, hex2, steps)` - Spectral gradient generation
  - `ColorService.isSpectralAvailable()` - Check if spectral.js is loaded
  - Blue + Yellow = Green (like real paint!)

- **Hue Interpolation Control**: For cylindrical color spaces
  - `ColorService.interpolateHue(h1, h2, ratio, method)` - 4 interpolation modes:
    - `'shorter'` (default): Take shorter arc around hue wheel
    - `'longer'`: Take longer arc
    - `'increasing'`: Always clockwise
    - `'decreasing'`: Always counter-clockwise

- **HSV Mixing**: Added for completeness
  - `ColorService.mixColorsHsv(hex1, hex2, ratio, hueMethod)` - HSV hue-based mixing

- **New Exported Types** (from `@xivdyetools/types`)
  - `OKLAB` - OKLAB color type with L (0-1), a, b components
  - `OKLCH` - OKLCH color type with L (0-1), C (chroma), h (hue 0-360)
  - `LCH` - LCH color type with L (0-100), C, h
  - `HSL` - HSL color type with h (0-360), s (0-100), l (0-100)

- **New i18n Keys**: Localization for all 6 languages (EN, JA, DE, FR, KO, ZH)
  - Gradient interpolation mode labels and descriptions
  - Mixing mode labels and descriptions

### Dependencies

- Added `spectral.js` for Kubelka-Munk spectral mixing (~8KB gzipped)
- Updated `@xivdyetools/types` to ^1.6.0

### Usage Example

```typescript
import { ColorService } from '@xivdyetools/core';

// OKLAB mixing - Blue + Yellow = Green (not pink like LAB!)
const mixed = ColorService.mixColorsOklab('#0000FF', '#FFFF00');

// Spectral mixing - Most realistic paint simulation
const paint = ColorService.mixColorsSpectral('#0000FF', '#FFFF00');

// OKLCH gradient with hue direction control
const oklch1 = ColorService.hexToOklch('#FF0000');
const oklch2 = ColorService.hexToOklch('#00FF00');
const midHue = ColorService.interpolateHue(oklch1.h, oklch2.h, 0.5, 'shorter');
```

---

## [1.10.0] - 2026-01-14

### Added

- **RYB Subtractive Color Mixing**: New service for paint-like color mixing using the Gossett-Chen algorithm
  - `RybColorMixer` class implementing trilinear interpolation in the RYB color cube
  - `ColorService.mixColorsRyb(hex1, hex2, ratio?)` - Mix colors like physical paints (Blue + Yellow = Green!)
  - `ColorService.rybToRgb(r, y, b)` - Convert RYB to RGB using trilinear interpolation
  - `ColorService.rgbToRyb(r, g, b)` - Convert RGB to RYB using Newton-Raphson approximation
  - `ColorService.hexToRyb(hex)` - Convert hex color to RYB
  - `ColorService.rybToHex(r, y, b)` - Convert RYB to hex color
  - Uses Gossett-Chen cube corner values for accurate paint mixing simulation:
    - Red + Yellow = Orange
    - Yellow + Blue = Green
    - Red + Blue = Violet

- **LAB to RGB Conversion**: Added reverse LAB conversion methods in `ColorConverter`
  - `ColorService.labToRgb(L, a, b)` - Convert CIE LAB to RGB
  - `ColorService.labToHex(L, a, b)` - Convert CIE LAB to hex color

- **New Exported Types**
  - `RYB` - RYB color type with `r`, `y`, `b` components (0-255)

### Technical Details

The RYB color mixing uses the algorithm from Gossett & Chen's 2006 paper "Paint Inspired Color Mixing and Compositing for Visualization":
- Forward transform (RYB→RGB): Trilinear interpolation in 3D color cube with 8 empirically-tuned corner values
- Reverse transform (RGB→RYB): Newton-Raphson iterative gradient descent approximation (no closed-form inverse exists)

### Usage Example

```typescript
import { ColorService } from '@xivdyetools/core';

// Mix blue and yellow like paint - produces green!
const mixed = ColorService.mixColorsRyb('#0000FF', '#FFFF00');
// Returns greenish color (not gray like RGB averaging)

// Custom mix ratio (0 = all hex1, 1 = all hex2)
const partialMix = ColorService.mixColorsRyb('#FF0000', '#FFFF00', 0.3);
// Returns orange-red (30% yellow)

// Direct RYB conversions
const ryb = ColorService.hexToRyb('#00FF00'); // Green in RYB space
const rgb = ColorService.rybToRgb(0, 255, 255); // Yellow+Blue = Green
```

---

## [1.9.0] - 2026-01-11

### Added

- **World ID Extraction**: APIService now extracts `worldId` from Universalis API responses
  - Identifies which world has the cheapest listing when fetching data center prices
  - Available in both single-item (`fetchPriceData`) and batch (`fetchBatchPriceData`) responses
  - Uses `minPriceListing.worldID` from Universalis aggregated response

### Changed

- Updated `@xivdyetools/types` dependency to ^1.5.0

---

## [1.8.0] - 2026-01-11

### Added

- **DeltaE-Based Harmony Matching**: Alternative perceptually-accurate algorithm for all harmony calculations
  - New `HarmonyOptions` interface with `algorithm`, `deltaEFormula`, and tolerance settings
  - `algorithm: 'hue'` (default) - existing fast hue-based matching
  - `algorithm: 'deltaE'` - perceptually accurate matching using LAB color space
  - `deltaEFormula: 'cie76'` (default) - fast Euclidean distance in LAB
  - `deltaEFormula: 'cie2000'` - industry-standard CIEDE2000 for highest accuracy
  - Pre-computed LAB values for all dyes (computed once during database initialization)
  - All harmony methods now accept optional `HarmonyOptions` parameter:
    - `findComplementaryPair()`, `findAnalogousDyes()`, `findTriadicDyes()`
    - `findSquareDyes()`, `findTetradicDyes()`, `findMonochromaticDyes()`
    - `findCompoundDyes()`, `findSplitComplementaryDyes()`, `findShadesDyes()`

- **LAB Color Conversion**: New methods in `ColorConverter`
  - `rgbToLab(r, g, b)` - Convert RGB to CIE LAB
  - `hexToLab(hex)` - Convert hex color to CIE LAB
  - LRU caching for LAB conversions (same pattern as other conversions)

- **DeltaE Calculations**: New methods in `ColorConverter`
  - `getDeltaE76(lab1, lab2)` - CIE76 formula (fast, Euclidean in LAB)
  - `getDeltaE2000(lab1, lab2)` - CIEDE2000 formula (accurate, industry standard)
  - `getDeltaE(hex1, hex2, formula?)` - Convenience method for hex colors

- **New Exported Types**
  - `HarmonyOptions` - Options for harmony generation algorithm selection
  - `HarmonyMatchingAlgorithm` - `'hue' | 'deltaE'`
  - `DeltaEFormula` - `'cie76' | 'cie2000'`
  - `LAB` - Re-exported from `@xivdyetools/types`

### Changed

- Updated `@xivdyetools/types` dependency to ^1.4.0
- `DyeInternal` interface now includes pre-computed `lab` field

### Usage Example

```typescript
import { DyeService, dyeDatabase } from '@xivdyetools/core';

const dyeService = new DyeService(dyeDatabase);

// Traditional hue-based matching (default, unchanged API)
const hueTriadic = dyeService.findTriadicDyes('#FF5733');

// DeltaE matching with CIE76 (fast)
const deltaETriadic = dyeService.findTriadicDyes('#FF5733', {
  algorithm: 'deltaE',
});

// DeltaE matching with CIEDE2000 (most accurate)
const accurateTriadic = dyeService.findTriadicDyes('#FF5733', {
  algorithm: 'deltaE',
  deltaEFormula: 'cie2000',
  deltaETolerance: 25,
});
```

---

## [1.7.0] - 2026-01-08

### Added

- **Character Color Service**: New service for accessing FFXIV character customization colors
  - `CharacterColorService` class provides access to all character creator color options
  - Shared colors: eye colors (192), highlight colors (192), lip colors (96 dark/96 light), tattoo colors (192), face paint colors (96 dark/96 light)
  - Race-specific colors: hair colors and skin colors for all 16 subraces × 2 genders (192 each)
  - Color matching: `findClosestDyes()`, `findClosestDye()`, `findDyesWithinDistance()` methods to find dyes matching character colors
  - Lookup methods: `getSharedColorByIndex()`, `getRaceSpecificColorByIndex()`
  - Metadata: `getVersion()`, `getGridColumns()`, `getAvailableSubraces()`

- **Character Color Data**: Added `character_colors.json` data file (779 KB)
  - Complete color palette data extracted from FFXIV character creator
  - 13,000+ color entries covering all character customization options

- **Character Type Exports**: Re-exported character types from `@xivdyetools/types` for convenience
  - `CharacterColor`, `CharacterColorMatch`, `SubRace`, `Gender`, `Race`
  - `RACE_SUBRACES`, `SUBRACE_TO_RACE`, `COLOR_GRID_DIMENSIONS` constants

### Changed

- Updated `@xivdyetools/types` dependency to ^1.3.0

---

## [1.6.0] - 2026-01-08

### Added

- **StainID Support**: Added `stainID` field to all dyes in the database
  - Each dye now includes `stainID: number | null` (1-125 for standard dyes, null for Facewear dyes)
  - StainID is the game's internal stain table ID from the Stain.exh data
  - New `dyeDatabase.getByStainId(stainId)` method for looking up dyes by stain ID
  - Useful for integration with tools that reference the game's internal stain IDs

### Changed

- Updated `@xivdyetools/types` dependency to ^1.2.0

---

## [1.5.6] - 2026-01-07

### Fixed

- **Localization**: Added missing metallic dye IDs to EN, DE, FR, JA locale files
  - Added Gunmetal Black (30122) and Pearl White (30123) to metallicDyeIds array
  - All 6 locale files now have consistent 16 metallic dye entries
  - Files now have consistent structure (233 lines each)

---

## [1.5.5] - 2026-01-05

### Security

#### Medium Priority Audit Fixes (2026-01-05 Security Audit)

- **MED-001**: Added input length validation before hex color regex
  - `isValidHexColor()` now checks string length before regex to prevent potential ReDoS
  - Maximum length of 7 characters (#RRGGBB format) enforced

- **MED-002**: Sanitized error messages in APIService
  - `fetchPriceData()` now logs detailed errors internally but provides sanitized messages to callers
  - Prevents exposing internal API structure or upstream error details to consumers

---

## [1.5.4] - 2025-12-24

### Changed

- Updated `@xivdyetools/types` to ^1.1.1 for Facewear dye ID support
- Updated `@xivdyetools/logger` to ^1.0.2 for improved log redaction patterns

---

## [1.5.3] - 2025-12-24

### Changed

#### Low Priority Audit Fixes

- **REEXP-001**: Added explicit v2.0.0 removal timeline to all deprecated re-exports
  - Updated 11 deprecation notices in `types/index.ts` to specify removal version
  - Helps consumers plan their migration to `@xivdyetools/types`

#### Medium Priority Audit Fixes

- **TYPES-001**: Extracted shared `LRUCache<K, V>` class to `utils/index.ts`
  - Consolidated duplicate implementations from `ColorConverter` and `ColorblindnessSimulator`
  - Generic implementation with configurable `maxSize` parameter
  - Provides O(1) get/set operations with automatic eviction

### Improved

- **INPUT-003**: Added warning logs when PaletteService clamps option values
  - Logs warning when `colorCount` is clamped to [1, 10] range
  - Logs warning when `maxIterations` is clamped to [1, 100] range
  - Helps developers understand when their values are being adjusted

### Performance

- **MEM-001**: Pre-computed lowercase name and category for search optimization
  - Added `DyeInternal` interface extending `Dye` with `nameLower` and `categoryLower` fields
  - Pre-computes lowercase values once during `DyeDatabase.initialize()` instead of on every search
  - Updated `DyeSearch.searchByName()`, `DyeSearch.searchByCategory()`, and `DyeService.searchByLocalizedName()`
  - Eliminates ~N×2 `toLowerCase()` calls per search operation (where N = dye count)

### Fixed

- **PERF-003**: Simplified `findClosestNonFacewearDye` in `HarmonyGenerator`
  - Removed redundant O(n²) loop that re-filtered already-filtered results
  - `DyeSearch.findClosestDye` already excludes Facewear dyes internally (CORE-BUG-005)
  - Method now delegates directly to `findClosestDye` for O(log n) performance

---

## [1.5.2] - 2025-12-24

### Fixed

#### Security Audit - High Priority Issues Resolved

- **INPUT-001**: Added validation to batch API URL builder
  - Validates array is not empty before building batch request URL
  - Limits batch size to 100 items (Universalis API recommendation)
  - Validates each item ID is a positive integer
  - Throws `AppError` with `INVALID_INPUT` code for invalid input

---

## [1.5.1] - 2025-12-16

### Added

- **APIService**: Added `baseUrl` option to `APIServiceOptions` for configurable Universalis API endpoint
- Exported `UNIVERSALIS_API_BASE` constant for reference

### Fixed

- **APIService**: Fixed constructor options detection to check for any known property (`cacheBackend`, `baseUrl`, `fetchClient`, `rateLimiter`, `logger`) instead of only `logger`, preventing issues when passing options without a logger

---

## [1.4.0] - 2025-12-14

### Added

- **Shared Package Integration**: Integrated `@xivdyetools/types` and `@xivdyetools/logger` as dependencies for ecosystem-wide type and logging consistency

### Changed

- **Package Rename**: Package renamed from `xivdyetools-core` to `@xivdyetools/core` for npm organization consistency

### Fixed

- **Security**: Prevented cache key collisions by adding type prefixes to cache keys
- **Performance**: Addressed HIGH severity performance audit findings
- **Color Handling**: Fixed hue normalization before caching to prevent cache thrashing (CORE-BUG-001)
- **Medium Severity**: Addressed MEDIUM severity audit findings

### Deprecated

#### Type Re-exports
The following re-exports from `@xivdyetools/core` are deprecated and will be removed in the next major version:

- **Logger Types**: Import from `@xivdyetools/logger/library` instead
- **Color Types** (RGB, HSV, HexColor, etc.): Import from `@xivdyetools/types` instead
- **Dye Types** (Dye, DyeDatabase, etc.): Import from `@xivdyetools/types` instead
- **Preset Types**: Import from `@xivdyetools/types` instead
- **Auth Types**: Import from `@xivdyetools/types` instead
- **API Types**: Import from `@xivdyetools/types` instead
- **Localization Types**: Import from `@xivdyetools/types` instead
- **Error Types**: Import from `@xivdyetools/types` instead
- **Utility Types** (Result, isOk, isErr): Import from `@xivdyetools/types` instead

**Migration Guide:**
```typescript
// Before (deprecated)
import { RGB, Dye, ErrorCode, NoOpLogger } from '@xivdyetools/core';

// After (recommended)
import type { RGB, Dye } from '@xivdyetools/types';
import { ErrorCode } from '@xivdyetools/types';
import { NoOpLogger } from '@xivdyetools/logger/library';
```

---

## [1.3.7] - 2025-12-08

### Added
- **PresetService Test Coverage**: Comprehensive test suite for `PresetService.ts` (0% → 100% coverage)
  - 64 new tests covering category operations, preset retrieval, search, random selection, and dye resolution
  - Tests for `getCategories`, `getCategoryMeta`, `getAllPresets`, `getPresetsByCategory`, `getPreset`
  - Tests for `getPresetCountByCategory`, `searchPresets`, `getPresetsByTag`, `getRandomPreset`
  - Tests for `getPresetWithDyes`, `resolvePresets`, metadata methods, and edge cases

- **TranslationProvider Test Coverage**: Added missing method tests
  - 21 new tests for `getJobName()` covering all 22 FFXIV jobs (tanks, healers, melee/ranged/caster DPS)
  - Tests for `getGrandCompanyName()` covering all 3 Grand Companies
  - Japanese localization tests for job names and Grand Company names

- **DyeDatabase Test Coverage**: Significant coverage improvements (84% → 100% lines)
  - 35+ new tests for prototype pollution protection (`__proto__`, `constructor`, `prototype` filtering)
  - Dye validation tests for invalid name, hex, RGB, HSV, and category values
  - Facewear dye synthetic ID generation tests
  - Price-to-cost field mapping tests
  - Logger integration tests
  - Edge case tests for null/undefined values

### Changed
- Overall project test coverage improved to 97.92% statements
- 1256+ total tests across the entire test suite

---

## [1.3.6] - 2025-12-07

### Added
- **CommunityPreset Types**: TypeScript types for community preset API integration
  - `PresetStatus`: pending | approved | rejected | flagged
  - `CommunityPreset`: Full preset with voting and moderation data
  - `PresetSubmission`: Data required to submit a new preset
  - `PresetListResponse`, `PresetSubmitResponse`, `VoteResponse`, `PresetFilters`
- **Facewear Filtering**: Native exclusion of Facewear dyes in harmony functions
  - `findComplementaryPair` now excludes Facewear dyes
  - `findMonochromaticDyes` now excludes Facewear dyes
  - `findClosestNonFacewearDye` helper method for explicit filtering

---

## [1.3.5] - 2025-12-05

### Added
- **PaletteService**: New service for multi-color palette extraction from images
  - K-means++ clustering algorithm for accurate dominant color detection
  - `extractPalette(pixels, options)` - Extract N dominant colors with dominance percentages
  - `extractAndMatchPalette(pixels, dyeService, options)` - Extract and match to closest FFXIV dyes
  - Configurable: `colorCount` (3-5), `maxIterations`, `convergenceThreshold`, `maxSamples`
  - Helper functions: `pixelDataToRGB()`, `pixelDataToRGBFiltered()` for Canvas data conversion

### Usage Example
```typescript
import { PaletteService, DyeService, dyeDatabase } from 'xivdyetools-core';

const paletteService = new PaletteService();
const dyeService = new DyeService(dyeDatabase);

// Extract from Canvas ImageData
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const pixels = PaletteService.pixelDataToRGBFiltered(imageData.data);

// Get palette with matched dyes
const matches = paletteService.extractAndMatchPalette(pixels, dyeService, {
  colorCount: 4,
  maxIterations: 25
});

// Each match includes: extracted, matchedDye, distance, dominance
```

---

## [1.3.2] - 2025-12-04

### Added
- **Logger Test Coverage**: Comprehensive test suite for `logger.ts` (25% → 100% coverage)
  - 23 new tests covering `NoOpLogger`, `ConsoleLogger`, and custom `Logger` implementations
  - Tests for all log levels (info, warn, error, debug)
  - Branch coverage for error handling with and without error objects
  - Validation of Logger interface contract

## [1.3.1] - 2025-12-02

### Fixed
- **Security**: Added prototype pollution protection in `DyeDatabase.initialize()` for untrusted data sources
- **Data Integrity**: Fixed `price` vs `cost` field mismatch - JSON data uses `price` but `Dye` interface expects `cost`
- **Memory**: Removed duplicate ID mapping in `DyeDatabase` - now only maps `itemID` separately if it differs from `id`
- **Concurrency**: Fixed race condition in singleton patterns by using eager initialization for `ColorConverter` and `LocalizationService`
- **Integer Operations**: Fixed `generateChecksum` to use proper 32-bit integer conversion (`|0` instead of `&hash`)
- **Color Manipulation**: Fixed negative hue values in `rotateHue` - now properly normalizes to 0-360 range
- **Floating Point**: Consistent rounding strategy in `ColorConverter` between `rgbToHsv` and `hsvToRgb`
- **Tests**: Fixed Point3D typo in `kd-tree.test.ts` (`b` → `z`)

### Added
- **Logger Interface**: Injectable `Logger` interface with `NoOpLogger` (default) and `ConsoleLogger` implementations
- **Dye Validation**: Runtime validation for dye data with `isValidDye()` method
- **Test Isolation**: `LocalizationService.resetInstance()` for preventing test pollution
- **AbortError Detection**: `isAbortError()` utility function for timeout error handling in retry logic
- **Documentation**: Comprehensive `docs/ERROR_HANDLING.md` guide for error handling patterns

### Changed
- **API Retry**: `retry()` now includes AbortError/TimeoutError in retry loop for transient network issues
- **Harmony Methods**: Documented that `findTriadicDyes`, `findSquareDyes`, `findTetradicDyes` may return fewer results than expected
- **VERSION Sync**: VERSION constant now auto-generated from package.json during build

## [1.3.0] - 2025-12-01

### Added
- **Dye Type Flags**: Added locale-independent type flags to `Dye` interface for filtering
  - `isMetallic`: Identifies metallic dyes (14 dyes)
  - `isPastel`: Identifies pastel dyes (4 dyes)
  - `isDark`: Identifies dark dyes (5 dyes)
  - `isCosmic`: Identifies cosmic dyes from Cosmic Exploration/Fortunes (20 dyes)
  - Enables filtering by dye type regardless of user's language setting
  - All 136 dyes in `colors_xiv.json` now include these boolean flags

### Changed
- **Breaking Change**: `Dye` interface now requires four additional boolean properties
  - Applications using this package must update to handle the new properties
  - Existing code will continue to work but TypeScript will show type errors until updated

## [1.2.5] - 2025-11-30

### Fixed
- **Metallic Dyes**: Added "Gunmetal Black" (30122) and "Pearl White" (30123) to `metallicDyeIds` list in all locales.

## [1.2.4] - 2025-11-30

### Fixed
- **Japanese Locale**: Removed trailing colon from `labels.dye` ("カララント:" → "カララント")
- **Korean Locale**: Corrected Venture Coffers translation ("모험 보물상자" → "집사의 보물상자" - official term)

### Added
- **Localization Reference Documentation**: New `docs/LOCALIZATION_REFERENCE.md` with verified official FFXIV terms
  - Official translations for Dye, Market Board, Dark, Pastel, Metallic across all 6 languages
  - Cosmic Exploration and Cosmic Fortunes translations
  - Venture Coffers translations (verified against official sources)
  - Allied Society Vendors (Beast Tribe Vendors) translations
  - Beast tribe names (Ixali, Sylph, Kobold, Amalj'aa, Sahagin)
  - Dye name format pattern documentation
- **Scrape Comparison Script**: New `scripts/compare-scrapes.js` for validating locale data against scraped sources

---

## [1.2.3] - 2025-11-28

### Added
- **Comprehensive Branch Coverage Testing**: Improved test coverage from ~85% to 95.8% branch coverage
  - **types/index.ts**: Added 66 new tests for branded type helpers (`createHexColor`, `createDyeId`, `createHue`, `createSaturation`) and `AppError` class (41.66% → 100%)
  - **DyeSearch.ts**: Added linear search fallback tests for when k-d tree is unavailable (74.5% → 98.03%)
  - **APIService.ts**: Added tests for oversized response handling, JSON parse errors, health check failures, worldID cache keys (84% → 93%)
  - **LocaleLoader.ts**: Added `isValidLocaleData` direct tests and mocked validation failure tests (84.21% → 94.73%)
  - **ColorblindnessSimulator.ts**: Added LRU cache eviction tests (73.33% → 86.66%)

### Changed
- All 17 source files now meet or approach 90%+ branch coverage target
- 1095 total tests across the entire test suite

---

## [1.2.2] - 2025-11-28

### Fixed
- **Locale File Updates**: Additional translation keys and refinements
  - Added missing harmony type descriptions
  - Updated category labels for consistency across all 6 locales
  - Minor translation corrections in Japanese, German, French locale files

---

## [1.2.0] - 2025-11-27

### Added
- **Chinese (zh) Localization**: Full Chinese translation support
  - All 125 dye names translated
  - UI labels, categories, acquisitions, harmony types, vision types
- **Korean (ko) Localization**: Full Korean translation support
  - All 125 dye names translated
  - UI labels, categories, acquisitions, harmony types, vision types
- **Expanded `LocaleCode` type**: Now includes `'ko'` and `'zh'` in addition to `'en'`, `'ja'`, `'de'`, `'fr'`
- **6 supported locales**: English, Japanese, German, French, Korean, Chinese

### Changed
- `SUPPORTED_LOCALES` array now contains 6 locales
- Updated tests to reflect new supported locales

---

## [1.1.2] - 2025-11-27

### Fixed
- **Locale files missing from npm package**: Added `copy:locales` build step to copy locale JSON files to `dist/data/locales/`
  - TypeScript's `tsc` only copies statically imported JSON files
  - Dynamic imports (used for locale code-splitting) require manual copy
  - Build now runs: `build:locales` → `tsc` → `copy:locales`

---

## [1.1.1] - 2025-11-27

### Added
- **Comprehensive Test Coverage**: Achieved 93%+ overall test coverage
  - **ColorService Tests**: 41 tests covering all facade delegation methods
  - **DyeService Tests**: 50 tests covering database access, search/filter, harmony generation, localization
  - **LocalizationService Tests**: Enhanced static API tests for 100% coverage
  - **Utils Tests**: 93 tests for all utility functions (clamp, lerp, validation, async helpers)
  - **882 total tests** across the entire test suite

### Changed
- **Test Quality Improvements**
  - Static API tests now actually call methods instead of just checking `typeof`
  - Harmony tests use flexible expectations for limited sample data scenarios
  - Retry utility tests use real timers for more reliable async behavior

### Fixed
- Test assertions for color brightness comparisons use `toBeLessThanOrEqual`
- Harmony generation tests handle variable result counts from limited dye datasets

---

## [1.1.0] - 2025-11-23

### Added
- **Performance Optimizations**
  - **LRU Caching**: Added LRU cache for color conversions (60-80% speedup)
    - Caches hex→RGB, RGB→HSV, HSV→RGB, hex→HSV, RGB→hex conversions
    - Caches colorblindness simulation results
    - Cache statistics and clearing methods
  - **Hue-Indexed Harmony Lookups**: 70-90% faster harmony generation
    - Hue bucket indexing (10° buckets, 36 total)
    - Optimized color wheel queries
  - **k-d Tree Implementation**: 10-20x speedup for color matching
    - Custom 3D RGB color space k-d tree
    - O(log n) average case vs O(n) linear search
    - Fast nearest neighbor and range queries

- **Type Safety**
  - **Branded Types**: Enhanced type safety with branded types
    - `HexColor`, `DyeId`, `Hue`, `Saturation` branded types
    - Factory functions with validation (`createHexColor`, `createDyeId`)

- **Service Architecture**
  - **Service Class Splitting**: Split services into focused classes
    - `ColorConverter`: Format conversions (hex ↔ RGB ↔ HSV)
    - `ColorblindnessSimulator`: Colorblindness simulation
    - `ColorAccessibility`: WCAG contrast, luminance calculations
    - `ColorManipulator`: Brightness, saturation, hue rotation
    - `DyeDatabase`: Database loading, indexing, data access
    - `DyeSearch`: Search and matching operations
    - `HarmonyGenerator`: Color harmony generation
  - Maintained backward compatibility with facade classes

- **Testing & Documentation**
  - **Integration Tests**: Comprehensive integration test suite
    - Harmony workflow tests
    - Color conversion pipeline tests
    - Dye matching workflow tests
    - End-to-end workflow tests
    - Performance benchmarks
  - **API Documentation**: TypeDoc generation configured
  - **Algorithm Documentation**: k-d tree algorithm documented

### Changed
- **Performance Improvements**
  - Color conversion operations now use LRU caching
  - Harmony generation uses hue-indexed lookups
  - Dye matching uses k-d tree for spatial indexing
  - Optimized RGB→HSV conversion (single-pass min/max)

- **Code Quality**
  - TypeScript strict mode enabled
  - ESLint and Prettier configured
  - Pre-commit hooks for code quality
  - Improved code organization and maintainability

### Performance
- **Color Conversions**: < 0.05ms per conversion (target: < 0.1ms) ✅
- **Dye Matching**: < 2ms per match (target: < 3ms) ✅
- **Harmony Generation**: < 15ms per harmony (target: < 20ms) ✅
- **Cache Hit Rate**: > 60% ✅

### Security
- **Dependency Scanning**: 0 high/critical vulnerabilities ✅
- All dependencies up to date

### Documentation
- Complete API documentation (TypeDoc)
- Algorithm documentation (k-d tree)
- Testing strategy documentation

---

## [1.0.2] - Previous Release

Initial stable release with core color algorithms and dye database functionality.










