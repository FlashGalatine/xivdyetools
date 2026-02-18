/**
 * KVRateLimiter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KVRateLimiter } from './kv.js';
import type { RateLimitConfig, RateLimiterLogger } from '../types.js';

/**
 * Create a mock logger for testing
 */
function createMockLogger(): RateLimiterLogger & {
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return {
    warn: vi.fn(),
    error: vi.fn(),
  };
}

/**
 * Mock KVNamespace for testing
 */
function createMockKV(): KVNamespace {
  const store = new Map<string, { value: string; metadata?: unknown }>();

  return {
    get: vi.fn(async (key: string) => {
      return store.get(key)?.value ?? null;
    }),
    getWithMetadata: vi.fn(async (key: string) => {
      const entry = store.get(key);
      return {
        value: entry?.value ?? null,
        metadata: entry?.metadata ?? null,
      };
    }),
    put: vi.fn(
      async (
        key: string,
        value: string,
        options?: { expirationTtl?: number; metadata?: unknown }
      ) => {
        store.set(key, { value, metadata: options?.metadata });
      }
    ),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (options?: { prefix?: string }) => {
      const keys: { name: string }[] = [];
      store.forEach((_, key) => {
        if (!options?.prefix || key.startsWith(options.prefix)) {
          keys.push({ name: key });
        }
      });
      return { keys, list_complete: true, cursor: '' };
    }),
  } as unknown as KVNamespace;
}

describe('KVRateLimiter', () => {
  let mockKV: KVNamespace;
  let limiter: KVRateLimiter;
  const defaultConfig: RateLimitConfig = {
    maxRequests: 5,
    windowMs: 60_000,
  };

  beforeEach(() => {
    mockKV = createMockKV();
    limiter = new KVRateLimiter({ kv: mockKV });
    vi.useFakeTimers();
  });

  describe('check()', () => {
    it('allows requests under the limit', async () => {
      const result = await limiter.check('user1', defaultConfig);

      expect(result.allowed).toBe(true);
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
    });

    it('tracks different keys independently', async () => {
      // Fill up user1's limit
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
      }

      // user2 should still have full allowance
      const result = await limiter.check('user2', defaultConfig);

      expect(result.allowed).toBe(true);
    });
  });

  describe('checkOnly()', () => {
    it('does not increment the counter', async () => {
      // Check multiple times with checkOnly
      await limiter.checkOnly('user1', defaultConfig);
      await limiter.checkOnly('user1', defaultConfig);
      await limiter.checkOnly('user1', defaultConfig);

      // All should be allowed since we didn't increment
      const result = await limiter.checkOnly('user1', defaultConfig);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // Still first request
    });
  });

  describe('increment()', () => {
    it('increments the counter', async () => {
      // Increment without checking first
      await limiter.increment('user1', defaultConfig);
      await limiter.increment('user1', defaultConfig);

      // Check should show 2 requests made
      const result = await limiter.checkOnly('user1', defaultConfig);
      expect(result.remaining).toBe(2); // 5 - 2 - 1 = 2
    });
  });

  describe('fail-open behavior', () => {
    it('allows request on KV error when failOpen is true', async () => {
      // Make KV throw an error
      vi.mocked(mockKV.get).mockRejectedValueOnce(new Error('KV error'));

      const result = await limiter.checkOnly('user1', {
        ...defaultConfig,
        failOpen: true,
      });

      expect(result.allowed).toBe(true);
      expect(result.backendError).toBe(true);
    });

    it('allows request on KV error by default', async () => {
      vi.mocked(mockKV.get).mockRejectedValueOnce(new Error('KV error'));

      const result = await limiter.checkOnly('user1', defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.backendError).toBe(true);
    });

    it('throws on KV error when failOpen is false', async () => {
      vi.mocked(mockKV.get).mockRejectedValueOnce(new Error('KV error'));

      await expect(
        limiter.checkOnly('user1', { ...defaultConfig, failOpen: false })
      ).rejects.toThrow('KV error');
    });
  });

  describe('burst allowance', () => {
    it('allows burst requests beyond base limit', async () => {
      const configWithBurst: RateLimitConfig = {
        maxRequests: 5,
        windowMs: 60_000,
        burstAllowance: 3,
      };

      // Make 8 requests (5 base + 3 burst)
      for (let i = 0; i < 8; i++) {
        const result = await limiter.check('user1', configWithBurst);
        expect(result.allowed).toBe(true);
      }

      // 9th request should be denied
      const result = await limiter.check('user1', configWithBurst);
      expect(result.allowed).toBe(false);
    });
  });

  describe('reset()', () => {
    it('resets rate limit for a specific key', async () => {
      // Fill up limit
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
      }

      // Reset
      await limiter.reset('user1');

      // Should be allowed again
      const result = await limiter.check('user1', defaultConfig);
      expect(result.allowed).toBe(true);
    });
  });

  describe('resetAll()', () => {
    it('resets all rate limits', async () => {
      // Fill up limits
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
        await limiter.check('user2', defaultConfig);
      }

      // Reset all
      await limiter.resetAll();

      // Both should be allowed again
      const result1 = await limiter.check('user1', defaultConfig);
      const result2 = await limiter.check('user2', defaultConfig);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('key prefix', () => {
    it('uses custom key prefix', async () => {
      const customLimiter = new KVRateLimiter({
        kv: mockKV,
        keyPrefix: 'custom:',
      });

      await customLimiter.check('user1', defaultConfig);

      // Verify the key prefix was used
      expect(mockKV.get).toHaveBeenCalledWith(
        expect.stringContaining('custom:user1|')
      );
    });
  });

  describe('logger integration', () => {
    it('logs warning on fail-open event', async () => {
      const mockLogger = createMockLogger();
      const loggedLimiter = new KVRateLimiter({
        kv: mockKV,
        logger: mockLogger,
      });

      // Make KV throw an error
      vi.mocked(mockKV.get).mockRejectedValueOnce(new Error('KV unavailable'));

      const result = await loggedLimiter.checkOnly('user1', defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.backendError).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rate limiter fail-open: KV read error, allowing request',
        expect.objectContaining({
          key: 'user1',
          operation: 'checkOnly',
          error: 'KV unavailable',
        })
      );
    });

    it('logs error on increment failure after retries', async () => {
      const mockLogger = createMockLogger();
      const loggedLimiter = new KVRateLimiter({
        kv: mockKV,
        logger: mockLogger,
        maxRetries: 2, // Reduce retries for faster test
      });

      // Make KV operations fail
      vi.mocked(mockKV.getWithMetadata).mockRejectedValue(
        new Error('KV write failed')
      );

      await loggedLimiter.increment('user1', defaultConfig);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Rate limiter KV increment failed after retries',
        expect.any(Error),
        expect.objectContaining({
          key: 'user1',
          operation: 'increment',
          attempts: 2,
          maxRetries: 2,
        })
      );
    });

    it('does not log when no logger is provided', async () => {
      // Use limiter without logger (default behavior)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(mockKV.getWithMetadata).mockRejectedValue(
        new Error('KV write failed')
      );

      await limiter.increment('user1', defaultConfig);

      // Should fall back to console.error
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
