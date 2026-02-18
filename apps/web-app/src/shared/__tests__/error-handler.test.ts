/**
 * XIV Dye Tools - Error Handler Tests
 *
 * Comprehensive tests for error handling utilities
 *
 * @module shared/__tests__/error-handler.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ErrorHandler,
  withErrorHandling,
  withAsyncErrorHandling,
  createResult,
  createAsyncResult,
  handleError,
  handleAsyncError,
  validateCondition,
  validateNotNull,
  validateNotEmpty,
  validateRange,
} from '../error-handler';
import { AppError, ErrorCode } from '../types';
import { logger } from '../logger';

// Mock the logger
vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // normalize
  // ==========================================================================

  describe('normalize', () => {
    it('should return AppError unchanged', () => {
      const appError = new AppError(ErrorCode.UNKNOWN_ERROR, 'Test error', 'error');
      const result = ErrorHandler.normalize(appError);
      expect(result).toBe(appError);
    });

    it('should convert Error to AppError', () => {
      const error = new Error('Test message');
      const result = ErrorHandler.normalize(error);

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('Test message');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('should convert string to AppError', () => {
      const result = ErrorHandler.normalize('String error');

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('String error');
    });

    it('should handle unknown error types', () => {
      const result = ErrorHandler.normalize({ custom: 'object' });

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('An unknown error occurred');
    });

    it('should handle null', () => {
      const result = ErrorHandler.normalize(null);

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('An unknown error occurred');
    });

    it('should handle undefined', () => {
      const result = ErrorHandler.normalize(undefined);

      expect(result).toBeInstanceOf(AppError);
    });
  });

  // ==========================================================================
  // log
  // ==========================================================================

  describe('log', () => {
    it('should log error severity to console', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Test', 'error');
      ErrorHandler.log(error);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should log critical severity to console', () => {
      const error = new AppError(ErrorCode.DATABASE_LOAD_FAILED, 'Critical', 'critical');
      ErrorHandler.log(error);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should log warning severity to console', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Warning', 'warning');
      ErrorHandler.log(error);

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log info severity to console', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Info', 'info');
      ErrorHandler.log(error);

      expect(logger.info).toHaveBeenCalled();
    });

    it('should normalize non-AppError before logging', () => {
      ErrorHandler.log(new Error('Regular error'));

      expect(logger.error).toHaveBeenCalled();
    });

    it('should return AppError', () => {
      const result = ErrorHandler.log('test error');
      expect(result).toBeInstanceOf(AppError);
    });
  });

  // ==========================================================================
  // createUserMessage
  // ==========================================================================

  describe('createUserMessage', () => {
    it('should return user-friendly message for INVALID_HEX_COLOR', () => {
      const error = new AppError(ErrorCode.INVALID_HEX_COLOR, 'Internal', 'error');
      const message = ErrorHandler.createUserMessage(error);

      expect(message).toContain('hex');
    });

    it('should return user-friendly message for INVALID_RGB_VALUE', () => {
      const error = new AppError(ErrorCode.INVALID_RGB_VALUE, 'Internal', 'error');
      const message = ErrorHandler.createUserMessage(error);

      expect(message).toContain('RGB');
    });

    it('should return user-friendly message for DYE_NOT_FOUND', () => {
      const error = new AppError(ErrorCode.DYE_NOT_FOUND, 'Internal', 'error');
      const message = ErrorHandler.createUserMessage(error);

      // Message should mention dye (case-insensitive)
      expect(message.toLowerCase()).toContain('dye');
    });

    it('should return generic message for unknown error codes', () => {
      const error = new AppError('CUSTOM_ERROR', 'Internal', 'error');
      const message = ErrorHandler.createUserMessage(error);

      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should normalize non-AppError before creating message', () => {
      const message = ErrorHandler.createUserMessage(new Error('test'));
      expect(typeof message).toBe('string');
    });
  });

  // ==========================================================================
  // isCritical
  // ==========================================================================

  describe('isCritical', () => {
    it('should return true for critical severity', () => {
      const error = new AppError(ErrorCode.DATABASE_LOAD_FAILED, 'Critical', 'critical');
      expect(ErrorHandler.isCritical(error)).toBe(true);
    });

    it('should return false for non-critical severity', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Error', 'error');
      expect(ErrorHandler.isCritical(error)).toBe(false);
    });

    it('should return false for warning severity', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Warning', 'warning');
      expect(ErrorHandler.isCritical(error)).toBe(false);
    });

    it('should normalize non-AppError before checking', () => {
      expect(ErrorHandler.isCritical(new Error('test'))).toBe(false);
    });
  });

  // ==========================================================================
  // report
  // ==========================================================================

  describe('report', () => {
    it('should not throw without Sentry', () => {
      expect(() => ErrorHandler.report(new Error('test'))).not.toThrow();
    });

    it('should call Sentry if available', () => {
      const mockCaptureException = vi.fn();
      (window as unknown as { Sentry: { captureException: typeof mockCaptureException } }).Sentry =
        { captureException: mockCaptureException };

      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'test', 'error');
      ErrorHandler.report(error);

      expect(mockCaptureException).toHaveBeenCalledWith(error);

      delete (window as unknown as { Sentry?: unknown }).Sentry;
    });
  });

  // ==========================================================================
  // clear
  // ==========================================================================

  describe('clear', () => {
    it('should not throw', () => {
      expect(() => ErrorHandler.clear()).not.toThrow();
    });
  });
});

// ==========================================================================
// Error Handling Wrappers
// ==========================================================================

describe('withErrorHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return function result on success', () => {
    const result = withErrorHandling(() => 'success');
    expect(result).toBe('success');
  });

  it('should return fallback on error', () => {
    const result = withErrorHandling(() => {
      throw new Error('fail');
    }, 'fallback');
    expect(result).toBe('fallback');
  });

  it('should return undefined on error without fallback', () => {
    const result = withErrorHandling(() => {
      throw new Error('fail');
    });
    expect(result).toBeUndefined();
  });

  it('should log error', () => {
    withErrorHandling(() => {
      throw new Error('fail');
    });
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('withAsyncErrorHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return promise result on success', async () => {
    const result = await withAsyncErrorHandling(() => Promise.resolve('success'));
    expect(result).toBe('success');
  });

  it('should return fallback on error', async () => {
    const result = await withAsyncErrorHandling(
      () => Promise.reject(new Error('fail')),
      'fallback'
    );
    expect(result).toBe('fallback');
  });

  it('should return undefined on error without fallback', async () => {
    const result = await withAsyncErrorHandling(() => Promise.reject(new Error('fail')));
    expect(result).toBeUndefined();
  });

  it('should log error', async () => {
    await withAsyncErrorHandling(() => Promise.reject(new Error('fail')));
    expect(logger.error).toHaveBeenCalled();
  });
});

// ==========================================================================
// Result Type
// ==========================================================================

describe('createResult', () => {
  it('should return ok result on success', () => {
    const result = createResult(() => 'value');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('value');
    }
  });

  it('should return error result on failure', () => {
    const result = createResult(() => {
      throw new Error('fail');
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AppError);
    }
  });
});

describe('createAsyncResult', () => {
  it('should return ok result on success', async () => {
    const result = await createAsyncResult(() => Promise.resolve('value'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('value');
    }
  });

  it('should return error result on failure', async () => {
    const result = await createAsyncResult(() => Promise.reject(new Error('fail')));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AppError);
    }
  });
});

// ==========================================================================
// Error Boundaries
// ==========================================================================

describe('handleError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return normalized AppError', () => {
    const result = handleError(new Error('test'));
    expect(result).toBeInstanceOf(AppError);
  });

  it('should log with context', () => {
    handleError(new Error('test'), 'TestContext');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('TestContext'),
      expect.any(AppError)
    );
  });

  it('should not log without context', () => {
    handleError(new Error('test'));
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('handleAsyncError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return promise result on success', async () => {
    const result = await handleAsyncError(() => Promise.resolve('success'));
    expect(result).toBe('success');
  });

  it('should return fallback on error', async () => {
    const result = await handleAsyncError(
      () => Promise.reject(new Error('fail')),
      'ctx',
      'fallback'
    );
    expect(result).toBe('fallback');
  });

  it('should return undefined without fallback', async () => {
    const result = await handleAsyncError(() => Promise.reject(new Error('fail')));
    expect(result).toBeUndefined();
  });
});

// ==========================================================================
// Validation Helpers
// ==========================================================================

describe('validateCondition', () => {
  it('should not throw when condition is true', () => {
    expect(() => validateCondition(true, 'CODE', 'message')).not.toThrow();
  });

  it('should throw AppError when condition is false', () => {
    expect(() => validateCondition(false, 'CODE', 'Test message')).toThrow(AppError);
  });

  it('should throw with correct error code', () => {
    try {
      validateCondition(false, ErrorCode.INVALID_HEX_COLOR, 'message');
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.INVALID_HEX_COLOR);
    }
  });

  it('should throw with correct severity', () => {
    try {
      validateCondition(false, 'CODE', 'message', 'warning');
    } catch (e) {
      expect((e as AppError).severity).toBe('warning');
    }
  });
});

describe('validateNotNull', () => {
  it('should return value when not null', () => {
    const result = validateNotNull('value', 'CODE', 'message');
    expect(result).toBe('value');
  });

  it('should return value when falsy but not null/undefined', () => {
    expect(validateNotNull(0, 'CODE', 'message')).toBe(0);
    expect(validateNotNull('', 'CODE', 'message')).toBe('');
    expect(validateNotNull(false, 'CODE', 'message')).toBe(false);
  });

  it('should throw when null', () => {
    expect(() => validateNotNull(null, 'CODE', 'message')).toThrow(AppError);
  });

  it('should throw when undefined', () => {
    expect(() => validateNotNull(undefined, 'CODE', 'message')).toThrow(AppError);
  });
});

describe('validateNotEmpty', () => {
  it('should return trimmed value when not empty', () => {
    const result = validateNotEmpty('  value  ', 'CODE', 'message');
    expect(result).toBe('value');
  });

  it('should throw when empty string', () => {
    expect(() => validateNotEmpty('', 'CODE', 'message')).toThrow(AppError);
  });

  it('should throw when whitespace only', () => {
    expect(() => validateNotEmpty('   ', 'CODE', 'message')).toThrow(AppError);
  });
});

describe('validateRange', () => {
  it('should return value when in range', () => {
    expect(validateRange(5, 0, 10, 'CODE', 'message')).toBe(5);
    expect(validateRange(0, 0, 10, 'CODE', 'message')).toBe(0);
    expect(validateRange(10, 0, 10, 'CODE', 'message')).toBe(10);
  });

  it('should throw when below range', () => {
    expect(() => validateRange(-1, 0, 10, 'CODE', 'message')).toThrow(AppError);
  });

  it('should throw when above range', () => {
    expect(() => validateRange(11, 0, 10, 'CODE', 'message')).toThrow(AppError);
  });
});
