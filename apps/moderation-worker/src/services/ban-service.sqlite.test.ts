/**
 * ban-service against a REAL SQLite engine (Node's built-in `node:sqlite`,
 * Node >= 22.5; the repo requires >= 22.13).
 *
 * The shared `createMockD1Database` records statements without evaluating
 * them, so it can prove what SQL was sent but not what that SQL does. The
 * three 2026-10-03 fixes below are about exactly that — which rows match,
 * which survive, which index trips — so they run here against the real
 * `banned_users` / `presets` / `moderation_log` shapes from
 * `apps/presets-api/schema.sql` (only the columns this worker touches).
 *
 * - FINDING-005: unban blanks `username` and `reason`
 * - FINDING-014: a UUID ban is also written to `xivauth_id`; every ban read
 *   matches `discord_id` OR `xivauth_id`
 * - FINDING-021: unban's restore skips signature collisions instead of
 *   aborting the batch
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  banUser,
  unbanUser,
  getActiveBan,
  isPresetAuthorBanned,
  isUserBannedByDiscordId,
  searchBannedUsers,
  searchPresetAuthors,
} from './ban-service.js';

const SCHEMA = `
CREATE TABLE presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  author_discord_id TEXT,
  author_name TEXT,
  status TEXT DEFAULT 'pending',
  dye_signature TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_presets_dye_signature
  ON presets(dye_signature) WHERE status IN ('approved', 'pending');

CREATE TABLE banned_users (
  id TEXT PRIMARY KEY,
  discord_id TEXT,
  xivauth_id TEXT,
  username TEXT NOT NULL,
  moderator_discord_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  banned_at TEXT DEFAULT (datetime('now')),
  unbanned_at TEXT,
  unban_moderator_discord_id TEXT,
  CHECK (discord_id IS NOT NULL OR xivauth_id IS NOT NULL)
);
CREATE UNIQUE INDEX idx_banned_users_discord_active
  ON banned_users(discord_id) WHERE discord_id IS NOT NULL AND unbanned_at IS NULL;
CREATE UNIQUE INDEX idx_banned_users_xivauth_active
  ON banned_users(xivauth_id) WHERE xivauth_id IS NOT NULL AND unbanned_at IS NULL;

CREATE TABLE moderation_log (
  id TEXT PRIMARY KEY,
  preset_id TEXT,
  moderator_discord_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  target_discord_id TEXT,
  created_at TEXT NOT NULL
);
`;

type Bound = unknown[];

/** Just enough of D1Database for ban-service: prepare/bind/first/all/run + atomic batch. */
function createSqliteD1(raw: DatabaseSync): D1Database {
  const makeStatement = (sql: string, values: Bound = []) => ({
    bind: (...next: unknown[]) => makeStatement(sql, next),
    first: async () => (raw.prepare(sql).get(...(values as never[])) as unknown) ?? null,
    all: async () => ({
      results: raw.prepare(sql).all(...(values as never[])),
      success: true,
      meta: {},
    }),
    run: async () => {
      const info = raw.prepare(sql).run(...(values as never[]));
      return { results: [], success: true, meta: { changes: Number(info.changes) } };
    },
  });
  return {
    prepare: (sql: string) => makeStatement(sql),
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
      raw.exec('BEGIN');
      try {
        const out = [];
        for (const statement of statements) out.push(await statement.run());
        raw.exec('COMMIT');
        return out;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as D1Database;
}

const SNOWFLAKE = '123456789012345678';
const OTHER_SNOWFLAKE = '223456789012345678';
const XIVAUTH_UUID = 'a1b2c3d4-e5f6-4789-a1b2-c3d4e5f67890';
const MOD = '999999999999999999';

describe('ban-service on real SQLite', () => {
  let raw: DatabaseSync;
  let db: D1Database;

  const addPreset = (id: string, author: string, status: string, signature: string | null) =>
    raw
      .prepare(
        'INSERT INTO presets (id, name, author_discord_id, author_name, status, dye_signature) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, `Preset ${id}`, author, `Name of ${author}`, status, signature);
  const statusOf = (id: string) =>
    (raw.prepare('SELECT status FROM presets WHERE id = ?').get(id) as { status: string }).status;
  const banRows = () =>
    raw.prepare('SELECT * FROM banned_users ORDER BY banned_at, id').all() as Array<
      Record<string, string | null>
    >;
  const logActions = () =>
    (
      raw.prepare('SELECT action, preset_id FROM moderation_log ORDER BY rowid').all() as Array<{
        action: string;
        preset_id: string | null;
      }>
    ).map((r) => `${r.action}:${r.preset_id ?? '-'}`);

  beforeEach(() => {
    raw = new DatabaseSync(':memory:');
    raw.exec(SCHEMA);
    db = createSqliteD1(raw);
  });

  describe('FINDING-014: XIVAuth-only targets', () => {
    it('writes a UUID target to xivauth_id as well as discord_id', async () => {
      const result = await banUser(db, XIVAUTH_UUID, 'XivOnly', MOD, 'Spamming the gallery');

      expect(result.success).toBe(true);
      const [row] = banRows();
      expect(row.discord_id).toBe(XIVAUTH_UUID);
      expect(row.xivauth_id).toBe(XIVAUTH_UUID);
    });

    it('leaves xivauth_id NULL for a Discord snowflake', async () => {
      await banUser(db, SNOWFLAKE, 'Discordian', MOD, 'Spamming the gallery');

      const [row] = banRows();
      expect(row.discord_id).toBe(SNOWFLAKE);
      expect(row.xivauth_id).toBeNull();
    });

    it('a UUID-only ban blocks approval of that author\'s pending preset', async () => {
      addPreset('p-pending', XIVAUTH_UUID, 'pending', '[1,2]');
      addPreset('p-clean', OTHER_SNOWFLAKE, 'pending', '[3,4]');
      expect(await isPresetAuthorBanned(db, 'p-pending')).toBe(false);

      await banUser(db, XIVAUTH_UUID, 'XivOnly', MOD, 'Spamming the gallery');

      expect(await isPresetAuthorBanned(db, 'p-pending')).toBe(true);
      expect(await isPresetAuthorBanned(db, 'p-clean')).toBe(false);
    });

    it('matches a ban whose UUID sits only in xivauth_id', async () => {
      raw
        .prepare(
          'INSERT INTO banned_users (id, discord_id, xivauth_id, username, moderator_discord_id, reason) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run('b1', null, XIVAUTH_UUID, 'XivOnly', MOD, 'Spamming the gallery');
      addPreset('p1', XIVAUTH_UUID, 'pending', '[1,2]');

      expect(await isPresetAuthorBanned(db, 'p1')).toBe(true);
      expect(await isUserBannedByDiscordId(db, XIVAUTH_UUID)).toBe(true);
      expect((await getActiveBan(db, XIVAUTH_UUID))?.xivAuthId).toBe(XIVAUTH_UUID);
    });

    it('still matches a legacy row that carries the UUID in discord_id only', async () => {
      raw
        .prepare(
          'INSERT INTO banned_users (id, discord_id, xivauth_id, username, moderator_discord_id, reason) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run('b1', XIVAUTH_UUID, null, 'XivOnly', MOD, 'Spamming the gallery');
      addPreset('p1', XIVAUTH_UUID, 'pending', '[1,2]');

      expect(await isPresetAuthorBanned(db, 'p1')).toBe(true);
      expect(await isUserBannedByDiscordId(db, XIVAUTH_UUID)).toBe(true);
    });

    it('refuses a second active ban of the same UUID', async () => {
      await banUser(db, XIVAUTH_UUID, 'XivOnly', MOD, 'Spamming the gallery');

      const again = await banUser(db, XIVAUTH_UUID, 'XivOnly', MOD, 'Spamming the gallery');

      expect(again).toMatchObject({ success: false, error: 'User is already banned.' });
      expect(banRows()).toHaveLength(1);
    });

    it('keeps banned authors out of the ban picker, whichever column holds the id', async () => {
      addPreset('p1', XIVAUTH_UUID, 'approved', '[1,2]');
      addPreset('p2', OTHER_SNOWFLAKE, 'approved', '[3,4]');
      raw
        .prepare(
          'INSERT INTO banned_users (id, discord_id, xivauth_id, username, moderator_discord_id, reason) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run('b1', null, XIVAUTH_UUID, 'XivOnly', MOD, 'Spamming the gallery');

      const authors = await searchPresetAuthors(db, 'Name');

      expect(authors.map((a) => a.discordId)).toEqual([OTHER_SNOWFLAKE]);
    });

    it('lists an active ban by its xivauth_id in the unban picker', async () => {
      await banUser(db, XIVAUTH_UUID, 'XivOnly', MOD, 'Spamming the gallery');

      const byId = await searchBannedUsers(db, 'a1b2c3d4');
      const byName = await searchBannedUsers(db, 'XivOnly');

      expect(byId).toHaveLength(1);
      expect(byId[0].xivAuthId).toBe(XIVAUTH_UUID);
      expect(byName).toHaveLength(1);
    });

    it('unban by UUID closes a row written with both columns', async () => {
      addPreset('p1', XIVAUTH_UUID, 'approved', '[1,2]');
      await banUser(db, XIVAUTH_UUID, 'XivOnly', MOD, 'Spamming the gallery');
      expect(statusOf('p1')).toBe('hidden');

      const result = await unbanUser(db, XIVAUTH_UUID, MOD);

      expect(result).toMatchObject({ success: true, presetsRestored: 1, presetsStillHidden: 0 });
      expect(statusOf('p1')).toBe('approved');
      expect(await isUserBannedByDiscordId(db, XIVAUTH_UUID)).toBe(false);
    });

    it('unban by UUID closes a row that has the UUID in xivauth_id only', async () => {
      raw
        .prepare(
          'INSERT INTO banned_users (id, discord_id, xivauth_id, username, moderator_discord_id, reason) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run('b1', SNOWFLAKE, XIVAUTH_UUID, 'Linked', MOD, 'Spamming the gallery');

      const result = await unbanUser(db, XIVAUTH_UUID, MOD);

      expect(result.success).toBe(true);
      expect(banRows()[0].unbanned_at).not.toBeNull();
    });
  });

  describe('FINDING-005: unban blanks the username copy and the reason', () => {
    it('keeps both while the ban is active', async () => {
      await banUser(db, SNOWFLAKE, 'Discordian', MOD, 'Spamming the gallery');

      const [row] = banRows();
      expect(row.username).toBe('Discordian');
      expect(row.reason).toBe('Spamming the gallery');
      // ban search selects and sorts by username, so it must still find it
      expect((await searchBannedUsers(db, 'Discordian'))[0]?.username).toBe('Discordian');
    });

    it('blanks both in the statement that sets unbanned_at, keeping the NOT NULL columns satisfied', async () => {
      await banUser(db, SNOWFLAKE, 'Discordian', MOD, 'Spamming the gallery');

      const result = await unbanUser(db, SNOWFLAKE, MOD);

      expect(result.success).toBe(true);
      const [row] = banRows();
      expect(row.username).toBe('');
      expect(row.reason).toBe('');
      expect(row.unbanned_at).not.toBeNull();
      expect(row.unban_moderator_discord_id).toBe(MOD);
      // the row itself is not pruned — presets-api owns the retention rule
      expect(banRows()).toHaveLength(1);
    });

    it('blanks only the closed ban, never another user\'s active one', async () => {
      await banUser(db, SNOWFLAKE, 'Discordian', MOD, 'Spamming the gallery');
      await banUser(db, OTHER_SNOWFLAKE, 'Someone Else', MOD, 'Posting junk presets');

      await unbanUser(db, SNOWFLAKE, MOD);

      const rows = banRows();
      const other = rows.find((r) => r.discord_id === OTHER_SNOWFLAKE)!;
      expect(other.username).toBe('Someone Else');
      expect(other.reason).toBe('Posting junk presets');
    });

    it('lets the same user be banned again after an unban', async () => {
      await banUser(db, SNOWFLAKE, 'Discordian', MOD, 'Spamming the gallery');
      await unbanUser(db, SNOWFLAKE, MOD);

      const again = await banUser(db, SNOWFLAKE, 'Discordian', MOD, 'Spamming again, still');

      expect(again.success).toBe(true);
      expect(banRows()).toHaveLength(2);
    });
  });

  describe('FINDING-021: restore skips dye_signature collisions', () => {
    it('leaves a colliding preset hidden, restores the rest and reports the count', async () => {
      addPreset('mine-ok', SNOWFLAKE, 'approved', '[1,2]');
      addPreset('mine-clash', SNOWFLAKE, 'approved', '[3,4]');
      await banUser(db, SNOWFLAKE, 'Discordian', MOD, 'Spamming the gallery');
      // while banned, another user submits the same combination as `mine-clash`
      addPreset('theirs', OTHER_SNOWFLAKE, 'approved', '[3,4]');

      const result = await unbanUser(db, SNOWFLAKE, MOD);

      expect(result).toEqual({ success: true, presetsRestored: 1, presetsStillHidden: 1 });
      expect(statusOf('mine-ok')).toBe('approved');
      expect(statusOf('mine-clash')).toBe('hidden');
      expect(statusOf('theirs')).toBe('approved');
      // the ban is lifted regardless — one collision no longer aborts the unban
      expect(banRows()[0].unbanned_at).not.toBeNull();
    });

    it('treats a pending preset as a collision too', async () => {
      addPreset('mine', SNOWFLAKE, 'approved', '[5,6]');
      await banUser(db, SNOWFLAKE, 'Discordian', MOD, 'Spamming the gallery');
      addPreset('theirs', OTHER_SNOWFLAKE, 'pending', '[5,6]');

      const result = await unbanUser(db, SNOWFLAKE, MOD);

      expect(result).toEqual({ success: true, presetsRestored: 0, presetsStillHidden: 1 });
      expect(statusOf('mine')).toBe('hidden');
    });

    it('ignores a rejected or hidden preset with the same signature', async () => {
      addPreset('mine', SNOWFLAKE, 'approved', '[7,8]');
      await banUser(db, SNOWFLAKE, 'Discordian', MOD, 'Spamming the gallery');
      addPreset('rejected', OTHER_SNOWFLAKE, 'rejected', '[7,8]');
      addPreset('hidden', OTHER_SNOWFLAKE, 'hidden', '[7,8]');

      const result = await unbanUser(db, SNOWFLAKE, MOD);

      expect(result).toEqual({ success: true, presetsRestored: 1, presetsStillHidden: 0 });
      expect(statusOf('mine')).toBe('approved');
    });

    it('restores only one of the author\'s own hidden twins', async () => {
      addPreset('a-twin', SNOWFLAKE, 'hidden', '[9,10]');
      addPreset('b-twin', SNOWFLAKE, 'hidden', '[9,10]');
      raw
        .prepare(
          'INSERT INTO banned_users (id, discord_id, username, moderator_discord_id, reason) VALUES (?, ?, ?, ?, ?)'
        )
        .run('b1', SNOWFLAKE, 'Discordian', MOD, 'Spamming the gallery');

      const result = await unbanUser(db, SNOWFLAKE, MOD);

      expect(result).toEqual({ success: true, presetsRestored: 1, presetsStillHidden: 1 });
      expect(statusOf('a-twin')).toBe('approved');
      expect(statusOf('b-twin')).toBe('hidden');
    });

    it('restores presets that have no signature', async () => {
      addPreset('no-sig-1', SNOWFLAKE, 'hidden', null);
      addPreset('no-sig-2', SNOWFLAKE, 'hidden', null);
      raw
        .prepare(
          'INSERT INTO banned_users (id, discord_id, username, moderator_discord_id, reason) VALUES (?, ?, ?, ?, ?)'
        )
        .run('b1', SNOWFLAKE, 'Discordian', MOD, 'Spamming the gallery');

      const result = await unbanUser(db, SNOWFLAKE, MOD);

      expect(result).toEqual({ success: true, presetsRestored: 2, presetsStillHidden: 0 });
    });

    it('logs a restore row only for the presets that actually flipped', async () => {
      addPreset('mine-ok', SNOWFLAKE, 'approved', '[1,2]');
      addPreset('mine-clash', SNOWFLAKE, 'approved', '[3,4]');
      await banUser(db, SNOWFLAKE, 'Discordian', MOD, 'Spamming the gallery');
      addPreset('theirs', OTHER_SNOWFLAKE, 'approved', '[3,4]');

      await unbanUser(db, SNOWFLAKE, MOD);

      const log = logActions();
      expect(log).toContain('restore:mine-ok');
      expect(log).not.toContain('restore:mine-clash');
      expect(log).toContain('unban:-');
      expect(log.filter((l) => l.startsWith('hide:'))).toHaveLength(2);
    });
  });
});
