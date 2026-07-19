/**
 * Rate Limit Service
 * Tracks submission limits per user per day
 * Limit: 10 submissions per user per day
 *
 * REFACTOR-016 (2026-07-18 audit): this module owns *submission* limits only.
 * IP-based limiting lives in middleware/rate-limit.ts — the duplicate
 * MemoryRateLimiter singleton and dead checkPublicRateLimit/getClientIp
 * exports that used to live here consumed a different bucket than the
 * middleware and were removed.
 */

import type { RateLimitResult } from '../types.js';

/**
 * Maximum submissions per user per day
 */
export const DAILY_SUBMISSION_LIMIT = 10;

/**
 * Count a user's submissions for the current UTC day.
 *
 * BUG-049 (2026-07-18 audit): exported so the submission handler can re-check
 * after its INSERT — the pre-check alone is check-then-insert and concurrent
 * requests could exceed the cap.
 */
export async function getSubmissionCountToday(
  db: D1Database,
  userDiscordId: string
): Promise<number> {
  const today = getStartOfDayUTC();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

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

  return result?.count || 0;
}

/**
 * Check if a user can submit a preset
 * Returns rate limit status and remaining submissions
 */
export async function checkSubmissionRateLimit(
  db: D1Database,
  userDiscordId: string
): Promise<RateLimitResult> {
  const submissionsToday = await getSubmissionCountToday(db, userDiscordId);
  const remaining = Math.max(0, DAILY_SUBMISSION_LIMIT - submissionsToday);

  return {
    allowed: submissionsToday < DAILY_SUBMISSION_LIMIT,
    remaining,
    resetAt: getNextResetUTC(),
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

/**
 * When the daily submission window resets (start of the next UTC day)
 */
export function getNextResetUTC(): Date {
  return new Date(getStartOfDayUTC().getTime() + 24 * 60 * 60 * 1000);
}
