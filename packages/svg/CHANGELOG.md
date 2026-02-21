# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-21

### Added

- **REFACTOR-005**: New `truncateText()` and `estimateTextWidth()` shared utilities in `base.ts` with 11-test suite

### Fixed

- **BUG-012**: Fix CJK badge width miscalculation in dye-info-card — use `estimateTextWidth()` to account for full-width CJK characters in category badges
- **BUG-001**: Remove double XML escaping across 7 SVG generators — `escapeXml()` was called on values already escaped by tagged template literals, producing `&amp;amp;` in output

### Changed

- **REFACTOR-001**: Replace local `getColorDistance()` in `comparison-grid.ts` with `ColorService.getColorDistance()` from core
- **REFACTOR-005**: Standardize text truncation across all SVG generators — replace 3 inconsistent ellipsis styles with shared `truncateText()` utility using Unicode ellipsis

## [1.0.1] - 2026-02-21

### Changed

- Patch version bump for lint-only changes

## [1.0.0] - 2026-02-18

### Added

- Extracted SVG generators from the Discord worker into a shared package
- **Card generators:**
  - `generateDyeInfoCard` — single dye info card with color values (HEX, RGB, HSV, LAB)
  - `generateRandomDyesGrid` — grid of randomly selected dyes
  - `generateComparisonGrid` — side-by-side dye comparison
  - `generatePresetSwatch` — full preset swatch with all dye slots
  - `generateCompactPresetSwatch` — compact single-row preset swatch
- **Color tool generators:**
  - `generateHarmonyWheel` — color harmony wheel SVG
  - `generateGradientBar` — gradient bar with labeled steps
  - `generatePaletteGrid` — color match palette grid with quality labels
  - `generateAccessibilityComparison` — colorblind simulation comparison
  - `generateCompactAccessibilityRow` — compact accessibility view
  - `generateContrastMatrix` — WCAG contrast ratio matrix
  - `generateBudgetComparison` — market price comparison chart
- **Utility generators:**
  - `generateErrorSvg` — generic error message SVG
  - `generateNoWorldSetSvg` — "no world set" prompt SVG
- SVG primitive builders: `rect`, `circle`, `line`, `text`, `arcPath`, `group`, `createSvgDocument`
- Color utilities: `hexToRgb`, `rgbToHex`, `getLuminance`, `getContrastTextColor`, `escapeXml`
- Gradient utilities: `interpolateColor`, `generateGradientColors`
- Contrast utilities: `calculateContrast`, `getMatchQuality`
- Budget formatting: `formatGil`
- Shared constants: `THEME`, `FONTS`, `MATCH_QUALITIES`, `CATEGORY_DISPLAY`

---

[1.0.0]: https://github.com/FlashGalatine/xivdyetools/releases/tag/svg-v1.0.0
