/**
 * Rate Limit Middleware
 *
 * KV-backed distributed rate limiting at 60 requests/min per IP.
 *
 * REFACTOR-002: Now uses shared rateLimitMiddleware factory from
 * @xivdyetools/worker-middleware for consistent header formatting
 * and error handling. Uses lazy backend factory since KV binding
 * is only available at request time.
 */

import type { Context } from 'hono';
import type { Env, Variables } from '../types.js';
import { rateLimitMiddleware as createRateLimitMiddleware } from '@xivdyetools/worker-middleware';
import { KVRateLimiter, getClientIp } from '@xivdyetools/rate-limiter';
import { ErrorCode } from '../lib/api-error.js';

let kvLimiter: KVRateLimiter | null = null;

function getKVLimiter(kv: KVNamespace): KVRateLimiter {
  if (!kvLimiter) {
    kvLimiter = new KVRateLimiter({ kv, keyPrefix: 'api:ip:' });
  }
  return kvLimiter;
}

export const rateLimitMiddleware = createRateLimitMiddleware({
  backend: (c: Context<{ Bindings: Env }>) => getKVLimiter(c.env.RATE_LIMIT),
  keyExtractor: (c) => getClientIp(c.req.raw),
  config: {
    maxRequests: 60,
    windowMs: 60_000,
    burstAllowance: 5,
    failOpen: true,
  },
  onError: 'fail-open',
  formatError: (c: Context<{ Bindings: Env; Variables: Variables }>, retryAfter) =>
    c.json(
      {
        success: false,
        error: ErrorCode.RATE_LIMITED,
        message:
          'Rate limit exceeded. 60 requests per minute allowed for anonymous access. Register for an API key to get 300 requests per minute.',
        retryAfter,
        meta: {
          requestId: c.get('requestId') || 'unknown',
          apiVersion: c.env.API_VERSION || 'v1',
        },
      },
      429,
    ),
});
