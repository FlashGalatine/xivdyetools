/**
 * Rate Limit Middleware
 *
 * KV-backed distributed rate limiting at 60 requests/min per IP.
 * Uses lazy singleton for the KVRateLimiter since env is only
 * available at request time (not module scope).
 */

import type { Context, Next } from 'hono';
import type { Env, Variables } from '../types.js';
import { KVRateLimiter, getClientIp, getRateLimitHeaders } from '@xivdyetools/rate-limiter';
import type { RateLimitConfig, RateLimitResult } from '@xivdyetools/rate-limiter';
import { ErrorCode } from '../lib/api-error.js';

const ANONYMOUS_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000,
  burstAllowance: 5,
  failOpen: true,
};

let rateLimiter: KVRateLimiter | null = null;

function getRateLimiter(kv: KVNamespace): KVRateLimiter {
  if (!rateLimiter) {
    rateLimiter = new KVRateLimiter({ kv, keyPrefix: 'api:ip:' });
  }
  return rateLimiter;
}

export async function rateLimitMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
): Promise<Response | void> {
  const clientIp = getClientIp(c.req.raw);
  const limiter = getRateLimiter(c.env.RATE_LIMIT);
  let result: RateLimitResult;

  try {
    result = await limiter.check(clientIp, ANONYMOUS_CONFIG);
  } catch {
    // Fail open — allow request if rate limiter errors
    await next();
    return;
  }

  // Set rate limit headers on all responses
  const headers = getRateLimitHeaders(result);
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value);
  }

  if (!result.allowed) {
    const retryAfter = result.retryAfter ?? Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
    c.header('Retry-After', retryAfter.toString());

    return c.json(
      {
        success: false,
        error: ErrorCode.RATE_LIMITED,
        message: 'Rate limit exceeded. 60 requests per minute allowed for anonymous access. Register for an API key to get 300 requests per minute.',
        retryAfter,
        meta: {
          requestId: c.get('requestId') || 'unknown',
          apiVersion: c.env.API_VERSION || 'v1',
        },
      },
      429,
    );
  }

  await next();
}
