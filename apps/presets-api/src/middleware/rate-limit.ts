/**
 * Rate Limit Middleware
 * Applies IP-based rate limiting to public endpoints
 *
 * REFACTOR-002: Now uses shared rateLimitMiddleware factory from
 * @xivdyetools/worker-middleware for consistent header formatting
 * and error handling across workers.
 */

import { rateLimitMiddleware } from '@xivdyetools/worker-middleware';
import { MemoryRateLimiter, getClientIp, PUBLIC_API_LIMITS } from '@xivdyetools/rate-limiter';

/**
 * Singleton rate limiter instance for IP-based limiting
 * Preserves PRESETS-BUG-001 fix via shared package implementation
 */
const ipRateLimiter = new MemoryRateLimiter({
  maxEntries: 10_000,
  cleanupInterval: 100,
});

/**
 * Rate limiting middleware for public endpoints
 * Limits requests to 100/minute per IP using sliding window algorithm
 *
 * Returns 429 Too Many Requests if limit exceeded, with retry-after header
 */
export const publicRateLimitMiddleware = rateLimitMiddleware({
  backend: ipRateLimiter,
  keyExtractor: (c) => getClientIp(c.req.raw),
  config: PUBLIC_API_LIMITS.default,
});
