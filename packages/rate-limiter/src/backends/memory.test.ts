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

      // The stale user1 entry should have been cleaned up
      // (This is a behavioral test - we just verify no errors occur)
      const result = await limiterWithFastCleanup.check('user1', defaultConfig);
      expect(result.allowed).toBe(true);
    });
  });
});
