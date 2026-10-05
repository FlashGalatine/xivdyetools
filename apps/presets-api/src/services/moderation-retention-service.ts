/**
 * Moderation record retention (FINDING-005, 2026-10-03 security audit).
 *
 * `banned_users` and `moderation_log` hold Discord ids, a username copy, the
 * moderators' free-text reasons and moderator ids. Nothing ever deleted them.
 * This module is the deletion. It runs once a day from the Cron Trigger
 * (src/retention-job.ts) and, best-effort, on the moderation write paths (same
 * pattern as `pruneFailedNotifications` and the submission-event prune).
 *
 * THE CODE IS THE COMMITMENT: these are the periods the FINDING-005 policy
 * amendment (Sprint 5: bot policy, web PRIVACY item 3) will publish in
 * apps/discord-worker/PRIVACY_POLICY*.md and apps/web-app/PRIVACY*.md. Change a
 * number here only together with those policies.
 */

import type { RetentionLogger } from '../types.js';

/**
 * A lifted ban (`banned_users.unbanned_at` set) is deleted this many days
 * after the unban. An active ban is never pruned, however old.
 */
export const LIFTED_BAN_RETENTION_DAYS = 90;

/**
 * User-level and bulk-action audit rows (`moderation_log.action` in
 * {@link USER_ACTION_LOG_ACTIONS}) are deleted this many calendar months after
 * `created_at`. Every other log row (approve, reject, flag, image_approve, ...)
 * is kept exactly as long as its preset: the FK cascades on delete, and
 * `DELETE /presets/:id` also removes them explicitly.
 */
export const USER_ACTION_LOG_RETENTION_MONTHS = 12;

/**
 * The log actions keyed to the 12-month rule. `hide` / `restore` rows carry a
 * preset_id, so the preset-lifetime rule alone would keep them for as long as
 * the preset exists; the action value decides, not the preset_id.
 */
const USER_ACTION_LOG_ACTIONS = ['ban', 'unban', 'hide', 'restore'] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Delete moderation records that have outlived their retention period.
 *
 * Timestamps: moderation-worker and this worker both write `banned_at`,
 * `unbanned_at` and `created_at` as `Date#toISOString()` strings
 * ('2026-10-03T12:00:00.000Z'), so the cutoffs are bound in that format. (The
 * column default `datetime('now')` renders with a space; a row that only ever
 * received the default sorts up to a day early against an ISO cutoff, which
 * can only prune it sooner than its period, never later.)
 *
 * Best-effort: never throws, so a caller can `await` it without a guard and a
 * failure can never fail the moderator request it rides on. Logs counts only
 * (a D1 error can quote the statement, and these tables hold ids and reasons).
 * Deliberately called AFTER the request's own write has landed, so housekeeping
 * never outranks the action it follows.
 *
 * @param now - Epoch ms; injectable so tests can pin the boundaries.
 */
export async function pruneModerationRecords(
  db: D1Database,
  logger?: RetentionLogger,
  now: number = Date.now()
): Promise<void> {
  const banCutoff = new Date(now - LIFTED_BAN_RETENTION_DAYS * MS_PER_DAY).toISOString();

  const logCutoffDate = new Date(now);
  logCutoffDate.setUTCMonth(logCutoffDate.getUTCMonth() - USER_ACTION_LOG_RETENTION_MONTHS);
  const logCutoff = logCutoffDate.toISOString();

  const actionPlaceholders = USER_ACTION_LOG_ACTIONS.map(() => '?').join(', ');

  try {
    const results = await db.batch([
      db
        .prepare('DELETE FROM banned_users WHERE unbanned_at IS NOT NULL AND unbanned_at < ?')
        .bind(banCutoff),
      db
        .prepare(
          `DELETE FROM moderation_log WHERE action IN (${actionPlaceholders}) AND created_at < ?`
        )
        .bind(...USER_ACTION_LOG_ACTIONS, logCutoff),
    ]);

    const pruned = results.reduce((total, result) => total + (result.meta.changes || 0), 0);
    if (pruned > 0) {
      logger?.warn('[FINDING-005] pruned moderation records', { pruned });
    }
  } catch {
    logger?.warn('[FINDING-005] moderation-record prune failed', { pruned: 0 });
  }
}
