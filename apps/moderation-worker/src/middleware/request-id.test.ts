import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { requestIdMiddleware, getRequestId, type RequestIdVariables } from './request-id.js';
import type { Env } from '../types/env.js';

describe('requestIdMiddleware', () => {
  let app: Hono<{ Bindings: Env; Variables: RequestIdVariables }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env; Variables: RequestIdVariables }>();
    app.use('*', requestIdMiddleware);
  });

  describe('request ID generation', () => {
    it('should generate new request ID when header is missing', async () => {
      app.get('/test', (c) => {
        const requestId = c.get('requestId');
        expect(requestId).toBeDefined();
        expect(typeof requestId).toBe('string');
        expect(requestId.length).toBeGreaterThan(0);
        return c.text('ok');
      });

      const response = await app.request('/test');
      expect(response.status).toBe(200);
    });

    it('should generate valid UUID format', async () => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      app.get('/test', (c) => {
        const requestId = c.get('requestId');
        expect(requestId).toMatch(uuidRegex);
        return c.text('ok');
      });

      await app.request('/test');
    });

    it('should generate unique request IDs for different requests', async () => {
      const requestIds: string[] = [];

      app.get('/test', (c) => {
        const requestId = c.get('requestId');
        requestIds.push(requestId);
        return c.text('ok');
      });

      await app.request('/test');
      await app.request('/test');
      await app.request('/test');

      expect(requestIds).toHaveLength(3);
      expect(new Set(requestIds).size).toBe(3); // All unique
    });
  });

  describe('request ID preservation', () => {
    it('should preserve existing X-Request-ID header', async () => {
      const existingId = '12345678-1234-1234-1234-123456789012';

      app.get('/test', (c) => {
        const requestId = c.get('requestId');
        expect(requestId).toBe(existingId);
        return c.text('ok');
      });

      const response = await app.request('/test', {
        headers: {
          'X-Request-ID': existingId,
        },
      });

      expect(response.status).toBe(200);
    });

    it('should use custom request ID from header', async () => {
      const customId = 'custom-request-id-123';

      app.get('/test', (c) => {
        const requestId = c.get('requestId');
        expect(requestId).toBe(customId);
        return c.text('ok');
      });

      await app.request('/test', {
        headers: {
          'X-Request-ID': customId,
        },
      });
    });

    it('should handle empty X-Request-ID header by generating new ID', async () => {
      app.get('/test', (c) => {
        const requestId = c.get('requestId');
        expect(requestId).toBeDefined();
        expect(requestId.length).toBeGreaterThan(0);
        return c.text('ok');
      });

      await app.request('/test', {
        headers: {
          'X-Request-ID': '',
        },
      });
    });
  });

  describe('response headers', () => {
    it('should set X-Request-ID header in response', async () => {
      app.get('/test', (c) => c.text('ok'));

      const response = await app.request('/test');
      const requestIdHeader = response.headers.get('X-Request-ID');

      expect(requestIdHeader).toBeDefined();
      expect(requestIdHeader).not.toBe('');
    });

    it('should return same request ID in response header as used in context', async () => {
      let contextRequestId!: string;

      app.get('/test', (c) => {
        contextRequestId = c.get('requestId');
        return c.text('ok');
      });

      const response = await app.request('/test');
      const responseRequestId = response.headers.get('X-Request-ID');

      expect(responseRequestId).toBe(contextRequestId);
    });

    it('should preserve incoming request ID in response header', async () => {
      const incomingId = 'incoming-request-123';

      app.get('/test', (c) => c.text('ok'));

      const response = await app.request('/test', {
        headers: {
          'X-Request-ID': incomingId,
        },
      });

      const responseRequestId = response.headers.get('X-Request-ID');
      expect(responseRequestId).toBe(incomingId);
    });
  });

  describe('context integration', () => {
    it('should set requestId in context for later use', async () => {
      app.get('/test', (c) => {
        const requestId = c.get('requestId');
        expect(requestId).toBeDefined();

        // Use it later in the handler
        return c.json({ requestId });
      });

      const response = await app.request('/test');
      const body = await response.json() as any;

      expect(body.requestId).toBeDefined();
      expect(typeof body.requestId).toBe('string');
    });

    it('should make request ID available across multiple handlers', async () => {
      let middlewareRequestId!: string;
      let handlerRequestId!: string;

      app.use('/test', async (c, next) => {
        middlewareRequestId = c.get('requestId');
        await next();
      });

      app.get('/test', (c) => {
        handlerRequestId = c.get('requestId');
        return c.text('ok');
      });

      await app.request('/test');

      expect(middlewareRequestId).toBe(handlerRequestId);
    });
  });

  describe('edge cases', () => {
    it('should handle very long X-Request-ID values', async () => {
      const longId = 'x'.repeat(1000);

      app.get('/test', (c) => {
        const requestId = c.get('requestId');
        expect(requestId).toBe(longId);
        return c.text('ok');
      });

      await app.request('/test', {
        headers: {
          'X-Request-ID': longId,
        },
      });
    });

    it('should handle special characters in X-Request-ID', async () => {
      const specialId = 'req-!@#$%^&*()';

      app.get('/test', (c) => {
        const requestId = c.get('requestId');
        expect(requestId).toBe(specialId);
        return c.text('ok');
      });

      await app.request('/test', {
        headers: {
          'X-Request-ID': specialId,
        },
      });
    });

    it('should work with different HTTP methods', async () => {
      const requestIds: string[] = [];

      app.post('/test', (c) => {
        requestIds.push(c.get('requestId'));
        return c.text('ok');
      });

      app.put('/test', (c) => {
        requestIds.push(c.get('requestId'));
        return c.text('ok');
      });

      app.delete('/test', (c) => {
        requestIds.push(c.get('requestId'));
        return c.text('ok');
      });

      await app.request('/test', { method: 'POST' });
      await app.request('/test', { method: 'PUT' });
      await app.request('/test', { method: 'DELETE' });

      expect(requestIds).toHaveLength(3);
      expect(new Set(requestIds).size).toBe(3); // All unique
    });
  });
});

describe('getRequestId', () => {
  let app: Hono<{ Bindings: Env; Variables: RequestIdVariables }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env; Variables: RequestIdVariables }>();
    app.use('*', requestIdMiddleware);
  });

  describe('successful retrieval', () => {
    it('should retrieve request ID from context', async () => {
      app.get('/test', (c) => {
        const requestId = getRequestId(c);
        expect(requestId).toBeDefined();
        expect(requestId).not.toBe('unknown');
        expect(typeof requestId).toBe('string');
        return c.text('ok');
      });

      await app.request('/test');
    });

    it('should return same value as c.get("requestId")', async () => {
      app.get('/test', (c) => {
        const directId = c.get('requestId');
        const helperId = getRequestId(c);
        expect(helperId).toBe(directId);
        return c.text('ok');
      });

      await app.request('/test');
    });
  });

  describe('fallback behavior', () => {
    it('should return "unknown" when request ID is not set', async () => {
      const appWithoutMiddleware = new Hono();

      appWithoutMiddleware.get('/test', (c) => {
        const requestId = getRequestId(c);
        expect(requestId).toBe('unknown');
        return c.text('ok');
      });

      await appWithoutMiddleware.request('/test');
    });

    it('should handle context.get throwing error', async () => {
      const appWithoutMiddleware = new Hono();

      appWithoutMiddleware.get('/test', (c) => {
        // Context doesn't have requestId variable set
        const requestId = getRequestId(c);
        expect(requestId).toBe('unknown');
        return c.text('ok');
      });

      await appWithoutMiddleware.request('/test');
    });

    it('should return "unknown" for undefined requestId', async () => {
      const appWithBrokenMiddleware = new Hono<{ Bindings: Env; Variables: RequestIdVariables }>();

      appWithBrokenMiddleware.use('*', async (c, next) => {
        c.set('requestId', undefined as any);
        await next();
      });

      appWithBrokenMiddleware.get('/test', (c) => {
        const requestId = getRequestId(c);
        expect(requestId).toBe('unknown');
        return c.text('ok');
      });

      await appWithBrokenMiddleware.request('/test');
    });
  });

  describe('type safety', () => {
    it('should work with any context type', async () => {
      const genericApp = new Hono();
      genericApp.use('*', async (c, next) => {
        (c as any).set('requestId', 'test-id');
        await next();
      });

      genericApp.get('/test', (c) => {
        const requestId = getRequestId(c);
        expect(requestId).toBe('test-id');
        return c.text('ok');
      });

      await genericApp.request('/test');
    });
  });
});
