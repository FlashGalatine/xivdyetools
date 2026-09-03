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
-- and previous_values migration) is data-dependent. On production it ran
-- 2026-08-28 and was re-verified 2026-09-01 (0 legacy itemIDs in all 16 rows),
-- so nothing further is needed there.
--
-- Its generator, scripts/migrate-dyes-to-stainids.ts, was REMOVED on 2026-09-01
-- together with the client-side legacy fallback it unblocked (dead-code audit
-- DEAD-007/013). If you are replaying this file against a fresh install, a local
-- dev D1 or a restore that still holds legacy itemIDs, recover that script from
-- git history rather than looking for it in the tree. A database seeded from
-- scratch by 5.0 code already stores stainIDs and needs no Part 2 at all. The
-- validation range guard rejects the wrong era loudly either way.

UPDATE presets SET category_id = 'aesthetics', updated_at = CURRENT_TIMESTAMP
WHERE category_id = 'community';

DELETE FROM categories WHERE id = 'community';
