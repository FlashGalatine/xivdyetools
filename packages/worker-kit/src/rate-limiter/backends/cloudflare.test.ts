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
    expect(binding.calls[0]).toBe('api:ip:1.2.3.4');
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
    expect(t10.calls).toEqual(['k']);
    expect(t30.calls).toEqual(['k']);
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
});
