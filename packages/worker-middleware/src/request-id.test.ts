/**
 * Tests for Request ID Middleware
 *
 * REFACTOR-001: Unified tests covering all prior worker-local implementations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { requestIdMiddleware, getRequestId } from './request-id.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('requestIdMiddleware', () => {
  describe('with default options (validateFormat: true)', () => {
    let app: Hono;

    beforeEach(() => {
      app = new Hono();
      app.use('*', requestIdMiddleware());
      app.get('/test', (c) => c.json({ requestId: c.get('requestId') }));
      app.post('/test', (c) => c.json({ requestId: c.get('requestId') }));
    });

    it('should generate a new UUID when no header is provided', async () => {
      const response = await app.request('/test');
      const body = (await response.json()) as { requestId: string };

      expect(body.requestId).toMatch(UUID_REGEX);
      expect(response.headers.get('X-Request-ID')).toBe(body.requestId);
    });

    it('should preserve valid UUID from X-Request-ID header', async () => {
      const validUuid = '12345678-1234-1234-1234-123456789012';

      const response = await app.request('/test', {
        headers: { 'X-Request-ID': validUuid },
      });
      const body = (await response.json()) as { requestId: string };

      expect(body.requestId).toBe(validUuid);
      expect(response.headers.get('X-Request-ID')).toBe(validUuid);
    });

    it('should reject malformed request IDs and generate a new UUID', async () => {
      const response = await app.request('/test', {
        headers: { 'X-Request-ID': 'not-a-valid-uuid' },
      });
      const body = (await response.json()) as { requestId: string };

      expect(body.requestId).not.toBe('not-a-valid-uuid');
      expect(body.requestId).toMatch(UUID_REGEX);
    });

    it('should generate unique IDs for different requests', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const response = await app.request('/test');
        const body = (await response.json()) as { requestId: string };
        ids.push(body.requestId);
      }

      expect(new Set(ids).size).toBe(3);
    });

    it('should set response header after next()', async () => {
      let headerDuringHandler: string | undefined;

      const testApp = new Hono();
      testApp.use('*', requestIdMiddleware());
      testApp.get('/test', (c) => {
        headerDuringHandler = c.res.headers.get('X-Request-ID') ?? undefined;
        return c.text('ok');
      });

      const response = await testApp.request('/test');
      expect(headerDuringHandler).toBeUndefined();
      expect(response.headers.get('X-Request-ID')).toMatch(UUID_REGEX);
    });

    it('should work with different HTTP methods', async () => {
      const getResponse = await app.request('/test');
      const postResponse = await app.request('/test', { method: 'POST' });

      const getBody = (await getResponse.json()) as { requestId: string };
      const postBody = (await postResponse.json()) as { requestId: string };

      expect(getBody.requestId).toMatch(UUID_REGEX);
      expect(postBody.requestId).toMatch(UUID_REGEX);
      expect(getBody.requestId).not.toBe(postBody.requestId);
    });

    it('should handle empty X-Request-ID header by generating new ID', async () => {
      const response = await app.request('/test', {
        headers: { 'X-Request-ID': '' },
      });
      const body = (await response.json()) as { requestId: string };

      expect(body.requestId).toMatch(UUID_REGEX);
    });
  });

  describe('with validateFormat: false', () => {
    let app: Hono;

    beforeEach(() => {
      app = new Hono();
      app.use('*', requestIdMiddleware({ validateFormat: false }));
      app.get('/test', (c) => c.json({ requestId: c.get('requestId') }));
    });

    it('should accept any X-Request-ID header value', async () => {
      const customId = 'custom-request-id-123';

      const response = await app.request('/test', {
        headers: { 'X-Request-ID': customId },
      });
      const body = (await response.json()) as { requestId: string };

      expect(body.requestId).toBe(customId);
    });

    it('should accept long request IDs', async () => {
      const longId = 'x'.repeat(1000);

      const response = await app.request('/test', {
        headers: { 'X-Request-ID': longId },
      });
      const body = (await response.json()) as { requestId: string };

      expect(body.requestId).toBe(longId);
    });

    it('should accept special characters', async () => {
      const specialId = 'req-!@#$%^&*()';

      const response = await app.request('/test', {
        headers: { 'X-Request-ID': specialId },
      });
      const body = (await response.json()) as { requestId: string };

      expect(body.requestId).toBe(specialId);
    });

    it('should still generate UUID when no header provided', async () => {
      const response = await app.request('/test');
      const body = (await response.json()) as { requestId: string };

      expect(body.requestId).toMatch(UUID_REGEX);
    });
  });

  describe('context integration', () => {
    it('should make request ID available to downstream middleware', async () => {
      let middlewareRequestId!: string;
      let handlerRequestId!: string;

      const app = new Hono();
      app.use('*', requestIdMiddleware());
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
      expect(middlewareRequestId).toMatch(UUID_REGEX);
    });
  });
});

describe('getRequestId', () => {
  it('should retrieve request ID from context', async () => {
    const app = new Hono();
    app.use('*', requestIdMiddleware());
    app.get('/test', (c) => {
      const id = getRequestId(c);
      return c.json({ id });
    });

    const response = await app.request('/test');
    const body = (await response.json()) as { id: string };

    expect(body.id).toMatch(UUID_REGEX);
  });

  it('should return same value as c.get("requestId")', async () => {
    const app = new Hono();
    app.use('*', requestIdMiddleware());
    app.get('/test', (c) => {
      const directId = c.get('requestId');
      const helperId = getRequestId(c);
      expect(helperId).toBe(directId);
      return c.text('ok');
    });

    await app.request('/test');
  });

  it('should return "unknown" when request ID is not set', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      const id = getRequestId(c);
      return c.json({ id });
    });

    const response = await app.request('/test');
    const body = (await response.json()) as { id: string };

    expect(body.id).toBe('unknown');
  });

  it('should return "unknown" when context.get throws', () => {
    const mockContext = {
      get: vi.fn(() => {
        throw new Error('Context not initialized');
      }),
    } as unknown as Parameters<typeof getRequestId>[0];

    expect(getRequestId(mockContext)).toBe('unknown');
  });

  it('should return "unknown" for empty string requestId', () => {
    const mockContext = {
      get: vi.fn(() => ''),
    } as unknown as Parameters<typeof getRequestId>[0];

    expect(getRequestId(mockContext)).toBe('unknown');
  });

  it('should return "unknown" for null requestId', () => {
    const mockContext = {
      get: vi.fn(() => null),
    } as unknown as Parameters<typeof getRequestId>[0];

    expect(getRequestId(mockContext)).toBe('unknown');
  });

  it('should work with any context type', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      (c as any).set('requestId', 'test-id');
      await next();
    });
    app.get('/test', (c) => {
      const id = getRequestId(c);
      return c.json({ id });
    });

    const response = await app.request('/test');
    const body = (await response.json()) as { id: string };

    expect(body.id).toBe('test-id');
  });
});
