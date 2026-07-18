# [REFACTOR-018]: Unused rate_limits table in presets schema

## Priority
LOW

## Category
Dead Code (schema)

## Location
- File(s): `apps/presets-api/schema.sql:120-128` (table + `idx_rate_limits_expires` index)
- Scope: schema level

## Current State
`schema.sql` defines a `rate_limits` table ("optional, for persistent rate limits") with `key`, `count`, `window_start`, `expires_at`, plus a cleanup index. Grep across `apps/presets-api/src/` finds zero references — no code reads or writes it. IP rate limiting uses the in-memory `@xivdyetools/rate-limiter` (middleware/rate-limit.ts), and the daily submission limit counts rows in `presets` directly (rate-limit-service.ts:85-96).

## Issues
- Dead schema misleads readers into assuming persistent rate limiting exists.
- The table accrues no rows but still ships in every fresh D1 provisioning and migration review.

## Proposed Refactoring
Either:
1. **Drop it** — migration with `DROP TABLE IF EXISTS rate_limits; DROP INDEX IF EXISTS idx_rate_limits_expires;` and remove from `schema.sql`; or
2. **Use it** — as the atomic counter backstop for the daily submission limit's TOCTOU (BUG-049): `INSERT ... ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count`, which would give the check-then-insert flow a race-free enforcement point.

Option 2 extracts real value from otherwise-dead schema and closes BUG-049 at the same time.

## Benefits
- Schema reflects reality (or the table earns its keep by fixing a race).
- One less thing to reason about in future D1 migrations.

## Effort Estimate
LOW

## Risk Assessment
LOW. The table is empty and unreferenced; dropping it cannot affect runtime. If choosing option 2, the new counter path needs a TTL/cleanup strategy (the `expires_at` column and index already anticipate this).

> Source: evidence/d1-workers-analysis.md (2026-07-18 deep-dive, d1-workers area)
