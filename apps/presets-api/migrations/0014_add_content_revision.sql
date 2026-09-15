-- Apply before deploying the revision-aware presets-api.
-- The trigger also covers writes from older workers during rollout.
ALTER TABLE presets ADD COLUMN content_revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER presets_content_revision_after_update
AFTER UPDATE OF name, description, category_id, dyes, tags,
  author_discord_id, author_name, status, is_curated, dye_signature,
  previous_values, example_link, secondary_categories ON presets
FOR EACH ROW WHEN
     NEW.name IS NOT OLD.name OR NEW.description IS NOT OLD.description
  OR NEW.category_id IS NOT OLD.category_id OR NEW.dyes IS NOT OLD.dyes
  OR NEW.tags IS NOT OLD.tags OR NEW.author_discord_id IS NOT OLD.author_discord_id
  OR NEW.author_name IS NOT OLD.author_name OR NEW.status IS NOT OLD.status
  OR NEW.is_curated IS NOT OLD.is_curated OR NEW.dye_signature IS NOT OLD.dye_signature
  OR NEW.previous_values IS NOT OLD.previous_values OR NEW.example_link IS NOT OLD.example_link
  OR NEW.secondary_categories IS NOT OLD.secondary_categories
BEGIN
  UPDATE presets SET content_revision = OLD.content_revision + 1 WHERE id = NEW.id;
END;
