/**
 * XIV Dye Tools - Logger Tests
 *
 * BUG-061 (deep dive 2026-09-02): this module used to import `browserLogger`
 * and then never reference it — every method wrote straight to `console`, so
 * none of the package's secret redaction ran in the browser. It routes through
 * `@xivdyetools/logger/browser` now.
 *
 * That changes the SHAPE of the console call: the adapter formats one line
 * (`[xivdyetools] message {"context":…}`) rather than forwarding the caller's
 * arguments verbatim. Every assertion below was `toHaveBeenCalledWith(<the
 * exact args>)`; they assert the message survives and the level is right
 * instead, plus — the point of the fix — that a secret does not survive.
 *
 * @module shared/__tests__/logger.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';

// Unmock the logger module for this test file to test the actual implementation
vi.unmock('@shared/logger');

import { logger, __setTestEnvironment } from '../logger';

/** Everything the spy was handed, flattened — the adapter formats one line. */
function written(spy: MockInstance): string {
  return spy.mock.calls
    .map((call) => call.map((arg) => (typeof arg === 'string' ? arg : String(arg))).join(' '))
    .join('\n');
}

describe('Logger Module', () => {
  let consoleDebugSpy: MockInstance;
  let consoleInfoSpy: MockInstance;
  let consoleWarnSpy: MockInstance;
  let consoleErrorSpy: MockInstance;
  let consoleGroupSpy: MockInstance;
  let consoleGroupEndSpy: MockInstance;
  let consoleTableSpy: MockInstance;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleTableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Logger Methods
  // ==========================================================================

  describe('logger', () => {
    describe('debug', () => {
      it('should call console.debug in dev mode', () => {
        logger.debug('test message');
        expect(written(consoleDebugSpy)).toContain('test message');
      });

      it('should carry every extra argument into the context', () => {
        logger.debug('message', { data: 123 }, [1, 2, 3]);
        const line = written(consoleDebugSpy);
        expect(line).toContain('message');
        // Positional keys, because two arguments are not one context object.
        expect(line).toContain('123');
        expect(line).toContain('arg0');
        expect(line).toContain('arg1');
      });

      it('a single plain object is used as the context directly', () => {
        logger.debug('message', { data: 123 });
        const line = written(consoleDebugSpy);
        expect(line).toContain('"data":123');
        expect(line).not.toContain('arg0');
      });
    });

    describe('info', () => {
      it('should call console.info in dev mode', () => {
        logger.info('info message');
        expect(written(consoleInfoSpy)).toContain('info message');
      });

      it('should handle objects and numbers', () => {
        logger.info('count:', 42, { status: 'ok' });
        const line = written(consoleInfoSpy);
        expect(line).toContain('count:');
        expect(line).toContain('42');
        expect(line).toContain('ok');
      });
    });

    describe('warn', () => {
      it('should call console.warn in dev mode', () => {
        logger.warn('warning message');
        expect(written(consoleWarnSpy)).toContain('warning message');
      });

      it('should handle error objects', () => {
        const err = new Error('test error');
        logger.warn('Warning:', err);
        const line = written(consoleWarnSpy);
        expect(line).toContain('Warning:');
        expect(line).toContain('test error');
      });
    });

    describe('error', () => {
      it('should always call console.error', () => {
        logger.error('error message');
        expect(written(consoleErrorSpy)).toContain('error message');
      });

      it('should handle Error instances', () => {
        const err = new Error('test error');
        logger.error(err);
        expect(written(consoleErrorSpy)).toContain('test error');
      });

      it('should handle multiple arguments with Error', () => {
        const err = new Error('test error');
        logger.error('Failed:', err, { context: 'test' });
        const line = written(consoleErrorSpy);
        expect(line).toContain('Failed:');
        expect(line).toContain('test');
      });
    });

    describe('log', () => {
      it('routes to info (the package has no `log` level)', () => {
        logger.log('general message');
        expect(written(consoleInfoSpy)).toContain('general message');
      });
    });

    describe('group', () => {
      it('should call console.group in dev mode', () => {
        logger.group('Test Group');
        expect(consoleGroupSpy).toHaveBeenCalledWith('Test Group');
      });
    });

    describe('groupEnd', () => {
      it('should call console.groupEnd in dev mode', () => {
        logger.groupEnd();
        expect(consoleGroupEndSpy).toHaveBeenCalled();
      });
    });

    describe('table', () => {
      it('should call console.table in dev mode', () => {
        const data = [{ name: 'test', value: 1 }];
        logger.table(data);
        expect(consoleTableSpy).toHaveBeenCalledWith(data);
      });
    });
  });
});

// ==========================================================================
// BUG-061: redaction actually runs
// ==========================================================================

describe('BUG-061: the package logger runs, so secrets are redacted', () => {
  let consoleErrorSpy: MockInstance;
  let consoleWarnSpy: MockInstance;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    __setTestEnvironment(null);
    vi.restoreAllMocks();
  });

  it('redacts a secret-named field in production, where errors still log', () => {
    // Production is the case that matters: `error` is the one method that runs
    // there, and before this fix it went straight to `console.error` raw.
    __setTestEnvironment({ isDev: false, isProd: true });

    logger.error('[Auth] refresh failed', { token: 'hunter2-SECRET' });

    const line = written(consoleErrorSpy);
    expect(line).not.toContain('hunter2-SECRET');
    expect(line).toContain('[REDACTED]');
    expect(line).toContain('refresh failed');
  });

  it('redacts a secret in a POSITIONAL argument too, not just a lone context object', () => {
    // The variadic façade is where a value can get lost: an argument that does
    // not reach the context object is one redaction never sees.
    __setTestEnvironment({ isDev: false, isProd: true });

    logger.error('[Auth] failed for', 'user-1', { apiKey: 'k-SECRET-VALUE' });

    const line = written(consoleErrorSpy);
    expect(line).not.toContain('k-SECRET-VALUE');
    expect(line).toContain('[REDACTED]');
  });

  it('sanitises a secret in the free-text message in production', () => {
    __setTestEnvironment({ isDev: false, isProd: true });

    logger.error('upstream rejected authorization: Basic dXNlcjpwYXNzd29yZA==');

    const line = written(consoleErrorSpy);
    expect(line).not.toContain('dXNlcjpwYXNzd29yZA==');
  });

  it('does not throw on a circular context', () => {
    __setTestEnvironment({ isDev: false, isProd: true });
    const ctx: Record<string, unknown> = { a: 1 };
    ctx.self = ctx;

    expect(() => logger.error('circular', ctx)).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('production still suppresses warn, as it always did', () => {
    // The package's own production level is `warn`, so delegating the gating
    // would have started emitting warnings in production. This module keeps
    // its own gates precisely so the redaction fix is not also a behaviour
    // change.
    __setTestEnvironment({ isDev: false, isProd: true });
    logger.warn('should not appear');
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// Dev Mode Logging Verification
// ==========================================================================

describe('Dev Mode Logging Behavior', () => {
  let consoleDebugSpy: MockInstance;
  let consoleInfoSpy: MockInstance;
  let consoleGroupSpy: MockInstance;
  let consoleGroupEndSpy: MockInstance;
  let consoleTableSpy: MockInstance;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleTableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call console.debug in dev mode', () => {
    logger.debug('debug message');
    expect(written(consoleDebugSpy)).toContain('debug message');
  });

  it('should call console.info in dev mode', () => {
    logger.info('info message');
    expect(written(consoleInfoSpy)).toContain('info message');
  });

  it('log routes to console.info in dev mode', () => {
    logger.log('log message');
    expect(written(consoleInfoSpy)).toContain('log message');
  });

  it('should call console.group in dev mode', () => {
    logger.group('group label');
    expect(consoleGroupSpy).toHaveBeenCalledWith('group label');
  });

  it('should call console.groupEnd in dev mode', () => {
    logger.groupEnd();
    expect(consoleGroupEndSpy).toHaveBeenCalled();
  });

  it('should call console.table in dev mode', () => {
    const data = [{ a: 1 }, { a: 2 }];
    logger.table(data);
    expect(consoleTableSpy).toHaveBeenCalledWith(data);
  });
});

// ==========================================================================
// Environment Override Tests
// ==========================================================================

describe('__setTestEnvironment', () => {
  afterEach(() => {
    __setTestEnvironment(null);
    vi.restoreAllMocks();
  });

  it('should allow overriding to production mode', () => {
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    // First verify dev mode works (default)
    __setTestEnvironment({ isDev: true, isProd: false });
    logger.debug('dev message');
    expect(consoleDebugSpy).toHaveBeenCalled();

    consoleDebugSpy.mockClear();

    // Now override to production
    __setTestEnvironment({ isDev: false, isProd: true });
    logger.debug('prod message');
    // In production, debug is NOT logged
    expect(consoleDebugSpy).not.toHaveBeenCalled();
  });

  it('should restore normal behavior when set to null', () => {
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    // Override to production
    __setTestEnvironment({ isDev: false, isProd: true });
    logger.debug('should not log');
    expect(consoleDebugSpy).not.toHaveBeenCalled();

    // Restore normal (vitest runs in dev mode)
    __setTestEnvironment(null);
    logger.debug('should log');
    expect(written(consoleDebugSpy)).toContain('should log');
  });
});
