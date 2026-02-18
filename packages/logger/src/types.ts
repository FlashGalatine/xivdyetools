/**
 * @xivdyetools/logger - Type Definitions
 *
 * Core interfaces for the logging system.
 *
 * @module types
 */

/**
 * Log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Contextual data attached to log entries
 *
 * Use this to add structured data that helps with debugging
 * and log aggregation.
 */
export interface LogContext {
  /** Request correlation ID for distributed tracing */
  requestId?: string;

  /** User identifier (should be sanitized) */
  userId?: string;

  /** Current operation name */
  operation?: string;

  /** Service or component name */
  service?: string;

  /** Environment (production, development, etc.) */
  environment?: string;

  /** Any additional custom metadata */
  [key: string]: unknown;
}

/**
 * Structured log entry
 *
 * Represents a single log message with all metadata.
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;

  /** Log message */
  message: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Contextual data */
  context?: LogContext;

  /** Error information (if logging an error) */
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Core logger interface
 *
 * This interface is backward compatible with the existing
 * xivdyetools-core Logger interface.
 *
 * @example
 * ```typescript
 * const logger: Logger = createConsoleLogger();
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Failed to load data', error, { operation: 'fetchDyes' });
 * ```
 */
export interface Logger {
  /**
   * Log a debug message (typically suppressed in production)
   * @param message - Message to log
   * @param context - Optional contextual data
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log an informational message
   * @param message - Message to log
   * @param context - Optional contextual data
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log a warning message
   * @param message - Message to log
   * @param context - Optional contextual data
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log an error message
   * @param message - Message to log
   * @param error - Optional error object
   * @param context - Optional contextual data
   */
  error(message: string, error?: unknown, context?: LogContext): void;
}

/**
 * Extended logger with additional features
 *
 * Adds context inheritance and performance timing utilities.
 */
export interface ExtendedLogger extends Logger {
  /**
   * Create a child logger with inherited context
   *
   * The child logger will include all context from the parent
   * in addition to any context passed to individual log calls.
   *
   * @param context - Context to inherit
   * @returns New logger with inherited context
   *
   * @example
   * ```typescript
   * const requestLogger = logger.child({ requestId: 'abc-123' });
   * requestLogger.info('Processing request'); // Includes requestId
   * ```
   */
  child(context: LogContext): ExtendedLogger;

  /**
   * Set global context for all log entries
   *
   * @param context - Context to merge with existing global context
   */
  setContext(context: LogContext): void;

  /**
   * Start a performance timer
   *
   * Returns a function that, when called, logs the elapsed time
   * and returns the duration in milliseconds.
   *
   * @param label - Label for the timing
   * @returns Function to end timer and get duration
   *
   * @example
   * ```typescript
   * const end = logger.time('database-query');
   * await db.query(...);
   * const duration = end(); // Logs: "database-query: 45.23ms"
   * ```
   */
  time(label: string): () => number;

  /**
   * Time an async operation
   *
   * Wraps an async function and logs the execution time.
   *
   * @param label - Label for the timing
   * @param fn - Async function to time
   * @returns Promise resolving to the function's return value
   */
  timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T>;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum level to log (default: 'info') */
  level: LogLevel;

  /** Output format */
  format: 'json' | 'pretty';

  /** Include timestamps in output */
  timestamps: boolean;

  /** Prefix for log messages */
  prefix?: string;

  /** Enable error sanitization (remove sensitive data) */
  sanitizeErrors: boolean;

  /** Fields to redact from context */
  redactFields?: string[];
}

/**
 * Error tracker interface for external error reporting
 *
 * Implement this interface to integrate with error tracking
 * services like Sentry.
 */
export interface ErrorTracker {
  /**
   * Capture an exception
   * @param error - Error to capture
   * @param context - Additional context
   */
  captureException(error: unknown, context?: Record<string, unknown>): void;

  /**
   * Capture a message
   * @param message - Message to capture
   * @param level - Severity level
   */
  captureMessage(message: string, level?: string): void;

  /**
   * Set a tag for subsequent events
   * @param key - Tag key
   * @param value - Tag value
   */
  setTag(key: string, value: string): void;

  /**
   * Set user information
   * @param user - User info
   */
  setUser(user: { id?: string; username?: string; email?: string }): void;
}
