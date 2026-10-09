/**
 * Notification Service
 * Discord bot notification fan-out with retry/backoff, plus the
 * failed_notifications dead-letter queue (write and read paths).
 *
 * REFACTOR-017 (2026-07-18 audit): extracted from handlers/presets.ts so the
 * retry and dead-letter logic is testable without the router, and so the
 * dead-letter feature (previously split between presets.ts and moderation.ts)
 * has a single owner module.
 */

import type { Env, PresetPreviousValues, PresetStatus, RetentionLogger } from '../types.js';

/**
 * FINDING-011 (2026-08-29 security audit): the slice of the logger
 * notifyDiscordBot needs for its own operational retry chatter — never the
 * payload it is retrying, which is what RetentionLogger below is declared
 * narrowly to keep out of these calls too.
 */
interface NotificationLogger {
  info(message: string, context?: Record<string, unknown>): void;
}

/** A new (or re-flagged) preset needing moderator eyes. */
export interface PresetSubmissionNotification {
  type: 'submission';
  /**
   * BUG-003 (2026-10-04 deep-dive): where the notification came from — `true`
   * when an owner edit (PATCH /presets/:id) sent it, `false` for a new
   * submission. An origin marker, not a verdict: `preset.moderation_status`
   * says whether the text tripped the filter, `edited_from` is what the edit
   * changed, and `preset.previous_values` (sent with an edit whenever a revert
   * snapshot exists) is what a Revert restores — but `is_edit` alone never
   * licenses a Revert button; see `edited_from_status` for the rule. Optional
   * on the wire: discord-worker read every submission as new before it learnt
   * this field, and still must when it is absent.
   */
  is_edit?: boolean;
  /**
   * BUG-003 follow-up (2026-10-04 deep-dive): the status the preset had
   * immediately BEFORE the edit that sent this notification — the same
   * vocabulary as `preset.status`. Set on every PATCH /presets/:id
   * notification and absent on a new submission (POST). `preset.status` cannot
   * carry it: every edit that notifies leaves the preset `pending`. Only
   * `approved`, `pending` and `rejected` can actually appear — an edit of a
   * `flagged` preset notifies nobody and a `hidden` one cannot be edited (see
   * `ownerEditOutcome` in handlers/presets.ts).
   *
   * **The Revert rule for consumers:** offer Revert ONLY when
   * `is_edit === true` AND `preset.previous_values` is non-null AND
   * `edited_from_status === 'approved'`. Revert (PATCH
   * /moderation/:id/revert) restores `previous_values` AND approves the
   * preset, so it is safe only when the snapshot is text that was live.
   * presets-api now snapshots only an `approved` preset's text: an edit of a
   * pending, rejected or flagged preset neither creates nor overwrites one,
   * and the snapshot is write-once, so going forward it only ever holds text
   * that was live as `approved` (moderator-approved, or auto-approved on
   * submission). The `edited_from_status` check still matters: rows written
   * before that rule may hold a snapshot taken from a pending or rejected
   * state, and on a rejected resubmission or a pending edit it keeps such a
   * snapshot from being offered. Once such a row has since been approved
   * nothing in the payload can tell — the row does not record which state
   * its snapshot came from (see the deploy note in apps/presets-api/CLAUDE.md).
   * Treat an absent value (an older presets-api) as "not approved".
   *
   * Label the Revert button as restoring `previous_values`, not as undoing
   * this edit: the snapshot is write-once, so it can be older than the text
   * in `edited_from` (approved A → flagged edit B snapshots A → a moderator
   * approves B → a flagged edit C still reverts to A, discarding B).
   */
  edited_from_status?: PresetStatus;
  /**
   * Sprint 9 (2026-10-04 remediation): the text THIS edit replaced — `name`,
   * `description`, `tags` and `dyes` exactly as the row held them immediately
   * before the write that sent this notification. Set on every PATCH
   * /presets/:id notification and absent on a new submission (POST), like
   * `edited_from_status`.
   *
   * **The diff base for consumers:** show an edit's changes as `edited_from`
   * → `preset`. Do not diff against `preset.previous_values`: that is the
   * revert target, which a pending preset's edit or a rejected preset's
   * resubmission never creates (only an approved preset is snapshotted), so
   * it is usually `null` there, and which, being write-once, can be older
   * than the text this edit replaced. The two coincide on the first flagged
   * edit of an approved preset that had no snapshot yet, and diverge after
   * that. Revert stays governed by the three-part rule on
   * `edited_from_status` and restores `previous_values`, never `edited_from`.
   *
   * Same shape as `PresetPreviousValues`, not the same meaning: nothing stores
   * it, and no endpoint restores it. Treat an absent value (a new submission,
   * or an older presets-api) as "no diff available".
   */
  edited_from?: PresetPreviousValues;
  preset: {
    id: string;
    name: string;
    description: string;
    category_id: string;
    dyes: number[];
    tags: string[];
    author_name: string;
    author_discord_id: string;
    status: 'pending' | 'approved' | 'rejected';
    /**
     * The write-once revert snapshot (BUG-052) — what PATCH
     * /moderation/:id/revert would restore. Already on the wire with every
     * submission (the payload spreads the preset row), declared here because
     * the Revert rule on `edited_from_status` reads it. Written by the first
     * owner edit of an `approved` preset that trips moderation (an older row
     * may hold one taken in another state) and cleared only by a Revert, so
     * it can be older than the edit being notified; `null` on a new
     * submission, and on an edit of a preset that was never snapshotted.
     * The revert target only — an edit's diff base is the top-level
     * `edited_from`.
     */
    previous_values?: PresetPreviousValues | null;
    /**
     * FINDING-017 (2026-10-03 audit): the revision of exactly the text this
     * notification carries — the row's value AFTER the write that produced it.
     * The moderation buttons bind to it, so a button on an older embed cannot
     * approve text edited since.
     */
    content_revision: number;
    moderation_status: 'clean' | 'flagged' | 'auto_approved';
    source: 'bot' | 'web' | 'none';
    created_at: string;
  };
}

/**
 * An author-uploaded preview image awaiting review. Carries only what the
 * moderation embed needs to title itself — the preset's other columns are
 * unchanged by an image upload, so re-sending them would be noise.
 */
export interface PreviewImageNotification {
  type: 'preview_image';
  /** R2 key of the pending object, so the embed can show what is being judged. */
  preview_image_key: string;
  preset: {
    id: string;
    name: string;
    author_name: string;
  };
}

/**
 * Discriminated on `type`: each variant declares exactly the fields it sends,
 * so a consumer that narrows on `type` cannot read a field that isn't there.
 */
export type PresetNotificationPayload =
  | PresetSubmissionNotification
  | PreviewImageNotification;

/**
 * FINDING-017 (2026-08-29 security audit): the whole of what a dead-letter row
 * is allowed to remember.
 *
 * `failed_notifications.payload` used to hold `JSON.stringify(payload)` — the
 * author's Discord id, their display name and the full preset text — and no
 * code path anywhere deleted a row, so a notification failure quietly kept a
 * copy of a preset for ever: past the preset's own deletion, past the author's
 * deletion request, past the moderator who resolved it. None of that is needed
 * to act on the row. A moderator looks the preset up by id; the type says which
 * embed never arrived, and `moderation_status` says how urgently it is wanted.
 */
export interface DeadLetterRecord {
  type: PresetNotificationPayload['type'];
  preset_id: string;
  /** Only 'submission' carries one; a preview upload has nothing to judge yet. */
  moderation_status?: PresetSubmissionNotification['preset']['moderation_status'];
  /** FINDING-017: a revision number is a counter, not content — kept so a retried embed binds to the right text. */
  content_revision?: number;
}

/**
 * Reduce a notification to the row that outlives it.
 *
 * The single writer of `failed_notifications.payload`, deliberately: a new
 * call site cannot re-introduce the content by passing the payload straight
 * through, because the column is never bound to anything else.
 */
export function toDeadLetterRecord(payload: PresetNotificationPayload): DeadLetterRecord {
  return payload.type === 'submission'
    ? {
        type: 'submission',
        preset_id: payload.preset.id,
        moderation_status: payload.preset.moderation_status,
        content_revision: payload.preset.content_revision,
      }
    : { type: 'preview_image', preset_id: payload.preset.id };
}

/**
 * FINDING-017: how long a dead letter is kept once a moderator has resolved it.
 * The row exists to get a missed moderation embed acted on; once that is done
 * it is only an audit crumb, and a month is long enough to notice a pattern.
 */
export const FAILED_NOTIFICATION_RESOLVED_RETENTION_DAYS = 30;

/**
 * FINDING-017: how long an *unresolved* dead letter is kept. Longer, because
 * nobody has looked at it yet — but not for ever: a notification nobody acted
 * on in a quarter of a year is not going to be acted on.
 */
export const FAILED_NOTIFICATION_UNRESOLVED_RETENTION_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Format a cutoff the way `failed_notifications` writes its timestamps.
 *
 * Both `created_at` and `resolved_at` are SQLite `datetime('now')` values —
 * `'2026-08-29 12:00:00'`, a space and no zone suffix. String comparison is all
 * SQLite does here, and a `toISOString()` cutoff ('…T12:00:00.000Z') sorts
 * *after* every same-second `datetime('now')` value because 'T' > ' ', so
 * binding one would quietly shift the window. Same instant, right format.
 */
function toSqliteDateTime(epochMs: number): string {
  return new Date(epochMs).toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * PRESETS-CRITICAL-003: Retry configuration for Discord notifications
 */
const NOTIFICATION_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(attempt: number): number {
  const delay = Math.min(
    NOTIFICATION_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
    NOTIFICATION_RETRY_CONFIG.maxDelayMs
  );
  // Add jitter (±25%) to prevent thundering herd
  return delay * (0.75 + Math.random() * 0.5);
}

/**
 * Notify the Discord worker about a new preset submission
 * Uses Cloudflare Service Binding for Worker-to-Worker communication (avoids error 1042)
 *
 * PRESETS-CRITICAL-003: Now includes retry with exponential backoff
 * Retries up to 3 times on transient failures
 */
export async function notifyDiscordBot(
  env: Env,
  payload: PresetNotificationPayload,
  logger?: NotificationLogger
): Promise<void> {
  // Check if service binding is configured
  if (!env.DISCORD_WORKER || !env.INTERNAL_WEBHOOK_SECRET) {
    (logger ?? console).info('Discord worker binding not configured, skipping notification');
    return;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= NOTIFICATION_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Use service binding for direct Worker-to-Worker communication
      // The hostname is ignored - only the path matters
      const response = await env.DISCORD_WORKER.fetch(
        new Request('https://internal/webhooks/preset-submission', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.INTERNAL_WEBHOOK_SECRET}`,
          },
          body: JSON.stringify(payload),
        })
      );

      if (response.ok) {
        if (attempt > 0) {
          (logger ?? console).info(`Discord notification succeeded on retry ${attempt}`);
        }
        return; // Success!
      }

      // Non-retryable errors (4xx client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Discord worker returned ${response.status}: ${await response.text()}`);
      }

      // Server error - will retry
      lastError = new Error(`Discord worker returned ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-network errors
      if (lastError.message.includes('returned 4')) {
        throw lastError;
      }
    }

    // If we have more retries, wait before trying again
    if (attempt < NOTIFICATION_RETRY_CONFIG.maxRetries) {
      const delay = getBackoffDelay(attempt);
      (logger ?? console).info(`Discord notification failed, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${NOTIFICATION_RETRY_CONFIG.maxRetries})`);
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError || new Error('Discord notification failed after all retries');
}

/**
 * FINDING-017: drop dead letters that have aged out.
 *
 * The daily retention job (src/retention-job.ts) runs this once a day; it also rides requests — and the
 * policy now promises a window ("30 days after resolution, 90 if unresolved"),
 * so it has to ride requests that actually happen. Hanging it off the
 * dead-letter *write* alone would not: that write only runs when a Discord
 * notification exhausts every retry, which is by design rare, so a quiet
 * six months would leave every row — including pre-FINDING-017 rows still
 * carrying an author id, a display name and preset text — sitting untouched.
 * It is therefore called from four places, all best-effort:
 *
 *   1. `storeFailedNotification` — when the table grows;
 *   2. `listFailedNotifications` — every moderator read of the queue;
 *   3. `resolveFailedNotification` — every moderator resolve;
 *   4. `POST /api/v1/presets`, via `waitUntil` — the busiest write in the
 *      worker, so the window holds as long as anyone submits a preset;
 *   5. the daily Cron Trigger (retention-job.ts).
 *
 * Deliberately NOT in the same `db.batch` as the insert in (1): a D1 batch is
 * atomic, so a prune that failed would take the dead-letter row down with it —
 * losing the one thing the queue exists to keep. Housekeeping never outranks
 * the row it is making space for. The two DELETEs do share a batch.
 *
 * Never throws, so a caller can `await` it without a guard of its own. Logs
 * counts only: a D1 error can quote the statement that failed, and quoting a
 * statement over this table is how the content this finding removes would find
 * its way back into a log line.
 *
 * BUG-066: resolves `true` when the sweep ran and `false` when it failed, so
 * the daily job can report a failed sweep; every other caller ignores it.
 */
export async function pruneFailedNotifications(
  db: D1Database,
  logger?: RetentionLogger
): Promise<boolean> {
  const now = Date.now();
  const resolvedCutoff = toSqliteDateTime(
    now - FAILED_NOTIFICATION_RESOLVED_RETENTION_DAYS * MS_PER_DAY
  );
  const unresolvedCutoff = toSqliteDateTime(
    now - FAILED_NOTIFICATION_UNRESOLVED_RETENTION_DAYS * MS_PER_DAY
  );

  try {
    const results = await db.batch([
      db
        .prepare(
          'DELETE FROM failed_notifications WHERE resolved_at IS NOT NULL AND resolved_at < ?'
        )
        .bind(resolvedCutoff),
      db
        .prepare('DELETE FROM failed_notifications WHERE resolved_at IS NULL AND created_at < ?')
        .bind(unresolvedCutoff),
    ]);

    const pruned = results.reduce((total, result) => total + (result.meta.changes || 0), 0);
    if (pruned > 0) {
      logger?.warn('[FINDING-017] pruned dead-letter rows', { pruned });
    }
    return true;
  } catch {
    logger?.warn('[FINDING-017] dead-letter prune failed', { pruned: 0 });
    return false;
  }
}

/**
 * BUG-015: Store failed notification in dead-letter table for later review.
 * Called from .catch() blocks when notifyDiscordBot() fails after all retries.
 * Insert is best-effort — failures here are logged but do not propagate.
 *
 * FINDING-017: the row keeps only `toDeadLetterRecord(payload)` — the preset id
 * and the notification type — not the author id, the author name or the preset
 * text the notification carried; and ageing rows are pruned first.
 */
export async function storeFailedNotification(
  db: D1Database,
  payload: PresetNotificationPayload,
  error: unknown,
  logger?: RetentionLogger,
  retries: number = NOTIFICATION_RETRY_CONFIG.maxRetries
): Promise<void> {
  await pruneFailedNotifications(db, logger);

  try {
    await db
      .prepare(
        'INSERT INTO failed_notifications (payload, error, attempts) VALUES (?, ?, ?)'
      )
      .bind(
        JSON.stringify(toDeadLetterRecord(payload)),
        error instanceof Error ? error.message : String(error),
        retries + 1
      )
      .run();
  } catch (insertErr) {
    // Best-effort — a failed insert must not fail the caller, whose retries
    // have already been exhausted. FINDING-011 (review fix): log the
    // failure's error NAME only, never its message — a D1 error can quote
    // the failing SQL statement, and the statement text is exactly the
    // payload this table is no longer allowed to carry. `(logger ?? console)`
    // so the failure is never completely silent when no logger was passed
    // (tests, or any future caller that forgets to thread one through).
    (logger ?? console).warn('[BUG-015] Failed to store notification in dead-letter table', {
      cause: insertErr instanceof Error ? insertErr.name : 'unknown',
    });
  }
}

/** One dead letter as a moderator sees it. */
export interface FailedNotificationSummary {
  id: string | number;
  /** null when the row's payload is unreadable — the rest still triages. */
  type: string | null;
  preset_id: string | null;
  moderation_status?: string;
  error: string;
  attempts: number;
  created_at: string;
  resolved_at: string | null;
}

/** The raw row shape; `payload` is JSON written by `storeFailedNotification`. */
interface FailedNotificationRow {
  id: string | number;
  payload: string;
  error: string;
  attempts: number;
  created_at: string;
  resolved_at: string | null;
}

/**
 * Project a stored payload onto the summary a moderator acts on.
 *
 * Handles both shapes on purpose. Rows written before FINDING-017 hold the
 * whole notification (`{ type, preset: { id, name, author_discord_id, … } }`)
 * and live in production until they age out of the retention window above —
 * reading `$.preset.id` keeps them useful while making sure the listing serves
 * the id and nothing else. A payload that will not parse at all still yields a
 * usable row: the error, the attempts and the timestamps are the columns.
 */
function summarizeFailedNotification(row: FailedNotificationRow): FailedNotificationSummary {
  const summary: FailedNotificationSummary = {
    id: row.id,
    type: null,
    preset_id: null,
    error: row.error,
    attempts: row.attempts,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.payload);
  } catch {
    return summary;
  }
  if (typeof parsed !== 'object' || parsed === null) return summary;

  const record = parsed as Record<string, unknown>;
  const legacyPreset =
    typeof record.preset === 'object' && record.preset !== null
      ? (record.preset as Record<string, unknown>)
      : undefined;

  if (typeof record.type === 'string') summary.type = record.type;

  const presetId = record.preset_id ?? legacyPreset?.id;
  if (typeof presetId === 'string') summary.preset_id = presetId;

  const moderationStatus = record.moderation_status ?? legacyPreset?.moderation_status;
  if (typeof moderationStatus === 'string') summary.moderation_status = moderationStatus;

  return summary;
}

/**
 * List failed notifications for moderator review (read path of the
 * dead-letter queue; see storeFailedNotification for the write path).
 * Returns an empty list if the table doesn't exist yet.
 *
 * FINDING-017: returns the projection above rather than the raw row, so the
 * fat payload of a pre-FINDING-017 row is never published again — and prunes
 * first, because a moderator opening the queue is far more frequent than a
 * notification exhausting its retries, and the retention window is a promise.
 */
export async function listFailedNotifications(
  db: D1Database,
  includeResolved: boolean,
  logger?: RetentionLogger
): Promise<FailedNotificationSummary[]> {
  await pruneFailedNotifications(db, logger);

  const columns = 'id, payload, error, attempts, created_at, resolved_at';
  const query = includeResolved
    ? `SELECT ${columns} FROM failed_notifications ORDER BY created_at DESC LIMIT 50`
    : `SELECT ${columns} FROM failed_notifications WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 50`;

  try {
    const result = await db.prepare(query).all<FailedNotificationRow>();
    return (result.results || []).map(summarizeFailedNotification);
  } catch (error) {
    // presets-api-07: this used to swallow EVERY D1 error into an empty array,
    // so a database incident presented to a moderator as "the dead-letter
    // queue is clear" — HTTP 200, `{"notifications":[],"total":0}`, and they
    // conclude nothing was missed. The sibling `resolveFailedNotification`
    // lets its errors propagate, so the two disagreed about what a D1 failure
    // means.
    //
    // The stated justification ("table may not exist yet if migration hasn't
    // run") refers to migration 0005, long since applied everywhere — but it
    // still holds for a fresh local D1, so keep exactly that case and let
    // everything else become a 500.
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table/i.test(message)) {
      (logger ?? console).warn?.(
        '[failed-notifications] table missing — run migrations/0005 (local D1?)'
      );
      return [];
    }
    throw error;
  }
}

/**
 * Mark a failed notification as resolved.
 * Returns false when the row doesn't exist or was already resolved.
 *
 * FINDING-017: prunes first, for the same reason as the listing above. A row
 * that the 90-day unresolved window has already reached is deleted rather than
 * resolved, and the caller's 404 is then the truthful answer — it is gone.
 */
export async function resolveFailedNotification(
  db: D1Database,
  id: string,
  logger?: RetentionLogger
): Promise<boolean> {
  await pruneFailedNotifications(db, logger);

  const result = await db
    .prepare(
      "UPDATE failed_notifications SET resolved_at = datetime('now') WHERE id = ? AND resolved_at IS NULL"
    )
    .bind(id)
    .run();
  return result.meta.changes > 0;
}
