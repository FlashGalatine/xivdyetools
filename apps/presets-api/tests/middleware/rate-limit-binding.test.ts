/**
 * Public rate limiter backend selection (FINDING-003, 2026-08-21 audit).
 *
 * When the native Workers Rate Limiting binding `RL_PUBLIC` is bound, the
 * /api/* limiter must use it (atomic, per-colo); the per-isolate memory
 * limiter remains the fallback for dev/tests.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
    createPublicRateLimitMiddleware,
    createPerUserRateLimitMiddleware,
} from '../../src/middleware/rate-limit';
import type { AuthContext, Env } from '../../src/types';
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
     * BUG-044 follow-up (2026-09-03 pre-merge review).
     *
     * BUG-044 keyed this layer on `X-User-Discord-ID` whenever it was
     * snowflake-shaped, to stop both bots' entire traffic sharing one
     * `'unknown'` bucket. But the header is caller-supplied and this
     * middleware is mounted ELEVEN LINES ahead of `authMiddleware`, so
     * nothing had verified it: an anonymous client could mint a fresh
     * 100/min bucket per request by incrementing a header, which removed
     * the per-IP ceiling altogether.
     *
     * The key is the IP again, unconditionally. Per-user fairness moved to
     * `perUserRateLimitMiddleware`, which runs after the signature check —
     * see the suite below.
     */
    it('does NOT let a caller choose its own bucket with a header', async () => {
        const binding = fakeBinding([true, true, true, true]);
        const env = createMockEnv({ RL_PUBLIC: binding });
        const app = buildApp();
        const ip = '198.51.100.7';

        // Same client, two different spoofed snowflakes. Both must land in the
        // one bucket its IP earns. Before the fix these were two buckets, and
        // an attacker could have as many as they cared to type.
        await app.request(
            '/test',
            { headers: { 'CF-Connecting-IP': ip, 'X-User-Discord-ID': '111111111111111111' } },
            env
        );
        await app.request(
            '/test',
            { headers: { 'CF-Connecting-IP': ip, 'X-User-Discord-ID': '222222222222222222' } },
            env
        );

        expect(binding.calls).toEqual([
            'public:198.51.100.7:t100_60',
            'public:198.51.100.7:t100_60',
        ]);
    });

    it('still falls back to the IP when no acting user is named', async () => {
        const binding = fakeBinding([true]);
        const env = createMockEnv({ RL_PUBLIC: binding });
        const app = buildApp();

        await app.request('/test', { headers: { 'CF-Connecting-IP': '198.51.100.7' } }, env);

        expect(binding.calls).toEqual(['public:198.51.100.7:t100_60']);
    });

    /**
     * Cloudflare sets `CF-Connecting-IP` at the edge, overwriting whatever the
     * client sent, so a request on a public route always has one. Its absence
     * means a Service Binding in this same account — unreachable from outside.
     * Counting those against `'unknown'` IS BUG-044; they are limited per-user
     * instead.
     */
    it('skips the IP layer entirely for Service Binding traffic', async () => {
        const binding = fakeBinding([true, true]);
        const env = createMockEnv({ RL_PUBLIC: binding });
        const app = buildApp();

        // Exactly the shape both bots build: no CF-Connecting-IP.
        const res = await app.request(
            '/test',
            { headers: { 'X-User-Discord-ID': '111111111111111111' } },
            env
        );

        expect(res.status).toBe(200);
        expect(binding.calls).toEqual([]);
        expect(binding.calls).not.toContain('public:unknown:t100_60');
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

/**
 * The per-user layer: the half of BUG-044 that survives, moved to where the
 * identity it keys on has actually been proven.
 *
 * These drive the middleware behind a stub that sets `auth` the way
 * `authMiddleware` does, because what matters here is which value becomes the
 * bucket — not how auth reached it, which auth.test.ts already covers.
 */
describe('presets-api per-user rate limiter', () => {
    function buildUserApp(
        auth?: Partial<AuthContext>
    ): Hono<{ Bindings: Env; Variables: { auth: AuthContext } }> {
        const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
        if (auth) {
            app.use('*', async (c, next) => {
                c.set('auth', {
                    isAuthenticated: true,
                    isModerator: false,
                    authSource: 'bot',
                    ...auth,
                } as AuthContext);
                await next();
            });
        }
        app.use('*', createPerUserRateLimitMiddleware());
        app.get('/test', (c) => c.json({ success: true }));
        return app;
    }

    it('gives two bot users two buckets, not one shared `unknown`', async () => {
        const binding = fakeBinding([true, true, true, true]);
        const env = createMockEnv({ RL_PUBLIC: binding });

        await buildUserApp({ userDiscordId: '111111111111111111' }).request('/test', {}, env);
        await buildUserApp({ userDiscordId: '222222222222222222' }).request('/test', {}, env);

        // `user:` — not `public:` — so the two layers cannot share a counter
        // even though both run at (100, 60s) against the one RL_PUBLIC binding.
        expect(binding.calls).toEqual([
            'user:111111111111111111:t100_60',
            'user:222222222222222222:t100_60',
        ]);
    });

    it('buckets on the verified identity, NOT on the request header', async () => {
        const binding = fakeBinding([true]);
        const env = createMockEnv({ RL_PUBLIC: binding });

        // auth says one user; the header claims another. The header must lose.
        const app = buildUserApp({ userDiscordId: '111111111111111111' });
        await app.request(
            '/test',
            { headers: { 'X-User-Discord-ID': '999999999999999999' } },
            env
        );

        expect(binding.calls).toEqual(['user:111111111111111111:t100_60']);
    });

    it('returns 429 for one user without touching another', async () => {
        const binding = fakeBinding([false]);
        const env = createMockEnv({ RL_PUBLIC: binding });

        const res = await buildUserApp({ userDiscordId: '111111111111111111' }).request(
            '/test',
            {},
            env
        );

        expect(res.status).toBe(429);
    });

    it('passes an unauthenticated request straight through', async () => {
        // No `auth` on the context at all: nothing to bucket on, and the IP
        // layer ahead of authMiddleware has already counted it.
        const binding = fakeBinding([true]);
        const env = createMockEnv({ RL_PUBLIC: binding });

        const res = await buildUserApp().request('/test', {}, env);

        expect(res.status).toBe(200);
        expect(binding.calls).toEqual([]);
    });

    it('passes an authenticated request with no Discord id through', async () => {
        // A web JWT whose subject never resolved to a Discord id: authenticated,
        // but with no per-user bucket to name.
        const binding = fakeBinding([true]);
        const env = createMockEnv({ RL_PUBLIC: binding });

        const res = await buildUserApp({ authSource: 'web' }).request('/test', {}, env);

        expect(res.status).toBe(200);
        expect(binding.calls).toEqual([]);
    });
});
