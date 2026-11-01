import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { SqliteD1 } from '../sqlite-d1.js';
import { pruneContinuityRecords } from '../../src/services/ban-continuity-retention.js';
import { pruneModerationRecords } from '../../src/services/moderation-retention-service.js';
import {
  applyContinuity,
  getContinuityOperation,
} from '../../src/services/ban-continuity-service.js';
import { continuityHash } from '../../src/services/ban-continuity-contract.js';
let db: SqliteD1;
const now = () => Math.floor(Date.now() / 1000);
beforeEach(() => {
  db = new SqliteD1(readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'));
  db.database.exec('PRAGMA foreign_keys=ON');
});
afterEach(() => db.close());
function receipt(
  id: string,
  state = 'applied',
  ack: number | null = now() - 90000,
  expiry = now() - 90000,
) {
  db.database
    .prepare('INSERT INTO ban_continuity_operations VALUES (?,?,?,?,?,?,?,?,?)')
    .run(
      id,
      'a'.repeat(64),
      state,
      state === 'refused' ? 'overflow' : null,
      state === 'refused' ? null : 0,
      expiry,
      state === 'applying' ? null : expiry,
      ack,
      ack === null ? null : state === 'refused' ? 'aborted' : 'complete',
    );
}
function review(id: string, expiry = now() - 1, outcome: string | null = null) {
  db.database
    .prepare(
      "INSERT INTO moderation_ban_confirmations VALUES (?, 'actor','ban','new','review','parent','{}',?, ?, ?, ?, ?)",
    )
    .run(id, 'a'.repeat(64), expiry - 900, expiry, outcome === null ? null : expiry - 1, outcome);
}
describe('bounded global continuity retention', () => {
  it('purges only matching acknowledged terminal receipts after max(expiry,ack)+24h', async () => {
    receipt('applied');
    receipt('refused', 'refused');
    receipt('unack', 'applied', null);
    receipt('applying', 'applying', null);
    receipt('late-ack', 'applied', now() - 100);
    receipt('late-expiry', 'applied', now() - 90000, now() - 100);
    const warn = vi.fn();
    expect(await pruneContinuityRecords(db as unknown as D1Database, { warn })).toBe(true);
    expect(
      db.database.prepare('SELECT id FROM ban_continuity_operations ORDER BY id').all(),
    ).toEqual([{ id: 'applying' }, { id: 'late-ack' }, { id: 'late-expiry' }, { id: 'unack' }]);
    expect(warn).toHaveBeenCalledWith('[continuity] pruned records', { pruned: 2 });
  });
  it('expires spent and unconsumed confirmations while preserving valid/applying rows', async () => {
    review('expired');
    review('spent', now() - 1, 'applied');
    review('valid', now() + 200);
    review('applying', now() - 1, 'applying');
    await pruneContinuityRecords(db as unknown as D1Database);
    expect(
      db.database.prepare('SELECT nonce FROM moderation_ban_confirmations ORDER BY nonce').all(),
    ).toEqual([{ nonce: 'applying' }, { nonce: 'valid' }]);
  });
  it('bounds each deletion table to 128 per sweep', async () => {
    for (let i = 0; i < 130; i++) {
      receipt(`receipt${i}`);
      review(`review${i}`);
    }
    await pruneContinuityRecords(db as unknown as D1Database);
    expect(
      db.database.prepare('SELECT COUNT(*) AS n FROM ban_continuity_operations').get(),
    ).toEqual({ n: 2 });
    expect(
      db.database.prepare('SELECT COUNT(*) AS n FROM moderation_ban_confirmations').get(),
    ).toEqual({ n: 2 });
  });
  it('never deletes active memberships; 90-day lifted parent purge cascades', async () => {
    const insert = db.database.prepare(
      "INSERT INTO banned_users(id,discord_id,username,reason,moderator_discord_id,unbanned_at) VALUES (?,?, 'private','private','123456789012345678',?)",
    );
    insert.run('active', '123456789012345678', null);
    insert.run('lifted', '223456789012345678', '2020-01-01T00:00:00.000Z');
    db.database.exec(
      "INSERT INTO ban_identity_memberships VALUES ('active','member1','continuity'),('lifted','member2','confirmed')",
    );
    await pruneContinuityRecords(db as unknown as D1Database);
    expect(db.database.prepare('SELECT COUNT(*) AS n FROM ban_identity_memberships').get()).toEqual(
      { n: 2 },
    );
    await pruneModerationRecords(db as unknown as D1Database);
    expect(db.database.prepare('SELECT ban_id FROM ban_identity_memberships').all()).toEqual([
      { ban_id: 'active' },
    ]);
  });
  it('cannot recreate a purged operation after its immutable expiry', async () => {
    const r = {
      v: 1 as const,
      operationId: crypto.randomUUID(),
      kind: 'detach' as const,
      sourceIds: ['10000000-0000-4000-8000-000000000001', '123456789012345678'],
      destinationIds: ['10000000-0000-4000-8000-000000000002'],
      createdAt: now() - 100000,
      expiresAt: now() - 99900,
    };
    const key = { operationId: r.operationId, payloadHash: await continuityHash(r) };
    receipt(r.operationId);
    db.database.prepare('UPDATE ban_continuity_operations SET payload_hash=?').run(key.payloadHash);
    await pruneContinuityRecords(db as unknown as D1Database);
    expect(await getContinuityOperation(db as unknown as D1Database, key)).toMatchObject({
      status: 'missing',
    });
    await expect(
      applyContinuity(db as unknown as D1Database, { ...r, payloadHash: key.payloadHash }),
    ).rejects.toMatchObject({ code: 'expired' });
  });
  it('reports a failed batch without exposing raw errors and rolls back the first deletion', async () => {
    receipt('old');
    review('expired');
    db.setBeforeStatement(({ sql }) => {
      if (sql.includes('DELETE FROM moderation_ban_confirmations'))
        throw new Error('private identifier');
    });
    const warn = vi.fn();
    expect(await pruneContinuityRecords(db as unknown as D1Database, { warn })).toBe(false);
    expect(
      db.database.prepare('SELECT COUNT(*) AS n FROM ban_continuity_operations').get(),
    ).toEqual({ n: 1 });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private identifier');
  });
});
