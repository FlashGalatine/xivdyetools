-- BUG-015: Dead-letter table for failed Discord notifications
-- Stores notification payloads that failed after all retries are exhausted,
-- so moderators can review and manually act on missed notifications.

CREATE TABLE IF NOT EXISTS failed_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  error TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

-- Index for querying unresolved notifications efficiently
CREATE INDEX idx_failed_notifications_unresolved
  ON failed_notifications(resolved_at)
  WHERE resolved_at IS NULL;
