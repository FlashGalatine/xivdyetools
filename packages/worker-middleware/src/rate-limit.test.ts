/**
 * Tests for Rate Limit Middleware Factory
 *
 * REFACTOR-002: Tests for the shared rate limiting middleware
 * that standardizes the check → headers → 429 pattern across workers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { RateLimiter, RateLimitConfig, RateLimitResult } from '@xivdyetools/rate-limiter';
import { rateLimitMiddleware } from './rate-limit.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockBackend(overrides: Partial<RateLimiter> = {}): RateLimiter {
  return {
    check: vi.fn<[string, RateLimitConfig], Promise<RateLimitResult>>().mockResolvedValue({
      allowed: true,
      remaining: 99,
      resetAt: new Date(Date.now() + 60_000),
      limit: 100,
    }),
    reset: vi.fn<[string], Promise<void>>().mockResolvedValue(undefined),
    resetAll: vi.fn<[], Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000,
};

function buildApp(
  options: Parameters<typeof rateLimitMiddleware>[0],
) {
  const app = new Hono();
  // Provide a minimal logger on context for the middleware
  app.use('*', async (c, next) => {
    c.set('logger', {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as never);
    await next();
  });
  app.use('*', rateLimitMiddleware(options));
  app.get('/test', (c) => c.json({ ok: true }));
  app.post('/test', (c) => c.json({ ok: true }));
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rateLimitMiddleware', () => {
  describe('allowed requests', () => {
    it('should pass through when rate limit is not exceeded', async () => {
      const backend = createMockBackend();
      const app = buildApp({
        backend,
        keyExtractor: () => '127.0.0.1',
        config: DEFAULT_CONFIG,
      });

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('should set X-RateLimit-* headers on allowed requests', async () => {
      const resetAt = new Date(Date.now() + 60_000);
      const backend = createMockBackend({
        check: vi.fn().mockResolvedValue({
          allowed: true,
          remaining: 42,
          resetAt,
          limit: 100,
        }),
      });
      const app = buildApp({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: DEFAULT_CONFIG,
      });

      const res = await app.request('/test');
      expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('42');
      expect(res.headers.get('X-RateLimit-Reset')).toBe(
        String(Math.ceil(resetAt.getTime() / 1000)),
      );
    });

    it('should call backend.check with the extracted key and config', async () => {
      const backend = createMockBackend();
      const config: RateLimitConfig = { maxRequests: 30, windowMs: 30_000 };
      const app = buildApp({
        backend,
        keyExtractor: () => 'user:1234',
        config,
      });

      await app.request('/test');
      expect(backend.check).toHaveBeenCalledWith('user:1234', config);
    });
  });

  describe('rate limited requests', () => {
    let backend: RateLimiter;
    let resetAt: Date;

    beforeEach(() => {
      resetAt = new Date(Date.now() + 30_000);
      backend = createMockBackend({
        check: vi.fn().mockResolvedValue({
          allowed: false,
          remaining: 0,
          resetAt,
          limit: 100,
          retryAfter: 30,
        }),
      });
    });

    it('should return 429 when rate limit is exceeded', async () => {
      const app = buildApp({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: DEFAULT_CONFIG,
      });

      const res = await app.request('/test');
      expect(res.status).toBe(429);
    });

    it('should include Retry-After header', async () => {
      const app = buildApp({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: DEFAULT_CONFIG,
      });

      const res = await app.request('/test');
      expect(res.headers.get('Retry-After')).toBe('30');
    });

    it('should return standard error JSON body', async () => {
      const app = buildApp({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: DEFAULT_CONFIG,
      });

      const res = await app.request('/test');
      const body = await res.json();
      expect(body).toEqual({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 30,
      });
    });

    it('should calculate retryAfter from resetAt when not provided', async () => {
      const futureReset = new Date(Date.now() + 45_000);
      backend = createMockBackend({
        check: vi.fn().mockResolvedValue({
          allowed: false,
          remaining: 0,
          resetAt: futureReset,
          limit: 100,
          // retryAfter intentionally omitted
        }),
      });
      const app = buildApp({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: DEFAULT_CONFIG,
      });

      const res = await app.request('/test');
      const retryAfter = Number(res.headers.get('Retry-After'));
      // Should be approximately 45 seconds (within a small tolerance)
      expect(retryAfter).toBeGreaterThanOrEqual(44);
      expect(retryAfter).toBeLessThanOrEqual(46);
    });

    it('should use custom formatError when provided', async () => {
      const app = buildApp({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: DEFAULT_CONFIG,
        formatError: (c, retryAfter) =>
          c.json({ custom: true, retry: retryAfter }, 429),
      });

      const res = await app.request('/test');
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({ custom: true, retry: 30 });
    });
  });

  describe('error handling', () => {
    it('should fail-open by default (allow request on backend error)', async () => {
      const backend = createMockBackend({
        check: vi.fn().mockRejectedValue(new Error('KV unavailable')),
      });
      const app = buildApp({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: DEFAULT_CONFIG,
      });

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('should fail-closed when configured (block on backend error)', async () => {
      const backend = createMockBackend({
        check: vi.fn().mockRejectedValue(new Error('KV unavailable')),
      });
      const app = buildApp({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: DEFAULT_CONFIG,
        onError: 'fail-closed',
      });

      const res = await app.request('/test');
      expect(res.status).toBe(429);
    });

    it('should log warning on backend error', async () => {
      const backend = createMockBackend({
        check: vi.fn().mockRejectedValue(new Error('KV unavailable')),
      });
      const app = new Hono();
      const warnFn = vi.fn();
      app.use('*', async (c, next) => {
        c.set('logger', { info: vi.fn(), warn: warnFn, error: vi.fn(), debug: vi.fn() } as never);
        await next();
      });
      app.use('*', rateLimitMiddleware({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: DEFAULT_CONFIG,
      }));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test');
      expect(warnFn).toHaveBeenCalledWith(
        'Rate limiter backend error',
        expect.objectContaining({ onError: 'fail-open', key: '10.0.0.1' }),
      );
    });

    it('should log warning on backendError flag in result', async () => {
      const backend = createMockBackend({
        check: vi.fn().mockResolvedValue({
          allowed: true,
          remaining: 99,
          resetAt: new Date(Date.now() + 60_000),
          limit: 100,
          backendError: true,
        }),
      });
      const app = new Hono();
      const warnFn = vi.fn();
      app.use('*', async (c, next) => {
        c.set('logger', { info: vi.fn(), warn: warnFn, error: vi.fn(), debug: vi.fn() } as never);
        await next();
      });
      app.use('*', rateLimitMiddleware({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: DEFAULT_CONFIG,
      }));
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      expect(warnFn).toHaveBeenCalledWith(
        'Rate limiter backend error (failing open)',
        expect.objectContaining({ key: '10.0.0.1' }),
      );
    });

    it('should handle missing logger gracefully on error', async () => {
      const backend = createMockBackend({
        check: vi.fn().mockRejectedValue(new Error('boom')),
      });
      // App WITHOUT logger middleware
      const app = new Hono();
      app.use('*', rateLimitMiddleware({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: DEFAULT_CONFIG,
      }));
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200); // fail-open still works
    });
  });

  describe('key extraction', () => {
    it('should use the keyExtractor function to derive the key', async () => {
      const backend = createMockBackend();
      const app = buildApp({
        backend,
        keyExtractor: (c) => c.req.header('CF-Connecting-IP') ?? 'unknown',
        config: DEFAULT_CONFIG,
      });

      await app.request('/test', {
        headers: { 'CF-Connecting-IP': '1.2.3.4' },
      });
      expect(backend.check).toHaveBeenCalledWith('1.2.3.4', DEFAULT_CONFIG);
    });
  });

  describe('dynamic config', () => {
    it('should support a config function for per-request config', async () => {
      const backend = createMockBackend();
      const app = buildApp({
        backend,
        keyExtractor: () => '10.0.0.1',
        config: (c) => ({
          maxRequests: c.req.method === 'POST' ? 10 : 100,
          windowMs: 60_000,
        }),
      });

      await app.request('/test', { method: 'POST' });
      expect(backend.check).toHaveBeenCalledWith('10.0.0.1', {
        maxRequests: 10,
        windowMs: 60_000,
      });

      await app.request('/test', { method: 'GET' });
      expect(backend.check).toHaveBeenCalledWith('10.0.0.1', {
        maxRequests: 100,
        windowMs: 60_000,
      });
    });
  });
});
