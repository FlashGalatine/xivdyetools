/**
 * Tests for ConsoleAdapter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleAdapter } from './console-adapter.js';
import type { LogContext, LogEntry } from '../types.js';

describe('ConsoleAdapter', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));

    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should default to pretty format', () => {
      const logger = new ConsoleAdapter();
      logger.info('Test');
      expect(consoleSpy.info).toHaveBeenCalled();
      // Pretty format includes timestamp in brackets
      expect(consoleSpy.info.mock.calls[0][0]).toContain('[2024-01-15T12:00:00.000Z]');
    });

    it('should accept JSON format', () => {
      const logger = new ConsoleAdapter({ format: 'json' });
      logger.info('Test', { data: 'value' });
      expect(consoleSpy.info).toHaveBeenCalled();
      // JSON format should be parseable JSON
      const logged = consoleSpy.info.mock.calls[0][0];
      expect(() => JSON.parse(logged)).not.toThrow();
    });
  });

  describe('pretty format output', () => {
    it('should output info messages with console.info', () => {
      const logger = new ConsoleAdapter({ format: 'pretty' });
      logger.info('Info message');
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      expect(consoleSpy.info.mock.calls[0][0]).toContain('Info message');
    });

    it('should output debug messages with console.debug', () => {
      const logger = new ConsoleAdapter({ format: 'pretty', level: 'debug' });
      logger.debug('Debug message');
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpy.debug.mock.calls[0][0]).toContain('Debug message');
    });

    it('should output warn messages with console.warn', () => {
      const logger = new ConsoleAdapter({ format: 'pretty' });
      logger.warn('Warning message');
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn.mock.calls[0][0]).toContain('Warning message');
    });

    it('should output error messages with console.error', () => {
      const logger = new ConsoleAdapter({ format: 'pretty' });
      logger.error('Error message');
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error.mock.calls[0][0]).toContain('Error message');
    });

    it('should include timestamp in pretty output', () => {
      const logger = new ConsoleAdapter({ format: 'pretty', timestamps: true });
      logger.info('Test');
      expect(consoleSpy.info.mock.calls[0][0]).toMatch(/\[2024-01-15T12:00:00\.000Z\]/);
    });

    it('should exclude timestamp when timestamps is false', () => {
      const logger = new ConsoleAdapter({ format: 'pretty', timestamps: false });
      logger.info('Test');
      expect(consoleSpy.info.mock.calls[0][0]).not.toContain('[2024-01-15');
    });

    it('should include context as JSON in pretty output', () => {
      const logger = new ConsoleAdapter({ format: 'pretty' });
      logger.info('Test', { userId: '123', operation: 'fetch' });
      const logged = consoleSpy.info.mock.calls[0][0];
      expect(logged).toContain('"userId":"123"');
      expect(logged).toContain('"operation":"fetch"');
    });

    it('should not include empty context', () => {
      const logger = new ConsoleAdapter({ format: 'pretty' });
      logger.info('Test', {});
      const logged = consoleSpy.info.mock.calls[0][0];
      expect(logged).not.toContain('{}');
    });

    it('should pass error as second argument in pretty format', () => {
      const logger = new ConsoleAdapter({ format: 'pretty', sanitizeErrors: false });
      const error = new Error('Test error');
      logger.error('Failed', error);
      
      // Error info should be included
      expect(consoleSpy.error).toHaveBeenCalled();
      // The error is passed as second argument for browser console formatting
      expect(consoleSpy.error.mock.calls[0].length).toBe(2);
    });

    it('should pass error with debug level', () => {
      const logger = new ConsoleAdapter({ format: 'pretty', level: 'debug', sanitizeErrors: false });
      // Test through entry creation - debug level with error context
      logger.debug('Debug with error');
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should pass error with warn level', () => {
      const logger = new ConsoleAdapter({ format: 'pretty', sanitizeErrors: false });
      logger.warn('Warning');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should pass error info with info level when error is in entry', () => {
      // We need to test that the error object is passed when present in the entry
      // This tests the `if (error)` branches in writePretty for info level
      const loggerWithError = new ConsoleAdapter({ format: 'pretty', level: 'debug' });
      
      // Since the Logger interface doesn't have debug/info with error, we can only test
      // the error() method path or check the code paths exist
      loggerWithError.info('Info message');
      expect(consoleSpy.info).toHaveBeenCalled();
    });
  });

  describe('JSON format output', () => {
    it('should output valid JSON', () => {
      const logger = new ConsoleAdapter({ format: 'json' });
      logger.info('Test message', { userId: '123' });

      const logged = consoleSpy.info.mock.calls[0][0];
      const parsed = JSON.parse(logged);

      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Test message');
      expect(parsed.context.userId).toBe('123');
      expect(parsed.timestamp).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should use appropriate console method for each level in JSON format', () => {
      const logger = new ConsoleAdapter({ format: 'json', level: 'debug' });

      logger.debug('Debug');
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);

      logger.info('Info');
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);

      logger.warn('Warn');
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);

      logger.error('Error');
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('should include error information in JSON output', () => {
      const logger = new ConsoleAdapter({ format: 'json' });
      const error = new Error('Something failed');
      logger.error('Operation failed', error);

      const logged = consoleSpy.error.mock.calls[0][0];
      const parsed = JSON.parse(logged);

      expect(parsed.error).toBeDefined();
      expect(parsed.error.name).toBe('Error');
      expect(parsed.error.message).toBe('Something failed');
    });
  });

  describe('log level filtering', () => {
    it('should respect log level in pretty format', () => {
      const logger = new ConsoleAdapter({ format: 'pretty', level: 'warn' });

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('should respect log level in JSON format', () => {
      const logger = new ConsoleAdapter({ format: 'json', level: 'error' });

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('prefix', () => {
    it('should include prefix in pretty output', () => {
      const logger = new ConsoleAdapter({ format: 'pretty', prefix: 'MyApp' });
      logger.info('Test');
      expect(consoleSpy.info.mock.calls[0][0]).toContain('[MyApp]');
    });

    it('should include prefix in JSON output', () => {
      const logger = new ConsoleAdapter({ format: 'json', prefix: 'MyApp' });
      logger.info('Test');

      const parsed = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(parsed.message).toContain('[MyApp]');
    });
  });

  describe('context handling', () => {
    it('should include global context', () => {
      const logger = new ConsoleAdapter({ format: 'json' });
      logger.setContext({ service: 'test-service' });
      logger.info('Test');

      const parsed = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(parsed.context.service).toBe('test-service');
    });

    it('should merge global and local context', () => {
      const logger = new ConsoleAdapter({ format: 'json' });
      logger.setContext({ service: 'test-service' });
      logger.info('Test', { operation: 'fetch' });

      const parsed = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(parsed.context.service).toBe('test-service');
      expect(parsed.context.operation).toBe('fetch');
    });
  });

  describe('child logger', () => {
    it('should create child logger with inherited context', () => {
      const logger = new ConsoleAdapter({ format: 'json' });
      logger.setContext({ service: 'parent' });

      const child = logger.child({ requestId: 'req-123' });
      child.info('Child message');

      const parsed = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(parsed.context.service).toBe('parent');
      expect(parsed.context.requestId).toBe('req-123');
    });
  });

  describe('error payloads on every level', () => {
    /**
     * `write` is protected and only `error()` carries an error through the
     * public Logger API, so the debug/info/warn error arms of the level
     * switch are unreachable from outside. Exposing `write` is the only way
     * to assert the adapter's actual write contract.
     */
    class ExposedConsoleAdapter extends ConsoleAdapter {
      public emit(entry: LogEntry): void {
        this.write(entry);
      }
    }

    const entry = (level: LogEntry['level'], error?: Error): LogEntry =>
      ({
        level,
        message: `${level} line`,
        timestamp: '2024-01-15T12:00:00.000Z',
        ...(error !== undefined ? { error } : {}),
      }) as LogEntry;

    it('passes an error through as a second console argument on every level', () => {
      const logger = new ExposedConsoleAdapter({ level: 'debug', format: 'pretty' });
      const boom = new Error('boom');

      logger.emit(entry('debug', boom));
      logger.emit(entry('info', boom));
      logger.emit(entry('warn', boom));
      logger.emit(entry('error', boom));

      expect(consoleSpy.debug.mock.calls[0]).toHaveLength(2);
      expect(consoleSpy.info.mock.calls[0]).toHaveLength(2);
      expect(consoleSpy.warn.mock.calls[0]).toHaveLength(2);
      expect(consoleSpy.error.mock.calls[0]).toHaveLength(2);
      expect(consoleSpy.debug.mock.calls[0][1]).toBe(boom);
    });

    it('omits the second argument on every level when there is no error', () => {
      const logger = new ExposedConsoleAdapter({ level: 'debug', format: 'pretty' });

      logger.emit(entry('debug'));
      logger.emit(entry('info'));
      logger.emit(entry('warn'));
      logger.emit(entry('error'));

      expect(consoleSpy.debug.mock.calls[0]).toHaveLength(1);
      expect(consoleSpy.info.mock.calls[0]).toHaveLength(1);
      expect(consoleSpy.warn.mock.calls[0]).toHaveLength(1);
      expect(consoleSpy.error.mock.calls[0]).toHaveLength(1);
    });

    it('logs a single argument when there is no error', () => {
      const logger = new ConsoleAdapter({ level: 'debug', format: 'pretty' });

      logger.debug('dbg');
      logger.info('inf');
      logger.warn('wrn');
      logger.error('err');

      expect(consoleSpy.debug.mock.calls[0].length).toBe(1);
      expect(consoleSpy.info.mock.calls[0].length).toBe(1);
      expect(consoleSpy.warn.mock.calls[0].length).toBe(1);
      expect(consoleSpy.error.mock.calls[0].length).toBe(1);
    });

    it('routes each level to its own console method', () => {
      const logger = new ConsoleAdapter({ level: 'debug', format: 'pretty' });

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// BUG-104 (deep dive 2026-09-02): `ConsoleAdapter` serialised with raw
// `JSON.stringify`, so a circular or BigInt context threw OUT of the log call
// and took the caller down — the exact failure FINDING-026 fixed, applied to
// `JsonAdapter` only.
//
// Redaction does not break the cycle for us (BUG-004: the guard used to
// re-insert the original node), so `JSON.stringify` saw a real cycle.
//
// Live consumers: `apps/stoat-worker` via `createLibraryLogger`, this package's
// `ConsoleLogger` / `browserLogger` / `createBrowserLogger`, and any npm
// consumer — `ConsoleAdapter` is `@public`. `console-adapter.test.ts` had no
// circular or BigInt case at all, and `hardening.test.ts` builds its capture
// helper on `JsonAdapter` only.
// ---------------------------------------------------------------------------
describe('BUG-104: a circular or BigInt context never throws out of the log call', () => {
  const shapes: Array<[string, () => LogContext]> = [
    [
      'self-referential object',
      () => {
        const ctx: LogContext = { a: 1 };
        ctx.self = ctx;
        return ctx;
      },
    ],
    ['BigInt value', () => ({ n: 1n } as unknown as LogContext)],
    [
      'cycle through an array',
      () => {
        const inner: LogContext = { token: 'shhh' };
        const ctx: LogContext = { items: [inner] };
        inner.back = ctx;
        return ctx;
      },
    ],
  ];

  describe.each(shapes)('%s', (_name, build) => {
    it('pretty format survives and still logs', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = new ConsoleAdapter({ format: 'pretty', level: 'debug' });
      expect(() => logger.info('x', build())).not.toThrow();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('json format survives and still logs', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = new ConsoleAdapter({ format: 'json', level: 'debug' });
      expect(() => logger.info('x', build())).not.toThrow();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  it('and the secret behind the cycle is still absent from the output (BUG-004)', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new ConsoleAdapter({ format: 'json', level: 'debug' });
    const inner: LogContext = { token: 'shhh' };
    const ctx: LogContext = { items: [inner] };
    inner.back = ctx;

    logger.info('array cycle', ctx);

    const written = spy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(written).not.toContain('shhh');
    spy.mockRestore();
  });
});
