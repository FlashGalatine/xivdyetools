import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSQLiteD1 } from './mocks/sqlite-d1.js';
import { findOrCreateUser } from '../services/user-service.js';
import {
  validateContinuityRequest,
  type ContinuityRequest,
  type BanContinuity,
} from '../services/identity-contract.js';
import { cleanupIdentityOperations } from '../services/identity-transition-service.js';
import { lookupStoredIdentity, validateSession } from '../services/identity-service.js';
import type { UserRow } from '../types.js';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';

const U = '10000000-0000-4000-8000-000000000001';
const X = '20000000-0000-4000-8000-000000000001';
const X2 = '20000000-0000-4000-8000-000000000002';
const D = '123456789012345678';
const D2 = '223456789012345678';

function remoteFixture() {
  const receipts = new Map<string, Record<string, unknown>>();
  const calls: ContinuityRequest[] = [];
  const acks: { operationId: string; payloadHash: string; outcome: 'complete' | 'aborted' }[] = [];
  const acknowledged = new Map<string, number>();
  const control = {
    unavailable: false,
    loseApply: false,
    loseAck: false,
    refuse: '' as '' | 'review_required' | 'overflow',
    afterApply: undefined as (() => void) | undefined,
  };
  const remote: BanContinuity = {
    apply: async (request) => {
      await validateContinuityRequest(request, Math.floor(Date.now() / 1000));
      if (control.unavailable) throw new Error('transport unavailable');
      calls.push(structuredClone(request));
      const existing = receipts.get(request.operationId);
      if (existing && existing.payloadHash !== request.payloadHash)
        return {
          v: 1,
          operationId: request.operationId,
          payloadHash: request.payloadHash,
          status: 'conflict',
        };
      const result = existing ?? {
        v: 1,
        operationId: request.operationId,
        payloadHash: request.payloadHash,
        ...(control.refuse
          ? { status: 'refused', reason: control.refuse }
          : { status: 'applied', matchedBanCount: 2 }),
      };
      receipts.set(request.operationId, result);
      control.afterApply?.();
      if (control.loseApply) throw new Error('response lost after commit');
      return result;
    },
    getOperation: async (request) => {
      if (control.unavailable) throw new Error('transport unavailable');
      return receipts.get(request.operationId) ?? { v: 1, ...request, status: 'missing' };
    },
    acknowledge: async (request) => {
      acks.push(request);
      if (control.loseAck) throw new Error('ack response lost');
      const acknowledgedAt = acknowledged.get(request.operationId) ?? Math.floor(Date.now() / 1000);
      acknowledged.set(request.operationId, acknowledgedAt);
      return { v: 1, ...request, status: 'acknowledged', acknowledgedAt };
    },
  };
  return { remote, control, receipts, calls, acks };
}

describe('identity transitions with real transactional SQLite', () => {
  let fixture: ReturnType<typeof createSQLiteD1>;
  beforeEach(() => {
    fixture = createSQLiteD1();
  });
  afterEach(() => {
    fixture.close();
    vi.useRealTimers();
  });
  const params = (discord_id: string | null = null, xivauth_id = X) => ({
    xivauth_id,
    discord_id,
    username: 'Incoming',
    auth_provider: 'xivauth' as const,
  });
  const rows = () =>
    fixture.sqlite.prepare('SELECT * FROM users ORDER BY id').all() as unknown as UserRow[];
  const journal = () => fixture.sqlite.prepare('SELECT * FROM identity_operations').all();

  it.each([null, D2])(
    'inactive stale assertion %s cannot retain Discord authority',
    async (discord_id) => {
      fixture.seed({ id: U, discord_id: D, xivauth_id: X });
      await expect(
        findOrCreateUser(fixture.db, {
          xivauth_id: X,
          discord_id,
          username: 'Incoming',
          auth_provider: 'xivauth',
        }),
      ).rejects.toMatchObject({ code: 'unavailable' });
      expect(
        fixture.sqlite.prepare('SELECT discord_id,xivauth_id FROM users WHERE id=?').get(U),
      ).toEqual({ discord_id: D, xivauth_id: X });
    },
  );

  it('inactive replacement does not erase the displaced XIVAuth identity', async () => {
    fixture.seed({ id: U, discord_id: D, xivauth_id: X });
    await expect(
      findOrCreateUser(fixture.db, {
        xivauth_id: X2,
        discord_id: D,
        username: 'Different person',
        auth_provider: 'xivauth',
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(fixture.sqlite.prepare('SELECT xivauth_id FROM users WHERE id=?').get(U)).toEqual({
      xivauth_id: X,
    });
  });

  it.each(['false', 'TRUE', ' true', '1', undefined])(
    'only exact true can prepare a transition: %s',
    async (flag) => {
      const remote = remoteFixture();
      fixture.seed({ id: U, discord_id: D, xivauth_id: X });
      await expect(
        findOrCreateUser(fixture.db, params(), undefined, {
          IDENTITY_SPLIT_ENABLED: flag,
          BAN_CONTINUITY: remote.remote,
        }),
      ).rejects.toMatchObject({ code: 'unavailable' });
      expect(journal()).toEqual([]);
      expect(rows()[0]!.identity_revision).toBe(0);
    },
  );

  it.each([null, D2])(
    'enabled DETACH preserves the Discord anchor and exact one-way edge for %s',
    async (discord) => {
      const remote = remoteFixture();
      const config = { IDENTITY_SPLIT_ENABLED: 'true', BAN_CONTINUITY: remote.remote };
      fixture.seed({ id: U, discord_id: D, xivauth_id: X, username: 'Original name' });
      let user: UserRow | undefined;
      if (discord)
        await expect(
          findOrCreateUser(fixture.db, params(discord), undefined, config),
        ).rejects.toMatchObject({ code: 'retry' });
      else user = await findOrCreateUser(fixture.db, params(), undefined, config);
      const original = rows().find((row) => row.id === U)!;
      const fresh = rows().find((row) => row.id !== U)!;
      expect(original).toMatchObject({
        discord_id: D,
        xivauth_id: null,
        username: 'Original name',
        identity_revision: 2,
      });
      expect(fresh).toMatchObject({
        discord_id: null,
        xivauth_id: X,
        username: discord ? 'Original name' : 'Incoming',
        identity_revision: 1,
      });
      if (user) expect(user.id).toBe(fresh.id);
      expect(remote.calls).toHaveLength(1);
      expect(remote.calls[0]).toMatchObject({
        kind: 'detach',
        sourceIds: [U, D].sort(),
        destinationIds: [fresh.id],
      });
      expect(remote.calls[0]!.destinationIds).not.toContain(U);
      expect(JSON.stringify(journal())).not.toContain('Original name');
      expect(journal()[0]).toMatchObject({
        state: 'complete',
        resolution: 'applied',
        acknowledged_at: expect.any(Number),
      });
      expect(remote.acks[0]!.outcome).toBe('complete');
    },
  );

  it('occupied local Discord identity never merges, even while enabled', async () => {
    fixture.seed({ id: U, xivauth_id: X, auth_provider: 'xivauth' });
    fixture.seed({ id: X2, discord_id: D });
    await expect(
      findOrCreateUser(fixture.db, params(D), undefined, {
        IDENTITY_SPLIT_ENABLED: 'true',
        BAN_CONTINUITY: remoteFixture().remote,
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(rows()).toHaveLength(2);
    expect(journal()).toEqual([]);
    expect(rows().find((row) => row.id === U)!.discord_id).toBeNull();
  });

  it('preserves displaced old X and its name before requiring a fresh attach sign-in', async () => {
    const remote = remoteFixture();
    const config = { IDENTITY_SPLIT_ENABLED: 'true', BAN_CONTINUITY: remote.remote };
    fixture.seed({ id: U, discord_id: D, xivauth_id: X, username: 'Displaced name' });
    await expect(
      findOrCreateUser(fixture.db, params(D, X2), undefined, config),
    ).rejects.toMatchObject({ code: 'retry' });
    expect(rows().find((row) => row.xivauth_id === X)).toMatchObject({
      discord_id: null,
      username: 'Displaced name',
    });
    const attached = await findOrCreateUser(fixture.db, params(D, X2), undefined, config);
    expect(attached).toMatchObject({ id: U, discord_id: D, xivauth_id: X2 });
    expect(remote.calls.map((call) => call.kind)).toEqual(['detach', 'attach']);
  });

  it('locks all affected identifiers and blocks both provider sessions including reserved destination', async () => {
    const remote = remoteFixture();
    remote.control.unavailable = true;
    fixture.seed({ id: U, discord_id: D, xivauth_id: X });
    await expect(
      findOrCreateUser(fixture.db, params(), undefined, {
        IDENTITY_SPLIT_ENABLED: 'true',
        BAN_CONTINUITY: remote.remote,
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    const payload = JSON.parse(journal()[0]!.payload_json as string);
    expect(
      fixture.sqlite
        .prepare('SELECT resource_key FROM identity_operation_locks')
        .all()
        .map((row) => row.resource_key)
        .sort(),
    ).toEqual(
      [`user:${U}`, `discord:${D}`, `xivauth:${X}`, `user:${payload.destinationId}`].sort(),
    );
    for (const authProvider of ['discord', 'xivauth'])
      expect(
        await validateSession(fixture.db, {
          sub: U,
          identityRevision: 1,
          authProvider,
          discordId: D,
        }),
      ).toEqual({ version: 1, status: 'pending' });
    expect(
      await lookupStoredIdentity(fixture.db, { kind: 'internal', id: payload.destinationId }),
    ).toEqual({ version: 1, status: 'pending' });
    await expect(
      findOrCreateUser(fixture.db, { discord_id: D, username: 'D', auth_provider: 'discord' }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('restart after lost remote commit response retries the same immutable operation and never reapplies', async () => {
    const remote = remoteFixture();
    remote.control.loseApply = true;
    const config = { IDENTITY_SPLIT_ENABLED: 'true', BAN_CONTINUITY: remote.remote };
    fixture.seed({ id: U, discord_id: D, xivauth_id: X });
    await expect(findOrCreateUser(fixture.db, params(), undefined, config)).rejects.toMatchObject({
      code: 'unavailable',
    });
    const before = journal()[0]!;
    remote.control.loseApply = false;
    const resolved = await findOrCreateUser(fixture.db, params(), undefined, config);
    expect(resolved).toMatchObject({ discord_id: null, xivauth_id: X });
    expect(remote.calls).toHaveLength(1);
    expect(journal()[0]).toMatchObject({
      id: before.id,
      payload_hash: before.payload_hash,
      payload_json: before.payload_json,
      state: 'complete',
    });
  });
  it('recovers a pending operation after closing and reopening the actual SQLite database', async()=>{
    // A clean checkout has no ignored scratch directories; this fixture owns its storage.
    const directory = mkdtempSync(join(tmpdir(), 'xivdyetools-oauth-restart-'));
    const filename = join(directory, 'identity.sqlite');
    let disk=createSQLiteD1(undefined,undefined,{filename});
    const remote=remoteFixture();remote.control.loseApply=true;
    const config={IDENTITY_SPLIT_ENABLED:'true',BAN_CONTINUITY:remote.remote};
    try {
      disk.seed({id:U,discord_id:D,xivauth_id:X});
      await expect(findOrCreateUser(disk.db,params(),undefined,config)).rejects.toThrow();
      const prior=disk.sqlite.prepare('SELECT * FROM identity_operations').get()!;
      disk.close();disk=createSQLiteD1(undefined,undefined,{filename,existing:true});
      remote.control.loseApply=false;
      expect(await findOrCreateUser(disk.db,params(),undefined,config)).toMatchObject({discord_id:null,xivauth_id:X});
      expect(disk.sqlite.prepare('SELECT * FROM identity_operations').get()).toMatchObject({id:prior.id,payload_hash:prior.payload_hash,payload_json:prior.payload_json,state:'complete'});
      expect(remote.calls).toHaveLength(1);
    } finally {disk.close();unlinkSync(filename);rmdirSync(directory);}
  });

  it('prepare CAS loss rolls back operation, locks and revision changes', async () => {
    fixture.seed({ id: U, discord_id: D, xivauth_id: X });
    fixture.beforeBatch(() =>
      fixture.sqlite.prepare('UPDATE users SET identity_revision=4 WHERE id=?').run(U),
    );
    await expect(
      findOrCreateUser(fixture.db, params(), undefined, {
        IDENTITY_SPLIT_ENABLED: 'true',
        BAN_CONTINUITY: remoteFixture().remote,
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(journal()).toEqual([]);
    expect(rows()[0]).toMatchObject({ discord_id: D, xivauth_id: X, identity_revision: 4 });
    expect(fixture.sqlite.prepare('SELECT * FROM identity_operation_locks').all()).toEqual([]);
  });

  it('commit CAS loss retains the applied journal and locks without changing associations', async () => {
    const remote = remoteFixture();
    remote.control.afterApply = () =>
      fixture.beforeBatch(() =>
        fixture.sqlite
          .prepare('UPDATE users SET identity_revision=identity_revision+1 WHERE id=?')
          .run(U),
      );
    fixture.seed({ id: U, discord_id: D, xivauth_id: X });
    await expect(
      findOrCreateUser(fixture.db, params(), undefined, {
        IDENTITY_SPLIT_ENABLED: 'true',
        BAN_CONTINUITY: remote.remote,
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ discord_id: D, xivauth_id: X });
    expect(journal()[0]!.state).toBe('pending');
    expect(fixture.sqlite.prepare('SELECT * FROM identity_operation_locks').all()).toHaveLength(4);
    expect(remote.acks).toEqual([]);
  });
  it('commit requires every exact resource lock, not merely the same lock count', async () => {
    const remote = remoteFixture();
    remote.control.afterApply = () =>
      fixture.beforeBatch(() => {
        fixture.sqlite
          .prepare('UPDATE identity_operation_locks SET resource_key=? WHERE resource_key=?')
          .run('user:unrelated', `discord:${D}`);
      });
    fixture.seed({ id: U, discord_id: D, xivauth_id: X });
    await expect(
      findOrCreateUser(fixture.db, params(), undefined, {
        IDENTITY_SPLIT_ENABLED: 'true',
        BAN_CONTINUITY: remote.remote,
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(journal()[0]!.state).toBe('pending');
    expect(rows()[0]).toMatchObject({ id: U, discord_id: D, xivauth_id: X });
  });

  it.each(['missing', 'applied', 'unknown'])(
    'expired %s result aborts only authoritative missing',
    async (outcome) => {
      vi.useFakeTimers();
      vi.setSystemTime(2000000);
      const remote = remoteFixture();
      remote.control.unavailable = true;
      const config = { IDENTITY_SPLIT_ENABLED: 'true', BAN_CONTINUITY: remote.remote };
      fixture.seed({ id: U, discord_id: D, xivauth_id: X });
      await expect(findOrCreateUser(fixture.db, params(), undefined, config)).rejects.toThrow();
      const payload = JSON.parse(journal()[0]!.payload_json as string);
      if (outcome === 'applied')
        remote.receipts.set(payload.request.operationId, {
          v: 1,
          operationId: payload.request.operationId,
          payloadHash: payload.request.payloadHash,
          status: 'applied',
          matchedBanCount: 0,
        });
      vi.advanceTimersByTime(901000);
      remote.control.unavailable = outcome === 'unknown';
      if (outcome === 'applied') {
        expect(await findOrCreateUser(fixture.db, params(), undefined, config)).toMatchObject({
          discord_id: null,
          xivauth_id: X,
        });
        expect(journal()[0]!.state).toBe('complete');
      } else {
        await expect(findOrCreateUser(fixture.db, params(), undefined, config)).rejects.toThrow();
        expect(journal()[0]).toMatchObject({
          state: outcome === 'missing' ? 'aborted' : 'pending',
          resolution: outcome === 'missing' ? 'missing' : null,
        });
        expect(rows()[0]).toMatchObject({ discord_id: D, xivauth_id: X, identity_revision: 1 });
      }
      expect(remote.calls).toHaveLength(0);
    },
  );

  it('an applied attach with a changed fresh assertion stays quarantined', async () => {
    const remote = remoteFixture();
    remote.control.loseApply = true;
    const config = { IDENTITY_SPLIT_ENABLED: 'true', BAN_CONTINUITY: remote.remote };
    fixture.seed({ id: U, xivauth_id: X, auth_provider: 'xivauth' });
    await expect(findOrCreateUser(fixture.db, params(D), undefined, config)).rejects.toThrow();
    await expect(findOrCreateUser(fixture.db, params(D2), undefined, config)).rejects.toMatchObject(
      { code: 'retry' },
    );
    expect(journal()[0]!.state).toBe('pending');
    expect(rows()[0]!.discord_id).toBeNull();
    remote.control.loseApply = false;
    expect(await findOrCreateUser(fixture.db, params(D), undefined, config)).toMatchObject({
      id: U,
      discord_id: D,
      xivauth_id: X,
    });
  });

  it.each(['review_required', 'overflow'] as const)(
    'durable refusal %s aborts immediately, keeps revision, acknowledges independently',
    async (refusal) => {
      const remote = remoteFixture();
      remote.control.refuse = refusal;
      remote.control.loseAck = true;
      const config = { IDENTITY_SPLIT_ENABLED: 'true', BAN_CONTINUITY: remote.remote };
      fixture.seed({ id: U, xivauth_id: X, auth_provider: 'xivauth' });
      await expect(
        findOrCreateUser(fixture.db, params(D), undefined, config),
      ).rejects.toMatchObject({ code: 'retry' });
      expect(journal()[0]).toMatchObject({
        state: 'aborted',
        resolution: 'refused',
        acknowledged_at: null,
      });
      expect(rows()[0]).toMatchObject({ discord_id: null, xivauth_id: X, identity_revision: 1 });
      expect(fixture.sqlite.prepare('SELECT * FROM identity_operation_locks').all()).toEqual([]);
      remote.control.loseAck = false;
      await cleanupIdentityOperations(fixture.db, remote.remote);
      expect(journal()[0]!.acknowledged_at).toEqual(expect.any(Number));
      expect(remote.acks.every((ack) => ack.outcome === 'aborted')).toBe(true);
      expect(remote.calls).toHaveLength(1);
    },
  );

  it('ack failure does not undo completed associations and delayed ack extends retention', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(2000000);
    const remote = remoteFixture();
    remote.control.loseAck = true;
    fixture.seed({ id: U, discord_id: D, xivauth_id: X });
    const user = await findOrCreateUser(fixture.db, params(), undefined, {
      IDENTITY_SPLIT_ENABLED: 'true',
      BAN_CONTINUITY: remote.remote,
    });
    expect(user.discord_id).toBeNull();
    expect(journal()[0]!.state).toBe('complete');
    vi.advanceTimersByTime(90000000);
    await cleanupIdentityOperations(fixture.db, remote.remote);
    expect(journal()).toHaveLength(1);
    remote.control.loseAck = false;
    await cleanupIdentityOperations(fixture.db, remote.remote);
    expect(journal()).toHaveLength(1);
    vi.advanceTimersByTime(86400001);
    await cleanupIdentityOperations(fixture.db, remote.remote);
    expect(journal()).toEqual([]);
  });

  it('schema constraints and migration agree and batch failure really rolls back', async () => {
    const migration = readFileSync(
      new URL('../../migrations/0002_identity_transitions.sql', import.meta.url),
      'utf8',
    );
    // Original pre-0002 users DDL (db34eaad); independent of the updated fresh schema.
    const legacy = `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, discord_id TEXT, xivauth_id TEXT,
      auth_provider TEXT NOT NULL, username TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      CHECK (discord_id IS NOT NULL OR xivauth_id IS NOT NULL));
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id) WHERE discord_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_xivauth_id ON users(xivauth_id) WHERE xivauth_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);`;
    const second = createSQLiteD1(legacy);
    try {
      second.seed({id:U,discord_id:D,xivauth_id:X,username:'Legacy stored name'});
      const before=second.sqlite.prepare('SELECT * FROM users WHERE id=?').get(U)!;
      second.sqlite.exec(migration);
      expect(second.sqlite.prepare('SELECT * FROM users WHERE id=?').get(U)).toEqual({...before,identity_revision:0});
      expect(()=>second.sqlite.prepare('UPDATE users SET identity_revision=-1 WHERE id=?').run(U)).toThrow();
      expect(()=>second.sqlite.prepare("INSERT INTO identity_operation_locks (resource_key,operation_id) VALUES ('user:missing','missing')").run()).toThrow();
      second.sqlite.prepare("INSERT INTO identity_operations (id,payload_json,payload_hash,state,created_at,expires_at) VALUES (?,'{}',?,'pending',1,2)").run(U,'a'.repeat(64));
      second.sqlite.prepare('INSERT INTO identity_operation_locks (resource_key,operation_id) VALUES (?,?)').run(`user:${U}`,U);
      expect(()=>second.sqlite.prepare('INSERT INTO identity_operation_locks (resource_key,operation_id) VALUES (?,?)').run(`user:${U}`,U)).toThrow();
      expect(()=>second.sqlite.prepare("UPDATE identity_operations SET state='complete',finished_at=2 WHERE id=?").run(U)).toThrow();
      second.sqlite.prepare('DELETE FROM identity_operations WHERE id=?').run(U);
      expect(second.sqlite.prepare('SELECT * FROM identity_operation_locks').all()).toEqual([]);
      expect(
        second.sqlite
          .prepare("SELECT sql FROM sqlite_master WHERE name='identity_operations'")
          .get(),
      ).toEqual(
        fixture.sqlite
          .prepare("SELECT sql FROM sqlite_master WHERE name='identity_operations'")
          .get(),
      );
      expect(() => second.sqlite.exec(migration)).toThrow();
    } finally {
      second.close();
    }
    fixture.seed({ id: U, discord_id: D });
    await expect(
      fixture.db.batch([
        fixture.db.prepare('UPDATE users SET username=? WHERE id=?').bind('Changed', U),
        fixture.db.prepare('UPDATE users SET identity_revision=-1 WHERE id=?').bind(U),
      ]),
    ).rejects.toThrow();
    expect(rows()[0]!.username).toBe('Stored name');
    for (const [state, resolution] of [
      ['pending', 'applied'],
      ['complete', null],
      ['aborted', null],
      ['aborted', 'applied'],
    ])
      expect(() =>
        fixture.sqlite
          .prepare(
            'INSERT INTO identity_operations (id,payload_json,payload_hash,state,created_at,expires_at,finished_at,resolution) VALUES (?,?,?,?,?,?,?,?)',
          )
          .run(
            crypto.randomUUID(),
            '{}',
            'a'.repeat(64),
            state,
            1,
            2,
            state === 'pending' ? null : 2,
            resolution,
          ),
      ).toThrow();
  });
  it('association insert failure rolls back the preceding detach and retains its applied operation',async()=>{
    fixture.seed({id:U,discord_id:D,xivauth_id:X});
    fixture.sqlite.exec(`CREATE TRIGGER reject_fresh BEFORE INSERT ON users WHEN NEW.id != '${U}' BEGIN SELECT RAISE(ABORT,'private failure'); END`);
    const remote=remoteFixture();
    await expect(findOrCreateUser(fixture.db,params(),undefined,{IDENTITY_SPLIT_ENABLED:'true',BAN_CONTINUITY:remote.remote})).rejects.toMatchObject({code:'unavailable'});
    expect(rows()[0]).toMatchObject({id:U,discord_id:D,xivauth_id:X,identity_revision:1});
    expect(journal()[0]!.state).toBe('pending');
    expect(fixture.sqlite.prepare('SELECT * FROM identity_operation_locks').all()).toHaveLength(4);
  });
  it('an unowned attach destination must still be unowned in the commit transaction',async()=>{
    fixture.seed({id:U,xivauth_id:X,auth_provider:'xivauth'});
    const remote=remoteFixture();
    remote.control.afterApply=()=>fixture.seed({id:X2,discord_id:D});
    await expect(findOrCreateUser(fixture.db,params(D),undefined,{IDENTITY_SPLIT_ENABLED:'true',BAN_CONTINUITY:remote.remote})).rejects.toMatchObject({code:'unavailable'});
    expect(rows().find(row=>row.id===U)!.discord_id).toBeNull();
    expect(journal()[0]!.state).toBe('pending');
  });
  it('changed durable payload under the same hash is quarantined without widening scope or deadline',async()=>{
    fixture.seed({id:U,discord_id:D,xivauth_id:X});
    const remote=remoteFixture();remote.control.unavailable=true;
    const config={IDENTITY_SPLIT_ENABLED:'true',BAN_CONTINUITY:remote.remote};
    await expect(findOrCreateUser(fixture.db,params(),undefined,config)).rejects.toThrow();
    const before=journal()[0]!;const payload=JSON.parse(before.payload_json as string);
    payload.request.destinationIds=[X2];
    fixture.sqlite.prepare('UPDATE identity_operations SET payload_json=? WHERE id=?').run(JSON.stringify(payload),before.id as string);
    remote.control.unavailable=false;
    await expect(findOrCreateUser(fixture.db,params(),undefined,config)).rejects.toMatchObject({code:'unavailable'});
    expect(journal()[0]).toMatchObject({id:before.id,expires_at:before.expires_at,state:'pending'});
    expect(remote.calls).toEqual([]);
  });
  it('successive detach and attach operations never grant authority through historical memberships',async()=>{
    fixture.seed({id:U,discord_id:D,xivauth_id:X});
    const remote=remoteFixture();const config={IDENTITY_SPLIT_ENABLED:'true',BAN_CONTINUITY:remote.remote};
    const first=await findOrCreateUser(fixture.db,params(),undefined,config);
    const attached=await findOrCreateUser(fixture.db,params(D2),undefined,config);
    expect(attached.id).toBe(first.id);
    const second=await findOrCreateUser(fixture.db,params(),undefined,config);
    expect(second.id).not.toBe(first.id);expect(second.id).not.toBe(U);expect(second.discord_id).toBeNull();
    expect(rows().find(row=>row.id===U)).toMatchObject({discord_id:D,xivauth_id:null});
    expect(rows().find(row=>row.id===first.id)).toMatchObject({discord_id:D2,xivauth_id:null});
    expect(remote.calls[2]!.sourceIds).toEqual([first.id,D2].sort());
    expect(remote.calls[2]!.sourceIds).not.toContain(U);expect(remote.calls[2]!.sourceIds).not.toContain(D);
  });
  it('authoritative missing aborts become purge eligible only after resolution and expiry plus 24 hours',async()=>{
    vi.useFakeTimers();vi.setSystemTime(2000000);
    fixture.seed({id:U,discord_id:D,xivauth_id:X});
    const remote=remoteFixture();remote.control.unavailable=true;
    const config={IDENTITY_SPLIT_ENABLED:'true',BAN_CONTINUITY:remote.remote};
    await expect(findOrCreateUser(fixture.db,params(),undefined,config)).rejects.toThrow();
    vi.advanceTimersByTime(901000);remote.control.unavailable=false;
    await expect(findOrCreateUser(fixture.db,params(),undefined,config)).rejects.toThrow();
    expect(journal()[0]).toMatchObject({state:'aborted',resolution:'missing',acknowledged_at:null});
    await cleanupIdentityOperations(fixture.db,remote.remote);expect(journal()).toHaveLength(1);
    vi.advanceTimersByTime(86400001);await cleanupIdentityOperations(fixture.db,remote.remote);expect(journal()).toEqual([]);
    expect(remote.acks).toEqual([]);
  });

  it.each([
    { receipt: 'refused', race: 'lock' },
    { receipt: 'refused', race: 'revision' },
    { receipt: 'expired-missing', race: 'lock' },
    { receipt: 'expired-missing', race: 'revision' },
  ])('abort guard refuses $receipt after $race changes immediately before abort', async ({receipt,race}) => {
    vi.useFakeTimers();
    vi.setSystemTime(2000000);
    fixture.seed({id:U,discord_id:D,xivauth_id:X,username:'Original name'});
    const remote=remoteFixture();
    const config={IDENTITY_SPLIT_ENABLED:'true',BAN_CONTINUITY:remote.remote};
    const injectRace=() => fixture.beforeBatch(() => {
      if(race==='lock') fixture.sqlite.prepare('UPDATE identity_operation_locks SET resource_key=? WHERE resource_key=?').run('user:substituted',`discord:${D}`);
      else fixture.sqlite.prepare('UPDATE users SET identity_revision=identity_revision+1 WHERE id=?').run(U);
    });
    if(receipt==='refused') {
      remote.control.refuse='review_required';
      remote.control.afterApply=injectRace;
    } else {
      remote.control.unavailable=true;
      await expect(findOrCreateUser(fixture.db,params(),undefined,config)).rejects.toMatchObject({code:'unavailable'});
      const before=journal()[0]!;
      vi.advanceTimersByTime(901000);
      remote.control.unavailable=false;
      const getOperation=remote.remote.getOperation;
      remote.remote.getOperation=async request => {
        const result=await getOperation(request);
        injectRace();
        return result;
      };
      expect(journal()[0]).toMatchObject({id:before.id,payload_hash:before.payload_hash,payload_json:before.payload_json,expires_at:before.expires_at});
    }
    await expect(findOrCreateUser(fixture.db,params(),undefined,config)).rejects.toMatchObject({code:'unavailable'});
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({id:U,discord_id:D,xivauth_id:X,username:'Original name',identity_revision:race==='revision'?2:1});
    expect(journal()[0]).toMatchObject({state:'pending',resolution:null,finished_at:null,acknowledged_at:null});
    const locks=fixture.sqlite.prepare('SELECT resource_key,operation_id FROM identity_operation_locks').all();
    expect(locks).toHaveLength(4);
    expect(locks.every(lock=>lock.operation_id===journal()[0]!.id)).toBe(true);
    expect(locks.some(lock=>lock.resource_key===`user:${U}`)).toBe(true);
    if(race==='lock') expect(locks.some(lock=>lock.resource_key==='user:substituted')).toBe(true);
    expect(remote.acks).toEqual([]);
  });

  const malformedAcknowledgements: {name:string;patch:(ack:Record<string,unknown>)=>Record<string,unknown>}[] = [
    {name:'wrong operation ID',patch:ack=>({...ack,operationId:X2})},
    {name:'wrong hash',patch:ack=>({...ack,payloadHash:'0'.repeat(64)})},
    {name:'wrong outcome',patch:ack=>({...ack,outcome:ack.outcome==='complete'?'aborted':'complete'})},
    {name:'missing timestamp',patch:ack=>{const result={...ack};delete result.acknowledgedAt;return result;}},
    {name:'string timestamp',patch:ack=>({...ack,acknowledgedAt:String(ack.acknowledgedAt)})},
    {name:'fractional timestamp',patch:ack=>({...ack,acknowledgedAt:Number(ack.acknowledgedAt)+0.5})},
    {name:'timestamp before creation',patch:ack=>({...ack,acknowledgedAt:Number(ack.acknowledgedAt)-1})},
    {name:'future timestamp',patch:ack=>({...ack,acknowledgedAt:Math.floor(Date.now()/1000)+1})},
  ];
  it.each(['complete','aborted'] as const)('malformed acknowledgement after %s never stamps or purges until a valid retry',async outcome=>{
    vi.useFakeTimers();
    for(const malformed of malformedAcknowledgements) {
      vi.setSystemTime(2000000);
      fixture.sqlite.exec('DELETE FROM identity_operation_locks; DELETE FROM identity_operations; DELETE FROM users');
      fixture.seed({id:U,discord_id:D,xivauth_id:X});
      const remote=remoteFixture();
      if(outcome==='aborted') remote.control.refuse='review_required';
      const acknowledge=remote.remote.acknowledge;
      let sendMalformed=true;
      remote.remote.acknowledge=async request=>{
        const response=await acknowledge(request) as Record<string,unknown>;
        return sendMalformed ? malformed.patch(response) : response;
      };
      const login=findOrCreateUser(fixture.db,params(),undefined,{IDENTITY_SPLIT_ENABLED:'true',BAN_CONTINUITY:remote.remote});
      if(outcome==='aborted') await expect(login).rejects.toMatchObject({code:'retry'});
      else expect(await login).toMatchObject({discord_id:null,xivauth_id:X});
      const resolved=journal()[0]!;
      expect(resolved,malformed.name).toMatchObject({state:outcome,resolution:outcome==='complete'?'applied':'refused',acknowledged_at:null});
      const identities=rows();
      expect(fixture.sqlite.prepare('SELECT * FROM identity_operation_locks').all()).toEqual([]);
      vi.advanceTimersByTime(901000+86400001);
      await cleanupIdentityOperations(fixture.db,remote.remote);
      expect(journal(),malformed.name).toHaveLength(1);
      expect(journal()[0],malformed.name).toMatchObject({id:resolved.id,state:outcome,acknowledged_at:null});
      expect(rows(),malformed.name).toEqual(identities);
      sendMalformed=false;
      await cleanupIdentityOperations(fixture.db,remote.remote);
      // The stable original acknowledgement time makes this record eligible now.
      expect(journal(),malformed.name).toEqual([]);
      expect(remote.acks,malformed.name).toHaveLength(3);
      expect(remote.acks.every(ack=>ack.outcome===outcome && ack.operationId===resolved.id && ack.payloadHash===resolved.payload_hash)).toBe(true);
      expect(rows(),malformed.name).toEqual(identities);
      expect(fixture.sqlite.prepare('SELECT * FROM identity_operation_locks').all()).toEqual([]);
    }
  });
});
