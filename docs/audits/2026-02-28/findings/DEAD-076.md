# DEAD-076: @xivdyetools/svg — 42 Unused Barrel Exports (Base Primitives + Helper Types)

## Category
Unused Exports

## Location
- File(s): `packages/svg/src/index.ts` (barrel), `packages/svg/src/base.ts`, and various generator files
- Symbol(s): 42 symbols — see full list below

## Evidence
Cross-referenced every import of `@xivdyetools/svg` across the monorepo. Of ~60 exported symbols, only 18 are consumed externally.

### Consumed Externally (18)
`generateHarmonyWheel`, `HarmonyDye`, `generateGradientBar`, `GradientStep`, `generatePaletteGrid`, `PaletteEntry`, `PaletteGridLabels`, `generateAccessibilityComparison`, `VisionType`, `generateContrastMatrix`, `ContrastDye`, `generateRandomDyesGrid`, `RandomDyeInfo`, `generateComparisonGrid`, `generateDyeInfoCard`, `generatePresetSwatch`, `generateBudgetComparison`, `BudgetSvgLabels`

### Unconsumed Externally (42)

**Base primitives (internal building blocks):**
`escapeXml`, `hexToRgb`, `rgbToHex`, `getLuminance`, `getContrastTextColor`, `createSvgDocument`, `rect`, `circle`, `line`, `text`, `arcPath`, `group`, `truncateText`, `estimateTextWidth`, `THEME`, `FONTS`

**Options/config types (consumers infer or don't need):**
`HarmonyWheelOptions`, `GradientBarOptions`, `PaletteGridOptions`, `AccessibilityComparisonOptions`, `ContrastMatrixOptions`, `RandomDyesGridOptions`, `ComparisonGridOptions`, `DyeInfoCardOptions`, `PresetSwatchOptions`, `BudgetComparisonOptions`

**Auxiliary types:**
`MatchQuality`, `AllVisionTypes`, `ContrastResult`, `WCAGLevel`, `DyePriceData`, `BudgetSuggestion`, `BudgetSortOption`

**Auxiliary functions:**
`interpolateColor`, `generateGradientColors`, `getMatchQuality`, `MATCH_QUALITIES`, `generateCompactAccessibilityRow`, `calculateContrast`, `generateCompactPresetSwatch`, `CATEGORY_DISPLAY`, `generateNoWorldSetSvg`, `generateErrorSvg`, `formatGil`

## Why It Exists
The base primitives (`rect`, `circle`, `text`, etc.) are the building blocks used internally by all generator functions. They were exported to enable custom SVG composition. Options types document the full API of each generator.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — base primitives are clearly internal; options types are API documentation |
| **Blast Radius** | LOW — barrel-only changes |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | og-worker, web-app, or future apps could use base primitives for custom SVGs |

## Recommendation
**KEEP WITH ANNOTATION** — Mark base primitives as `@internal` in JSDoc

### Rationale
- The base primitives are exported for composability but consumption is 100% internal today. Marking them `@internal` signals they're not part of the stable public API
- Options types serve as documentation for generator functions — removing them would degrade DX
- The auxiliary generators (`generateCompactAccessibilityRow`, `generateCompactPresetSwatch`, `generateNoWorldSetSvg`, `generateErrorSvg`) are legitimate API that may be consumed in the future
- `formatGil` is a utility that could be useful to bot-logic or discord-worker
- Total package is ~3,800 source lines; the exports add minimal overhead
- No internal dead code detected — all exported functions have valid implementations

### Action Items
1. Add `@internal` JSDoc tags to base primitives: `escapeXml`, `hexToRgb`, `rgbToHex`, `getLuminance`, `getContrastTextColor`, `createSvgDocument`, `rect`, `circle`, `line`, `text`, `arcPath`, `group`, `truncateText`, `estimateTextWidth`, `THEME`, `FONTS`
2. Consider splitting `index.ts` into `index.ts` (generators only) and `primitives.ts` (base utilities) in a future version
