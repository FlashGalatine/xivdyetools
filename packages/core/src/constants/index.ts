/**
 * @xivdyetools/core - Application Constants
 *
 * Centralized configuration and constant values
 *
 * @module constants
 */

import type { ColorblindMatrices } from '@xivdyetools/types';

// ============================================================================
// Color Conversion Constraints
// ============================================================================

/**
 * RGB value constraints
 */
export const RGB_MIN = 0;
export const RGB_MAX = 255;

/**
 * HSV value constraints
 */
export const HUE_MIN = 0;
export const HUE_MAX = 360;
export const SATURATION_MIN = 0;
export const SATURATION_MAX = 100;
export const VALUE_MIN = 0;
export const VALUE_MAX = 100;

/**
 * @internal
 * Color distance calculation mode
 */
export const COLOR_DISTANCE_MAX = Math.sqrt(255 ** 2 + 255 ** 2 + 255 ** 2); // ~441.67

// ============================================================================
// Colorblindness Transformation Matrices (Brettel 1997)
// ============================================================================

/**
 * Brettel 1997 transformation matrices for colorblindness simulation
 * These matrices transform RGB values to simulate different types of colorblindness
 */
export const BRETTEL_MATRICES: ColorblindMatrices = {
  deuteranopia: [
    [0.625, 0.375, 0.0],
    [0.7, 0.3, 0.0],
    [0.0, 0.3, 0.7],
  ],
  protanopia: [
    [0.567, 0.433, 0.0],
    [0.558, 0.442, 0.0],
    [0.0, 0.242, 0.758],
  ],
  tritanopia: [
    [0.95, 0.05, 0.0],
    [0.0, 0.433, 0.567],
    [0.0, 0.475, 0.525],
  ],
  achromatopsia: [
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
  ],
};

// ============================================================================
// Colorblindness Transformation Matrices (Machado et al. 2009, severity 1.0)
// ============================================================================

/**
 * Machado, Oliveira & Fernandes (2009) transformation matrices at severity 1.0.
 *
 * Unlike {@link BRETTEL_MATRICES} (applied to gamma-encoded sRGB by the legacy
 * simulator), these matrices are defined over **linear RGB** — use them only
 * through `ColorblindnessSimulator.simulateColorblindnessMachado`, which
 * linearizes, transforms, and re-encodes.
 *
 * The 5.0 band calibration (SEPARATION cuts) was computed against this set, so
 * any recomputation of those bands must use the Machado path, not Brettel.
 * Achromatopsia is not part of the Machado dichromacy model; it is represented
 * here as Rec. 709 luminance grayscale in linear light.
 */
export const MACHADO_MATRICES: ColorblindMatrices = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
  achromatopsia: [
    [0.2126, 0.7152, 0.0722],
    [0.2126, 0.7152, 0.0722],
    [0.2126, 0.7152, 0.0722],
  ],
};

// ============================================================================
// Regular Expressions
// ============================================================================

/**
 * Regex patterns for validation
 */
export const PATTERNS = {
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
} as const;

// ============================================================================
// API Configuration (Universalis)
// ============================================================================

/**
 * Universalis API configuration
 */
export const UNIVERSALIS_API_BASE = 'https://universalis.app/api/v2';
export const UNIVERSALIS_API_TIMEOUT = 5000; // milliseconds
export const UNIVERSALIS_API_RETRY_COUNT = 3;
export const UNIVERSALIS_API_RETRY_DELAY = 1000; // milliseconds

/**
 * API caching and rate limiting
 */
export const API_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const API_CACHE_VERSION = '1.0.0'; // Increment to invalidate all cached data
export const API_MAX_RESPONSE_SIZE = 1024 * 1024; // 1 MB maximum response size
export const API_RATE_LIMIT_DELAY = 200; // milliseconds between requests

// ============================================================================
// Harmony Hue Offsets
// ============================================================================

/**
 * The hue offset, in degrees, each harmony type asks for — THE table.
 *
 * BUG-022 (deep dive 2026-09-02): og-worker carried a private copy that
 * diverged from the page's in three of the ten rows, so the card unfurled for
 * a share link drew dyes the page it opened never shows: `analogous` gained a
 * 180° complement band, `compound` was a different scheme entirely
 * (`[30,150,210]` vs `[30,180,330]`), and `shades` was missing altogether and
 * silently fell through to a nearest-dye path. This table is the web app's,
 * which is what a reader actually sees after clicking; `analogous` also
 * matches `HarmonyGenerator.findAnalogousDyes`'s `[angle, -angle]`.
 *
 * 330 ≡ -30 and 345 ≡ -15; the positive spellings are kept because that is
 * how the page has always expressed them.
 *
 * NOTE: `@xivdyetools/bot-logic`'s own `IDEAL_OFFSETS` still carries the old
 * `analogous: [30, -30, 180]` and knows neither `compound` nor `shades`.
 * That is a divergence, not this bug: the bot's embed and its card agree with
 * each other, and reconciling them changes what `/harmony` returns for every
 * user — a product decision, filed rather than folded in here.
 *
 * @public published `@xivdyetools/core` API.
 */
export const HARMONY_OFFSETS: Record<string, number[]> = {
  complementary: [180],
  analogous: [30, 330],
  triadic: [120, 240],
  'split-complementary': [150, 210],
  tetradic: [60, 180, 240],
  'inverted-tetradic': [120, 180, 300],
  square: [90, 180, 270],
  monochromatic: [0],
  compound: [30, 180, 330],
  shades: [15, 345],
};
