-- presets-api 2.4.0 rollout (2026-10-03 security audit): hand-run AFTER the deploy, in the same window.
--   wrangler d1 execute xivdyetools-presets --env production --remote --file=migrations/0015_rewrite_legacy_dead_letters.sql
-- Rows written before 2026-08-30 (commit 780cf992) hold the whole notification (author id, author
-- name, preset text) in failed_notifications.payload. This rewrites them in place to
-- toDeadLetterRecord's reduced { type, preset_id, moderation_status? } shape, skipping rows already
-- reduced or unparsable. Idempotent. json_patch drops a null moderation_status (legacy preview rows).
-- tests/services/failed-notifications-legacy-rewrite.test.ts runs this file against real SQLite.
UPDATE failed_notifications SET payload = json_patch(json_object('type', json_extract(payload, '$.type'), 'preset_id', json_extract(payload, '$.preset.id')), json_object('moderation_status', json_extract(payload, '$.preset.moderation_status'))) WHERE CASE WHEN json_valid(payload) THEN json_extract(payload, '$.preset.id') IS NOT NULL ELSE 0 END;
