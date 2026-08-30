/**
 * Rate Limiting Service for OAuth Endpoints
 *
 * Implements IP-based rate limiting to protect auth endpoints from abuse
 * (brute force attacks, credential stuffing, etc.)
 *
 * REFACTOR-002: Uses @xivdyetools/worker-kit/rate-limiter shared package
 * REFACTOR-006/OPT-004 (2026-07-18 audit): the dead Durable Object limiter was
 * deleted; KV-backed counters replaced the per-isolate memory limiter.
 *
 * FINDING-003 (2026-08-21 security audit): KV cannot throttle a fast client
 * (1 write/s/key, swallowed put failures, eventually-consistent reads, fail-open),
 * so the auth endpoints were effectively unthrottled against the one pattern
 * that matters here — a single client hammering token exchange. Backend
 * selection is now, in order:
 *   1. native Workers Rate Limiting bindings (`RL_AUTH_10` / `RL_AUTH_20` /
 *      `RL_AUTH_30`, one per distinct per-minute limit; atomic, per-colo)
 *   2. KV (`TOKEN_BLACKLIST` under an 'rl:' prefix) — legacy fallback
 *   3. per-isolate memory (dev/tests)
 *
 * Limits (per IP, per path — see OAUTH_LIMITS):
 * - /auth/discord, /auth/xivauth: 10 req/min (initiate login)
 * - /auth/callback, /auth/xivauth/callback: 20 req/min (token exchange)
 * - /auth/me, /auth/revoke and everything else: 30 req/min (OAUTH_LIMITS.default)
 */

import {
  MemoryRateLimiter,
  KVRateLimiter,
  CloudflareRateLimiter,
  getClientIp as sharedGetClientIp,
  getOAuthLimit,
  type RateLimiter,
  type CloudflareRateLimitTier,
} from '@xivdyetools/worker-kit/rate-limiter';
import type { Env } from '../types.js';

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Backends available to the limiter, in priority order (see module doc).
 */
export interface RateLimitBackends {
  /** Native Workers Rate Limiting bindings, one tier per distinct limit */
  cloudflare?: CloudflareRateLimitTier[];
  /** KV namespace for globally consistent counters (legacy fallback) */
  kv?: KVNamespace;
}

/** Key prefix shared by the KV and binding backends (keeps KV keys clear of revocation entries). */
const KEY_PREFIX = 'rl:';

/**
 * Map the worker's `RL_AUTH_*` bindings to limiter tiers. Any subset works —
 * the limiter routes each config to the smallest tier that fits and falls
 * back to the largest — but production binds all three so every OAUTH_LIMITS
 * value has an exact tier.
 */
export function oauthRateLimitTiers(
  env: Pick<Env, 'RL_AUTH_10' | 'RL_AUTH_20' | 'RL_AUTH_30'>
): CloudflareRateLimitTier[] {
  const tiers: CloudflareRateLimitTier[] = [];
  if (env.RL_AUTH_10) tiers.push({ limit: 10, periodSeconds: 60, binding: env.RL_AUTH_10 });
  if (env.RL_AUTH_20) tiers.push({ limit: 20, periodSeconds: 60, binding: env.RL_AUTH_20 });
  if (env.RL_AUTH_30) tiers.push({ limit: 30, periodSeconds: 60, binding: env.RL_AUTH_30 });
  return tiers;
}

/**
 * Fallback in-memory limiter (per-isolate; dev/tests or no binding/KV)
 */
const memoryLimiter = new MemoryRateLimiter({
  maxEntries: 10_000,
  cleanupInterval: 100,
});

/**
 * Per-isolate instance caches — the instances are cheap but there is no
 * reason to reconstruct them per request. State lives in the binding / KV.
 */
let kvLimiter: KVRateLimiter | null = null;
let cloudflareLimiter: CloudflareRateLimiter | null = null;

function getLimiter(backends: RateLimitBackends | undefined): RateLimiter {
  if (backends?.cloudflare && backends.cloudflare.length > 0) {
    if (!cloudflareLimiter) {
      cloudflareLimiter = new CloudflareRateLimiter({
        tiers: backends.cloudflare,
        keyPrefix: KEY_PREFIX,
      });
    }
    return cloudflareLimiter;
  }
  if (backends?.kv) {
    if (!kvLimiter) {
      kvLimiter = new KVRateLimiter({ kv: backends.kv, keyPrefix: KEY_PREFIX });
    }
    return kvLimiter;
  }
  return memoryLimiter;
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  return sharedGetClientIp(request);
}

/**
 * Check if a request is within rate limits
 *
 * BUG-007 (2026-07-18 audit): path→config routing comes from the shared
 * package's getOAuthLimit (longest prefix wins).
 *
 * @param ip - Client IP address
 * @param path - Request path (e.g., "/auth/discord")
 * @param backends - Optional backends (bindings preferred, then KV); memory when omitted
 * @returns Rate limit result
 */
export async function checkRateLimit(
  ip: string,
  path: string,
  backends?: RateLimitBackends
): Promise<RateLimitResult> {
  const config = getOAuthLimit(path);
  // Use compound key for path-specific rate limiting
  const key = `${ip}:${path}`;

  const result = await getLimiter(backends).check(key, config);

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.resetAt,
    limit: result.limit,
  };
}

/**
 * Reset the rate limiter (for testing purposes)
 */
export async function resetRateLimiter(): Promise<void> {
  await memoryLimiter.resetAll();
  kvLimiter = null;
  cloudflareLimiter = null;
}
