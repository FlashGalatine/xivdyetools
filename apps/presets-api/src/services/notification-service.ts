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

import type { Env, RetentionLogger } from '../types.js';

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
 * presets-api has no cron trigger, so retention has to ride requests — and the
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
 *      worker, so the window holds as long as anyone submits a preset.
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
 */
export async function pruneFailedNotifications(
  db: D1Database,
  logger?: RetentionLogger
): Promise<void> {
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
  } catch {
    logger?.warn('[FINDING-017] dead-letter prune failed', { pruned: 0 });
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
  } catch {
    // Table may not exist yet if migration hasn't run
    return [];
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
