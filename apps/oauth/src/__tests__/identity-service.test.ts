import { afterEach, beforeEach, expect, it } from 'vitest';
import { createSQLiteD1 } from './mocks/sqlite-d1.js';
import { createJWTForUser, verifyJWT } from '../services/jwt-service.js';
import { env } from './mocks/cloudflare-test.js';
import type { UserRow } from '../types.js';
import { lookupStoredIdentity, validateSession } from '../services/identity-service.js';

let fixture: ReturnType<typeof createSQLiteD1>;
const U = '10000000-0000-4000-8000-000000000001';
const D = '123456789012345678';
beforeEach(() => {
  fixture = createSQLiteD1();
  fixture.seed({ id: U, discord_id: D, identity_revision: 3 });
});
afterEach(() => fixture.close());
it('mints the current identity revision', async () => {
  const row = await fixture.db.prepare('SELECT * FROM users WHERE id=?').bind(U).first<UserRow>();
  const { token } = await createJWTForUser(row!, { ...env, DB: fixture.db });
  expect((await verifyJWT(token, env.JWT_SECRET)).identity_revision).toBe(3);
});
it('cannot mint from an obsolete row snapshot', async () => {
  const row = await fixture.db.prepare('SELECT * FROM users WHERE id=?').bind(U).first<UserRow>();
  fixture.sqlite.prepare('UPDATE users SET identity_revision=4 WHERE id=?').run(U);
  await expect(createJWTForUser(row!, { ...env, DB: fixture.db })).rejects.toMatchObject({
    code: 'unavailable',
  });
});
it('returns stored identity without profile, roster or upstream XIVAuth identifiers', async () => {
  fixture.sqlite
    .prepare('UPDATE users SET xivauth_id=?,auth_provider=? WHERE id=?')
    .run('private-upstream', 'xivauth', U);
  for (const input of [
    { kind: 'internal', id: U },
    { kind: 'discord', id: D },
  ]) {
    expect(await lookupStoredIdentity(fixture.db, input)).toEqual({
      version: 1,
      status: 'found',
      internalId: U,
      discordId: D,
      identityRevision: 3,
    });
  }
  expect(
    await validateSession(fixture.db, {
      sub: U,
      identityRevision: 3,
      authProvider: 'discord',
      discordId: D,
    }),
  ).toEqual({ version: 1, status: 'valid' });
  expect(
    await validateSession(fixture.db, {
      sub: U,
      identityRevision: 3,
      authProvider: 'xivauth',
      discordId: D,
    }),
  ).toEqual({ version: 1, status: 'valid' });
});
it.each([
  null,
  [],
  {},
  true,
  { kind: 'internal', id: D },
  { kind: 'discord', id: U },
  { kind: 'internal', id: U, extra: true },
  { kind: 'other', id: U },
  { kind: 'discord', id: '0'.repeat(18) },
  { kind: 'discord', id: '99999999999999999999' },
])('rejects malformed lookup DTO %# before touching the DB', async (input) => {
  fixture.statements.length = 0;
  await expect(lookupStoredIdentity(fixture.db, input)).rejects.toMatchObject({
    code: 'malformed',
  });
  expect(fixture.statements).toEqual([]);
});
it('distinguishes missing rows, pending resources and database failure', async () => {
  expect(
    await lookupStoredIdentity(fixture.db, {
      kind: 'internal',
      id: '10000000-0000-4000-8000-000000000002',
    }),
  ).toEqual({ version: 1, status: 'missing' });
  fixture.sqlite
    .prepare(
      "INSERT INTO identity_operations (id,payload_json,payload_hash,state,created_at,expires_at) VALUES (?,'{}',?,'pending',1,2)",
    )
    .run(U, 'a'.repeat(64));
  fixture.sqlite
    .prepare('INSERT INTO identity_operation_locks (resource_key,operation_id) VALUES (?,?)')
    .run(`discord:${D}`, U);
  expect(await lookupStoredIdentity(fixture.db, { kind: 'internal', id: U })).toEqual({
    version: 1,
    status: 'pending',
  });
  expect(await lookupStoredIdentity(fixture.db, { kind: 'discord', id: D })).toEqual({
    version: 1,
    status: 'pending',
  });
  const failure = {
    prepare: () => {
      throw new Error('private SQL details');
    },
  } as unknown as D1Database;
  await expect(lookupStoredIdentity(failure, { kind: 'internal', id: U })).rejects.toMatchObject({
    code: 'unavailable',
  });
  await expect(
    validateSession(failure, { sub: U, authProvider: 'discord', discordId: D }),
  ).rejects.toMatchObject({ code: 'unavailable' });
});
it.each([
  null,
  [],
  {},
  { sub: U, authProvider: 'other' },
  { sub: U, authProvider: 'discord', identityRevision: '3' },
  { sub: U, authProvider: 'discord', identityRevision: null },
  { sub: U, authProvider: 'discord', identityRevision: -1 },
  { sub: U, authProvider: 'discord', identityRevision: 1.5 },
  { sub: U, authProvider: 'discord', discordId: 3 },
  { sub: U, authProvider: 'discord', extra: true },
])('denies malformed session claims %#', async (input) => {
  expect(await validateSession(fixture.db, input)).toEqual({ version: 1, status: 'stale' });
});
it('legacy zero revision is accepted only for a current zero-revision matching provider', async () => {
  const claim = { sub: U, authProvider: 'discord', discordId: D };
  expect(await validateSession(fixture.db, claim)).toEqual({ version: 1, status: 'stale' });
  fixture.sqlite.prepare('UPDATE users SET identity_revision=0 WHERE id=?').run(U);
  expect(await validateSession(fixture.db, claim)).toEqual({ version: 1, status: 'valid' });
  expect(await validateSession(fixture.db, { ...claim, authProvider: 'xivauth' })).toEqual({
    version: 1,
    status: 'stale',
  });
  expect(await validateSession(fixture.db, { ...claim, discordId: null })).toEqual({
    version: 1,
    status: 'stale',
  });
  expect(await validateSession(fixture.db, { ...claim, discordId: '223456789012345678' })).toEqual({
    version: 1,
    status: 'stale',
  });
  expect(await validateSession(fixture.db, { ...claim, sub: 'missing' })).toEqual({
    version: 1,
    status: 'missing',
  });
});
it('missing identity revision defaults to zero at mint and a missing current row cannot mint', async () => {
  fixture.sqlite.prepare('UPDATE users SET identity_revision=0 WHERE id=?').run(U);
  const row = (await fixture.db
    .prepare('SELECT * FROM users WHERE id=?')
    .bind(U)
    .first<UserRow>())!;
  delete row.identity_revision;
  const minted = await createJWTForUser(row, { ...env, DB: fixture.db });
  expect((await verifyJWT(minted.token, env.JWT_SECRET)).identity_revision).toBe(0);
  fixture.sqlite.prepare('DELETE FROM users WHERE id=?').run(U);
  await expect(createJWTForUser(row, { ...env, DB: fixture.db })).rejects.toMatchObject({
    code: 'unavailable',
  });
});
