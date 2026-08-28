-- Migration 0011: append-only per-user event log for daily quotas
-- 2026-08-21 security audit, FINDING-008 (PAPI-1)
--
-- The daily submission cap counted SURVIVING rows in `presets`, so an author
-- could delete their own presets and submit again all day; flagged edits and
-- preview-image uploads (each of which fans out a moderation embed, a
-- Perspective call and dead-letter rows) had no per-user cap at all.
-- `submission_events` is written on every quota-bearing mutation and never
-- deleted by user action, so the daily counts cannot be reset from the outside.
--
-- Run (deploy window), BEFORE deploying presets-api 2.1.0:
--   wrangler d1 execute xivdyetools-presets --remote --file=migrations/0011_submission_events.sql
--
-- `npm run db:migrate` will NOT apply this: schema.sql is all
-- CREATE TABLE IF NOT EXISTS, so it skips the existing tables and exits 0.

CREATE TABLE IF NOT EXISTS submission_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_discord_id TEXT NOT NULL,
  -- 'submission' | 'flagged_edit' | 'preview_upload'
  kind TEXT NOT NULL CHECK (kind IN ('submission', 'flagged_edit', 'preview_upload')),
  preset_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The daily count is always "this user, this kind, since UTC midnight".
CREATE INDEX IF NOT EXISTS idx_submission_events_user_kind_created
  ON submission_events(user_discord_id, kind, created_at);
