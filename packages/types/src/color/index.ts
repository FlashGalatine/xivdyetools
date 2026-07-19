/**
 * @xivdyetools/types - Color Module
 *
 * Color type definitions including RGB/HSV, branded types, and colorblindness.
 *
 * @module color
 */

// Core color types
export type { RGB, HSV, LAB, OKLAB, OKLCH, LCH, HSL } from './rgb.js';

// Branded types for type safety
export type { HexColor, DyeId, Hue, Saturation } from './branded.js';
export { createHexColor, createDyeId, createHue, createSaturation } from './branded.js';

// Colorblindness types
export type { VisionType, Matrix3x3, ColorblindMatrices } from './colorblind.js';

// Match-quality tiers (REFACTOR-004: shared distance classification)
export type { MatchQualityKey } from './match-quality.js';
export { MATCH_QUALITY_TIERS, classifyMatchDistance } from './match-quality.js';
