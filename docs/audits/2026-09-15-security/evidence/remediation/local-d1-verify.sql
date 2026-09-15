SELECT 'existing_row_revision' AS check_name, id, content_revision, status FROM presets WHERE id = 'smoke-preset-001';

UPDATE presets SET status = 'approved' WHERE id = 'smoke-preset-001' AND content_revision = 0;
SELECT 'moderation_update' AS check_name, changes() AS changed_rows;
SELECT 'after_moderation_revision' AS check_name, content_revision, status FROM presets WHERE id = 'smoke-preset-001';

UPDATE presets SET status = 'rejected' WHERE id = 'smoke-preset-001' AND content_revision = 0;
SELECT 'stale_update' AS check_name, changes() AS changed_rows;
INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason)
SELECT 'audit-stale-001', id, 'moderator-001', 'reject', 'stale'
FROM presets WHERE id = 'smoke-preset-001' AND changes() > 0;
SELECT 'stale_audit_insert' AS check_name, changes() AS inserted_rows;

UPDATE presets SET status = 'rejected' WHERE id = 'smoke-preset-001' AND content_revision = 1;
SELECT 'fresh_update' AS check_name, changes() AS changed_rows;
INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason)
SELECT 'audit-fresh-001', id, 'moderator-001', 'reject', 'fresh'
FROM presets WHERE id = 'smoke-preset-001' AND changes() > 0;
SELECT 'fresh_audit_insert' AS check_name, changes() AS inserted_rows;

INSERT INTO votes (preset_id, user_discord_id) VALUES ('smoke-preset-001', 'voter-001');
UPDATE presets SET preview_image_key = 'preview/smoke.png', preview_image_status = 'approved'
WHERE id = 'smoke-preset-001';
SELECT 'vote_preview_only' AS check_name, content_revision, status, preview_image_status
FROM presets WHERE id = 'smoke-preset-001';
SELECT 'moderation_log_rows' AS check_name, COUNT(*) AS row_count FROM moderation_log WHERE preset_id = 'smoke-preset-001';
SELECT 'vote_rows' AS check_name, COUNT(*) AS row_count FROM votes WHERE preset_id = 'smoke-preset-001';
