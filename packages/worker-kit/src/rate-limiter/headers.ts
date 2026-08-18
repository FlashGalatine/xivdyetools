/**
 * Rate Limit Response Headers
 *
 * Helpers for generating standard rate limit response headers.
 * Follows the common convention used by GitHub, Twitter, and other APIs.
 */

import type { RateLimitResult } from './types.js';

/**
 * Generate standard rate limit response headers
 *
 * Headers generated:
 * - X-RateLimit-Limit: Maximum requests allowed
 * - X-RateLimit-Remaining: Requests remaining in window
 * - X-RateLimit-Reset: Unix timestamp when window resets
 * - Retry-After: Seconds until retry (only when rate limited)
 *
 * @param result - Rate limit check result
 * @returns Headers object to spread into Response headers
 *
 * @example
 * ```typescript
 * const result = await limiter.check(ip, config);
 * const headers = getRateLimitHeaders(result);
 *
 * if (!result.allowed) {
 *   return new Response('Too Many Requests', {
 *     status: 429,
 *     headers,
 *   });
 * }
 *
 * return new Response('OK', { headers });
 * ```
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt.getTime() / 1000)),
  };

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}
