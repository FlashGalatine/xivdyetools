# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-21

### Added

- Comprehensive test suite — 193 tests across 10 files covering input resolution, CSS colors, localization, and all 8 commands
- **REFACTOR-001**: New `color-math.ts` shared utility module with `getColorDistance()` delegating to `ColorService.getColorDistance()` from core
- **REFACTOR-002**: New `getMatchQualityInfo()` with consistent tiers and i18n key lookup, plus 9-test suite

### Changed

- **REFACTOR-001**: Consolidate duplicated `getColorDistance()` across match, mixer, and gradient commands into shared `color-math.ts`
- **REFACTOR-002**: Consolidate duplicated match quality thresholds across match, mixer, and gradient commands into shared `getMatchQualityInfo()`

## [1.0.0] - 2026-02-18

### Added

- Extracted platform-agnostic command logic from the Discord worker into a shared package
- `executeDyeInfo` — dye info card generation (SVG + embed data)
- `executeRandom` — random dyes grid generation
- `executeHarmony` — color harmony wheel with 7 harmony types
- `executeGradient` — gradient bar between two colors with configurable interpolation
- `executeMixer` — color blending with 6 modes (RGB, LAB, OKLAB, RYB, HSL, Spectral)
- `executeMatch` — find closest dyes to a target color
- `executeComparison` — side-by-side dye comparison grid
- `executeAccessibility` — colorblind simulation + WCAG contrast matrix
- Input resolution: `resolveColorInput`, `resolveDyeInput`, `isValidHex`, `normalizeHex`
- CSS color name resolution (148 standard CSS colors)
- Localization helpers: `initializeLocale`, `getLocalizedDyeName`, `getLocalizedCategory`
- Shared `EmbedData` / `EmbedField` types for platform-agnostic embed construction
- All commands return discriminated unions (`{ ok: true; ... } | { ok: false; error; errorMessage }`)

---

[1.0.0]: https://github.com/FlashGalatine/xivdyetools/releases/tag/bot-logic-v1.0.0
