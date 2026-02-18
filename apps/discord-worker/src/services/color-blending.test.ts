/**
 * Unit tests for Color Blending Service
 *
 * Tests 6 blending modes (RGB, LAB, OKLAB, RYB, HSL, Spectral),
 * color space conversions, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { blendColors, rgbToLab, getBlendingModeDescription } from './color-blending.js';
import type { BlendingMode } from '../types/preferences.js';

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

const ALL_MODES: BlendingMode[] = ['rgb', 'lab', 'oklab', 'ryb', 'hsl', 'spectral'];

describe('blendColors', () => {
  describe('all modes produce valid output', () => {
    for (const mode of ALL_MODES) {
      it(`${mode}: returns valid hex and RGB`, () => {
        const result = blendColors('#FF0000', '#0000FF', mode);

        expect(result.hex).toMatch(HEX_PATTERN);
        expect(result.rgb.r).toBeGreaterThanOrEqual(0);
        expect(result.rgb.r).toBeLessThanOrEqual(255);
        expect(result.rgb.g).toBeGreaterThanOrEqual(0);
        expect(result.rgb.g).toBeLessThanOrEqual(255);
        expect(result.rgb.b).toBeGreaterThanOrEqual(0);
        expect(result.rgb.b).toBeLessThanOrEqual(255);
      });
    }
  });

  describe('ratio boundaries', () => {
    // Modes with bijective color space conversions (ratio=0/1 return exact input)
    const bijectiveModes: BlendingMode[] = ['rgb', 'lab', 'oklab', 'hsl', 'spectral'];

    for (const mode of bijectiveModes) {
      it(`${mode}: ratio=0 returns first color`, () => {
        const result = blendColors('#FF6B6B', '#6BCB77', mode, 0);

        expect(result.rgb.r).toBeCloseTo(255, -1);
        expect(result.rgb.g).toBeCloseTo(107, -1);
        expect(result.rgb.b).toBeCloseTo(107, -1);
      });

      it(`${mode}: ratio=1 returns second color`, () => {
        const result = blendColors('#FF6B6B', '#6BCB77', mode, 1);

        expect(result.rgb.r).toBeCloseTo(107, -1);
        expect(result.rgb.g).toBeCloseTo(203, -1);
        expect(result.rgb.b).toBeCloseTo(119, -1);
      });
    }

    // RYB uses an approximate conversion — round-trip is lossy
    it('ryb: ratio=0 and ratio=1 still produce valid colors', () => {
      const at0 = blendColors('#FF6B6B', '#6BCB77', 'ryb', 0);
      const at1 = blendColors('#FF6B6B', '#6BCB77', 'ryb', 1);

      expect(at0.hex).toMatch(HEX_PATTERN);
      expect(at1.hex).toMatch(HEX_PATTERN);
      // ratio=0 should be closer to first color than ratio=1
      const dist0 = Math.abs(at0.rgb.r - 255) + Math.abs(at0.rgb.g - 107);
      const dist1 = Math.abs(at1.rgb.r - 255) + Math.abs(at1.rgb.g - 107);
      expect(dist0).toBeLessThan(dist1);
    });
  });

  describe('ratio clamping', () => {
    it('clamps negative ratio to 0', () => {
      const resultNeg = blendColors('#FF0000', '#0000FF', 'rgb', -5);
      const resultZero = blendColors('#FF0000', '#0000FF', 'rgb', 0);

      expect(resultNeg.hex).toBe(resultZero.hex);
    });

    it('clamps ratio > 1 to 1', () => {
      const resultOver = blendColors('#FF0000', '#0000FF', 'rgb', 10);
      const resultOne = blendColors('#FF0000', '#0000FF', 'rgb', 1);

      expect(resultOver.hex).toBe(resultOne.hex);
    });
  });

  describe('hex prefix normalization', () => {
    it('handles hex without # prefix', () => {
      const withHash = blendColors('#FF0000', '#0000FF', 'rgb');
      const withoutHash = blendColors('FF0000', '0000FF', 'rgb');

      expect(withHash.hex).toBe(withoutHash.hex);
    });

    it('handles mixed prefix formats', () => {
      const result = blendColors('#FF0000', '0000FF', 'rgb');
      expect(result.hex).toMatch(HEX_PATTERN);
    });
  });

  describe('same color input', () => {
    // Bijective modes return the same color when blending with itself
    const bijectiveModes: BlendingMode[] = ['rgb', 'lab', 'oklab', 'hsl', 'spectral'];

    for (const mode of bijectiveModes) {
      it(`${mode}: blending a color with itself returns the same color`, () => {
        const result = blendColors('#8B5CF6', '#8B5CF6', mode);

        expect(result.rgb.r).toBeCloseTo(139, -1);
        expect(result.rgb.g).toBeCloseTo(92, -1);
        expect(result.rgb.b).toBeCloseTo(246, -1);
      });
    }

    // RYB round-trip is lossy, so self-blend may drift
    it('ryb: blending a color with itself produces a valid result', () => {
      const result = blendColors('#8B5CF6', '#8B5CF6', 'ryb');

      expect(result.hex).toMatch(HEX_PATTERN);
      // Should still be in a recognizable range (not wildly different)
      expect(result.rgb.r).toBeGreaterThan(50);
      expect(result.rgb.b).toBeGreaterThan(100);
    });
  });

  describe('black and white blending', () => {
    // Most modes produce a mid-tone when blending black and white
    const midToneModes: BlendingMode[] = ['rgb', 'lab', 'oklab', 'ryb', 'hsl'];

    for (const mode of midToneModes) {
      it(`${mode}: blending black and white produces a mid-tone`, () => {
        const result = blendColors('#000000', '#FFFFFF', mode, 0.5);

        expect(result.rgb.r).toBeGreaterThan(50);
        expect(result.rgb.r).toBeLessThan(210);
        expect(result.rgb.g).toBeGreaterThan(50);
        expect(result.rgb.g).toBeLessThan(210);
        expect(result.rgb.b).toBeGreaterThan(50);
        expect(result.rgb.b).toBeLessThan(210);
      });
    }

    // Spectral (Kubelka-Munk) models real pigment mixing:
    // black has near-zero reflectance (K/S → ∞), so it dominates the mix
    it('spectral: black dominates the mix (physically correct pigment behavior)', () => {
      const result = blendColors('#000000', '#FFFFFF', 'spectral', 0.5);

      expect(result.hex).toMatch(HEX_PATTERN);
      // Result is very dark because black pigment absorbs light
      expect(result.rgb.r).toBeLessThan(50);
      expect(result.rgb.g).toBeLessThan(50);
      expect(result.rgb.b).toBeLessThan(50);
    });
  });

  describe('RGB mode specifics', () => {
    it('produces exact midpoint for equal mix', () => {
      const result = blendColors('#FF0000', '#0000FF', 'rgb', 0.5);

      // RGB midpoint of red and blue
      expect(result.rgb.r).toBe(128);
      expect(result.rgb.g).toBe(0);
      expect(result.rgb.b).toBe(128);
    });

    it('produces correct weighted blend', () => {
      const result = blendColors('#000000', '#FF0000', 'rgb', 0.25);

      expect(result.rgb.r).toBe(64);
      expect(result.rgb.g).toBe(0);
      expect(result.rgb.b).toBe(0);
    });
  });

  describe('default ratio', () => {
    it('uses 0.5 when ratio is not specified', () => {
      const withDefault = blendColors('#FF0000', '#0000FF', 'rgb');
      const withExplicit = blendColors('#FF0000', '#0000FF', 'rgb', 0.5);

      expect(withDefault.hex).toBe(withExplicit.hex);
    });
  });

  describe('default mode fallback', () => {
    it('falls back to RGB for unknown mode', () => {
      const result = blendColors('#FF0000', '#0000FF', 'unknown' as BlendingMode, 0.5);
      const rgbResult = blendColors('#FF0000', '#0000FF', 'rgb', 0.5);

      expect(result.hex).toBe(rgbResult.hex);
    });
  });

  describe('hex output format', () => {
    for (const mode of ALL_MODES) {
      it(`${mode}: output hex matches RGB values`, () => {
        const result = blendColors('#C084FC', '#34D399', mode);

        // Verify hex matches RGB
        const r = parseInt(result.hex.slice(1, 3), 16);
        const g = parseInt(result.hex.slice(3, 5), 16);
        const b = parseInt(result.hex.slice(5, 7), 16);

        expect(r).toBe(result.rgb.r);
        expect(g).toBe(result.rgb.g);
        expect(b).toBe(result.rgb.b);
      });
    }
  });
});

describe('rgbToLab', () => {
  it('converts pure white correctly', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });

    // White in LAB: L≈100, a≈0, b≈0
    expect(lab.l).toBeCloseTo(100, 0);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it('converts pure black correctly', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });

    // Black in LAB: L≈0, a≈0, b≈0
    expect(lab.l).toBeCloseTo(0, 0);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it('converts pure red to positive a*', () => {
    const lab = rgbToLab({ r: 255, g: 0, b: 0 });

    // Red has high L, positive a, positive b
    expect(lab.l).toBeGreaterThan(40);
    expect(lab.a).toBeGreaterThan(50);
  });

  it('converts pure green to negative a*', () => {
    const lab = rgbToLab({ r: 0, g: 128, b: 0 });

    // Green has negative a
    expect(lab.a).toBeLessThan(0);
  });

  it('maintains L ordering for greys', () => {
    const dark = rgbToLab({ r: 50, g: 50, b: 50 });
    const mid = rgbToLab({ r: 128, g: 128, b: 128 });
    const light = rgbToLab({ r: 200, g: 200, b: 200 });

    expect(dark.l).toBeLessThan(mid.l);
    expect(mid.l).toBeLessThan(light.l);
  });
});

describe('getBlendingModeDescription', () => {
  it('returns description for all valid modes', () => {
    for (const mode of ALL_MODES) {
      const desc = getBlendingModeDescription(mode);
      expect(desc).toBeDefined();
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    }
  });

  it('returns expected descriptions', () => {
    expect(getBlendingModeDescription('rgb')).toContain('averaging');
    expect(getBlendingModeDescription('lab')).toContain('CIELAB');
    expect(getBlendingModeDescription('spectral')).toContain('Kubelka-Munk');
  });
});
