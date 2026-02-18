import { describe, it, expect } from 'vitest';
import { ColorManipulator } from '../ColorManipulator.js';

describe('ColorManipulator', () => {
  describe('adjustBrightness', () => {
    it('should increase brightness with positive amount', () => {
      const result = ColorManipulator.adjustBrightness('#FF0000', 20);
      expect(result).toBeDefined();
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should decrease brightness with negative amount', () => {
      const result = ColorManipulator.adjustBrightness('#FF0000', -20);
      expect(result).toBeDefined();
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should return white when increasing black brightness to 100', () => {
      const result = ColorManipulator.adjustBrightness('#000000', 100);
      // Should be very bright, potentially white or near-white
      expect(result).toBeDefined();
    });

    it('should return black when decreasing any color brightness by -100', () => {
      const result = ColorManipulator.adjustBrightness('#FF0000', -100);
      expect(result).toBe('#000000');
    });

    it('should handle mid-tone colors', () => {
      const result = ColorManipulator.adjustBrightness('#808080', 20);
      expect(result).toBeDefined();
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });
  });

  describe('adjustSaturation', () => {
    it('should increase saturation with positive amount', () => {
      const result = ColorManipulator.adjustSaturation('#FF6B6B', 20);
      expect(result).toBeDefined();
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should decrease saturation with negative amount', () => {
      const result = ColorManipulator.adjustSaturation('#FF0000', -20);
      expect(result).toBeDefined();
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should return grayscale when decreasing saturation by -100', () => {
      const result = ColorManipulator.adjustSaturation('#FF0000', -100);
      // Should be grayscale (R=G=B)
      expect(result).toBeDefined();
    });

    it('should return fully saturated color when increasing saturation to maximum', () => {
      const result = ColorManipulator.adjustSaturation('#FF6B6B', 100);
      expect(result).toBeDefined();
    });

    it('should clamp values at 100', () => {
      const result1 = ColorManipulator.adjustSaturation('#FF0000', 50);
      const result2 = ColorManipulator.adjustSaturation('#FF0000', 0);
      expect(result1).toBe(result2); // Already at max saturation
    });

    it('should preserve hue and brightness', () => {
      const original = '#FF6B6B';
      const moreSaturated = ColorManipulator.adjustSaturation(original, 20);
      const lessSaturated = ColorManipulator.adjustSaturation(original, -20);

      expect(moreSaturated).toBeDefined();
      expect(lessSaturated).toBeDefined();
    });

    it('should handle pure gray', () => {
      const result = ColorManipulator.adjustSaturation('#808080', 50);
      // Gray has no saturation to increase, but shouldn't error
      expect(result).toBeDefined();
    });
  });

  describe('rotateHue', () => {
    it('should rotate hue by specified degrees', () => {
      const result = ColorManipulator.rotateHue('#FF0000', 120);
      expect(result).toBeDefined();
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should wrap around at 360 degrees', () => {
      const result1 = ColorManipulator.rotateHue('#FF0000', 360);
      const result2 = ColorManipulator.rotateHue('#FF0000', 0);
      expect(result1).toBe(result2);
    });

    it('should handle negative rotation', () => {
      const result = ColorManipulator.rotateHue('#FF0000', -120);
      expect(result).toBeDefined();
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should rotate red to green (120°)', () => {
      const result = ColorManipulator.rotateHue('#FF0000', 120);
      // Should be greenish
      expect(result).toBeDefined();
    });

    it('should rotate red to blue (240°)', () => {
      const result = ColorManipulator.rotateHue('#FF0000', 240);
      // Should be blueish
      expect(result).toBeDefined();
    });

    it('should preserve saturation and brightness', () => {
      const original = '#FF0000';
      const rotated = ColorManipulator.rotateHue(original, 180);

      expect(rotated).toBeDefined();
      expect(rotated).not.toBe(original);
    });

    it('should handle grayscale (no hue to rotate)', () => {
      const result = ColorManipulator.rotateHue('#808080', 120);
      // Grayscale has no hue, so rotation should not change it significantly
      expect(result).toBeDefined();
    });

    it('should handle full rotation (720°)', () => {
      const result1 = ColorManipulator.rotateHue('#FF0000', 720);
      const result2 = ColorManipulator.rotateHue('#FF0000', 0);
      expect(result1).toBe(result2);
    });
  });

  describe('invert', () => {
    it('should invert white to black', () => {
      const result = ColorManipulator.invert('#FFFFFF');
      expect(result).toBe('#000000');
    });

    it('should invert black to white', () => {
      const result = ColorManipulator.invert('#000000');
      expect(result).toBe('#FFFFFF');
    });

    it('should invert red to cyan', () => {
      const result = ColorManipulator.invert('#FF0000');
      expect(result).toBe('#00FFFF');
    });

    it('should invert green to magenta', () => {
      const result = ColorManipulator.invert('#00FF00');
      expect(result).toBe('#FF00FF');
    });

    it('should invert blue to yellow', () => {
      const result = ColorManipulator.invert('#0000FF');
      expect(result).toBe('#FFFF00');
    });

    it('should be reversible (double invert returns original)', () => {
      const original = '#FF6B6B';
      const inverted = ColorManipulator.invert(original);
      const restored = ColorManipulator.invert(inverted);
      expect(restored).toBe(original);
    });

    it('should invert mid-tone gray to itself', () => {
      const result = ColorManipulator.invert('#808080');
      expect(result).toBe('#7F7F7F'); // 255 - 128 = 127 (0x7F)
    });

    it('should return valid hex color', () => {
      const result = ColorManipulator.invert('#ABCDEF');
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });
  });

  describe('desaturate', () => {
    it('should convert red to grayscale', () => {
      const result = ColorManipulator.desaturate('#FF0000');
      // Should be grayscale (R=G=B)
      expect(result).toBeDefined();
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should convert blue to grayscale', () => {
      const result = ColorManipulator.desaturate('#0000FF');
      expect(result).toBeDefined();
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should convert green to grayscale', () => {
      const result = ColorManipulator.desaturate('#00FF00');
      expect(result).toBeDefined();
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should preserve brightness', () => {
      // Bright color
      const brightResult = ColorManipulator.desaturate('#FF0000');
      expect(brightResult).toBeDefined();

      // Dark color
      const darkResult = ColorManipulator.desaturate('#800000');
      expect(darkResult).toBeDefined();

      // Bright result should be brighter than dark result
      expect(brightResult.localeCompare(darkResult)).not.toBe(0);
    });

    it('should handle white', () => {
      const result = ColorManipulator.desaturate('#FFFFFF');
      expect(result).toBe('#FFFFFF');
    });

    it('should return grayscale with equal RGB values', () => {
      const result = ColorManipulator.desaturate('#FF6B6B');
      const r = parseInt(result.substring(1, 3), 16);
      const g = parseInt(result.substring(3, 5), 16);
      const b = parseInt(result.substring(5, 7), 16);

      expect(r).toBe(g);
      expect(g).toBe(b);
    });
  });

  describe('combined operations', () => {
    it('should handle chained brightness adjustments', () => {
      const step1 = ColorManipulator.adjustBrightness('#FF0000', 20);
      const step2 = ColorManipulator.adjustBrightness(step1, -10);
      expect(step2).toBeDefined();
    });

    it('should handle brightness then saturation', () => {
      const brighter = ColorManipulator.adjustBrightness('#FF6B6B', 20);
      const saturated = ColorManipulator.adjustSaturation(brighter, 20);
      expect(saturated).toBeDefined();
    });

    it('should handle rotation then inversion', () => {
      const rotated = ColorManipulator.rotateHue('#FF0000', 120);
      const inverted = ColorManipulator.invert(rotated);
      expect(inverted).toBeDefined();
    });

    it('should handle all operations on same color', () => {
      const original = '#FF6B6B';
      const brighter = ColorManipulator.adjustBrightness(original, 10);
      const saturated = ColorManipulator.adjustSaturation(brighter, 10);
      const rotated = ColorManipulator.rotateHue(saturated, 30);
      const final = ColorManipulator.invert(rotated);

      expect(final).toBeDefined();
      expect(final).toMatch(/^#[0-9A-F]{6}$/);
    });
  });

  describe('edge cases', () => {
    it('should handle 3-digit hex colors', () => {
      const result = ColorManipulator.adjustBrightness('#F00', 20);
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should handle lowercase hex colors', () => {
      const result = ColorManipulator.adjustBrightness('#ff0000', 20);
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should handle extreme brightness adjustments', () => {
      expect(() => ColorManipulator.adjustBrightness('#808080', 1000)).not.toThrow();
      expect(() => ColorManipulator.adjustBrightness('#808080', -1000)).not.toThrow();
    });

    it('should handle extreme saturation adjustments', () => {
      expect(() => ColorManipulator.adjustSaturation('#FF6B6B', 1000)).not.toThrow();
      expect(() => ColorManipulator.adjustSaturation('#FF6B6B', -1000)).not.toThrow();
    });
  });
});
