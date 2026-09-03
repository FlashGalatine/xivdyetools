/**
 * MemoryRateLimiter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRateLimiter } from './memory.js';
import type { RateLimitConfig } from '../types.js';

describe('MemoryRateLimiter', () => {
  let limiter: MemoryRateLimiter;
  const defaultConfig: RateLimitConfig = {
    maxRequests: 5,
    windowMs: 60_000, // 1 minute
  };

  beforeEach(() => {
    limiter = new MemoryRateLimiter();
    vi.useFakeTimers();
  });

  describe('check()', () => {
    it('allows requests under the limit', async () => {
      const result = await limiter.check('user1', defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1 = 4
      expect(result.limit).toBe(5);
    });

    it('denies requests over the limit', async () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
      }

      // 6th request should be denied
      const result = await limiter.check('user1', defaultConfig);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('tracks different keys independently', async () => {
      // Fill up user1's limit
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
      }

      // user2 should still have full allowance
      const result = await limiter.check('user2', defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('resets after window expires', async () => {
      // Fill up the limit
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
      }

      // Verify denied
      let result = await limiter.check('user1', defaultConfig);
      expect(result.allowed).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(60_001);

      // Should be allowed again
      result = await limiter.check('user1', defaultConfig);
      expect(result.allowed).toBe(true);
    });

    it('calculates resetAt correctly', async () => {
      const now = Date.now();
      const result = await limiter.check('user1', defaultConfig);

      // resetAt should be approximately windowMs from now
      expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(now);
      expect(result.resetAt.getTime()).toBeLessThanOrEqual(
        now + defaultConfig.windowMs + 100
      );
    });
  });

  describe('burst allowance', () => {
    it('allows burst requests beyond base limit', async () => {
      const configWithBurst: RateLimitConfig = {
        maxRequests: 5,
        windowMs: 60_000,
        burstAllowance: 3,
      };

      // Make 7 requests (5 base + 2 burst)
      for (let i = 0; i < 7; i++) {
        const result = await limiter.check('user1', configWithBurst);
        expect(result.allowed).toBe(true);
      }

      // 8th request (last of burst)
      const result = await limiter.check('user1', configWithBurst);
      expect(result.allowed).toBe(true);

      // 9th request should be denied (over 5 + 3 = 8)
      const denied = await limiter.check('user1', configWithBurst);
      expect(denied.allowed).toBe(false);
    });

    it('reports correct limit with burst', async () => {
      const configWithBurst: RateLimitConfig = {
        maxRequests: 5,
        windowMs: 60_000,
        burstAllowance: 3,
      };

      const result = await limiter.check('user1', configWithBurst);
      expect(result.limit).toBe(8); // 5 + 3
    });
  });

  describe('reset()', () => {
    it('resets rate limit for a specific key', async () => {
      // Fill up limit
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
      }

      // Verify denied
      let result = await limiter.check('user1', defaultConfig);
      expect(result.allowed).toBe(false);

      // Reset
      await limiter.reset('user1');

      // Should be allowed again
      result = await limiter.check('user1', defaultConfig);
      expect(result.allowed).toBe(true);
    });

    it('does not affect other keys', async () => {
      // Use some allowance for both users
      await limiter.check('user1', defaultConfig);
      await limiter.check('user2', defaultConfig);

      // Reset only user1
      await limiter.reset('user1');

      // user1 should have full allowance, user2 should have used one
      const result1 = await limiter.check('user1', defaultConfig);
      const result2 = await limiter.check('user2', defaultConfig);

      expect(result1.remaining).toBe(4); // Fresh start
      expect(result2.remaining).toBe(3); // Had 4, now 3
    });
  });

  describe('resetAll()', () => {
    it('resets all rate limits', async () => {
      // Fill up limits for multiple users
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
        await limiter.check('user2', defaultConfig);
      }

      // Verify both denied
      expect((await limiter.check('user1', defaultConfig)).allowed).toBe(false);
      expect((await limiter.check('user2', defaultConfig)).allowed).toBe(false);

      // Reset all
      await limiter.resetAll();

      // Both should be allowed again
      expect((await limiter.check('user1', defaultConfig)).allowed).toBe(true);
      expect((await limiter.check('user2', defaultConfig)).allowed).toBe(true);
    });
  });

  describe('LRU eviction (PRESETS-BUG-001)', () => {
    it('evicts oldest entries when maxEntries exceeded', async () => {
      const smallLimiter = new MemoryRateLimiter({ maxEntries: 10 });

      // Add more entries than maxEntries
      for (let i = 0; i < 15; i++) {
        await smallLimiter.check(`user${i}`, defaultConfig);
      }

      // Size should be less than or equal to maxEntries
      expect(smallLimiter.size).toBeLessThanOrEqual(10);
    });
  });

  describe('deterministic cleanup', () => {
    it('triggers cleanup after cleanupInterval requests', async () => {
      const limiterWithFastCleanup = new MemoryRateLimiter({
        cleanupInterval: 5,
      });

      // Make some requests
      await limiterWithFastCleanup.check('user1', defaultConfig);

      // Advance time so entries are stale
      vi.advanceTimersByTime(defaultConfig.windowMs * 3);

      // Make enough requests to trigger cleanup
      for (let i = 0; i < 5; i++) {
        await limiterWithFastCleanup.check(`temp${i}`, defaultConfig);
      }

      // pkg-worker-kit-test-utils-03: this used to assert only that a later
      // check still returned `allowed: true`, with the comment "we just verify
      // no errors occur". After advancing 3 windows the stale stamp is outside
      // the window anyway, so that held whether cleanup ran, ran with the wrong
      // cutoff, or never ran at all. Assert the key was actually DELETED.
      // 6 keys were touched; only the 5 fresh ones may remain.
      expect(limiterWithFastCleanup.size).toBe(5);

      const result = await limiterWithFastCleanup.check('user1', defaultConfig);
      expect(result.allowed).toBe(true);
    });

    // BUG-023's per-key cutoff, made falsifiable: cleanup triggered by
    // short-window keys must not purge a long-window key's history. A cleanup
    // using a single global (or the current request's) window would drop the
    // hourly stamp here, because 5 minutes is well past 2x60s.
    it('does not purge a long-window key when short-window keys trigger cleanup', async () => {
      const shared = new MemoryRateLimiter({ cleanupInterval: 5 });
      const hour: RateLimitConfig = { maxRequests: 2, windowMs: 3_600_000 };

      await shared.check('hourly', hour);
      vi.advanceTimersByTime(300_000); // 5 minutes

      for (let i = 0; i < 5; i++) {
        await shared.check(`burst${i}`, defaultConfig); // 60s window
      }

      // The hourly key survived cleanup AND kept its stamp, so this is its
      // second request of the hour and the third must be denied.
      expect((await shared.check('hourly', hour)).allowed).toBe(true);
      expect((await shared.check('hourly', hour)).allowed).toBe(false);
    });
  });

  describe('mixed windows on one key (BUG-097)', () => {
    // check() filtered the array it WROTE BACK with the current request's
    // windowMs, so a narrow-window check erased history a wide-window check was
    // still counting -- defeating, inside check() itself, the per-key cutoff
    // BUG-023 gave cleanupOldEntries().
    it('keeps history a wider window still needs when a narrower one checks the same key', async () => {
      const hour: RateLimitConfig = { maxRequests: 2, windowMs: 3_600_000 };
      const minute: RateLimitConfig = { maxRequests: 100, windowMs: 60_000 };

      // First request against the hour budget.
      expect((await limiter.check('k', hour)).allowed).toBe(true);

      // A minute later, a wide-open per-minute check on the SAME key. Filtering
      // the stored array with this request's 60s window drops the hour budget's
      // only stamp.
      vi.advanceTimersByTime(61_000);
      expect((await limiter.check('k', minute)).allowed).toBe(true);

      // Two requests have now landed inside the hour, so the third is over the
      // hour budget of 2. Before the fix this was allowed -- three requests
      // admitted inside one hour on a bucket the hour config limits to two.
      vi.advanceTimersByTime(1);
      expect((await limiter.check('k', hour)).allowed).toBe(false);
    });

    it('still expires a stamp once the widest window has passed', async () => {
      const hour: RateLimitConfig = { maxRequests: 1, windowMs: 3_600_000 };

      expect((await limiter.check('k', hour)).allowed).toBe(true);
      expect((await limiter.check('k', hour)).allowed).toBe(false);

      // Past the hour: retention is bounded, not unbounded.
      vi.advanceTimersByTime(3_600_001);
      expect((await limiter.check('k', hour)).allowed).toBe(true);
    });
  });
});
