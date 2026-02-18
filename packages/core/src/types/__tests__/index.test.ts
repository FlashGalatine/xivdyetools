/**
 * Types module tests for branded type helpers and AppError
 * Target: 90%+ branch coverage
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

describe('createHexColor', () => {
  describe('valid hex colors', () => {
    it('should accept valid 6-digit hex color', () => {
      const result = createHexColor('#FF0000');
      expect(result).toBe('#FF0000');
    });

    it('should accept valid 3-digit hex color and expand it', () => {
      const result = createHexColor('#F00');
      expect(result).toBe('#FF0000');
    });

    it('should normalize lowercase to uppercase', () => {
      const result = createHexColor('#ff0000');
      expect(result).toBe('#FF0000');
    });

    it('should normalize mixed case to uppercase', () => {
      const result = createHexColor('#fF00aA');
      expect(result).toBe('#FF00AA');
    });

    it('should handle 3-digit lowercase hex', () => {
      const result = createHexColor('#abc');
      expect(result).toBe('#AABBCC');
    });

    it('should accept black color', () => {
      const result = createHexColor('#000000');
      expect(result).toBe('#000000');
    });

    it('should accept white color', () => {
      const result = createHexColor('#FFFFFF');
      expect(result).toBe('#FFFFFF');
    });
  });

  describe('invalid hex colors', () => {
    it('should throw for missing hash symbol', () => {
      expect(() => createHexColor('FF0000')).toThrow('Invalid hex color format');
    });

    it('should throw for invalid length (4 digits)', () => {
      expect(() => createHexColor('#FFFF')).toThrow('Invalid hex color format');
    });

    it('should throw for invalid length (5 digits)', () => {
      expect(() => createHexColor('#FFFFF')).toThrow('Invalid hex color format');
    });

    it('should throw for invalid length (7 digits)', () => {
      expect(() => createHexColor('#FFFFFFF')).toThrow('Invalid hex color format');
    });

    it('should throw for invalid characters', () => {
      expect(() => createHexColor('#GGGGGG')).toThrow('Invalid hex color format');
    });

    it('should throw for empty string', () => {
      expect(() => createHexColor('')).toThrow('Invalid hex color format');
    });

    it('should throw for just hash', () => {
      expect(() => createHexColor('#')).toThrow('Invalid hex color format');
    });

    it('should throw for invalid format with spaces', () => {
      expect(() => createHexColor('# FF0000')).toThrow('Invalid hex color format');
    });

    it('should include the invalid value in error message', () => {
      expect(() => createHexColor('invalid')).toThrow('invalid');
    });
  });
});

describe('createDyeId', () => {
  describe('valid dye IDs', () => {
    it('should accept minimum valid ID (1)', () => {
      const result = createDyeId(1);
      expect(result).toBe(1);
    });

    it('should accept maximum valid ID (200)', () => {
      const result = createDyeId(200);
      expect(result).toBe(200);
    });

    it('should accept mid-range ID', () => {
      const result = createDyeId(100);
      expect(result).toBe(100);
    });
  });

  describe('invalid dye IDs', () => {
    it('should return null for zero', () => {
      const result = createDyeId(0);
      expect(result).toBeNull();
    });

    it('should return null for negative number', () => {
      const result = createDyeId(-1);
      expect(result).toBeNull();
    });

    it('should return null for ID greater than 200', () => {
      const result = createDyeId(201);
      expect(result).toBeNull();
    });

    it('should return null for non-integer (float)', () => {
      const result = createDyeId(1.5);
      expect(result).toBeNull();
    });

    it('should return null for NaN', () => {
      const result = createDyeId(NaN);
      expect(result).toBeNull();
    });

    it('should return null for Infinity', () => {
      const result = createDyeId(Infinity);
      expect(result).toBeNull();
    });

    it('should return null for negative Infinity', () => {
      const result = createDyeId(-Infinity);
      expect(result).toBeNull();
    });
  });
});

describe('createHue', () => {
  describe('values within range', () => {
    it('should accept zero', () => {
      const result = createHue(0);
      expect(result).toBe(0);
    });

    it('should accept 180 degrees', () => {
      const result = createHue(180);
      expect(result).toBe(180);
    });

    it('should accept 359 degrees', () => {
      const result = createHue(359);
      expect(result).toBe(359);
    });
  });

  describe('normalization', () => {
    it('should normalize 360 to 0', () => {
      const result = createHue(360);
      expect(result).toBe(0);
    });

    it('should normalize values over 360', () => {
      const result = createHue(450);
      expect(result).toBe(90);
    });

    it('should normalize negative values', () => {
      const result = createHue(-90);
      expect(result).toBe(270);
    });

    it('should normalize large negative values', () => {
      const result = createHue(-450);
      expect(result).toBe(270);
    });

    it('should normalize multiple rotations', () => {
      const result = createHue(720);
      expect(result).toBe(0);
    });

    it('should normalize multiple negative rotations', () => {
      const result = createHue(-720);
      expect(result).toBe(0);
    });
  });
});

describe('createSaturation', () => {
  describe('values within range', () => {
    it('should accept zero', () => {
      const result = createSaturation(0);
      expect(result).toBe(0);
    });

    it('should accept 50%', () => {
      const result = createSaturation(50);
      expect(result).toBe(50);
    });

    it('should accept 100%', () => {
      const result = createSaturation(100);
      expect(result).toBe(100);
    });
  });

  describe('clamping', () => {
    it('should clamp negative values to 0', () => {
      const result = createSaturation(-10);
      expect(result).toBe(0);
    });

    it('should clamp large negative values to 0', () => {
      const result = createSaturation(-100);
      expect(result).toBe(0);
    });

    it('should clamp values over 100 to 100', () => {
      const result = createSaturation(150);
      expect(result).toBe(100);
    });

    it('should clamp large values to 100', () => {
      const result = createSaturation(1000);
      expect(result).toBe(100);
    });
  });
});

describe('AppError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new AppError(ErrorCode.INVALID_HEX_COLOR, 'Invalid color');
      expect(error.code).toBe(ErrorCode.INVALID_HEX_COLOR);
      expect(error.message).toBe('Invalid color');
      expect(error.severity).toBe('error'); // default
    });

    it('should create error with custom severity', () => {
      const error = new AppError(ErrorCode.API_CALL_FAILED, 'API error', 'warning');
      expect(error.severity).toBe('warning');
    });

    it('should have correct name', () => {
      const error = new AppError(ErrorCode.DYE_NOT_FOUND, 'Not found');
      expect(error.name).toBe('AppError');
    });

    it('should be instance of Error', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Unknown');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should have stack trace', () => {
      const error = new AppError(ErrorCode.INVALID_INPUT, 'Bad input');
      expect(error.stack).toBeDefined();
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON object', () => {
      const error = new AppError(ErrorCode.INVALID_RGB_VALUE, 'Bad RGB', 'error');
      const json = error.toJSON();

      expect(json.name).toBe('AppError');
      expect(json.code).toBe(ErrorCode.INVALID_RGB_VALUE);
      expect(json.message).toBe('Bad RGB');
      expect(json.severity).toBe('error');
      expect(json.stack).toBeDefined();
    });

    it('should include all properties in JSON', () => {
      const error = new AppError(ErrorCode.DATABASE_LOAD_FAILED, 'DB error', 'critical');
      const json = error.toJSON();

      expect(Object.keys(json)).toContain('name');
      expect(Object.keys(json)).toContain('code');
      expect(Object.keys(json)).toContain('message');
      expect(Object.keys(json)).toContain('severity');
      expect(Object.keys(json)).toContain('stack');
    });

    it('should work with JSON.stringify', () => {
      const error = new AppError(ErrorCode.LOCALE_LOAD_FAILED, 'Locale error');
      const jsonString = JSON.stringify(error);
      const parsed = JSON.parse(jsonString);

      expect(parsed.name).toBe('AppError');
      expect(parsed.code).toBe(ErrorCode.LOCALE_LOAD_FAILED);
      expect(parsed.message).toBe('Locale error');
    });
  });

  describe('all error codes', () => {
    it('should create error with INVALID_HEX_COLOR', () => {
      const error = new AppError(ErrorCode.INVALID_HEX_COLOR, 'test');
      expect(error.code).toBe('INVALID_HEX_COLOR');
    });

    it('should create error with INVALID_RGB_VALUE', () => {
      const error = new AppError(ErrorCode.INVALID_RGB_VALUE, 'test');
      expect(error.code).toBe('INVALID_RGB_VALUE');
    });

    it('should create error with DYE_NOT_FOUND', () => {
      const error = new AppError(ErrorCode.DYE_NOT_FOUND, 'test');
      expect(error.code).toBe('DYE_NOT_FOUND');
    });

    it('should create error with DATABASE_LOAD_FAILED', () => {
      const error = new AppError(ErrorCode.DATABASE_LOAD_FAILED, 'test');
      expect(error.code).toBe('DATABASE_LOAD_FAILED');
    });

    it('should create error with INVALID_INPUT', () => {
      const error = new AppError(ErrorCode.INVALID_INPUT, 'test');
      expect(error.code).toBe('INVALID_INPUT');
    });

    it('should create error with API_CALL_FAILED', () => {
      const error = new AppError(ErrorCode.API_CALL_FAILED, 'test');
      expect(error.code).toBe('API_CALL_FAILED');
    });

    it('should create error with LOCALE_LOAD_FAILED', () => {
      const error = new AppError(ErrorCode.LOCALE_LOAD_FAILED, 'test');
      expect(error.code).toBe('LOCALE_LOAD_FAILED');
    });

    it('should create error with UNKNOWN_ERROR', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'test');
      expect(error.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('all severity levels', () => {
    it('should accept critical severity', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'test', 'critical');
      expect(error.severity).toBe('critical');
    });

    it('should accept error severity', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'test', 'error');
      expect(error.severity).toBe('error');
    });

    it('should accept warning severity', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'test', 'warning');
      expect(error.severity).toBe('warning');
    });

    it('should accept info severity', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'test', 'info');
      expect(error.severity).toBe('info');
    });
  });
});

describe('type branding', () => {
  it('should maintain HexColor brand type', () => {
    const hex: HexColor = createHexColor('#FF0000');
    // TypeScript ensures branded type, runtime test for value
    expect(hex).toBe('#FF0000');
  });

  it('should maintain DyeId brand type', () => {
    const id: DyeId | null = createDyeId(100);
    expect(id).toBe(100);
  });

  it('should maintain Hue brand type', () => {
    const hue: Hue = createHue(180);
    expect(hue).toBe(180);
  });

  it('should maintain Saturation brand type', () => {
    const sat: Saturation = createSaturation(50);
    expect(sat).toBe(50);
  });
});
