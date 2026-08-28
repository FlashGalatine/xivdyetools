-- 5.0 stainID migration, part 1 (schema-level).
--
-- The 'community' category value is dropped everywhere (5.0 decision):
-- community-ness is a source, not a category. Rows that carried it move to
-- 'aesthetics' only if any exist; the row itself goes. getValidCategories
-- reads the DB (PRESETS-CRITICAL-002), so this is the data change that
-- actually retires the value.
--
-- Landing category changed 'events' -> 'aesthetics' on 2026-08-10: a preset
-- filed under a source rather than a theme is a general-purpose palette, which
-- is what 'aesthetics' means here. 'events' asserts a tie to a specific FFXIV
-- event that these rows never claimed.
--
-- Already applied to production, where it matched ZERO rows (no preset was
-- ever filed under 'community'), so this edit changes nothing there. It
-- governs any other database the file is replayed against — a fresh install,
-- a local dev D1, or a restore.
--
-- Part 2 (the presets.dyes legacy->stainID rewrite, dye_signature recompute,
-- and previous_values migration) is data-dependent: generate it with
-- scripts/migrate-dyes-to-stainids.ts and apply the emitted SQL in the SAME
-- maintenance window as deploying the 5.0 workers. The validation range
-- guard rejects the wrong era loudly afterwards.

UPDATE presets SET category_id = 'aesthetics', updated_at = CURRENT_TIMESTAMP
WHERE category_id = 'community';

DELETE FROM categories WHERE id = 'community';
