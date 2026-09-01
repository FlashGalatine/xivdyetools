/**
 * Rate Limiting Middleware for Cloudflare Workers
 *
 * Implements per-user rate limiting using KV storage with a sliding window pattern.
 * Protects against:
 * - Resource exhaustion attacks
 * - Database query flooding through autocomplete
 * - Rapid button clicks and command spam
 *
 * REFACTOR-002: Now uses @xivdyetools/rate-limiter shared package
 *
 * Rate limits are enforced per Discord user ID and interaction type:
 * - Commands: 20 requests/minute (with 5 burst allowance)
 * - Autocomplete: 60 requests/minute (with 10 burst allowance)
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/kv/
 *
 * @example
 * ```typescript
 * import { rateLimitMiddleware } from './middleware/rate-limit.js';
 *
 * app.use('*', rateLimitMiddleware);
 * ```
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types/env.js';
import {
  KVRateLimiter,
  CloudflareRateLimiter,
  getModerationLimit,
  type ExtendedRateLimiter,
  type RateLimitBinding,
} from '@xivdyetools/worker-kit/rate-limiter';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests allowed per minute */
  requestsPerMinute: number;

  /**
   * Burst allowance (extra requests allowed temporarily)
   * Useful for legitimate users who click slightly too fast
   */
  burstAllowance?: number;
}

/**
 * Result of rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;

  /** Number of requests remaining in current window */
  remaining: number;

  /** Unix timestamp (ms) when rate limit resets */
  resetTime: number;

  /** Seconds to wait before retrying (only set if !allowed) */
  retryAfter?: number;

  /**
   * FINDING-012 (2026-08-29 security audit): set when the underlying backend
   * (the native Cloudflare binding, or worker-kit's KV backend — both set it,
   * see `packages/worker-kit/src/rate-limiter/backends/kv.ts`) errored and the
   * request was allowed through on the fail-open trade-off. The limiter below
   * is a per-isolate singleton and so cannot hold a request-scoped logger —
   * the caller (index.ts's command / autocomplete paths) reads this flag and
   * logs the event with the logger it has for THIS request. Deliberately not
   * surfaced to the client in any header: that would tell an abuser exactly
   * when the limiter is off.
   */
  backendError?: boolean;
}

/**
 * Type of interaction for rate limiting purposes
 */
export type RateLimitType = 'command' | 'autocomplete';

/**
 * Rate limit configurations for different interaction types
 *
 * Sourced from the shared `MODERATION_LIMITS` preset (via `getModerationLimit`)
 * in `@xivdyetools/worker-kit/rate-limiter` — this middleware's config shape
 * (`requestsPerMinute`) predates and differs from the shared package's
 * (`maxRequests` + `windowMs`), so the numbers are adapted here rather than
 * duplicated.
 */
export const RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
  command: toLegacyConfig(getModerationLimit('command')),
  autocomplete: toLegacyConfig(getModerationLimit('autocomplete')),
};

/**
 * Adapt the shared `{ maxRequests, windowMs, burstAllowance }` preset shape
 * to this middleware's pre-existing `{ requestsPerMinute, burstAllowance }`
 * shape. The shared presets are always expressed per-minute (`windowMs:
 * 60_000`), so `windowMs` is dropped rather than carried through.
 */
function toLegacyConfig(config: { maxRequests: number; burstAllowance?: number }): RateLimitConfig {
  return {
    requestsPerMinute: config.maxRequests,
    burstAllowance: config.burstAllowance,
  };
}

/**
 * Native Workers Rate Limiting bindings (FINDING-003, 2026-08-21 audit) —
 * one per interaction type because each `[[ratelimits]]` binding carries a
 * single fixed limit: `RL_COMMAND` = 20 + 5 burst, `RL_AUTOCOMPLETE` = 60 + 10.
 * When supplied they replace KV, which cannot throttle a fast client
 * (1 write/s/key, swallowed put failures, eventually-consistent reads).
 */
export interface ModerationRateLimitBindings {
  command?: RateLimitBinding;
  autocomplete?: RateLimitBinding;
}

/** Pull the bindings off the worker env (any may be absent in dev). */
export function moderationRateLimitBindings(
  env: Pick<Env, 'RL_COMMAND' | 'RL_AUTOCOMPLETE'>,
): ModerationRateLimitBindings {
  return { command: env.RL_COMMAND, autocomplete: env.RL_AUTOCOMPLETE };
}

/**
 * Singleton limiter instance (KV or native binding)
 */
let limiterInstance: ExtendedRateLimiter | null = null;

function effectiveLimit(type: RateLimitType): number {
  const cfg = RATE_LIMIT_CONFIGS[type];
  return cfg.requestsPerMinute + (cfg.burstAllowance ?? 0);
}

/**
 * Get or create the rate limiter instance: native bindings when any are
 * supplied, KV otherwise. The native limiter's `checkOnly` consumes a slot and
 * its `increment` is a no-op, so the two-phase call pattern below counts each
 * interaction exactly once on either backend.
 *
 * FINDING-012: deliberately built WITHOUT `options.logger`. This instance
 * outlives the request that created it, and the only loggers this worker has
 * are request-scoped (`c.get('logger')`), so caching one here would attribute
 * every later isolate's fail-open to the first request's id. The flag travels
 * out on `RateLimitResult.backendError` instead and is logged at the call site.
 */
function getLimiter(kv: KVNamespace, bindings?: ModerationRateLimitBindings): ExtendedRateLimiter {
  if (!limiterInstance) {
    const tiers = [];
    if (bindings?.command) {
      tiers.push({ limit: effectiveLimit('command'), periodSeconds: 60 as const, binding: bindings.command });
    }
    if (bindings?.autocomplete) {
      tiers.push({
        limit: effectiveLimit('autocomplete'),
        periodSeconds: 60 as const,
        binding: bindings.autocomplete,
      });
    }
    limiterInstance =
      tiers.length > 0
        ? new CloudflareRateLimiter({ tiers, keyPrefix: 'ratelimit:' })
        : new KVRateLimiter({ kv, keyPrefix: 'ratelimit:' });
  }
  return limiterInstance;
}

/**
 * Check if user has exceeded rate limit
 *
 * Implements sliding window with burst allowance:
 * 1. Get current request count from KV
 * 2. Check against limit + burst allowance
 * 3. Return result with remaining count and reset time
 *
 * @param kv - KV namespace for storing counters
 * @param userId - Discord user ID
 * @param type - Type of interaction
 * @param config - Rate limit configuration
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  kv: KVNamespace,
  userId: string,
  type: RateLimitType,
  config: RateLimitConfig,
  bindings?: ModerationRateLimitBindings,
): Promise<RateLimitResult> {
  const limiter = getLimiter(kv, bindings);
  const key = `${type}:${userId}`;

  // Convert legacy config to shared package format
  const sharedConfig = {
    maxRequests: config.requestsPerMinute,
    windowMs: 60_000, // 1 minute
    burstAllowance: config.burstAllowance,
  };

  const result = await limiter.checkOnly(key, sharedConfig);

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetTime: result.resetAt.getTime(),
    retryAfter: result.retryAfter,
    // FINDING-012: carry the fail-open flag out to the caller, which is where
    // a request-scoped logger exists
    backendError: result.backendError,
  };
}

/**
 * Increment rate limit counter
 *
 * MOD-BUG-001 FIX: Now handled by shared package's KVRateLimiter
 * which uses optimistic concurrency with retries.
 *
 * @param kv - KV namespace for storing counters
 * @param userId - Discord user ID
 * @param type - Type of interaction
 * @param maxRetries - Maximum retry attempts (passed to shared package)
 */
export async function incrementRateLimit(
  kv: KVNamespace,
  userId: string,
  type: RateLimitType,
  _maxRetries: number = 3,
  bindings?: ModerationRateLimitBindings,
): Promise<void> {
  const limiter = getLimiter(kv, bindings);
  const key = `${type}:${userId}`;
  const config = RATE_LIMIT_CONFIGS[type];

  // Convert legacy config to shared package format
  const sharedConfig = {
    maxRequests: config.requestsPerMinute,
    windowMs: 60_000,
    burstAllowance: config.burstAllowance,
  };

  await limiter.increment(key, sharedConfig);
}

/**
 * Get rate limit information for a user
 *
 * Useful for adding rate limit headers to responses.
 *
 * @param kv - KV namespace
 * @param userId - Discord user ID
 * @param type - Type of interaction
 * @returns Current rate limit status
 */
export async function getRateLimitInfo(
  kv: KVNamespace,
  userId: string,
  type: RateLimitType,
): Promise<{ current: number; limit: number; resetTime: number }> {
  const config = RATE_LIMIT_CONFIGS[type];
  const limiter = getLimiter(kv);
  const key = `${type}:${userId}`;

  // Convert legacy config to shared package format
  const sharedConfig = {
    maxRequests: config.requestsPerMinute,
    windowMs: 60_000,
    burstAllowance: config.burstAllowance,
  };

  const result = await limiter.checkOnly(key, sharedConfig);
  const effectiveLimit = config.requestsPerMinute + (config.burstAllowance || 0);

  // On backend error, remaining equals effectiveLimit, so current would be 0
  // Return 0 in that case since we don't know the actual count
  // BUG-004 follow-up: checkOnly no longer subtracts 1 from remaining (read-only),
  // so we no longer need the - 1 offset here either.
  const current = result.backendError ? 0 : Math.max(0, effectiveLimit - result.remaining);

  return {
    current,
    limit: effectiveLimit,
    resetTime: result.resetAt.getTime(),
  };
}

/**
 * Rate limiting middleware for Hono
 *
 * Checks rate limits for Discord interactions and returns 429 if exceeded.
 * Does NOT block the request - just logs violations.
 * Actual rate limit enforcement happens in interaction handlers.
 *
 * @param c - Hono context
 * @param next - Next middleware
 */
export async function rateLimitMiddleware(
  _c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<void> {
  // Pass through - rate limiting is enforced at interaction handler level
  // This middleware just provides the infrastructure
  await next();
}

/**
 * Reset the rate limiter for testing
 */
export function resetRateLimiterInstance(): void {
  limiterInstance = null;
}
