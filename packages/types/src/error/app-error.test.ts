/**
 * @xivdyetools/types - AppError Tests
 *
 * Comprehensive tests for the AppError class.
 */
import { describe, it, expect } from 'vitest';
import { AppError, type ErrorSeverity } from './app-error.js';
import { ErrorCode } from './codes.js';

describe('AppError', () => {
  describe('constructor', () => {
    it('should create an error with code, message, and default severity', () => {
      const error = new AppError(ErrorCode.DYE_NOT_FOUND, 'Dye not found');

      expect(error.code).toBe(ErrorCode.DYE_NOT_FOUND);
      expect(error.message).toBe('Dye not found');
      expect(error.severity).toBe('error');
      expect(error.name).toBe('AppError');
    });

    it('should create an error with custom severity', () => {
      const error = new AppError(ErrorCode.INVALID_HEX_COLOR, 'Bad color', 'warning');

      expect(error.code).toBe(ErrorCode.INVALID_HEX_COLOR);
      expect(error.message).toBe('Bad color');
      expect(error.severity).toBe('warning');
    });

    it('should support all severity levels', () => {
      const severities: ErrorSeverity[] = ['critical', 'error', 'warning', 'info'];

      severities.forEach((severity) => {
        const error = new AppError('TEST', 'Test message', severity);
        expect(error.severity).toBe(severity);
      });
    });

    it('should be an instance of Error', () => {
      const error = new AppError('CODE', 'message');
      expect(error).toBeInstanceOf(Error);
    });

    it('should be an instance of AppError', () => {
      const error = new AppError('CODE', 'message');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should have a stack trace', () => {
      const error = new AppError('CODE', 'message');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('with ErrorCode enum values', () => {
    it('should work with INVALID_HEX_COLOR', () => {
      const error = new AppError(ErrorCode.INVALID_HEX_COLOR, 'Invalid hex');
      expect(error.code).toBe('INVALID_HEX_COLOR');
    });

    it('should work with INVALID_RGB_VALUE', () => {
      const error = new AppError(ErrorCode.INVALID_RGB_VALUE, 'RGB out of range');
      expect(error.code).toBe('INVALID_RGB_VALUE');
    });

    it('should work with DYE_NOT_FOUND', () => {
      const error = new AppError(ErrorCode.DYE_NOT_FOUND, 'Dye 999 not found');
      expect(error.code).toBe('DYE_NOT_FOUND');
    });

    it('should work with DATABASE_LOAD_FAILED', () => {
      const error = new AppError(ErrorCode.DATABASE_LOAD_FAILED, 'Failed to load', 'critical');
      expect(error.code).toBe('DATABASE_LOAD_FAILED');
      expect(error.severity).toBe('critical');
    });

    it('should work with API_CALL_FAILED', () => {
      const error = new AppError(ErrorCode.API_CALL_FAILED, 'API timeout');
      expect(error.code).toBe('API_CALL_FAILED');
    });

    it('should work with LOCALE_LOAD_FAILED', () => {
      const error = new AppError(ErrorCode.LOCALE_LOAD_FAILED, 'Missing locale');
      expect(error.code).toBe('LOCALE_LOAD_FAILED');
    });

    it('should work with UNKNOWN_ERROR', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Something went wrong');
      expect(error.code).toBe('UNKNOWN_ERROR');
    });

    it('should work with STORAGE_QUOTA_EXCEEDED', () => {
      const error = new AppError(ErrorCode.STORAGE_QUOTA_EXCEEDED, 'Storage full', 'warning');
      expect(error.code).toBe('STORAGE_QUOTA_EXCEEDED');
    });

    it('should work with INVALID_THEME', () => {
      const error = new AppError(ErrorCode.INVALID_THEME, 'Unknown theme');
      expect(error.code).toBe('INVALID_THEME');
    });

    it('should work with IMAGE_LOAD_FAILED', () => {
      const error = new AppError(ErrorCode.IMAGE_LOAD_FAILED, 'Image corrupt');
      expect(error.code).toBe('IMAGE_LOAD_FAILED');
    });

    it('should work with INVALID_INPUT', () => {
      const error = new AppError(ErrorCode.INVALID_INPUT, 'Bad input');
      expect(error.code).toBe('INVALID_INPUT');
    });
  });

  describe('toJSON', () => {
    it('should return a JSON-serializable object', () => {
      const error = new AppError(ErrorCode.DYE_NOT_FOUND, 'Dye not found', 'warning');
      const json = error.toJSON();

      expect(json.name).toBe('AppError');
      expect(json.code).toBe(ErrorCode.DYE_NOT_FOUND);
      expect(json.message).toBe('Dye not found');
      expect(json.severity).toBe('warning');
      expect(json.stack).toBeDefined();
    });

    it('should be serializable with JSON.stringify', () => {
      const error = new AppError('TEST_CODE', 'Test message', 'info');
      const jsonString = JSON.stringify(error.toJSON());
      const parsed = JSON.parse(jsonString);

      expect(parsed.name).toBe('AppError');
      expect(parsed.code).toBe('TEST_CODE');
      expect(parsed.message).toBe('Test message');
      expect(parsed.severity).toBe('info');
    });

    it('should include stack trace in JSON', () => {
      const error = new AppError('CODE', 'message');
      const json = error.toJSON();

      expect(typeof json.stack).toBe('string');
      expect(json.stack).toContain('AppError');
    });

    it('should return Record<string, unknown> type', () => {
      const error = new AppError('CODE', 'message');
      const json: Record<string, unknown> = error.toJSON();

      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('severity');
      expect(json).toHaveProperty('stack');
    });
  });

  describe('prototype chain', () => {
    it('should maintain proper prototype chain after setPrototypeOf', () => {
      const error = new AppError('CODE', 'message');

      expect(Object.getPrototypeOf(error)).toBe(AppError.prototype);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should allow instanceof checks in catch blocks', () => {
      try {
        throw new AppError('TEST', 'test error');
      } catch (e) {
        expect(e instanceof AppError).toBe(true);
        if (e instanceof AppError) {
          expect(e.code).toBe('TEST');
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', () => {
      const error = new AppError('CODE', '');
      expect(error.message).toBe('');
    });

    it('should handle empty code', () => {
      const error = new AppError('', 'message');
      expect(error.code).toBe('');
    });

    it('should handle long messages', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new AppError('CODE', longMessage);
      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(10000);
    });

    it('should handle special characters in message', () => {
      const message = 'Error: "value" is <invalid> & null\n\ttab';
      const error = new AppError('CODE', message);
      expect(error.message).toBe(message);
    });

    it('should handle unicode in message', () => {
      const message = 'エラー: 染料が見つかりません 🎨';
      const error = new AppError('CODE', message);
      expect(error.message).toBe(message);
    });
  });

  describe('real-world usage scenarios', () => {
    it('should work for hex color validation error', () => {
      const hex = 'invalid';
      const error = new AppError(
        ErrorCode.INVALID_HEX_COLOR,
        `Invalid hex color format: ${hex}. Expected #RRGGBB or #RGB format.`
      );

      expect(error.code).toBe('INVALID_HEX_COLOR');
      expect(error.message).toContain('invalid');
      expect(error.message).toContain('#RRGGBB');
    });

    it('should work for dye not found error', () => {
      const dyeId = 999;
      const error = new AppError(ErrorCode.DYE_NOT_FOUND, `Dye with ID ${dyeId} not found`);

      expect(error.code).toBe('DYE_NOT_FOUND');
      expect(error.message).toContain('999');
    });

    it('should work for critical database failure', () => {
      const error = new AppError(
        ErrorCode.DATABASE_LOAD_FAILED,
        'Failed to load dye database from remote server',
        'critical'
      );

      expect(error.severity).toBe('critical');
      expect(error.code).toBe('DATABASE_LOAD_FAILED');
    });

    it('should work for API errors with details', () => {
      const statusCode = 429;
      const error = new AppError(
        ErrorCode.API_CALL_FAILED,
        `API request failed with status ${statusCode}: Rate limit exceeded`,
        'warning'
      );

      expect(error.severity).toBe('warning');
      expect(error.message).toContain('429');
      expect(error.message).toContain('Rate limit');
    });
  });
});

describe('ErrorCode enum', () => {
  it('should have all expected core error codes', () => {
    expect(ErrorCode.INVALID_HEX_COLOR).toBe('INVALID_HEX_COLOR');
    expect(ErrorCode.INVALID_RGB_VALUE).toBe('INVALID_RGB_VALUE');
    expect(ErrorCode.DYE_NOT_FOUND).toBe('DYE_NOT_FOUND');
    expect(ErrorCode.DATABASE_LOAD_FAILED).toBe('DATABASE_LOAD_FAILED');
    expect(ErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
    expect(ErrorCode.API_CALL_FAILED).toBe('API_CALL_FAILED');
    expect(ErrorCode.LOCALE_LOAD_FAILED).toBe('LOCALE_LOAD_FAILED');
    expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
  });

  it('should have all expected web-specific error codes', () => {
    expect(ErrorCode.STORAGE_QUOTA_EXCEEDED).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(ErrorCode.INVALID_THEME).toBe('INVALID_THEME');
    expect(ErrorCode.IMAGE_LOAD_FAILED).toBe('IMAGE_LOAD_FAILED');
  });

  it('should have exactly 11 error codes', () => {
    const codeCount = Object.keys(ErrorCode).length;
    expect(codeCount).toBe(11);
  });
});
