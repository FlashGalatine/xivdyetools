import type { Env } from '../types.js';
import { deletePreviewImage } from './preview-image-service.js';

// One claim and up to three subrequests per job (R2, purge, acknowledgment).
const RETRY_BATCH_SIZE = 16;
const RETRY_CONCURRENCY = 4;
const RETRY_DELAY_MS = 5 * 60 * 1000;

type CleanupLogger = Parameters<typeof deletePreviewImage>[2];

/**
 * Place this in the preview mutation's atomic D1 batch. The preceding write
 * must affect a row only when the guarded preview UPDATE detached the key.
 */
export function enqueueDetachedPreviewImage(
  db: D1Database,
  presetId: string,
  key: string | null
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO preview_image_cleanup (object_key, preset_id)
     SELECT ?, ? WHERE changes() > 0 AND ? IS NOT NULL
     ON CONFLICT(object_key) DO NOTHING`
  ).bind(key, presetId, key);
}

/**
 * Try a job by the exact immutable key detached by a committed write. R2
 * deletes and URL purges can safely repeat if another attempt already ran or
 * a failure interrupted the acknowledgment. Only complete jobs leave D1.
 */
export async function cleanDetachedPreviewImage(
  env: Env,
  key: string | null,
  logger?: CleanupLogger
): Promise<boolean> {
  if (key === null) return true;

  try {
    if (await deletePreviewImage(env, key, logger) !== 'purged') return false;
    const completion = await env.DB.prepare('DELETE FROM preview_image_cleanup WHERE object_key = ?')
      .bind(key)
      .run();
    return completion.success;
  } catch {
    // Logging the D1 error could disclose bound data.
    logger?.error('[preview-image] cleanup attempt could not complete');
    return false;
  }
}

/**
 * A repeated owner removal can have no current key while an earlier job for
 * that preset is still pending. A whole-preset delete can inherit that work.
 */
export async function finishPresetPreviewCleanup(
  env: Env,
  presetId: string,
  key: string | null,
  logger?: CleanupLogger
): Promise<boolean> {
  if (!await cleanDetachedPreviewImage(env, key, logger)) return false;
  try {
    const pending = await env.DB.prepare('SELECT 1 FROM preview_image_cleanup WHERE preset_id = ? LIMIT 1')
      .bind(presetId)
      .first();
    return pending === null;
  } catch {
    logger?.error('[preview-image] pending cleanup could not be checked');
    return false;
  }
}

/**
 * Claim the oldest due jobs before doing I/O. The retry time acts as a lease:
 * a crash leaves the jobs eligible again, and persistent failures move
 * behind older unclaimed work. Concurrent attempts are still safe.
 */
export async function retryPreviewImageCleanup(env: Env): Promise<void> {
  const now = Date.now();
  let jobs: { object_key: string }[];
  try {
    const claimed = await env.DB.prepare(
      `UPDATE preview_image_cleanup SET next_attempt_at = ?
       WHERE object_key IN (
         SELECT object_key FROM preview_image_cleanup WHERE next_attempt_at <= ?
         ORDER BY next_attempt_at, object_key LIMIT ?
       )
       RETURNING object_key`
    ).bind(now + RETRY_DELAY_MS, now, RETRY_BATCH_SIZE).all<{ object_key: string }>();
    jobs = claimed.results;
  } catch {
    throw new Error('[preview-image] cleanup jobs could not be claimed');
  }

  let incomplete = 0;
  for (let offset = 0; offset < jobs.length; offset += RETRY_CONCURRENCY) {
    const completed = await Promise.all(
      jobs.slice(offset, offset + RETRY_CONCURRENCY).map(({ object_key }) => cleanDetachedPreviewImage(env, object_key))
    );
    incomplete += completed.filter((done) => !done).length;
  }
  if (incomplete > 0) {
    throw new Error(`[preview-image] ${incomplete} cleanup job(s) remain pending`);
  }
}
