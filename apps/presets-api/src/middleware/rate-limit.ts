/**
 * Rate Limit Middleware
 * Applies IP-based rate limiting to public endpoints
 *
 * REFACTOR-002: Uses the shared rateLimitMiddleware factory from
 * @xivdyetools/worker-kit for consistent header formatting and error handling.
 *
 * FINDING-003 (2026-08-21 security audit): when the native Workers Rate
 * Limiting binding `RL_PUBLIC` (`[[ratelimits]]`, limit 100 / 60 s) is bound,
 * it is used — atomic per-colo counting, and bot traffic arriving over the
 * service binding (no CF-Connecting-IP → one shared `unknown` bucket) no
 * longer competes inside a per-isolate map. The per-isolate memory limiter
 * stays as the fallback for dev/tests.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { rateLimitMiddleware } from '@xivdyetools/worker-kit';
import {
  MemoryRateLimiter,
  CloudflareRateLimiter,
  getClientIp,
  PUBLIC_API_LIMITS,
  type RateLimiter,
} from '@xivdyetools/worker-kit/rate-limiter';
import type { Env } from '../types.js';

/**
 * Singleton memory limiter for IP-based limiting (fallback).
 * Preserves PRESETS-BUG-001 fix via shared package implementation.
 */
const ipRateLimiter = new MemoryRateLimiter({
  maxEntries: 10_000,
  cleanupInterval: 100,
});

const PUBLIC_LIMIT = PUBLIC_API_LIMITS.default;

/** Native binding when bound, memory otherwise (exported for tests). */
export function selectPublicRateLimiter(env: Env): RateLimiter {
  if (env.RL_PUBLIC) {
    return new CloudflareRateLimiter({
      tiers: [{ limit: PUBLIC_LIMIT.maxRequests, periodSeconds: 60, binding: env.RL_PUBLIC }],
      keyPrefix: 'public:ip:',
    });
  }
  return ipRateLimiter;
}

/**
 * Build a fresh public rate-limit middleware (100/minute per IP).
 * A factory so tests can exercise backend selection per instance; production
 * uses the single `publicRateLimitMiddleware` below.
 */
export function createPublicRateLimitMiddleware(): MiddlewareHandler {
  return rateLimitMiddleware({
    backend: (c: Context<{ Bindings: Env }>) => selectPublicRateLimiter(c.env),
    keyExtractor: (c) => getClientIp(c.req.raw),
    config: PUBLIC_LIMIT,
  });
}

/**
 * Rate limiting middleware for public endpoints
 * Limits requests to 100/minute per IP
 *
 * Returns 429 Too Many Requests if limit exceeded, with retry-after header
 */
export const publicRateLimitMiddleware = createPublicRateLimitMiddleware();
