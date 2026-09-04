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
        Math.round((blueRgb.b + yellowRgb.b) / 2),
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

  describe('input parsing', () => {
    // spectral.js does not parse shorthand hex, and does not throw on it: it
    // yields the string "#NANNANNAN", which normalizeHex then rejects. So
    // mixColors('#00F', '#FF0') threw where every other mixer accepted it.
    // Expand to 6 digits before handing colours to spectral.js.
    it('accepts shorthand #RGB hex', () => {
      const short = SpectralMixer.mixColors('#00F', '#FF0', 0.5);
      const long = SpectralMixer.mixColors('#0000FF', '#FFFF00', 0.5);

      expect(short).toBe(long);
    });

    it('accepts lowercase hex', () => {
      expect(SpectralMixer.mixColors('#0000ff', '#ffff00', 0.5)).toBe(
        SpectralMixer.mixColors('#0000FF', '#FFFF00', 0.5),
      );
    });
  });
});
