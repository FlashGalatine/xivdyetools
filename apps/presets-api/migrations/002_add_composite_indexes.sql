-- Migration: Add composite indexes for performance
-- Date: 2025-12-07
-- Description: Adds composite indexes for filtered + sorted queries

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
