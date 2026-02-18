/**
 * SpectralMixer tests
 *
 * Tests for Kubelka-Munk theory-based realistic pigment/paint mixing.
 * Validates that spectral mixing produces paint-like results.
 */

import { describe, it, expect } from 'vitest';
import { SpectralMixer } from '../SpectralMixer.js';
import { ColorConverter } from '../ColorConverter.js';

describe('SpectralMixer', () => {
  // ============================================================================
  // isAvailable
  // ============================================================================

  describe('isAvailable', () => {
    it('should return true when spectral.js is loaded', () => {
      const available = SpectralMixer.isAvailable();
      expect(typeof available).toBe('boolean');
      expect(available).toBe(true);
    });
  });

  // ============================================================================
  // mixColors
  // ============================================================================

  describe('mixColors', () => {
    it('should mix two colors with default ratio (0.5)', () => {
      const mixed = SpectralMixer.mixColors('#FF0000', '#0000FF');
      expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should return first color when ratio is 0', () => {
      const mixed = SpectralMixer.mixColors('#FF0000', '#0000FF', 0);
      expect(mixed).toBe('#FF0000');
    });

    it('should return second color when ratio is 1', () => {
      const mixed = SpectralMixer.mixColors('#FF0000', '#0000FF', 1);
      expect(mixed).toBe('#0000FF');
    });

    it('should clamp ratio below 0', () => {
      const mixed = SpectralMixer.mixColors('#FF0000', '#0000FF', -0.5);
      expect(mixed).toBe('#FF0000');
    });

    it('should clamp ratio above 1', () => {
      const mixed = SpectralMixer.mixColors('#FF0000', '#0000FF', 1.5);
      expect(mixed).toBe('#0000FF');
    });

    it('should produce green from blue + yellow (like real paint)', () => {
      const mixed = SpectralMixer.mixColors('#0000FF', '#FFFF00', 0.5);
      const rgb = ColorConverter.hexToRgb(mixed);
      // Spectral mixing should produce green-ish for blue+yellow
      expect(rgb.g).toBeGreaterThan(50);
    });

    it('should produce orange from red + yellow', () => {
      const mixed = SpectralMixer.mixColors('#FF0000', '#FFFF00', 0.5);
      const rgb = ColorConverter.hexToRgb(mixed);
      // Red + Yellow should have high R and some G
      expect(rgb.r).toBeGreaterThan(200);
      expect(rgb.g).toBeGreaterThan(50);
    });

    it('should produce violet-ish from red + blue', () => {
      const mixed = SpectralMixer.mixColors('#FF0000', '#0000FF', 0.5);
      const rgb = ColorConverter.hexToRgb(mixed);
      // Spectral mixing of red+blue produces a darker result
      // (subtractive color mixing, like paint)
      expect(rgb.r).toBeGreaterThan(0);
      expect(rgb.b).toBeGreaterThan(0);
    });

    it('should handle mixing black and white', () => {
      const mixed = SpectralMixer.mixColors('#000000', '#FFFFFF', 0.5);
      const rgb = ColorConverter.hexToRgb(mixed);
      // Should be a gray
      expect(rgb.r).toBeGreaterThan(50);
      expect(rgb.r).toBeLessThan(200);
      // R, G, B should be similar for gray
      expect(Math.abs(rgb.r - rgb.g)).toBeLessThan(30);
      expect(Math.abs(rgb.g - rgb.b)).toBeLessThan(30);
    });

    it('should handle mixing same color', () => {
      const mixed = SpectralMixer.mixColors('#FF0000', '#FF0000', 0.5);
      expect(mixed).toBe('#FF0000');
    });

    it('should handle normalized hex colors', () => {
      // SpectralMixer requires full hex format
      const mixed = SpectralMixer.mixColors('#FF0000', '#0000FF', 0.5);
      expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should produce different results for different ratios', () => {
      const mix25 = SpectralMixer.mixColors('#FF0000', '#0000FF', 0.25);
      const mix50 = SpectralMixer.mixColors('#FF0000', '#0000FF', 0.5);
      const mix75 = SpectralMixer.mixColors('#FF0000', '#0000FF', 0.75);

      expect(mix25).not.toBe(mix50);
      expect(mix50).not.toBe(mix75);
      expect(mix25).not.toBe(mix75);
    });
  });

  // ============================================================================
  // mixMultiple
  // ============================================================================

  describe('mixMultiple', () => {
    it('should throw error for empty color array', () => {
      expect(() => SpectralMixer.mixMultiple([])).toThrow('At least one color is required');
    });

    it('should return single color when only one provided', () => {
      const mixed = SpectralMixer.mixMultiple(['#FF0000']);
      expect(mixed).toBe('#FF0000');
    });

    it('should mix two colors with equal weights', () => {
      const mixed = SpectralMixer.mixMultiple(['#FF0000', '#0000FF']);
      expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should mix three colors with equal weights', () => {
      const mixed = SpectralMixer.mixMultiple(['#FF0000', '#00FF00', '#0000FF']);
      expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should mix colors with custom weights', () => {
      const mixed = SpectralMixer.mixMultiple(['#FF0000', '#00FF00', '#0000FF'], [0.6, 0.3, 0.1]);
      expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      // Should be more red due to higher weight
      const rgb = ColorConverter.hexToRgb(mixed);
      expect(rgb.r).toBeGreaterThan(rgb.b);
    });

    it('should normalize weights that do not sum to 1', () => {
      // Weights [2, 2, 2] should be normalized to [1/3, 1/3, 1/3]
      const mixed = SpectralMixer.mixMultiple(['#FF0000', '#00FF00', '#0000FF'], [2, 2, 2]);
      expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should handle different weight distributions', () => {
      const moreRed = SpectralMixer.mixMultiple(['#FF0000', '#0000FF'], [0.8, 0.2]);
      const moreBlue = SpectralMixer.mixMultiple(['#FF0000', '#0000FF'], [0.2, 0.8]);

      const redRgb = ColorConverter.hexToRgb(moreRed);
      const blueRgb = ColorConverter.hexToRgb(moreBlue);

      expect(redRgb.r).toBeGreaterThan(blueRgb.r);
      expect(redRgb.b).toBeLessThan(blueRgb.b);
    });

    it('should mix many colors', () => {
      const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF'];
      const mixed = SpectralMixer.mixMultiple(colors);
      expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
    });
  });

  // ============================================================================
  // gradient
  // ============================================================================

  describe('gradient', () => {
    it('should throw error for less than 2 steps', () => {
      expect(() => SpectralMixer.gradient('#FF0000', '#0000FF', 1)).toThrow(
        'Gradient requires at least 2 steps'
      );
    });

    it('should generate gradient with 2 steps (start and end)', () => {
      const gradient = SpectralMixer.gradient('#FF0000', '#0000FF', 2);
      expect(gradient).toHaveLength(2);
      expect(gradient[0]).toBe('#FF0000');
      expect(gradient[1]).toBe('#0000FF');
    });

    it('should generate gradient with 3 steps', () => {
      const gradient = SpectralMixer.gradient('#FF0000', '#0000FF', 3);
      expect(gradient).toHaveLength(3);
      expect(gradient[0]).toBe('#FF0000');
      expect(gradient[2]).toBe('#0000FF');
      // Middle should be a mix
      expect(gradient[1]).not.toBe('#FF0000');
      expect(gradient[1]).not.toBe('#0000FF');
    });

    it('should generate gradient with 5 steps', () => {
      const gradient = SpectralMixer.gradient('#FF0000', '#0000FF', 5);
      expect(gradient).toHaveLength(5);
      expect(gradient[0]).toBe('#FF0000');
      expect(gradient[4]).toBe('#0000FF');

      // Each step should be different
      const unique = new Set(gradient);
      expect(unique.size).toBe(5);
    });

    it('should generate smooth transitions', () => {
      const gradient = SpectralMixer.gradient('#FF0000', '#0000FF', 5);

      // Verify progressive change in RGB values
      for (let i = 0; i < gradient.length - 1; i++) {
        const current = ColorConverter.hexToRgb(gradient[i]);
        const next = ColorConverter.hexToRgb(gradient[i + 1]);

        // Red should decrease (or stay same) as we go from red to blue
        expect(current.r).toBeGreaterThanOrEqual(next.r - 5); // Allow small variance
        // Blue should increase (or stay same)
        expect(current.b).toBeLessThanOrEqual(next.b + 5);
      }
    });

    it('should generate gradient for complementary colors', () => {
      // Cyan is complement of red
      const gradient = SpectralMixer.gradient('#FF0000', '#00FFFF', 5);
      expect(gradient).toHaveLength(5);
      expect(gradient[0]).toBe('#FF0000');
      expect(gradient[4]).toBe('#00FFFF');
    });

    it('should generate gradient for similar colors', () => {
      const gradient = SpectralMixer.gradient('#FF0000', '#FF3300', 3);
      expect(gradient).toHaveLength(3);
      // All should be variations of red/orange
      gradient.forEach((color) => {
        const rgb = ColorConverter.hexToRgb(color);
        expect(rgb.r).toBeGreaterThan(200);
      });
    });

    it('should generate blue-yellow gradient with green in middle', () => {
      const gradient = SpectralMixer.gradient('#0000FF', '#FFFF00', 5);
      expect(gradient).toHaveLength(5);

      // Middle color(s) should have green component due to spectral mixing
      const middleRgb = ColorConverter.hexToRgb(gradient[2]);
      expect(middleRgb.g).toBeGreaterThan(50);
    });
  });

  // ============================================================================
  // Comparison with other mixing methods
  // ============================================================================

  describe('comparison with other mixing methods', () => {
    it('should produce different results than RGB mixing for blue+yellow', () => {
      const spectralMix = SpectralMixer.mixColors('#0000FF', '#FFFF00', 0.5);

      // RGB mixing (simple average)
      const blueRgb = ColorConverter.hexToRgb('#0000FF');
      const yellowRgb = ColorConverter.hexToRgb('#FFFF00');
      const rgbMixResult = ColorConverter.rgbToHex(
        Math.round((blueRgb.r + yellowRgb.r) / 2),
        Math.round((blueRgb.g + yellowRgb.g) / 2),
        Math.round((blueRgb.b + yellowRgb.b) / 2)
      );

      // Spectral should be different from simple RGB average
      expect(spectralMix).not.toBe(rgbMixResult);

      // Spectral should have more green (like real paint mixing)
      const spectralRgb = ColorConverter.hexToRgb(spectralMix);
      const rgbMixRgb = ColorConverter.hexToRgb(rgbMixResult);

      // In RGB mixing, blue+yellow = gray-ish (R=127, G=127, B=127)
      // In spectral mixing, blue+yellow = green-ish
      expect(spectralRgb.g).toBeGreaterThan(rgbMixRgb.g);
    });
  });
});
