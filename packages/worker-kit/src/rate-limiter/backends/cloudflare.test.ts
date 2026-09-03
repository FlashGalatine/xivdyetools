/**
 * Tests for CloudflareRateLimiter — the native Workers Rate Limiting binding
 * backend (FINDING-003, 2026-08-21 security audit).
 *
 * The binding itself is a black box (`limit({ key }) → { success }`), so these
 * tests drive the backend with a scripted fake binding and assert on tier
 * selection, key scoping, result shape, and the fail-open / fail-closed
 * contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudflareRateLimiter, type RateLimitBinding } from './cloudflare.js';

function fakeBinding(outcomes: boolean[] | (() => Promise<{ success: boolean }>)) {
  const calls: string[] = [];
  let i = 0;
  const binding: RateLimitBinding & { calls: string[] } = {
    calls,
    limit: async ({ key }) => {
      calls.push(key);
      if (typeof outcomes === 'function') return outcomes();
      const success = outcomes[Math.min(i, outcomes.length - 1)];
      i++;
      return { success };
    },
  };
  return binding;
}

describe('CloudflareRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows while the binding reports success and denies once it does not', async () => {
    const binding = fakeBinding([true, true, false]);
    const limiter = new CloudflareRateLimiter({ tiers: [{ limit: 2, binding }] });
    const config = { maxRequests: 2, windowMs: 60_000 };

    const first = await limiter.check('1.2.3.4', config);
    const second = await limiter.check('1.2.3.4', config);
    const third = await limiter.check('1.2.3.4', config);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
    expect(third.limit).toBe(2);
    expect(binding.calls).toHaveLength(3);
  });

  it('scopes the binding key with the optional keyPrefix', async () => {
    const binding = fakeBinding([true]);
    const limiter = new CloudflareRateLimiter({
      tiers: [{ limit: 10, binding }],
      keyPrefix: 'api:ip:',
    });
    await limiter.check('1.2.3.4', { maxRequests: 10, windowMs: 60_000 });
    expect(binding.calls[0]).toBe('api:ip:1.2.3.4:t10_60');
  });

  it('picks the smallest tier that can hold the configured effective limit', async () => {
    const t10 = fakeBinding([true]);
    const t20 = fakeBinding([true]);
    const t30 = fakeBinding([true]);
    const limiter = new CloudflareRateLimiter({
      tiers: [
        { limit: 30, binding: t30 },
        { limit: 10, binding: t10 },
        { limit: 20, binding: t20 },
      ],
    });

    // 15 + 5 burst = 20 → the 20 tier, not 30
    await limiter.check('k', { maxRequests: 15, windowMs: 60_000, burstAllowance: 5 });
    expect(t20.calls).toHaveLength(1);
    expect(t10.calls).toHaveLength(0);
    expect(t30.calls).toHaveLength(0);

    // 10 → the 10 tier
    await limiter.check('k', { maxRequests: 10, windowMs: 60_000 });
    expect(t10.calls).toHaveLength(1);
  });

  it('falls back to the largest tier when no tier is big enough (and reports that limit)', async () => {
    const t10 = fakeBinding([true]);
    const t30 = fakeBinding([true]);
    const limiter = new CloudflareRateLimiter({
      tiers: [
        { limit: 10, binding: t10 },
        { limit: 30, binding: t30 },
      ],
    });
    const result = await limiter.check('k', { maxRequests: 100, windowMs: 60_000 });
    expect(t30.calls).toHaveLength(1);
    expect(result.limit).toBe(30);
  });

  // pkg-worker-kit-test-utils-05: this test used to assert the OPPOSITE of its
  // own name -- both bindings received the identical key `'k'`, and the
  // separation it claimed to prove came entirely from the two tiers being
  // distinct binding objects. The key now carries the tier's (limit, period),
  // so the claim is the one actually under test.
  it('keys different tiers apart so a client cannot share one bucket across two configs', async () => {
    const t10 = fakeBinding([true]);
    const t30 = fakeBinding([true]);
    const limiter = new CloudflareRateLimiter({
      tiers: [
        { limit: 10, binding: t10 },
        { limit: 30, binding: t30 },
      ],
    });
    await limiter.check('k', { maxRequests: 10, windowMs: 60_000 });
    await limiter.check('k', { maxRequests: 30, windowMs: 60_000 });
    expect(t10.calls).toEqual(['k:t10_60']);
    expect(t30.calls).toEqual(['k:t30_60']);
    expect(t10.calls[0]).not.toBe(t30.calls[0]);
  });

  // The failure mode the previous test could not see: one binding wired to two
  // tiers (a plausible wrangler / tier-table typo) used to collapse a 10-limit
  // and a 30-limit config onto a single counter.
  it('separates two tiers that share one binding, by key', async () => {
    const shared = fakeBinding([true, true]);
    const limiter = new CloudflareRateLimiter({
      tiers: [
        { limit: 10, binding: shared },
        { limit: 30, binding: shared },
      ],
    });
    await limiter.check('k', { maxRequests: 10, windowMs: 60_000 });
    await limiter.check('k', { maxRequests: 30, windowMs: 60_000 });
    expect(shared.calls).toEqual(['k:t10_60', 'k:t30_60']);
  });

  // pkg-worker-kit-test-utils-06: selectTier matched on `limit` alone, so a
  // 60s config could be enforced by a 10s tier -- 6x the intended rate, with a
  // `resetAt` from the 10s period that makes the headers look self-consistent.
  it('selects a tier by period as well as limit', async () => {
    const fast = fakeBinding([true]);
    const slow = fakeBinding([true]);
    const limiter = new CloudflareRateLimiter({
      tiers: [
        { limit: 10, periodSeconds: 10, binding: fast },
        { limit: 30, periodSeconds: 60, binding: slow },
      ],
    });

    // limit-only matching picks the 10/10s tier here; the config asks for 60s.
    const result = await limiter.check('k', { maxRequests: 10, windowMs: 60_000 });
    expect(fast.calls).toHaveLength(0);
    expect(slow.calls).toEqual(['k:t30_60']);
    expect(result.limit).toBe(30);

    // A config that really does want the 10s period still reaches it.
    await limiter.check('k', { maxRequests: 10, windowMs: 10_000 });
    expect(fast.calls).toEqual(['k:t10_10']);
  });

  it('falls back to limit-only matching when no tier covers the window', async () => {
    const t10 = fakeBinding([true]);
    const limiter = new CloudflareRateLimiter({
      tiers: [{ limit: 10, periodSeconds: 10, binding: t10 }],
    });
    const result = await limiter.check('k', { maxRequests: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(t10.calls).toEqual(['k:t10_10']);
  });

  it('fails open with backendError when the binding throws and failOpen is not false', async () => {
    const binding = fakeBinding(async () => {
      throw new Error('binding unavailable');
    });
    const warn = vi.fn();
    const limiter = new CloudflareRateLimiter({
      tiers: [{ limit: 10, binding }],
      logger: { warn, error: vi.fn() },
    });
    const result = await limiter.check('k', { maxRequests: 10, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.backendError).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('FINDING-010: logs the key scope on fail-open, never the raw key or bindingKey', async () => {
    const binding = fakeBinding(async () => {
      throw new Error('binding unavailable');
    });
    const warn = vi.fn();
    const limiter = new CloudflareRateLimiter({
      tiers: [{ limit: 10, binding }],
      keyPrefix: 'public:ip:',
      logger: { warn, error: vi.fn() },
    });
    await limiter.check('1.2.3.4', { maxRequests: 10, windowMs: 60_000 });

    expect(warn).toHaveBeenCalledTimes(1);
    const [, context] = warn.mock.calls[0] as [string, Record<string, unknown>];
    // A test that only asserted `warn` fired would still pass if the
    // redaction were reverted — assert the value is gone, not merely that a
    // warning happened.
    expect(context.key).toBeUndefined();
    expect(JSON.stringify(context)).not.toContain('1.2.3.4');
    expect(context.keyScope).toBe('public:ip');
  });

  it('FINDING-012: falls back to console.warn (redacted) when no logger is supplied', async () => {
    // Before this sprint, `this.logger?.warn(...)` alone meant a limiter
    // built without a logger fell open on a binding error with NO signal
    // anywhere — exactly the state oauth and moderation-worker were in
    // before their own Sprint 2/4 fixes.
    const binding = fakeBinding(async () => {
      throw new Error('binding unavailable');
    });
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const limiter = new CloudflareRateLimiter({
      tiers: [{ limit: 10, binding }],
      keyPrefix: 'api:ip:',
    });

    const result = await limiter.check('5.6.7.8', { maxRequests: 10, windowMs: 60_000 });

    expect(result.backendError).toBe(true);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [message, context] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toBe('Rate limiter fail-open: rate-limit binding error, allowing request');
    expect(context.key).toBeUndefined();
    expect(context.keyScope).toBe('api:ip');
    consoleSpy.mockRestore();
  });

  it('throws when the binding throws and failOpen is false (caller decides)', async () => {
    const binding = fakeBinding(async () => {
      throw new Error('binding unavailable');
    });
    const limiter = new CloudflareRateLimiter({ tiers: [{ limit: 10, binding }] });
    await expect(
      limiter.check('k', { maxRequests: 10, windowMs: 60_000, failOpen: false }),
    ).rejects.toThrow('binding unavailable');
  });

  it('checkOnly consumes a slot (the binding has no peek) and increment is a no-op', async () => {
    const binding = fakeBinding([true, true]);
    const limiter = new CloudflareRateLimiter({ tiers: [{ limit: 10, binding }] });
    const config = { maxRequests: 10, windowMs: 60_000 };
    await limiter.checkOnly('k', config);
    await limiter.increment('k', config);
    expect(binding.calls).toHaveLength(1);
  });

  it('reports resetAt at the end of the current period', async () => {
    const binding = fakeBinding([true]);
    const limiter = new CloudflareRateLimiter({ tiers: [{ limit: 10, binding, periodSeconds: 60 }] });
    const result = await limiter.check('k', { maxRequests: 10, windowMs: 60_000 });
    // 12:00:00 → next 60 s boundary is 12:01:00
    expect(result.resetAt.toISOString()).toBe('2026-08-21T12:01:00.000Z');
  });

  it('rejects construction with no tiers', () => {
    expect(() => new CloudflareRateLimiter({ tiers: [] })).toThrow();
  });

  describe('FINDING-012: binding validation at construction', () => {
    it('throws when a tier binding has no callable limit()', () => {
      const brokenBinding = {} as RateLimitBinding;
      expect(
        () => new CloudflareRateLimiter({ tiers: [{ limit: 10, binding: brokenBinding }] }),
      ).toThrow(/binding\.limit/);
    });

    it('throws when a tier binding has a non-function limit property', () => {
      const wrongShape = { limit: 42 } as unknown as RateLimitBinding;
      expect(
        () => new CloudflareRateLimiter({ tiers: [{ limit: 10, binding: wrongShape }] }),
      ).toThrow(/binding\.limit/);
    });

    it('throws naming the offending tier when only one of several tiers is broken', () => {
      const good = fakeBinding([true]);
      const broken = {} as RateLimitBinding;
      expect(
        () =>
          new CloudflareRateLimiter({
            tiers: [
              { limit: 10, binding: good },
              { limit: 30, binding: broken },
            ],
          }),
      ).toThrow(/limit=30/);
    });

    it('still constructs normally when every tier has a callable limit()', () => {
      const binding = fakeBinding([true]);
      expect(() => new CloudflareRateLimiter({ tiers: [{ limit: 10, binding }] })).not.toThrow();
    });
  });
});
