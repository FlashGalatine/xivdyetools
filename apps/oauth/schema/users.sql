-- XIV Dye Tools Users Database Schema
-- Supports multiple OAuth providers (Discord, XIVAuth)

-- This file builds a FRESH database. An existing one is brought into line by
-- the numbered files in ../migrations/ (hand-run — see their headers).
--
-- 2026-08-29 security audit (FINDING-001 / FINDING-002): the `xivauth_characters`
-- roster table and the `users.avatar_url` column are gone. The roster (Lodestone
-- ids, character names, home worlds — unverified registrations included) was
-- written on every XIVAuth sign-in with no reader, no retention and no
-- disclosure; `avatar_url` was write-only, since every response recomputes the
-- CDN URL from the Discord id + avatar hash.

-- Users table: stores authenticated users from any provider
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                      -- UUID v4, our internal user ID
  discord_id TEXT,                          -- Discord snowflake (nullable)
  xivauth_id TEXT,                          -- XIVAuth UUID (nullable)
  auth_provider TEXT NOT NULL,              -- Last used: 'discord' | 'xivauth'
  username TEXT NOT NULL,                   -- Display name
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  -- Constraint: at least one provider ID must be set
  CHECK (discord_id IS NOT NULL OR xivauth_id IS NOT NULL)
);

-- Indexes for fast lookups by provider ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id) WHERE discord_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_xivauth_id ON users(xivauth_id) WHERE xivauth_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
