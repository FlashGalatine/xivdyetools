/**
 * Upstash Redis Rate Limiter
 *
 * Redis-backed rate limiter using Upstash's serverless Redis.
 * Provides truly atomic rate limiting operations via Redis INCR.
 *
 * Key features:
 * - Atomic increment operations (no race conditions)
 * - Low latency (~1-5ms global)
 * - 10,000 free commands/day (vs 1,000 KV writes)
 * - Fail-open on errors for availability
 *
 * @example
 * ```typescript
 * import { UpstashRateLimiter } from '@xivdyetools/rate-limiter/upstash';
 *
 * const limiter = new UpstashRateLimiter({
 *   url: env.UPSTASH_REDIS_REST_URL,
 *   token: env.UPSTASH_REDIS_REST_TOKEN,
 * });
 *
 * const result = await limiter.check(userId, {
 *   maxRequests: 15,
 *   windowMs: 60_000,
 * });
 * ```
 */

import { Redis } from '@upstash/redis';
import type {
  RateLimiter,
  RateLimitResult,
  RateLimitConfig,
  RateLimiterLogger,
} from '../types.js';

/**
 * Default key prefix for rate limit entries
 */
const DEFAULT_KEY_PREFIX = 'ratelimit:';

/**
 * Options for UpstashRateLimiter
 */
export interface UpstashRateLimiterOptions {
  /** Upstash Redis REST URL */
  url: string;

  /** Upstash Redis REST token */
  token: string;

  /**
   * Key prefix for rate limit entries
   * @default 'ratelimit:'
   */
  keyPrefix?: string;

  /**
   * Optional logger for observability
   */
  logger?: RateLimiterLogger;
}

/**
 * Upstash Redis-based rate limiter with atomic operations
 */
export class UpstashRateLimiter implements RateLimiter {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private readonly logger?: RateLimiterLogger;

  constructor(options: UpstashRateLimiterOptions) {
    this.redis = new Redis({
      url: options.url,
      token: options.token,
    });
    this.keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.logger = options.logger;
  }

  /**
   * Check if a request is allowed and record it atomically
   *
   * Uses Redis INCR for truly atomic increment operations.
   * Sets TTL on first request in the window.
   */
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const redisKey = this.buildKey(key);
    const effectiveLimit = config.maxRequests + (config.burstAllowance ?? 0);
    const ttlSeconds = Math.ceil(config.windowMs / 1000);

    try {
      // Pipeline: INCR + EXPIRE NX in single round-trip (atomic, no orphan keys)
      const pipeline = this.redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, ttlSeconds, 'NX');
      const results = await pipeline.exec<[number, number]>();

      const count = results[0];

      const allowed = count <= effectiveLimit;
      const remaining = Math.max(0, effectiveLimit - count);
      const resetAt = new Date(Date.now() + ttlSeconds * 1000);

      return {
        allowed,
        remaining,
        resetAt,
        limit: effectiveLimit,
        retryAfter: allowed ? undefined : ttlSeconds,
      };
    } catch (error) {
      // Fail-open on Redis errors (availability over strict limiting)
      if (config.failOpen !== false) {
        this.logger?.warn('Rate limiter fail-open: Redis error, allowing request', {
          key,
          operation: 'check',
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          allowed: true,
          remaining: effectiveLimit,
          resetAt: new Date(Date.now() + config.windowMs),
          limit: effectiveLimit,
          backendError: true,
        };
      }
      throw error;
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async reset(key: string): Promise<void> {
    const redisKey = this.buildKey(key);
    await this.redis.del(redisKey);
  }

  /**
   * Reset all rate limits matching the prefix
   *
   * Note: Uses SCAN which may be slow for large datasets.
   * Consider using Redis key expiration instead for production cleanup.
   */
  async resetAll(): Promise<void> {
    let cursor = '0';
    const pattern = `${this.keyPrefix}*`;

    do {
      const result = await this.redis.scan(cursor, {
        match: pattern,
        count: 100,
      });
      const [nextCursor, keys] = result as [string, string[]];
      cursor = nextCursor;

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  /**
   * Build Redis key for a rate limit entry
   */
  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}
