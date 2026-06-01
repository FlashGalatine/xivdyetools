/**
 * XIV Dye Tools v2.0.0 - Error Handler
 *
 * Phase 12: Architecture Refactor
 * Centralized error handling and logging
 *
 * @module shared/error-handler
 */

import { AppError, ErrorCode } from '@xivdyetools/types';
import { ERROR_MESSAGES } from './constants';
import { logger } from './logger';

// ============================================================================
// Error Handler Class
// ============================================================================

/**
 * Centralized error handler for the application
 */
export class ErrorHandler {
  /**
   * Log an error to the console and error tracking service
   */
  static log(error: unknown): AppError {
    const appError = this.normalize(error);

    // Log based on severity
    switch (appError.severity) {
      case 'critical':
      case 'error':
        logger.error(`[${appError.code}]`, appError.message, appError);
        break;
      case 'warning':
        logger.warn(`[${appError.code}]`, appError.message);
        break;
      case 'info':
        logger.info(`[${appError.code}]`, appError.message);
        break;
    }

    return appError;
  }

  /**
   * Convert any error type to AppError
   */
  static normalize(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(
        ErrorCode.UNKNOWN_ERROR,
        error.message || 'Unknown error occurred',
        'error'
      );
    }

    if (typeof error === 'string') {
      return new AppError(ErrorCode.UNKNOWN_ERROR, error, 'error');
    }

    return new AppError(ErrorCode.UNKNOWN_ERROR, 'An unknown error occurred', 'error');
  }

  /**
   * Create a user-friendly error message
   */
  static createUserMessage(error: AppError | unknown): string {
    const appError = error instanceof AppError ? error : this.normalize(error);

    // Map error codes to user messages
    const messageMap: Partial<Record<string, string>> = {
      [ErrorCode.INVALID_HEX_COLOR]: ERROR_MESSAGES.INVALID_HEX,
      [ErrorCode.INVALID_RGB_VALUE]: ERROR_MESSAGES.INVALID_RGB,
      [ErrorCode.DYE_NOT_FOUND]: ERROR_MESSAGES.DYE_NOT_FOUND,
      [ErrorCode.DATABASE_LOAD_FAILED]: ERROR_MESSAGES.DATABASE_LOAD_FAILED,
      [ErrorCode.STORAGE_QUOTA_EXCEEDED]: ERROR_MESSAGES.STORAGE_FULL,
      [ErrorCode.API_CALL_FAILED]: ERROR_MESSAGES.API_FAILURE,
      [ErrorCode.INVALID_THEME]: ERROR_MESSAGES.THEME_INVALID,
      [ErrorCode.IMAGE_LOAD_FAILED]: ERROR_MESSAGES.IMAGE_LOAD_FAILED,
    };

    return messageMap[appError.code] || ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  /**
   * Check if error is critical and should stop execution
   */
  static isCritical(error: AppError | unknown): boolean {
    const appError = error instanceof AppError ? error : this.normalize(error);
    return appError.severity === 'critical';
  }

  /**
   * Report error to error tracking service (e.g., Sentry)
   */
  static report(error: AppError | unknown): void {
    const appError = error instanceof AppError ? error : this.normalize(error);

    // In production, send to error tracking service
    if (
      typeof window !== 'undefined' &&
      (window as { Sentry?: { captureException: (error: AppError) => void } }).Sentry
    ) {
      (
        window as unknown as { Sentry: { captureException: (error: AppError) => void } }
      ).Sentry.captureException(appError);
    }
  }

  /**
   * Clear error state (if any)
   */
  static clear(): void {
    // Can be extended to clear UI error messages, etc.
  }
}

