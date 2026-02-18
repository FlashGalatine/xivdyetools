/**
 * Rate Limiter Service
 *
 * Adapter over @xivdyetools/rate-limiter for the Universalis proxy.
 * Provides a seconds-based interface for backward compatibility.
 *
 * SECURITY: Prevents abuse of the proxy and protects upstream Universalis API.
 *
 * @module services/rate-limiter
 */

import { MemoryRateLimiter } from '@xivdyetools/rate-limiter';

/**
 * Rate limit configuration (seconds-based interface)
 */
export interface RateLimitConfig {
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/**
 * Rate limit check result (seconds-based interface)
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Seconds until the rate limit window resets */
  resetInSeconds: number;
}

/**
 * Shared rate limiter instance
 * Persists within a Worker isolate
 */
const limiter = new MemoryRateLimiter();

/**
 * Check if a request should be rate limited
 *
 * Uses @xivdyetools/rate-limiter under the hood with a seconds-based adapter.
 *
 * @param identifier - Unique identifier (IP address or user ID)
 * @param config - Rate limit configuration (seconds-based)
 * @returns Promise resolving to rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const result = await limiter.check(identifier, {
    maxRequests: config.maxRequests,
    windowMs: config.windowSeconds * 1000,
  });

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetInSeconds: result.retryAfter ?? config.windowSeconds,
  };
}

/**
 * Get rate limit headers for the response
 *
 * @param result - Rate limit check result
 * @param maxRequests - Maximum requests per window
 * @returns Headers object with rate limit information
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  maxRequests: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(
      Math.floor(Date.now() / 1000) + result.resetInSeconds
    ),
  };
}

/**
 * Clear all rate limit data (for testing)
 */
export async function clearRateLimits(): Promise<void> {
  await limiter.resetAll();
}
