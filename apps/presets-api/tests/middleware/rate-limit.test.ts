/**
 * Rate Limit Middleware Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { publicRateLimitMiddleware } from '../../src/middleware/rate-limit';
import type { Env } from '../../src/types';
import { createMockEnv } from '../test-utils';

describe('PublicRateLimitMiddleware', () => {
    let app: Hono<{ Bindings: Env }>;
    let env: Env;

    beforeEach(() => {
        env = createMockEnv();
        app = new Hono<{ Bindings: Env }>();
        app.use('*', publicRateLimitMiddleware);
        app.get('/test', (c) => c.json({ success: true }));
    });

    it('should add rate limit headers to response', async () => {
        const res = await app.request(
            '/test',
            {
                headers: {
                    'CF-Connecting-IP': '10.0.0.1',
                },
            },
            env
        );

        expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
        expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
        expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should allow requests under the limit', async () => {
        const res = await app.request(
            '/test',
            {
                headers: {
                    'CF-Connecting-IP': '10.0.0.2',
                },
            },
            env
        );

        expect(res.status).toBe(200);
    });

    it('should return 429 when rate limit exceeded', async () => {
        const ip = '10.0.0.3';

        // Exhaust the limit (100 requests)
        for (let i = 0; i < 100; i++) {
            await app.request(
                '/test',
                {
                    headers: {
                        'CF-Connecting-IP': ip,
                    },
                },
                env
            );
        }

        // 101st request should be rate limited
        const res = await app.request(
            '/test',
            {
                headers: {
                    'CF-Connecting-IP': ip,
                },
            },
            env
        );

        expect(res.status).toBe(429);
        const body = await res.json() as { error: string; message: string; retryAfter: number };
        expect(body.error).toBe('Too Many Requests');
        expect(body.message).toContain('Rate limit exceeded');
        expect(body.retryAfter).toBeDefined();
    });

    it('should set Retry-After header when rate limited', async () => {
        const ip = '10.0.0.4';

        // Exhaust the limit
        for (let i = 0; i < 100; i++) {
            await app.request(
                '/test',
                {
                    headers: {
                        'CF-Connecting-IP': ip,
                    },
                },
                env
            );
        }

        // Rate limited request
        const res = await app.request(
            '/test',
            {
                headers: {
                    'CF-Connecting-IP': ip,
                },
            },
            env
        );

        expect(res.status).toBe(429);
        expect(res.headers.get('Retry-After')).toBeDefined();
        expect(parseInt(res.headers.get('Retry-After')!)).toBeGreaterThan(0);
    });

    it('should track requests per IP independently', async () => {
        const ip1 = '10.0.0.5';
        const ip2 = '10.0.0.6';

        // Exhaust IP1's limit
        for (let i = 0; i < 100; i++) {
            await app.request(
                '/test',
                {
                    headers: {
                        'CF-Connecting-IP': ip1,
                    },
                },
                env
            );
        }

        // IP1 should be rate limited
        const res1 = await app.request(
            '/test',
            {
                headers: {
                    'CF-Connecting-IP': ip1,
                },
            },
            env
        );
        expect(res1.status).toBe(429);

        // IP2 should still work
        const res2 = await app.request(
            '/test',
            {
                headers: {
                    'CF-Connecting-IP': ip2,
                },
            },
            env
        );
        expect(res2.status).toBe(200);
    });

    it('should use unknown for requests without IP headers', async () => {
        // Without any IP headers, should fall back to "unknown"
        const res = await app.request('/test', {}, env);

        expect(res.status).toBe(200);
        expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    });

    it('should log warning when rate limiter backend has error (fail-open)', async () => {
        // Mock checkPublicRateLimit to simulate a backend error
        const { checkPublicRateLimit } = await import('../../src/services/rate-limit-service');
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Create a special app that injects kvError
        const errorApp = new Hono<{ Bindings: Env }>();
        errorApp.use('*', async (c, next) => {
            // Patch the rate limit service to return kvError
            const origFetch = globalThis.fetch;
            vi.spyOn(await import('../../src/services/rate-limit-service'), 'checkPublicRateLimit')
              .mockResolvedValueOnce({
                allowed: true,
                remaining: 99,
                resetAt: new Date(Date.now() + 60000),
                kvError: true,
              });
            await publicRateLimitMiddleware(c, next);
        });
        errorApp.get('/test', (c) => c.json({ success: true }));

        const res = await errorApp.request('/test', {
            headers: { 'CF-Connecting-IP': '10.0.0.99' },
        }, env);

        expect(res.status).toBe(200);
        expect(spy).toHaveBeenCalledWith(
            'Rate limiter backend error (failing open)',
            expect.objectContaining({ ip: expect.any(String) })
        );
        spy.mockRestore();
    });
});
