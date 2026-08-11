-- Multi-category presets + the three categories confirmed in the Turn 23
-- design pass (6a appearance / 6b zones / 6c raids-trials).
-- See docs/superpowers/specs/2026-08-11-preset-categories-and-image-editing-design.md
--
-- Run (deploy window), BEFORE deploying the new presets-api:
--   wrangler d1 execute xivdyetools-presets --remote --file=migrations/0010_add_secondary_categories.sql
--
-- `npm run db:migrate` will NOT apply this: schema.sql is all
-- CREATE TABLE IF NOT EXISTS, so it skips the existing table and exits 0.

-- category_id stays the PRIMARY category (FK and indexes untouched); this
-- column carries up to two more. NOT NULL with a default so every existing
-- row is valid immediately and no backfill is needed.
ALTER TABLE presets ADD COLUMN secondary_categories TEXT NOT NULL DEFAULT '[]';

INSERT OR IGNORE INTO categories (id, name, description, icon, is_curated, display_order) VALUES
  ('appearance',   'Appearance',     'Palettes built around a character''s own colours', '👤', 1, 6),
  ('zones',        'Zones',          'Palettes drawn from the places of Eorzea',         '🏔️', 1, 7),
  ('raids-trials', 'Raids & Trials', 'Palettes from raid and trial encounters',          '🗡️', 1, 8);
