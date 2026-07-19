-- Migration 0006: Status-filtered dye_signature uniqueness + drop unused rate_limits table
-- 2026-07-18 audit: BUG-003, REFACTOR-018
--
-- BUG-003: the full UNIQUE index on presets(dye_signature) covered rejected/
-- hidden rows, but both duplicate checks filter status IN ('approved','pending').
-- A rejected preset therefore permanently poisoned its dye combination: any
-- resubmission hit the constraint, the recovery lookup (same status filter)
-- found nothing, and the user got a 500 forever. The partial index makes the
-- constraint match the checks — rejected/hidden rows no longer block reuse.
--
-- REFACTOR-018: rate_limits was never read or written by any code path
-- (IP limits are in-memory, daily submission limits count rows in presets).

DROP INDEX IF EXISTS idx_presets_dye_signature;

CREATE UNIQUE INDEX idx_presets_dye_signature
  ON presets(dye_signature)
  WHERE status IN ('approved', 'pending');

DROP INDEX IF EXISTS idx_rate_limits_expires;
DROP TABLE IF EXISTS rate_limits;
