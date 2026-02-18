/**
 * Rate Limit Service
 * Tracks submission limits per user per day
 * Limit: 10 submissions per user per day
 *
 * Also provides IP-based rate limiting for public endpoints
 * Limit: 100 requests per minute per IP (sliding window)
 *
 * REFACTOR-002: IP-based rate limiting now uses @xivdyetools/rate-limiter
 */

import {
  MemoryRateLimiter,
  getClientIp as sharedGetClientIp,
  PUBLIC_API_LIMITS,
} from '@xivdyetools/rate-limiter';
import type { RateLimitResult } from '../types.js';

// ============================================
// IP-BASED RATE LIMITING (PUBLIC ENDPOINTS)
// Uses shared @xivdyetools/rate-limiter package
// ============================================

/**
 * Singleton rate limiter instance for IP-based limiting
 * Preserves PRESETS-BUG-001 fix via shared package implementation
 */
const ipRateLimiter = new MemoryRateLimiter({
  maxEntries: 10_000, // Match previous behavior
  cleanupInterval: 100, // Match previous probability-based cleanup
});

/**
 * Check if an IP is within rate limits for public endpoints
 * Uses sliding window algorithm via shared rate-limiter package
 *
 * @param ip - Client IP address (from CF-Connecting-IP header)
 * @returns Rate limit result with allowed status and remaining requests
 */
export async function checkPublicRateLimit(ip: string): Promise<RateLimitResult> {
  const result = await ipRateLimiter.check(ip, PUBLIC_API_LIMITS.default);

  // Map to existing RateLimitResult interface from @xivdyetools/types
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.resetAt,
    kvError: result.backendError,
  };
}

/**
 * Get client IP from request headers
 * Uses CF-Connecting-IP which Cloudflare sets to the real client IP
 *
 * @param request - The incoming request
 * @returns Client IP or 'unknown' if not found
 */
export function getClientIp(request: Request): string {
  return sharedGetClientIp(request);
}

// ============================================
// D1-BASED SUBMISSION RATE LIMITING
// User-level daily limits tracked in database
// ============================================

/**
 * Maximum submissions per user per day
 */
const DAILY_SUBMISSION_LIMIT = 10;

/**
 * Check if a user can submit a preset
 * Returns rate limit status and remaining submissions
 */
export async function checkSubmissionRateLimit(
  db: D1Database,
  userDiscordId: string
): Promise<RateLimitResult> {
  const today = getStartOfDayUTC();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  // Count submissions today for this user
  const query = `
    SELECT COUNT(*) as count
    FROM presets
    WHERE author_discord_id = ?
      AND created_at >= ?
      AND created_at < ?
  `;

  const result = await db
    .prepare(query)
    .bind(userDiscordId, today.toISOString(), tomorrow.toISOString())
    .first<{ count: number }>();

  const submissionsToday = result?.count || 0;
  const remaining = Math.max(0, DAILY_SUBMISSION_LIMIT - submissionsToday);

  return {
    allowed: submissionsToday < DAILY_SUBMISSION_LIMIT,
    remaining,
    resetAt: tomorrow,
  };
}

/**
 * Get remaining submissions for a user today
 * Useful for displaying in the UI
 */
export async function getRemainingSubmissions(
  db: D1Database,
  userDiscordId: string
): Promise<{ remaining: number; resetAt: Date }> {
  const result = await checkSubmissionRateLimit(db, userDiscordId);
  return {
    remaining: result.remaining,
    resetAt: result.resetAt,
  };
}

/**
 * Get the start of the current day in UTC
 */
function getStartOfDayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
