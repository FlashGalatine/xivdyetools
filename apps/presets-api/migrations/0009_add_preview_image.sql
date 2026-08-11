-- Preset preview images: the author uploads a picture for the card. Separate
-- from example_link, which points at a PAGE about the glamour and is never
-- fetched. See docs/superpowers/specs/2026-08-10-preset-glamour-thumbnails-design.md
--
-- Run (deploy window), BEFORE deploying the new presets-api:
--   wrangler d1 execute xivdyetools-presets --remote --file=migrations/0009_add_preview_image.sql
--
-- `npm run db:migrate` will NOT apply this: schema.sql is all
-- CREATE TABLE IF NOT EXISTS, so it skips the existing table and exits 0.

ALTER TABLE presets ADD COLUMN preview_image_key TEXT;
ALTER TABLE presets ADD COLUMN preview_image_status TEXT NOT NULL DEFAULT 'none';
