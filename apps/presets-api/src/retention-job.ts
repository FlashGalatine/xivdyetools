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
 * property of the job rather than of its callees. Logs counts and error names
 * only: these tables hold ids, usernames and moderator reasons, and a D1 error
 * can quote the statement.
 */

import type { Env, RetentionLogger } from './types.js';
import { pruneSubmissionEvents } from './services/rate-limit-service.js';
import { pruneFailedNotifications } from './services/notification-service.js';
import { pruneModerationRecords } from './services/moderation-retention-service.js';

const defaultLogger: RetentionLogger = {
  // eslint-disable-next-line no-console -- cron has no request logger; counts and error names only
  warn: (message, context) => console.warn(message, context),
};

/**
 * Run all three prunes; resolves with how many settled fulfilled / rejected.
 * Each prune catches and logs its own D1 errors, so `rejected` counts only an
 * unexpected throw; a failed DELETE is visible in the prune's own warning.
 */
export async function runRetentionJob(
  db: D1Database,
  logger: RetentionLogger = defaultLogger
): Promise<{ fulfilled: number; rejected: number }> {
  const results = await Promise.allSettled([
    pruneSubmissionEvents(db, logger),
    pruneFailedNotifications(db, logger),
    pruneModerationRecords(db, logger),
  ]);

  let rejected = 0;
  for (const result of results) {
    if (result.status === 'rejected') {
      rejected++;
      logger.warn('[retention-job] a prune threw', {
        cause: result.reason instanceof Error ? result.reason.name : 'unknown',
      });
    }
  }
  const summary = { fulfilled: results.length - rejected, rejected };
  // eslint-disable-next-line no-console -- cron has no request logger; counts only
  console.log('[retention-job] done', summary);
  return summary;
}

/** Cron Trigger entry point (`[env.production.triggers]` in wrangler.toml). */
export function scheduled(
  _controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext
): void {
  ctx.waitUntil(runRetentionJob(env.DB));
}
