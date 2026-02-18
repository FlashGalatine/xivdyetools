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
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    devOnly: _devOnly = true, // Reserved for future use
    isDev = defaultIsDev,
    errorTracker,
    prefix = 'xivdyetools',
  } = options;

  const isDevMode = isDev();

  // In production with devOnly, use a minimal logger
  const config: Partial<LoggerConfig> = {
    level: isDevMode ? 'debug' : 'warn',
    format: 'pretty',
    timestamps: true,
    prefix,
    sanitizeErrors: !isDevMode,
  };

  const logger = new ConsoleAdapter(config);

  // Wrap error method to send to error tracker in production
  if (errorTracker && !isDevMode) {
    const originalError = logger.error.bind(logger);
    logger.error = (message: string, error?: unknown, context?: LogContext) => {
      // Still log to console
      originalError(message, error, context);

      // Send to error tracker
      if (error instanceof Error) {
        errorTracker.captureException(error, context);
      } else if (error) {
        errorTracker.captureMessage(`${message}: ${String(error)}`, 'error');
      } else {
        errorTracker.captureMessage(message, 'error');
      }
    };

    // Also send warnings to error tracker
    const originalWarn = logger.warn.bind(logger);
    logger.warn = (message: string, context?: LogContext) => {
      originalWarn(message, context);
      errorTracker.captureMessage(message, 'warning');
    };
  }

  return logger;
}

// ============================================================================
// Performance Monitoring (from xivdyetools-web-app)
// ============================================================================

interface MetricsData {
  count: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  avgTime: number;
}

const metricsStore = new Map<string, MetricsData>();
const activeTimers = new Map<string, number>();

/**
 * Performance monitoring utilities
 *
 * Provides timing and metrics collection for browser performance monitoring.
 *
 * @example
 * ```typescript
 * // Time a synchronous operation
 * perf.start('render');
 * renderComponent();
 * perf.end('render');
 *
 * // Time an async operation
 * const data = await perf.measure('fetchDyes', () => fetchDyes());
 *
 * // Get metrics
 * console.log(perf.getMetrics('render'));
 * // { count: 5, totalTime: 125.4, minTime: 20.1, maxTime: 30.2, avgTime: 25.08 }
 * ```
 */
export const perf = {
  /**
   * Start a performance timer
   *
   * LOGGER-BUG-001 FIX: Warn if timer is already active to prevent
   * race condition data loss in concurrent operations.
   *
   * @returns true if timer was started, false if already active
   */
  start(label: string): boolean {
    if (activeTimers.has(label)) {
      console.warn(
        `Timer "${label}" is already active. Call end() before starting again, ` +
          `or use a unique label for concurrent operations.`
      );
      return false;
    }
    activeTimers.set(label, performance.now());
    return true;
  },

  /**
   * End a performance timer and record metrics
   * @returns Duration in milliseconds
   */
  end(label: string): number {
    const startTime = activeTimers.get(label);
    if (startTime === undefined) {
      console.warn(`No timer started for label: ${label}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    activeTimers.delete(label);

    // Update metrics
    const existing = metricsStore.get(label);
    if (existing) {
      existing.count++;
      existing.totalTime += duration;
      existing.minTime = Math.min(existing.minTime, duration);
      existing.maxTime = Math.max(existing.maxTime, duration);
      existing.avgTime = existing.totalTime / existing.count;
    } else {
      metricsStore.set(label, {
        count: 1,
        totalTime: duration,
        minTime: duration,
        maxTime: duration,
        avgTime: duration,
      });
    }

    return duration;
  },

  /**
   * Measure an async operation
   */
  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      return await fn();
    } finally {
      this.end(label);
    }
  },

  /**
   * Measure a synchronous operation
   */
  measureSync<T>(label: string, fn: () => T): T {
    this.start(label);
    try {
      return fn();
    } finally {
      this.end(label);
    }
  },

  /**
   * Get metrics for a specific label
   */
  getMetrics(label: string): MetricsData | null {
    return metricsStore.get(label) || null;
  },

  /**
   * Get all collected metrics
   */
  getAllMetrics(): Record<string, MetricsData> {
    return Object.fromEntries(metricsStore);
  },

  /**
   * Log all metrics to console
   */
  logMetrics(): void {
    console.group('Performance Metrics');
    for (const [label, metrics] of metricsStore) {
      console.log(
        `${label}: count=${metrics.count}, avg=${metrics.avgTime.toFixed(2)}ms, min=${metrics.minTime.toFixed(2)}ms, max=${metrics.maxTime.toFixed(2)}ms`
      );
    }
    console.groupEnd();
  },

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    metricsStore.clear();
    activeTimers.clear();
  },
};

/**
 * Pre-configured browser logger instance
 *
 * Use this for quick setup. For production apps with error tracking,
 * use `createBrowserLogger()` with options.
 */
export const browserLogger = createBrowserLogger();
