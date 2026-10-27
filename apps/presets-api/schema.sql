-- XIV Dye Tools Community Presets Database Schema
-- Cloudflare D1 (SQLite)

-- ============================================
-- CATEGORIES TABLE
-- Preset categories with metadata
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,                    -- e.g., 'jobs', 'events'
  name TEXT NOT NULL,                     -- Display name
  description TEXT NOT NULL,
  icon TEXT,                              -- Emoji
  is_curated INTEGER DEFAULT 0,          -- 1 = official category (SQLite uses INTEGER for boolean)
  display_order INTEGER DEFAULT 0
);

-- Seed initial categories
INSERT OR IGNORE INTO categories (id, name, description, icon, is_curated, display_order) VALUES
  ('jobs', 'FFXIV Jobs', 'Color schemes inspired by job identities', '⚔️', 1, 1),
  ('grand-companies', 'Grand Companies', 'Official Grand Company colors', '🏛️', 1, 2),
  ('seasons', 'Seasons', 'Seasonal color palettes', '🌸', 1, 3),
  ('events', 'FFXIV Events', 'Colors for in-game seasonal events', '🎉', 1, 4),
  ('aesthetics', 'Aesthetics', 'General aesthetic themes', '✨', 1, 5),
  ('appearance', 'Appearance', 'Palettes built around a character''s own colours', '👤', 1, 6),
  ('zones', 'Zones', 'Palettes drawn from the places of Eorzea', '🏔️', 1, 7),
  ('raids-trials', 'Raids & Trials', 'Palettes from raid and trial encounters', '🗡️', 1, 8);

-- ============================================
-- PRESETS TABLE
-- Stores both curated and community palettes
-- ============================================
CREATE TABLE IF NOT EXISTS presets (
  id TEXT PRIMARY KEY,                    -- UUID v4
  name TEXT NOT NULL,                     -- 2-50 characters
  description TEXT NOT NULL,              -- 10-200 characters
  category_id TEXT NOT NULL,              -- FK to categories
  dyes TEXT NOT NULL,                     -- JSON array: [5738, 13115, 13117]
  tags TEXT NOT NULL,                     -- JSON array: ["dark", "gothic"]
  author_discord_id TEXT,                 -- Discord user ID (NULL for curated)
  author_name TEXT,                       -- Display name at submission time
  vote_count INTEGER DEFAULT 0,           -- Denormalized for fast sorting
  status TEXT DEFAULT 'pending',          -- pending | approved | rejected | flagged
  is_curated INTEGER DEFAULT 0,           -- 1 for official presets (SQLite boolean)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  -- PRESETS-CRITICAL-001: Duplicate detection signature (sorted dye IDs as JSON)
  dye_signature TEXT,
  -- Store pre-edit values for moderation revert capability
  previous_values TEXT,
  -- 8A: allowlisted example-link page URL (stored, never a copy of the image)
  example_link TEXT,
  preview_image_key TEXT,
  preview_image_status TEXT NOT NULL DEFAULT 'none',
  -- Up to two additional categories; category_id remains the primary
  secondary_categories TEXT NOT NULL DEFAULT '[]',
  -- Internal optimistic concurrency token; the trigger below owns increments.
  content_revision INTEGER NOT NULL DEFAULT 0,

  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Keep content/moderation writes from every worker in one revision domain.
-- Votes, preview-image changes and timestamps do not invalidate an owner edit.
CREATE TRIGGER IF NOT EXISTS presets_content_revision_after_update
AFTER UPDATE OF name, description, category_id, dyes, tags,
  author_discord_id, author_name, status, is_curated, dye_signature,
  previous_values, example_link, secondary_categories ON presets
FOR EACH ROW WHEN
     NEW.name IS NOT OLD.name OR NEW.description IS NOT OLD.description
  OR NEW.category_id IS NOT OLD.category_id OR NEW.dyes IS NOT OLD.dyes
  OR NEW.tags IS NOT OLD.tags OR NEW.author_discord_id IS NOT OLD.author_discord_id
  OR NEW.author_name IS NOT OLD.author_name OR NEW.status IS NOT OLD.status
  OR NEW.is_curated IS NOT OLD.is_curated OR NEW.dye_signature IS NOT OLD.dye_signature
  OR NEW.previous_values IS NOT OLD.previous_values OR NEW.example_link IS NOT OLD.example_link
  OR NEW.secondary_categories IS NOT OLD.secondary_categories
BEGIN
  UPDATE presets SET content_revision = OLD.content_revision + 1 WHERE id = NEW.id;
END;

-- Indexes for common query patterns (single column)
CREATE INDEX IF NOT EXISTS idx_presets_category ON presets(category_id);
CREATE INDEX IF NOT EXISTS idx_presets_status ON presets(status);
CREATE INDEX IF NOT EXISTS idx_presets_vote_count ON presets(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_presets_author ON presets(author_discord_id);
CREATE INDEX IF NOT EXISTS idx_presets_created ON presets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_presets_curated ON presets(is_curated);

-- PERFORMANCE: Composite indexes for filtered + sorted queries
-- These allow SQLite to satisfy both WHERE and ORDER BY from the index
-- Order: equality columns first, then sort columns

-- For: WHERE status = 'approved' AND category_id = ? ORDER BY vote_count DESC
CREATE INDEX IF NOT EXISTS idx_presets_status_category_vote ON presets(status, category_id, vote_count DESC);

-- For: WHERE status = 'approved' ORDER BY vote_count DESC (popular presets)
CREATE INDEX IF NOT EXISTS idx_presets_status_vote ON presets(status, vote_count DESC);

-- For: WHERE status = 'approved' ORDER BY created_at DESC (recent presets)
CREATE INDEX IF NOT EXISTS idx_presets_status_created ON presets(status, created_at DESC);

-- For: WHERE author_discord_id = ? ORDER BY created_at DESC (user's presets)
CREATE INDEX IF NOT EXISTS idx_presets_author_created ON presets(author_discord_id, created_at DESC);

-- For: Full-text search optimization (name lookups)
CREATE INDEX IF NOT EXISTS idx_presets_name ON presets(name);

-- PRESETS-CRITICAL-001: UNIQUE constraint prevents duplicate dye combinations at DB level
-- dye_signature is computed by sorting dye IDs and JSON stringifying: [1,12,40] -> "[1,12,40]"
-- BUG-003 (2026-07-18 audit): partial index so rejected/hidden presets don't
-- permanently block their dye combination — matches the status filter used by
-- findDuplicatePreset / findDuplicatePresetExcluding
CREATE UNIQUE INDEX IF NOT EXISTS idx_presets_dye_signature
  ON presets(dye_signature)
  WHERE status IN ('approved', 'pending');

-- ============================================
-- VOTES TABLE
-- One vote per user per preset (composite PK)
-- ============================================
CREATE TABLE IF NOT EXISTS votes (
  preset_id TEXT NOT NULL,
  user_discord_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (preset_id, user_discord_id),
  FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
);

-- Index for finding all votes by a user
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_discord_id);

-- ============================================
-- MODERATION LOG TABLE
-- Audit trail for moderation actions
-- ============================================
-- Migration 0013 (2026-08-29 audit, FINDING-018) relaxed preset_id and added
-- target_discord_id so the user-level ban / unban actions xivdyetools-moderation-worker
-- performs on this database can be logged here too.
CREATE TABLE IF NOT EXISTS moderation_log (
  id TEXT PRIMARY KEY,                    -- UUID v4
  preset_id TEXT,                         -- NULL for user-level actions (ban | unban)
  moderator_discord_id TEXT NOT NULL,
  action TEXT NOT NULL,                   -- approve | reject | flag | unflag | requeue | revert | ban | unban | hide | restore | image_approve | image_reject
  reason TEXT,
  target_discord_id TEXT,                 -- the moderated user: set for ban | unban | hide | restore
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
);

-- Index for finding moderation history of a preset
CREATE INDEX IF NOT EXISTS idx_moderation_log_preset ON moderation_log(preset_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_moderator ON moderation_log(moderator_discord_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON moderation_log(created_at DESC);

-- REFACTOR-018 (2026-07-18 audit): the unused rate_limits table was dropped in
-- migration 0006 — IP limits are in-memory, submission limits count presets rows.

-- ============================================
-- BANNED USERS TABLE (Migration 0003)
-- Tracks banned users with audit information
-- ============================================
CREATE TABLE IF NOT EXISTS banned_users (
  id TEXT PRIMARY KEY,                        -- UUID v4
  discord_id TEXT,                            -- Discord snowflake (nullable)
  xivauth_id TEXT,                            -- XIVAuth UUID (nullable)
  username TEXT NOT NULL,                     -- Username at time of ban
  moderator_discord_id TEXT NOT NULL,         -- Discord ID of moderator who issued ban
  reason TEXT NOT NULL,                       -- Reason for ban (10-500 chars)
  banned_at TEXT DEFAULT (datetime('now')),   -- Timestamp of ban
  unbanned_at TEXT,                           -- Timestamp of unban (NULL if still banned)
  unban_moderator_discord_id TEXT,            -- Discord ID of moderator who unbanned

  CHECK (discord_id IS NOT NULL OR xivauth_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_banned_users_discord_active
  ON banned_users(discord_id)
  WHERE discord_id IS NOT NULL AND unbanned_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_banned_users_xivauth_active
  ON banned_users(xivauth_id)
  WHERE xivauth_id IS NOT NULL AND unbanned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_banned_users_active
  ON banned_users(banned_at DESC)
  WHERE unbanned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_banned_users_moderator
  ON banned_users(moderator_discord_id);

-- ============================================
-- FAILED NOTIFICATIONS TABLE (Migration 0005 / BUG-015)
-- Dead-letter queue for Discord notifications that fail after all retries
-- ============================================
CREATE TABLE IF NOT EXISTS failed_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  error TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_failed_notifications_unresolved
  ON failed_notifications(resolved_at)
  WHERE resolved_at IS NULL;

-- ============================================
-- SUBMISSION EVENTS TABLE (Migrations 0011 / FINDING-008, 0012 / FINDING-005)
-- Append-only per-user log of quota-bearing mutations (submission,
-- flagged_edit, preview_upload, text_edit). User actions never delete rows
-- here, so the daily caps cannot be reset by deleting one's own presets.
-- An EXISTING database needs migrations/0012_submission_events_text_edit.sql
-- for 'text_edit' — this file only ever creates missing tables.
-- ============================================
CREATE TABLE IF NOT EXISTS submission_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_discord_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('submission', 'flagged_edit', 'preview_upload', 'text_edit')),
  preset_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_submission_events_user_kind_created
  ON submission_events(user_discord_id, kind, created_at);

-- The age-based prune (FINDING-017) matches on `created_at` alone, which the
-- composite index above cannot serve; it runs on every quota write.
CREATE INDEX IF NOT EXISTS idx_submission_events_created
  ON submission_events(created_at);
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
