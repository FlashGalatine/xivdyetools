-- Migration 0012: allow the 'text_edit' event kind in submission_events
-- 2026-08-29 security audit, FINDING-005
--
-- `DAILY_FLAGGED_EDIT_LIMIT` is charged only to an edit that reaches a
-- moderator, and only AFTER the Perspective call it is meant to bound. So a
-- stream of name/description edits that moderation clears — or any edit of an
-- already-judged (rejected / flagged) preset, which notifies nobody — drove
-- Google Perspective towards its ~1 QPS default quota with no per-user bound
-- at all beyond the 100/min per-IP limiter. `PATCH /api/v1/presets/:id` now
-- checks `checkDailyEventLimit(db, user, 'text_edit')` (30/UTC day) BEFORE
-- calling moderateContent, for every preset status, and records a 'text_edit'
-- row at the point the call is spent.
--
-- `submission_events.kind` carries a CHECK constraint listing the three kinds
-- migration 0011 knew about, and SQLite cannot ALTER a CHECK constraint — the
-- table has to be rebuilt. There are no foreign keys, triggers or views on
-- this table, so the rebuild is the copy below.
--
-- Run (deploy window), BEFORE deploying the presets-api release that carries
-- FINDING-005:
--   wrangler d1 execute xivdyetools-presets --remote --file=migrations/0012_submission_events_text_edit.sql
--
-- Until it is applied the worker still works: the 'text_edit' INSERT is
-- best-effort and its CHECK violation is caught and logged, so edits succeed —
-- but no row lands, the count stays 0 and the new cap never engages.
--
-- No BEGIN TRANSACTION / COMMIT: D1 rejects explicit transaction statements,
-- and a `wrangler d1 execute --file` batch is atomic on its own.
--
-- `npm run db:migrate` will NOT apply this: schema.sql is all
-- CREATE TABLE IF NOT EXISTS, so it skips the existing table and exits 0.

CREATE TABLE submission_events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_discord_id TEXT NOT NULL,
  -- 'submission' | 'flagged_edit' | 'preview_upload' | 'text_edit'
  kind TEXT NOT NULL CHECK (kind IN ('submission', 'flagged_edit', 'preview_upload', 'text_edit')),
  preset_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO submission_events_new (id, user_discord_id, kind, preset_id, created_at)
  SELECT id, user_discord_id, kind, preset_id, created_at FROM submission_events;

DROP TABLE submission_events;

ALTER TABLE submission_events_new RENAME TO submission_events;

-- Dropping the old table dropped its index with it.
CREATE INDEX IF NOT EXISTS idx_submission_events_user_kind_created
  ON submission_events(user_discord_id, kind, created_at);
