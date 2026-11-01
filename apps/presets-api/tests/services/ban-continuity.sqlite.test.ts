import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { SqliteD1 } from '../sqlite-d1.js';
import {
  applyContinuity,
  getContinuityOperation,
  acknowledgeContinuity,
} from '../../src/services/ban-continuity-service.js';
import {
  continuityHash,
  type ContinuityRequest,
} from '../../src/services/ban-continuity-contract.js';

const U = '10000000-0000-4000-8000-000000000001',
  N = '10000000-0000-4000-8000-000000000002';
const D = '123456789012345678';
let db: SqliteD1;
const request = async (kind: 'detach' | 'attach' = 'detach'): Promise<ContinuityRequest> => {
  const now = Math.floor(Date.now() / 1000);
  const r = {
    v: 1 as const,
    operationId: crypto.randomUUID(),
    kind,
    sourceIds: [U, D],
    destinationIds: kind === 'detach' ? [N] : [U, D],
    createdAt: now,
    expiresAt: now + 900,
  };
  return { ...r, payloadHash: await continuityHash(r) };
};
function ban(id: string, discord: string | null = D, uuid: string | null = null) {
  db.database
    .prepare(
      'INSERT INTO banned_users(id,discord_id,xivauth_id,moderator_discord_id,reason,username) VALUES (?,?,?,?,?,?)',
    )
    .run(id, discord, uuid, D, 'Private reason', 'Private name');
}
function members() {
  return db.database
    .prepare(
      'SELECT ban_id,identity_id,source FROM ban_identity_memberships ORDER BY ban_id,identity_id',
    )
    .all();
}
beforeEach(() => {
  db = new SqliteD1(readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'));
  db.database.exec('PRAGMA foreign_keys=ON');
});
afterEach(() => db.close());
describe('ban-specific continuity', () => {
  it('inherits only the existing particular D ban at DETACH and never adds retained U', async () => {
    ban('before');
    const result = await applyContinuity(db as unknown as D1Database, await request());
    expect(result).toMatchObject({ status: 'applied', matchedBanCount: 1 });
    expect(members()).toEqual([{ ban_id: 'before', identity_id: N, source: 'continuity' }]);
  });
  it('refuses ATTACH when any destination lacks confirmed coverage', async () => {
    ban('before');
    expect(
      await applyContinuity(db as unknown as D1Database, await request('attach')),
    ).toMatchObject({ status: 'refused', reason: 'review_required' });
    expect(members()).toEqual([]);
  });
  it('does not inherit future bans after a zero-ban handoff or reconsider applied replay', async () => {
    const r = await request();
    const answer = await applyContinuity(db as unknown as D1Database, r);
    ban('after');
    expect(await applyContinuity(db as unknown as D1Database, r)).toEqual(answer);
    expect(members()).toEqual([]);
  });
  it('matches a member-sourced ban and propagates only that parent', async () => {
    ban('linked', '223456789012345678');
    ban('unrelated', '323456789012345678');
    db.database
      .prepare("INSERT INTO ban_identity_memberships VALUES (?,?, 'confirmed')")
      .run('linked', U);
    expect(await applyContinuity(db as unknown as D1Database, await request())).toMatchObject({
      matchedBanCount: 1,
    });
    expect(members()).toEqual([
      { ban_id: 'linked', identity_id: U, source: 'confirmed' },
      { ban_id: 'linked', identity_id: N, source: 'continuity' },
    ]);
  });
  it('ignores lifted parent memberships', async () => {
    ban('lifted');
    db.database.exec("UPDATE banned_users SET unbanned_at=datetime('now')");
    expect(await applyContinuity(db as unknown as D1Database, await request())).toMatchObject({
      matchedBanCount: 0,
    });
    expect(members()).toEqual([]);
  });
  it('keeps a durable ATTACH refusal immutable after confirmed coverage and after unban', async () => {
    ban('partial');
    const r = await request('attach');
    const refused = await applyContinuity(db as unknown as D1Database, r);
    db.database
      .prepare("INSERT INTO ban_identity_memberships VALUES (?,?, 'confirmed')")
      .run('partial', U);
    expect(await applyContinuity(db as unknown as D1Database, r)).toEqual(refused);
    expect(
      await applyContinuity(db as unknown as D1Database, await request('attach')),
    ).toMatchObject({ status: 'applied', matchedBanCount: 1 });
    db.database.exec("UPDATE banned_users SET unbanned_at=datetime('now')");
    expect(await applyContinuity(db as unknown as D1Database, r)).toEqual(refused);
  });
  it('persists a 17-parent overflow without a membership write and never truncates', async () => {
    for (let n = 0; n < 17; n++) {
      ban(`ban${n}`, String(223456789012345678n + BigInt(n)));
      db.database
        .prepare("INSERT INTO ban_identity_memberships VALUES (?,?, 'confirmed')")
        .run(`ban${n}`, U);
    }
    const before = members(),
      r = await request();
    await expect(applyContinuity(db as unknown as D1Database, r)).resolves.toMatchObject({
      status: 'refused',
      reason: 'overflow',
    });
    expect(members()).toEqual(before);
    expect(
      db.database.prepare('SELECT matched_bans,state FROM ban_continuity_operations').get(),
    ).toEqual({ matched_bans: null, state: 'refused' });
    db.database.exec('DELETE FROM banned_users');
    expect(await applyContinuity(db as unknown as D1Database, r)).toMatchObject({
      status: 'refused',
      reason: 'overflow',
    });
  });
  it('persists a 65-ID overflow without any partial destination write', async () => {
    ban('full');
    for (let n = 0; n < 63; n++)
      db.database
        .prepare("INSERT INTO ban_identity_memberships VALUES (?,?, 'confirmed')")
        .run('full', `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
    const before = members();
    await expect(
      applyContinuity(db as unknown as D1Database, await request()),
    ).resolves.toMatchObject({ status: 'refused', reason: 'overflow' });
    expect(members()).toEqual(before);
  });
  it('permits exactly 16 matched parents and deduplicates an existing destination at the 64-ID cap', async () => {
    for (let n = 0; n < 16; n++) {
      ban(`ban${n}`, String(223456789012345678n + BigInt(n)));
      db.database
        .prepare("INSERT INTO ban_identity_memberships VALUES (?,?, 'confirmed')")
        .run(`ban${n}`, U);
    }
    expect(await applyContinuity(db as unknown as D1Database, await request())).toMatchObject({
      status: 'applied',
      matchedBanCount: 16,
    });
    const r = await request();
    expect(await applyContinuity(db as unknown as D1Database, r)).toMatchObject({
      status: 'applied',
      matchedBanCount: 16,
    });
    expect(members()).toHaveLength(32);
  });
  it('allows the already-covered destination at the 64 effective-ID boundary', async () => {
    ban('full');
    db.database
      .prepare("INSERT INTO ban_identity_memberships VALUES (?,?, 'confirmed')")
      .run('full', N);
    for (let n = 0; n < 62; n++)
      db.database
        .prepare("INSERT INTO ban_identity_memberships VALUES (?,?, 'confirmed')")
        .run('full', `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
    const before = members();
    expect(await applyContinuity(db as unknown as D1Database, await request())).toMatchObject({
      status: 'applied',
      matchedBanCount: 1,
    });
    expect(members()).toEqual(before);
  });
  it('snapshots a ban committed just before the transaction rather than trusting an earlier JS read', async () => {
    let inserted = false;
    db.setBeforeStatement(({ sql, database }) => {
      if (!inserted && sql.includes('INSERT INTO ban_continuity_operations')) {
        inserted = true;
        database
          .prepare(
            'INSERT INTO banned_users(id,discord_id,username,reason,moderator_discord_id) VALUES (?,?,?,?,?)',
          )
          .run('raced', D, 'private', 'private', D);
      }
    });
    expect(await applyContinuity(db as unknown as D1Database, await request())).toMatchObject({
      status: 'applied',
      matchedBanCount: 1,
    });
    expect(members()).toEqual([{ ban_id: 'raced', identity_id: N, source: 'continuity' }]);
  });
  it('enforces expiry at SQL execution even if the preflight started earlier', async () => {
    ban('before');
    const r = await request();
    r.createdAt -= 899;
    r.expiresAt = r.createdAt + 900;
    r.payloadHash = await continuityHash(r);
    let injected = false;
    db.setBeforeStatement(async ({ sql }) => {
      if (!injected && sql.includes('INSERT INTO ban_continuity_operations')) {
        injected = true;
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    });
    await expect(applyContinuity(db as unknown as D1Database, r)).rejects.toMatchObject({
      code: 'expired',
    });
    expect(members()).toEqual([]);
    expect(db.database.prepare('SELECT * FROM ban_continuity_operations').all()).toEqual([]);
  });
  it('refuses future creation inside SQL and does not create a receipt', async () => {
    const r = await request();
    r.createdAt += 90;
    r.expiresAt += 90;
    r.payloadHash = await continuityHash(r);
    await expect(applyContinuity(db as unknown as D1Database, r)).rejects.toMatchObject({
      code: 'malformed',
    });
    expect(db.database.prepare('SELECT * FROM ban_continuity_operations').all()).toEqual([]);
  });
  it('recovers a lost response from durable receipt; changed hash conflicts without a write', async () => {
    ban('before');
    const r = await request();
    const applied = await applyContinuity(db as unknown as D1Database, r);
    expect(
      await getContinuityOperation(db as unknown as D1Database, {
        operationId: r.operationId,
        payloadHash: r.payloadHash,
      }),
    ).toEqual(applied);
    const other = { ...r, expiresAt: r.expiresAt - 1 };
    other.payloadHash = await continuityHash(other);
    await expect(applyContinuity(db as unknown as D1Database, other)).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(
      getContinuityOperation(db as unknown as D1Database, {
        operationId: r.operationId,
        payloadHash: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(members()).toHaveLength(1);
  });
  it('returns expired same-hash terminal receipts and distinguishes missing from database failure', async () => {
    const r = await request();
    const applied = await applyContinuity(db as unknown as D1Database, r);
    db.database.prepare('UPDATE ban_continuity_operations SET expires_at=0').run();
    expect(await applyContinuity(db as unknown as D1Database, r)).toEqual(applied);
    expect(
      await getContinuityOperation(db as unknown as D1Database, {
        operationId: crypto.randomUUID(),
        payloadHash: r.payloadHash,
      }),
    ).toMatchObject({ status: 'missing' });
    db.setBeforeStatement(() => {
      throw new Error('private SQL error');
    });
    await expect(
      getContinuityOperation(db as unknown as D1Database, {
        operationId: r.operationId,
        payloadHash: r.payloadHash,
      }),
    ).rejects.toMatchObject({ code: 'unavailable', message: 'Continuity service unavailable' });
  });
  it('rolls back the journal and all earlier memberships when any dependent write fails', async () => {
    ban('before');
    db.setBeforeStatement(({ sql }) => {
      if (sql.includes("SET state='applied'")) throw new Error('private SQL failure');
    });
    await expect(
      applyContinuity(db as unknown as D1Database, await request()),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(members()).toEqual([]);
    expect(db.database.prepare('SELECT * FROM ban_continuity_operations').all()).toEqual([]);
  });
  it('acknowledges only the matching state/hash/outcome and preserves the first timestamp', async () => {
    const r = await request();
    await applyContinuity(db as unknown as D1Database, r);
    const key = { operationId: r.operationId, payloadHash: r.payloadHash };
    await expect(
      acknowledgeContinuity(db as unknown as D1Database, { ...key, outcome: 'aborted' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    const first = await acknowledgeContinuity(db as unknown as D1Database, {
      ...key,
      outcome: 'complete',
    });
    expect(first).toMatchObject({
      status: 'acknowledged',
      outcome: 'complete',
      acknowledgedAt: expect.any(Number),
    });
    db.database.exec('UPDATE ban_continuity_operations SET acknowledged_at=acknowledged_at-10');
    expect(
      await acknowledgeContinuity(db as unknown as D1Database, { ...key, outcome: 'complete' }),
    ).toMatchObject({ acknowledgedAt: (first as { acknowledgedAt: number }).acknowledgedAt - 10 });
    await expect(
      acknowledgeContinuity(db as unknown as D1Database, {
        ...key,
        payloadHash: 'a'.repeat(64),
        outcome: 'complete',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(
      await acknowledgeContinuity(db as unknown as D1Database, {
        ...key,
        operationId: crypto.randomUUID(),
        outcome: 'complete',
      }),
    ).toMatchObject({ status: 'missing' });
  });
  it('acknowledges a refused receipt only as aborted', async () => {
    ban('partial');
    const r = await request('attach');
    await applyContinuity(db as unknown as D1Database, r);
    const key = { operationId: r.operationId, payloadHash: r.payloadHash };
    await expect(
      acknowledgeContinuity(db as unknown as D1Database, { ...key, outcome: 'complete' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(
      await acknowledgeContinuity(db as unknown as D1Database, { ...key, outcome: 'aborted' }),
    ).toMatchObject({ status: 'acknowledged', outcome: 'aborted' });
  });
});
