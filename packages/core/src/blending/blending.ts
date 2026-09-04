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

import * as spectral from 'spectral.js';

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
  rgbToHex,
  hexToRgb,
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
  ratio: number = 0.5,
): BlendResult {
  const h1 = hex1.startsWith('#') ? hex1 : `#${hex1}`;
  const h2 = hex2.startsWith('#') ? hex2 : `#${hex2}`;
  const t = Math.max(0, Math.min(1, ratio));

  // REFACTOR-005: local parser — no more dependency on all of core
  const rgb1 = hexToRgb(h1);
  const rgb2 = hexToRgb(h2);

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

/**
 * Kubelka-Munk pigment mixing, via spectral.js.
 *
 * The previous implementation applied the K/S relation to the three
 * gamma-encoded sRGB channels independently. That is not Kubelka-Munk: K-M is
 * defined per-wavelength on a spectral reflectance curve, and it needs LINEAR
 * reflectance. Two consequences, both measured (2026-09-03 fact-check, P0):
 *
 * - K/S = (1-R)^2 / 2R diverges as R -> 0, so any channel dark in either input
 *   was pinned to ~0 at every ratio. A blue->yellow ramp rendered nine
 *   near-black stops out of eleven on the bot's /gradient.
 * - Three independent channels cannot produce blue + yellow = green. That
 *   effect lives in the OVERLAP of two reflectance curves; per-channel maths
 *   computes G_out from (blue_G, yellow_G) alone and never sees blue's B.
 *
 * spectral.js reconstructs a 38-band reflectance curve (380-750nm) per colour
 * using Burns' LHTSS spectral upsampling, mixes in K/S space per band, and
 * gamut-maps the result by reducing OkLCh chroma under a dE-OK search.
 */
function blendSpectral(rgb1: RGB, rgb2: RGB, t: number): RGB {
  // Hand spectral.js fully-expanded 6-digit hex. It does not parse shorthand
  // #RGB and fails SILENTLY, yielding the string "#NANNANNAN" rather than
  // throwing — so passing a caller's raw input string through would be a trap.
  const mixed = spectral.mix(
    [new spectral.Color(rgbToHex(rgb1)), 1 - t],
    [new spectral.Color(rgbToHex(rgb2)), t],
  );

  return hexToRgb(mixed.toString({ format: 'hex', method: 'map' }));
}
