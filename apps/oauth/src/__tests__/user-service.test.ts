import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findOrCreateUser } from '../services/user-service.js';
import { createSQLiteD1 } from './mocks/sqlite-d1.js';
import type { UserRow } from '../types.js';
const U = '10000000-0000-4000-8000-000000000001';
const X = '20000000-0000-4000-8000-000000000001';
const D = '123456789012345678';
let fixture: ReturnType<typeof createSQLiteD1>;
beforeEach(() => {
  fixture = createSQLiteD1();
});
afterEach(() => {
  fixture.close();
  vi.restoreAllMocks();
});
const discord = { discord_id: D, username: 'Display name', auth_provider: 'discord' as const };
const xiv = {
  xivauth_id: X,
  discord_id: null,
  username: 'Character name',
  auth_provider: 'xivauth' as const,
};

describe('provider account creation and profile updates with actual SQLite', () => {
  it.each([discord, xiv, { ...xiv, discord_id: D }])(
    'creates a new account with exactly its asserted provider identities %#',
    async (params) => {
      const row = await findOrCreateUser(fixture.db, params);
      expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(row).toMatchObject({
        discord_id: params.discord_id ?? null,
        xivauth_id: 'xivauth_id' in params ? params.xivauth_id : null,
        username: params.username,
        auth_provider: params.auth_provider,
        identity_revision: 0,
      });
      expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(
        await fixture.db.prepare('SELECT * FROM users WHERE id=?').bind(row.id).first(),
      ).toEqual(row);
    },
  );
  it('updates a matching profile/name and last-used provider without changing identity revision', async () => {
    fixture.seed({ id: U, discord_id: D, xivauth_id: X, username: 'Old', identity_revision: 7 });
    const first = await findOrCreateUser(fixture.db, { ...xiv, discord_id: D });
    expect(first).toMatchObject({
      id: U,
      username: 'Character name',
      auth_provider: 'xivauth',
      identity_revision: 7,
    });
    const second = await findOrCreateUser(fixture.db, discord);
    expect(second).toMatchObject({
      id: U,
      discord_id: D,
      xivauth_id: X,
      username: 'Display name',
      auth_provider: 'discord',
      identity_revision: 7,
    });
    expect(fixture.sqlite.prepare('SELECT * FROM identity_operations').all()).toEqual([]);
  });
  it.each([
    { ...xiv, discord_id: D },
    { ...discord, xivauth_id: X },
  ])(
    'does not silently perform an existing relationship change while inactive %#',
    async (params) => {
      fixture.seed({ id: U, xivauth_id: X, auth_provider: 'xivauth' });
      if (params.auth_provider === 'discord') {
        const row = await findOrCreateUser(fixture.db, params);
        expect(row.id).not.toBe(U);
        expect(row.xivauth_id).toBeNull();
      } else
        await expect(findOrCreateUser(fixture.db, params)).rejects.toMatchObject({
          code: 'unavailable',
        });
    },
  );
  it('inactive attaching XIVAuth to an existing Discord-only row is refused', async () => {
    fixture.seed({ id: U, discord_id: D });
    await expect(findOrCreateUser(fixture.db, { ...xiv, discord_id: D })).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(
      fixture.sqlite.prepare('SELECT xivauth_id,identity_revision FROM users WHERE id=?').get(U),
    ).toEqual({ xivauth_id: null, identity_revision: 0 });
  });
  it.each([
    { username: 'Invalid', auth_provider: 'discord' as const },
    { username: 'Invalid', auth_provider: 'xivauth' as const },
  ])('requires the authenticated provider ID %#', async (params) => {
    await expect(findOrCreateUser(fixture.db, params)).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
  it('a database failure is generic and never leaks IDs or raw SQL', async () => {
    const db = {
      prepare: () => {
        throw new Error(`secret sql ${D}`);
      },
    } as unknown as D1Database;
    await expect(findOrCreateUser(db, discord)).rejects.toMatchObject({
      code: 'unavailable',
      message: 'Identity service temporarily unavailable',
    });
  });
  it('a new account cannot claim any locked provider resource', async () => {
    fixture.sqlite
      .prepare(
        "INSERT INTO identity_operations (id,payload_json,payload_hash,state,created_at,expires_at) VALUES (?,'{}',?,'pending',1,2)",
      )
      .run(U, 'a'.repeat(64));
    fixture.sqlite
      .prepare('INSERT INTO identity_operation_locks (resource_key,operation_id) VALUES (?,?)')
      .run(`xivauth:${X}`, U);
    await expect(findOrCreateUser(fixture.db, xiv)).rejects.toMatchObject({ code: 'unavailable' });
    expect(fixture.sqlite.prepare('SELECT * FROM users').all()).toEqual([]);
  });
  it('profile SQL CAS protects against a revision race after lookup', async () => {
    fixture.seed({ id: U, discord_id: D, identity_revision: 0 });
    const original = fixture.db.prepare.bind(fixture.db);
    vi.spyOn(fixture.db, 'prepare').mockImplementation((sql) => {
      if (sql.startsWith('UPDATE users SET username='))
        fixture.sqlite.prepare('UPDATE users SET identity_revision=2 WHERE id=?').run(U);
      return original(sql);
    });
    await expect(findOrCreateUser(fixture.db, discord)).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(
      fixture.sqlite.prepare('SELECT username,identity_revision FROM users WHERE id=?').get(U),
    ).toEqual({ username: 'Stored name', identity_revision: 2 });
  });
  it('profile SQL lock guard protects against a lock appearing after lookup', async () => {
    fixture.seed({ id: U, discord_id: D });
    fixture.sqlite
      .prepare(
        "INSERT INTO identity_operations (id,payload_json,payload_hash,state,created_at,expires_at) VALUES (?,'{}',?,'pending',1,2)",
      )
      .run(U, 'a'.repeat(64));
    const original = fixture.db.prepare.bind(fixture.db);
    vi.spyOn(fixture.db, 'prepare').mockImplementation((sql) => {
      if (sql.startsWith('UPDATE users SET username='))
        fixture.sqlite
          .prepare('INSERT INTO identity_operation_locks (resource_key,operation_id) VALUES (?,?)')
          .run(`discord:${D}`, U);
      return original(sql);
    });
    await expect(findOrCreateUser(fixture.db, discord)).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(fixture.sqlite.prepare('SELECT username FROM users WHERE id=?').get(U)).toEqual({
      username: 'Stored name',
    });
  });
  it('concurrent matching account creation returns the winner without rewriting associations', async () => {
    const original = fixture.db.prepare.bind(fixture.db);
    let current: typeof discord | typeof xiv = discord;
    vi.spyOn(fixture.db, 'prepare').mockImplementation((sql) => {
      if (sql.startsWith('INSERT INTO users'))
        fixture.seed({ id: U, discord_id: current.discord_id, xivauth_id: 'xivauth_id' in current ? current.xivauth_id : null, auth_provider:current.auth_provider, username: 'Winner' });
      return original(sql);
    });
    for(const params of [discord,xiv]) {
      current=params;
      fixture.sqlite.exec('DELETE FROM users');
      expect(await findOrCreateUser(fixture.db, params)).toMatchObject({id:U,discord_id:params.discord_id,username:'Winner'});
      expect(fixture.sqlite.prepare('SELECT * FROM users').all()).toHaveLength(1);
    }
  });
  it('a concurrent different provider relationship cannot be silently accepted as the insert winner', async () => {
    const original = fixture.db.prepare.bind(fixture.db);
    vi.spyOn(fixture.db, 'prepare').mockImplementation((sql) => {
      if (sql.startsWith('INSERT INTO users'))
        fixture.seed({ id: U, discord_id: D, xivauth_id: X, username: 'Winner' });
      return original(sql);
    });
    await expect(findOrCreateUser(fixture.db, discord)).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(
      await fixture.db.prepare('SELECT * FROM users WHERE id=?').bind(U).first<UserRow>(),
    ).toMatchObject({ username: 'Winner', xivauth_id: X });
  });
});
