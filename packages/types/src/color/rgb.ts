/**
 * @xivdyetools/types - Color Types
 *
 * Core color representation types used throughout the xivdyetools ecosystem.
 *
 * @module color/rgb
 */

/**
 * RGB color representation
 * @example { r: 255, g: 0, b: 0 } // Red
 */
export interface RGB {
  /** Red channel (0-255) */
  r: number;
  /** Green channel (0-255) */
  g: number;
  /** Blue channel (0-255) */
  b: number;
}

/**
 * HSV color representation (Hue, Saturation, Value)
 * @example { h: 0, s: 100, v: 100 } // Bright red
 */
export interface HSV {
  /** Hue (0-360 degrees) */
  h: number;
  /** Saturation (0-100 percent) */
  s: number;
  /** Value/Brightness (0-100 percent) */
  v: number;
}

/**
 * CIE LAB color representation (perceptually uniform color space)
 * Used for DeltaE color difference calculations
 * @example { L: 53.23, a: 80.11, b: 67.22 } // Red
 */
export interface LAB {
  /** Lightness (0-100) */
  L: number;
  /** Green-Red axis (approximately -128 to 127) */
  a: number;
  /** Blue-Yellow axis (approximately -128 to 127) */
  b: number;
}

/**
 * OKLAB color representation (modern perceptually uniform color space)
 *
 * OKLAB (Björn Ottosson, 2020) fixes issues with CIELAB, particularly
 * for blue colors. It provides more consistent perceptual uniformity
 * and is now part of CSS Color Level 4.
 *
 * Key advantages over LAB:
 * - Blue + Yellow = Green (not pink like LAB)
 * - More uniform hue spacing
 * - Better gradient interpolation
 *
 * @example { L: 0.628, a: 0.225, b: -0.126 } // Red
 */
export interface OKLAB {
  /** Perceived lightness (0 to 1) */
  L: number;
  /** Green-Red axis (approximately -0.4 to 0.4) */
  a: number;
  /** Blue-Yellow axis (approximately -0.4 to 0.4) */
  b: number;
}

/**
 * OKLCH color representation (cylindrical form of OKLAB)
 *
 * OKLCH expresses OKLAB in cylindrical coordinates for intuitive
 * hue manipulation. Ideal for gradient interpolation and color mixing.
 *
 * @example { L: 0.628, C: 0.258, h: 29.23 } // Red
 */
export interface OKLCH {
  /** Perceived lightness (0 to 1) */
  L: number;
  /** Chroma - colorfulness (0 to ~0.4) */
  C: number;
  /** Hue angle (0-360 degrees) */
  h: number;
}

/**
 * LCH color representation (cylindrical form of CIE LAB)
 *
 * LCH expresses LAB in cylindrical coordinates (Lightness, Chroma, Hue).
 * Useful for hue-based interpolation with control over direction.
 *
 * @example { L: 53.23, C: 104.55, h: 40.0 } // Red
 */
export interface LCH {
  /** Lightness (0-100) */
  L: number;
  /** Chroma - colorfulness (0 to ~150) */
  C: number;
  /** Hue angle (0-360 degrees) */
  h: number;
}

/**
 * HSL color representation (Hue, Saturation, Lightness)
 *
 * Similar to HSV but with Lightness instead of Value.
 * Common in design tools (Photoshop, Figma, CSS).
 *
 * @example { h: 0, s: 100, l: 50 } // Bright red
 */
export interface HSL {
  /** Hue (0-360 degrees) */
  h: number;
  /** Saturation (0-100 percent) */
  s: number;
  /** Lightness (0-100 percent) */
  l: number;
}
