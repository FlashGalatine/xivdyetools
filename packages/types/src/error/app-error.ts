/**
 * @xivdyetools/types - AppError Class
 *
 * Custom error class with severity and code.
 *
 * @module error/app-error
 */

/**
 * Severity levels for application errors
 *
 * - `critical`: System-breaking errors requiring immediate attention
 * - `error`: Standard errors that prevent operation completion
 * - `warning`: Non-fatal issues that should be addressed
 * - `info`: Informational messages (not really errors)
 */
export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

/**
 * Custom error class with severity and code
 *
 * Provides structured error information for consistent error handling
 * across the xivdyetools ecosystem.
 *
 * @example
 * ```typescript
 * import { AppError, ErrorCode } from '@xivdyetools/types/error';
 *
 * throw new AppError(
 *   ErrorCode.DYE_NOT_FOUND,
 *   'Dye with ID 999 not found',
 *   'error'
 * );
 * ```
 */
export class AppError extends Error {
  /**
   * Create a new AppError
   *
   * @param code - Error code for programmatic handling
   * @param message - Human-readable error message
   * @param severity - Error severity level (default: 'error')
   */
  constructor(
    public code: string,
    message: string,
    public severity: ErrorSeverity = 'error'
  ) {
    super(message);
    this.name = 'AppError';
    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Convert error to JSON-serializable object
   *
   * Useful for logging and API responses.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      stack: this.stack,
    };
  }
}
