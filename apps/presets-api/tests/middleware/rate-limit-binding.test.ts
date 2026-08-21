/**
 * Public rate limiter backend selection (FINDING-003, 2026-08-21 audit).
 *
 * When the native Workers Rate Limiting binding `RL_PUBLIC` is bound, the
 * /api/* limiter must use it (atomic, per-colo); the per-isolate memory
 * limiter remains the fallback for dev/tests.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createPublicRateLimitMiddleware } from '../../src/middleware/rate-limit';
import type { Env } from '../../src/types';
import { createMockEnv } from '../test-utils';

function fakeBinding(outcomes: boolean[]): RateLimit & { calls: string[] } {
    const calls: string[] = [];
    let i = 0;
    return {
        calls,
        limit: async ({ key }: { key: string }) => {
            calls.push(key);
            const success = outcomes[Math.min(i, outcomes.length - 1)];
            i++;
            return { success };
        },
    } as unknown as RateLimit & { calls: string[] };
}

function buildApp(): Hono<{ Bindings: Env }> {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', createPublicRateLimitMiddleware());
    app.get('/test', (c) => c.json({ success: true }));
    return app;
}

describe('presets-api public rate limiter backend selection', () => {
    it('uses RL_PUBLIC when bound and returns 429 when it denies', async () => {
        const binding = fakeBinding([true, false]);
        const env = createMockEnv({ RL_PUBLIC: binding });
        const app = buildApp();
        const headers = { 'CF-Connecting-IP': '203.0.113.5' };

        const first = await app.request('/test', { headers }, env);
        const second = await app.request('/test', { headers }, env);

        expect(first.status).toBe(200);
        expect(second.status).toBe(429);
        expect(binding.calls).toEqual(['public:ip:203.0.113.5', 'public:ip:203.0.113.5']);
    });

    it('keeps the memory limiter when RL_PUBLIC is not bound', async () => {
        const env = createMockEnv();
        const app = buildApp();
        const res = await app.request('/test', { headers: { 'CF-Connecting-IP': '203.0.113.6' } }, env);
        expect(res.status).toBe(200);
        expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
        expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
    });
});
