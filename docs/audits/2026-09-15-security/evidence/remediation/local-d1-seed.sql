INSERT INTO categories (id, name, description) VALUES ('smoke', 'Smoke', 'Synthetic local migration smoke category');
INSERT INTO presets (id, name, description, category_id, dyes, tags, author_discord_id, author_name, status)
VALUES ('smoke-preset-001', 'Smoke Preset', 'Synthetic preset for local D1 migration smoke', 'smoke', '[1,2,3]', '["smoke"]', 'user-001', 'Smoke User', 'pending');
