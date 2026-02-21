/**
 * Rate Limit Middleware Tests
 *
 * REFACTOR-002: Tests updated to use shared package interface.
 * Tests now use the public adapter functions rather than mocking
 * internal KV state directly.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMockKV } from '@xivdyetools/test-utils';
import {
  checkRateLimit,
  incrementRateLimit,
  getRateLimitInfo,
  rateLimitMiddleware,
  resetRateLimiterInstance,
  RATE_LIMIT_CONFIGS,
  type RateLimitConfig,
} from './rate-limit.js';

describe('rate-limit', () => {
  let mockKV: ReturnType<typeof createMockKV> & KVNamespace<string>;

  beforeEach(() => {
    resetRateLimiterInstance(); // Reset singleton between tests
    mockKV = createMockKV() as ReturnType<typeof createMockKV> & KVNamespace<string>;
    vi.useFakeTimers();
    // Set a fixed time for consistent testing
    vi.setSystemTime(new Date('2024-01-15T12:30:30.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('RATE_LIMIT_CONFIGS', () => {
    it('should have command config with correct values', () => {
      expect(RATE_LIMIT_CONFIGS.command).toEqual({
        requestsPerMinute: 20,
        burstAllowance: 5,
      });
    });

    it('should have autocomplete config with correct values', () => {
      expect(RATE_LIMIT_CONFIGS.autocomplete).toEqual({
        requestsPerMinute: 60,
        burstAllowance: 10,
      });
    });
  });

  describe('checkRateLimit', () => {
    const testConfig: RateLimitConfig = {
      requestsPerMinute: 10,
      burstAllowance: 2,
    };

    it('should allow requests when under limit', async () => {
      const result = await checkRateLimit(mockKV, 'user123', 'command', testConfig);

      expect(result.allowed).toBe(true);
      // checkOnly returns remaining before this request
      expect(result.remaining).toBe(12); // 12 - 0 = 12
      expect(result.retryAfter).toBeUndefined();
    });

    it('should calculate correct remaining requests after increments', async () => {
      // Increment 5 times
      for (let i = 0; i < 5; i++) {
        await incrementRateLimit(mockKV, 'user123', 'command');
      }

      const result = await checkRateLimit(mockKV, 'user123', 'command', testConfig);

      expect(result.allowed).toBe(true);
      // remaining = limit - count
      expect(result.remaining).toBe(7); // 12 - 5 = 7
    });

    it('should deny requests when at limit', async () => {
      // Increment to limit (10 + 2 = 12)
      for (let i = 0; i < 12; i++) {
        await incrementRateLimit(mockKV, 'user123', 'command');
      }

      const result = await checkRateLimit(mockKV, 'user123', 'command', testConfig);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should deny requests when over limit', async () => {
      // Increment past limit
      for (let i = 0; i < 15; i++) {
        await incrementRateLimit(mockKV, 'user123', 'command');
      }

      const result = await checkRateLimit(mockKV, 'user123', 'command', testConfig);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should calculate correct reset time', async () => {
      const now = Date.now();
      // Reset time is aligned to window boundaries (next minute)
      const currentWindow = Math.floor(now / 60_000);
      const expectedResetTime = (currentWindow + 1) * 60_000;

      const result = await checkRateLimit(mockKV, 'user123', 'command', testConfig);

      expect(result.resetTime).toBe(expectedResetTime);
    });

    it('should handle config without burst allowance', async () => {
      const configNoBurst: RateLimitConfig = {
        requestsPerMinute: 10,
      };

      const result = await checkRateLimit(mockKV, 'user123', 'command', configNoBurst);

      expect(result.allowed).toBe(true);
      // remaining = limit - count
      expect(result.remaining).toBe(10); // 10 - 0 = 10
    });

    it('should calculate retryAfter correctly', async () => {
      // Fill up to limit
      for (let i = 0; i < 12; i++) {
        await incrementRateLimit(mockKV, 'user123', 'command');
      }

      const now = Date.now();
      const result = await checkRateLimit(mockKV, 'user123', 'command', testConfig);

      // retryAfter should be roughly 60 seconds (the window)
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });

    it('should fail open on KV error', async () => {
      const errorKV = {
        get: vi.fn().mockRejectedValue(new Error('KV error')),
        getWithMetadata: vi.fn().mockRejectedValue(new Error('KV error')),
      } as unknown as KVNamespace;

      const result = await checkRateLimit(errorKV, 'user123', 'command', testConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(12); // Returns effective limit on error
    });

    it('should handle autocomplete type', async () => {
      const result = await checkRateLimit(mockKV, 'user456', 'autocomplete', RATE_LIMIT_CONFIGS.autocomplete);

      expect(result.allowed).toBe(true);
      // remaining = limit - count
      expect(result.remaining).toBe(70); // 70 - 0 = 70
    });

    it('should track different users separately', async () => {
      // Increment user1 10 times
      for (let i = 0; i < 10; i++) {
        await incrementRateLimit(mockKV, 'user1', 'command');
      }
      // Increment user2 5 times
      for (let i = 0; i < 5; i++) {
        await incrementRateLimit(mockKV, 'user2', 'command');
      }

      const result1 = await checkRateLimit(mockKV, 'user1', 'command', testConfig);
      const result2 = await checkRateLimit(mockKV, 'user2', 'command', testConfig);

      // remaining = limit - count
      expect(result1.remaining).toBe(2); // 12 - 10 = 2
      expect(result2.remaining).toBe(7); // 12 - 5 = 7
    });

    it('should track different types separately', async () => {
      // Fill up command limit
      for (let i = 0; i < 12; i++) {
        await incrementRateLimit(mockKV, 'user123', 'command');
      }
      // Add some autocomplete requests
      for (let i = 0; i < 5; i++) {
        await incrementRateLimit(mockKV, 'user123', 'autocomplete');
      }

      const commandResult = await checkRateLimit(mockKV, 'user123', 'command', testConfig);
      const autocompleteResult = await checkRateLimit(mockKV, 'user123', 'autocomplete', RATE_LIMIT_CONFIGS.autocomplete);

      expect(commandResult.allowed).toBe(false); // Over limit
      expect(autocompleteResult.allowed).toBe(true); // Under limit
      // remaining = limit - count
      expect(autocompleteResult.remaining).toBe(65); // 70 - 5 = 65
    });
  });

  describe('incrementRateLimit', () => {
    it('should increment counter from 0', async () => {
      await incrementRateLimit(mockKV, 'user123', 'command');

      // Verify by checking the rate limit
      const result = await checkRateLimit(mockKV, 'user123', 'command', RATE_LIMIT_CONFIGS.command);
      // remaining = limit - count
      expect(result.remaining).toBe(24); // 25 - 1 = 24
    });

    it('should increment existing counter', async () => {
      await incrementRateLimit(mockKV, 'user123', 'command');
      await incrementRateLimit(mockKV, 'user123', 'command');

      const result = await checkRateLimit(mockKV, 'user123', 'command', RATE_LIMIT_CONFIGS.command);
      // remaining = limit - count
      expect(result.remaining).toBe(23); // 25 - 2 = 23
    });

    it('should set TTL on counter', async () => {
      const putSpy = vi.spyOn(mockKV, 'put');

      await incrementRateLimit(mockKV, 'user123', 'command');

      // Verify put was called with expirationTtl
      expect(putSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      );
    });

    it('should handle KV errors gracefully', async () => {
      const errorKV = {
        getWithMetadata: vi.fn().mockRejectedValue(new Error('KV error')),
        put: vi.fn().mockRejectedValue(new Error('KV error')),
      } as unknown as KVNamespace;

      // Should not throw
      await expect(incrementRateLimit(errorKV, 'user123', 'command', 1)).resolves.not.toThrow();
    });

    it('should use autocomplete type in key', async () => {
      await incrementRateLimit(mockKV, 'user123', 'autocomplete');

      const result = await checkRateLimit(mockKV, 'user123', 'autocomplete', RATE_LIMIT_CONFIGS.autocomplete);
      // remaining = limit - count
      expect(result.remaining).toBe(69); // 70 - 1 = 69
    });

    it('should increment version on subsequent calls', async () => {
      await incrementRateLimit(mockKV, 'user123', 'command');
      await incrementRateLimit(mockKV, 'user123', 'command');
      await incrementRateLimit(mockKV, 'user123', 'command');

      const result = await checkRateLimit(mockKV, 'user123', 'command', RATE_LIMIT_CONFIGS.command);
      // remaining = limit - count
      expect(result.remaining).toBe(22); // 25 - 3 = 22
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return current count of 0 for new users', async () => {
      const result = await getRateLimitInfo(mockKV, 'newuser', 'command');

      expect(result.current).toBe(0);
      expect(result.limit).toBe(25); // 20 + 5
    });

    it('should return current count after increments', async () => {
      for (let i = 0; i < 7; i++) {
        await incrementRateLimit(mockKV, 'user123', 'command');
      }

      const result = await getRateLimitInfo(mockKV, 'user123', 'command');

      expect(result.current).toBe(7);
    });

    it('should return correct limit for command type', async () => {
      const result = await getRateLimitInfo(mockKV, 'user123', 'command');

      expect(result.limit).toBe(25); // 20 + 5
    });

    it('should return correct limit for autocomplete type', async () => {
      const result = await getRateLimitInfo(mockKV, 'user123', 'autocomplete');

      expect(result.limit).toBe(70); // 60 + 10
    });

    it('should return correct reset time', async () => {
      const now = Date.now();
      // Reset time is aligned to window boundaries (next minute)
      const currentWindow = Math.floor(now / 60_000);
      const expectedResetTime = (currentWindow + 1) * 60_000;

      const result = await getRateLimitInfo(mockKV, 'user123', 'command');

      expect(result.resetTime).toBe(expectedResetTime);
    });

    it('should handle KV errors gracefully', async () => {
      const errorKV = {
        get: vi.fn().mockRejectedValue(new Error('KV error')),
        getWithMetadata: vi.fn().mockRejectedValue(new Error('KV error')),
      } as unknown as KVNamespace;

      const result = await getRateLimitInfo(errorKV, 'user123', 'command');

      expect(result.current).toBe(0);
      expect(result.limit).toBe(25); // 20 + 5
    });
  });

  describe('rateLimitMiddleware', () => {
    it('should pass through to next middleware', async () => {
      const mockContext = {
        env: {},
      } as unknown as Parameters<typeof rateLimitMiddleware>[0];
      const next = vi.fn().mockResolvedValue(undefined);

      await rateLimitMiddleware(mockContext, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
