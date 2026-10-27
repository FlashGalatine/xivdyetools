-- Additive only. Apply once before deploying either consumer; never replay schema.sql.
CREATE TABLE IF NOT EXISTS ban_identity_memberships (
  ban_id TEXT NOT NULL REFERENCES banned_users(id) ON DELETE CASCADE,
  identity_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('confirmed', 'continuity')),
  PRIMARY KEY (ban_id, identity_id)
);
CREATE INDEX IF NOT EXISTS idx_ban_memberships_identity ON ban_identity_memberships(identity_id, ban_id);

CREATE TRIGGER IF NOT EXISTS ban_membership_insert_capacity
BEFORE INSERT ON ban_identity_memberships
WHEN (SELECT COUNT(*) FROM (
  SELECT identity_id FROM ban_identity_memberships WHERE ban_id = NEW.ban_id
  UNION SELECT discord_id FROM banned_users WHERE id = NEW.ban_id AND discord_id IS NOT NULL
  UNION SELECT xivauth_id FROM banned_users WHERE id = NEW.ban_id AND xivauth_id IS NOT NULL
  UNION SELECT NEW.identity_id
)) > 64
BEGIN SELECT RAISE(ABORT, 'ban scope capacity'); END;

CREATE TRIGGER IF NOT EXISTS ban_membership_update_capacity
BEFORE UPDATE OF ban_id, identity_id ON ban_identity_memberships
WHEN (SELECT COUNT(*) FROM (
  SELECT identity_id FROM ban_identity_memberships WHERE ban_id = NEW.ban_id
    AND NOT (ban_id = OLD.ban_id AND identity_id = OLD.identity_id)
  UNION SELECT discord_id FROM banned_users WHERE id = NEW.ban_id AND discord_id IS NOT NULL
  UNION SELECT xivauth_id FROM banned_users WHERE id = NEW.ban_id AND xivauth_id IS NOT NULL
  UNION SELECT NEW.identity_id
)) > 64
BEGIN SELECT RAISE(ABORT, 'ban scope capacity'); END;

CREATE TRIGGER IF NOT EXISTS ban_legacy_update_capacity
BEFORE UPDATE OF discord_id, xivauth_id ON banned_users
WHEN (SELECT COUNT(*) FROM (
  SELECT identity_id FROM ban_identity_memberships WHERE ban_id = NEW.id
  UNION SELECT NEW.discord_id WHERE NEW.discord_id IS NOT NULL
  UNION SELECT NEW.xivauth_id WHERE NEW.xivauth_id IS NOT NULL
)) > 64
BEGIN SELECT RAISE(ABORT, 'ban scope capacity'); END;

CREATE TABLE IF NOT EXISTS ban_continuity_operations (
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64 AND payload_hash NOT GLOB '*[^0-9a-f]*'),
  state TEXT NOT NULL CHECK (state IN ('applying', 'applied', 'refused')),
  refusal_reason TEXT CHECK (refusal_reason IN ('review_required', 'overflow')),
  matched_bans INTEGER CHECK (matched_bans IS NULL OR (typeof(matched_bans) = 'integer' AND matched_bans BETWEEN 0 AND 16)),
  expires_at INTEGER NOT NULL CHECK (typeof(expires_at) = 'integer'),
  applied_at INTEGER CHECK (applied_at IS NULL OR typeof(applied_at) = 'integer'),
  acknowledged_at INTEGER CHECK (acknowledged_at IS NULL OR typeof(acknowledged_at) = 'integer'),
  acknowledged_outcome TEXT,
  CHECK (
    (state = 'applying' AND refusal_reason IS NULL AND matched_bans IS NOT NULL AND applied_at IS NULL)
    OR (state = 'applied' AND refusal_reason IS NULL AND matched_bans IS NOT NULL AND applied_at IS NOT NULL)
    OR (state = 'refused' AND applied_at IS NOT NULL AND refusal_reason IS NOT NULL
      AND ((refusal_reason = 'overflow' AND matched_bans IS NULL)
        OR (refusal_reason = 'review_required' AND matched_bans IS NOT NULL)))
  ),
  CHECK (
    (acknowledged_at IS NULL AND acknowledged_outcome IS NULL)
    OR (acknowledged_at IS NOT NULL AND acknowledged_outcome IS NOT NULL
      AND ((state = 'applied' AND acknowledged_outcome = 'complete')
        OR (state = 'refused' AND acknowledged_outcome = 'aborted')))
  )
);
CREATE INDEX IF NOT EXISTS idx_ban_continuity_retention ON ban_continuity_operations(state, expires_at, acknowledged_at);

CREATE TABLE IF NOT EXISTS moderation_ban_confirmations (
  nonce TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('ban', 'unban')),
  mode TEXT NOT NULL CHECK (mode IN ('new', 'expand', 'unban')),
  phase TEXT NOT NULL CHECK (phase IN ('select', 'review')),
  ban_id TEXT,
  proposal_json TEXT NOT NULL CHECK (json_valid(proposal_json)),
  proposal_hash TEXT NOT NULL CHECK (length(proposal_hash) = 64 AND proposal_hash NOT GLOB '*[^0-9a-f]*'),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer'),
  expires_at INTEGER NOT NULL CHECK (typeof(expires_at) = 'integer' AND created_at < expires_at AND expires_at <= created_at + 900),
  consumed_at INTEGER,
  outcome TEXT,
  CHECK ((action = 'ban' AND mode IN ('new', 'expand')) OR (action = 'unban' AND mode = 'unban')),
  CHECK ((phase = 'select' AND ban_id IS NULL) OR (phase = 'review' AND ban_id IS NOT NULL)),
  CHECK ((outcome IS NULL AND consumed_at IS NULL)
    OR (outcome IS NOT NULL AND outcome IN ('applying', 'applied') AND consumed_at IS NOT NULL AND typeof(consumed_at) = 'integer'))
);
CREATE INDEX IF NOT EXISTS idx_ban_confirmations_expiry ON moderation_ban_confirmations(expires_at);
