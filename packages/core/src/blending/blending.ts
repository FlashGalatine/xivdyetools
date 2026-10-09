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

import type {
  RGB,
  LAB,
  HSL,
  BlendResult,
  BlendingMode,
  BlendOptions,
  HueMethod,
} from './types.js';
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

/** The equal mix `blendColors` uses when no usable ratio is given. */
const DEFAULT_RATIO = 0.5;

/**
 * Blend two colors using the specified blending mode.
 *
 * This is THE mixing surface for `@xivdyetools/core`. `ColorService.mixColors*`
 * are thin delegations to it, so a front end that calls either gets the same
 * colour — see `services/__tests__/ColorService.blending-parity.test.ts`, which
 * asserts byte-equality rather than approximate agreement.
 *
 * @param hex1    - First color hex code (with or without #)
 * @param hex2    - Second color hex code (with or without #)
 * @param mode    - Blending algorithm to use
 * @param ratio   - 0.0 = all hex1, 0.5 = equal mix, 1.0 = all hex2. Never
 *                  throws: a ratio outside [0, 1] — `±Infinity` included —
 *                  clamps to the nearer end, and `NaN`, which has no nearer
 *                  end, falls back to the 0.5 default exactly as an omitted
 *                  ratio does (BUG-129: it used to slip through `Math.max`/
 *                  `Math.min` and come back as the hex `'#NaNNaNNaN'`). So
 *                  does any value an untyped caller passes that is not a
 *                  number — `null`, an object, a string. A numeric string
 *                  such as `'0.25'` is not parsed; it gets the default too.
 * @param options - Per-mode tuning; only `'hsl'` reads anything from it today
 */
export function blendColors(
  hex1: string,
  hex2: string,
  mode: BlendingMode,
  ratio: number = DEFAULT_RATIO,
  options: BlendOptions = {},
): BlendResult {
  const h1 = hex1.startsWith('#') ? hex1 : `#${hex1}`;
  const h2 = hex2.startsWith('#') ? hex2 : `#${hex2}`;
  // `typeof` first: `Number.isNaN` does not coerce, so on its own it let a
  // string or object through to Math.min (→ NaN again) and null through as 0.
  // Same guard as BUG-131's in CharacterColorService.
  const t =
    typeof ratio === 'number' && !Number.isNaN(ratio)
      ? Math.max(0, Math.min(1, ratio))
      : DEFAULT_RATIO;

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
      blendedRgb = blendHSL(rgb1, rgb2, t, options.hueMethod ?? 'shorter');
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
 * Interpolate between two hues on the colour wheel.
 *
 * Exposed because the wheel is circular and "halfway between 10° and 350°"
 * has four defensible answers; the caller picks which. `ColorService.
 * interpolateHue` delegates here so there is one implementation.
 *
 * @param h1     - Start hue in degrees
 * @param h2     - End hue in degrees
 * @param ratio  - 0.0 = h1, 1.0 = h2
 * @param method - Which way round the wheel to travel
 * @returns The interpolated hue, normalised to [0, 360)
 */
export function interpolateHue(
  h1: number,
  h2: number,
  ratio: number,
  method: HueMethod = 'shorter',
): number {
  let diff = h2 - h1;

  switch (method) {
    case 'shorter':
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      break;
    case 'longer':
      if (diff > 0 && diff < 180) diff -= 360;
      if (diff < 0 && diff > -180) diff += 360;
      break;
    case 'increasing':
      if (diff < 0) diff += 360;
      break;
    case 'decreasing':
      if (diff > 0) diff -= 360;
      break;
  }

  return (((h1 + diff * ratio) % 360) + 360) % 360;
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

/**
 * HSL mixing with CSS Color 4's "powerless hue" rule.
 *
 * An exact grey — r = g = b, which takes in `#ffffff` and `#000000` — has zero
 * HSL saturation, and `rgbToHsl` reports its hue as 0: a placeholder, not a
 * red. Interpolating that 0 as a real hue dragged every such mix toward red:
 * `#ffffff` + blue came out pink and `#000000` + green olive (BUG-035). So a
 * side with `s === 0` has no hue of its own and takes the other side's,
 * leaving the chromatic input's hue unchanged along the whole ramp while
 * saturation and lightness still interpolate. When both sides are grey the
 * hue is irrelevant — the blend has zero saturation, and `hslToRgb` returns a
 * grey whatever the hue says.
 *
 * The rule covers EXACT greys only: from integer RGB, `s === 0` exactly when
 * r = g = b. That is raw grey hex plus the dyes Slate Grey, Jet Black and
 * Metallic Silver — not the near-greys players usually reach for as white or
 * black. Pure White `#f9f8f4`, Snow White and Soot Black keep their own hue
 * (about 45°), and that hue is not faint: HSL saturation is chroma relative to
 * how far lightness allows, so a near-white or near-black carries a high one
 * for very little chroma (Pure White's is 0.29). A 50% mix of Pure White and
 * `#0000ff` therefore still takes the shorter arc from 48° to 240° — through
 * magenta — and comes out pink, `#e78fc4`. That is CSS Color 4's rule, which
 * keys on `s === 0` alone, and this follows it on purpose. Treating a
 * near-grey's hue as powerless too (a saturation or chroma threshold) would
 * diverge from the spec, and is a separate decision rather than part of this
 * fix.
 */
function blendHSL(rgb1: RGB, rgb2: RGB, t: number, hueMethod: HueMethod): RGB {
  const hsl1 = rgbToHsl(rgb1);
  const hsl2 = rgbToHsl(rgb2);
  const hue1 = hsl1.s === 0 ? hsl2.h : hsl1.h;
  const hue2 = hsl2.s === 0 ? hsl1.h : hsl2.h;

  const blended: HSL = {
    h: interpolateHue(hue1, hue2, t, hueMethod),
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
