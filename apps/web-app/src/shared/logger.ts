/* eslint-disable no-console */
/* istanbul ignore file */
/**
 * XIV Dye Tools - Centralized Logger
 *
 * Powered by `@xivdyetools/logger/browser`, with a variadic
 * `console`-shaped façade for the ~560 existing call sites.
 *
 * @module shared/logger
 */

import { createBrowserLogger } from '@xivdyetools/logger/browser';
import type { ExtendedLogger, LogContext } from '@xivdyetools/logger';

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
 *
 * @testonly test-isolation hook — forces `isDev()`'s return value so suites
 * can exercise both the dev and prod logging branches without depending on
 * Vite's `import.meta.env.DEV`, then must reset it to `null` afterward.
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
 * BUG-061 (deep dive 2026-09-02): the package logger is the one that actually
 * runs, instead of being imported and then ignored.
 *
 * `browserLogger` was imported here as `_browserLogger` and never referenced —
 * every method below wrote straight to `console`, so **none of the package's
 * secret redaction ran in the browser at all**: no key-name field redaction, no
 * value-shape scan, no free-text `key=value` sanitisation. A
 * `logger.error('[Auth] refresh failed', { token })` printed the token.
 *
 * Two loggers rather than the `browserLogger` singleton, because that singleton
 * evaluates `isDev()` once at module load and could never see
 * `__setTestEnvironment`. Each is built on first use and reused after.
 */
let devLogger: ExtendedLogger | null = null;
let prodLogger: ExtendedLogger | null = null;

function active(): ExtendedLogger {
  if (isDev()) {
    devLogger ??= createBrowserLogger({ isDev: () => true });
    return devLogger;
  }
  prodLogger ??= createBrowserLogger({ isDev: () => false });
  return prodLogger;
}

/**
 * The package API is `(message, context?)`; call sites here are variadic and
 * console-shaped (`logger.info('count:', 42, { status: 'ok' })`). The first
 * argument becomes the message and **every remaining argument becomes context**
 * — which is the load-bearing half: a value that stays out of the context
 * object is a value redaction never sees.
 */
function splitArgs(args: unknown[]): { message: string; context?: LogContext } {
  const [first, ...rest] = args;
  const message = typeof first === 'string' ? first : stringifyArg(first);
  return { message, context: toContext(rest) };
}

function stringifyArg(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function isPlainObject(value: unknown): value is LogContext {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `JSON.stringify(new Error('boom'))` is `{}` — name and message are
 * non-enumerable — so an Error placed in a context vanishes from the line.
 * `logger.warn('Warning:', err)` is a common shape here (92 warn call sites),
 * and losing the message is worse than the console shape it replaced.
 */
function serialiseArg(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  return value;
}

function toContext(rest: unknown[]): LogContext | undefined {
  if (rest.length === 0) return undefined;
  // One plain object is already a context. Anything else is positional, and
  // gets a positional key rather than being dropped.
  if (rest.length === 1 && isPlainObject(rest[0]) && !(rest[0] instanceof Error)) {
    return rest[0];
  }
  return Object.fromEntries(rest.map((value, i) => [`arg${i}`, serialiseArg(value)]));
}

// ============================================================================
// Backward-Compatible Logger
// ============================================================================

/**
 * Centralized logger with dev-mode filtering.
 *
 * The dev gates below are this module's own, deliberately kept rather than
 * delegated to the package's level config: the package's production level is
 * `warn`, so delegating would start emitting warnings in production — a
 * behaviour change beyond the redaction fix. What production gets that it did
 * not before is redaction on the one method that runs there, `error`.
 *
 * @deprecated Use `createBrowserLogger()` from '@xivdyetools/logger/browser' instead.
 * This backward-compatible logger object will be removed in the next major version.
 */
export const logger = {
  debug(...args: unknown[]): void {
    if (isDev()) {
      const { message, context } = splitArgs(args);
      active().debug(message, context);
    }
  },

  info(...args: unknown[]): void {
    if (isDev()) {
      const { message, context } = splitArgs(args);
      active().info(message, context);
    }
  },

  warn(...args: unknown[]): void {
    if (isDev()) {
      const { message, context } = splitArgs(args);
      active().warn(message, context);
    }
  },

  error(...args: unknown[]): void {
    const [first, ...rest] = args;
    // `logger.error('[X] failed', err)` and `logger.error(err)` are both
    // common; an Error goes to the package's own `error` slot, where its
    // message is sanitised and its stack dropped in production.
    if (first instanceof Error) {
      active().error(first.message, first, toContext(rest));
      return;
    }
    const message = typeof first === 'string' ? first : stringifyArg(first);
    const [maybeError, ...tail] = rest;
    if (maybeError instanceof Error) {
      active().error(message, maybeError, toContext(tail));
      return;
    }
    active().error(message, undefined, toContext(rest));
  },

  log(...args: unknown[]): void {
    if (isDev()) {
      const { message, context } = splitArgs(args);
      active().info(message, context);
    }
  },

  // `group` / `groupEnd` / `table` have no package equivalent — they are
  // console-shape presentation, not log records. They stay on `console`, and
  // they are dev-only. No production call site uses any of the three.
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
