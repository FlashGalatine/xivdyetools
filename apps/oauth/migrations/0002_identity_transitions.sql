-- Hand-run exactly once BEFORE deploying the dependent OAuth worker.
-- Use wrangler d1 execute <database> --file=...; never d1 migrations apply.
ALTER TABLE users ADD COLUMN identity_revision INTEGER NOT NULL DEFAULT 0 CHECK (identity_revision >= 0);

CREATE TABLE identity_operations (
  id TEXT PRIMARY KEY NOT NULL,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  state TEXT NOT NULL CHECK (state IN ('pending','complete','aborted')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at AND expires_at <= created_at + 900),
  finished_at INTEGER,
  acknowledged_at INTEGER,
  resolution TEXT CHECK (resolution IN ('applied','refused','missing')),
  CHECK ((state = 'pending' AND finished_at IS NULL AND acknowledged_at IS NULL) OR (state != 'pending' AND finished_at IS NOT NULL)),
  CHECK ((state = 'pending' AND resolution IS NULL) OR (state = 'complete' AND resolution IS NOT NULL AND resolution = 'applied') OR (state = 'aborted' AND resolution IS NOT NULL AND resolution IN ('refused','missing'))),
  CHECK (acknowledged_at IS NULL OR resolution IN ('applied','refused'))
);
CREATE TABLE identity_operation_locks (
  resource_key TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL REFERENCES identity_operations(id) ON DELETE CASCADE
);
CREATE INDEX idx_identity_operation_locks_operation ON identity_operation_locks(operation_id);
