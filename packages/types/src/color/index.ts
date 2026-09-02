/**
 * @xivdyetools/types - Color Module
 *
 * Color type definitions including RGB/HSV, branded types, and colorblindness.
 *
 * @module color
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see root CLAUDE.md's Tooling →
// knip bullet and this repo's root `knip.jsonc`.

// Core color types
export type { RGB, HSV, LAB, OKLAB, OKLCH, LCH, HSL, CMYK } from './rgb.js';

// Branded types for type safety
export type { HexColor, DyeId, Hue, Saturation } from './branded.js';
export { createHexColor, createDyeId, createHue, createSaturation } from './branded.js';

// Colorblindness types
export type { VisionType, /** @public */ Matrix3x3, ColorblindMatrices } from './colorblind.js';

// Match-quality tiers (REFACTOR-004: shared distance classification)
export type { MatchQualityKey } from './match-quality.js';
export { /** @public */ MATCH_QUALITY_TIERS, classifyMatchDistance } from './match-quality.js';
