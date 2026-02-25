/**
 * XIV Dye Tools - Types Module Tests
 *
 * Comprehensive function coverage tests for type utilities and classes
 * in types.ts
 *
 * @module shared/__tests__/types.test
 */

import { describe, it, expect } from 'vitest';

import { createHexColor, AppError, ErrorCode, type HexColor } from '../types';

// ==========================================================================
// createHexColor Function Tests
// ==========================================================================

describe('createHexColor function', () => {
  it('should create a branded HexColor from a valid hex string', () => {
    const hex = createHexColor('#FF0000');
    expect(hex).toBe('#FF0000');
  });

  it('should preserve the original hex string value', () => {
    const hex = createHexColor('#AABBCC');
    expect(hex).toBe('#AABBCC');
  });

  it('should normalize lowercase hex strings to uppercase', () => {
    // The @xivdyetools/types package normalizes to uppercase
    const hex = createHexColor('#aabbcc');
    expect(hex).toBe('#AABBCC');
  });

  it('should normalize mixed case hex strings to uppercase', () => {
    // The @xivdyetools/types package normalizes to uppercase
    const hex = createHexColor('#AaBbCc');
    expect(hex).toBe('#AABBCC');
  });

  it('should expand shorthand hex strings to full format', () => {
    // The @xivdyetools/types package expands shorthand (#RGB -> #RRGGBB)
    const hex = createHexColor('#F00');
    expect(hex).toBe('#FF0000');
  });

  it('should throw error for 8-digit hex strings (alpha not supported)', () => {
    // The @xivdyetools/types package only supports #RGB and #RRGGBB formats
    expect(() => createHexColor('#FF0000FF')).toThrow('Invalid hex color format');
  });

  it('should throw error for invalid hex strings', () => {
    // The @xivdyetools/types package validates input
    expect(() => createHexColor('not-a-hex')).toThrow('Invalid hex color format');
  });

  it('should return a value usable as HexColor type', () => {
    const hex: HexColor = createHexColor('#123456');
    expect(typeof hex).toBe('string');
  });

  it('should throw error for empty string', () => {
    // The @xivdyetools/types package validates input
    expect(() => createHexColor('')).toThrow('Invalid hex color format');
  });

  it('should work with various color values', () => {
    const colors = ['#000000', '#FFFFFF', '#FF5733', '#C70039', '#900C3F'];
    for (const color of colors) {
      const hex = createHexColor(color);
      expect(hex).toBe(color);
    }
  });
});

// ==========================================================================
// AppError Class Tests
// ==========================================================================

describe('AppError class', () => {
  describe('constructor', () => {
    it('should create an error with code and message', () => {
      const error = new AppError('TEST_CODE', 'Test message');

      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.severity).toBe('error'); // default
    });

    it('should accept optional severity parameter', () => {
      const error = new AppError('TEST_CODE', 'Test message', 'warning');

      expect(error.severity).toBe('warning');
    });

    it('should set name to "AppError"', () => {
      const error = new AppError('TEST_CODE', 'Test message');

      expect(error.name).toBe('AppError');
    });

    it('should have a stack trace', () => {
      const error = new AppError('TEST_CODE', 'Test message');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });

    it('should be an instance of Error', () => {
      const error = new AppError('TEST_CODE', 'Test message');

      expect(error).toBeInstanceOf(Error);
    });

    it('should be an instance of AppError', () => {
      const error = new AppError('TEST_CODE', 'Test message');

      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('severity levels', () => {
    it('should accept "critical" severity', () => {
      const error = new AppError('TEST', 'Test', 'critical');
      expect(error.severity).toBe('critical');
    });

    it('should accept "error" severity', () => {
      const error = new AppError('TEST', 'Test', 'error');
      expect(error.severity).toBe('error');
    });

    it('should accept "warning" severity', () => {
      const error = new AppError('TEST', 'Test', 'warning');
      expect(error.severity).toBe('warning');
    });

    it('should accept "info" severity', () => {
      const error = new AppError('TEST', 'Test', 'info');
      expect(error.severity).toBe('info');
    });

    it('should default to "error" severity when not specified', () => {
      const error = new AppError('TEST', 'Test');
      expect(error.severity).toBe('error');
    });
  });

  describe('toJSON method', () => {
    it('should return a plain object with all properties', () => {
      const error = new AppError('TEST_CODE', 'Test message', 'warning');
      const json = error.toJSON();

      expect(typeof json).toBe('object');
      expect(json.name).toBe('AppError');
      expect(json.code).toBe('TEST_CODE');
      expect(json.message).toBe('Test message');
      expect(json.severity).toBe('warning');
      expect(json.stack).toBeDefined();
    });

    it('should include stack trace in JSON output', () => {
      const error = new AppError('TEST', 'Test');
      const json = error.toJSON();

      expect(json.stack).toBeDefined();
      expect(typeof json.stack).toBe('string');
    });

    it('should be serializable to JSON string', () => {
      const error = new AppError('TEST_CODE', 'Test message');
      const json = error.toJSON();

      const serialized = JSON.stringify(json);
      const parsed = JSON.parse(serialized);

      expect(parsed.code).toBe('TEST_CODE');
      expect(parsed.message).toBe('Test message');
      expect(parsed.name).toBe('AppError');
    });

    it('should preserve all error information through serialization', () => {
      const error = new AppError('COMPLEX_CODE', 'Complex message with "quotes"', 'critical');
      const json = error.toJSON();
      const serialized = JSON.stringify(json);
      const parsed = JSON.parse(serialized);

      expect(parsed.code).toBe('COMPLEX_CODE');
      expect(parsed.message).toBe('Complex message with "quotes"');
      expect(parsed.severity).toBe('critical');
    });
  });

  describe('prototype chain', () => {
    it('should maintain prototype chain correctly', () => {
      const error = new AppError('TEST', 'Test');

      expect(Object.getPrototypeOf(error)).toBe(AppError.prototype);
      expect(Object.getPrototypeOf(AppError.prototype)).toBe(Error.prototype);
    });

    it('should be catchable as an Error', () => {
      expect(() => {
        throw new AppError('TEST', 'Test');
      }).toThrow(Error);
    });

    it('should be catchable as an AppError', () => {
      expect(() => {
        throw new AppError('TEST', 'Test');
      }).toThrow(AppError);
    });

    it('should work with try-catch and instanceof', () => {
      try {
        throw new AppError('TEST_CODE', 'Test message', 'warning');
      } catch (e) {
        expect(e instanceof AppError).toBe(true);
        if (e instanceof AppError) {
          expect(e.code).toBe('TEST_CODE');
          expect(e.severity).toBe('warning');
        }
      }
    });
  });

  describe('with ErrorCode enum values', () => {
    it('should work with INVALID_HEX_COLOR code', () => {
      const error = new AppError(ErrorCode.INVALID_HEX_COLOR, 'Invalid hex color');
      expect(error.code).toBe('INVALID_HEX_COLOR');
    });

    it('should work with INVALID_RGB_VALUE code', () => {
      const error = new AppError(ErrorCode.INVALID_RGB_VALUE, 'Invalid RGB value');
      expect(error.code).toBe('INVALID_RGB_VALUE');
    });

    it('should work with DYE_NOT_FOUND code', () => {
      const error = new AppError(ErrorCode.DYE_NOT_FOUND, 'Dye not found');
      expect(error.code).toBe('DYE_NOT_FOUND');
    });

    it('should work with DATABASE_LOAD_FAILED code', () => {
      const error = new AppError(ErrorCode.DATABASE_LOAD_FAILED, 'Database load failed');
      expect(error.code).toBe('DATABASE_LOAD_FAILED');
    });

    it('should work with STORAGE_QUOTA_EXCEEDED code', () => {
      const error = new AppError(ErrorCode.STORAGE_QUOTA_EXCEEDED, 'Storage quota exceeded');
      expect(error.code).toBe('STORAGE_QUOTA_EXCEEDED');
    });

    it('should work with API_CALL_FAILED code', () => {
      const error = new AppError(ErrorCode.API_CALL_FAILED, 'API call failed');
      expect(error.code).toBe('API_CALL_FAILED');
    });

    it('should work with INVALID_THEME code', () => {
      const error = new AppError(ErrorCode.INVALID_THEME, 'Invalid theme');
      expect(error.code).toBe('INVALID_THEME');
    });

    it('should work with IMAGE_LOAD_FAILED code', () => {
      const error = new AppError(ErrorCode.IMAGE_LOAD_FAILED, 'Image load failed');
      expect(error.code).toBe('IMAGE_LOAD_FAILED');
    });

    it('should work with INVALID_INPUT code', () => {
      const error = new AppError(ErrorCode.INVALID_INPUT, 'Invalid input');
      expect(error.code).toBe('INVALID_INPUT');
    });

    it('should work with UNKNOWN_ERROR code', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Unknown error');
      expect(error.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', () => {
      const error = new AppError('TEST', '');
      expect(error.message).toBe('');
    });

    it('should handle long message', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new AppError('TEST', longMessage);
      expect(error.message).toBe(longMessage);
    });

    it('should handle message with special characters', () => {
      const specialMessage = 'Error: <script>alert("xss")</script> & "quotes" \'apostrophes\'';
      const error = new AppError('TEST', specialMessage);
      expect(error.message).toBe(specialMessage);
    });

    it('should handle message with newlines', () => {
      const multilineMessage = 'Line 1\nLine 2\nLine 3';
      const error = new AppError('TEST', multilineMessage);
      expect(error.message).toBe(multilineMessage);
    });

    it('should handle unicode in message', () => {
      const unicodeMessage = 'Error: 🎨 色の問題 🌈';
      const error = new AppError('TEST', unicodeMessage);
      expect(error.message).toBe(unicodeMessage);
    });
  });
});

// ==========================================================================
// ErrorCode Enum Tests
// ==========================================================================

describe('ErrorCode enum', () => {
  it('should have all expected error codes', () => {
    expect(ErrorCode.INVALID_HEX_COLOR).toBe('INVALID_HEX_COLOR');
    expect(ErrorCode.INVALID_RGB_VALUE).toBe('INVALID_RGB_VALUE');
    expect(ErrorCode.DYE_NOT_FOUND).toBe('DYE_NOT_FOUND');
    expect(ErrorCode.DATABASE_LOAD_FAILED).toBe('DATABASE_LOAD_FAILED');
    expect(ErrorCode.STORAGE_QUOTA_EXCEEDED).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(ErrorCode.API_CALL_FAILED).toBe('API_CALL_FAILED');
    expect(ErrorCode.INVALID_THEME).toBe('INVALID_THEME');
    expect(ErrorCode.IMAGE_LOAD_FAILED).toBe('IMAGE_LOAD_FAILED');
    expect(ErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
    expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
  });

  it('should be usable in switch statements', () => {
    const testCode = ErrorCode.API_CALL_FAILED;
    let handled: boolean;

    switch (testCode) {
      case ErrorCode.API_CALL_FAILED:
        handled = true;
        break;
      default:
        handled = false;
    }

    expect(handled).toBe(true);
  });

  it('should be usable as object keys', () => {
    const errorMessages: Record<ErrorCode, string> = {
      [ErrorCode.INVALID_HEX_COLOR]: 'Invalid hex color format',
      [ErrorCode.INVALID_RGB_VALUE]: 'RGB value out of range',
      [ErrorCode.DYE_NOT_FOUND]: 'Dye not found in database',
      [ErrorCode.DATABASE_LOAD_FAILED]: 'Failed to load dye database',
      [ErrorCode.STORAGE_QUOTA_EXCEEDED]: 'Local storage quota exceeded',
      [ErrorCode.API_CALL_FAILED]: 'API request failed',
      [ErrorCode.INVALID_THEME]: 'Invalid theme specified',
      [ErrorCode.IMAGE_LOAD_FAILED]: 'Failed to load image',
      [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
      [ErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred',
      [ErrorCode.LOCALE_LOAD_FAILED]: 'Failed to load locale',
    };

    expect(errorMessages[ErrorCode.API_CALL_FAILED]).toBe('API request failed');
  });
});
