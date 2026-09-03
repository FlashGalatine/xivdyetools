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
        // BUG-044: the prefix was `public:ip:`, from when every key WAS an IP.
        // Service-binding traffic now buckets per acting Discord user, so the
        // prefix names only the namespace.
        // pkg-worker-kit-test-utils-05: the binding key now carries the
        // tier's (limit, period), so two tiers sharing one binding cannot
        // share a counter. PUBLIC_LIMITS is 100 requests / 60s.
        expect(binding.calls).toEqual([
            'public:203.0.113.5:t100_60',
            'public:203.0.113.5:t100_60',
        ]);
    });

    /**
     * BUG-044: a request over a Service Binding carries no `CF-Connecting-IP`
     * — both bots build `new Request('https://internal' + path, …)` — so
     * `getClientIp` returned the literal `'unknown'` and EVERY bot request
     * from EVERY Discord user in EVERY guild shared ONE 100/min bucket. The
     * limiter is mounted ahead of `authMiddleware`, so there was no
     * authenticated bypass: `/preset` commands began 429-ing each other.
     *
     * The old suite could not see it — it drove a single synthetic key and
     * asserted header shape and backend selection, never two distinct callers.
     */
    it('gives two bot users two buckets, not one shared `unknown`', async () => {
        const binding = fakeBinding([true, true, true, true]);
        const env = createMockEnv({ RL_PUBLIC: binding });
        const app = buildApp();

        // No CF-Connecting-IP: exactly the shape a Service Binding produces.
        await app.request('/test', { headers: { 'X-User-Discord-ID': '111111111111111111' } }, env);
        await app.request('/test', { headers: { 'X-User-Discord-ID': '222222222222222222' } }, env);

        expect(binding.calls).toEqual([
            'public:111111111111111111:t100_60',
            'public:222222222222222222:t100_60',
        ]);
        expect(binding.calls).not.toContain('public:unknown:t100_60');
    });

    it('still falls back to the IP when no acting user is named', async () => {
        const binding = fakeBinding([true]);
        const env = createMockEnv({ RL_PUBLIC: binding });
        const app = buildApp();

        await app.request('/test', { headers: { 'CF-Connecting-IP': '198.51.100.7' } }, env);

        expect(binding.calls).toEqual(['public:198.51.100.7:t100_60']);
    });

    it('ignores a header that is not snowflake-shaped', async () => {
        // The header is trusted for BUCKETING only; identity still comes from
        // the signature in authMiddleware. A junk value must not create a
        // bucket of its own choosing.
        const binding = fakeBinding([true]);
        const env = createMockEnv({ RL_PUBLIC: binding });
        const app = buildApp();

        await app.request(
            '/test',
            { headers: { 'X-User-Discord-ID': 'not-a-snowflake', 'CF-Connecting-IP': '198.51.100.7' } },
            env
        );

        expect(binding.calls).toEqual(['public:198.51.100.7:t100_60']);
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
