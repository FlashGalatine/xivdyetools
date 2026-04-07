/**
 * Tests for Logger Middleware
 *
 * REFACTOR-001: Unified tests covering all prior worker-local implementations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { loggerMiddleware, getLogger } from './logger.js';
import { requestIdMiddleware } from './request-id.js';
import type { ExtendedLogger } from '@xivdyetools/logger';

// Mock the logger module
vi.mock('@xivdyetools/logger/worker', () => ({
  createRequestLogger: vi.fn((_config, _requestId) => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { createRequestLogger } from '@xivdyetools/logger/worker';

describe('loggerMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logger creation', () => {
    it('should create logger with service name and request ID', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware({ validateFormat: false }));
      app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test', {
        headers: { 'X-Request-ID': 'test-req-id' },
      });

      expect(createRequestLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          SERVICE_NAME: 'test-service',
        }),
        'test-req-id',
      );
    });

    it('should store logger in context', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({ serviceName: 'test-service' }));

      let contextLogger: unknown;
      app.get('/test', (c) => {
        contextLogger = c.get('logger');
        return c.text('ok');
      });

      await app.request('/test');

      expect(contextLogger).toBeDefined();
      expect(contextLogger).toHaveProperty('info');
      expect(contextLogger).toHaveProperty('error');
    });
  });

  describe('environment options', () => {
    it('should read ENVIRONMENT from c.env by default', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
      app.get('/test', (c) => c.text('ok'));

      // Hono test bindings
      await app.request('/test');

      // Without env bindings in test, falls back to 'production'
      expect(createRequestLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          ENVIRONMENT: 'production',
        }),
        expect.any(String),
      );
    });

    it('should default ENVIRONMENT to production when readEnvironmentFromEnv is false', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({
        serviceName: 'test-service',
        readEnvironmentFromEnv: false,
      }));
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test');

      expect(createRequestLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          ENVIRONMENT: 'production',
        }),
        expect.any(String),
      );
    });

    it('should not include API_VERSION by default', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test');

      const callArgs = vi.mocked(createRequestLogger).mock.calls[0]?.[0];
      expect(callArgs).not.toHaveProperty('API_VERSION');
    });

    it('should include API_VERSION when readApiVersionFromEnv is true and env has string value', async () => {
      const app = new Hono<{ Bindings: { API_VERSION: string } }>();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({
        serviceName: 'test-service',
        readApiVersionFromEnv: true,
      }));
      app.get('/test', (c) => c.text('ok'));

      // Provide API_VERSION binding via fetch override
      const req = new Request('http://localhost/test');
      const res = await app.fetch(req, { API_VERSION: 'v2.1.0' });
      expect(res.status).toBe(200);

      expect(createRequestLogger).toHaveBeenCalledWith(
        expect.objectContaining({ API_VERSION: 'v2.1.0' }),
        expect.any(String),
      );
    });

    it('should omit API_VERSION when readApiVersionFromEnv is true but value is not a string', async () => {
      const app = new Hono<{ Bindings: { API_VERSION: number } }>();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({
        serviceName: 'test-service',
        readApiVersionFromEnv: true,
      }));
      app.get('/test', (c) => c.text('ok'));

      const req = new Request('http://localhost/test');
      const res = await app.fetch(req, { API_VERSION: 42 as never });
      expect(res.status).toBe(200);

      const callArgs = vi.mocked(createRequestLogger).mock.calls[0]?.[0];
      expect(callArgs).not.toHaveProperty('API_VERSION');
    });
  });

  describe('request logging', () => {
    it('should log request start with method and path', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
      app.get('/api/test', (c) => c.text('ok'));

      await app.request('/api/test');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({
          method: 'GET',
          path: '/api/test',
        }),
      );
    });

    it('should log request completion with status and duration', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({
          method: 'GET',
          path: '/test',
          status: 200,
          durationMs: expect.any(Number),
        }),
      );
    });

    it('should round duration to 2 decimal places', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      const completionCall = mockLogger.info.mock.calls.find(
        (call: unknown[]) => call[0] === 'Request completed',
      );
      const duration = completionCall?.[1]?.durationMs as number;
      expect(duration).toBe(Math.round(duration * 100) / 100);
    });

    it('should handle different response statuses', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
      app.get('/not-found', (c) => c.text('Not Found', 404));
      app.get('/error', (c) => c.text('Internal Server Error', 500));

      const response404 = await app.request('/not-found');
      expect(response404.status).toBe(404);

      const response500 = await app.request('/error');
      expect(response500.status).toBe(500);

      const calls = vi.mocked(createRequestLogger).mock.results;
      const logger404 = calls[0]?.value;
      const logger500 = calls[1]?.value;

      expect(logger404.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({ status: 404 }),
      );
      expect(logger500.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({ status: 500 }),
      );
    });
  });

  describe('user agent logging', () => {
    it('should not log user agent by default', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test', {
        headers: { 'user-agent': 'TestBot/1.0' },
      });

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      const startCall = mockLogger.info.mock.calls.find(
        (call: unknown[]) => call[0] === 'Request started',
      );
      expect(startCall?.[1]).not.toHaveProperty('userAgent');
    });

    it('should log user agent when logUserAgent is true', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({
        serviceName: 'test-service',
        logUserAgent: true,
      }));
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test', {
        headers: { 'user-agent': 'TestBot/1.0' },
      });

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      const startCall = mockLogger.info.mock.calls.find(
        (call: unknown[]) => call[0] === 'Request started',
      );
      expect(startCall?.[1]?.userAgent).toBe('TestBot/1.0');
    });
  });

  describe('path sanitization', () => {
    it('should extract pathname from URL by default', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
      app.get('/api/v1/test', (c) => c.text('ok'));

      await app.request('https://example.com/api/v1/test?foo=bar');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({ path: '/api/v1/test' }),
      );
    });

    it('should use sanitizePath when provided', async () => {
      const sanitize = (path: string) => path.replace(/token=[^&]+/, 'token=***');

      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({
        serviceName: 'test-service',
        sanitizePath: sanitize,
      }));
      app.get('/api/test', (c) => c.text('ok'));

      await app.request('/api/test?token=secret123&other=value');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({ path: '/api/test?token=***&other=value' }),
      );
    });

    it('should handle root path', async () => {
      const app = new Hono();
      app.use('*', requestIdMiddleware());
      app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
      app.get('/', (c) => c.text('ok'));

      await app.request('/');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({ path: '/' }),
      );
    });
  });

  describe('HTTP methods', () => {
    it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const)(
      'should log %s requests',
      async (method) => {
        const app = new Hono();
        app.use('*', requestIdMiddleware());
        app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
        app.on(method, '/test', (c) => c.text('ok'));

        await app.request('/test', { method });

        const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Request started',
          expect.objectContaining({ method }),
        );
      },
    );
  });
});

describe('getLogger', () => {
  it('should retrieve logger from context', async () => {
    const app = new Hono();
    app.use('*', requestIdMiddleware());
    app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
    app.get('/test', (c) => {
      const logger = getLogger(c);
      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('info');
      return c.text('ok');
    });

    await app.request('/test');
  });

  it('should return same logger set by middleware', async () => {
    const app = new Hono();
    app.use('*', requestIdMiddleware());
    app.use('*', loggerMiddleware({ serviceName: 'test-service' }));
    app.get('/test', (c) => {
      const logger1 = c.get('logger');
      const logger2 = getLogger(c);
      expect(logger1).toBe(logger2);
      return c.text('ok');
    });

    await app.request('/test');
  });

  it('should return undefined when logger is not set', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      const logger = getLogger(c);
      expect(logger).toBeUndefined();
      return c.text('ok');
    });

    await app.request('/test');
  });

  it('should return undefined when context.get throws', () => {
    const mockContext = {
      get: vi.fn(() => {
        throw new Error('Context not initialized');
      }),
    } as unknown as Parameters<typeof getLogger>[0];

    expect(getLogger(mockContext)).toBeUndefined();
  });

  it('should work with any context type', async () => {
    const app = new Hono();
    const mockLogger = { info: vi.fn(), error: vi.fn() };

    app.use('*', async (c, next) => {
      (c as any).set('logger', mockLogger);
      await next();
    });
    app.get('/test', (c) => {
      const logger = getLogger(c);
      expect(logger).toBe(mockLogger);
      return c.text('ok');
    });

    await app.request('/test');
  });
});
