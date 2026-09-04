// ============================================================================
// Blending Mode
// ============================================================================

/**
 * Available color blending algorithms.
 */
export type BlendingMode = 'rgb' | 'lab' | 'oklab' | 'ryb' | 'hsl' | 'spectral';

/**
 * All blending modes with display metadata.
 */
export const BLENDING_MODES: Array<{ value: BlendingMode; name: string; description: string }> = [
  { value: 'rgb', name: 'RGB', description: 'Additive channel averaging (default)' },
  { value: 'lab', name: 'LAB', description: 'Perceptually uniform CIELAB blending' },
  { value: 'oklab', name: 'OKLAB', description: 'Modern perceptual (fixes LAB blue→purple)' },
  { value: 'ryb', name: 'RYB', description: "Traditional artist's color wheel" },
  { value: 'hsl', name: 'HSL', description: 'Hue-Saturation-Lightness interpolation' },
  { value: 'spectral', name: 'Spectral', description: 'Kubelka-Munk physics simulation' },
];

/**
 * Type guard: check if a string is a valid blending mode.
 */
export function isValidBlendingMode(mode: string): mode is BlendingMode {
  return BLENDING_MODES.some((m) => m.value === mode);
}

// ============================================================================
// Color Space Interfaces
// ============================================================================

export interface RGB {
  r: number; // 0–255
  g: number; // 0–255
  b: number; // 0–255
}

export interface LAB {
  l: number; // Lightness: 0–100
  a: number; // Green–Red: ~-128 to +128
  b: number; // Blue–Yellow: ~-128 to +128
}

export interface HSL {
  h: number; // Hue: 0–360
  s: number; // Saturation: 0–1
  l: number; // Lightness: 0–1
}

export interface BlendResult {
  hex: string; // e.g. '#8B4513'
  rgb: RGB;
}

/**
 * RYB (Red-Yellow-Blue) coordinates in the chromatic-subtraction space that
 * blending mode `'ryb'` mixes in. Black sits at the origin.
 *
 * This is NOT the Gossett-Chen paint cube core shipped until 5.0.0, which put
 * WHITE at the origin. That cube's trilinear map lands in the convex hull of
 * its eight corners, so pure green, blue, cyan, magenta and true black had no
 * RYB pre-image and its Newton-method inverse could not converge for them —
 * mixing such a colour with itself did not return it. This space inverts
 * exactly; see {@link rgbToRyb} in `conversions.ts`.
 */
export interface RYB {
  r: number; // 0–255
  y: number; // 0–255
  b: number; // 0–255
}

/**
 * How to travel around the hue wheel when interpolating a cylindrical space.
 *
 * - `shorter`    — the shorter arc between the two hues (default)
 * - `longer`     — the longer arc
 * - `increasing` — always clockwise
 * - `decreasing` — always counter-clockwise
 */
export type HueMethod = 'shorter' | 'longer' | 'increasing' | 'decreasing';

/** Per-call tuning for the modes that have a choice to make. */
export interface BlendOptions {
  /** Hue travel direction for `'hsl'`. Ignored by every other mode. Default `'shorter'`. */
  hueMethod?: HueMethod;
}
