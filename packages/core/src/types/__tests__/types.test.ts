/**
 * Comprehensive Tests for Types Module
 * Tests branded types, factory functions, and error classes
 */

import { describe, it, expect } from 'vitest';
import {
  createHexColor,
  createDyeId,
  createHue,
  createSaturation,
  AppError,
  ErrorCode,
  type HexColor,
  type DyeId,
  type Hue,
  type Saturation,
} from '../index.js';

// ============================================================================
// createHexColor Tests
// ============================================================================

describe('createHexColor', () => {
  describe('valid inputs', () => {
    it('should accept valid 6-digit hex color', () => {
      const color = createHexColor('#FF6B6B');
      expect(color).toBe('#FF6B6B');
    });

    it('should normalize lowercase to uppercase', () => {
      const color = createHexColor('#ff6b6b');
      expect(color).toBe('#FF6B6B');
    });

    it('should accept valid 3-digit hex color', () => {
      const color = createHexColor('#F00');
      expect(color).toBe('#FF0000');
    });

    it('should expand and normalize 3-digit lowercase hex', () => {
      const color = createHexColor('#abc');
      expect(color).toBe('#AABBCC');
    });

    it('should handle black color', () => {
      const color = createHexColor('#000000');
      expect(color).toBe('#000000');
    });

    it('should handle white color', () => {
      const color = createHexColor('#FFFFFF');
      expect(color).toBe('#FFFFFF');
    });

    it('should handle mixed case', () => {
      const color = createHexColor('#AaBbCc');
      expect(color).toBe('#AABBCC');
    });
  });

  describe('invalid inputs', () => {
    it('should throw for missing hash', () => {
      expect(() => createHexColor('FF6B6B')).toThrow('Invalid hex color format');
    });

    it('should throw for invalid characters', () => {
      expect(() => createHexColor('#GGGGGG')).toThrow('Invalid hex color format');
    });

    it('should throw for wrong length (4 digits)', () => {
      expect(() => createHexColor('#FFFF')).toThrow('Invalid hex color format');
    });

    it('should throw for wrong length (5 digits)', () => {
      expect(() => createHexColor('#FFFFF')).toThrow('Invalid hex color format');
    });

    it('should throw for wrong length (7 digits)', () => {
      expect(() => createHexColor('#FFFFFFF')).toThrow('Invalid hex color format');
    });

    it('should throw for empty string', () => {
      expect(() => createHexColor('')).toThrow('Invalid hex color format');
    });

    it('should throw for just hash', () => {
      expect(() => createHexColor('#')).toThrow('Invalid hex color format');
    });

    it('should throw for spaces', () => {
      expect(() => createHexColor('# FF6B6B')).toThrow('Invalid hex color format');
    });

    it('should include the invalid value in error message', () => {
      expect(() => createHexColor('invalid')).toThrow('invalid');
    });
  });

  describe('type safety', () => {
    it('should return HexColor branded type', () => {
      const color: HexColor = createHexColor('#FF0000');
      // Type check - this compiles because it's a HexColor
      expect(typeof color).toBe('string');
    });
  });
});

// ============================================================================
// createDyeId Tests
// ============================================================================

describe('createDyeId', () => {
  describe('valid inputs', () => {
    it('should accept valid dye ID (1)', () => {
      const id = createDyeId(1);
      expect(id).toBe(1);
    });

    it('should accept valid dye ID (100)', () => {
      const id = createDyeId(100);
      expect(id).toBe(100);
    });

    it('should accept valid dye ID (200)', () => {
      const id = createDyeId(200);
      expect(id).toBe(200);
    });

    it('should accept typical FFXIV dye IDs', () => {
      // Common dye IDs in FFXIV
      expect(createDyeId(5729)).toBeNull(); // Out of range for branded type
      expect(createDyeId(1)).toBe(1);
      expect(createDyeId(136)).toBe(136);
    });
  });

  describe('invalid inputs', () => {
    it('should return null for zero', () => {
      const id = createDyeId(0);
      expect(id).toBeNull();
    });

    it('should return null for negative numbers', () => {
      const id = createDyeId(-1);
      expect(id).toBeNull();
    });

    it('should return null for numbers above 200', () => {
      const id = createDyeId(201);
      expect(id).toBeNull();
    });

    it('should return null for large numbers', () => {
      const id = createDyeId(5729);
      expect(id).toBeNull();
    });

    it('should return null for non-integers (float)', () => {
      const id = createDyeId(1.5);
      expect(id).toBeNull();
    });

    it('should return null for NaN', () => {
      const id = createDyeId(NaN);
      expect(id).toBeNull();
    });

    it('should return null for Infinity', () => {
      const id = createDyeId(Infinity);
      expect(id).toBeNull();
    });

    it('should return null for negative Infinity', () => {
      const id = createDyeId(-Infinity);
      expect(id).toBeNull();
    });
  });

  describe('boundary values', () => {
    it('should accept minimum valid ID (1)', () => {
      expect(createDyeId(1)).toBe(1);
    });

    it('should accept maximum valid ID (200)', () => {
      expect(createDyeId(200)).toBe(200);
    });

    it('should reject just below minimum (0)', () => {
      expect(createDyeId(0)).toBeNull();
    });

    it('should reject just above maximum (201)', () => {
      expect(createDyeId(201)).toBeNull();
    });
  });

  describe('type safety', () => {
    it('should return DyeId branded type when valid', () => {
      const id: DyeId | null = createDyeId(100);
      expect(id).not.toBeNull();
      expect(typeof id).toBe('number');
    });
  });
});

// ============================================================================
// createHue Tests
// ============================================================================

describe('createHue', () => {
  describe('values within range (0-360)', () => {
    it('should return 0 for 0', () => {
      const hue = createHue(0);
      expect(hue).toBe(0);
    });

    it('should return 180 for 180', () => {
      const hue = createHue(180);
      expect(hue).toBe(180);
    });

    it('should return 359 for 359', () => {
      const hue = createHue(359);
      expect(hue).toBe(359);
    });

    it('should return 0 for 360 (normalized)', () => {
      const hue = createHue(360);
      expect(hue).toBe(0);
    });
  });

  describe('values above 360 (normalization)', () => {
    it('should normalize 361 to 1', () => {
      const hue = createHue(361);
      expect(hue).toBe(1);
    });

    it('should normalize 450 to 90', () => {
      const hue = createHue(450);
      expect(hue).toBe(90);
    });

    it('should normalize 720 to 0', () => {
      const hue = createHue(720);
      expect(hue).toBe(0);
    });

    it('should normalize 900 to 180', () => {
      const hue = createHue(900);
      expect(hue).toBe(180);
    });
  });

  describe('negative values (normalization)', () => {
    it('should normalize -1 to 359', () => {
      const hue = createHue(-1);
      expect(hue).toBe(359);
    });

    it('should normalize -90 to 270', () => {
      const hue = createHue(-90);
      expect(hue).toBe(270);
    });

    it('should normalize -180 to 180', () => {
      const hue = createHue(-180);
      expect(hue).toBe(180);
    });

    it('should normalize -360 to 0', () => {
      const hue = createHue(-360);
      expect(hue).toBe(0);
    });

    it('should normalize -361 to 359', () => {
      const hue = createHue(-361);
      expect(hue).toBe(359);
    });

    it('should normalize -720 to 0', () => {
      const hue = createHue(-720);
      expect(hue).toBe(0);
    });
  });

  describe('decimal values', () => {
    it('should preserve decimals within range', () => {
      const hue = createHue(180.5);
      expect(hue).toBe(180.5);
    });

    it('should normalize decimals above 360', () => {
      const hue = createHue(360.5);
      expect(hue).toBeCloseTo(0.5, 5);
    });

    it('should normalize negative decimals', () => {
      const hue = createHue(-0.5);
      expect(hue).toBeCloseTo(359.5, 5);
    });
  });

  describe('type safety', () => {
    it('should return Hue branded type', () => {
      const hue: Hue = createHue(180);
      expect(typeof hue).toBe('number');
    });
  });
});

// ============================================================================
// createSaturation Tests
// ============================================================================

describe('createSaturation', () => {
  describe('values within range (0-100)', () => {
    it('should return 0 for 0', () => {
      const sat = createSaturation(0);
      expect(sat).toBe(0);
    });

    it('should return 50 for 50', () => {
      const sat = createSaturation(50);
      expect(sat).toBe(50);
    });

    it('should return 100 for 100', () => {
      const sat = createSaturation(100);
      expect(sat).toBe(100);
    });
  });

  describe('values above 100 (clamping)', () => {
    it('should clamp 101 to 100', () => {
      const sat = createSaturation(101);
      expect(sat).toBe(100);
    });

    it('should clamp 200 to 100', () => {
      const sat = createSaturation(200);
      expect(sat).toBe(100);
    });

    it('should clamp 1000 to 100', () => {
      const sat = createSaturation(1000);
      expect(sat).toBe(100);
    });
  });

  describe('values below 0 (clamping)', () => {
    it('should clamp -1 to 0', () => {
      const sat = createSaturation(-1);
      expect(sat).toBe(0);
    });

    it('should clamp -100 to 0', () => {
      const sat = createSaturation(-100);
      expect(sat).toBe(0);
    });

    it('should clamp -1000 to 0', () => {
      const sat = createSaturation(-1000);
      expect(sat).toBe(0);
    });
  });

  describe('decimal values', () => {
    it('should preserve decimals within range', () => {
      const sat = createSaturation(50.5);
      expect(sat).toBe(50.5);
    });

    it('should clamp decimals above 100', () => {
      const sat = createSaturation(100.5);
      expect(sat).toBe(100);
    });

    it('should clamp negative decimals', () => {
      const sat = createSaturation(-0.5);
      expect(sat).toBe(0);
    });
  });

  describe('boundary values', () => {
    it('should return exactly 0 at lower bound', () => {
      expect(createSaturation(0)).toBe(0);
    });

    it('should return exactly 100 at upper bound', () => {
      expect(createSaturation(100)).toBe(100);
    });

    it('should clamp just above upper bound', () => {
      expect(createSaturation(100.001)).toBe(100);
    });

    it('should clamp just below lower bound', () => {
      expect(createSaturation(-0.001)).toBe(0);
    });
  });

  describe('type safety', () => {
    it('should return Saturation branded type', () => {
      const sat: Saturation = createSaturation(50);
      expect(typeof sat).toBe('number');
    });
  });
});

// ============================================================================
// AppError Tests
// ============================================================================

describe('AppError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new AppError('TEST_CODE', 'Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
    });

    it('should have default severity of error', () => {
      const error = new AppError('TEST_CODE', 'Test message');
      expect(error.severity).toBe('error');
    });

    it('should accept custom severity', () => {
      const error = new AppError('TEST_CODE', 'Test message', 'warning');
      expect(error.severity).toBe('warning');
    });

    it('should set name to AppError', () => {
      const error = new AppError('TEST_CODE', 'Test message');
      expect(error.name).toBe('AppError');
    });

    it('should be instanceof Error', () => {
      const error = new AppError('TEST_CODE', 'Test message');
      expect(error instanceof Error).toBe(true);
    });

    it('should be instanceof AppError', () => {
      const error = new AppError('TEST_CODE', 'Test message');
      expect(error instanceof AppError).toBe(true);
    });

    it('should have stack trace', () => {
      const error = new AppError('TEST_CODE', 'Test message');
      expect(error.stack).toBeDefined();
    });
  });

  describe('severity levels', () => {
    it('should accept critical severity', () => {
      const error = new AppError('TEST', 'Test', 'critical');
      expect(error.severity).toBe('critical');
    });

    it('should accept error severity', () => {
      const error = new AppError('TEST', 'Test', 'error');
      expect(error.severity).toBe('error');
    });

    it('should accept warning severity', () => {
      const error = new AppError('TEST', 'Test', 'warning');
      expect(error.severity).toBe('warning');
    });

    it('should accept info severity', () => {
      const error = new AppError('TEST', 'Test', 'info');
      expect(error.severity).toBe('info');
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON object', () => {
      const error = new AppError('TEST_CODE', 'Test message', 'warning');
      const json = error.toJSON();

      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('severity');
      expect(json).toHaveProperty('stack');
    });

    it('should include correct name', () => {
      const error = new AppError('TEST_CODE', 'Test message');
      const json = error.toJSON();
      expect(json.name).toBe('AppError');
    });

    it('should include correct code', () => {
      const error = new AppError('MY_CODE', 'Test message');
      const json = error.toJSON();
      expect(json.code).toBe('MY_CODE');
    });

    it('should include correct message', () => {
      const error = new AppError('TEST', 'My error message');
      const json = error.toJSON();
      expect(json.message).toBe('My error message');
    });

    it('should include correct severity', () => {
      const error = new AppError('TEST', 'Test', 'critical');
      const json = error.toJSON();
      expect(json.severity).toBe('critical');
    });

    it('should include stack trace', () => {
      const error = new AppError('TEST', 'Test');
      const json = error.toJSON();
      expect(json.stack).toBeDefined();
      expect(typeof json.stack).toBe('string');
    });

    it('should be serializable to JSON string', () => {
      const error = new AppError('TEST', 'Test message', 'error');
      const jsonString = JSON.stringify(error.toJSON());
      const parsed = JSON.parse(jsonString);

      expect(parsed.name).toBe('AppError');
      expect(parsed.code).toBe('TEST');
      expect(parsed.message).toBe('Test message');
      expect(parsed.severity).toBe('error');
    });
  });

  describe('with ErrorCode enum', () => {
    it('should work with INVALID_HEX_COLOR', () => {
      const error = new AppError(ErrorCode.INVALID_HEX_COLOR, 'Invalid color');
      expect(error.code).toBe('INVALID_HEX_COLOR');
    });

    it('should work with INVALID_RGB_VALUE', () => {
      const error = new AppError(ErrorCode.INVALID_RGB_VALUE, 'Invalid RGB');
      expect(error.code).toBe('INVALID_RGB_VALUE');
    });

    it('should work with DYE_NOT_FOUND', () => {
      const error = new AppError(ErrorCode.DYE_NOT_FOUND, 'Dye not found');
      expect(error.code).toBe('DYE_NOT_FOUND');
    });

    it('should work with DATABASE_LOAD_FAILED', () => {
      const error = new AppError(ErrorCode.DATABASE_LOAD_FAILED, 'DB failed');
      expect(error.code).toBe('DATABASE_LOAD_FAILED');
    });

    it('should work with INVALID_INPUT', () => {
      const error = new AppError(ErrorCode.INVALID_INPUT, 'Invalid input');
      expect(error.code).toBe('INVALID_INPUT');
    });

    it('should work with API_CALL_FAILED', () => {
      const error = new AppError(ErrorCode.API_CALL_FAILED, 'API failed');
      expect(error.code).toBe('API_CALL_FAILED');
    });

    it('should work with LOCALE_LOAD_FAILED', () => {
      const error = new AppError(ErrorCode.LOCALE_LOAD_FAILED, 'Locale failed');
      expect(error.code).toBe('LOCALE_LOAD_FAILED');
    });

    it('should work with UNKNOWN_ERROR', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Unknown');
      expect(error.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('error handling integration', () => {
    it('should be catchable as Error', () => {
      const throwError = () => {
        throw new AppError('TEST', 'Test error');
      };

      expect(throwError).toThrow(Error);
    });

    it('should be catchable as AppError', () => {
      const throwError = () => {
        throw new AppError('TEST', 'Test error');
      };

      expect(throwError).toThrow(AppError);
    });

    it('should preserve properties when caught', () => {
      try {
        throw new AppError('MY_CODE', 'My message', 'warning');
      } catch (e) {
        if (e instanceof AppError) {
          expect(e.code).toBe('MY_CODE');
          expect(e.message).toBe('My message');
          expect(e.severity).toBe('warning');
        } else {
          throw new Error('Should be AppError instance');
        }
      }
    });
  });
});
