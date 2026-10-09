/**
 * Identity re-key (FINDING-014, 2026-10-03 audit)
 *
 * An XIVAuth-only account is keyed by the oauth `sub` UUID everywhere in this
 * database. When it later links Discord, the acting id switches to the
 * snowflake (`resolveJWTUserId`), which would orphan the UUID-keyed presets,
 * votes and quota events. `rekeyIdentity` moves them to the snowflake.
 *
 * A banned identity's rows must stay keyed by the banned id, because a later
 * unban restores presets by it. Callers check for a ban first as the fast path,
 * but a ban can land between that read and this write, so every statement below
 * also carries the ban guard itself. See the refresh-author handler.
 *
 * The move bumps `content_revision` on every preset it re-keys (the trigger
 * watches `author_discord_id`), so that author's pending review embeds go
 * STALE_REVIEW and must be re-read. Fail-closed, and intended.
 */

// Appended to every statement: no active ban on either id, in either ban column.
// ALL FIVE statements need it. Guarding only the votes move would leave the
// decrement and the DELETE treating every un-moved vote as a collision.
const NOT_BANNED = `NOT EXISTS (
  SELECT 1 FROM banned_users
  WHERE (discord_id IN (?, ?) OR xivauth_id IN (?, ?)) AND unbanned_at IS NULL
)`;

/**
 * Move every row keyed `fromId` to `toId` in ONE batch (one transaction), so a
 * failure part-way leaves nothing half-moved. Idempotent: once nothing is keyed
 * `fromId` every statement matches zero rows.
 *
 * `votes` has PRIMARY KEY (preset_id, user_discord_id) and `presets.vote_count`
 * is denormalized, so a preset the person voted on under BOTH ids needs care:
 * UPDATE OR IGNORE moves the votes that do not collide, the votes still keyed
 * `fromId` afterwards are exactly the collisions, each of which is one vote
 * counted twice, so those presets lose one from vote_count and the leftover
 * rows are deleted. The statement order below is load-bearing.
 */
export async function rekeyIdentity(db: D1Database, fromId: string, toId: string): Promise<boolean> {
  // BUG-067: moving an id onto itself is a no-op — and must stay one. With
  // fromId === toId the votes move matches nothing, so the collision cleanup
  // below would treat every vote the user has as a double count: decrement
  // each preset's vote_count and delete all their votes. The only caller
  // already skips equal ids; this keeps the service safe on its own.
  if (fromId === toId) return false;

  const ban = [fromId, toId, fromId, toId] as const;
  const results = await db.batch([
    db
      .prepare(`UPDATE presets SET author_discord_id = ? WHERE author_discord_id = ? AND ${NOT_BANNED}`)
      .bind(toId, fromId, ...ban),
    db
      .prepare(
        `UPDATE OR IGNORE votes SET user_discord_id = ? WHERE user_discord_id = ? AND ${NOT_BANNED}`
      )
      .bind(toId, fromId, ...ban),
    db
      .prepare(
        `UPDATE presets SET vote_count = MAX(COALESCE(vote_count, 0) - 1, 0)
         WHERE id IN (SELECT preset_id FROM votes WHERE user_discord_id = ?) AND ${NOT_BANNED}`
      )
      .bind(fromId, ...ban),
    db.prepare(`DELETE FROM votes WHERE user_discord_id = ? AND ${NOT_BANNED}`).bind(fromId, ...ban),
    db
      .prepare(
        `UPDATE submission_events SET user_discord_id = ? WHERE user_discord_id = ? AND ${NOT_BANNED}`
      )
      .bind(toId, fromId, ...ban),
  ]);
  return results.some((r) => (r.meta?.changes ?? 0) > 0);
}
