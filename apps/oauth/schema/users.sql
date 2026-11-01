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
  identity_revision INTEGER NOT NULL DEFAULT 0 CHECK (identity_revision >= 0),
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
