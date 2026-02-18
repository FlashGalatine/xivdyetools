/**
 * Tests for JsonAdapter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JsonAdapter } from './json-adapter.js';

describe('JsonAdapter', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should default to JSON format', () => {
      const logger = new JsonAdapter();
      logger.info('Test');

      const logged = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(logged)).not.toThrow();
    });

    it('should default to timestamps enabled', () => {
      const logger = new JsonAdapter();
      logger.info('Test');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.timestamp).toBeDefined();
    });

    it('should default to sanitizeErrors enabled', () => {
      const logger = new JsonAdapter();
      const error = new Error('Error with Bearer token123');
      logger.error('Failed', error);

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.error.message).toContain('[REDACTED]');
    });
  });

  describe('JSON output', () => {
    it('should output all log levels via console.log', () => {
      const logger = new JsonAdapter({ level: 'debug' });

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleLogSpy).toHaveBeenCalledTimes(4);
    });

    it('should output valid JSON for all entries', () => {
      const logger = new JsonAdapter();
      logger.info('Test message', { userId: '123' });

      const logged = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logged);

      expect(parsed).toEqual({
        level: 'info',
        message: 'Test message',
        timestamp: '2024-01-15T12:00:00.000Z',
        context: { userId: '123' },
      });
    });

    it('should include level in output', () => {
      const logger = new JsonAdapter({ level: 'debug' });

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(JSON.parse(consoleLogSpy.mock.calls[0][0]).level).toBe('debug');
      expect(JSON.parse(consoleLogSpy.mock.calls[1][0]).level).toBe('info');
      expect(JSON.parse(consoleLogSpy.mock.calls[2][0]).level).toBe('warn');
      expect(JSON.parse(consoleLogSpy.mock.calls[3][0]).level).toBe('error');
    });

    it('should include error information', () => {
      const logger = new JsonAdapter();
      const error = new Error('Something failed');
      logger.error('Operation failed', error);

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.name).toBe('Error');
      expect(parsed.error.message).toBe('Something failed');
    });

    it('should not include stack in error (sanitizeErrors default)', () => {
      const logger = new JsonAdapter();
      const error = new Error('Test error');
      logger.error('Failed', error);

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.error.stack).toBeUndefined();
    });
  });

  describe('log level filtering', () => {
    it('should default to info level', () => {
      const logger = new JsonAdapter();

      logger.debug('Debug');
      logger.info('Info');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(consoleLogSpy.mock.calls[0][0]).level).toBe('info');
    });

    it('should respect configured log level', () => {
      const logger = new JsonAdapter({ level: 'warn' });

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('context handling', () => {
    it('should include context in output', () => {
      const logger = new JsonAdapter();
      logger.info('Test', { userId: '123', operation: 'fetch' });

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context).toEqual({
        userId: '123',
        operation: 'fetch',
      });
    });

    it('should redact sensitive fields', () => {
      const logger = new JsonAdapter();
      logger.info('Test', {
        userId: '123',
        password: 'secret',
        token: 'abc123',
      });

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.userId).toBe('123');
      expect(parsed.context.password).toBe('[REDACTED]');
      expect(parsed.context.token).toBe('[REDACTED]');
    });

    it('should include global context', () => {
      const logger = new JsonAdapter();
      logger.setContext({ service: 'my-service' });
      logger.info('Test');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.service).toBe('my-service');
    });

    it('should merge global and local context', () => {
      const logger = new JsonAdapter();
      logger.setContext({ service: 'my-service', environment: 'production' });
      logger.info('Test', { requestId: 'req-123' });

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context).toEqual({
        service: 'my-service',
        environment: 'production',
        requestId: 'req-123',
      });
    });
  });

  describe('prefix', () => {
    it('should include prefix in message', () => {
      const logger = new JsonAdapter({ prefix: 'api' });
      logger.info('Request received');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.message).toBe('[api] Request received');
    });
  });

  describe('child logger', () => {
    it('should create child with inherited context', () => {
      const logger = new JsonAdapter();
      logger.setContext({ service: 'parent-service' });

      const child = logger.child({ requestId: 'req-456' });
      child.info('Child log');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.service).toBe('parent-service');
      expect(parsed.context.requestId).toBe('req-456');
    });

    it('should not affect parent when child adds context', () => {
      const logger = new JsonAdapter();
      logger.setContext({ service: 'parent' });

      const child = logger.child({ requestId: 'child-req' });
      child.setContext({ extra: 'child-only' });

      // Log from parent
      logger.info('Parent log');
      const parentParsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parentParsed.context).toEqual({ service: 'parent' });
    });
  });

  describe('timing features', () => {
    it('should support time method', () => {
      const logger = new JsonAdapter({ level: 'debug' });

      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(100);

      const end = logger.time('db-query');
      const duration = end();

      expect(duration).toBe(100);
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.message).toContain('db-query');
      expect(parsed.message).toContain('100.00ms');
    });

    it('should support timeAsync method', async () => {
      const logger = new JsonAdapter({ level: 'debug' });

      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50);

      const result = await logger.timeAsync('async-op', async () => 'result');

      expect(result).toBe('result');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });
});
