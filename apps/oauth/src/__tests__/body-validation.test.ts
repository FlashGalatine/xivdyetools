/**
 * Body Validation Middleware Tests
 * Tests for SEC-003 (JSON depth limiting) and SEC-004 (body size limits)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { bodySizeLimit, jsonDepthLimit } from '../middleware/body-validation.js';
import type { Env } from '../types.js';
import { env } from './mocks/cloudflare-test.js';

describe('Body Validation Middleware', () => {
  function createApp() {
    const app = new Hono<{ Bindings: Env }>();
    app.use('/auth/*', bodySizeLimit);
    app.use('/auth/*', jsonDepthLimit);
    app.post('/auth/test', async (c) => {
      const body = await c.req.json();
      return c.json({ success: true, body });
    });
    app.get('/auth/test', (c) => c.json({ success: true }));
    return app;
  }

  describe('bodySizeLimit (SEC-004)', () => {
    it('should allow requests within size limit', async () => {
      const app = createApp();
      const body = JSON.stringify({ code: 'test-code', code_verifier: 'test-verifier' });
      const res = await app.fetch(
        new Request('http://localhost/auth/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
        env
      );

      expect(res.status).toBe(200);
    });

    it('should reject requests exceeding 10KB', async () => {
      const app = createApp();
      const largeBody = JSON.stringify({ data: 'x'.repeat(11 * 1024) });
      const res = await app.fetch(
        new Request('http://localhost/auth/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: largeBody,
        }),
        env
      );

      expect(res.status).toBe(413);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Payload too large');
    });

    it('should allow GET requests regardless', async () => {
      const app = createApp();
      const res = await app.fetch(
        new Request('http://localhost/auth/test'),
        env
      );

      expect(res.status).toBe(200);
    });
  });

  describe('jsonDepthLimit (SEC-003)', () => {
    it('should allow JSON within depth limit', async () => {
      const app = createApp();
      const body = JSON.stringify({ a: { b: { c: 'value' } } });
      const res = await app.fetch(
        new Request('http://localhost/auth/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
        env
      );

      expect(res.status).toBe(200);
    });

    it('should reject JSON exceeding depth limit of 10', async () => {
      const app = createApp();
      let nested: Record<string, unknown> = { value: 'deep' };
      for (let i = 0; i < 12; i++) {
        nested = { level: nested };
      }
      const body = JSON.stringify(nested);
      const res = await app.fetch(
        new Request('http://localhost/auth/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
        env
      );

      expect(res.status).toBe(400);
      const json = await res.json() as { message: string };
      expect(json.message).toContain('depth');
    });

    it('should reject JSON with __proto__ pollution', async () => {
      const app = createApp();
      const body = '{"__proto__": {"isAdmin": true}}';
      const res = await app.fetch(
        new Request('http://localhost/auth/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
        env
      );

      expect(res.status).toBe(400);
      const json = await res.json() as { success: boolean; message: string };
      expect(json.success).toBe(false);
      expect(json.message).toBe('Invalid JSON structure');
    });

    it('should reject JSON with constructor pollution', async () => {
      const app = createApp();
      const body = '{"constructor": {"prototype": {"isAdmin": true}}}';
      const res = await app.fetch(
        new Request('http://localhost/auth/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
        env
      );

      expect(res.status).toBe(400);
    });

    it('should reject invalid JSON syntax', async () => {
      const app = createApp();
      const res = await app.fetch(
        new Request('http://localhost/auth/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{bad json}',
        }),
        env
      );

      expect(res.status).toBe(400);
      const json = await res.json() as { success: boolean; message: string };
      expect(json.success).toBe(false);
      expect(json.message).toBe('Invalid JSON syntax');
    });

    it('should skip validation for GET requests', async () => {
      const app = createApp();
      const res = await app.fetch(
        new Request('http://localhost/auth/test'),
        env
      );

      expect(res.status).toBe(200);
    });

    it('should skip validation for non-JSON content types', async () => {
      const app = createApp();
      const res = await app.fetch(
        new Request('http://localhost/auth/test', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: 'not json',
        }),
        env
      );

      // Middleware should not block non-JSON requests
      expect(res.status).not.toBe(413);
    });

    it('should skip validation for empty body', async () => {
      const app = createApp();
      const res = await app.fetch(
        new Request('http://localhost/auth/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
        env
      );

      // Empty body — handler may fail but middleware should not block with 400
      expect([200, 500]).toContain(res.status);
    });
  });
});
