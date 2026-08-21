/**
 * @xivdyetools/logger - Browser Preset
 *
 * Pre-configured logger for browser environments (xivdyetools-web-app).
 *
 * @module presets/browser
 */

import { ConsoleAdapter } from '../adapters/console-adapter.js';
import type { ExtendedLogger, LogContext, ErrorTracker, LoggerConfig } from '../types.js';

/**
 * Options for browser logger
 */
export interface BrowserLoggerOptions {
  /** Only log in development mode (default: true) */
  devOnly?: boolean;

  /** Custom dev mode detection function */
  isDev?: () => boolean;

  /** Error tracking integration (e.g., Sentry) */
  errorTracker?: ErrorTracker;

  /** Prefix for log messages */
  prefix?: string;
}

/**
 * Default dev mode detection
 *
 * Works with Vite's import.meta.env.DEV
 */
function defaultIsDev(): boolean {
  // Check for Vite's dev mode flag
  if (typeof import.meta !== 'undefined') {
    const meta = import.meta as { env?: { DEV?: boolean; MODE?: string } };
    if (meta.env?.DEV !== undefined) {
      return meta.env.DEV;
    }
    if (meta.env?.MODE !== undefined) {
      return meta.env.MODE === 'development';
    }
  }

  // Check for Node.js environment variable (using globalThis for compatibility)
  const globalProcess = globalThis as { process?: { env?: { NODE_ENV?: string } } };
  if (globalProcess.process?.env?.NODE_ENV) {
    return globalProcess.process.env.NODE_ENV === 'development';
  }

  // Default to false (production)
  return false;
}

/**
 * Create a browser-optimized logger
 *
 * Features:
 * - Development-only logging by default (silent in production)
 * - Pretty console output for easy debugging
 * - Error tracking integration (optional)
 * - Performance timing utilities
 *
 * @example
 * ```typescript
 * // Basic usage
 * const logger = createBrowserLogger();
 * logger.info('App initialized');
 *
 * // With error tracking
 * import * as Sentry from '@sentry/browser';
 * const logger = createBrowserLogger({
 *   errorTracker: {
 *     captureException: (error, context) => Sentry.captureException(error, { extra: context }),
 *     captureMessage: (message, level) => Sentry.captureMessage(message, level),
 *     setTag: (key, value) => Sentry.setTag(key, value),
 *     setUser: (user) => Sentry.setUser(user),
 *   }
 * });
 * ```
 */
export function createBrowserLogger(options: BrowserLoggerOptions = {}): ExtendedLogger {
  const { devOnly = true, isDev = defaultIsDev, errorTracker, prefix = 'xivdyetools' } = options;

  const isDevMode = isDev();

  // REFACTOR-021: devOnly=false keeps verbose logging in production builds
  // (previously accepted and documented but never read).
  const config: Partial<LoggerConfig> = {
    level: isDevMode || !devOnly ? 'debug' : 'warn',
    format: 'pretty',
    timestamps: true,
    prefix,
    sanitizeErrors: !isDevMode,
  };

  const logger = new ConsoleAdapter(config);

  // Wrap error method to send to error tracker in production
  if (errorTracker && !isDevMode) {
    const originalError = logger.error.bind(logger);
    logger.error = (message: string, error?: unknown, context?: LogContext): void => {
      // Still log to console
      originalError(message, error, context);

      // BUG-026: run the tracker path through the same redaction pipeline as
      // the console path — previously the raw context and raw error message
      // left the origin unredacted.
      const safeContext = context ? logger.redactContext(context) : undefined;

      // Send to error tracker
      if (error instanceof Error) {
        const safeError = new Error(logger.sanitizeMessage(error.message));
        safeError.name = error.name;
        // FINDING-026: the first stack line repeats the raw message — run the
        // stack through the same sanitiser (frames are untouched by it)
        safeError.stack = error.stack ? logger.sanitizeMessage(error.stack) : undefined;
        errorTracker.captureException(safeError, safeContext);
      } else if (error) {
        errorTracker.captureMessage(
          logger.sanitizeMessage(
            `${message}: ${typeof error === 'string' ? error : JSON.stringify(error)}`,
          ),
          'error',
        );
      } else {
        errorTracker.captureMessage(logger.sanitizeMessage(message), 'error');
      }
    };

    // Also send warnings to error tracker
    const originalWarn = logger.warn.bind(logger);
    logger.warn = (message: string, context?: LogContext): void => {
      originalWarn(message, context);
      errorTracker.captureMessage(logger.sanitizeMessage(message), 'warning');
    };
  }

  return logger;
}

/**
 * Pre-configured browser logger instance
 *
 * Use this for quick setup. For production apps with error tracking,
 * use `createBrowserLogger()` with options.
 */
export const browserLogger = createBrowserLogger();
