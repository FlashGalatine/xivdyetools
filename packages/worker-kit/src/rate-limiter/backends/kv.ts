/**
 * KV-based Rate Limiter
 *
 * Cloudflare KV-backed rate limiter — best-effort fixed window.
 * Suitable for distributed rate limiting across Workers isolates.
 *
 * Key features:
 * - Persistent storage across isolates and restarts
 * - Fail-open on KV errors for availability
 * - Separate checkOnly/increment for non-atomic backends
 *
 * BUG-022/OPT-002 (2026-07-18 audit): KV cannot do atomic read-modify-write,
 * so this limiter is honestly BEST-EFFORT: under concurrency the effective
 * limit may be exceeded by roughly the concurrency factor (concurrent
 * increments can lose updates). The previous "optimistic concurrency" version
 * metadata and post-put verification read were removed — the version was
 * written but never compared (not OCC), and the verification read both cost a
 * billed KV read per request and could DOUBLE-count a request when a
 * concurrent window reset landed between put and verify. Retries now apply
 * only to thrown KV errors. For strict atomic limits use UpstashRateLimiter
 * (Redis INCR) or a Durable Object counter.
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
 * Default maximum retries for thrown KV errors during increment
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
 * KV-based rate limiter (best-effort fixed window; see module docblock)
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
   * For strict atomic rate limiting, use {@link UpstashRateLimiter} (Redis
   * INCR) or Cloudflare Durable Objects.
   */
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    // BUG-064: capture `now` once so checkOnly and increment address the SAME
    // fixed-window KV key — separate Date.now() calls could straddle a window
    // boundary and charge the request to the next window.
    const now = Date.now();
    const result = await this.checkOnly(key, config, now);
    if (result.allowed && !result.backendError) {
      await this.increment(key, config, now);
      // BUG-004: Adjust remaining to reflect consumed request
      result.remaining = Math.max(0, result.remaining - 1);
    }
    return result;
  }

  /**
   * Check rate limit without incrementing (read-only)
   */
  async checkOnly(
    key: string,
    config: RateLimitConfig,
    now: number = Date.now()
  ): Promise<RateLimitResult> {
    const kvKey = this.buildKey(key, now, config.windowMs);
    const effectiveLimit =
      config.maxRequests + (config.burstAllowance ?? 0);
    const resetAt = this.calculateResetTime(now, config.windowMs);

    try {
      const data = await this.kv.get(kvKey);
      const entry: KVEntry | null = data ? (JSON.parse(data) as KVEntry) : null;

      // BUG-004: checkOnly reports remaining without consuming
      if (!entry || now - entry.windowStart >= config.windowMs) {
        return {
          allowed: true,
          remaining: effectiveLimit,
          resetAt,
          limit: effectiveLimit,
        };
      }

      const allowed = entry.count < effectiveLimit;
      const remaining = Math.max(0, effectiveLimit - entry.count);

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
   * BUG-022/OPT-002: plain read-modify-write, honestly best-effort. KV cannot
   * do atomic increments; concurrent increments can lose updates (limit
   * exceeded by ~concurrency factor). The retry loop exists ONLY for thrown
   * KV errors — the former version metadata and post-put verification read
   * were removed (they detected nothing and could double-count).
   */
  async increment(
    key: string,
    config: RateLimitConfig,
    now: number = Date.now()
  ): Promise<void> {
    const kvKey = this.buildKey(key, now, config.windowMs);
    const ttl = Math.ceil(config.windowMs / 1000) + this.ttlBuffer;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.kv.get(kvKey);
        const currentData: KVEntry | null = result
          ? (JSON.parse(result) as KVEntry)
          : null;

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

        await this.kv.put(kvKey, JSON.stringify(entry), {
          expirationTtl: ttl,
        });
        return;
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
