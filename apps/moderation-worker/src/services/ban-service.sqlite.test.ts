import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isPresetAuthorBanned,
  searchBannedUsers,
  searchPresetAuthors,
  getPresetAuthorName,
} from './ban-service.js';
const D = '123456789012345678',
  U = 'a0000000-0000-4000-8000-000000000001';
describe('recorded memberships on the shipped schema', () => {
  let raw: DatabaseSync, db: D1Database;
  beforeEach(() => {
    raw = new DatabaseSync(':memory:');
    raw.exec(readFileSync(resolve(import.meta.dirname, '../../../presets-api/schema.sql'), 'utf8'));
    const prepare = (sql: string, values: unknown[] = []): unknown => ({
      bind: (...args: unknown[]) => prepare(sql, args),
      first: async () => raw.prepare(sql).get(...(values as never[])) ?? null,
      all: async () => ({ results: raw.prepare(sql).all(...(values as never[])) }),
    });
    db = { prepare } as unknown as D1Database;
    raw
      .prepare(
        "INSERT INTO presets(id,name,description,category_id,dyes,tags,author_discord_id,author_name,status) VALUES ('linked-pending','Pending','Description','jobs','[]','[]',?,'Author','pending')",
      )
      .run(U);
    raw
      .prepare(
        "INSERT INTO banned_users(id,discord_id,username,moderator_discord_id,reason) VALUES ('parent',?,'Target','999999999999999999','Valid reason')",
      )
      .run(D);
    raw
      .prepare(
        "INSERT INTO ban_identity_memberships(ban_id,identity_id,source) VALUES ('parent',?,'confirmed')",
      )
      .run(U);
  });
  afterEach(() => raw.close());
  it('refuses approval for an author covered only by an active parent membership', async () => {
    expect(await isPresetAuthorBanned(db, 'linked-pending')).toBe(true);
    raw.exec("UPDATE banned_users SET unbanned_at=datetime('now')");
    expect(await isPresetAuthorBanned(db, 'linked-pending')).toBe(false);
  });
  it('active legacy columns still refuse and inactive/unknown accounts do not', async () => {
    raw.prepare('UPDATE presets SET author_discord_id=?').run(D);
    expect(await isPresetAuthorBanned(db, 'linked-pending')).toBe(true);
    expect(await isPresetAuthorBanned(db, 'missing-preset')).toBe(false);
    raw.exec('DELETE FROM ban_identity_memberships');
    raw.prepare('UPDATE presets SET author_discord_id=?').run(U);
    raw.prepare('UPDATE banned_users SET discord_id=NULL,xivauth_id=?').run(U);
    expect(await isPresetAuthorBanned(db, 'linked-pending')).toBe(true);
  });
  it('membership-only query finds the exact active ban and preserves partial authors in expansion picker', async () => {
    expect(await searchBannedUsers(db, U)).toMatchObject([{ discordId: D, username: 'Target' }]);
    expect(await searchPresetAuthors(db, 'Author')).toEqual([
      { discordId: U, username: 'Author', presetCount: 1 },
    ]);
    expect(await getPresetAuthorName(db, U)).toBe('Author');
    expect(await getPresetAuthorName(db, D)).toBeNull();
  });
});
