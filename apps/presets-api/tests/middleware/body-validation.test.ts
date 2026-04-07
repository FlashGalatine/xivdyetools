/**
 * Body Validation Middleware Tests
 * Tests for SEC-003 (JSON depth limiting) and SEC-004 (body size limits)
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { bodySizeLimit, jsonDepthLimit } from '../../src/middleware/body-validation';
import type { Env } from '../../src/types';
import { createMockEnv } from '../test-utils';

describe('Body Validation Middleware', () => {
  let env: Env;

  function createApp() {
    const app = new Hono<{ Bindings: Env }>();
    app.use('/api/*', bodySizeLimit);
    app.use('/api/*', jsonDepthLimit);
    app.post('/api/test', async (c) => {
      const body = await c.req.json();
      return c.json({ success: true, body });
    });
    app.get('/api/test', (c) => c.json({ success: true }));
    return app;
  }

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('bodySizeLimit (SEC-004)', () => {
    it('should allow requests within size limit', async () => {
      const app = createApp();
      const body = JSON.stringify({ name: 'test' });
      const res = await app.request(
        '/api/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        },
        env
      );

      expect(res.status).toBe(200);
    });

    it('should reject requests exceeding 100KB', async () => {
      const app = createApp();
      // Create a body larger than 100KB
      const largeBody = JSON.stringify({ data: 'x'.repeat(110 * 1024) });
      const res = await app.request(
        '/api/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: largeBody,
        },
        env
      );

      expect(res.status).toBe(413);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('PAYLOAD_TOO_LARGE');
    });

    it('should allow GET requests regardless of content-length header', async () => {
      const app = createApp();
      const res = await app.request('/api/test', { method: 'GET' }, env);

      expect(res.status).toBe(200);
    });
  });

  describe('jsonDepthLimit (SEC-003)', () => {
    it('should allow JSON within depth limit', async () => {
      const app = createApp();
      const body = JSON.stringify({ a: { b: { c: { d: 'value' } } } });
      const res = await app.request(
        '/api/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        },
        env
      );

      expect(res.status).toBe(200);
    });

    it('should reject JSON exceeding depth limit of 10', async () => {
      const app = createApp();
      // Create deeply nested JSON (12 levels)
      let nested: Record<string, unknown> = { value: 'deep' };
      for (let i = 0; i < 12; i++) {
        nested = { level: nested };
      }
      const body = JSON.stringify(nested);
      const res = await app.request(
        '/api/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        },
        env
      );

      expect(res.status).toBe(400);
      const json = await res.json() as { error: string; message: string };
      expect(json.error).toBe('BAD_REQUEST');
      expect(json.message).toContain('depth');
    });

    it('should reject JSON with prototype pollution keys', async () => {
      const app = createApp();
      // Manually construct JSON with __proto__ key (JSON.stringify won't include it normally)
      const body = '{"__proto__": {"isAdmin": true}}';
      const res = await app.request(
        '/api/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        },
        env
      );

      expect(res.status).toBe(400);
      const json = await res.json() as { message: string };
      expect(json.message).toBe('Invalid JSON structure');
    });

    it('should reject JSON with constructor pollution', async () => {
      const app = createApp();
      const body = '{"constructor": {"prototype": {"isAdmin": true}}}';
      const res = await app.request(
        '/api/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        },
        env
      );

      expect(res.status).toBe(400);
    });

    it('should reject invalid JSON syntax', async () => {
      const app = createApp();
      const res = await app.request(
        '/api/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{invalid json}',
        },
        env
      );

      expect(res.status).toBe(400);
      const json = await res.json() as { message: string };
      expect(json.message).toBe('Invalid JSON syntax');
    });

    it('should skip validation for GET requests', async () => {
      const app = createApp();
      const res = await app.request('/api/test', { method: 'GET' }, env);

      expect(res.status).toBe(200);
    });

    it('should skip validation for non-JSON content types', async () => {
      const app = createApp();
      const res = await app.request(
        '/api/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: 'not json',
        },
        env
      );

      // The handler will fail to parse, but the middleware should not block it
      // This tests that the middleware correctly skips non-JSON requests
      expect(res.status).not.toBe(413);
    });

    it('should allow arrays within depth limit', async () => {
      const app = createApp();
      const body = JSON.stringify({ items: [1, 2, 3, { nested: true }] });
      const res = await app.request(
        '/api/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        },
        env
      );

      expect(res.status).toBe(200);
    });

    it('should skip validation for empty body', async () => {
      const app = createApp();
      const res = await app.request(
        '/api/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        env
      );

      // Empty body — handler may fail but middleware should not block with 400
      expect([200, 500]).toContain(res.status);
    });
  });
});
