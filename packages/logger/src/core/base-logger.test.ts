/**
 * Tests for BaseLogger and createSimpleLogger
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseLogger, createSimpleLogger } from './base-logger.js';
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
    error?: unknown
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
      expect(config.redactFields).toEqual([
        'password',
        'token',
        'secret',
        'authorization',
        'cookie',
        'api_key',
        'apiKey',
        'access_token',
        'refresh_token',
      ]);
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

    it('should allow custom redact fields', () => {
      const customLogger = new TestLogger({
        redactFields: ['customSecret', 'myToken'],
      });
      const config = customLogger.getConfig();
      expect(config.redactFields).toEqual(['customSecret', 'myToken']);
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
      expect(result).toEqual({
        name: 'Unknown',
        message: '[object Object]',
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

    it('should use custom redact fields', () => {
      const customLogger = new TestLogger({
        redactFields: ['customField'],
      });
      const result = customLogger.testRedactSensitiveFields({
        password: 'visible', // not in custom list // pragma: allowlist secret
        customField: 'hidden',
      });
      expect(result.password).toBe('visible');
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

      it('should stop recursion at max depth (3)', () => {
        const result = logger.testRedactSensitiveFields({
          l1: {
            l2: {
              l3: {
                // depth=3: should NOT recurse further
                l4: {
                  token: 'should-remain',
                },
              },
            },
          },
        });
        // At depth=3, the l4 object is not recursed into
        const l4 = (result.l1 as Record<string, unknown> as { l2: { l3: { l4: { token: string } } } }).l2.l3.l4;
        expect(l4.token).toBe('should-remain');
      });

      it('should not recurse into arrays', () => {
        const result = logger.testRedactSensitiveFields({
          items: [{ token: 'in-array' }],
        });
        // Arrays are not recursed; the array should remain as-is
        expect(result.items).toEqual([{ token: 'in-array' }]);
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

        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(100);

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

        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(50);

        const result = await debugLogger.timeAsync('async-op', async () => {
          return 'async-result';
        });

        expect(result).toBe('async-result');
        expect(debugLogger.entries).toHaveLength(1);
        expect(debugLogger.entries[0].message).toContain('async-op');
      });

      it('should time even when async function throws', async () => {
        const debugLogger = new TestLogger({ level: 'debug' });

        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(25);

        await expect(
          debugLogger.timeAsync('failing-op', async () => {
            throw new Error('Async failure');
          })
        ).rejects.toThrow('Async failure');

        // Should still have logged the timing
        expect(debugLogger.entries).toHaveLength(1);
        expect(debugLogger.entries[0].message).toContain('failing-op');
      });
    });
  });
});

describe('createSimpleLogger', () => {
  it('should create a simple logger with write function', () => {
    const entries: LogEntry[] = [];
    const logger = createSimpleLogger((entry) => entries.push(entry));

    logger.info('Test message');
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('Test message');
  });

  it('should accept configuration', () => {
    const entries: LogEntry[] = [];
    const logger = createSimpleLogger((entry) => entries.push(entry), {
      level: 'debug',
      prefix: 'Simple',
    });

    logger.debug('Debug message');
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('[Simple] Debug message');
  });

  it('should respect log level', () => {
    const entries: LogEntry[] = [];
    const logger = createSimpleLogger((entry) => entries.push(entry), {
      level: 'error',
    });

    logger.debug('Debug');
    logger.info('Info');
    logger.warn('Warn');
    logger.error('Error');

    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('error');
  });
});
