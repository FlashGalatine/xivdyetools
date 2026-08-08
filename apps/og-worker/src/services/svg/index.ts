/**
 * SVG Template Exports
 *
 * Re-exports all SVG generation functions for OG images.
 */

export { generateOGCard, LAYOUT } from './og-card';
export type { OGCardOptions } from './og-card';

// The 15E band frame (5.0 — one shape for all nine tools)
export { generateBandCard, bandInk, ogMark, BAND_FRAMES, BAND_CAP } from './band';
export type { BandCardOptions, BandEntry, BandFrame } from './band';

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

// Base utilities
export * from './base';

// Dye helpers
export * from './dye-helpers';
