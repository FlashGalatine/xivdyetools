/**
 * Rate Limit Middleware
 * Applies IP-based rate limiting to public endpoints
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types.js';
import { checkPublicRateLimit, getClientIp } from '../services/rate-limit-service.js';

/**
 * Rate limiting middleware for public endpoints
 * Limits requests to 100/minute per IP using sliding window algorithm
 *
 * Returns 429 Too Many Requests if limit exceeded, with retry-after header
 */
export async function publicRateLimitMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> {
  const clientIp = getClientIp(c.req.raw);
  const result = await checkPublicRateLimit(clientIp);

  // Set rate limit headers on all responses
  c.header('X-RateLimit-Limit', '100');
  c.header('X-RateLimit-Remaining', result.remaining.toString());
  c.header('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000).toString());

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
    c.header('Retry-After', retryAfter.toString());

    return c.json(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter,
      },
      429
    );
  }

  await next();
}
