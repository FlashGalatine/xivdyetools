/**
 * Rate Limit Middleware
 *
 * Two layers, because the two things worth limiting are not the same thing:
 *
 * 1. `publicRateLimitMiddleware` — keyed on the client IP, mounted on `/api/*`
 *    BEFORE `authMiddleware`. This is the edge gate: it costs nothing, it
 *    cannot be steered by the caller, and it runs before any crypto does.
 * 2. `perUserRateLimitMiddleware` — keyed on the acting Discord user, mounted
 *    AFTER `authMiddleware`. This is the fairness gate, and it reads an
 *    identity the signature has already established.
 *
 * REFACTOR-002: Uses the shared rateLimitMiddleware factory from
 * @xivdyetools/worker-kit for consistent header formatting and error handling.
 *
 * FINDING-003 (2026-08-21 security audit): when the native Workers Rate
 * Limiting binding `RL_PUBLIC` (`[[ratelimits]]`, limit 100 / 60 s) is bound,
 * it is used — atomic per-colo counting. The per-isolate memory limiter stays
 * as the fallback for dev/tests.
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
import type { AuthContext, Env } from '../types.js';

/**
 * Singleton memory limiter for IP-based limiting (fallback).
 * Preserves PRESETS-BUG-001 fix via shared package implementation.
 */
const ipRateLimiter = new MemoryRateLimiter({
  maxEntries: 10_000,
  cleanupInterval: 100,
});

/**
 * Singleton memory limiter for the per-user layer (fallback).
 *
 * Deliberately a SECOND instance rather than a shared one: the two layers key
 * on different alphabets and must not be able to evict each other's entries
 * out of one 10,000-entry map.
 */
const userRateLimiter = new MemoryRateLimiter({
  maxEntries: 10_000,
  cleanupInterval: 100,
});

const PUBLIC_LIMIT = PUBLIC_API_LIMITS.default;

/** Native binding when bound, memory otherwise (exported for tests). */
export function selectPublicRateLimiter(env: Env): RateLimiter {
  if (env.RL_PUBLIC) {
    return new CloudflareRateLimiter({
      tiers: [{ limit: PUBLIC_LIMIT.maxRequests, periodSeconds: 60, binding: env.RL_PUBLIC }],
      keyPrefix: 'public:',
    });
  }
  return ipRateLimiter;
}

/**
 * Native binding when bound, memory otherwise, for the per-user layer.
 *
 * The `user:` prefix is what keeps this layer's counters off the `public:`
 * layer's, since both share the one `RL_PUBLIC` binding and both run at
 * (100, 60s) — so the tier suffix alone would not separate them.
 */
export function selectUserRateLimiter(env: Env): RateLimiter {
  if (env.RL_PUBLIC) {
    return new CloudflareRateLimiter({
      tiers: [{ limit: PUBLIC_LIMIT.maxRequests, periodSeconds: 60, binding: env.RL_PUBLIC }],
      keyPrefix: 'user:',
    });
  }
  return userRateLimiter;
}

/**
 * The bucket an edge request counts against.
 *
 * BUG-044 keyed this on the `X-User-Discord-ID` header whenever it was
 * snowflake-shaped. That header is caller-supplied, and this middleware is
 * mounted on `/api/*` ELEVEN LINES ahead of `authMiddleware`, so at
 * key-computation time nothing has verified it. Anyone could mint a fresh
 * 100/min bucket per request by incrementing a header, which removed the
 * per-IP ceiling entirely — the header's own JSDoc said it was "trusted for
 * bucketing only, never for identity", but bucketing IS the limit.
 *
 * So this is the IP again, and it is never anything else. Per-user fairness —
 * the real problem BUG-044 set out to solve — is now
 * `perUserRateLimitMiddleware`, which runs after the signature check.
 */
function publicRateLimitKey(c: Context<{ Bindings: Env }>): string {
  return getClientIp(c.req.raw);
}

/**
 * The acting user, but only once `authMiddleware` has authenticated them.
 *
 * Reading `auth` rather than the header is the whole point: in production a
 * bot request only reaches `isAuthenticated` after its v2 HMAC signature
 * verifies, so this key cannot be chosen by the caller.
 */
function actingUserId(c: Context): string | undefined {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth?.isAuthenticated) return undefined;
  return auth.userDiscordId;
}

/**
 * Build a fresh public rate-limit middleware (100/minute per IP).
 * A factory so tests can exercise backend selection per instance; production
 * uses the single `publicRateLimitMiddleware` below.
 *
 * Requests with no `CF-Connecting-IP` SKIP this layer. Cloudflare sets that
 * header at the edge, overwriting anything a client sends, so a request
 * arriving on a public route always carries one; its absence means the caller
 * is a Service Binding in this same account, which is not reachable from
 * outside. Counting those here is what BUG-044 was actually complaining
 * about — `getClientIp` answers the literal `'unknown'` for every one of
 * them, so both bots' entire traffic, every Discord user in every guild,
 * shared a single 100/min bucket and `/preset` commands 429'd each other at
 * ~1.7 req/s aggregate. They are limited per-user instead, below.
 */
export function createPublicRateLimitMiddleware(): MiddlewareHandler {
  const limit = rateLimitMiddleware({
    backend: (c: Context<{ Bindings: Env }>) => selectPublicRateLimiter(c.env),
    keyExtractor: publicRateLimitKey,
    config: PUBLIC_LIMIT,
  });

  return async (c, next) => {
    if (!c.req.raw.headers.get('CF-Connecting-IP')) return next();
    return limit(c, next);
  };
}

/**
 * Build a fresh per-user rate-limit middleware (100/minute per Discord user).
 *
 * Mount AFTER `authMiddleware`. An unauthenticated request passes straight
 * through — it has no user to bucket on, and the IP layer above has already
 * counted it.
 */
export function createPerUserRateLimitMiddleware(): MiddlewareHandler {
  const limit = rateLimitMiddleware({
    backend: (c: Context<{ Bindings: Env }>) => selectUserRateLimiter(c.env),
    keyExtractor: (c: Context) => actingUserId(c) ?? 'anonymous',
    config: PUBLIC_LIMIT,
  });

  return async (c, next) => {
    if (!actingUserId(c)) return next();
    return limit(c, next);
  };
}

/**
 * Rate limiting middleware for public endpoints
 * Limits requests to 100/minute per IP
 *
 * Returns 429 Too Many Requests if limit exceeded, with retry-after header
 */
export const publicRateLimitMiddleware = createPublicRateLimitMiddleware();

/**
 * Rate limiting middleware for authenticated callers
 * Limits requests to 100/minute per acting Discord user
 */
export const perUserRateLimitMiddleware = createPerUserRateLimitMiddleware();
