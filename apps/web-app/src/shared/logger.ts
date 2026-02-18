/* eslint-disable no-console */
/* istanbul ignore file */
/**
 * XIV Dye Tools v2.0.4 - Centralized Logger
 *
 * Now powered by @xivdyetools/logger/browser.
 * Re-exports for backward compatibility with existing imports.
 *
 * @module shared/logger
 */

// ============================================================================
// Re-exports from @xivdyetools/logger
// ============================================================================

// Re-export perf utilities
export { perf, createBrowserLogger } from '@xivdyetools/logger/browser';

// Re-export browserLogger as logger for backward compatibility
import { browserLogger as _browserLogger } from '@xivdyetools/logger/browser';

// Re-export types
export type { ErrorTracker } from '@xivdyetools/logger';

// ============================================================================
// Backward Compatibility Layer
// ============================================================================

/**
 * Test environment override (for unit testing only)
 * @deprecated Use createBrowserLogger({ isDev: () => true }) instead
 */
let testEnvironmentOverride: { isDev: boolean; isProd: boolean } | null = null;

/**
 * Set test environment override (for unit testing only)
 * @deprecated Use createBrowserLogger({ isDev: () => true }) instead
 */
export function __setTestEnvironment(override: { isDev: boolean; isProd: boolean } | null): void {
  testEnvironmentOverride = override;
}

/**
 * Check if we're in development mode
 */
const isDev = (): boolean => {
  if (testEnvironmentOverride !== null) {
    return testEnvironmentOverride.isDev;
  }

  if (typeof import.meta === 'undefined') {
    return false;
  }
  const meta = import.meta as { env?: { DEV?: boolean } };
  return meta.env?.DEV === true;
};

/**
 * Check if we're in production mode
 */
const isProd = (): boolean => {
  if (testEnvironmentOverride !== null) {
    return testEnvironmentOverride.isProd;
  }

  if (typeof import.meta === 'undefined') {
    return true;
  }
  const meta = import.meta as { env?: { PROD?: boolean } };
  return meta.env?.PROD === true;
};

// Error tracking state (for backward compatibility)
let errorTrackerInstance: import('@xivdyetools/logger').ErrorTracker | null = null;

/**
 * Initialize error tracking service
 * @deprecated Configure errorTracker in createBrowserLogger() options instead
 */
export function initErrorTracking(tracker: import('@xivdyetools/logger').ErrorTracker): void {
  errorTrackerInstance = tracker;
  logger.info('Error tracking initialized');
}

// ============================================================================
// Backward-Compatible Logger
// ============================================================================

/**
 * Centralized logger with dev-mode filtering and error tracking
 *
 * Wraps @xivdyetools/logger/browser with backward-compatible API.
 *
 * @deprecated Use `createBrowserLogger()` from '@xivdyetools/logger/browser' instead.
 * This backward-compatible logger object will be removed in the next major version.
 */
export const logger = {
  debug(...args: unknown[]): void {
    if (isDev()) {
      console.debug(...args);
    }
  },

  info(...args: unknown[]): void {
    if (isDev()) {
      console.info(...args);
    }
  },

  warn(...args: unknown[]): void {
    if (isDev()) {
      console.warn(...args);
    }
    if (isProd() && errorTrackerInstance) {
      const message = args.map((arg) => String(arg)).join(' ');
      errorTrackerInstance.captureMessage(message, 'warning');
    }
  },

  error(...args: unknown[]): void {
    console.error(...args);
    if (isProd() && errorTrackerInstance) {
      const firstArg = args[0];
      if (firstArg instanceof Error) {
        errorTrackerInstance.captureException(firstArg, { extra: args.slice(1) });
      } else {
        const message = args.map((arg) => String(arg)).join(' ');
        errorTrackerInstance.captureMessage(message, 'error');
      }
    }
  },

  log(...args: unknown[]): void {
    if (isDev()) {
      console.log(...args);
    }
  },

  group(label: string): void {
    if (isDev()) {
      console.group(label);
    }
  },

  groupEnd(): void {
    if (isDev()) {
      console.groupEnd();
    }
  },

  table(data: unknown): void {
    if (isDev()) {
      console.table(data);
    }
  },
};
