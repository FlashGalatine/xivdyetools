/**
 * @xivdyetools/svg
 *
 * SVG card generators for XIV Dye Tools.
 * All functions are pure: data in → SVG string out.
 * Rendering to PNG (via resvg-wasm, etc.) is handled by each consuming app.
 *
 * @module svg
 */

// Base utilities & primitives
export {
  escapeXml,
  hexToRgb,
  rgbToHex,
  getLuminance,
  getContrastTextColor,
  createSvgDocument,
  rect,
  circle,
  line,
  text,
  arcPath,
  group,
  THEME,
  FONTS,
} from './base.js';

// Harmony Wheel
export { generateHarmonyWheel } from './harmony-wheel.js';
export type { HarmonyDye, HarmonyWheelOptions } from './harmony-wheel.js';

// Gradient Bar
export {
  generateGradientBar,
  interpolateColor,
  generateGradientColors,
} from './gradient.js';
export type { GradientStep, GradientBarOptions } from './gradient.js';

// Palette Grid (color extraction match results)
export {
  generatePaletteGrid,
  getMatchQuality,
  MATCH_QUALITIES,
} from './palette-grid.js';
export type {
  PaletteEntry,
  PaletteGridOptions,
  PaletteGridLabels,
  MatchQuality,
} from './palette-grid.js';

// Accessibility / Colorblind Comparison
export {
  generateAccessibilityComparison,
  generateCompactAccessibilityRow,
} from './accessibility-comparison.js';
export type {
  AccessibilityComparisonOptions,
  VisionType,
  AllVisionTypes,
} from './accessibility-comparison.js';

// WCAG Contrast Matrix
export { generateContrastMatrix, calculateContrast } from './contrast-matrix.js';
export type {
  ContrastDye,
  ContrastMatrixOptions,
  ContrastResult,
  WCAGLevel,
} from './contrast-matrix.js';

// Random Dyes Grid
export { generateRandomDyesGrid } from './random-dyes-grid.js';
export type { RandomDyeInfo, RandomDyesGridOptions } from './random-dyes-grid.js';

// Dye Comparison Grid
export { generateComparisonGrid } from './comparison-grid.js';
export type { ComparisonGridOptions } from './comparison-grid.js';

// Dye Info Card
export { generateDyeInfoCard } from './dye-info-card.js';
export type { DyeInfoCardOptions } from './dye-info-card.js';

// Preset Swatch
export {
  generatePresetSwatch,
  generateCompactPresetSwatch,
  CATEGORY_DISPLAY,
} from './preset-swatch.js';
export type { PresetSwatchOptions } from './preset-swatch.js';

// Budget Comparison
export {
  generateBudgetComparison,
  generateNoWorldSetSvg,
  generateErrorSvg,
  formatGil,
} from './budget-comparison.js';
export type {
  DyePriceData,
  BudgetSuggestion,
  BudgetSortOption,
  BudgetSvgLabels,
  BudgetComparisonOptions,
} from './budget-comparison.js';
