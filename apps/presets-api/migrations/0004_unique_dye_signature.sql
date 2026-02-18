-- PRESETS-CRITICAL-001: Add UNIQUE constraint on dye_signature
--
-- This migration converts the existing regular index on dye_signature
-- to a UNIQUE index, preventing duplicate dye combinations at the database level.
--
-- The application code in presets.ts already handles the UNIQUE constraint
-- violation by converting it to a vote on the existing preset (lines 440-458).
--
-- IMPORTANT: Before running this migration, ensure no duplicate dye_signature
-- values exist in the presets table. Check with:
--   SELECT dye_signature, COUNT(*) as cnt
--   FROM presets
--   WHERE dye_signature IS NOT NULL
--   GROUP BY dye_signature
--   HAVING cnt > 1;

-- Step 1: Drop the existing non-unique index
DROP INDEX IF EXISTS idx_presets_dye_signature;

-- Step 2: Create the UNIQUE index
-- This enforces uniqueness at the database level
CREATE UNIQUE INDEX idx_presets_dye_signature ON presets(dye_signature);
