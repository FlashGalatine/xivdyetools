import type { RGB, LAB, HSL } from './types.js';

// ============================================================================
// CIELAB (D65 illuminant)
// ============================================================================

/**
 * RGB to CIELAB conversion.
 * Exported for use in SVG generators that display LAB values.
 */
export function rgbToLab(rgb: RGB): LAB {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  // sRGB to linear
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Convert to XYZ (D65 illuminant)
  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  let z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

  // XYZ to LAB
  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  return {
    l: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

export function labToRgb(lab: LAB): RGB {
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

  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let g = x * -0.969266 + y * 1.8760108 + z * 0.041556;
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

// ============================================================================
// OKLAB (Björn Ottosson, 2020)
// ============================================================================

export function rgbToOklab(rgb: RGB): { L: number; a: number; b: number } {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  // sRGB to linear
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Linear RGB to LMS
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklabToRgb(oklab: { L: number; a: number; b: number }): RGB {
  const l_ = oklab.L + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b;
  const m_ = oklab.L - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b;
  const s_ = oklab.L - 0.0894841775 * oklab.a - 1.291485548 * oklab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

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

// ============================================================================
// RYB (Red-Yellow-Blue, approximate)
// ============================================================================

export function rgbToRyb(rgb: RGB): { r: number; y: number; b: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const w = Math.min(r, g, b);
  const r_ = r - w;
  const g_ = g - w;
  const b_ = b - w;

  const mg = Math.max(r_, g_, b_);

  const y = Math.min(r_, g_);
  const r__ = r_ - y;

  const b__ = (b_ + (g_ - y)) / 2;

  const n = Math.max(r__, y, b__) / Math.max(mg, 0.001);

  return {
    r: r__ / Math.max(n, 0.001) + w,
    y: y / Math.max(n, 0.001) + w,
    b: b__ / Math.max(n, 0.001) + w,
  };
}

export function rybToRgb(ryb: { r: number; y: number; b: number }): RGB {
  const r = ryb.r;
  const y = ryb.y;
  const b = ryb.b;

  const w = Math.min(r, y, b);
  const r_ = r - w;
  const y_ = y - w;
  const b_ = b - w;

  const my = Math.max(r_, y_, b_);

  let g = Math.min(y_, b_);
  const y__ = y_ - g;
  const b__ = b_ - g;

  const r__ = r_ + y__;
  g = g + y__;

  const n = Math.max(r__, g, b__) / Math.max(my, 0.001);

  return {
    r: Math.round(Math.max(0, Math.min(255, (r__ / Math.max(n, 0.001) + w) * 255))),
    g: Math.round(Math.max(0, Math.min(255, (g / Math.max(n, 0.001) + w) * 255))),
    b: Math.round(Math.max(0, Math.min(255, (b__ / Math.max(n, 0.001) + w) * 255))),
  };
}

// ============================================================================
// HSL
// ============================================================================

export function rgbToHsl(rgb: RGB): HSL {
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

export function hslToRgb(hsl: HSL): RGB {
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

// ============================================================================
// Kubelka-Munk (Spectral)
// ============================================================================

export function rgbToReflectance(rgb: RGB): { r: number; g: number; b: number } {
  return { r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 };
}

export function reflectanceToRgb(ref: { r: number; g: number; b: number }): RGB {
  return {
    r: Math.round(Math.max(0, Math.min(255, ref.r * 255))),
    g: Math.round(Math.max(0, Math.min(255, ref.g * 255))),
    b: Math.round(Math.max(0, Math.min(255, ref.b * 255))),
  };
}

export function reflectanceToKS(r: number): number {
  // K/S = (1-R)² / (2R)
  const R = Math.max(0.001, Math.min(0.999, r));
  return ((1 - R) * (1 - R)) / (2 * R);
}

export function ksToReflectance(ks: number): number {
  // R = 1 + K/S - √((K/S)² + 2·K/S)
  return 1 + ks - Math.sqrt(ks * ks + 2 * ks);
}

// ============================================================================
// Utility
// ============================================================================

export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}
