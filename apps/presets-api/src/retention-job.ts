/**
 * Daily retention job (Cron Trigger, production only).
 *
 * The privacy documents promise retention periods for presets-api data, but
 * every prune used to run lazily on a write path: with no writes the rows just
 * sat there, and moderation-worker's direct-D1 ban/unban never reached
 * `pruneModerationRecords` at all. A once-a-day sweep makes every period hold
 * within a day, whatever the traffic. The lazy write-path prunes stay as they
 * are (cheap, idempotent, and they keep working on a worker with no cron).
 *
 * The three prunes are isolated: one failing must not stop the others. Each is
 * already best-effort and never throws, but `Promise.allSettled` makes that a
 * property of the job rather than of its callees. Logs counts, prune names and
 * error names only: these tables hold ids, usernames and moderator reasons,
 * and a D1 error can quote the statement.
 *
 * BUG-066 (2026-10-04 deep-dive): because each prune catches its own D1 error,
 * a sweep whose DELETEs all failed used to settle fulfilled three times and
 * report success, with nothing above a warning anywhere. Each prune now
 * resolves to whether its sweep ran; the job counts a reported failure exactly
 * like a throw, returns the names of the prunes that failed, and logs them at
 * error level — and the Cron entry point fails its own invocation (see
 * `scheduled` below), since that log goes nowhere in production.
 */

import type { Env, RetentionLogger } from './types.js';
import { pruneSubmissionEvents } from './services/rate-limit-service.js';
import { pruneFailedNotifications } from './services/notification-service.js';
import { pruneModerationRecords } from './services/moderation-retention-service.js';

/** The job's logger: the prunes' `warn`, plus `error` for a failed sweep. */
interface RetentionJobLogger extends RetentionLogger {
  error(message: string, context?: Record<string, unknown>): void;
}

const defaultLogger: RetentionJobLogger = {
  // eslint-disable-next-line no-console -- cron has no request logger; counts and error names only
  warn: (message, context) => console.warn(message, context),
  // eslint-disable-next-line no-console -- cron has no request logger; prune names only
  error: (message, context) => console.error(message, context),
};

/** What one run did. `failed` names the prunes, never anything they touched. */
interface RetentionJobSummary {
  /** Prunes whose promise settled fulfilled — including one that reported a failure. */
  fulfilled: number;
  /** Prunes that threw. None should: each catches its own D1 error. */
  rejected: number;
  /** Prunes that did not complete, whether they threw or reported it. */
  failed: string[];
}

/**
 * Run all three prunes. A prune that threw, or that resolved anything other
 * than `true`, is a failed sweep: it is named in `failed` and logged at error
 * level, so a lapse in retention cannot pass as a clean run.
 */
export async function runRetentionJob(
  db: D1Database,
  logger: RetentionJobLogger = defaultLogger
): Promise<RetentionJobSummary> {
  const prunes = [
    ['submission_events', (): Promise<boolean> => pruneSubmissionEvents(db, logger)],
    ['failed_notifications', (): Promise<boolean> => pruneFailedNotifications(db, logger)],
    ['moderation_records', (): Promise<boolean> => pruneModerationRecords(db, logger)],
  ] as const;

  const results = await Promise.allSettled(prunes.map(([, prune]) => prune()));

  let rejected = 0;
  const failed: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      rejected++;
      logger.warn('[retention-job] a prune threw', {
        cause: result.reason instanceof Error ? result.reason.name : 'unknown',
      });
    }
    // Only an explicit `true` is a sweep that ran.
    if (result.status === 'rejected' || result.value !== true) {
      failed.push(prunes[i][0]);
    }
  });

  if (failed.length > 0) {
    logger.error('[retention-job] retention sweep failed', { failed });
  }

  const summary: RetentionJobSummary = { fulfilled: results.length - rejected, rejected, failed };
  // eslint-disable-next-line no-console -- cron has no request logger; counts and prune names only
  console.log('[retention-job] done', summary);
  return summary;
}

/**
 * Turn a run's summary into the Cron invocation's outcome: resolve when every
 * sweep ran, reject when any did not. The message names the failed prunes —
 * fixed literals from the table above — and nothing else: not a cause, not a
 * D1 error, whose text can quote the statement and the rows it touched.
 */
function failOnFailedSweep({ failed }: RetentionJobSummary): void {
  if (failed.length > 0) {
    throw new Error(`[retention-job] retention sweep failed: ${failed.join(', ')}`);
  }
}

/**
 * Cron Trigger entry point (`[env.production.triggers]` in wrangler.toml).
 *
 * BUG-066 (2026-10-04 deep-dive), the durable half: `runRetentionJob` always
 * resolves, so handing it to `waitUntil` as-is made every run — a failed sweep
 * included — look like a successful invocation, and its `console.error` goes
 * nowhere in production, where Workers Logs are pinned off (FINDING-022). The
 * promise handed to `waitUntil` now REJECTS when any prune failed, so the
 * failure belongs to the invocation itself rather than to a log line nobody
 * can read. `runRetentionJob`'s own contract is unchanged: it still resolves
 * with the summary, for callers and tests that want the counts.
 *
 * Cloudflare's Scheduled-handler docs say the first `ctx.waitUntil` promise to
 * fail is recorded as the invocation's status in the Cron Events (Past Events)
 * table. That is NOT verified for this worker: after the next production
 * deploy, confirm in the dashboard's Cron Events for the production worker
 * that a rejected run is recorded as a failure rather than a success (the
 * cron exists only in `[env.production]`, so there is no other environment
 * to watch it in).
 */
export function scheduled(
  _controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext
): void {
  ctx.waitUntil(runRetentionJob(env.DB).then(failOnFailedSweep));
}
