/**
 * XIV Dye Tools - Error Handler Tests
 *
 * @module shared/__tests__/error-handler.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorHandler } from '../error-handler';
import { AppError, ErrorCode } from '@xivdyetools/types';
import { logger } from '../logger';

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
    });

    it('should handle undefined', () => {
      const result = ErrorHandler.normalize(undefined);
      expect(result).toBeInstanceOf(AppError);
    });
  });

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

  describe('isCritical', () => {
    it('should return true for critical severity', () => {
      const error = new AppError(ErrorCode.DATABASE_LOAD_FAILED, 'Critical', 'critical');
      expect(ErrorHandler.isCritical(error)).toBe(true);
    });

    it('should return false for non-critical severity', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'Error', 'error');
      expect(ErrorHandler.isCritical(error)).toBe(false);
    });

    it('should normalize non-AppError before checking', () => {
      expect(ErrorHandler.isCritical(new Error('test'))).toBe(false);
    });
  });

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

  describe('clear', () => {
    it('should not throw', () => {
      expect(() => ErrorHandler.clear()).not.toThrow();
    });
  });
});
