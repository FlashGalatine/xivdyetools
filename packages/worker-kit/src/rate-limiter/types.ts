/**
 * Rate Limiter Types
 *
 * Core interfaces for the rate limiting system. These types are designed
 * to be compatible with the existing RateLimitResult in @xivdyetools/types
 * while providing additional fields for enhanced functionality.
 */

/**
 * Minimal logger interface for rate limiter observability
 *
 * Compatible with @xivdyetools/logger and most logging libraries.
 * Pass any logger that implements these methods for structured logging
 * of rate limiter events (KV errors, fail-open events, retry failures).
 */
export interface RateLimiterLogger {
  /** Log warning messages (e.g., fail-open events) */
  warn(message: string, context?: Record<string, unknown>): void;

  /** Log error messages (e.g., KV failures after retries) */
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
}

/**
 * Result of a rate limit check
 *
 * Compatible with existing implementations across the xivdyetools ecosystem.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;

  /** Number of requests remaining in current window */
  remaining: number;

  /** When the rate limit window resets */
  resetAt: Date;

  /** Maximum requests allowed (the limit) */
  limit: number;

  /** Seconds to wait before retrying (only set if !allowed) */
  retryAfter?: number;

  /** Flag indicating backend error occurred (fail-open was used) */
  backendError?: boolean;
}

/**
 * Rate limit configuration
 *
 * Defines the parameters for a rate limiting rule.
 */
export interface RateLimitConfig {
  /** Maximum requests allowed per window */
  maxRequests: number;

  /** Window duration in milliseconds */
  windowMs: number;

  /**
   * Burst allowance (extra requests allowed temporarily)
   * Useful for legitimate users who click slightly too fast
   */
  burstAllowance?: number;

  /**
   * Whether to fail open on backend errors
   * If true (default), requests are allowed when the backend fails
   * If false, backend errors will throw
   */
  failOpen?: boolean;
}

/**
 * Endpoint-specific rate limit configuration
 *
 * Maps endpoint paths to their rate limit configurations.
 * Must include a 'default' key for unmatched endpoints.
 */
export interface EndpointRateLimitConfig {
  [endpoint: string]: RateLimitConfig;
  default: RateLimitConfig;
}

/**
 * Base rate limiter interface
 *
 * All rate limiter backends must implement this interface.
 * The check() method both verifies and records the request.
 */
export interface RateLimiter {
  /**
   * Check if a request is allowed and record it
   *
   * This method atomically checks the rate limit and records the request
   * if allowed. For backends that don't support atomic operations,
   * see ExtendedRateLimiter.
   *
   * @param key - Unique identifier (IP, user ID, etc.)
   * @param config - Rate limit configuration
   * @returns Rate limit result
   */
  check(key: string, config: RateLimitConfig): Promise<RateLimitResult>;

  /**
   * Reset rate limit for a specific key
   *
   * @param key - The key to reset
   */
  reset(key: string): Promise<void>;

  /**
   * Reset all rate limits
   *
   * Primarily for testing purposes.
   */
  resetAll(): Promise<void>;
}

/**
 * Extended rate limiter with separate check/increment operations
 *
 * Useful for backends like Cloudflare KV that don't support atomic
 * read-modify-write operations. Allows checking the limit first,
 * then incrementing after the request is processed.
 */
export interface ExtendedRateLimiter extends RateLimiter {
  /**
   * Check rate limit without incrementing (read-only)
   *
   * @param key - Unique identifier
   * @param config - Rate limit configuration
   * @returns Rate limit result (remaining reflects current state)
   */
  checkOnly(key: string, config: RateLimitConfig): Promise<RateLimitResult>;

  /**
   * Increment the counter after request processing
   *
   * Should be called after checkOnly() returns allowed=true
   * and the request has been processed.
   *
   * @param key - Unique identifier
   * @param config - Rate limit configuration
   */
  increment(key: string, config: RateLimitConfig): Promise<void>;
}

/**
 * Options for MemoryRateLimiter
 */
export interface MemoryRateLimiterOptions {
  /**
   * Maximum entries to track before LRU eviction
   * Prevents unbounded memory growth under attack
   * @default 10000
   */
  maxEntries?: number;

  /**
   * Cleanup interval (every N requests)
   * Triggers cleanup of expired entries
   * @default 100
   */
  cleanupInterval?: number;
}

/**
 * Options for KVRateLimiter
 */
export interface KVRateLimiterOptions {
  /** Cloudflare KV namespace binding */
  kv: KVNamespace;

  /**
   * Key prefix for rate limit entries
   * @default 'ratelimit:'
   */
  keyPrefix?: string;

  /**
   * Maximum retries for optimistic concurrency
   * Used to handle KV race conditions (MOD-BUG-001 mitigation)
   * @default 3
   */
  maxRetries?: number;

  /**
   * TTL buffer beyond window duration (seconds)
   * Entries expire after windowMs + ttlBuffer
   * @default 60
   */
  ttlBuffer?: number;

  /**
   * Optional logger for observability
   *
   * When provided, the rate limiter will log:
   * - warn: Fail-open events (KV errors where request was allowed)
   * - error: KV failures after all retries exhausted
   *
   * Compatible with @xivdyetools/logger or any logger implementing
   * warn(message, context) and error(message, error, context).
   *
   * @example
   * ```typescript
   * import { createWorkerLogger } from '@xivdyetools/logger';
   *
   * const limiter = new KVRateLimiter({
   *   kv: env.RATE_LIMIT_KV,
   *   logger: createWorkerLogger({ service: 'api' }),
   * });
   * ```
   */
  logger?: RateLimiterLogger;
}

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
   *
   * When provided, the rate limiter will log:
   * - warn: Fail-open events (Redis errors where request was allowed)
   *
   * @example
   * ```typescript
   * import { createWorkerLogger } from '@xivdyetools/logger';
   *
   * const limiter = new UpstashRateLimiter({
   *   url: env.UPSTASH_REDIS_REST_URL,
   *   token: env.UPSTASH_REDIS_REST_TOKEN,
   *   logger: createWorkerLogger({ service: 'discord-bot' }),
   * });
   * ```
   */
  logger?: RateLimiterLogger;
}
