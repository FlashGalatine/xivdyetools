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
  truncateText,
  estimateTextWidth,
  rgbToHsv,
  THEME,
  FONTS,
  ACCENT,
  NUMFMT,
  num,
  grp,
  DEFAULT_DISPLAY_OPTIONS,
} from './base.js';
export type { DisplayOptions } from './base.js';

// 5.0 bot card frame system (Turn-11 vocabulary)
export {
  CARD_WIDTH,
  CARD_MAX_HEIGHT,
  CARD_TYPE,
  ROW_CAP,
  HARMONY_ROW_CAP,
  CARD_DARK,
  CARD_LIGHT,
  cardTheme,
  cardShell,
  cardText,
  textWidth,
  fitText,
  commandChip,
  placeGlyph,
  appIcon,
  markFooter,
  swatch,
  idealSwatch,
  dashedRule,
  hairline,
  measuredRow,
} from './frame.js';
export type {
  CardTheme,
  CardTextOptions,
  CommandChipOptions,
  MeasuredRowOptions,
  MeasuredRowWidths,
} from './frame.js';

// Harmony Card (11A — replaces the retired harmony wheel)
export { generateHarmonyCard } from './harmony-card.js';
export type {
  HarmonyCardSlot,
  HarmonyCardLabels,
  HarmonyCardOptions,
} from './harmony-card.js';

// Gradient Card (12H·2/·3/·4 — strip over distinct dyes)
export {
  generateGradientCard,
  interpolateColor,
  generateGradientColors,
} from './gradient.js';
export type {
  GradientStripCell,
  GradientRowEntry,
  GradientCardOptions,
} from './gradient.js';

// Mixer Card (12F — the ratio sweep, the command's first image)
export { generateMixerCard } from './mixer-card.js';
export type { MixerCardRow, MixerCardOptions } from './mixer-card.js';

// Palette Grid (14K ramp — /extractor image)
export { generatePaletteGrid, bandSlices } from './palette-grid.js';
export type {
  PaletteBandEntry,
  PaletteRowEntry,
  PaletteGridOptions,
  PaletteGridLabels,
} from './palette-grid.js';

// Nearest Sheet (14J·2 — /extractor color)
export { generateNearestSheet } from './nearest-sheet.js';
export type {
  NearestSheetRow,
  NearestSheetLabels,
  NearestSheetOptions,
} from './nearest-sheet.js';

// Accessibility / Colorblind Comparison
export {
  generateAccessibilityComparison,
} from './accessibility-comparison.js';
export type {
  AccessibilityComparisonOptions,
  VisionType,
  AllVisionTypes,
  VisionLabels,
} from './accessibility-comparison.js';

// WCAG Contrast Matrix
export { generateContrastMatrix, calculateContrast } from './contrast-matrix.js';
export type {
  ContrastDye,
  ContrastMatrixOptions,
  ContrastResult,
  WCAGLevel,
} from './contrast-matrix.js';

// Random Dyes Grid (11B table)
export { generateRandomDyesGrid } from './random-dyes-grid.js';
export type { RandomDyeRow, RandomGridLabels, RandomDyesGridOptions } from './random-dyes-grid.js';

// Dye Comparison Grid
export { generateComparisonGrid } from './comparison-grid.js';
export type { ComparisonGridOptions } from './comparison-grid.js';

// Dye Info Card (11B sheet)
export { generateDyeInfoCard } from './dye-info-card.js';
export type { DyeInfoCardOptions, DyeInfoLabels, NearestDyeInfo } from './dye-info-card.js';

// Preset Swatch
export {
  generatePresetSwatch,
  CATEGORY_DISPLAY,
} from './preset-swatch.js';
export type { PresetSwatchOptions } from './preset-swatch.js';

// Budget Comparison
export {
  generateBudgetComparison,
  formatGil,
} from './budget-comparison.js';
export type {
  DyePriceData,
  BudgetSuggestion,
  BudgetSortOption,
  BudgetSvgLabels,
  BudgetComparisonOptions,
} from './budget-comparison.js';

// 5.0 icon system (single geometry home — web apps consume via shims)
export {
  toolGlyph,
  harmonyGlyph,
  chromeGlyph,
  panelGlyph,
  categoryGlyph,
  GLYPH_SETS,
  GLYPH_ACCENT_DARK,
  GLYPH_ACCENT_LIGHT,
} from './icons/tool-icons.js';
export type {
  ToolGlyphName,
  HarmonyGlyphName,
  ChromeGlyphName,
  PanelGlyphName,
  CategoryGlyphName,
  GlyphRenderOptions,
} from './icons/tool-icons.js';
