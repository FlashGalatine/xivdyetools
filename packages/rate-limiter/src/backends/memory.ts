/**
 * Memory-based Rate Limiter
 *
 * In-memory sliding window rate limiter with LRU eviction.
 * Suitable for single-instance deployments or per-isolate limiting.
 *
 * Key features:
 * - Sliding window algorithm (not fixed windows)
 * - Deterministic cleanup every N requests
 * - LRU eviction when max entries exceeded (PRESETS-BUG-001 fix)
 * - Burst allowance support
 *
 * Note: State is not shared across Workers isolates. For distributed
 * rate limiting, use KVRateLimiter or Durable Objects.
 *
 * @example
 * ```typescript
 * const limiter = new MemoryRateLimiter({ maxEntries: 10000 });
 *
 * const result = await limiter.check(ip, {
 *   maxRequests: 100,
 *   windowMs: 60_000,
 * });
 *
 * if (!result.allowed) {
 *   return new Response('Too Many Requests', { status: 429 });
 * }
 * ```
 */

import type {
  RateLimiter,
  RateLimitResult,
  RateLimitConfig,
  MemoryRateLimiterOptions,
} from '../types.js';

/**
 * Default maximum entries before LRU eviction
 * Prevents unbounded memory growth under attack
 */
const DEFAULT_MAX_ENTRIES = 10_000;

/**
 * Default cleanup interval (every N requests)
 */
const DEFAULT_CLEANUP_INTERVAL = 100;

/**
 * Memory-based rate limiter with sliding window algorithm
 */
export class MemoryRateLimiter implements RateLimiter {
  /**
   * Map of key -> array of request timestamps
   */
  private requestLog = new Map<string, number[]>();

  /**
   * Request counter for deterministic cleanup
   */
  private requestCount = 0;

  /**
   * Maximum entries before LRU eviction
   */
  private readonly maxEntries: number;

  /**
   * Cleanup interval (every N requests)
   */
  private readonly cleanupInterval: number;

  constructor(options: MemoryRateLimiterOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.cleanupInterval = options.cleanupInterval ?? DEFAULT_CLEANUP_INTERVAL;
  }

  /**
   * Check if a request is allowed and record it
   */
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const effectiveLimit =
      config.maxRequests + (config.burstAllowance ?? 0);

    // Get existing timestamps for this key
    const timestamps = this.requestLog.get(key) ?? [];

    // Filter to only include requests within the current window
    const recentTimestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if within limit
    const allowed = recentTimestamps.length < effectiveLimit;
    const remaining = Math.max(0, effectiveLimit - recentTimestamps.length);

    // Calculate reset time (when oldest request in window expires)
    const oldestInWindow = recentTimestamps[0];
    const resetAt = oldestInWindow
      ? new Date(oldestInWindow + config.windowMs)
      : new Date(now + config.windowMs);

    // Record this request if allowed
    if (allowed) {
      recentTimestamps.push(now);
      this.requestLog.set(key, recentTimestamps);
    }

    // Deterministic cleanup: every CLEANUP_INTERVAL requests
    this.requestCount++;
    if (this.requestCount % this.cleanupInterval === 0) {
      this.cleanupOldEntries(config.windowMs * 2);
    }

    // Emergency LRU eviction if map grows too large (PRESETS-BUG-001 fix)
    if (this.requestLog.size > this.maxEntries) {
      this.cleanupOldEntries(config.windowMs * 2);

      // If still too large after cleanup, prune oldest entries
      if (this.requestLog.size > this.maxEntries) {
        this.pruneOldestEntries();
      }
    }

    return {
      allowed,
      remaining: allowed ? remaining - 1 : remaining,
      resetAt,
      limit: effectiveLimit,
      retryAfter: allowed
        ? undefined
        : Math.ceil((resetAt.getTime() - now) / 1000),
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  async reset(key: string): Promise<void> {
    this.requestLog.delete(key);
  }

  /**
   * Reset all rate limits
   */
  async resetAll(): Promise<void> {
    this.requestLog.clear();
    this.requestCount = 0;
  }

  /**
   * Get the current number of tracked keys (for debugging)
   */
  get size(): number {
    return this.requestLog.size;
  }

  /**
   * Clean up entries older than maxAge
   */
  private cleanupOldEntries(maxAge: number): void {
    const cutoff = Date.now() - maxAge;

    this.requestLog.forEach((timestamps, key) => {
      const filtered = timestamps.filter((ts) => ts > cutoff);
      if (filtered.length === 0) {
        this.requestLog.delete(key);
      } else {
        this.requestLog.set(key, filtered);
      }
    });
  }

  /**
   * Prune oldest entries when map exceeds maxEntries
   * Removes 20% of entries with oldest last-activity
   */
  private pruneOldestEntries(): void {
    const targetSize = Math.floor(this.maxEntries * 0.8);
    const toRemove = this.requestLog.size - targetSize;

    if (toRemove <= 0) return;

    // Find entries with oldest last-activity
    const entries: Array<{ key: string; lastActivity: number }> = [];
    this.requestLog.forEach((timestamps, key) => {
      const lastActivity =
        timestamps.length > 0 ? Math.max(...timestamps) : 0;
      entries.push({ key, lastActivity });
    });

    // Sort by last activity (oldest first)
    entries.sort((a, b) => a.lastActivity - b.lastActivity);

    // Remove oldest entries
    for (let i = 0; i < toRemove; i++) {
      this.requestLog.delete(entries[i].key);
    }
  }
}
