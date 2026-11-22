import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { URL } from 'node:url';
import { expect, it } from 'vitest';

const migration = readFileSync(new URL('../../migrations/0017_preview_image_cleanup.sql', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');

function cleanupDefinitions(db: DatabaseSync) {
  return db.prepare(
    "SELECT type, name, sql FROM sqlite_master WHERE tbl_name = 'preview_image_cleanup' ORDER BY name",
  ).all();
}

it('upgrades an existing database without enqueuing live previews and preserves pending work on replay', () => {
  const upgraded = new DatabaseSync(':memory:');
  const fresh = new DatabaseSync(':memory:');
  try {
    upgraded.exec("CREATE TABLE presets (id TEXT PRIMARY KEY, preview_image_key TEXT); INSERT INTO presets VALUES ('p', 'p/live.webp')");
    upgraded.exec(migration);
    fresh.exec(schema);
    expect(cleanupDefinitions(upgraded)).toEqual(cleanupDefinitions(fresh));
    expect(upgraded.prepare('SELECT object_key FROM preview_image_cleanup').all()).toEqual([]);
    upgraded.exec("INSERT INTO preview_image_cleanup (preset_id, object_key) VALUES ('p', 'p/old.webp')");
    upgraded.exec(migration);
    expect(upgraded.prepare('SELECT preview_image_key FROM presets').all()).toEqual([{ preview_image_key: 'p/live.webp' }]);
    expect(upgraded.prepare('SELECT object_key FROM preview_image_cleanup').all()).toEqual([{ object_key: 'p/old.webp' }]);
  } finally {
    upgraded.close();
    fresh.close();
  }
});
