-- XIV Dye Tools - Add Banned Users Table
-- Migration 0003: User ban system for Preset Palettes moderation
--
-- This table tracks users who have been banned from the Preset Palettes feature.
-- Banned users cannot submit, vote, or edit presets. Their existing presets
-- are hidden (status = 'hidden') until they are unbanned.

-- ============================================
-- BANNED_USERS TABLE
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

  -- At least one identifier must be present
  CHECK (discord_id IS NOT NULL OR xivauth_id IS NOT NULL)
);

-- Indexes for fast ban status lookups
-- Unique partial index ensures only one active ban per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_banned_users_discord_active
  ON banned_users(discord_id)
  WHERE discord_id IS NOT NULL AND unbanned_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_banned_users_xivauth_active
  ON banned_users(xivauth_id)
  WHERE xivauth_id IS NOT NULL AND unbanned_at IS NULL;

-- Index for listing all active bans
CREATE INDEX IF NOT EXISTS idx_banned_users_active
  ON banned_users(banned_at DESC)
  WHERE unbanned_at IS NULL;

-- Index for audit trail by moderator
CREATE INDEX IF NOT EXISTS idx_banned_users_moderator
  ON banned_users(moderator_discord_id);
