/**
 * Color Blending — Six algorithms for mixing two colors.
 *
 * Blending Modes:
 * - RGB:      Simple additive channel averaging
 * - LAB:      Perceptually uniform CIELAB blending
 * - OKLAB:    Modern perceptual (fixes LAB blue→purple issue)
 * - RYB:      Traditional artist's color wheel
 * - HSL:      Hue-Saturation-Lightness interpolation
 * - Spectral: Kubelka-Munk physics simulation
 */

import { ColorService } from '@xivdyetools/core';
import type { RGB, LAB, HSL, BlendResult, BlendingMode } from './types.js';
import {
  rgbToLab,
  labToRgb,
  rgbToOklab,
  oklabToRgb,
  rgbToRyb,
  rybToRgb,
  rgbToHsl,
  hslToRgb,
  rgbToReflectance,
  reflectanceToRgb,
  reflectanceToKS,
  ksToReflectance,
  rgbToHex,
} from './conversions.js';

// ============================================================================
// Public API
// ============================================================================

/**
 * Blend two colors using the specified blending mode.
 *
 * @param hex1  - First color hex code (with or without #)
 * @param hex2  - Second color hex code (with or without #)
 * @param mode  - Blending algorithm to use
 * @param ratio - 0.0 = all hex1, 0.5 = equal mix, 1.0 = all hex2
 */
export function blendColors(
  hex1: string,
  hex2: string,
  mode: BlendingMode,
  ratio: number = 0.5
): BlendResult {
  const h1 = hex1.startsWith('#') ? hex1 : `#${hex1}`;
  const h2 = hex2.startsWith('#') ? hex2 : `#${hex2}`;
  const t = Math.max(0, Math.min(1, ratio));

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
      blendedRgb = blendRGB(rgb1, rgb2, t);
  }

  return { hex: rgbToHex(blendedRgb), rgb: blendedRgb };
}

/**
 * Get a human-readable description of a blending mode.
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

// ============================================================================
// Blend Implementations
// ============================================================================

function blendRGB(rgb1: RGB, rgb2: RGB, t: number): RGB {
  return {
    r: Math.round(rgb1.r * (1 - t) + rgb2.r * t),
    g: Math.round(rgb1.g * (1 - t) + rgb2.g * t),
    b: Math.round(rgb1.b * (1 - t) + rgb2.b * t),
  };
}

function blendLAB(rgb1: RGB, rgb2: RGB, t: number): RGB {
  const lab1 = rgbToLab(rgb1);
  const lab2 = rgbToLab(rgb2);
  const blended: LAB = {
    l: lab1.l * (1 - t) + lab2.l * t,
    a: lab1.a * (1 - t) + lab2.a * t,
    b: lab1.b * (1 - t) + lab2.b * t,
  };
  return labToRgb(blended);
}

function blendOKLAB(rgb1: RGB, rgb2: RGB, t: number): RGB {
  const ok1 = rgbToOklab(rgb1);
  const ok2 = rgbToOklab(rgb2);
  return oklabToRgb({
    L: ok1.L * (1 - t) + ok2.L * t,
    a: ok1.a * (1 - t) + ok2.a * t,
    b: ok1.b * (1 - t) + ok2.b * t,
  });
}

function blendRYB(rgb1: RGB, rgb2: RGB, t: number): RGB {
  const ryb1 = rgbToRyb(rgb1);
  const ryb2 = rgbToRyb(rgb2);
  return rybToRgb({
    r: ryb1.r * (1 - t) + ryb2.r * t,
    y: ryb1.y * (1 - t) + ryb2.y * t,
    b: ryb1.b * (1 - t) + ryb2.b * t,
  });
}

function blendHSL(rgb1: RGB, rgb2: RGB, t: number): RGB {
  const hsl1 = rgbToHsl(rgb1);
  const hsl2 = rgbToHsl(rgb2);

  // Shortest-arc hue interpolation
  let hueDiff = hsl2.h - hsl1.h;
  if (hueDiff > 180) hueDiff -= 360;
  if (hueDiff < -180) hueDiff += 360;

  let blendedH = hsl1.h + hueDiff * t;
  if (blendedH < 0) blendedH += 360;
  if (blendedH >= 360) blendedH -= 360;

  const blended: HSL = {
    h: blendedH,
    s: hsl1.s * (1 - t) + hsl2.s * t,
    l: hsl1.l * (1 - t) + hsl2.l * t,
  };
  return hslToRgb(blended);
}

function blendSpectral(rgb1: RGB, rgb2: RGB, t: number): RGB {
  const ref1 = rgbToReflectance(rgb1);
  const ref2 = rgbToReflectance(rgb2);
  return reflectanceToRgb({
    r: kubelkaMunkMix(ref1.r, ref2.r, t),
    g: kubelkaMunkMix(ref1.g, ref2.g, t),
    b: kubelkaMunkMix(ref1.b, ref2.b, t),
  });
}

function kubelkaMunkMix(r1: number, r2: number, t: number): number {
  const ks1 = reflectanceToKS(r1);
  const ks2 = reflectanceToKS(r2);
  return ksToReflectance(ks1 * (1 - t) + ks2 * t);
}
