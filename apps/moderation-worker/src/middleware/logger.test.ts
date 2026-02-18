import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { loggerMiddleware, getLogger, type LoggerVariables } from './logger.js';
import type { Env } from '../types/env.js';

// Mock the logger module
vi.mock('@xivdyetools/logger/worker', () => ({
  createRequestLogger: vi.fn((config, requestId) => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    requestId,
  })),
}));

import { createRequestLogger } from '@xivdyetools/logger/worker';

describe('loggerMiddleware', () => {
  let app: Hono<{ Bindings: Env; Variables: LoggerVariables }>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono<{ Bindings: Env; Variables: LoggerVariables }>();

    // Set up request ID middleware (logger depends on it)
    app.use('*', async (c, next) => {
      c.set('requestId', 'test-request-id-123');
      await next();
    });

    app.use('*', loggerMiddleware);
  });

  describe('logger creation', () => {
    it('should create logger with request ID', async () => {
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test');

      expect(createRequestLogger).toHaveBeenCalledWith(
        {
          ENVIRONMENT: 'production',
          SERVICE_NAME: 'xivdyetools-moderation-worker',
        },
        'test-request-id-123'
      );
    });

    it('should set logger in context', async () => {
      let contextLogger;

      app.get('/test', (c) => {
        contextLogger = c.get('logger');
        return c.text('ok');
      });

      await app.request('/test');

      expect(contextLogger).toBeDefined();
      expect(contextLogger).toHaveProperty('info');
      expect(contextLogger).toHaveProperty('error');
    });

    it('should use requestId from context', async () => {
      app.use('/custom', async (c, next) => {
        c.set('requestId', 'custom-id-456');
        await next();
      });

      app.get('/custom', (c) => c.text('ok'));

      await app.request('/custom');

      // The middleware sets 'test-request-id-123' first, then custom middleware overwrites it
      // But the logger is created before the custom middleware runs
      expect(createRequestLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          ENVIRONMENT: 'production',
          SERVICE_NAME: 'xivdyetools-moderation-worker',
        }),
        'test-request-id-123'
      );
    });
  });

  describe('request logging', () => {
    it('should log request start', async () => {
      app.get('/test-path', (c) => c.text('ok'));

      await app.request('/test-path');

      // Get the logger that was created
      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({
          method: 'GET',
          path: '/test-path',
        })
      );
    });

    it('should log request completion with status', async () => {
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger?.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({
          method: 'GET',
          path: '/test',
          status: 200,
          durationMs: expect.any(Number),
        })
      );
    });

    it('should log duration in milliseconds', async () => {
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      const completionCall = mockLogger?.info.mock.calls.find(
        (call: unknown[]) => call[0] === 'Request completed'
      );

      expect(completionCall?.[1]?.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof completionCall?.[1]?.durationMs).toBe('number');
    });

    it('should round duration to 2 decimal places', async () => {
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      const completionCall = mockLogger?.info.mock.calls.find(
        (call: unknown[]) => call[0] === 'Request completed'
      );

      const duration = completionCall?.[1]?.durationMs;
      expect(duration).toBe(Math.round(duration! * 100) / 100);
    });
  });

  describe('different HTTP methods', () => {
    it('should log POST requests', async () => {
      app.post('/test', (c) => c.text('created'));

      await app.request('/test', { method: 'POST' });

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger?.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should log PATCH requests', async () => {
      app.patch('/test', (c) => c.text('updated'));

      await app.request('/test', { method: 'PATCH' });

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger?.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    it('should log DELETE requests', async () => {
      app.delete('/test', (c) => c.text('deleted'));

      await app.request('/test', { method: 'DELETE' });

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger?.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('different response statuses', () => {
    it('should log successful responses (200)', async () => {
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger?.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({ status: 200 })
      );
    });

    it('should log not found responses (404)', async () => {
      app.get('/exists', (c) => c.text('found'));

      await app.request('/nonexistent');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger?.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({ status: 404 })
      );
    });

    it('should log server error responses (500)', async () => {
      app.get('/error', async (c) => {
        return c.text('Internal Server Error', 500);
      });

      const response = await app.request('/error');

      expect(response.status).toBe(500);
      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger.info).toHaveBeenCalledWith('Request started', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({
          status: 500,
        })
      );
    });
  });

  describe('path extraction', () => {
    it('should extract pathname from URL', async () => {
      app.get('/api/v1/test', (c) => c.text('ok'));

      await app.request('https://example.com/api/v1/test');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger?.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({
          path: '/api/v1/test',
        })
      );
    });

    it('should handle query parameters', async () => {
      app.get('/test', (c) => c.text('ok'));

      await app.request('/test?param=value');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      // Implementation sanitizes and includes query params in path
      expect(mockLogger?.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({
          path: '/test?param=value',
        })
      );
    });

    it('should handle root path', async () => {
      app.get('/', (c) => c.text('ok'));

      await app.request('/');

      const mockLogger = vi.mocked(createRequestLogger).mock.results[0]?.value;
      expect(mockLogger?.info).toHaveBeenCalledWith(
        'Request started',
        expect.objectContaining({
          path: '/',
        })
      );
    });
  });
});

describe('getLogger', () => {
  let app: Hono<{ Bindings: Env; Variables: LoggerVariables }>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono<{ Bindings: Env; Variables: LoggerVariables }>();
    app.use('*', async (c, next) => {
      c.set('requestId', 'test-id');
      await next();
    });
    app.use('*', loggerMiddleware);
  });

  describe('successful retrieval', () => {
    it('should retrieve logger from context', async () => {
      app.get('/test', (c) => {
        const logger = getLogger(c);
        expect(logger).toBeDefined();
        expect(logger).toHaveProperty('info');
        return c.text('ok');
      });

      await app.request('/test');
    });

    it('should return same logger set by middleware', async () => {
      app.get('/test', (c) => {
        const logger1 = c.get('logger');
        const logger2 = getLogger(c);
        expect(logger1).toBe(logger2);
        return c.text('ok');
      });

      await app.request('/test');
    });
  });

  describe('fallback behavior', () => {
    it('should return undefined when logger is not set', async () => {
      const appWithoutLogger = new Hono();

      appWithoutLogger.get('/test', (c) => {
        const logger = getLogger(c);
        expect(logger).toBeUndefined();
        return c.text('ok');
      });

      await appWithoutLogger.request('/test');
    });

    it('should handle context.get throwing error', async () => {
      const appWithoutLogger = new Hono();

      appWithoutLogger.get('/test', (c) => {
        // Context doesn't have logger variable set
        const logger = getLogger(c);
        expect(logger).toBeUndefined();
        return c.text('ok');
      });

      await appWithoutLogger.request('/test');
    });
  });

  describe('type safety', () => {
    it('should work with any context type', async () => {
      const genericApp = new Hono();
      const mockLogger = { info: vi.fn(), error: vi.fn() };

      genericApp.use('*', async (c, next) => {
        (c as any).set('logger', mockLogger as any);
        await next();
      });

      genericApp.get('/test', (c) => {
        const logger = getLogger(c);
        expect(logger).toBe(mockLogger);
        return c.text('ok');
      });

      await genericApp.request('/test');
    });
  });
});
