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

// ============================================================================
// Backward-Compatible Logger
// ============================================================================

/**
 * Centralized logger with dev-mode filtering
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
  },

  error(...args: unknown[]): void {
    console.error(...args);
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
