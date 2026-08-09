/**
 * SVG Template Exports
 *
 * Re-exports all SVG generation functions for OG images.
 */

// The 15E band frame (5.0 — one shape for all nine tools)
export {
  generateBandCard,
  bandInk,
  cardFooter,
  cardHeader,
  ogMark,
  xStrip,
  BAND_FRAMES,
  BAND_CAP,
  DECK_H,
  FOOTER_H,
  HEADER_H,
} from './band';
export type { BandCardOptions, BandEntry, BandFrame } from './band';

// The 2a default cards (stripes + glyph tile; root = plain stripes)
export { generateDefaultCard, DEFAULT_DECK, MARK_STRIPES } from './default-card';
export type { DefaultCardOptions } from './default-card';

export { generateHarmonyOG } from './harmony';
export type { HarmonyOGOptions } from './harmony';

export { generateGradientOG } from './gradient';
export type { GradientOGOptions } from './gradient';

export { generateMixerOG } from './mixer';
export type { MixerOGOptions } from './mixer';

export { generateSwatchOG } from './swatch';
export type { SwatchOGOptions } from './swatch';

export { generateComparisonOG } from './comparison';
export type { ComparisonOGOptions } from './comparison';

export { generateAccessibilityOG } from './accessibility';
export type { AccessibilityOGOptions } from './accessibility';

export { generateExtractorOG } from './extractor';
export type { ExtractorOGOptions } from './extractor';

export { generatePresetsOG } from './presets';
export type { PresetsOGOptions } from './presets';

export { generateBudgetOG } from './budget';
export type { BudgetOGOptions } from './budget';

// Base utilities
export * from './base';

// Dye helpers
export * from './dye-helpers';
