/**
 * Rate Limiter Service
 *
 * Adapter over @xivdyetools/worker-kit/rate-limiter for the Universalis proxy.
 * Provides a seconds-based interface for the router.
 *
 * SECURITY: Prevents abuse of the proxy and protects upstream Universalis API.
 *
 * FINDING-011 (2026-10-03 security audit): the proxy used to count in a
 * module-scope, per-isolate `MemoryRateLimiter` (BUG-066), which a client
 * routed across isolates simply outran, and which contradicted the privacy
 * guide's statement that the counting is done by Cloudflare's own
 * rate-limiting service. It now counts through the native Workers Rate
 * Limiting bindings (`UNIVERSALIS_RATE_LIMITER` per client IP,
 * `UNIVERSALIS_SERVICE_RATE_LIMITER` for the service-binding key), with KV
 * (`RATE_LIMIT`) as the fallback where a binding is absent. Counters are
 * per colo, not per isolate.
 *
 * @module services/rate-limiter
 */

import {
  CloudflareRateLimiter,
  KVRateLimiter,
  type RateLimiter,
  type RateLimiterLogger,
} from '@xivdyetools/worker-kit/rate-limiter';
import type { Env } from '../../types.js';

/**
 * Rate limit configuration (seconds-based interface)
 */
export interface RateLimitConfig {
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/**
 * Rate limit check result (seconds-based interface)
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /**
   * Remaining requests in the current window. The native binding does not
   * expose a count: it reports `limit - 1` while allowed and `0` when denied.
   */
  remaining: number;
  /** Seconds until the rate limit window resets */
  resetInSeconds: number;
}

/** Whose budget a request draws on: one public client IP, or our own workers over a service binding. */
export type ProxyRateLimitScope = 'ip' | 'service';

/**
 * Pick the backend for one request: the native binding for the scope when it
 * is bound, KV otherwise.
 *
 * BUG-004: built per request from `env` — never a module-scope singleton —
 * because `env` is only available per request and a binding can differ per
 * deployment. Construction is cheap (stores the binding reference). It throws
 * if a bound value has no callable `limit()` (a misnamed binding), which is
 * deliberate: call it OUTSIDE any hook whose errors are swallowed.
 *
 * The logger only ever receives a `keyScope` (the prefix) from the backends,
 * never the raw client IP.
 */
export function selectProxyRateLimiter(
  env: Env,
  scope: ProxyRateLimitScope,
  config: RateLimitConfig,
  logger?: RateLimiterLogger
): RateLimiter {
  const binding =
    scope === 'ip' ? env.UNIVERSALIS_RATE_LIMITER : env.UNIVERSALIS_SERVICE_RATE_LIMITER;
  const keyPrefix = scope === 'ip' ? 'universalis:ip:' : 'universalis:svc:';
  if (binding) {
    return new CloudflareRateLimiter({
      // The tier's limit mirrors the binding's `simple.limit` in wrangler.toml
      // (tests/wrangler-config.test.ts pins the two together); a single tier
      // is selected whatever the config asks for.
      tiers: [
        {
          limit: config.maxRequests,
          periodSeconds: config.windowSeconds === 10 ? 10 : 60,
          binding,
        },
      ],
      keyPrefix,
      logger,
    });
  }
  return new KVRateLimiter({ kv: env.RATE_LIMIT, keyPrefix, logger });
}

/**
 * Check if a request should be rate limited
 *
 * Fail-open: a backend error admits the request (the Cache API and request
 * coalescer are what actually protect upstream; this is a soft brake).
 *
 * @param limiter - Backend from {@link selectProxyRateLimiter}
 * @param identifier - Unique identifier (client IP, or the service key)
 * @param config - Rate limit configuration (seconds-based)
 * @returns Promise resolving to rate limit result
 */
export async function checkRateLimit(
  limiter: RateLimiter,
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const result = await limiter.check(identifier, {
    maxRequests: config.maxRequests,
    windowMs: config.windowSeconds * 1000,
    failOpen: true,
  });

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetInSeconds: result.retryAfter ?? config.windowSeconds,
  };
}

/**
 * Get rate limit headers for the response
 *
 * @param result - Rate limit check result
 * @param maxRequests - Maximum requests per window
 * @returns Headers object with rate limit information
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  maxRequests: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(
      Math.floor(Date.now() / 1000) + result.resetInSeconds
    ),
  };
}
