-- Apply before deploying the preview cleanup job. This table has no foreign
-- key to presets so its records survive a whole-preset delete.
CREATE TABLE IF NOT EXISTS preview_image_cleanup (
  object_key TEXT NOT NULL PRIMARY KEY,
  preset_id TEXT NOT NULL,
  next_attempt_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE INDEX IF NOT EXISTS idx_preview_image_cleanup_due
  ON preview_image_cleanup(next_attempt_at, object_key);

CREATE INDEX IF NOT EXISTS idx_preview_image_cleanup_preset
  ON preview_image_cleanup(preset_id);
