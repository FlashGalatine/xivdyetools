/**
 * @xivdyetools/svg
 *
 * SVG card generators for XIV Dye Tools.
 * All functions are pure: data in → SVG string out.
 * Rendering to PNG (via resvg-wasm, etc.) is handled by each consuming app.
 *
 * @module svg
 */

// @xivdyetools/svg — public barrel.
//
// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see the package CLAUDE.md.

// Base utilities & primitives
export {
  escapeXml,
  hexToRgb,
  /** @public */
  getLuminance,
  /** @public */
  getContrastTextColor,
  createSvgDocument,
  /** @public */
  rect,
  /** @public */
  circle,
  /** @public */
  line,
  /** @public */
  text,
  /** @public */
  group,
  estimateTextWidth,
  THEME,
  FONTS,
  /** @public */
  ACCENT,
  /** @public */
  NUMFMT,
  num,
  grp,
} from './base.js';

// 5.0 bot card frame system (Turn-11 vocabulary)
export {
  CARD_WIDTH,
  CARD_MAX_HEIGHT,
  /** @public */
  CARD_TYPE,
  ROW_CAP,
  /** @public */
  HARMONY_ROW_CAP,
  CARD_DARK,
  CARD_LIGHT,
  cardTheme,
  /** @public */
  cardShell,
  /** @public */
  cardText,
  /** @public */
  textWidth,
  /** @public */
  fitText,
  /** @public */
  commandChip,
  /** @public */
  appIcon,
  /** @public */
  markFooter,
  /** @public */
  swatch,
  /** @public */
  idealSwatch,
  /** @public */
  dashedRule,
  /** @public */
  hairline,
  measuredRow,
  bandInk,
} from './frame.js';
export type {
  /** @public */
  CardTheme,
  /** @public */
  CardTextOptions,
  /** @public */
  CommandChipOptions,
  /** @public */
  MeasuredLead,
  /** @public */
  MeasuredRowOptions,
  /** @public */
  MeasuredRowWidths,
} from './frame.js';

// Harmony Card (11A — replaces the retired harmony wheel)
export { generateHarmonyCard } from './harmony-card.js';
export type {
  HarmonyCardSlot,
  /** @public */ HarmonyCardLabels,
  /** @public */ HarmonyCardOptions,
} from './harmony-card.js';

// Gradient Card (12H·2/·3/·4 — strip over distinct dyes)
export { generateGradientCard } from './gradient.js';
export type {
  GradientStripCell,
  GradientRowEntry,
  /** @public */ GradientCardOptions,
} from './gradient.js';

// Mixer Card (12F — the ratio sweep, the command's first image)
export { generateMixerCard } from './mixer-card.js';
export type { MixerCardRow, /** @public */ MixerCardOptions } from './mixer-card.js';

// Palette Grid (14K ramp — /extractor image)
export { generatePaletteGrid } from './palette-grid.js';
export type {
  /** @public */
  PaletteBandEntry,
  /** @public */
  PaletteRowEntry,
  /** @public */
  PaletteGridOptions,
  /** @public */
  PaletteGridLabels,
} from './palette-grid.js';

// Nearest Sheet (14J·2 — /extractor color)
export { generateNearestSheet } from './nearest-sheet.js';
export type {
  NearestSheetRow,
  /** @public */ NearestSheetLabels,
  /** @public */ NearestSheetOptions,
} from './nearest-sheet.js';

// Accessibility card (13D/13E/13H — the vision: option chooses the frame)
export { generateA11yCard } from './a11y-card.js';
export type {
  /** @public */ A11yCardOptions,
  /** @public */ A11yCardLabels,
  A11yLensRow,
  VisionType,
} from './a11y-card.js';

// Contrast card (13A/13B/13C·1 — the pair count routes the frame)
export { generateContrastCard, contrastRatio } from './contrast-card.js';
export type {
  ContrastPair,
  /** @public */ ContrastCardLabels,
  /** @public */ ContrastCardOptions,
} from './contrast-card.js';

// Random Dyes Grid (11B table)
export { generateRandomDyesGrid } from './random-dyes-grid.js';
export type {
  RandomDyeRow,
  /** @public */ RandomGridLabels,
  /** @public */ RandomDyesGridOptions,
} from './random-dyes-grid.js';

// Comparison card (14A/14C·2/14C — the dye count routes the frame)
export { generateComparisonCard } from './comparison-card.js';
export type {
  ComparisonDyeEntry,
  ComparisonReadout,
  /** @public */
  ComparisonCardLabels,
  /** @public */
  ComparisonCardOptions,
} from './comparison-card.js';

// Swatch card (character sheet — measuredRow consumer #5)
export { generateSwatchCard } from './swatch-card.js';
export type {
  SwatchCardRow,
  /** @public */ SwatchCardLabels,
  /** @public */ SwatchCardOptions,
} from './swatch-card.js';

// Dye Info Card (11B sheet)
export { generateDyeInfoCard } from './dye-info-card.js';
export type {
  /** @public */ DyeInfoCardOptions,
  /** @public */ DyeInfoLabels,
  NearestDyeInfo,
} from './dye-info-card.js';

// Preset Swatch
export { generatePresetSwatch, CATEGORY_DISPLAY } from './preset-swatch.js';
export type { /** @public */ PresetSwatchOptions } from './preset-swatch.js';

// Budget Ledger (13G — tier groups carry the single price)
export {
  generateBudgetLedger,
  LEDGER_HEADER_H,
  LEDGER_COLHEAD_H,
  /** @public */
  LEDGER_FOOTER_H,
  /** @public */
  LEDGER_FOOTER_2LINE_H,
} from './budget-ledger.js';
export type {
  /** @public */
  BudgetLedgerRow,
  BudgetLedgerGroup,
  /** @public */
  BudgetLedgerLabels,
  /** @public */
  BudgetLedgerOptions,
} from './budget-ledger.js';

// 5.0 icon system (single geometry home — web apps consume via shims)
export {
  toolGlyph,
  harmonyGlyph,
  chromeGlyph,
  panelGlyph,
  categoryGlyph,
  GLYPH_ACCENT_DARK,
  GLYPH_ACCENT_LIGHT,
} from './icons/tool-icons.js';
export type {
  ToolGlyphName,
  HarmonyGlyphName,
  /** @public */
  ChromeGlyphName,
  /** @public */
  PanelGlyphName,
  CategoryGlyphName,
  GlyphRenderOptions,
} from './icons/tool-icons.js';

/** @public */
export { scanEmittedGlyphs, type EmittedGlyph } from './emitted-glyphs.js';
