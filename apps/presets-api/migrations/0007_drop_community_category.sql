-- 5.0 stainID migration, part 1 (schema-level).
--
-- The 'community' category value is dropped everywhere (5.0 decision):
-- community-ness is a source, not a category. Rows that carried it move to
-- 'events' as the least-wrong home only if any exist; the row itself goes.
-- getValidCategories reads the DB (PRESETS-CRITICAL-002), so this is the
-- data change that actually retires the value.
--
-- Part 2 (the presets.dyes legacy->stainID rewrite, dye_signature recompute,
-- and previous_values migration) is data-dependent: generate it with
-- scripts/migrate-dyes-to-stainids.ts and apply the emitted SQL in the SAME
-- maintenance window as deploying the 5.0 workers. The validation range
-- guard rejects the wrong era loudly afterwards.

UPDATE presets SET category_id = 'events', updated_at = CURRENT_TIMESTAMP
WHERE category_id = 'community';

DELETE FROM categories WHERE id = 'community';
