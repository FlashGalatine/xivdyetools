import type { RetentionLogger } from '../types.js';

/** Bounded housekeeping; eligibility is not an exact deletion-time guarantee. */
export async function pruneContinuityRecords(
  db: D1Database,
  logger?: RetentionLogger,
): Promise<boolean> {
  try {
    const results = await db.batch([
      db.prepare(`DELETE FROM ban_continuity_operations WHERE id IN (
        SELECT id FROM ban_continuity_operations
        WHERE ((state='applied' AND acknowledged_outcome='complete')
          OR (state='refused' AND acknowledged_outcome='aborted'))
          AND acknowledged_at IS NOT NULL
          AND MAX(expires_at,acknowledged_at)+86400<=unixepoch()
        ORDER BY expires_at,id LIMIT 128)`),
      db.prepare(`DELETE FROM moderation_ban_confirmations WHERE nonce IN (
        SELECT nonce FROM moderation_ban_confirmations
        WHERE expires_at<=unixepoch() AND (outcome IS NULL OR outcome='applied')
        ORDER BY expires_at,nonce LIMIT 128)`),
    ]);
    const pruned = results.reduce((n, r) => n + (r.meta.changes || 0), 0);
    if (pruned > 0) logger?.warn('[continuity] pruned records', { pruned });
    return true;
  } catch {
    logger?.warn('[continuity] prune failed', { pruned: 0 });
    return false;
  }
}
