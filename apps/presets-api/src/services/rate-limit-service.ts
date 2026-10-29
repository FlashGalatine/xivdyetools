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
 * counted only when not represented by a matching admission event.
 */

import type { RateLimitResult, RetentionLogger } from '../types.js';

/** Maximum submissions per user per day */
export const DAILY_SUBMISSION_LIMIT = 10;

/** Maximum content edits per user per day that get flagged for moderation */
export const DAILY_FLAGGED_EDIT_LIMIT = 10;

/** Maximum preview-image uploads/replacements per user per day */
export const DAILY_PREVIEW_UPLOAD_LIMIT = 20;

/**
 * Maximum moderated text/metadata edits per user per day, counted BEFORE the content
 * is moderated.
 *
 * FINDING-005 (2026-08-29 security audit): `DAILY_FLAGGED_EDIT_LIMIT` above is
 * charged only to an edit that reaches a moderator, and it is charged *after*
 * the Perspective call it is meant to bound — so a stream of edits that
 * moderation clears, or that lands on a `flagged` preset (which notifies
 * nobody at all), drove Perspective to its ~1 QPS quota for free. This cap is
 * checked before the call, for every status, so a moderated-field edit costs
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
 * Count a user's append-only events of one kind for the current UTC day.
 * Nothing the user can do lowers this number.
 *
 * `upToId` (BUG-015 fix round 2 — deterministic tie-break) restricts the
 * count to rows with `id <= upToId`. Autoincrement ids are monotonic, so
 * passing a reservation's own row id turns the count into "how many rows for
 * this user + kind were inserted at or before mine" — i.e. this request's
 * position in insertion order — rather than every row that exists by the
 * time the COUNT runs. Omitting it keeps the original 4-arg behaviour
 * byte-identical for other callers.
 */
export async function getEventCountToday(
  db: D1Database,
  userDiscordId: string,
  kind: SubmissionEventKind,
  upToId?: number
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
      ${upToId !== undefined ? 'AND id <= ?' : ''}
  `;

  const stmt = db.prepare(query);
  const bound =
    upToId !== undefined
      ? stmt.bind(userDiscordId, kind, today.toISOString(), tomorrow.toISOString(), upToId)
      : stmt.bind(userDiscordId, kind, today.toISOString(), tomorrow.toISOString());

  const result = await bound.first<{ count: number }>();

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
 * FINDING-017: drop events that have aged out, on the write path and, via the
 * daily retention job (`retention-job.ts`), once a day whatever the traffic. Never throws, and deliberately not batched with the
 * INSERT that follows: a D1 batch is atomic, so a failed prune would discard
 * the append-only row the daily caps depend on. Logs counts only.
 *
 * BUG-066: resolves `true` when the sweep ran and `false` when its DELETE
 * failed, so the daily job can report a failed sweep; write-path callers
 * ignore it, exactly as before.
 */
export async function pruneSubmissionEvents(db: D1Database, logger?: RetentionLogger): Promise<boolean> {
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
    return true;
  } catch {
    logger?.warn('[FINDING-017] submission-event prune failed', { pruned: 0 });
    return false;
  }
}

/**
 * A daily-cap reservation obtained via `reserveDailyEvent` (BUG-015).
 *
 * `release` is present only when `allowed` is true — a refused reservation
 * has already deleted its own row (step 3 below) and has nothing left to
 * give back.
 */
export interface DailyEventReservation extends RateLimitResult {
  /**
   * Slots left AFTER this reservation, not counting it — unlike the removed
   * `checkDailyEventLimit`, which reported `limit - used` from a PRE-insert
   * count (so its `remaining` still included the slot the caller was about
   * to spend). Nothing reads this field today; documented so a future
   * caller doesn't assume the old, inclusive meaning.
   */
  remaining: number;

  /**
   * Deletes this reservation's row, freeing the slot. Best-effort: logs and
   * swallows a failed delete rather than throwing, since a caller invokes
   * this only after its own action has already failed and a second failure
   * here must not mask the first.
   */
  release?: () => Promise<void>;
}

/**
 * BUG-015 (2026-09-16 deep-dive): the removed `checkDailyEventLimit` paired
 * with a later `recordSubmissionEvent` call was check-then-insert — N
 * concurrent requests sitting at cap-1 could all pass the check before any
 * of them recorded, overshooting the daily cap for `text_edit` /
 * `flagged_edit` / `preview_upload`. These gate an UPDATE or an R2 write;
 * submissions now use the separate fail-closed conditional admission below.
 * For these existing event kinds the reservation closes the race:
 *
 *   1. Insert the event row first — this is the statement every concurrent
 *      request serializes on.
 *   2. Count today's rows for this user + kind with `id <= ` this
 *      reservation's own row id (`getEventCountToday`'s `upToId`), including
 *      the one just inserted but excluding anything inserted after it.
 *   3. If that count exceeds the cap, delete the row this call just
 *      inserted and report `allowed: false` (the same 429 shape the old
 *      pre-check returned). Otherwise report `allowed: true` with a
 *      `release()` the caller uses to give the slot back if whatever it
 *      reserved the slot for goes on to fail.
 *
 * Fix round 2 (2026-09-16 PR review): step 2 originally counted ALL of
 * today's rows regardless of id, not just the ones at-or-before this
 * reservation. With one slot free and N >= 2 concurrent requests, every one
 * of them observed `limit - 1 + N > limit` and every one refused — nobody
 * got the slot. Bounding the count by `id <= rowId` makes it "this
 * reservation's position in insertion order": since autoincrement ids are
 * monotonic, exactly one concurrent caller lands at position `limit` (or
 * below) and wins; the rest land above it and lose, same as if they had
 * arrived one at a time.
 *
 * A reservation nobody releases counts permanently, exactly like the old
 * `recordSubmissionEvent` call it replaces at the three call sites.
 *
 * Fail OPEN on any D1 error from either the INSERT or the COUNT (coordinator
 * ruling, fix round 1): the earlier append-after-action path promised
 * "a failed insert must not fail the mutation the user just completed", and
 * `migrations/0012_submission_events_text_edit.sql` (needed before a
 * `'text_edit'` row is accepted) is hand-run and may not be applied to a
 * given environment — its `CHECK (kind IN …)` would then reject every
 * `'text_edit'` insert, and a bug in a rate limiter must never be the reason
 * a user's edit 500s. An INSERT that fails logs a warning and returns
 * `{ allowed: true, remaining: limit, resetAt, release: async () => {} }` —
 * no row, the cap is inert for this one request, the caller's action
 * proceeds unmetered. A COUNT that fails AFTER a successful INSERT logs, best
 * effort-releases the row it just inserted (so a live D1 that recovers a
 * moment later doesn't count a phantom reservation against tomorrow's
 * numbers either — the row would otherwise sit there uncounted-by-this-call
 * but still real), and returns the same fail-open shape.
 *
 * Reserve-then-act has one more inherent cost, unrelated to D1 errors: a
 * request that reserves and is then abandoned before it completes (a client
 * that never finishes uploading the preview-image body, say) leaves its row
 * in place — nothing releases a reservation nobody ever resolves. That row
 * counts against the cap until it ages past UTC midnight like any other; it
 * is not a leak, just the cost of charging at reservation time rather than
 * at completion time. Two concurrent requests racing for the last slot are
 * ordered deterministically by row id (the tie-break above) — exactly one
 * wins, not zero and not both.
 */
export async function reserveDailyEvent(
  db: D1Database,
  userDiscordId: string,
  kind: SubmissionEventKind,
  presetId: string | null = null,
  logger?: RetentionLogger
): Promise<DailyEventReservation> {
  await pruneSubmissionEvents(db, logger);

  const limit = DAILY_LIMITS[kind];
  const noopRelease = async (): Promise<void> => {};

  let rowId: number;
  try {
    const inserted = await db
      .prepare(
        `INSERT INTO submission_events (user_discord_id, kind, preset_id) VALUES (?, ?, ?)`
      )
      .bind(userDiscordId, kind, presetId)
      .run();
    rowId = inserted.meta.last_row_id;
  } catch (err) {
    logger?.warn('[BUG-015] daily-event reservation insert failed — failing open', {
      kind,
      error: err instanceof Error ? err.message : String(err),
    });
    return { allowed: true, remaining: limit, resetAt: getNextResetUTC(), release: noopRelease };
  }

  const release = async (): Promise<void> => {
    try {
      await db.prepare('DELETE FROM submission_events WHERE id = ?').bind(rowId).run();
    } catch (err) {
      logger?.warn('[BUG-015] failed to release a daily-event reservation', {
        kind,
        rowId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  let used: number;
  try {
    used = await getEventCountToday(db, userDiscordId, kind, rowId);
  } catch (err) {
    logger?.warn('[BUG-015] daily-event reservation count failed — failing open', {
      kind,
      rowId,
      error: err instanceof Error ? err.message : String(err),
    });
    await release();
    return { allowed: true, remaining: limit, resetAt: getNextResetUTC(), release: noopRelease };
  }

  if (used > limit) {
    await release();
    return { allowed: false, remaining: 0, resetAt: getNextResetUTC() };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - used),
    resetAt: getNextResetUTC(),
    release,
  };
}

/**
 * Events plus live rows not represented by a same-user submission event.
 * Deleted presets stay charged, while successful admitted rows count once.
 */
export async function getEffectiveSubmissionCountToday(
  db: D1Database,
  userDiscordId: string,
  window = submissionWindow()
): Promise<number> {
  return getSubmissionUsage(db, userDiscordId, window);
}

/** One captured UTC window keeps counts, event timestamps and resets coherent. */
function submissionWindow(): { now: string; start: string; end: string; resetAt: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const resetAt = new Date(start.getTime() + MS_PER_DAY);
  return { now: now.toISOString(), start: start.toISOString(), end: resetAt.toISOString(), resetAt };
}

// Match representation across ALL retained admissions, including yesterday's
// admission completing today. Unrelated users/kinds never represent a preset.
const submissionUsageSql = `(
  (SELECT COUNT(*) FROM submission_events
   WHERE user_discord_id = ? AND kind = 'submission' AND created_at >= ? AND created_at < ?)
  +
  (SELECT COUNT(*) FROM presets p
   WHERE p.author_discord_id = ? AND p.created_at >= ? AND p.created_at < ?
     AND NOT EXISTS (
       SELECT 1 FROM submission_events e
       WHERE e.user_discord_id = p.author_discord_id AND e.kind = 'submission' AND e.preset_id = p.id
     ))
)`;

function submissionUsageBindings(user: string, window: ReturnType<typeof submissionWindow>): string[] {
  return [user, window.start, window.end, user, window.start, window.end];
}

async function getSubmissionUsage(
  db: D1Database,
  user: string,
  window: ReturnType<typeof submissionWindow>
): Promise<number> {
  const result = await db.prepare(`SELECT ${submissionUsageSql} AS count`)
    .bind(...submissionUsageBindings(user, window)).first<{ count: number }>();
  return result?.count ?? 0;
}

/**
 * Admit before moderation in one conditional write. A zero-row RETURNING is
 * quota denial, never a stale last_row_id. Database errors deliberately escape
 * to the submission handler's fail-closed 503; unrelated reservations retain
 * their existing fail-open behavior. Once moderation starts this event stays,
 * including a failed create or a same-dye collision.
 */
export async function reserveSubmissionAdmission(
  db: D1Database,
  user: string,
  presetId: string,
  logger?: RetentionLogger
): Promise<Pick<RateLimitResult, 'allowed' | 'resetAt'>> {
  await pruneSubmissionEvents(db, logger);
  const window = submissionWindow();
  const inserted = await db.prepare(`
    INSERT INTO submission_events (user_discord_id, kind, preset_id, created_at)
    SELECT ?, 'submission', ?, ? WHERE ${submissionUsageSql} < ?
    RETURNING id
  `).bind(user, presetId, window.now, ...submissionUsageBindings(user, window), DAILY_SUBMISSION_LIMIT)
    .first<{ id: number }>();
  return { allowed: inserted !== null, resetAt: window.resetAt };
}

export async function checkSubmissionRateLimit(
  db: D1Database,
  userDiscordId: string
): Promise<RateLimitResult> {
  const window = submissionWindow();
  const submissionsToday = await getEffectiveSubmissionCountToday(db, userDiscordId, window);
  const remaining = Math.max(0, DAILY_SUBMISSION_LIMIT - submissionsToday);

  return {
    allowed: submissionsToday < DAILY_SUBMISSION_LIMIT,
    remaining,
    resetAt: window.resetAt,
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
