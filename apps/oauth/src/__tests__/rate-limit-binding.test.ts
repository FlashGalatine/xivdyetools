/**
 * Rate limiter backend selection (FINDING-003, 2026-08-21 security audit).
 *
 * When the native Workers Rate Limiting bindings are present they must be
 * used for /auth/* limiting; KV (which cannot throttle a fast client) is only a
 * fallback when they are not, and memory only when neither is bound.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, getClientIp, resetRateLimiter } from '../services/rate-limit.js';

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

/** A binding whose `limit()` always throws — the native binding's own failure mode. */
function throwingBinding(): RateLimit {
    return {
        limit: async () => {
            throw new Error('binding unavailable');
        },
    } as unknown as RateLimit;
}

function fakeKV(): KVNamespace & { puts: number } {
    const kv = {
        puts: 0,
        get: vi.fn(async () => null),
        put: vi.fn(async () => {
            kv.puts++;
        }),
        delete: vi.fn(async () => {}),
        list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    };
    return kv as unknown as KVNamespace & { puts: number };
}

describe('oauth rate limiter backend selection', () => {
    it('shares the captured native budget across IPv6 hosts in one /64 only', async () => {
        await resetRateLimiter();
        const counts = new Map<string, number>();
        const calls: string[] = [];
        const binding = {
            limit: async ({ key }: { key: string }) => {
                calls.push(key);
                const count = (counts.get(key) ?? 0) + 1;
                counts.set(key, count);
                return { success: count <= 10 };
            },
        } as unknown as RateLimit;
        const backends = { cloudflare: [{ limit: 10, binding }] };
        const check = (address: string) => checkRateLimit(getClientIp(new Request('http://localhost/', {
            headers: { 'CF-Connecting-IP': address, 'X-Forwarded-For': '203.0.113.99' },
        })), '/auth/discord', backends);

        for (let i = 0; i < 10; i++) {
            expect((await check(i % 2 ? '2001:0db8:1234:5678:0:0:0:1' : '2001:db8:1234:5678::abcd')).allowed).toBe(true);
        }
        expect((await check('2001:db8:1234:5678::ffff')).allowed).toBe(false);
        expect(calls).toEqual(Array(11).fill('rl:2001:db8:1234:5678:::/auth/discord:t10_60'));
        expect((await check('2001:db8:1234:5679::1')).allowed).toBe(true);
        expect(calls[11]).toBe('rl:2001:db8:1234:5679:::/auth/discord:t10_60');
        for (let i = 0; i < 10; i++) expect((await check('::ffff:198.51.100.7')).allowed).toBe(true);
        expect((await check('198.51.100.7')).allowed).toBe(false);
        expect((await check('::ffff:198.51.100.8')).allowed).toBe(true);
        expect(calls.slice(12, 23)).toEqual(Array(11).fill('rl:198.51.100.7:/auth/discord:t10_60'));
        expect(calls[23]).toBe('rl:198.51.100.8:/auth/discord:t10_60');
    });

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-21T12:00:00Z'));
        await resetRateLimiter();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('routes /auth/discord (10/min) to the 10-tier binding and denies when it says no', async () => {
        const t10 = fakeBinding([true, false]);
        const t20 = fakeBinding([true]);
        const t30 = fakeBinding([true]);
        const kv = fakeKV();

        const backends = {
            kv,
            cloudflare: [
                { limit: 10, binding: t10 },
                { limit: 20, binding: t20 },
                { limit: 30, binding: t30 },
            ],
        };

        const first = await checkRateLimit('198.51.100.7', '/auth/discord', backends);
        const second = await checkRateLimit('198.51.100.7', '/auth/discord', backends);

        expect(first.allowed).toBe(true);
        expect(first.limit).toBe(10);
        expect(second.allowed).toBe(false);
        // pkg-worker-kit-test-utils-05: the binding key now carries the tier's
        // (limit, period). Before that, two tiers pointed at the same binding
        // shared one counter across two different configs -- the key was
        // `keyPrefix + key` while a source comment claimed it was tier-scoped.
        expect(t10.calls).toEqual([
          'rl:198.51.100.7:/auth/discord:t10_60',
          'rl:198.51.100.7:/auth/discord:t10_60',
        ]);
        expect(t20.calls).toHaveLength(0);
        expect(t30.calls).toHaveLength(0);
        expect(kv.puts).toBe(0);
    });

    it('routes /auth/callback (20/min) to the 20-tier binding', async () => {
        const t10 = fakeBinding([true]);
        const t20 = fakeBinding([true]);
        const t30 = fakeBinding([true]);
        await checkRateLimit('198.51.100.7', '/auth/callback', {
            cloudflare: [
                { limit: 10, binding: t10 },
                { limit: 20, binding: t20 },
                { limit: 30, binding: t30 },
            ],
        });
        expect(t20.calls).toHaveLength(1);
        expect(t10.calls).toHaveLength(0);
    });

    it('falls back to KV when no binding tiers are supplied', async () => {
        const kv = fakeKV();
        const result = await checkRateLimit('198.51.100.8', '/auth/discord', { kv });
        expect(result.allowed).toBe(true);
        expect(kv.puts).toBe(1);
    });

    it('keeps the legacy memory path when neither bindings nor KV are supplied', async () => {
        const result = await checkRateLimit('198.51.100.9', '/auth/discord');
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(10);
    });

    /**
     * FINDING-012 (2026-08-29 security audit): CloudflareRateLimiter fails
     * open on a throwing binding (the accepted trade-off) but the fail-open
     * event used to be invisible — no consumer passed it a logger and
     * `backendError` was dropped by the caller. `checkRateLimit()`'s result
     * must surface it so `index.ts`'s per-request middleware (which owns the
     * request-scoped logger the per-isolate limiter singleton cannot hold)
     * can log it.
     */
    describe('backendError propagation (FINDING-012)', () => {
        it('surfaces backendError: true when the selected tier binding throws', async () => {
            const result = await checkRateLimit('198.51.100.10', '/auth/discord', {
                cloudflare: [{ limit: 10, binding: throwingBinding() }],
            });

            expect(result.allowed).toBe(true); // fail-open: the request is still served
            expect(result.backendError).toBe(true);
        });

        it('does not set backendError for a healthy binding', async () => {
            const result = await checkRateLimit('198.51.100.11', '/auth/discord', {
                cloudflare: [{ limit: 10, binding: fakeBinding([true]) }],
            });

            expect(result.allowed).toBe(true);
            expect(result.backendError).toBeUndefined();
        });
    });
});
