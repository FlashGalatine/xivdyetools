/**
 * Request ID Middleware Tests
 *
 * Tests for request ID generation, validation, and propagation.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requestIdMiddleware, getRequestId } from '../../src/middleware/request-id';
import type { Env } from '../../src/types';

const UUID_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

describe('requestIdMiddleware', () => {
  function createApp() {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', requestIdMiddleware as any);
    app.get('/test', (c) => {
      const reqId = c.get('requestId');
      return c.json({ requestId: reqId });
    });
    return app;
  }

  it('should generate a UUID when no X-Request-ID header is present', async () => {
    const app = createApp();
    const res = await app.request('/test');

    expect(res.status).toBe(200);
    const body = await res.json() as { requestId: string };
    expect(body.requestId).toMatch(UUID_REGEX);
    // Response header should also be set
    expect(res.headers.get('X-Request-ID')).toBe(body.requestId);
  });

  it('should preserve a valid UUID from X-Request-ID header', async () => {
    const app = createApp();
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';
    const res = await app.request('/test', {
      headers: { 'X-Request-ID': validUUID },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { requestId: string };
    expect(body.requestId).toBe(validUUID);
    expect(res.headers.get('X-Request-ID')).toBe(validUUID);
  });

  it('should reject invalid X-Request-ID and generate a new UUID', async () => {
    const app = createApp();
    const res = await app.request('/test', {
      headers: { 'X-Request-ID': 'not-a-uuid' },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { requestId: string };
    // Should NOT use the invalid value
    expect(body.requestId).not.toBe('not-a-uuid');
    expect(body.requestId).toMatch(UUID_REGEX);
  });

  it('should reject malicious X-Request-ID to prevent log injection', async () => {
    const app = createApp();
    // Use a valid HTTP header value that is NOT a valid UUID
    const malicious = 'DROP TABLE users; --';
    const res = await app.request('/test', {
      headers: { 'X-Request-ID': malicious },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { requestId: string };
    expect(body.requestId).toMatch(UUID_REGEX);
    expect(body.requestId).not.toBe(malicious);
  });
});

describe('getRequestId', () => {
  it('should return the stored request ID', async () => {
    const app = new Hono();
    app.use('*', requestIdMiddleware as any);
    app.get('/test', (c) => {
      const id = getRequestId(c);
      return c.json({ id });
    });

    const res = await app.request('/test');
    const body = await res.json() as { id: string };
    expect(body.id).toMatch(UUID_REGEX);
  });

  it('should return unknown when requestId is not set', async () => {
    const app = new Hono();
    // No middleware — requestId not set
    app.get('/test', (c) => {
      const id = getRequestId(c);
      return c.json({ id });
    });

    const res = await app.request('/test');
    const body = await res.json() as { id: string };
    expect(body.id).toBe('unknown');
  });

  it('should return unknown when context throws', () => {
    // Simulate a context that throws on .get()
    const fakeContext = {
      get: () => { throw new Error('context not initialized'); },
    };
    const result = getRequestId(fakeContext as any);
    expect(result).toBe('unknown');
  });
});
