/**
 * XIV Dye Tools v2.0.0 - Error Handler
 *
 * Phase 12: Architecture Refactor
 * Centralized error handling and logging
 *
 * @module shared/error-handler
 */

import { AppError, ErrorCode } from './types';
import type { ErrorSeverity } from './types';
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

// ============================================================================
// Error Handling Decorators/Wrappers
// ============================================================================

/**
 * Wrap a synchronous function with error handling
 */
export function withErrorHandling<T>(fn: () => T, fallback?: T): T | undefined {
  try {
    return fn();
  } catch (error) {
    ErrorHandler.log(error);
    if (fallback !== undefined) {
      return fallback;
    }
    return undefined;
  }
}

/**
 * Wrap an asynchronous function with error handling
 */
export async function withAsyncErrorHandling<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    ErrorHandler.log(error);
    if (fallback !== undefined) {
      return fallback;
    }
    return undefined;
  }
}

/**
 * Create a Result type wrapper for operations that might fail
 */
export function createResult<T>(
  fn: () => T
): { ok: true; value: T } | { ok: false; error: AppError } {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, error: ErrorHandler.normalize(error) };
  }
}

/**
 * Create an async Result type wrapper
 */
export async function createAsyncResult<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: AppError }> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: ErrorHandler.normalize(error) };
  }
}

// ============================================================================
// Error Boundaries
// ============================================================================

/**
 * Catch and handle errors in a try-catch block with automatic logging
 */
export function handleError(error: unknown, context?: string): AppError {
  const appError = ErrorHandler.normalize(error);
  if (context) {
    logger.error(`Error in ${context}:`, appError);
  }
  return appError;
}

/**
 * Catch and handle async errors with automatic logging
 */
export async function handleAsyncError<T>(
  fn: () => Promise<T>,
  context?: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    return fallback;
  }
}

// ============================================================================
// Validation Error Helpers
// ============================================================================

/**
 * Validate a condition and throw an error if it fails
 */
export function validateCondition(
  condition: boolean,
  errorCode: string,
  message: string,
  severity: ErrorSeverity = 'error'
): void {
  if (!condition) {
    throw new AppError(errorCode, message, severity);
  }
}

/**
 * Validate that a value is not null or undefined
 */
export function validateNotNull<T>(
  value: T | null | undefined,
  errorCode: string,
  message: string
): T {
  if (value === null || value === undefined) {
    throw new AppError(errorCode, message, 'error');
  }
  return value;
}

/**
 * Validate that a string is not empty
 */
export function validateNotEmpty(value: string, errorCode: string, message: string): string {
  if (!value || value.trim() === '') {
    throw new AppError(errorCode, message, 'error');
  }
  return value.trim();
}

/**
 * Validate that a number is within a range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  errorCode: string,
  message: string
): number {
  if (value < min || value > max) {
    throw new AppError(errorCode, message, 'error');
  }
  return value;
}
