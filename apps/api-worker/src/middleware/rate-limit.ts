/**
 * Rate limiting middleware for /v1/* — per-client IP.
 *
 * FINDING-003 (2026-08-21 security audit): the KV backend cannot throttle a
 * fast client (KV allows 1 write/s/key, the increment swallows the resulting
 * 429s, reads are eventually consistent) and fails open on any KV error, so
 * the 60 + 5 / 60 s limit was never enforced against the one pattern it
 * exists for. The native Workers Rate Limiting binding (`API_RATE_LIMITER`,
 * `[[ratelimits]]` in wrangler.toml, limit 65 / 60 s) counts atomically
 * per colo with no storage writes and is used whenever it is bound; KV is
 * retained only as the fallback for environments without the binding.
 *
 * Uses shared rate limiting middleware factory from @xivdyetools/worker-kit
 * (REFACTOR-002) with the KV/binding backends from
 * @xivdyetools/worker-kit/rate-limiter.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { rateLimitMiddleware as createRateLimitMiddleware } from '@xivdyetools/worker-kit';
import {
  KVRateLimiter,
  CloudflareRateLimiter,
  getClientIp,
  type RateLimiter,
} from '@xivdyetools/worker-kit/rate-limiter';
import { ErrorCode } from '../lib/api-error.js';
import type { Env, Variables } from '../types.js';

/** Effective limit: 60 requests + 5 burst per 60 s window (matches the binding's `simple.limit`). */
const API_LIMIT = { maxRequests: 60, windowMs: 60_000, burstAllowance: 5, failOpen: true } as const;
const API_EFFECTIVE_LIMIT = API_LIMIT.maxRequests + API_LIMIT.burstAllowance;

/**
 * Choose the backend for this isolate: the native binding when bound, KV otherwise.
 * Exported for tests; production code goes through `rateLimitMiddleware`.
 */
export function selectApiRateLimiter(env: Env): RateLimiter {
  if (env.API_RATE_LIMITER) {
    return new CloudflareRateLimiter({
      tiers: [{ limit: API_EFFECTIVE_LIMIT, periodSeconds: 60, binding: env.API_RATE_LIMITER }],
      keyPrefix: 'api:ip:',
    });
  }
  // BUG-004 (2026-04-28 audit): no module-scope singleton — KVRateLimiter
  // construction is cheap (stores the binding reference); the middleware
  // factory memoises the result per isolate (BUG-061).
  return new KVRateLimiter({ kv: env.RATE_LIMIT, keyPrefix: 'api:ip:' });
}

/**
 * Build a fresh /v1/* rate-limit middleware. A factory (rather than a single
 * module-level instance) so each test can exercise backend selection on its
 * own isolate-scoped cache.
 */
export function createApiRateLimitMiddleware(): MiddlewareHandler {
  return createRateLimitMiddleware({
    backend: (c: Context<{ Bindings: Env }>) => selectApiRateLimiter(c.env),
    keyExtractor: (c) => getClientIp(c.req.raw),
    config: API_LIMIT,
    onError: 'fail-open',
    formatError: (c: Context<{ Bindings: Env; Variables: Variables }>, retryAfter) =>
      c.json(
        {
          success: false,
          error: ErrorCode.RATE_LIMITED,
          message:
            'Rate limit exceeded. 60 requests per minute allowed. Retry after the indicated number of seconds.',
          retryAfter,
          meta: {
            requestId: c.get('requestId') || 'unknown',
            apiVersion: c.env.API_VERSION || 'v1',
          },
        },
        429,
      ),
  });
}

export const rateLimitMiddleware = createApiRateLimitMiddleware();
