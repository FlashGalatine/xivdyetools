/**
 * Tests for Worker Preset
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createWorkerLogger,
  createRequestLogger,
  getRequestId,
} from './worker.js';

describe('Worker Preset', () => {
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

  describe('createWorkerLogger', () => {
    it('should create logger with service and environment context', () => {
      const logger = createWorkerLogger({
        service: 'xivdyetools-api',
        environment: 'production',
      });

      logger.info('Request received');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.service).toBe('xivdyetools-api');
      expect(parsed.context.environment).toBe('production');
    });

    it('should include version when provided', () => {
      const logger = createWorkerLogger({
        service: 'api',
        environment: 'production',
        version: '1.2.3',
      });

      logger.info('Test');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.version).toBe('1.2.3');
    });

    it('should include requestId when provided', () => {
      const logger = createWorkerLogger(
        {
          service: 'api',
          environment: 'production',
        },
        'req-abc-123'
      );

      logger.info('Test');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.requestId).toBe('req-abc-123');
    });

    it('should not include version/requestId when not provided', () => {
      const logger = createWorkerLogger({
        service: 'api',
        environment: 'development',
      });

      logger.info('Test');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.version).toBeUndefined();
      expect(parsed.context.requestId).toBeUndefined();
    });

    it('should default to info level in production', () => {
      const logger = createWorkerLogger({
        service: 'api',
        environment: 'production',
      });

      logger.debug('Debug');
      logger.info('Info');

      // Debug should not be logged
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(consoleLogSpy.mock.calls[0][0]).level).toBe('info');
    });

    it('should default to debug level in non-production', () => {
      const logger = createWorkerLogger({
        service: 'api',
        environment: 'development',
      });

      logger.debug('Debug');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(consoleLogSpy.mock.calls[0][0]).level).toBe('debug');
    });

    it('should allow custom log level', () => {
      const logger = createWorkerLogger({
        service: 'api',
        environment: 'production',
        level: 'debug',
      });

      logger.debug('Debug in production');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should use JSON format for log aggregation', () => {
      const logger = createWorkerLogger({
        service: 'api',
        environment: 'production',
      });

      logger.info('Test message', { data: 'value' });

      const logged = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(logged)).not.toThrow();
    });

    it('should include timestamps', () => {
      const logger = createWorkerLogger({
        service: 'api',
        environment: 'production',
      });

      logger.info('Test');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.timestamp).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should redact sensitive fields', () => {
      const logger = createWorkerLogger({
        service: 'api',
        environment: 'production',
      });

      logger.info('Auth attempt', {
        userId: 'user-123',
        password: 'secret123',
        token: 'abc-token',
        access_token: 'access-123',
        jwt_secret: 'jwt-secret',
        discord_client_secret: 'discord-secret',
      });

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.userId).toBe('user-123');
      expect(parsed.context.password).toBe('[REDACTED]');
      expect(parsed.context.token).toBe('[REDACTED]');
      expect(parsed.context.access_token).toBe('[REDACTED]');
      expect(parsed.context.jwt_secret).toBe('[REDACTED]');
      expect(parsed.context.discord_client_secret).toBe('[REDACTED]');
    });

    it('should sanitize errors', () => {
      const logger = createWorkerLogger({
        service: 'api',
        environment: 'production',
      });

      const error = new Error('Auth failed with Bearer secrettoken');
      logger.error('Authentication error', error);

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.error.message).toContain('[REDACTED]');
      expect(parsed.error.stack).toBeUndefined();
    });

    it('should support child loggers with additional context', () => {
      const logger = createWorkerLogger(
        {
          service: 'api',
          environment: 'production',
        },
        'req-123'
      );

      const childLogger = logger.child({ operation: 'createPreset' });
      childLogger.info('Creating preset');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.service).toBe('api');
      expect(parsed.context.requestId).toBe('req-123');
      expect(parsed.context.operation).toBe('createPreset');
    });
  });

  describe('createRequestLogger', () => {
    it('should create logger from env object', () => {
      const logger = createRequestLogger(
        {
          ENVIRONMENT: 'production',
          API_VERSION: '2.0.0',
          SERVICE_NAME: 'xivdyetools-presets-api',
        },
        'req-456'
      );

      logger.info('Test');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.service).toBe('xivdyetools-presets-api');
      expect(parsed.context.environment).toBe('production');
      expect(parsed.context.version).toBe('2.0.0');
      expect(parsed.context.requestId).toBe('req-456');
    });

    it('should use default service name when not provided', () => {
      const logger = createRequestLogger(
        {
          ENVIRONMENT: 'development',
        },
        'req-789'
      );

      logger.info('Test');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.service).toBe('xivdyetools-worker');
    });

    it('should not include version when not in env', () => {
      const logger = createRequestLogger(
        {
          ENVIRONMENT: 'production',
        },
        'req-000'
      );

      logger.info('Test');

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.version).toBeUndefined();
    });
  });

  describe('getRequestId', () => {
    it('should return x-request-id header if present', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-request-id': 'custom-request-id' },
      });

      const requestId = getRequestId(request);
      expect(requestId).toBe('custom-request-id');
    });

    it('should fall back to cf-ray header', () => {
      const request = new Request('https://example.com', {
        headers: { 'cf-ray': 'cf-ray-123' },
      });

      const requestId = getRequestId(request);
      expect(requestId).toBe('cf-ray-123');
    });

    it('should prefer x-request-id over cf-ray', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-request-id': 'preferred-id',
          'cf-ray': 'fallback-id',
        },
      });

      const requestId = getRequestId(request);
      expect(requestId).toBe('preferred-id');
    });

    it('should generate UUID when no headers present', () => {
      const request = new Request('https://example.com');

      const requestId = getRequestId(request);

      // Should be a valid UUID format
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should generate different UUIDs for different requests', () => {
      const request1 = new Request('https://example.com');
      const request2 = new Request('https://example.com');

      const id1 = getRequestId(request1);
      const id2 = getRequestId(request2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('worker integration patterns', () => {
    it('should work with typical Hono middleware pattern', () => {
      // Simulate Hono-style context
      interface HonoContext {
        req: { header: (name: string) => string | undefined };
        env: { ENVIRONMENT: string; API_VERSION?: string };
        set: (key: string, value: unknown) => void;
        header: (name: string, value: string) => void;
      }

      const context: HonoContext = {
        req: {
          header: (name: string) => {
            if (name === 'x-request-id') return 'hono-req-id';
            return undefined;
          },
        },
        env: { ENVIRONMENT: 'production', API_VERSION: '1.0.0' },
        set: vi.fn(),
        header: vi.fn(),
      };

      // Simulate middleware
      const requestId =
        context.req.header('x-request-id') ?? crypto.randomUUID();
      const logger = createRequestLogger(
        {
          ENVIRONMENT: context.env.ENVIRONMENT,
          API_VERSION: context.env.API_VERSION,
        },
        requestId
      );

      context.set('logger', logger);
      context.header('x-request-id', requestId);

      // Use logger
      logger.info('Request received', { path: '/api/presets' });

      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parsed.context.requestId).toBe('hono-req-id');
      expect(parsed.context.environment).toBe('production');
    });

    it('should support logging throughout request lifecycle', () => {
      const logger = createWorkerLogger(
        {
          service: 'api',
          environment: 'production',
        },
        'lifecycle-req'
      );

      // Request start
      logger.info('Request started', { method: 'POST', path: '/api/presets' });

      // Operation logging
      const opLogger = logger.child({ operation: 'validateInput' });
      opLogger.info('Validating input');

      // Another operation
      const dbLogger = logger.child({ operation: 'database' });
      dbLogger.info('Saving to database');

      // Request end
      logger.info('Request completed', { status: 201, duration: 45 });

      expect(consoleLogSpy).toHaveBeenCalledTimes(4);

      // Check first and last logs
      const first = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(first.message).toBe('Request started');

      const last = JSON.parse(consoleLogSpy.mock.calls[3][0]);
      expect(last.message).toBe('Request completed');
      expect(last.context.status).toBe(201);
    });
  });
});
