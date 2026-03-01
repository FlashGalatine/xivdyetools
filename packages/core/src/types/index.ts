/**
 * @xivdyetools/core - Core-Specific Type Definitions
 *
 * Color matching algorithm types defined by core.
 * For shared types (Dye, RGB, etc.), import from '@xivdyetools/types'.
 *
 * @module types
 */

// ============================================================================
// Color Matching Types (core-specific)
// ============================================================================

/**
 * Available color matching algorithms for finding closest dyes.
 *
 * - rgb: RGB Euclidean distance (fastest, least accurate)
 * - cie76: CIE76 LAB Euclidean (fast, fair accuracy)
 * - ciede2000: CIEDE2000 (industry standard, accurate)
 * - oklab: OKLAB Euclidean (modern, simpler than ciede2000, CSS standard)
 * - hyab: HyAB hybrid (best for large color differences/palette matching)
 * - oklch-weighted: OKLCH with custom L/C/H weights (advanced)
 */
export type MatchingMethod = 'rgb' | 'cie76' | 'ciede2000' | 'oklab' | 'hyab' | 'oklch-weighted';

/**
 * Configuration for OKLCH weighted matching.
 * Allows users to prioritize different color attributes.
 */
export interface OklchWeights {
  /** Lightness weight (default 1.0). Higher = prioritize brightness matching */
  kL: number;
  /** Chroma weight (default 1.0). Higher = prioritize saturation matching */
  kC: number;
  /** Hue weight (default 1.0). Higher = prioritize hue matching */
  kH: number;
}

/**
 * Color matching configuration options.
 */
export interface MatchingConfig {
  /** The matching algorithm to use */
  method: MatchingMethod;
  /** Custom weights for oklch-weighted method (ignored for other methods) */
  weights?: OklchWeights;
}

/**
 * Default OKLCH weights for common matching presets.
 */
export const MATCHING_PRESETS = {
  /** Equal weight to all attributes (default) */
  balanced: { kL: 1.0, kC: 1.0, kH: 1.0 },
  /** Prioritize matching the hue (color), tolerate brightness differences */
  matchHue: { kL: 0.5, kC: 0.8, kH: 2.0 },
  /** Prioritize matching brightness (for armor visibility) */
  matchBrightness: { kL: 2.0, kC: 1.0, kH: 0.5 },
  /** Prioritize matching saturation (find vibrant alternatives) */
  matchSaturation: { kL: 0.5, kC: 2.0, kH: 0.8 },
} as const;
