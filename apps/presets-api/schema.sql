-- XIV Dye Tools Community Presets Database Schema
-- Cloudflare D1 (SQLite)

-- ============================================
-- CATEGORIES TABLE
-- Preset categories with metadata
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,                    -- e.g., 'jobs', 'community'
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
  ('community', 'Community', 'Community-submitted palettes', '👥', 0, 6);

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

  FOREIGN KEY (category_id) REFERENCES categories(id)
);

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

-- Note: D1 doesn't support generated columns, so we'll compute dye_signature in application code
-- The signature is computed by sorting dye IDs and JSON stringifying: [1,12,40] -> "[1,12,40]"
-- We store it in a separate column for indexing
-- PRESETS-CRITICAL-001: UNIQUE constraint prevents duplicate dye combinations at DB level
ALTER TABLE presets ADD COLUMN dye_signature TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_presets_dye_signature ON presets(dye_signature);

-- Store pre-edit values for moderation revert capability
-- JSON: {"name": "...", "description": "...", "tags": [...], "dyes": [...]}
-- Only populated when an edit is flagged by content moderation
ALTER TABLE presets ADD COLUMN previous_values TEXT;

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
CREATE TABLE IF NOT EXISTS moderation_log (
  id TEXT PRIMARY KEY,                    -- UUID v4
  preset_id TEXT NOT NULL,
  moderator_discord_id TEXT NOT NULL,
  action TEXT NOT NULL,                   -- approve | reject | flag | unflag | revert
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
);

-- Index for finding moderation history of a preset
CREATE INDEX IF NOT EXISTS idx_moderation_log_preset ON moderation_log(preset_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_moderator ON moderation_log(moderator_discord_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON moderation_log(created_at DESC);

-- ============================================
-- RATE LIMITING TABLE (optional, for persistent rate limits)
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,                   -- e.g., "submit:123456789" or "ip:1.2.3.4"
  count INTEGER DEFAULT 1,
  window_start TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);
