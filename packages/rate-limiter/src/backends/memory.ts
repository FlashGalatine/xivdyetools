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
   * Map of key -> per-key window plus request timestamps.
   *
   * BUG-023: each entry remembers the largest windowMs it has been checked
   * with, so periodic cleanup can use a per-key cutoff instead of applying the
   * CURRENT request's window to every key — a short-window request must not
   * purge history belonging to a long-window config on a shared instance.
   */
  private requestLog = new Map<string, { windowMs: number; timestamps: number[] }>();

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
  // eslint-disable-next-line @typescript-eslint/require-await -- implements async interface
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const effectiveLimit =
      config.maxRequests + (config.burstAllowance ?? 0);

    // Get existing entry for this key (BUG-023: track its largest window)
    const entry = this.requestLog.get(key);
    const entryWindowMs = Math.max(entry?.windowMs ?? 0, config.windowMs);

    // Filter to only include requests within the current window
    const recentTimestamps = (entry?.timestamps ?? []).filter((ts) => ts > windowStart);

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
    }
    this.requestLog.set(key, { windowMs: entryWindowMs, timestamps: recentTimestamps });

    // Deterministic cleanup: every CLEANUP_INTERVAL requests
    this.requestCount++;
    if (this.requestCount % this.cleanupInterval === 0) {
      this.cleanupOldEntries();
    }

    // Emergency LRU eviction if map grows too large (PRESETS-BUG-001 fix)
    if (this.requestLog.size > this.maxEntries) {
      this.cleanupOldEntries();

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
  // eslint-disable-next-line @typescript-eslint/require-await -- implements async interface
  async reset(key: string): Promise<void> {
    this.requestLog.delete(key);
  }

  /**
   * Reset all rate limits
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- implements async interface
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
   * Clean up stale timestamps using each key's OWN window (BUG-023) —
   * cutoff = now - 2 * entry.windowMs, so heterogeneous-window configs on a
   * shared instance never purge each other's history.
   */
  private cleanupOldEntries(): void {
    const now = Date.now();

    this.requestLog.forEach((entry, key) => {
      const cutoff = now - entry.windowMs * 2;
      const { timestamps } = entry;
      // Timestamps are appended chronologically — scan from front to find first valid
      let firstValid = 0;
      while (firstValid < timestamps.length && timestamps[firstValid] <= cutoff) {
        firstValid++;
      }
      if (firstValid === timestamps.length) {
        this.requestLog.delete(key);
      } else if (firstValid > 0) {
        timestamps.splice(0, firstValid);
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
    this.requestLog.forEach(({ timestamps }, key) => {
      const lastActivity =
        timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;
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
