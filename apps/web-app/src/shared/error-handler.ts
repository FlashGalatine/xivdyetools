/**
 * XIV Dye Tools v2.0.0 - Error Handler
 *
 * Phase 12: Architecture Refactor
 * Centralized error handling and logging
 *
 * @module shared/error-handler
 */

import { AppError, ErrorCode } from '@xivdyetools/types';
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
