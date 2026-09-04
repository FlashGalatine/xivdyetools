/**
 * Unit tests for Color Blending
 *
 * Tests 6 blending modes (RGB, LAB, OKLAB, RYB, HSL, Spectral),
 * color space conversions, and edge cases.
 *
 * Migrated from apps/discord-worker/src/services/color-blending.test.ts
 */

import { describe, it, expect } from 'vitest';
import { blendColors } from './index.js';
import { rgbToRyb } from './conversions.js';
import type { BlendingMode } from './types.js';

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
    // Every mode, no exemptions. BUG-006: 'ryb' used to be exempt, and that is
    // what let green-maps-to-blue ship. Driven off ALL_MODES so a seventh mode
    // cannot be added without being covered here.
    for (const mode of ALL_MODES) {
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
    /**
     * BUG-006: 'ryb' used to be exempted from this list, and its stand-in
     * asserted only `r > 50 && b > 100` on a PURPLE — the one hue family the
     * defect did not touch. Green and blue mapped to the same RYB triple, so
     * every green and teal came back blue on the bot's default /mix mode, and
     * the suite stayed green throughout. The exemption is gone and the hues
     * that actually broke are covered below.
     */
    for (const mode of ALL_MODES) {
      it(`${mode}: blending a color with itself returns the same color`, () => {
        const result = blendColors('#8B5CF6', '#8B5CF6', mode);

        expect(result.rgb.r).toBeCloseTo(139, -1);
        expect(result.rgb.g).toBeCloseTo(92, -1);
        expect(result.rgb.b).toBeCloseTo(246, -1);
      });
    }

    it.each([
      ['pure green', '#00FF00'],
      ['mid green', '#40A040'],
      ['pale green', '#7FBF7F'],
      ['teal', '#008080'],
      ['pure blue', '#0000FF'],
      ['yellow', '#FFFF00'],
      ['olive', '#808000'],
      ['pure red', '#FF0000'],
    ])('ryb: %s blended with itself keeps its hue', (_label, hex) => {
      expect(blendColors(hex, hex, 'ryb').hex.toLowerCase()).toBe(hex.toLowerCase());
    });

    it('ryb: green and blue are distinguishable in RYB space', () => {
      // The defect: both collapsed to { r: 0, y: 0, b: 1 }, which is why the
      // round trip could not tell them apart.
      expect(rgbToRyb({ r: 0, g: 255, b: 0 })).not.toEqual(rgbToRyb({ r: 0, g: 0, b: 255 }));
    });

    it('ryb: blue and yellow make green, which is the point of RYB', () => {
      const mixed = blendColors('#0000FF', '#FFFF00', 'ryb');

      expect(mixed.rgb.g).toBeGreaterThan(mixed.rgb.r);
      expect(mixed.rgb.g).toBeGreaterThan(mixed.rgb.b);
    });
  });

  describe('black and white blending', () => {
    // No mode is exempt. The previous exemption asserted `< 50` on all three
    // channels under the heading "black dominates the mix (physically correct
    // pigment behavior)", which #010101 satisfied — as would a function that
    // returned pure black unconditionally. That is how the per-channel K/S
    // defect stayed green (2026-09-03 algorithm fact-check, P0).
    for (const mode of ALL_MODES) {
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
  });

  describe('spectral mode is Kubelka-Munk pigment mixing', () => {
    // Blue + yellow -> green is the canonical demonstration of K-M and the
    // reason the mode exists. It requires mixing spectral reflectance curves:
    // blue reflects the short third of the spectrum, yellow the middle-and-long
    // two thirds, and the surviving overlap is the green band (~500-565nm).
    // Three independent sRGB channels have no overlap to exploit, so a
    // per-channel implementation cannot produce it.
    it('blue and yellow make green', () => {
      const mixed = blendColors('#0000FF', '#FFFF00', 'spectral', 0.5);

      expect(mixed.rgb.g).toBeGreaterThan(mixed.rgb.r);
      expect(mixed.rgb.g).toBeGreaterThan(mixed.rgb.b);
    });

    // K/S = (1-R)^2 / 2R diverges as R -> 0. Applied per-channel to
    // gamma-encoded sRGB, any channel that is dark in EITHER input was forced
    // to ~0 at every ratio -- so a 90% yellow mix still came back near-black.
    it('a mostly-yellow mix is yellow, not near-black', () => {
      const mixed = blendColors('#0000FF', '#FFFF00', 'spectral', 0.9);

      expect(mixed.rgb.r).toBeGreaterThan(128);
      expect(mixed.rgb.g).toBeGreaterThan(128);
    });

    it('accepts shorthand #RGB hex like every other mode', () => {
      // spectral.js does not parse 3-digit hex: it yields "#NANNANNAN" rather
      // than throwing. Channels must be handed over already expanded.
      const short = blendColors('#00F', '#FF0', 'spectral', 0.5);
      const long = blendColors('#0000FF', '#FFFF00', 'spectral', 0.5);

      expect(short.hex).toBe(long.hex);
    });
  });

  describe('RGB mode specifics', () => {
    it('produces exact midpoint for equal mix', () => {
      const result = blendColors('#FF0000', '#0000FF', 'rgb', 0.5);

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
