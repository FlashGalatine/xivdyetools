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
