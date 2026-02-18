/**
 * Color Blending Service (V4)
 *
 * Provides 6 different color blending algorithms for the /mixer command.
 * Each mode produces different perceptual results when mixing two colors.
 *
 * Blending Modes:
 * - RGB: Simple additive channel averaging
 * - LAB: Perceptually uniform CIELAB blending
 * - OKLAB: Modern perceptual (fixes LAB blue→purple issue)
 * - RYB: Traditional artist's color wheel
 * - HSL: Hue-Saturation-Lightness interpolation
 * - Spectral: Kubelka-Munk physics simulation
 *
 * @module services/color-blending
 */

import { ColorService } from '@xivdyetools/core';
import type { BlendingMode } from '../types/preferences.js';

// ============================================================================
// Types
// ============================================================================

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface LAB {
  l: number;
  a: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface BlendResult {
  hex: string;
  rgb: RGB;
}

// ============================================================================
// Main Blending Function
// ============================================================================

/**
 * Blend two colors using the specified blending mode
 *
 * @param hex1 - First color hex code
 * @param hex2 - Second color hex code
 * @param mode - Blending mode to use
 * @param ratio - Blend ratio (0.0 = all hex1, 1.0 = all hex2, 0.5 = equal mix)
 * @returns Blended color result
 */
export function blendColors(
  hex1: string,
  hex2: string,
  mode: BlendingMode,
  ratio: number = 0.5
): BlendResult {
  // Ensure hex codes have # prefix
  const h1 = hex1.startsWith('#') ? hex1 : `#${hex1}`;
  const h2 = hex2.startsWith('#') ? hex2 : `#${hex2}`;

  // Clamp ratio
  const t = Math.max(0, Math.min(1, ratio));

  // Convert to RGB
  const rgb1 = ColorService.hexToRgb(h1);
  const rgb2 = ColorService.hexToRgb(h2);

  let blendedRgb: RGB;

  switch (mode) {
    case 'rgb':
      blendedRgb = blendRGB(rgb1, rgb2, t);
      break;

    case 'lab':
      blendedRgb = blendLAB(rgb1, rgb2, t);
      break;

    case 'oklab':
      blendedRgb = blendOKLAB(rgb1, rgb2, t);
      break;

    case 'ryb':
      blendedRgb = blendRYB(rgb1, rgb2, t);
      break;

    case 'hsl':
      blendedRgb = blendHSL(rgb1, rgb2, t);
      break;

    case 'spectral':
      blendedRgb = blendSpectral(rgb1, rgb2, t);
      break;

    default:
      // Default to RGB
      blendedRgb = blendRGB(rgb1, rgb2, t);
  }

  // Convert back to hex
  const hex = rgbToHex(blendedRgb);

  return { hex, rgb: blendedRgb };
}

// ============================================================================
// RGB Blending (Simple)
// ============================================================================

/**
 * Simple RGB channel averaging
 */
function blendRGB(rgb1: RGB, rgb2: RGB, t: number): RGB {
  return {
    r: Math.round(rgb1.r * (1 - t) + rgb2.r * t),
    g: Math.round(rgb1.g * (1 - t) + rgb2.g * t),
    b: Math.round(rgb1.b * (1 - t) + rgb2.b * t),
  };
}

// ============================================================================
// LAB Blending (Perceptually Uniform)
// ============================================================================

/**
 * CIELAB color space blending for perceptual uniformity
 */
function blendLAB(rgb1: RGB, rgb2: RGB, t: number): RGB {
  const lab1 = rgbToLab(rgb1);
  const lab2 = rgbToLab(rgb2);

  const blendedLab: LAB = {
    l: lab1.l * (1 - t) + lab2.l * t,
    a: lab1.a * (1 - t) + lab2.a * t,
    b: lab1.b * (1 - t) + lab2.b * t,
  };

  return labToRgb(blendedLab);
}

// ============================================================================
// OKLAB Blending (Modern Perceptual)
// ============================================================================

/**
 * OKLAB color space blending - fixes LAB's blue-to-purple issue
 */
function blendOKLAB(rgb1: RGB, rgb2: RGB, t: number): RGB {
  const oklab1 = rgbToOklab(rgb1);
  const oklab2 = rgbToOklab(rgb2);

  const blendedOklab = {
    L: oklab1.L * (1 - t) + oklab2.L * t,
    a: oklab1.a * (1 - t) + oklab2.a * t,
    b: oklab1.b * (1 - t) + oklab2.b * t,
  };

  return oklabToRgb(blendedOklab);
}

// ============================================================================
// RYB Blending (Artist's Color Wheel)
// ============================================================================

/**
 * RYB (Red-Yellow-Blue) traditional artist's color wheel blending
 * Converts through RYB space for more "painterly" mixing
 */
function blendRYB(rgb1: RGB, rgb2: RGB, t: number): RGB {
  const ryb1 = rgbToRyb(rgb1);
  const ryb2 = rgbToRyb(rgb2);

  const blendedRyb = {
    r: ryb1.r * (1 - t) + ryb2.r * t,
    y: ryb1.y * (1 - t) + ryb2.y * t,
    b: ryb1.b * (1 - t) + ryb2.b * t,
  };

  return rybToRgb(blendedRyb);
}

// ============================================================================
// HSL Blending (Hue Interpolation)
// ============================================================================

/**
 * HSL color space blending with proper hue interpolation
 */
function blendHSL(rgb1: RGB, rgb2: RGB, t: number): RGB {
  const hsl1 = rgbToHsl(rgb1);
  const hsl2 = rgbToHsl(rgb2);

  // Handle hue interpolation (shortest path around the circle)
  let hueDiff = hsl2.h - hsl1.h;
  if (hueDiff > 180) hueDiff -= 360;
  if (hueDiff < -180) hueDiff += 360;

  let blendedH = hsl1.h + hueDiff * t;
  if (blendedH < 0) blendedH += 360;
  if (blendedH >= 360) blendedH -= 360;

  const blendedHsl: HSL = {
    h: blendedH,
    s: hsl1.s * (1 - t) + hsl2.s * t,
    l: hsl1.l * (1 - t) + hsl2.l * t,
  };

  return hslToRgb(blendedHsl);
}

// ============================================================================
// Spectral Blending (Kubelka-Munk)
// ============================================================================

/**
 * Spectral mixing using Kubelka-Munk theory
 * Simulates real pigment mixing behavior
 */
function blendSpectral(rgb1: RGB, rgb2: RGB, t: number): RGB {
  // Convert RGB to reflectance (simplified)
  const ref1 = rgbToReflectance(rgb1);
  const ref2 = rgbToReflectance(rgb2);

  // Apply Kubelka-Munk model for each channel
  const blendedRef = {
    r: kubelkaMunkMix(ref1.r, ref2.r, t),
    g: kubelkaMunkMix(ref1.g, ref2.g, t),
    b: kubelkaMunkMix(ref1.b, ref2.b, t),
  };

  return reflectanceToRgb(blendedRef);
}

/**
 * Kubelka-Munk single channel mixing
 */
function kubelkaMunkMix(r1: number, r2: number, t: number): number {
  // K/S ratio from reflectance
  const ks1 = reflectanceToKS(r1);
  const ks2 = reflectanceToKS(r2);

  // Mix K/S values
  const ksMix = ks1 * (1 - t) + ks2 * t;

  // Convert back to reflectance
  return ksToReflectance(ksMix);
}

function reflectanceToKS(r: number): number {
  // Kubelka-Munk: K/S = (1-R)² / (2R)
  const R = Math.max(0.001, Math.min(0.999, r));
  return ((1 - R) * (1 - R)) / (2 * R);
}

function ksToReflectance(ks: number): number {
  // Inverse: R = 1 + K/S - √((K/S)² + 2*K/S)
  return 1 + ks - Math.sqrt(ks * ks + 2 * ks);
}

function rgbToReflectance(rgb: RGB): { r: number; g: number; b: number } {
  return {
    r: rgb.r / 255,
    g: rgb.g / 255,
    b: rgb.b / 255,
  };
}

function reflectanceToRgb(ref: { r: number; g: number; b: number }): RGB {
  return {
    r: Math.round(Math.max(0, Math.min(255, ref.r * 255))),
    g: Math.round(Math.max(0, Math.min(255, ref.g * 255))),
    b: Math.round(Math.max(0, Math.min(255, ref.b * 255))),
  };
}

// ============================================================================
// Color Space Conversions
// ============================================================================

/**
 * RGB to CIELAB conversion
 * Exported for use in other modules (e.g., comparison grid)
 */
export function rgbToLab(rgb: RGB): LAB {
  // First convert to XYZ
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  // sRGB to linear
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Convert to XYZ (D65 illuminant)
  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750);
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;

  // XYZ to LAB
  x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;

  return {
    l: (116 * y) - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

/**
 * CIELAB to RGB conversion
 */
function labToRgb(lab: LAB): RGB {
  // LAB to XYZ
  let y = (lab.l + 16) / 116;
  let x = lab.a / 500 + y;
  let z = y - lab.b / 200;

  const y3 = y * y * y;
  const x3 = x * x * x;
  const z3 = z * z * z;

  y = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787;
  x = x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787;
  z = z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787;

  x *= 0.95047;
  z *= 1.08883;

  // XYZ to RGB
  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
  let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  // Linear to sRGB
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  return {
    r: Math.round(Math.max(0, Math.min(255, r * 255))),
    g: Math.round(Math.max(0, Math.min(255, g * 255))),
    b: Math.round(Math.max(0, Math.min(255, b * 255))),
  };
}

/**
 * RGB to OKLAB conversion
 */
function rgbToOklab(rgb: RGB): { L: number; a: number; b: number } {
  // sRGB to linear
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Linear RGB to LMS
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  // LMS to OKLAB
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

/**
 * OKLAB to RGB conversion
 */
function oklabToRgb(oklab: { L: number; a: number; b: number }): RGB {
  // OKLAB to LMS
  const l_ = oklab.L + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b;
  const m_ = oklab.L - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b;
  const s_ = oklab.L - 0.0894841775 * oklab.a - 1.2914855480 * oklab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS to linear RGB
  let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  // Linear to sRGB
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  return {
    r: Math.round(Math.max(0, Math.min(255, r * 255))),
    g: Math.round(Math.max(0, Math.min(255, g * 255))),
    b: Math.round(Math.max(0, Math.min(255, b * 255))),
  };
}

/**
 * RGB to RYB conversion (approximate)
 */
function rgbToRyb(rgb: RGB): { r: number; y: number; b: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  // Remove whiteness
  const w = Math.min(r, g, b);
  const r_ = r - w;
  const g_ = g - w;
  const b_ = b - w;

  const mg = Math.max(r_, g_, b_);

  // Get yellow from red and green
  let y = Math.min(r_, g_);
  const r__ = r_ - y;
  const g__ = g_ - y;

  // Get blue from green and blue
  const b__ = (b_ + g__) / 2;
  const g___ = 0; // Green absorbed

  // Normalize
  const n = Math.max(r__, y, b__) / Math.max(mg, 0.001);

  return {
    r: r__ / Math.max(n, 0.001) + w,
    y: y / Math.max(n, 0.001) + w,
    b: b__ / Math.max(n, 0.001) + w,
  };
}

/**
 * RYB to RGB conversion (approximate)
 */
function rybToRgb(ryb: { r: number; y: number; b: number }): RGB {
  const r = ryb.r;
  const y = ryb.y;
  const b = ryb.b;

  // Remove whiteness
  const w = Math.min(r, y, b);
  const r_ = r - w;
  const y_ = y - w;
  const b_ = b - w;

  const my = Math.max(r_, y_, b_);

  // Get red and green from yellow
  let g = Math.min(y_, b_);
  const y__ = y_ - g;
  const b__ = b_ - g;

  // Add yellow back to red
  const r__ = r_ + y__;
  g = g + y__;

  // Normalize
  const n = Math.max(r__, g, b__) / Math.max(my, 0.001);

  return {
    r: Math.round(Math.max(0, Math.min(255, (r__ / Math.max(n, 0.001) + w) * 255))),
    g: Math.round(Math.max(0, Math.min(255, (g / Math.max(n, 0.001) + w) * 255))),
    b: Math.round(Math.max(0, Math.min(255, (b__ / Math.max(n, 0.001) + w) * 255))),
  };
}

/**
 * RGB to HSL conversion
 */
function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return { h: h * 360, s, l };
}

/**
 * HSL to RGB conversion
 */
function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s;
  const l = hsl.l;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * RGB to hex string
 */
function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a description of what the blending mode does
 */
export function getBlendingModeDescription(mode: BlendingMode): string {
  const descriptions: Record<BlendingMode, string> = {
    rgb: 'Simple additive channel averaging',
    lab: 'Perceptually uniform CIELAB blending',
    oklab: 'Modern perceptual (fixes LAB blue→purple)',
    ryb: "Traditional artist's color wheel",
    hsl: 'Hue-Saturation-Lightness interpolation',
    spectral: 'Kubelka-Munk pigment simulation',
  };
  return descriptions[mode];
}
