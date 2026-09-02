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
      // BUG-044: was `public:ip:`, from when every key WAS an IP. Bot traffic
      // now buckets per acting Discord user, so the prefix names the namespace
      // and nothing more. Deploying resets the in-flight 60-second counters
      // once — a one-minute window, so nothing to schedule around.
      keyPrefix: 'public:',
    });
  }
  return ipRateLimiter;
}

/**
 * The bucket a request counts against.
 *
 * BUG-044: this was `getClientIp` alone. A request arriving over a Service
 * Binding has no `CF-Connecting-IP` — both bots build
 * `new Request('https://internal' + path, …)` with no such header — so
 * `getClientIp` returns the literal `'unknown'` and EVERY bot request from
 * EVERY Discord user in EVERY guild shared one 100/min bucket. The limiter is
 * mounted on `/api/*` ahead of `authMiddleware`, so there was no authenticated
 * bypass either: at roughly 1.7 requests per second aggregate, `/preset`
 * commands began 429-ing each other.
 *
 * The native `RL_PUBLIC` binding (the comment above) made the counting atomic;
 * it did not un-share the bucket. Both bots do send the acting user in
 * `X-User-Discord-ID`, which is what a per-user bucket needs — and the header
 * is only trusted for *bucketing* here, never for identity, which
 * `authMiddleware` still establishes from the signature.
 *
 * Both key kinds stay BARE (a snowflake or an address, no `user:`/`ip:`
 * discriminator) for two reasons: they cannot collide — an IPv4 carries dots
 * and an IPv6 colons, a snowflake is digits only — and `scopeRateLimitKey`
 * classifies a bare key by shape, so the fail-open warning still reports `ip`
 * or `id` rather than `unscoped`, which is the FINDING-011 property that
 * a log line names the bucket CLASS and never the client.
 */
function publicRateLimitKey(c: Context<{ Bindings: Env }>): string {
  const actingUser = c.req.header('X-User-Discord-ID');
  if (actingUser && /^\d{17,20}$/.test(actingUser)) {
    return actingUser;
  }
  return getClientIp(c.req.raw);
}

/**
 * Build a fresh public rate-limit middleware (100/minute per bucket).
 * A factory so tests can exercise backend selection per instance; production
 * uses the single `publicRateLimitMiddleware` below.
 */
export function createPublicRateLimitMiddleware(): MiddlewareHandler {
  return rateLimitMiddleware({
    backend: (c: Context<{ Bindings: Env }>) => selectPublicRateLimiter(c.env),
    keyExtractor: publicRateLimitKey,
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
