/**
 * Durable Objects Rate Limiter Service
 * Wrapper around RateLimiter DO for easy migration from in-memory
 *
 * This service provides the same interface as the in-memory rate limiter
 * but uses Durable Objects for persistence across worker restarts and
 * consistency across edge locations.
 */

import { getOAuthLimit } from '@xivdyetools/rate-limiter';

/**
 * Rate limit check result
 * Matches the interface from services/rate-limit.ts for easy migration
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Check rate limit using Durable Objects
 *
 * @param ip - Client IP address
 * @param path - Request path (e.g., "/auth/discord")
 * @param rateLimiterNamespace - Durable Object namespace binding
 * @returns Rate limit result
 */
export async function checkRateLimitDO(
  ip: string,
  path: string,
  rateLimiterNamespace: DurableObjectNamespace
): Promise<RateLimitResult> {
  // BUG-007 (2026-07-18 audit): shared longest-prefix routing instead of a
  // local copy with '/auth/xivauth' shadowing '/auth/xivauth/callback'
  const config = getOAuthLimit(path);

  try {
    // Get DO instance for this IP
    // Using idFromName ensures the same IP always gets the same DO instance
    const id = rateLimiterNamespace.idFromName(ip);
    const stub = rateLimiterNamespace.get(id);

    // Call DO to check rate limit
    const response = await stub.fetch('https://rate-limiter/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: path, config }),
    });

    if (!response.ok) {
      // DO error - fail open for availability
      console.error('Rate limiter DO error:', {
        status: response.status,
        statusText: response.statusText,
      });
      return {
        allowed: true, // Fail-open: allow request if DO fails
        remaining: config.maxRequests,
        resetAt: new Date(Date.now() + config.windowMs),
        limit: config.maxRequests,
      };
    }

    const result = await response.json<RateLimitResult>();

    // Convert resetAt string back to Date object
    return {
      ...result,
      resetAt: new Date(result.resetAt),
    };
  } catch (err) {
    // DO communication error - fail open for availability
    console.error('Rate limiter DO communication error:', err);
    return {
      allowed: true, // Fail-open: allow request on error
      remaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowMs),
      limit: config.maxRequests,
    };
  }
}
