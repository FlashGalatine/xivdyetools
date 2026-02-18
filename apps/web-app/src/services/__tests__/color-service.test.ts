/**
 * XIV Dye Tools - ColorService Unit Tests
 * Tests for color conversion and colorblindness simulation
 */

import { ColorService } from '@xivdyetools/core';

describe('ColorService', () => {
  // ============================================================================
  // Hex to RGB Conversion Tests
  // ============================================================================

  describe('hexToRgb', () => {
    it('should convert standard hex color to RGB', () => {
      const result = ColorService.hexToRgb('#FF0000');
      expect(result).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should convert shorthand hex to RGB', () => {
      const result = ColorService.hexToRgb('#F00');
      expect(result).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should handle lowercase hex', () => {
      const result = ColorService.hexToRgb('#ff0000');
      expect(result).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should convert white color', () => {
      const result = ColorService.hexToRgb('#FFFFFF');
      expect(result).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('should convert black color', () => {
      const result = ColorService.hexToRgb('#000000');
      expect(result).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should throw error for invalid hex', () => {
      expect(() => ColorService.hexToRgb('invalid')).toThrow();
      expect(() => ColorService.hexToRgb('#GGG')).toThrow();
    });
  });

  // ============================================================================
  // RGB to Hex Conversion Tests
  // ============================================================================

  describe('rgbToHex', () => {
    it('should convert RGB to hex', () => {
      const result = ColorService.rgbToHex(255, 0, 0);
      expect(result).toBe('#FF0000');
    });

    it('should handle leading zeros in hex', () => {
      const result = ColorService.rgbToHex(0, 15, 0);
      expect(result).toBe('#000F00');
    });

    it('should throw error for invalid RGB values', () => {
      expect(() => ColorService.rgbToHex(256, 0, 0)).toThrow();
      expect(() => ColorService.rgbToHex(-1, 0, 0)).toThrow();
    });
  });

  // ============================================================================
  // RGB to HSV Conversion Tests
  // ============================================================================

  describe('rgbToHsv', () => {
    it('should convert red to HSV', () => {
      const result = ColorService.rgbToHsv(255, 0, 0);
      expect(result.h).toBe(0);
      expect(result.s).toBe(100);
      expect(result.v).toBeCloseTo(100, 1);
    });

    it('should convert green to HSV', () => {
      const result = ColorService.rgbToHsv(0, 255, 0);
      expect(result.h).toBeCloseTo(120, 0);
      expect(result.s).toBeCloseTo(100, 1);
      expect(result.v).toBeCloseTo(100, 1);
    });

    it('should convert grayscale to zero saturation', () => {
      const result = ColorService.rgbToHsv(128, 128, 128);
      expect(result.s).toBe(0);
    });

    it('should convert black to HSV', () => {
      const result = ColorService.rgbToHsv(0, 0, 0);
      expect(result.v).toBe(0);
    });
  });

  // ============================================================================
  // HSV to RGB Conversion Tests
  // ============================================================================

  describe('hsvToRgb', () => {
    it('should convert red HSV to RGB', () => {
      const result = ColorService.hsvToRgb(0, 100, 100);
      expect(result).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should convert green HSV to RGB', () => {
      const result = ColorService.hsvToRgb(120, 100, 100);
      expect(result.r).toBe(0);
      expect(result.g).toBe(255);
      expect(result.b).toBe(0);
    });

    it('should handle invalid HSV values', () => {
      expect(() => ColorService.hsvToRgb(361, 100, 100)).toThrow();
      expect(() => ColorService.hsvToRgb(0, 101, 100)).toThrow();
    });
  });

  // ============================================================================
  // Color Distance Tests
  // ============================================================================

  describe('getColorDistance', () => {
    it('should return 0 for identical colors', () => {
      const distance = ColorService.getColorDistance('#FF0000', '#FF0000');
      expect(distance).toBe(0);
    });

    it('should calculate distance between red and blue', () => {
      const distance = ColorService.getColorDistance('#FF0000', '#0000FF');
      // Red to Blue is ~360.6 (opposite corners of RGB cube)
      expect(distance).toBeCloseTo(360.62, 0);
      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(450); // Max is ~441.67 (white to black)
    });

    it('should calculate distance between white and black', () => {
      const distance = ColorService.getColorDistance('#FFFFFF', '#000000');
      expect(distance).toBeCloseTo(441.67, 0);
    });

    it('should be symmetric', () => {
      const distance1 = ColorService.getColorDistance('#FF0000', '#00FF00');
      const distance2 = ColorService.getColorDistance('#00FF00', '#FF0000');
      expect(distance1).toBe(distance2);
    });
  });

  // ============================================================================
  // Colorblindness Simulation Tests
  // ============================================================================

  describe('simulateColorblindness', () => {
    it('should return same color for normal vision', () => {
      const original = { r: 255, g: 0, b: 0 };
      const result = ColorService.simulateColorblindness(original, 'normal');
      expect(result).toEqual(original);
    });

    it('should transform color for deuteranopia', () => {
      const original = { r: 255, g: 0, b: 0 };
      const result = ColorService.simulateColorblindness(original, 'deuteranopia');
      expect(result).not.toEqual(original);
      expect(result.r).toBeGreaterThanOrEqual(0);
      expect(result.r).toBeLessThanOrEqual(255);
    });

    it('should transform color for protanopia', () => {
      const original = { r: 255, g: 0, b: 0 };
      const result = ColorService.simulateColorblindness(original, 'protanopia');
      expect(result).not.toEqual(original);
    });

    it('should transform color for tritanopia', () => {
      const original = { r: 0, g: 255, b: 0 };
      const result = ColorService.simulateColorblindness(original, 'tritanopia');
      expect(result).not.toEqual(original);
    });

    it('should desaturate color for achromatopsia', () => {
      const original = { r: 255, g: 0, b: 0 };
      const result = ColorService.simulateColorblindness(original, 'achromatopsia');
      // All RGB values should be similar (grayscale)
      expect(result.r).toBeCloseTo(result.g, 10);
      expect(result.g).toBeCloseTo(result.b, 10);
    });
  });

  // ============================================================================
  // Contrast Ratio Tests
  // ============================================================================

  describe('getContrastRatio', () => {
    it('should return 21 for white on black', () => {
      const ratio = ColorService.getContrastRatio('#FFFFFF', '#000000');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should return 1 for identical colors', () => {
      const ratio = ColorService.getContrastRatio('#FF0000', '#FF0000');
      expect(ratio).toBeCloseTo(1, 0);
    });

    it('should meet WCAG AA for high contrast', () => {
      const result = ColorService.meetsWCAGAA('#FFFFFF', '#000000');
      expect(result).toBe(true);
    });

    it('should not meet WCAG AA for low contrast', () => {
      const result = ColorService.meetsWCAGAA('#FF0000', '#FF0000');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Color Manipulation Tests
  // ============================================================================

  describe('adjustBrightness', () => {
    it('should increase brightness', () => {
      const result = ColorService.adjustBrightness('#800000', 50);
      expect(result).not.toBe('#800000');
    });

    it('should clamp brightness to valid range', () => {
      const result = ColorService.adjustBrightness('#FFFFFF', 50);
      expect(result).toBe('#FFFFFF');
    });
  });

  describe('invert', () => {
    it('should invert red to cyan', () => {
      const result = ColorService.invert('#FF0000');
      expect(result).toBe('#00FFFF');
    });

    it('should invert white to black', () => {
      const result = ColorService.invert('#FFFFFF');
      expect(result).toBe('#000000');
    });
  });

  describe('desaturate', () => {
    it('should convert color to grayscale', () => {
      const result = ColorService.desaturate('#FF0000');
      const hsv = ColorService.hexToHsv(result);
      expect(hsv.s).toBe(0);
    });
  });

  // ============================================================================
  // Luminance and Text Color Tests
  // ============================================================================

  describe('isLightColor', () => {
    it('should identify white as light', () => {
      expect(ColorService.isLightColor('#FFFFFF')).toBe(true);
    });

    it('should identify black as dark', () => {
      expect(ColorService.isLightColor('#000000')).toBe(false);
    });

    it('should identify yellow as light', () => {
      expect(ColorService.isLightColor('#FFFF00')).toBe(true);
    });
  });

  describe('getOptimalTextColor', () => {
    it('should return black text for light background', () => {
      const textColor = ColorService.getOptimalTextColor('#FFFFFF');
      expect(textColor).toBe('#000000');
    });

    it('should return white text for dark background', () => {
      const textColor = ColorService.getOptimalTextColor('#000000');
      expect(textColor).toBe('#FFFFFF');
    });
  });
});
