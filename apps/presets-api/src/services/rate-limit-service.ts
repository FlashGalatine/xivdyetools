/**
 * Rate Limit Service
 * Tracks per-user daily quotas for quota-bearing mutations.
 *
 * REFACTOR-016 (2026-07-18 audit): this module owns *submission* limits only.
 * IP-based limiting lives in middleware/rate-limit.ts — the duplicate
 * MemoryRateLimiter singleton and dead checkPublicRateLimit/getClientIp
 * exports that used to live here consumed a different bucket than the
 * middleware and were removed.
 *
 * FINDING-008 / PAPI-1 (2026-08-21 security audit): the daily submission cap
 * counted SURVIVING rows in `presets`, so an author could delete their own
 * presets and submit again all day; flagged edits and preview-image uploads
 * (each fanning out a moderation embed, a Perspective call and dead-letter
 * rows) had no per-user cap at all. Every quota-bearing mutation now also
 * writes an append-only `submission_events` row (migration 0011) that user
 * actions never delete, and the caps count those rows — the live-row count is
 * kept as a second, cheaper signal for submissions.
 */

import type { RateLimitResult, RetentionLogger } from '../types.js';

/** Maximum submissions per user per day */
export const DAILY_SUBMISSION_LIMIT = 10;

/** Maximum content edits per user per day that get flagged for moderation */
export const DAILY_FLAGGED_EDIT_LIMIT = 10;

/** Maximum preview-image uploads/replacements per user per day */
export const DAILY_PREVIEW_UPLOAD_LIMIT = 20;

/**
 * Maximum name/description edits per user per day, counted BEFORE the content
 * is moderated.
 *
 * FINDING-005 (2026-08-29 security audit): `DAILY_FLAGGED_EDIT_LIMIT` above is
 * charged only to an edit that reaches a moderator, and it is charged *after*
 * the Perspective call it is meant to bound — so a stream of edits that
 * moderation clears, or that lands on a `flagged` preset (which notifies
 * nobody at all), drove Perspective to its ~1 QPS quota for free. This cap is
 * checked before the call, for every status, so a name/description edit costs
 * a slot whatever moderation goes on to decide. Deliberately generous: an author
 * polishing one preset's wording should never meet it.
 */
export const DAILY_TEXT_EDIT_LIMIT = 30;

/** Kinds of quota-bearing events recorded in `submission_events`. */
export type SubmissionEventKind =
  | 'submission'
  | 'flagged_edit'
  | 'preview_upload'
  // FINDING-005: needs migration 0012 before rows of this kind can be written
  | 'text_edit';

const DAILY_LIMITS: Record<SubmissionEventKind, number> = {
  submission: DAILY_SUBMISSION_LIMIT,
  flagged_edit: DAILY_FLAGGED_EDIT_LIMIT,
  preview_upload: DAILY_PREVIEW_UPLOAD_LIMIT,
  text_edit: DAILY_TEXT_EDIT_LIMIT,
};

/**
 * Count a user's surviving submissions for the current UTC day.
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
 * Count a user's append-only events of one kind for the current UTC day.
 * Unlike the row count above, nothing the user can do lowers this number.
 */
export async function getEventCountToday(
  db: D1Database,
  userDiscordId: string,
  kind: SubmissionEventKind
): Promise<number> {
  const today = getStartOfDayUTC();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const query = `
    SELECT COUNT(*) as count
    FROM submission_events
    WHERE user_discord_id = ?
      AND kind = ?
      AND created_at >= ?
      AND created_at < ?
  `;

  const result = await db
    .prepare(query)
    .bind(userDiscordId, kind, today.toISOString(), tomorrow.toISOString())
    .first<{ count: number }>();

  return result?.count || 0;
}

/**
 * FINDING-017 (2026-08-29 security audit): how long a quota event is kept.
 *
 * The log was append-only in the strongest possible sense — nothing anywhere
 * deleted a row, so a `(user id, kind, timestamp)` triple naming someone's
 * activity outlived their presets, their deletion request and the bot's own
 * retention table, which had no line for it. Thirty days is thirty times what
 * the caps need: every count is "this user, this kind, since UTC midnight",
 * so nothing the prune can reach was ever counted by one, and
 * FINDING-008's rule that *user actions* never delete a row still holds — this
 * one is age-based and cannot be triggered from the outside.
 */
export const SUBMISSION_EVENT_RETENTION_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * FINDING-017: drop events that have aged out, on the write path (presets-api
 * has no cron trigger). Never throws, and deliberately not batched with the
 * INSERT that follows: a D1 batch is atomic, so a failed prune would discard
 * the append-only row the daily caps depend on. Logs counts only.
 */
async function pruneSubmissionEvents(db: D1Database, logger?: RetentionLogger): Promise<void> {
  // `created_at` is strftime('%Y-%m-%dT%H:%M:%fZ', 'now') — the exact format
  // Date#toISOString produces, and the one getEventCountToday already binds.
  const cutoff = new Date(Date.now() - SUBMISSION_EVENT_RETENTION_DAYS * MS_PER_DAY).toISOString();

  try {
    const result = await db
      .prepare('DELETE FROM submission_events WHERE created_at < ?')
      .bind(cutoff)
      .run();

    const pruned = result.meta.changes || 0;
    if (pruned > 0) {
      logger?.warn('[FINDING-017] pruned submission events', { pruned });
    }
  } catch {
    logger?.warn('[FINDING-017] submission-event prune failed', { pruned: 0 });
  }
}

/**
 * Record one quota-bearing event. Best-effort from the caller's point of view
 * (a failed insert must not fail the mutation the user just completed), but
 * callers should still `await` it so the row lands before the response.
 */
export async function recordSubmissionEvent(
  db: D1Database,
  userDiscordId: string,
  kind: SubmissionEventKind,
  presetId: string | null = null,
  logger?: RetentionLogger
): Promise<void> {
  await pruneSubmissionEvents(db, logger);

  await db
    .prepare(
      `INSERT INTO submission_events (user_discord_id, kind, preset_id) VALUES (?, ?, ?)`
    )
    .bind(userDiscordId, kind, presetId)
    .run();
}

/**
 * Check a per-user daily cap for one event kind (append-only count).
 */
export async function checkDailyEventLimit(
  db: D1Database,
  userDiscordId: string,
  kind: SubmissionEventKind,
  limit: number = DAILY_LIMITS[kind]
): Promise<RateLimitResult> {
  const used = await getEventCountToday(db, userDiscordId, kind);
  return {
    allowed: used < limit,
    remaining: Math.max(0, limit - used),
    resetAt: getNextResetUTC(),
  };
}

/**
 * Check if a user can submit a preset
 * Returns rate limit status and remaining submissions
 *
 * Counts BOTH surviving rows (cheap, pre-0011 behaviour) and append-only
 * submission events — whichever is higher is the number that counts, so
 * deleting your own presets no longer refills the quota.
 */

/**
 * The submission count the daily cap is actually enforced on.
 *
 * BUG-042: this rule lived only inside `checkSubmissionRateLimit`, so
 * `POST /presets` used the raw `presets` row count for BOTH its overshoot
 * rollback and the `remaining_submissions` it reports. For anyone who had
 * deleted a preset that day the two disagreed: submit 3, delete 3, submit a
 * 4th, and the 201 said 9 remaining while `GET /presets/rate-limit` said 6 —
 * and the user was refused at 6. Worse, the BUG-049 concurrency rollback
 * under-triggered for exactly the deleting user that `submission_events` was
 * introduced (FINDING-008) to catch.
 */
export async function getEffectiveSubmissionCountToday(
  db: D1Database,
  userDiscordId: string
): Promise<number> {
  const [rowsToday, eventsToday] = await Promise.all([
    getSubmissionCountToday(db, userDiscordId),
    getEventCountToday(db, userDiscordId, 'submission'),
  ]);
  return Math.max(rowsToday, eventsToday);
}
export async function checkSubmissionRateLimit(
  db: D1Database,
  userDiscordId: string
): Promise<RateLimitResult> {
  const submissionsToday = await getEffectiveSubmissionCountToday(db, userDiscordId);
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
