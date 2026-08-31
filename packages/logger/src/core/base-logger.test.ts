/**
 * Tests for BaseLogger
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseLogger } from './base-logger.js';
import type { LogEntry, LoggerConfig, LogContext } from '../types.js';

// Concrete implementation for testing abstract BaseLogger
class TestLogger extends BaseLogger {
  public entries: LogEntry[] = [];

  protected write(entry: LogEntry): void {
    this.entries.push(entry);
  }

  // Expose protected methods for testing
  public testShouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    return this.shouldLog(level);
  }

  public testCreateEntry(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: LogContext,
    error?: unknown,
  ): LogEntry {
    return this.createEntry(level, message, context, error);
  }

  public testMergeContext(context?: LogContext): LogContext | undefined {
    return this.mergeContext(context);
  }

  public testFormatError(error: unknown): LogEntry['error'] {
    return this.formatError(error);
  }

  public testRedactSensitiveFields(context: LogContext): LogContext {
    return this.redactSensitiveFields(context);
  }

  public getConfig(): LoggerConfig {
    return this.config;
  }

  public getGlobalContext(): LogContext {
    return this.globalContext;
  }
}

describe('BaseLogger', () => {
  let logger: TestLogger;

  beforeEach(() => {
    logger = new TestLogger();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default configuration', () => {
      const config = logger.getConfig();
      expect(config.level).toBe('info');
      expect(config.format).toBe('json');
      expect(config.timestamps).toBe(true);
      expect(config.sanitizeErrors).toBe(true);
      // FINDING-026 extended the default list; the original nine must still be there
      expect(config.redactFields).toEqual(
        expect.arrayContaining([
          'password',
          'token',
          'secret',
          'authorization',
          'cookie',
          'api_key',
          'apiKey',
          'access_token',
          'refresh_token',
        ]),
      );
    });

    it('should merge provided config with defaults', () => {
      const customLogger = new TestLogger({
        level: 'debug',
        prefix: 'TestApp',
        format: 'pretty',
      });
      const config = customLogger.getConfig();
      expect(config.level).toBe('debug');
      expect(config.prefix).toBe('TestApp');
      expect(config.format).toBe('pretty');
      expect(config.timestamps).toBe(true); // default preserved
    });

    it('should allow custom redact fields (merged with defaults per FINDING-008)', () => {
      const customLogger = new TestLogger({
        redactFields: ['customSecret', 'myToken'],
      });
      const config = customLogger.getConfig();
      // Custom fields are merged with defaults, not replacing them
      expect(config.redactFields).toContain('customSecret');
      expect(config.redactFields).toContain('myToken');
      // Defaults are preserved
      expect(config.redactFields).toContain('password');
      expect(config.redactFields).toContain('token');
    });
  });

  describe('shouldLog', () => {
    it('should respect log level hierarchy', () => {
      // Default level is 'info'
      expect(logger.testShouldLog('debug')).toBe(false);
      expect(logger.testShouldLog('info')).toBe(true);
      expect(logger.testShouldLog('warn')).toBe(true);
      expect(logger.testShouldLog('error')).toBe(true);
    });

    it('should log all levels when set to debug', () => {
      const debugLogger = new TestLogger({ level: 'debug' });
      expect(debugLogger.testShouldLog('debug')).toBe(true);
      expect(debugLogger.testShouldLog('info')).toBe(true);
      expect(debugLogger.testShouldLog('warn')).toBe(true);
      expect(debugLogger.testShouldLog('error')).toBe(true);
    });

    it('should only log error when set to error', () => {
      const errorLogger = new TestLogger({ level: 'error' });
      expect(errorLogger.testShouldLog('debug')).toBe(false);
      expect(errorLogger.testShouldLog('info')).toBe(false);
      expect(errorLogger.testShouldLog('warn')).toBe(false);
      expect(errorLogger.testShouldLog('error')).toBe(true);
    });

    it('should log warn and error when set to warn', () => {
      const warnLogger = new TestLogger({ level: 'warn' });
      expect(warnLogger.testShouldLog('debug')).toBe(false);
      expect(warnLogger.testShouldLog('info')).toBe(false);
      expect(warnLogger.testShouldLog('warn')).toBe(true);
      expect(warnLogger.testShouldLog('error')).toBe(true);
    });
  });

  describe('createEntry', () => {
    it('should create entry with basic fields', () => {
      const entry = logger.testCreateEntry('info', 'Test message');
      expect(entry).toEqual({
        level: 'info',
        message: 'Test message',
        timestamp: '2024-01-15T12:00:00.000Z',
      });
    });

    it('should add prefix to message when configured', () => {
      const prefixedLogger = new TestLogger({ prefix: 'MyApp' });
      const entry = prefixedLogger.testCreateEntry('info', 'Hello');
      expect(entry.message).toBe('[MyApp] Hello');
    });

    it('should include context when provided', () => {
      const entry = logger.testCreateEntry('info', 'Test', {
        userId: '123',
        operation: 'fetch',
      });
      expect(entry.context).toEqual({
        userId: '123',
        operation: 'fetch',
      });
    });

    it('should not include empty context', () => {
      const entry = logger.testCreateEntry('info', 'Test', {});
      expect(entry.context).toBeUndefined();
    });

    it('should format error object', () => {
      const error = new Error('Something went wrong');
      const entry = logger.testCreateEntry('error', 'Failed', undefined, error);
      expect(entry.error).toBeDefined();
      expect(entry.error?.name).toBe('Error');
      expect(entry.error?.message).toBe('Something went wrong');
    });
  });

  describe('mergeContext', () => {
    it('should return undefined for undefined context with empty global', () => {
      expect(logger.testMergeContext()).toBeUndefined();
    });

    it('should return empty object for empty context with empty global', () => {
      // The implementation merges even empty objects through redactSensitiveFields
      const result = logger.testMergeContext({});
      expect(result).toEqual({});
    });

    it('should return provided context', () => {
      const result = logger.testMergeContext({ userId: '123' });
      expect(result).toEqual({ userId: '123' });
    });

    it('should merge global context with provided context', () => {
      logger.setContext({ requestId: 'req-123' });
      const result = logger.testMergeContext({ userId: '456' });
      expect(result).toEqual({
        requestId: 'req-123',
        userId: '456',
      });
    });

    it('should allow provided context to override global context', () => {
      logger.setContext({ userId: 'global-user' });
      const result = logger.testMergeContext({ userId: 'override-user' });
      expect(result?.userId).toBe('override-user');
    });

    it('should redact sensitive fields', () => {
      const result = logger.testMergeContext({
        userId: '123',
        password: 'secret123', // pragma: allowlist secret
        token: 'abc-token',
      });
      expect(result).toEqual({
        userId: '123',
        password: '[REDACTED]',
        token: '[REDACTED]',
      });
    });
  });

  describe('formatError', () => {
    it('should format Error instances', () => {
      const error = new Error('Test error');
      const result = logger.testFormatError(error);
      expect(result).toEqual({
        name: 'Error',
        message: 'Test error',
      });
    });

    it('should include error code if present', () => {
      const error = new Error('Not found') as Error & { code: string };
      error.code = 'NOT_FOUND';
      const result = logger.testFormatError(error);
      expect(result?.code).toBe('NOT_FOUND');
    });

    it('should not include stack when sanitizeErrors is true', () => {
      const error = new Error('Test');
      const result = logger.testFormatError(error);
      expect(result?.stack).toBeUndefined();
    });

    it('should include stack when sanitizeErrors is false', () => {
      const unsanitizedLogger = new TestLogger({ sanitizeErrors: false });
      const error = new Error('Test');
      const result = unsanitizedLogger.testFormatError(error);
      expect(result?.stack).toBeDefined();
      expect(result?.stack).toContain('Error: Test');
    });

    it('should sanitize sensitive data in error messages', () => {
      const error = new Error('Authorization: Bearer token123abc failed');
      const result = logger.testFormatError(error);
      expect(result?.message).toBe('Authorization: Bearer [REDACTED] failed');
    });

    it('should sanitize token patterns in error messages', () => {
      const error = new Error('Failed with token=mysecrettoken');
      const result = logger.testFormatError(error);
      expect(result?.message).toBe('Failed with token=[REDACTED]');
    });

    it('should sanitize secret patterns in error messages', () => {
      const error = new Error('Invalid secret: mysecret123');
      const result = logger.testFormatError(error);
      expect(result?.message).toBe('Invalid secret=[REDACTED]');
    });

    it('should sanitize password patterns in error messages', () => {
      const error = new Error('Bad password=badpass123');
      const result = logger.testFormatError(error);
      expect(result?.message).toBe('Bad password=[REDACTED]');
    });

    it('should sanitize api_key patterns in error messages', () => {
      const error = new Error('API failed with api_key: sk-12345');
      const result = logger.testFormatError(error);
      expect(result?.message).toBe('API failed with api_key=[REDACTED]');
    });

    it('should handle non-Error objects', () => {
      const result = logger.testFormatError('string error');
      expect(result).toEqual({
        name: 'Unknown',
        message: 'string error',
      });
    });

    it('should handle objects', () => {
      const result = logger.testFormatError({ custom: 'error' });
      // FINDING-026: serialised (and sanitised) instead of "[object Object]"
      expect(result).toEqual({
        name: 'Unknown',
        message: '{"custom":"error"}',
      });
    });

    it('should handle null', () => {
      const result = logger.testFormatError(null);
      expect(result).toEqual({
        name: 'Unknown',
        message: 'null',
      });
    });

    it('should handle undefined', () => {
      const result = logger.testFormatError(undefined);
      expect(result).toEqual({
        name: 'Unknown',
        message: 'undefined',
      });
    });
  });

  describe('redactSensitiveFields', () => {
    it('should redact default sensitive fields', () => {
      const context = {
        userId: 'visible',
        password: 'secret', // pragma: allowlist secret
        token: 'abc123',
        secret: 'mysecret', // pragma: allowlist secret
        authorization: 'Bearer xyz',
        cookie: 'session=abc',
        api_key: 'key123', // pragma: allowlist secret
        apiKey: 'key456', // pragma: allowlist secret
        access_token: 'access123',
        refresh_token: 'refresh123',
      };

      const result = logger.testRedactSensitiveFields(context);
      expect(result).toEqual({
        userId: 'visible',
        password: '[REDACTED]',
        token: '[REDACTED]',
        secret: '[REDACTED]',
        authorization: '[REDACTED]',
        cookie: '[REDACTED]',
        api_key: '[REDACTED]',
        apiKey: '[REDACTED]',
        access_token: '[REDACTED]',
        refresh_token: '[REDACTED]',
      });
    });

    it('should merge custom redact fields with defaults (FINDING-008)', () => {
      const customLogger = new TestLogger({
        redactFields: ['customField'],
      });
      const result = customLogger.testRedactSensitiveFields({
        password: 'should-be-hidden', // in default list // pragma: allowlist secret
        customField: 'hidden',
      });
      // FINDING-008: Custom fields extend defaults, not replace
      expect(result.password).toBe('[REDACTED]');
      expect(result.customField).toBe('[REDACTED]');
    });

    describe('FINDING-008: recursive redaction', () => {
      it('should redact sensitive fields in nested objects', () => {
        const result = logger.testRedactSensitiveFields({
          userId: '123',
          auth: {
            token: 'secret-token',
            provider: 'discord',
          },
        });
        expect(result).toEqual({
          userId: '123',
          auth: {
            token: '[REDACTED]',
            provider: 'discord',
          },
        });
      });

      it('should redact fields at multiple nesting levels', () => {
        const result = logger.testRedactSensitiveFields({
          level1: {
            level2: {
              password: 'deep-secret', // pragma: allowlist secret
              safe: 'visible',
            },
          },
        });
        expect(result).toEqual({
          level1: {
            level2: {
              password: '[REDACTED]',
              safe: 'visible',
            },
          },
        });
      });

      it('redacts at any depth (BUG-024: no fixed depth cap)', () => {
        const result = logger.testRedactSensitiveFields({
          l1: {
            l2: {
              l3: {
                l4: {
                  token: 'must-be-redacted',
                },
              },
            },
          },
        });
        // BUG-024: the old MAX_REDACT_DEPTH=3 cap let secrets nested 4+
        // levels deep through verbatim; recursion is now cycle-guarded, not
        // depth-capped.
        const l4 = (
          result.l1 as Record<string, unknown> as { l2: { l3: { l4: { token: string } } } }
        ).l2.l3.l4;
        expect(l4.token).toBe('[REDACTED]');
      });

      it('should recurse into arrays and redact sensitive fields (FINDING-007)', () => {
        const result = logger.testRedactSensitiveFields({
          items: [{ token: 'in-array' }],
        });
        // FINDING-007: Arrays are now recursed into
        expect(result.items).toEqual([{ token: '[REDACTED]' }]);
      });

      it('should handle null nested values', () => {
        const result = logger.testRedactSensitiveFields({
          userId: '123',
          metadata: null,
        });
        expect(result).toEqual({
          userId: '123',
          metadata: null,
        });
      });
    });
  });

  describe('Logger interface methods', () => {
    describe('debug', () => {
      it('should not log when level is info (default)', () => {
        logger.debug('Debug message');
        expect(logger.entries).toHaveLength(0);
      });

      it('should log when level is debug', () => {
        const debugLogger = new TestLogger({ level: 'debug' });
        debugLogger.debug('Debug message', { extra: 'data' });
        expect(debugLogger.entries).toHaveLength(1);
        expect(debugLogger.entries[0].level).toBe('debug');
        expect(debugLogger.entries[0].message).toBe('Debug message');
      });
    });

    describe('info', () => {
      it('should log when level is info', () => {
        logger.info('Info message');
        expect(logger.entries).toHaveLength(1);
        expect(logger.entries[0].level).toBe('info');
      });

      it('should include context', () => {
        logger.info('Info message', { operation: 'test' });
        expect(logger.entries[0].context).toEqual({ operation: 'test' });
      });
    });

    describe('warn', () => {
      it('should log warnings', () => {
        logger.warn('Warning message');
        expect(logger.entries).toHaveLength(1);
        expect(logger.entries[0].level).toBe('warn');
      });
    });

    describe('error', () => {
      it('should log errors without error object', () => {
        logger.error('Error message');
        expect(logger.entries).toHaveLength(1);
        expect(logger.entries[0].level).toBe('error');
        expect(logger.entries[0].error).toBeUndefined();
      });

      it('should log errors with error object', () => {
        const error = new Error('Something failed');
        logger.error('Error message', error);
        expect(logger.entries).toHaveLength(1);
        expect(logger.entries[0].error).toBeDefined();
        expect(logger.entries[0].error?.message).toBe('Something failed');
      });

      it('should log errors with context', () => {
        logger.error('Error message', undefined, { operation: 'save' });
        expect(logger.entries[0].context).toEqual({ operation: 'save' });
      });

      it('should log errors with both error and context', () => {
        const error = new Error('Failed');
        logger.error('Error message', error, { userId: '123' });
        expect(logger.entries[0].error).toBeDefined();
        expect(logger.entries[0].context).toEqual({ userId: '123' });
      });
    });
  });

  describe('ExtendedLogger interface methods', () => {
    describe('child', () => {
      it('should create child logger with inherited context', () => {
        logger.setContext({ service: 'parent' });
        const child = logger.child({ requestId: 'req-123' });

        // LOG-API-001: Child uses delegation pattern - verify via logged entries
        child.info('test message');

        // Entry should have merged context (parent + child)
        expect(logger.entries).toHaveLength(1);
        expect(logger.entries[0].context).toEqual({
          service: 'parent',
          requestId: 'req-123',
        });
      });

      it('should preserve parent config in child', () => {
        const customLogger = new TestLogger({
          level: 'debug',
          prefix: 'Test',
        });
        const child = customLogger.child({ requestId: '123' });

        // LOG-API-001: Verify config is inherited by checking behavior
        // Child should use parent's prefix and level
        child.debug('debug message');
        expect(customLogger.entries).toHaveLength(1);
        expect(customLogger.entries[0].message).toBe('[Test] debug message');
      });

      it('should not affect parent when child context changes', () => {
        const parent = new TestLogger();
        parent.setContext({ service: 'parent' });
        const child = parent.child({ requestId: 'child-req' });
        child.setContext({ extra: 'childOnly' });

        // Parent context should remain unchanged
        expect(parent.getGlobalContext()).toEqual({ service: 'parent' });

        // But child logs should have the extra context
        child.info('child message');
        expect(parent.entries[0].context).toEqual({
          service: 'parent',
          requestId: 'child-req',
          extra: 'childOnly',
        });
      });
    });

    describe('setContext', () => {
      it('should set global context', () => {
        logger.setContext({ requestId: 'req-123' });
        expect(logger.getGlobalContext()).toEqual({ requestId: 'req-123' });
      });

      it('should merge with existing context', () => {
        logger.setContext({ a: '1' });
        logger.setContext({ b: '2' });
        expect(logger.getGlobalContext()).toEqual({ a: '1', b: '2' });
      });

      it('should override existing keys', () => {
        logger.setContext({ a: '1' });
        logger.setContext({ a: '2' });
        expect(logger.getGlobalContext()).toEqual({ a: '2' });
      });

      it('should include global context in log entries', () => {
        logger.setContext({ service: 'test-service' });
        logger.info('Test message');
        expect(logger.entries[0].context).toEqual({ service: 'test-service' });
      });
    });

    describe('time', () => {
      it('should return duration and log', () => {
        const debugLogger = new TestLogger({ level: 'debug' });

        vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

        const end = debugLogger.time('operation');
        const duration = end();

        expect(duration).toBe(100);
        expect(debugLogger.entries).toHaveLength(1);
        expect(debugLogger.entries[0].message).toContain('operation: 100.00ms');
      });

      it('should use Date.now fallback when performance unavailable', () => {
        // Create a fresh logger without performance mock
        const debugLogger = new TestLogger({ level: 'debug' });

        // Override global performance to simulate environment without it
        const originalPerformance = globalThis.performance;
        // @ts-expect-error - simulating missing performance API
        globalThis.performance = undefined;

        vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1150);

        const end = debugLogger.time('fallback-op');
        const duration = end();

        expect(duration).toBe(150);

        // Restore
        globalThis.performance = originalPerformance;
      });
    });

    describe('timeAsync', () => {
      it('should time async operation and return result', async () => {
        const debugLogger = new TestLogger({ level: 'debug' });

        vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(50);

        const result = await debugLogger.timeAsync('async-op', async () => {
          return 'async-result';
        });

        expect(result).toBe('async-result');
        expect(debugLogger.entries).toHaveLength(1);
        expect(debugLogger.entries[0].message).toContain('async-op');
      });

      it('should time even when async function throws', async () => {
        const debugLogger = new TestLogger({ level: 'debug' });

        vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(25);

        await expect(
          debugLogger.timeAsync('failing-op', async () => {
            throw new Error('Async failure');
          }),
        ).rejects.toThrow('Async failure');

        // Should still have logged the timing
        expect(debugLogger.entries).toHaveLength(1);
        expect(debugLogger.entries[0].message).toContain('failing-op');
      });
    });
  });
});

describe('DelegatingLogger timing (OPT-020)', () => {
  // child().time() is implemented locally rather than delegated, precisely so
  // the emitted entry carries the child's context. That is the behaviour
  // worth pinning — a delegated implementation would lose requestId.
  it('emits the timing line through the child, carrying child context', () => {
    const logger = new TestLogger({ level: 'debug' });
    const child = logger.child({ requestId: 'req-42' });

    const end = child.time('render');
    const duration = end();

    expect(duration).toBeGreaterThanOrEqual(0);
    const timing = logger.entries.find((e) => e.message.startsWith('render:'));
    expect(timing).toBeDefined();
    expect(timing?.level).toBe('debug');
    expect(timing?.context?.requestId).toBe('req-42');
    expect(timing?.context?.label).toBe('render');
    expect(timing?.context?.duration).toBe(duration);
  });

  it('formats the duration to two decimals in the message', () => {
    const logger = new TestLogger({ level: 'debug' });
    const child = logger.child({ requestId: 'req-1' });

    child.time('work')();

    const timing = logger.entries.find((e) => e.message.startsWith('work:'));
    expect(timing?.message).toMatch(/^work: \d+\.\d{2}ms$/);
  });

  it('times an async fn and still ends the timer when it rejects', async () => {
    const logger = new TestLogger({ level: 'debug' });
    const child = logger.child({ requestId: 'req-7' });

    await expect(child.timeAsync('ok', async () => 'value')).resolves.toBe('value');
    await expect(
      child.timeAsync('bad', async () => {
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');

    // Both timers reported despite one throwing (the `finally` arm)
    expect(logger.entries.filter((e) => e.message.startsWith('ok:'))).toHaveLength(1);
    expect(logger.entries.filter((e) => e.message.startsWith('bad:'))).toHaveLength(1);
  });

  it('merges nested child context down the chain', () => {
    const logger = new TestLogger({ level: 'debug' });
    const grandchild = logger.child({ requestId: 'req-9' }).child({ operation: 'match' });

    grandchild.time('deep')();

    const timing = logger.entries.find((e) => e.message.startsWith('deep:'));
    expect(timing?.context?.requestId).toBe('req-9');
    expect(timing?.context?.operation).toBe('match');
  });

  it('lets a child add context after construction', () => {
    const logger = new TestLogger({ level: 'debug' });
    const child = logger.child({ requestId: 'req-3' });
    child.setContext({ userId: 'u-1' });

    child.info('hello');

    expect(logger.entries[0].context?.requestId).toBe('req-3');
    expect(logger.entries[0].context?.userId).toBe('u-1');
  });

  it('forwards an error through the child', () => {
    const logger = new TestLogger({ level: 'debug' });
    const child = logger.child({ requestId: 'req-4' });

    child.error('exploded', new Error('boom'));

    expect(logger.entries[0].level).toBe('error');
    expect(logger.entries[0].context?.requestId).toBe('req-4');
  });
});

describe('redaction cycle safety', () => {
  it('does not recurse forever on a self-referencing context', () => {
    const logger = new TestLogger({ level: 'debug' });
    const cyclic: LogContext = { name: 'root' };
    cyclic.self = cyclic;

    expect(() => logger.info('cycle', cyclic)).not.toThrow();
    expect(logger.entries[0].context?.name).toBe('root');
  });

  it('does not recurse forever on a cycle reached through an array', () => {
    const logger = new TestLogger({ level: 'debug' });
    const inner: LogContext = { token: 'shhh' };
    const cyclic: LogContext = { items: [inner] };
    inner.back = cyclic;

    expect(() => logger.info('array cycle', cyclic)).not.toThrow();
  });

  it('still redacts the same object seen twice at different keys (S10-R8: at EVERY reference, not just the first)', () => {
    const logger = new TestLogger({ level: 'debug' });
    const shared: LogContext = { password: 'hunter2' };

    logger.info('shared', { a: shared, b: shared });

    // S10-R8 (2026-08-30 fix round 1): the old guard was a global "seen
    // anywhere" WeakSet, so the SECOND reference to `shared` was skipped as
    // already-visited and returned unredacted — ctx.b.password used to
    // still be 'hunter2'. The guard is now an ancestor (recursion-path) set
    // that gets popped after each branch finishes, so `a` and `b` are each
    // redacted independently.
    const ctx = logger.entries[0].context as { a: LogContext; b: LogContext };
    expect(ctx.a.password).toBe('[REDACTED]');
    expect(ctx.b.password).toBe('[REDACTED]');
    // S10-R12 (2026-08-30 fix round 2): memoized on the way out, so both
    // references resolve to the SAME redacted object, not two independently
    // (and, before this fix, inconsistently) redacted copies.
    expect(ctx.a).toBe(ctx.b);
  });

  it('redacts an aliased ARRAY at every reference too, not just the first (S10-R8)', () => {
    const logger = new TestLogger({ level: 'debug' });
    // Reused from hardening.test.ts: a JWT that trips looksLikeSecretValue.
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXNpZ25hdHVyZS1zaWduYXR1cmU';
    const arr = [jwt];

    logger.info('shared array', { a: arr, b: arr });

    // This is FINDING-025's own headline example (`{ tokens: ['eyJ…'] }`)
    // aliased — before S10-R8, redactArrayItems marked the array itself as
    // "visited" globally, so the second reference's items were returned
    // unscanned.
    const ctx = logger.entries[0].context as { a: string[]; b: string[] };
    expect(ctx.a[0]).toBe('[REDACTED]');
    expect(ctx.b[0]).toBe('[REDACTED]');
    // S10-R12: same memoization property as the object case above.
    expect(ctx.a).toBe(ctx.b);
  });

  it('processes a heavily-aliased structure in work LINEAR in its depth, not exponential (S10-R12: memoization, not a budget)', () => {
    const logger = new TestLogger({ level: 'debug' });
    // redactSensitiveFields is `protected`; spying on the INSTANCE (not the
    // prototype) still intercepts every internal `this.redactSensitiveFields(...)`
    // call made during recursion, since `this` stays this same instance
    // throughout.
    const spy = vi.spyOn(
      logger as unknown as { redactSensitiveFields: (...args: unknown[]) => unknown },
      'redactSensitiveFields',
    );

    // Binary alias chain: each level references the SAME child object from
    // BOTH of its own keys. Without memoization, this makes the number of
    // redactSensitiveFields calls exponential in DEPTH (2^DEPTH). A prior
    // version of this test asserted a wall-clock bound instead of a call
    // count and relied on "an exponential regression will just time out";
    // a live probe of that assumption during review showed vitest workers
    // do NOT cleanly time out synchronous code — the run just hangs until
    // something external kills it, so a wall-clock (or "let it hang")
    // assertion would not go red on a regression, it would stall CI
    // indefinitely. Counting actual calls is deterministic regardless of
    // whether the underlying algorithm is linear or exponential, and
    // DEPTH=15 keeps the UNMEMOIZED case safely bounded too (2^15 = 32768
    // cheap calls, comfortably finishes either way) — this test can only
    // pass or fail, never hang.
    const DEPTH = 15;
    let level: LogContext = { password: 'hunter2' };
    for (let i = 0; i < DEPTH; i++) {
      level = { a: level, b: level };
    }

    logger.info('deep', level);

    // Memoized: one real call per distinct level (DEPTH of them, plus the
    // one-off top-level `merged` wrapper from mergeContext) plus one cheap
    // memo-hit call per alias edge (DEPTH of them) — linear in DEPTH.
    // Unmemoized, this would be on the order of 2^DEPTH = 32768 calls, so a
    // generous linear-shaped ceiling (well above the true ~2×DEPTH+1, well
    // below any exponential reading) cleanly separates the two.
    expect(spy.mock.calls.length).toBeLessThan(DEPTH * 4);

    // And the actual redaction still happened, all the way to the bottom —
    // the secret DEPTH levels down is exactly where a budget-based cutoff
    // would have missed it.
    let node = logger.entries[0].context as unknown as LogContext;
    for (let i = 0; i < DEPTH; i++) {
      node = node.a as LogContext;
    }
    expect(node.password).toBe('[REDACTED]');
  });

  it('redacts every ALIASED reference in a large shared structure, not just the first N (S10-R12: no budget to exhaust)', () => {
    const logger = new TestLogger({ level: 'debug' });
    const shared: LogContext = { password: 'hunter2' };
    // 6000 references to the SAME object — comfortably past the size where
    // the since-removed MAX_REDACT_NODES=5000 budget would have kicked in
    // and silently left the tail of this array unredacted (that budget
    // failed OPEN — the exact defect S10-R12 replaced it for). With
    // memoization there is no cutoff: every reference resolves to the one
    // shared, fully-redacted copy.
    //
    // S10-R15 (2026-08-30 fix round 3): this test alone is NOT a
    // regression test for the original S10-R8 budget bypass — memoization
    // satisfies 6000 ALIASED references in O(1) (one real computation, the
    // rest memo hits), which even a budget of 5000 would arguably have
    // survived (only ~2 "real" node visits are needed: the shared object
    // and the array). The test that actually exercises the many-DISTINCT-
    // nodes path the old budget bypassed is the next one below.
    const refs: LogContext[] = new Array(6000).fill(shared);

    logger.info('wide', { refs });

    const ctx = logger.entries[0].context as { refs: LogContext[] };
    expect(ctx.refs).toHaveLength(6000);
    expect(ctx.refs[0].password).toBe('[REDACTED]');
    expect(ctx.refs[5999].password).toBe('[REDACTED]');
    // Memoized: every reference is the SAME redacted object, not 6000
    // independently redacted copies.
    expect(ctx.refs[0]).toBe(ctx.refs[5999]);
  });

  it('redacts a secret in the LAST of >5000 DISTINCT (non-aliased) object nodes (S10-R15: the actual bypass regression test)', () => {
    const logger = new TestLogger({ level: 'debug' });
    // 6000 DISTINCT objects — a fresh object literal each iteration, never
    // the same reference twice, so memoization never hits and every single
    // one is a genuine, independent redactSensitiveFields call. This is
    // the exact shape of the original S10-R8 budget bypass (measured by
    // review at a deterministic ~4998-node cutoff): with that budget, the
    // secret below — the 6000th distinct node, comfortably past the
    // cutoff — would have been emitted completely unscanned. This test
    // would have gone red at 617c907e (budget present) and is green from
    // b3800667 onward (memoization, no cutoff).
    const items: LogContext[] = [];
    for (let i = 0; i < 5999; i++) {
      items.push({ index: i });
    }
    items.push({ password: 'hunter2' });

    logger.info('wide-distinct', { items });

    const ctx = logger.entries[0].context as { items: LogContext[] };
    expect(ctx.items).toHaveLength(6000);
    expect(ctx.items[5999].password).toBe('[REDACTED]');
  });

  it('pins the design invariant (S10-R16): a cycle back-edge is the RAW original, never the redacted copy or itself', () => {
    const logger = new TestLogger({ level: 'debug' });
    const cyclic: LogContext = { name: 'root', password: 'hunter2' };
    cyclic.self = cyclic;

    const result = logger.testRedactSensitiveFields(cyclic);

    // The primary occurrence is redacted...
    expect(result.password).toBe('[REDACTED]');
    // ...but the back-edge is a genuine CYCLE, not an alias, and must stay
    // the RAW original object — not the redacted copy (`result` itself,
    // which would make the output graph self-referential — a shape this
    // package has never produced) and not any other value.
    //
    // This holds ONLY because `ancestors` is checked before `memo`, AND
    // `memo` is populated only on the way OUT (after a node's own children
    // are fully processed). Both properties were verified independently:
    // mutating EITHER one alone (memoize-on-the-way-IN while still
    // checking ancestors first; or check memo-before-ancestors while still
    // memoizing way-out) leaves this assertion — and the whole suite —
    // green, because a currently-active ancestor is, by construction,
    // never yet in `memo` regardless of which check runs first or exactly
    // when memo.set() executes UNLESS BOTH properties are violated
    // together. Mutating both together makes the back-edge resolve to the
    // (self-referential) redacted copy instead — `result.self` becomes
    // `result` itself — which this assertion catches.
    expect(result.self).toBe(cyclic);
    expect(result.self).not.toBe(result);
  });

  it('pins the design invariant (S10-R16, extended to redactArrayItems): an array cycle back-edge is the RAW original, never the redacted copy or itself', () => {
    const logger = new TestLogger({ level: 'debug' });
    const inner: unknown[] = ['leaf'];
    inner.push(inner); // inner[1] === inner — a cycle through the array itself

    const result = logger.testRedactSensitiveFields({ arr: inner }) as { arr: unknown[] };

    expect(result.arr[0]).toBe('leaf');
    // Same invariant as the object-path test above (`ancestors` checked
    // before `memo`, `memo` populated only on the way out), pinned here
    // for `redactArrayItems` specifically — it shares the identical guard
    // logic but was previously left unpinned by any test. The back-edge
    // must stay the RAW original array — not the redacted copy
    // (`result.arr` itself, which would make it self-referential) and not
    // any other value.
    expect(result.arr[1]).toBe(inner);
    expect(result.arr[1]).not.toBe(result.arr);
  });
});
