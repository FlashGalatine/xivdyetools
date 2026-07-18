/**
 * Rate Limiting Service for OAuth Endpoints
 *
 * Implements IP-based sliding window rate limiting to protect auth endpoints
 * from abuse (brute force attacks, credential stuffing, etc.)
 *
 * REFACTOR-002: Now uses @xivdyetools/rate-limiter shared package
 *
 * Limits:
 * - /auth/discord: 10 req/min per IP (initiate login)
 * - /auth/callback: 20 req/min per IP (token exchange)
 * - /auth/refresh: 30 req/min per IP (token refresh)
 */

import {
  MemoryRateLimiter,
  getClientIp as sharedGetClientIp,
  getOAuthLimit,
} from '@xivdyetools/rate-limiter';

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Singleton rate limiter instance
 */
const limiter = new MemoryRateLimiter({
  maxEntries: 10_000, // Match previous MAX_ENTRIES
  cleanupInterval: 100, // Match previous CLEANUP_INTERVAL
});

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  return sharedGetClientIp(request);
}

/**
 * Check if a request is within rate limits
 *
 * BUG-007 (2026-07-18 audit): path→config routing now comes from the shared
 * package's getOAuthLimit (longest prefix wins) instead of a local copy that
 * let '/auth/xivauth' shadow '/auth/xivauth/callback'.
 *
 * @param ip - Client IP address
 * @param path - Request path (e.g., "/auth/discord")
 * @returns Rate limit result
 */
export async function checkRateLimit(ip: string, path: string): Promise<RateLimitResult> {
  const config = getOAuthLimit(path);
  // Use compound key for path-specific rate limiting
  const key = `${ip}:${path}`;

  const result = await limiter.check(key, config);

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.resetAt,
    limit: result.limit,
  };
}

/**
 * Reset the rate limiter (for testing purposes)
 */
export async function resetRateLimiter(): Promise<void> {
  await limiter.resetAll();
}
