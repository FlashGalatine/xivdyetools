-- Migration 0013: moderation_log has to hold ban / unban / hide / restore
-- 2026-08-29 security audit, FINDING-018 (the half of 2026-08-21/FINDING-034
-- that moderation-worker 1.5.0 deferred as "a presets-api-owned decision")
--
-- `xivdyetools-moderation-worker` writes bans straight to this shared database:
-- one `banned_users` row and a flip of the author's `approved` presets to
-- `hidden`, in a single atomic `db.batch()`. Nothing ever landed in
-- `moderation_log`, so `GET /api/v1/moderation/:presetId/history` could not
-- explain why a preset had vanished from the gallery, `/moderation/stats` never
-- counted a ban, and the only accountability trail was `banned_users` itself.
--
-- The table could not carry those rows: a ban and an unban are user-level
-- actions with no preset, and `preset_id` is `NOT NULL`. This migration makes
-- `preset_id` nullable and adds `target_discord_id` (the moderated user), so
-- moderation-worker 1.6.0 can write one `ban` / `unban` row per user action
-- plus one `hide` / `restore` row per preset it actually flips — in the SAME
-- batch as the ban, so the trail can never drift from the effect.
--
-- SQLite cannot drop a NOT NULL constraint with ALTER TABLE, so the table has
-- to be rebuilt (the same shape of change as 0012). Nothing depends on this
-- table — no foreign key points at it, no trigger, no view — so the rebuild is
-- the copy below. `presets` remains the parent of `preset_id`; SQLite always
-- allows a NULL foreign-key value, so the user-level rows are fine.
--
-- Run (deploy window), BEFORE deploying moderation-worker 1.6.0, from
-- `apps/presets-api`:
--   wrangler d1 execute xivdyetools-presets --remote --file=migrations/0013_moderation_log_user_actions.sql
--
-- The rebuild copies every row, so verify the count is unchanged — run this
-- BEFORE the migration and again AFTER, and compare the two numbers:
--   wrangler d1 execute xivdyetools-presets --remote --command "SELECT COUNT(*) FROM moderation_log"
-- Then verify the new shape — `preset_id` must come back with notnull = 0, and
-- `target_discord_id` must be in the column list:
--   wrangler d1 execute xivdyetools-presets --remote --command "PRAGMA table_info(moderation_log)"
--
-- Applied late, nothing is lost, but every ban and unban fails loudly until it
-- lands: 1.6.0 writes the `moderation_log` rows in the same batch as the
-- `banned_users` insert and a D1 batch is atomic, so the missing column aborts
-- the whole batch — the user is not banned, no preset is hidden, there is no
-- half state, and the moderator sees "Failed to ban user." (the raw D1 message
-- is logged, never posted to Discord). Applying this file fixes it with no
-- redeploy.
--
-- No BEGIN TRANSACTION / COMMIT: D1 rejects explicit transaction statements,
-- and a `wrangler d1 execute --file` batch is atomic on its own.
--
-- Re-running: the batch is atomic, so a run that fails anywhere before `DROP
-- TABLE moderation_log` leaves the table exactly as it was and the file can be
-- run again as-is (the `DROP TABLE IF EXISTS moderation_log_new` below also
-- clears that table if it were ever left behind). Once the migration HAS
-- completed, a second run is a no-op that errors: the first statement,
-- `ALTER TABLE moderation_log ADD COLUMN target_discord_id TEXT`, fails with
-- "duplicate column name: target_discord_id" and nothing after it runs. That
-- guard is deliberate — without it a second run would rebuild the table again
-- and silently discard every `target_discord_id` written since. The same error
-- is the right answer on a database created fresh from `schema.sql`, which
-- already carries the new shape. (The one state the guard cannot re-enter — the
-- column added but the rebuild abandoned before `ALTER … RENAME` — should be
-- unreachable for an atomic batch; if it ever happens, run this file with its
-- first statement removed.)
--
-- `npm run db:migrate` will NOT apply this: schema.sql is all
-- CREATE TABLE IF NOT EXISTS, so it skips the existing table and exits 0.

-- Re-run guard (see above). It is also the column this migration exists to add,
-- so the copy below carries it through the rebuild rather than dropping it.
ALTER TABLE moderation_log ADD COLUMN target_discord_id TEXT;

-- A half-finished earlier run would have left this behind.
DROP TABLE IF EXISTS moderation_log_new;

CREATE TABLE moderation_log_new (
  id TEXT PRIMARY KEY,                    -- UUID v4
  -- NULL for user-level actions (ban | unban); set for every preset-level one
  preset_id TEXT,
  moderator_discord_id TEXT NOT NULL,
  -- approve | reject | flag | unflag | revert | ban | unban | hide | restore
  action TEXT NOT NULL,
  reason TEXT,
  -- the moderated user: set for ban | unban | hide | restore, NULL otherwise
  target_discord_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
);

INSERT INTO moderation_log_new (id, preset_id, moderator_discord_id, action, reason, target_discord_id, created_at)
  SELECT id, preset_id, moderator_discord_id, action, reason, target_discord_id, created_at FROM moderation_log;

DROP TABLE moderation_log;

ALTER TABLE moderation_log_new RENAME TO moderation_log;

-- Dropping the old table dropped all three of its indexes with it.
CREATE INDEX IF NOT EXISTS idx_moderation_log_preset ON moderation_log(preset_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_moderator ON moderation_log(moderator_discord_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON moderation_log(created_at DESC);
