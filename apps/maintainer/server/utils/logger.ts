/**
 * Structured logging utility for the XIV Dye Tools Maintainer
 *
 * SECURITY: Provides consistent JSON-formatted logging for audit trails and debugging.
 * All security-relevant events (auth failures, validation errors, mutations) are logged
 * with structured context for easy parsing and filtering.
 *
 * Log Levels:
 * - DEBUG: Detailed diagnostic information
 * - INFO: General informational messages
 * - WARN: Warning messages for potentially problematic situations
 * - ERROR: Error messages for failures and exceptions
 * - AUDIT: Security-relevant events (mutations, auth events, etc.)
 */

/**
 * Supported log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  AUDIT = 'AUDIT',
}

/**
 * Structured context for log entries
 * Allows arbitrary key-value pairs for flexible logging
 */
export interface LogContext {
  [key: string]: unknown
}

/**
 * Structured log entry format
 */
interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  [key: string]: unknown // Additional context fields
}

/**
 * Structured logger for the maintainer service
 *
 * Outputs JSON-formatted logs that can be easily parsed and filtered.
 * All logs include ISO 8601 timestamp and log level.
 *
 * @example
 * Logger.info('Request completed', {
 *   requestId: 'abc123',
 *   method: 'GET',
 *   path: '/api/colors',
 *   statusCode: 200,
 *   duration: '45ms'
 * })
 *
 * @example
 * Logger.audit('Mutation operation completed', {
 *   requestId: 'def456',
 *   method: 'POST',
 *   path: '/api/colors',
 *   ip: '127.0.0.1'
 * })
 */
export class Logger {
  /**
   * Formats a log entry as JSON
   *
   * @param level - Log level
   * @param message - Human-readable message
   * @param context - Additional structured context
   * @returns JSON-formatted log string
   */
  private static formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    }
    return JSON.stringify(entry)
  }

  /**
   * Log DEBUG level message
   *
   * Use for detailed diagnostic information useful during development.
   *
   * @param message - Log message
   * @param context - Additional structured context
   */
  static debug(message: string, context?: LogContext): void {
    console.log(this.formatLog(LogLevel.DEBUG, message, context))
  }

  /**
   * Log INFO level message
   *
   * Use for general informational messages about normal operations.
   *
   * @param message - Log message
   * @param context - Additional structured context
   */
  static info(message: string, context?: LogContext): void {
    console.log(this.formatLog(LogLevel.INFO, message, context))
  }

  /**
   * Log WARN level message
   *
   * Use for potentially problematic situations that don't prevent operation.
   *
   * @param message - Log message
   * @param context - Additional structured context
   */
  static warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog(LogLevel.WARN, message, context))
  }

  /**
   * Log ERROR level message
   *
   * Use for error conditions and exceptions that affect operation.
   *
   * @param message - Log message
   * @param context - Additional structured context
   */
  static error(message: string, context?: LogContext): void {
    console.error(this.formatLog(LogLevel.ERROR, message, context))
  }

  /**
   * Log AUDIT level message
   *
   * SECURITY: Use for security-relevant events that should be tracked.
   * Examples: authentication events, authorization failures, data mutations.
   *
   * @param message - Log message
   * @param context - Additional structured context
   */
  static audit(message: string, context?: LogContext): void {
    console.log(this.formatLog(LogLevel.AUDIT, message, context))
  }
}
