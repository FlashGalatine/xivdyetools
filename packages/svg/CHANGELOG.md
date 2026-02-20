# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
