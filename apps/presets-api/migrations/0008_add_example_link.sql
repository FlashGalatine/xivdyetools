-- 8A Gallery: submissions gain an example link (Eorzea Collection / Imgur /
-- Flickr page URL). The LINK is stored, never a copy of the image — if the
-- author takes the page down, it disappears here too. Host allowlist is
-- enforced in validation-service.ts, mirrored client-side.
--
-- Run (deploy window):
--   wrangler d1 execute xivdyetools-presets --file=migrations/0008_add_example_link.sql
--   (add --local to test against the local D1 first)

ALTER TABLE presets ADD COLUMN example_link TEXT;
