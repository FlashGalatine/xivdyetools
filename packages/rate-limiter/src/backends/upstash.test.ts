/**
 * Tests for UpstashRateLimiter
 *
 * Mocks @upstash/redis to test all branches:
 * - Successful check (allowed and denied)
 * - Burst allowance
 * - Fail-open on Redis errors
 * - Fail-closed when failOpen is false
 * - reset() and resetAll()
 * - Custom key prefix
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { RateLimitConfig, RateLimiterLogger } from '../types.js';

// Mock @upstash/redis
const mockPipeline = {
  incr: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const mockRedis = {
  pipeline: vi.fn(() => mockPipeline),
  del: vi.fn().mockResolvedValue(1),
  scan: vi.fn(),
};

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    pipeline = mockRedis.pipeline;
    del = mockRedis.del;
    scan = mockRedis.scan;
    constructor() {
      // capture constructor calls
    }
  },
}));

import { UpstashRateLimiter } from './upstash.js';

function createMockLogger(): RateLimiterLogger & {
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return {
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('UpstashRateLimiter', () => {
  let limiter: UpstashRateLimiter;
  const defaultConfig: RateLimitConfig = {
    maxRequests: 5,
    windowMs: 60_000,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Re-apply mock implementations after reset
    mockPipeline.incr.mockReturnThis();
    mockPipeline.expire.mockReturnThis();
    mockRedis.pipeline.mockReturnValue(mockPipeline);
    mockRedis.del.mockResolvedValue(1);
    limiter = new UpstashRateLimiter({
      url: 'https://test.upstash.io',
      token: 'test-token',
    });
    // Default: count=1 (first request), expire NX succeeded
    mockPipeline.exec.mockResolvedValue([1, 1]);
  });

  describe('constructor', () => {
    it('creates with default key prefix', () => {
      const l = new UpstashRateLimiter({
        url: 'https://test.upstash.io',
        token: 'test-token',
      });
      expect(l).toBeDefined();
    });

    it('creates with custom key prefix', () => {
      const l = new UpstashRateLimiter({
        url: 'https://test.upstash.io',
        token: 'test-token',
        keyPrefix: 'custom:',
      });
      expect(l).toBeDefined();
    });

    it('creates with logger', () => {
      const logger = createMockLogger();
      const l = new UpstashRateLimiter({
        url: 'https://test.upstash.io',
        token: 'test-token',
        logger,
      });
      expect(l).toBeDefined();
    });
  });

  describe('check()', () => {
    it('allows requests under the limit', async () => {
      mockPipeline.exec.mockResolvedValue([1, 1]);

      const result = await limiter.check('user1', defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1
      expect(result.limit).toBe(5);
      expect(result.retryAfter).toBeUndefined();
    });

    it('denies requests over the limit', async () => {
      mockPipeline.exec.mockResolvedValue([6, 0]);

      const result = await limiter.check('user1', defaultConfig);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(60); // ceil(60000 / 1000)
    });

    it('allows requests at the exact limit', async () => {
      mockPipeline.exec.mockResolvedValue([5, 0]);

      const result = await limiter.check('user1', defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('includes burst allowance in effective limit', async () => {
      mockPipeline.exec.mockResolvedValue([6, 0]);
      const config: RateLimitConfig = {
        maxRequests: 5,
        windowMs: 60_000,
        burstAllowance: 3,
      };

      const result = await limiter.check('user1', config);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(8); // 5 + 3
      expect(result.remaining).toBe(2); // 8 - 6
    });

    it('provides a resetAt in the future', async () => {
      mockPipeline.exec.mockResolvedValue([1, 1]);
      const before = Date.now();

      const result = await limiter.check('user1', defaultConfig);

      expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('uses piplined INCR + EXPIRE NX', async () => {
      mockPipeline.exec.mockResolvedValue([1, 1]);

      await limiter.check('user1', defaultConfig);

      expect(mockRedis.pipeline).toHaveBeenCalledOnce();
      expect(mockPipeline.incr).toHaveBeenCalledWith('ratelimit:user1');
      expect(mockPipeline.expire).toHaveBeenCalledWith('ratelimit:user1', 60, 'NX');
    });

    it('uses custom key prefix', async () => {
      const customLimiter = new UpstashRateLimiter({
        url: 'https://test.upstash.io',
        token: 'test-token',
        keyPrefix: 'custom:',
      });
      mockPipeline.exec.mockResolvedValue([1, 1]);

      await customLimiter.check('user1', defaultConfig);

      expect(mockPipeline.incr).toHaveBeenCalledWith('custom:user1');
    });
  });

  describe('fail-open behavior', () => {
    it('allows request on Redis error by default (failOpen not set)', async () => {
      const logger = createMockLogger();
      const limiterWithLogger = new UpstashRateLimiter({
        url: 'https://test.upstash.io',
        token: 'test-token',
        logger,
      });
      mockPipeline.exec.mockRejectedValue(new Error('Redis connection failed'));

      const result = await limiterWithLogger.check('user1', defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.backendError).toBe(true);
      expect(result.remaining).toBe(5);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('allows request on Redis error when failOpen is true', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('timeout'));

      const result = await limiter.check('user1', {
        ...defaultConfig,
        failOpen: true,
      });

      expect(result.allowed).toBe(true);
      expect(result.backendError).toBe(true);
    });

    it('throws on Redis error when failOpen is false', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('timeout'));

      await expect(
        limiter.check('user1', {
          ...defaultConfig,
          failOpen: false,
        }),
      ).rejects.toThrow('timeout');
    });

    it('logs non-Error objects in fail-open', async () => {
      const logger = createMockLogger();
      const limiterWithLogger = new UpstashRateLimiter({
        url: 'https://test.upstash.io',
        token: 'test-token',
        logger,
      });
      mockPipeline.exec.mockRejectedValue('string error');

      const result = await limiterWithLogger.check('user1', defaultConfig);

      expect(result.allowed).toBe(true);
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });

  describe('reset()', () => {
    it('deletes the rate limit key', async () => {
      await limiter.reset('user1');
      expect(mockRedis.del).toHaveBeenCalledWith('ratelimit:user1');
    });
  });

  describe('resetAll()', () => {
    it('scans and deletes all keys matching the prefix', async () => {
      // Simulate SCAN returning keys in one batch then done
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['ratelimit:user1', 'ratelimit:user2']])
        .mockResolvedValueOnce(['0', []]);

      await limiter.resetAll();

      expect(mockRedis.scan).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('ratelimit:user1', 'ratelimit:user2');
    });

    it('handles multiple SCAN pages', async () => {
      // First scan returns cursor "42" and some keys
      mockRedis.scan
        .mockResolvedValueOnce(['42', ['ratelimit:a']])
        .mockResolvedValueOnce(['0', ['ratelimit:b']]);

      await limiter.resetAll();

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
    });

    it('handles empty scan results', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      await limiter.resetAll();

      expect(mockRedis.scan).toHaveBeenCalledOnce();
      // del should not be called for empty keys
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
