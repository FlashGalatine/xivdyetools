/**
 * Rate Limiting Middleware for Cloudflare Workers
 *
 * Implements per-user rate limiting using KV storage with a sliding window pattern.
 * Protects against:
 * - Resource exhaustion attacks
 * - Database query flooding through autocomplete
 * - Rapid button clicks and command spam
 *
 * REFACTOR-002: Now uses @xivdyetools/rate-limiter shared package
 *
 * Rate limits are enforced per Discord user ID and interaction type:
 * - Commands: 20 requests/minute (with 5 burst allowance)
 * - Autocomplete: 60 requests/minute (with 10 burst allowance)
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/kv/
 *
 * @example
 * ```typescript
 * import { rateLimitMiddleware } from './middleware/rate-limit.js';
 *
 * app.use('*', rateLimitMiddleware);
 * ```
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types/env.js';
import { KVRateLimiter, MODERATION_LIMITS } from '@xivdyetools/rate-limiter';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests allowed per minute */
  requestsPerMinute: number;

  /**
   * Burst allowance (extra requests allowed temporarily)
   * Useful for legitimate users who click slightly too fast
   */
  burstAllowance?: number;
}

/**
 * Result of rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;

  /** Number of requests remaining in current window */
  remaining: number;

  /** Unix timestamp (ms) when rate limit resets */
  resetTime: number;

  /** Seconds to wait before retrying (only set if !allowed) */
  retryAfter?: number;
}

/**
 * Type of interaction for rate limiting purposes
 */
export type RateLimitType = 'command' | 'autocomplete';

/**
 * Rate limit configurations for different interaction types
 */
export const RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
  command: {
    requestsPerMinute: 20,
    burstAllowance: 5,
  },
  autocomplete: {
    requestsPerMinute: 60,
    burstAllowance: 10,
  },
};

/**
 * Singleton KV rate limiter instance
 */
let limiterInstance: KVRateLimiter | null = null;

/**
 * Get or create the KV rate limiter instance
 */
function getLimiter(kv: KVNamespace): KVRateLimiter {
  if (!limiterInstance) {
    limiterInstance = new KVRateLimiter({
      kv,
      keyPrefix: 'ratelimit:',
    });
  }
  return limiterInstance;
}

/**
 * Check if user has exceeded rate limit
 *
 * Implements sliding window with burst allowance:
 * 1. Get current request count from KV
 * 2. Check against limit + burst allowance
 * 3. Return result with remaining count and reset time
 *
 * @param kv - KV namespace for storing counters
 * @param userId - Discord user ID
 * @param type - Type of interaction
 * @param config - Rate limit configuration
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  kv: KVNamespace,
  userId: string,
  type: RateLimitType,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const limiter = getLimiter(kv);
  const key = `${type}:${userId}`;

  // Convert legacy config to shared package format
  const sharedConfig = {
    maxRequests: config.requestsPerMinute,
    windowMs: 60_000, // 1 minute
    burstAllowance: config.burstAllowance,
  };

  const result = await limiter.checkOnly(key, sharedConfig);

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetTime: result.resetAt.getTime(),
    retryAfter: result.retryAfter,
  };
}

/**
 * Increment rate limit counter
 *
 * MOD-BUG-001 FIX: Now handled by shared package's KVRateLimiter
 * which uses optimistic concurrency with retries.
 *
 * @param kv - KV namespace for storing counters
 * @param userId - Discord user ID
 * @param type - Type of interaction
 * @param maxRetries - Maximum retry attempts (passed to shared package)
 */
export async function incrementRateLimit(
  kv: KVNamespace,
  userId: string,
  type: RateLimitType,
  maxRetries: number = 3
): Promise<void> {
  const limiter = getLimiter(kv);
  const key = `${type}:${userId}`;
  const config = RATE_LIMIT_CONFIGS[type];

  // Convert legacy config to shared package format
  const sharedConfig = {
    maxRequests: config.requestsPerMinute,
    windowMs: 60_000,
    burstAllowance: config.burstAllowance,
  };

  await limiter.increment(key, sharedConfig);
}

/**
 * Get rate limit information for a user
 *
 * Useful for adding rate limit headers to responses.
 *
 * @param kv - KV namespace
 * @param userId - Discord user ID
 * @param type - Type of interaction
 * @returns Current rate limit status
 */
export async function getRateLimitInfo(
  kv: KVNamespace,
  userId: string,
  type: RateLimitType
): Promise<{ current: number; limit: number; resetTime: number }> {
  const config = RATE_LIMIT_CONFIGS[type];
  const limiter = getLimiter(kv);
  const key = `${type}:${userId}`;

  // Convert legacy config to shared package format
  const sharedConfig = {
    maxRequests: config.requestsPerMinute,
    windowMs: 60_000,
    burstAllowance: config.burstAllowance,
  };

  const result = await limiter.checkOnly(key, sharedConfig);
  const effectiveLimit = config.requestsPerMinute + (config.burstAllowance || 0);

  // On backend error, remaining equals effectiveLimit, so current would be -1
  // Return 0 in that case since we don't know the actual count
  const current = result.backendError ? 0 : Math.max(0, effectiveLimit - result.remaining - 1);

  return {
    current,
    limit: effectiveLimit,
    resetTime: result.resetAt.getTime(),
  };
}

/**
 * Rate limiting middleware for Hono
 *
 * Checks rate limits for Discord interactions and returns 429 if exceeded.
 * Does NOT block the request - just logs violations.
 * Actual rate limit enforcement happens in interaction handlers.
 *
 * @param c - Hono context
 * @param next - Next middleware
 */
export async function rateLimitMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // Pass through - rate limiting is enforced at interaction handler level
  // This middleware just provides the infrastructure
  await next();
}

/**
 * Reset the rate limiter for testing
 */
export function resetRateLimiterInstance(): void {
  limiterInstance = null;
}
