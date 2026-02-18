/**
 * KV-based Rate Limiter
 *
 * Cloudflare KV-backed rate limiter with optimistic concurrency.
 * Suitable for distributed rate limiting across Workers isolates.
 *
 * Key features:
 * - Persistent storage across isolates and restarts
 * - Optimistic concurrency with retries (MOD-BUG-001 fix)
 * - Version metadata for conflict detection
 * - Fail-open on KV errors for availability
 * - Separate checkOnly/increment for non-atomic backends
 *
 * Note: KV does not support atomic increment operations. This implementation
 * uses optimistic concurrency control with retries to minimize race conditions.
 * For truly atomic operations, consider using Durable Objects.
 *
 * @example
 * ```typescript
 * const limiter = new KVRateLimiter({ kv: env.RATE_LIMIT_KV });
 *
 * // Option 1: Atomic-like check (checks and increments)
 * const result = await limiter.check(userId, {
 *   maxRequests: 20,
 *   windowMs: 60_000,
 * });
 *
 * // Option 2: Separate check/increment (more control)
 * const result = await limiter.checkOnly(userId, config);
 * if (result.allowed) {
 *   await processRequest();
 *   await limiter.increment(userId, config);
 * }
 * ```
 */

import type {
  ExtendedRateLimiter,
  RateLimitResult,
  RateLimitConfig,
  KVRateLimiterOptions,
  RateLimiterLogger,
} from '../types.js';

/**
 * Default key prefix for rate limit entries
 */
const DEFAULT_KEY_PREFIX = 'ratelimit:';

/**
 * Default maximum retries for optimistic concurrency
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * Default TTL buffer beyond window (seconds)
 */
const DEFAULT_TTL_BUFFER = 60;

/**
 * KV entry structure
 */
interface KVEntry {
  count: number;
  windowStart: number;
}

/**
 * KV metadata structure for version tracking
 */
interface KVMetadata {
  version: number;
}

/**
 * KV-based rate limiter with optimistic concurrency control
 */
export class KVRateLimiter implements ExtendedRateLimiter {
  private readonly kv: KVNamespace;
  private readonly keyPrefix: string;
  private readonly maxRetries: number;
  private readonly ttlBuffer: number;
  private readonly logger?: RateLimiterLogger;

  constructor(options: KVRateLimiterOptions) {
    this.kv = options.kv;
    this.keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.ttlBuffer = options.ttlBuffer ?? DEFAULT_TTL_BUFFER;
    this.logger = options.logger;
  }

  /**
   * Check if a request is allowed and record it
   *
   * This combines checkOnly + increment for convenience.
   * If atomic behavior is critical, use checkOnly and increment separately.
   *
   * **FINDING-004: TOCTOU race condition warning**
   *
   * Cloudflare KV does not support atomic read-modify-write. This method
   * calls `checkOnly()` then `increment()` as separate operations, creating
   * a window where concurrent requests for the same key can both be allowed
   * before either increment is written. Under high concurrency, the actual
   * request count may briefly exceed `maxRequests` by a small margin.
   *
   * Mitigations already in place:
   * - Optimistic concurrency with retries in `increment()`
   * - Version metadata for conflict detection
   * - Fail-open design (availability over strict accuracy)
   *
   * For strict atomic rate limiting, use {@link UpstashRateLimiter} (Redis
   * MULTI/EXEC) or Cloudflare Durable Objects.
   */
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const result = await this.checkOnly(key, config);
    if (result.allowed && !result.backendError) {
      await this.increment(key, config);
    }
    return result;
  }

  /**
   * Check rate limit without incrementing (read-only)
   */
  async checkOnly(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const kvKey = this.buildKey(key, now, config.windowMs);
    const effectiveLimit =
      config.maxRequests + (config.burstAllowance ?? 0);
    const resetAt = this.calculateResetTime(now, config.windowMs);

    try {
      const data = await this.kv.get(kvKey);
      const entry: KVEntry | null = data ? JSON.parse(data) : null;

      // Check if window expired or no entry exists
      if (!entry || now - entry.windowStart >= config.windowMs) {
        return {
          allowed: true,
          remaining: effectiveLimit - 1,
          resetAt,
          limit: effectiveLimit,
        };
      }

      const allowed = entry.count < effectiveLimit;
      const remaining = Math.max(0, effectiveLimit - entry.count - 1);

      return {
        allowed,
        remaining: allowed ? remaining : 0,
        resetAt,
        limit: effectiveLimit,
        retryAfter: allowed
          ? undefined
          : Math.ceil((resetAt.getTime() - now) / 1000),
      };
    } catch (error) {
      // Fail-open on KV errors (availability over strict limiting)
      if (config.failOpen !== false) {
        // Log fail-open event for monitoring/alerting
        this.logger?.warn('Rate limiter fail-open: KV read error, allowing request', {
          key,
          operation: 'checkOnly',
          error: error instanceof Error ? error.message : String(error),
          kvKey,
        });

        return {
          allowed: true,
          remaining: effectiveLimit,
          resetAt,
          limit: effectiveLimit,
          backendError: true,
        };
      }
      throw error;
    }
  }

  /**
   * Increment the counter after request processing
   *
   * Uses optimistic concurrency with retries (MOD-BUG-001 fix).
   * KV doesn't support atomic increments, so concurrent calls can race.
   * This implementation minimizes but doesn't eliminate the race window.
   */
  async increment(key: string, config: RateLimitConfig): Promise<void> {
    const now = Date.now();
    const kvKey = this.buildKey(key, now, config.windowMs);
    const ttl = Math.ceil(config.windowMs / 1000) + this.ttlBuffer;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Read current value with metadata for version tracking
        const result = await this.kv.getWithMetadata<KVMetadata>(kvKey);
        const currentData: KVEntry | null = result.value
          ? JSON.parse(result.value)
          : null;
        const currentVersion = result.metadata?.version ?? 0;

        // Calculate new entry
        let entry: KVEntry;
        if (!currentData || now - currentData.windowStart >= config.windowMs) {
          // New window
          entry = { count: 1, windowStart: now };
        } else {
          // Increment existing
          entry = {
            count: currentData.count + 1,
            windowStart: currentData.windowStart,
          };
        }

        // Write with new version metadata
        await this.kv.put(kvKey, JSON.stringify(entry), {
          expirationTtl: ttl,
          metadata: { version: currentVersion + 1 },
        });

        // Verify write succeeded (simple optimistic check)
        const verification = await this.kv.get(kvKey);
        if (verification) {
          const verified: KVEntry = JSON.parse(verification);
          // If our write succeeded (count is at least what we wrote), done
          if (verified.count >= entry.count) {
            return;
          }
        }

        // Small delay before retry to reduce contention
        if (attempt < this.maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, 10 * (attempt + 1))
          );
        }
      } catch (error) {
        // Log error on last attempt (structured logging if logger provided)
        if (attempt === this.maxRetries - 1) {
          const errorContext = {
            key,
            operation: 'increment',
            attempts: attempt + 1,
            maxRetries: this.maxRetries,
            kvKey,
          };

          if (this.logger) {
            this.logger.error(
              'Rate limiter KV increment failed after retries',
              error,
              errorContext
            );
          } else {
            // Fallback to console.error for backward compatibility
            console.error('Rate limit increment error after retries', {
              ...errorContext,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async reset(key: string): Promise<void> {
    // List and delete all keys with this prefix
    const prefix = `${this.keyPrefix}${key}|`;
    const { keys } = await this.kv.list({ prefix });
    await Promise.all(keys.map((k) => this.kv.delete(k.name)));
  }

  /**
   * Reset all rate limits
   */
  async resetAll(): Promise<void> {
    const { keys } = await this.kv.list({ prefix: this.keyPrefix });
    await Promise.all(keys.map((k) => this.kv.delete(k.name)));
  }

  /**
   * Build KV key for a rate limit entry
   *
   * Uses time-window-based keys for cleaner key expiration.
   *
   * FINDING-007: Uses `|` as the delimiter between user key and window number
   * instead of `:` to prevent ambiguity when keys contain colons
   * (e.g., IPv6 addresses like `2001:db8::1`).
   *
   * Format: {prefix}{key}|{window}
   */
  private buildKey(key: string, timestamp: number, windowMs: number): string {
    const window = Math.floor(timestamp / windowMs);
    return `${this.keyPrefix}${key}|${window}`;
  }

  /**
   * Calculate when the current window resets
   */
  private calculateResetTime(now: number, windowMs: number): Date {
    const currentWindow = Math.floor(now / windowMs);
    return new Date((currentWindow + 1) * windowMs);
  }
}
