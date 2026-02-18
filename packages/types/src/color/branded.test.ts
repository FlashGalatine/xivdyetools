/**
 * @xivdyetools/types - Branded Color Types Tests
 *
 * Comprehensive tests for branded type factory functions.
 */
import { describe, it, expect } from 'vitest';
import {
  createHexColor,
  createDyeId,
  createHue,
  createSaturation,
  type HexColor,
  type DyeId,
  type Hue,
  type Saturation,
} from './branded.js';

describe('createHexColor', () => {
  describe('valid inputs', () => {
    it('should accept valid 6-digit hex colors', () => {
      expect(createHexColor('#FF0000')).toBe('#FF0000');
      expect(createHexColor('#00ff00')).toBe('#00FF00');
      expect(createHexColor('#0000FF')).toBe('#0000FF');
      expect(createHexColor('#123456')).toBe('#123456');
      expect(createHexColor('#abcdef')).toBe('#ABCDEF');
    });

    it('should accept valid 3-digit hex colors and expand them', () => {
      expect(createHexColor('#F00')).toBe('#FF0000');
      expect(createHexColor('#0f0')).toBe('#00FF00');
      expect(createHexColor('#00F')).toBe('#0000FF');
      expect(createHexColor('#abc')).toBe('#AABBCC');
      expect(createHexColor('#123')).toBe('#112233');
    });

    it('should normalize to uppercase', () => {
      expect(createHexColor('#aabbcc')).toBe('#AABBCC');
      expect(createHexColor('#AbCdEf')).toBe('#ABCDEF');
    });

    it('should preserve case-insensitive hex digits', () => {
      expect(createHexColor('#AaBbCc')).toBe('#AABBCC');
    });
  });

  describe('invalid inputs', () => {
    it('should throw for missing hash prefix', () => {
      expect(() => createHexColor('FF0000')).toThrow('Invalid hex color format');
      expect(() => createHexColor('F00')).toThrow('Invalid hex color format');
    });

    it('should throw for invalid length', () => {
      expect(() => createHexColor('#F')).toThrow('Invalid hex color format');
      expect(() => createHexColor('#FF')).toThrow('Invalid hex color format');
      expect(() => createHexColor('#FFFF')).toThrow('Invalid hex color format');
      expect(() => createHexColor('#FFFFF')).toThrow('Invalid hex color format');
      expect(() => createHexColor('#FFFFFFF')).toThrow('Invalid hex color format');
    });

    it('should throw for invalid characters', () => {
      expect(() => createHexColor('#GGGGGG')).toThrow('Invalid hex color format');
      expect(() => createHexColor('#XYZ123')).toThrow('Invalid hex color format');
      expect(() => createHexColor('#12345G')).toThrow('Invalid hex color format');
      expect(() => createHexColor('#GGG')).toThrow('Invalid hex color format');
    });

    it('should throw for empty string', () => {
      expect(() => createHexColor('')).toThrow('Invalid hex color format');
    });

    it('should throw for whitespace', () => {
      expect(() => createHexColor(' #FF0000')).toThrow('Invalid hex color format');
      expect(() => createHexColor('#FF0000 ')).toThrow('Invalid hex color format');
      expect(() => createHexColor(' ')).toThrow('Invalid hex color format');
    });

    it('should include the invalid value in error message', () => {
      expect(() => createHexColor('invalid')).toThrow('invalid');
      expect(() => createHexColor('#GGG')).toThrow('#GGG');
    });
  });

  describe('edge cases', () => {
    it('should handle black and white', () => {
      expect(createHexColor('#000000')).toBe('#000000');
      expect(createHexColor('#FFFFFF')).toBe('#FFFFFF');
      expect(createHexColor('#000')).toBe('#000000');
      expect(createHexColor('#FFF')).toBe('#FFFFFF');
    });

    it('should handle all 0s and all Fs', () => {
      expect(createHexColor('#000')).toBe('#000000');
      expect(createHexColor('#fff')).toBe('#FFFFFF');
    });
  });
});

describe('createDyeId', () => {
  describe('valid regular IDs (1-200)', () => {
    it('should accept valid dye IDs (1-200)', () => {
      expect(createDyeId(1)).toBe(1);
      expect(createDyeId(100)).toBe(100);
      expect(createDyeId(200)).toBe(200);
    });

    it('should accept boundary values', () => {
      expect(createDyeId(1)).toBe(1);
      expect(createDyeId(200)).toBe(200);
    });
  });

  // TYPES-102: Synthetic IDs for Facewear dyes
  describe('valid synthetic IDs (<= -1000)', () => {
    it('should accept synthetic Facewear dye IDs', () => {
      expect(createDyeId(-1000)).toBe(-1000);
      expect(createDyeId(-1500)).toBe(-1500);
      expect(createDyeId(-2000)).toBe(-2000);
    });

    it('should accept boundary synthetic value (-1000)', () => {
      expect(createDyeId(-1000)).toBe(-1000);
    });

    it('should accept very negative synthetic IDs', () => {
      expect(createDyeId(-10000)).toBe(-10000);
      expect(createDyeId(-999999)).toBe(-999999);
    });
  });

  describe('invalid inputs', () => {
    it('should return null for ID 0', () => {
      expect(createDyeId(0)).toBeNull();
    });

    it('should return null for IDs in the gap between regular and synthetic ranges', () => {
      // Gap: -999 to 0 (exclusive)
      expect(createDyeId(-1)).toBeNull();
      expect(createDyeId(-100)).toBeNull();
      expect(createDyeId(-500)).toBeNull();
      expect(createDyeId(-999)).toBeNull();
    });

    it('should return null for IDs above 200', () => {
      expect(createDyeId(201)).toBeNull();
      expect(createDyeId(999)).toBeNull();
      expect(createDyeId(1000)).toBeNull();
    });

    it('should return null for non-integer values', () => {
      expect(createDyeId(1.5)).toBeNull();
      expect(createDyeId(100.1)).toBeNull();
      expect(createDyeId(0.9)).toBeNull();
      expect(createDyeId(-1000.5)).toBeNull();
    });

    it('should return null for NaN', () => {
      expect(createDyeId(NaN)).toBeNull();
    });

    it('should return null for Infinity', () => {
      expect(createDyeId(Infinity)).toBeNull();
      expect(createDyeId(-Infinity)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle exact boundary values for regular IDs', () => {
      expect(createDyeId(1)).toBe(1);
      expect(createDyeId(200)).toBe(200);
      expect(createDyeId(0)).toBeNull();
      expect(createDyeId(201)).toBeNull();
    });

    it('should handle exact boundary values for synthetic IDs', () => {
      expect(createDyeId(-1000)).toBe(-1000);
      expect(createDyeId(-999)).toBeNull();
    });

    it('should return the same numeric value when valid', () => {
      const result = createDyeId(42);
      expect(result).toBe(42);
      expect(typeof result).toBe('number');
    });

    it('should return the same negative value for synthetic IDs', () => {
      const result = createDyeId(-1500);
      expect(result).toBe(-1500);
      expect(typeof result).toBe('number');
    });
  });
});

describe('createHue', () => {
  describe('valid inputs', () => {
    it('should accept values in 0-360 range', () => {
      expect(createHue(0)).toBe(0);
      expect(createHue(180)).toBe(180);
      expect(createHue(359)).toBe(359);
    });

    it('should accept exact 360 and normalize to 0', () => {
      expect(createHue(360)).toBe(0);
    });
  });

  describe('normalization', () => {
    it('should wrap values above 360', () => {
      expect(createHue(400)).toBe(40);
      expect(createHue(720)).toBe(0);
      expect(createHue(450)).toBe(90);
      expect(createHue(361)).toBe(1);
    });

    it('should wrap negative values', () => {
      expect(createHue(-30)).toBe(330);
      expect(createHue(-90)).toBe(270);
      expect(createHue(-180)).toBe(180);
      expect(createHue(-360)).toBe(0);
      expect(createHue(-1)).toBe(359);
    });

    it('should handle large positive values', () => {
      expect(createHue(3600)).toBe(0);
      expect(createHue(3650)).toBe(50);
    });

    it('should handle large negative values', () => {
      expect(createHue(-3600)).toBe(0);
      expect(createHue(-3650)).toBe(310);
    });
  });

  describe('decimal values', () => {
    it('should preserve decimal precision', () => {
      expect(createHue(45.5)).toBe(45.5);
      expect(createHue(180.25)).toBe(180.25);
    });

    it('should normalize decimal values correctly', () => {
      expect(createHue(360.5)).toBeCloseTo(0.5, 10);
      expect(createHue(-0.5)).toBeCloseTo(359.5, 10);
    });
  });

  describe('edge cases', () => {
    it('should handle zero', () => {
      expect(createHue(0)).toBe(0);
    });

    it('should return number type', () => {
      const result = createHue(45);
      expect(typeof result).toBe('number');
    });
  });
});

describe('createSaturation', () => {
  describe('valid inputs', () => {
    it('should accept values in 0-100 range', () => {
      expect(createSaturation(0)).toBe(0);
      expect(createSaturation(50)).toBe(50);
      expect(createSaturation(100)).toBe(100);
    });

    it('should preserve values within range', () => {
      expect(createSaturation(25)).toBe(25);
      expect(createSaturation(75)).toBe(75);
      expect(createSaturation(99)).toBe(99);
      expect(createSaturation(1)).toBe(1);
    });
  });

  describe('clamping', () => {
    it('should clamp values above 100 to 100', () => {
      expect(createSaturation(101)).toBe(100);
      expect(createSaturation(150)).toBe(100);
      expect(createSaturation(1000)).toBe(100);
    });

    it('should clamp negative values to 0', () => {
      expect(createSaturation(-1)).toBe(0);
      expect(createSaturation(-50)).toBe(0);
      expect(createSaturation(-1000)).toBe(0);
    });
  });

  describe('decimal values', () => {
    it('should preserve decimal precision within range', () => {
      expect(createSaturation(50.5)).toBe(50.5);
      expect(createSaturation(99.9)).toBe(99.9);
      expect(createSaturation(0.1)).toBe(0.1);
    });

    it('should clamp decimal values outside range', () => {
      expect(createSaturation(100.1)).toBe(100);
      expect(createSaturation(-0.1)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle exact boundary values', () => {
      expect(createSaturation(0)).toBe(0);
      expect(createSaturation(100)).toBe(100);
    });

    it('should return number type', () => {
      const result = createSaturation(50);
      expect(typeof result).toBe('number');
    });
  });
});

describe('type branding', () => {
  it('HexColor should be assignable from createHexColor result', () => {
    const hex: HexColor = createHexColor('#FF0000');
    expect(hex).toBe('#FF0000');
  });

  it('DyeId should be assignable from valid createDyeId result', () => {
    const id = createDyeId(42);
    if (id !== null) {
      const dyeId: DyeId = id;
      expect(dyeId).toBe(42);
    }
  });

  it('Hue should be assignable from createHue result', () => {
    const hue: Hue = createHue(180);
    expect(hue).toBe(180);
  });

  it('Saturation should be assignable from createSaturation result', () => {
    const sat: Saturation = createSaturation(75);
    expect(sat).toBe(75);
  });
});
