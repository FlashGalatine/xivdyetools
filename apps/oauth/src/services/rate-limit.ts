/**
 * Rate Limiting Service for OAuth Endpoints
 *
 * Implements IP-based sliding window rate limiting to protect auth endpoints
 * from abuse (brute force attacks, credential stuffing, etc.)
 *
 * REFACTOR-002: Uses @xivdyetools/rate-limiter shared package
 * REFACTOR-006/OPT-004 (2026-07-18 audit): the dead Durable Object limiter was
 * deleted. When a KV namespace is provided (TOKEN_BLACKLIST, under an 'rl:'
 * prefix so keys can't collide with revocation entries), limiting is backed
 * by KV so counters are globally meaningful instead of per-isolate — a
 * per-isolate memory limiter let distributed attackers exceed the configured
 * limits by a large multiple. Falls back to the in-memory limiter when no KV
 * is bound (dev/tests); KV errors fail open inside KVRateLimiter.
 *
 * Limits:
 * - /auth/discord: 10 req/min per IP (initiate login)
 * - /auth/callback: 20 req/min per IP (token exchange)
 * - /auth/refresh: 30 req/min per IP (token refresh)
 */

import {
  MemoryRateLimiter,
  KVRateLimiter,
  getClientIp as sharedGetClientIp,
  getOAuthLimit,
  type RateLimiter,
} from '@xivdyetools/rate-limiter';

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
 * Fallback in-memory limiter (per-isolate; dev/tests or missing KV binding)
 */
const memoryLimiter = new MemoryRateLimiter({
  maxEntries: 10_000,
  cleanupInterval: 100,
});

/**
 * Per-isolate KVRateLimiter instance cache — the instance is cheap but there
 * is no reason to reconstruct it per request. State lives in KV, not here.
 */
let kvLimiter: KVRateLimiter | null = null;

function getLimiter(kv?: KVNamespace): RateLimiter {
  if (!kv) return memoryLimiter;
  if (!kvLimiter) {
    kvLimiter = new KVRateLimiter({ kv, keyPrefix: 'rl:' });
  }
  return kvLimiter;
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
 * @param kv - Optional KV namespace for globally consistent counters (OPT-004)
 * @returns Rate limit result
 */
export async function checkRateLimit(
  ip: string,
  path: string,
  kv?: KVNamespace
): Promise<RateLimitResult> {
  const config = getOAuthLimit(path);
  // Use compound key for path-specific rate limiting
  const key = `${ip}:${path}`;

  const result = await getLimiter(kv).check(key, config);

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
}
