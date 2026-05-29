/**
 * Unit tests for color space conversion functions in conversions.ts.
 *
 * Each conversion is tested for:
 * - Correct output for known reference colors (black, white, primaries)
 * - Round-trip fidelity (forward + inverse ≈ identity, within ±1 channel)
 * - Boundary safety (extreme or out-of-range inputs don't throw)
 */

import { describe, it, expect } from 'vitest';
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
import type { RGB } from './types.js';

// Maximum allowed channel error for round-trip tests (quantization from Math.round)
const CHANNEL_TOLERANCE = 1;

// ============================================================================
// CIELAB
// ============================================================================

describe('rgbToLab', () => {
  it('black → L≈0, a≈0, b≈0', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(0, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });

  it('white → L≈100, a≈0, b≈0', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.l).toBeCloseTo(100, 0);
    expect(Math.abs(lab.a)).toBeLessThan(1);
    expect(Math.abs(lab.b)).toBeLessThan(1);
  });

  it('red → known LAB reference (L≈53, a≈80, b≈67)', () => {
    const lab = rgbToLab({ r: 255, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(53, 0);
    expect(lab.a).toBeCloseTo(80, 0);
    expect(lab.b).toBeCloseTo(67, 0);
  });

  it('blue → L≈32, positive b is negative (blue has negative b in LAB)', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 255 });
    expect(lab.l).toBeCloseTo(32, 0);
    expect(lab.b).toBeLessThan(0);
  });
});

describe('labToRgb', () => {
  it('L=0,a=0,b=0 → black (0,0,0)', () => {
    const rgb = labToRgb({ l: 0, a: 0, b: 0 });
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it('output values are clamped to 0–255', () => {
    // Extreme LAB values that fall outside sRGB gamut
    const rgb = labToRgb({ l: 100, a: 100, b: 100 });
    expect(rgb.r).toBeGreaterThanOrEqual(0);
    expect(rgb.r).toBeLessThanOrEqual(255);
    expect(rgb.g).toBeGreaterThanOrEqual(0);
    expect(rgb.g).toBeLessThanOrEqual(255);
    expect(rgb.b).toBeGreaterThanOrEqual(0);
    expect(rgb.b).toBeLessThanOrEqual(255);
  });
});

describe('rgbToLab / labToRgb round-trip', () => {
  const colors: RGB[] = [
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
    { r: 255, g: 255, b: 255 },
    { r: 0, g: 0, b: 0 },
    { r: 128, g: 64, b: 192 },
    { r: 100, g: 149, b: 237 },
    { r: 50, g: 50, b: 50 },
  ];

  for (const rgb of colors) {
    it(`round-trip (#${rgb.r.toString(16).padStart(2,'0')}${rgb.g.toString(16).padStart(2,'0')}${rgb.b.toString(16).padStart(2,'0')})`, () => {
      const lab = rgbToLab(rgb);
      const restored = labToRgb(lab);
      expect(Math.abs(restored.r - rgb.r)).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
      expect(Math.abs(restored.g - rgb.g)).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
      expect(Math.abs(restored.b - rgb.b)).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
    });
  }
});

// ============================================================================
// OKLAB
// ============================================================================

describe('rgbToOklab', () => {
  it('black → L≈0, a≈0, b≈0', () => {
    const ok = rgbToOklab({ r: 0, g: 0, b: 0 });
    expect(ok.L).toBeCloseTo(0, 3);
    expect(Math.abs(ok.a)).toBeLessThan(0.01);
    expect(Math.abs(ok.b)).toBeLessThan(0.01);
  });

  it('white → L≈1, a≈0, b≈0', () => {
    const ok = rgbToOklab({ r: 255, g: 255, b: 255 });
    expect(ok.L).toBeCloseTo(1, 2);
    expect(Math.abs(ok.a)).toBeLessThan(0.01);
    expect(Math.abs(ok.b)).toBeLessThan(0.01);
  });

  it('L is in [0, 1] range for any in-gamut RGB', () => {
    const colors: RGB[] = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 128, g: 128, b: 128 },
    ];
    for (const rgb of colors) {
      const ok = rgbToOklab(rgb);
      expect(ok.L).toBeGreaterThanOrEqual(0);
      expect(ok.L).toBeLessThanOrEqual(1);
    }
  });
});

describe('rgbToOklab / oklabToRgb round-trip', () => {
  const colors: RGB[] = [
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
    { r: 200, g: 100, b: 50 },
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
  ];

  for (const rgb of colors) {
    it(`round-trip (#${rgb.r.toString(16).padStart(2,'0')}${rgb.g.toString(16).padStart(2,'0')}${rgb.b.toString(16).padStart(2,'0')})`, () => {
      const ok = rgbToOklab(rgb);
      const restored = oklabToRgb(ok);
      expect(Math.abs(restored.r - rgb.r)).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
      expect(Math.abs(restored.g - rgb.g)).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
      expect(Math.abs(restored.b - rgb.b)).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
    });
  }
});

// ============================================================================
// RYB (artist's color wheel approximation)
// ============================================================================

describe('rgbToRyb', () => {
  it('all channels are in [0, 1] for standard RGB inputs', () => {
    const testColors: RGB[] = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 255, g: 255, b: 0 },
      { r: 128, g: 64, b: 32 },
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ];
    for (const rgb of testColors) {
      const ryb = rgbToRyb(rgb);
      expect(ryb.r).toBeGreaterThanOrEqual(0);
      expect(ryb.r).toBeLessThanOrEqual(1);
      expect(ryb.y).toBeGreaterThanOrEqual(0);
      expect(ryb.y).toBeLessThanOrEqual(1);
      expect(ryb.b).toBeGreaterThanOrEqual(0);
      expect(ryb.b).toBeLessThanOrEqual(1);
    }
  });

  it('black → (0,0,0) in RYB (achromatic colors preserve neutrality)', () => {
    const ryb = rgbToRyb({ r: 0, g: 0, b: 0 });
    expect(ryb.r).toBeCloseTo(0, 3);
    expect(ryb.y).toBeCloseTo(0, 3);
    expect(ryb.b).toBeCloseTo(0, 3);
  });
});

describe('rybToRgb', () => {
  it('output channels are clamped to [0, 255]', () => {
    const testRyb = [
      { r: 1, y: 0, b: 0 },
      { r: 0, y: 1, b: 0 },
      { r: 0, y: 0, b: 1 },
      { r: 0.8, y: 0.5, b: 0.2 },
    ];
    for (const ryb of testRyb) {
      const rgb = rybToRgb(ryb);
      expect(rgb.r).toBeGreaterThanOrEqual(0);
      expect(rgb.r).toBeLessThanOrEqual(255);
      expect(rgb.g).toBeGreaterThanOrEqual(0);
      expect(rgb.g).toBeLessThanOrEqual(255);
      expect(rgb.b).toBeGreaterThanOrEqual(0);
      expect(rgb.b).toBeLessThanOrEqual(255);
    }
  });

  it('black RYB → black RGB', () => {
    const rgb = rybToRgb({ r: 0, y: 0, b: 0 });
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });
});

// ============================================================================
// HSL
// ============================================================================

describe('rgbToHsl', () => {
  it('red → h≈0, s=1, l=0.5', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(hsl.h).toBeCloseTo(0, 1);
    expect(hsl.s).toBeCloseTo(1, 2);
    expect(hsl.l).toBeCloseTo(0.5, 2);
  });

  it('green → h≈120', () => {
    const hsl = rgbToHsl({ r: 0, g: 255, b: 0 });
    expect(hsl.h).toBeCloseTo(120, 1);
  });

  it('blue → h≈240', () => {
    const hsl = rgbToHsl({ r: 0, g: 0, b: 255 });
    expect(hsl.h).toBeCloseTo(240, 1);
  });

  it('gray → s=0 (achromatic)', () => {
    const hsl = rgbToHsl({ r: 128, g: 128, b: 128 });
    expect(hsl.s).toBe(0);
    expect(hsl.h).toBe(0);
  });

  it('black → l=0', () => {
    const hsl = rgbToHsl({ r: 0, g: 0, b: 0 });
    expect(hsl.l).toBeCloseTo(0, 3);
  });

  it('white → l=1', () => {
    const hsl = rgbToHsl({ r: 255, g: 255, b: 255 });
    expect(hsl.l).toBeCloseTo(1, 2);
  });
});

describe('rgbToHsl / hslToRgb round-trip', () => {
  const colors: RGB[] = [
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
    { r: 255, g: 255, b: 255 },
    { r: 0, g: 0, b: 0 },
    { r: 128, g: 64, b: 192 },
    { r: 255, g: 165, b: 0 },
  ];

  for (const rgb of colors) {
    it(`round-trip (#${rgb.r.toString(16).padStart(2,'0')}${rgb.g.toString(16).padStart(2,'0')}${rgb.b.toString(16).padStart(2,'0')})`, () => {
      const hsl = rgbToHsl(rgb);
      const restored = hslToRgb(hsl);
      expect(Math.abs(restored.r - rgb.r)).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
      expect(Math.abs(restored.g - rgb.g)).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
      expect(Math.abs(restored.b - rgb.b)).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
    });
  }
});

// ============================================================================
// Kubelka-Munk (Spectral) helpers
// ============================================================================

describe('rgbToReflectance / reflectanceToRgb', () => {
  it('normalizes RGB to [0, 1]', () => {
    const ref = rgbToReflectance({ r: 128, g: 64, b: 192 });
    expect(ref.r).toBeCloseTo(128 / 255, 4);
    expect(ref.g).toBeCloseTo(64 / 255, 4);
    expect(ref.b).toBeCloseTo(192 / 255, 4);
  });

  it('round-trips without loss', () => {
    const rgb: RGB = { r: 100, g: 200, b: 50 };
    const ref = rgbToReflectance(rgb);
    const restored = reflectanceToRgb(ref);
    expect(restored.r).toBe(rgb.r);
    expect(restored.g).toBe(rgb.g);
    expect(restored.b).toBe(rgb.b);
  });

  it('black stays black', () => {
    const ref = rgbToReflectance({ r: 0, g: 0, b: 0 });
    const rgb = reflectanceToRgb(ref);
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });
});

describe('reflectanceToKS / ksToReflectance', () => {
  it('K/S round-trip for typical reflectances', () => {
    const values = [0.1, 0.25, 0.5, 0.75, 0.9];
    for (const r of values) {
      const ks = reflectanceToKS(r);
      const restored = ksToReflectance(ks);
      expect(restored).toBeCloseTo(r, 4);
    }
  });

  it('K/S is non-negative for R in (0, 1)', () => {
    expect(reflectanceToKS(0.3)).toBeGreaterThanOrEqual(0);
    expect(reflectanceToKS(0.7)).toBeGreaterThanOrEqual(0);
  });

  it('clamps extreme inputs (0, 1) to avoid division by zero', () => {
    expect(() => reflectanceToKS(0)).not.toThrow();
    expect(() => reflectanceToKS(1)).not.toThrow();
    expect(() => reflectanceToKS(-0.5)).not.toThrow();
    expect(() => reflectanceToKS(1.5)).not.toThrow();
  });
});

// ============================================================================
// rgbToHex
// ============================================================================

describe('rgbToHex', () => {
  it('black → #000000', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
  });

  it('white → #ffffff', () => {
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
  });

  it('red → #ff0000', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
  });

  it('pads single hex digits with leading zero', () => {
    expect(rgbToHex({ r: 15, g: 0, b: 1 })).toBe('#0f0001');
  });

  it('output is always lowercase 7 chars including #', () => {
    const result = rgbToHex({ r: 170, g: 187, b: 204 });
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    expect(result).toBe('#aabbcc');
  });
});
