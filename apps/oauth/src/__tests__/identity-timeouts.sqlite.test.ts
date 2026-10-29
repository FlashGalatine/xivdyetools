import { setImmediate } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSQLiteD1 } from './mocks/sqlite-d1.js';
import { findOrCreateUser } from '../services/user-service.js';
import { cleanupIdentityOperations } from '../services/identity-transition-service.js';
import { validateSession } from '../services/identity-service.js';
import type { BanContinuity, ContinuityRequest } from '../services/identity-contract.js';

const U = '10000000-0000-4000-8000-000000000001';
const X = '20000000-0000-4000-8000-000000000001';
const D = '123456789012345678';
const params = {
  xivauth_id: X,
  discord_id: null,
  username: 'Incoming',
  auth_provider: 'xivauth' as const,
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function boundary() {
  const requests: ContinuityRequest[] = [];
  const receipts = new Map<string, unknown>();
  const remote: BanContinuity = {
    getOperation: async (input) =>
      receipts.get(input.operationId) ?? { v: 1, ...input, status: 'missing' },
    apply: async (input) => {
      requests.push(structuredClone(input));
      const receipt = {
        v: 1,
        operationId: input.operationId,
        payloadHash: input.payloadHash,
        status: 'applied',
        matchedBanCount: 0,
      };
      receipts.set(input.operationId, receipt);
      return receipt;
    },
    acknowledge: async (input) => ({
      v: 1,
      ...input,
      status: 'acknowledged',
      acknowledgedAt: Math.floor(Date.now() / 1000),
    }),
  };
  return {
    remote,
    requests,
    receipts,
    config: { IDENTITY_SPLIT_ENABLED: 'true', BAN_CONTINUITY: remote },
  };
}
// Removing a remote bound makes these observations fail without relying on a test timeout.
function observe<T>(promise: Promise<T>) {
  const result: { status: 'waiting' | 'fulfilled' | 'rejected'; value?: T; error?: unknown } = {
    status: 'waiting',
  };
  void promise.then(
    (value) => {
      result.status = 'fulfilled';
      result.value = value;
    },
    (error) => {
      result.status = 'rejected';
      result.error = error;
    },
  );
  return result;
}
describe('bounded identity continuity waits', () => {
  let fixture: ReturnType<typeof createSQLiteD1>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(2000000);
    fixture = createSQLiteD1();
    fixture.seed({ id: U, discord_id: D, xivauth_id: X });
  });
  afterEach(() => {
    fixture.close();
    vi.useRealTimers();
  });
  const journal = () =>
    fixture.sqlite.prepare('SELECT * FROM identity_operations ORDER BY rowid').all();
  const locks = () => fixture.sqlite.prepare('SELECT * FROM identity_operation_locks').all();
  const identities = () => fixture.sqlite.prepare('SELECT * FROM users ORDER BY id').all();

  it.each(['get', 'apply'] as const)(
    'a never settling %s fails closed and a late success cannot release locks or return a session user',
    async (phase) => {
      const peer = boundary();
      const held = deferred<unknown>();
      const entered = deferred<void>();
      let request!: ContinuityRequest;
      if (phase === 'get')
        peer.remote.getOperation = async () => {
          entered.resolve();
          return held.promise;
        };
      else
        peer.remote.apply = async (input) => {
          request = structuredClone(input);
          entered.resolve();
          return held.promise;
        };
      const login = observe(findOrCreateUser(fixture.db, params, undefined, peer.config));
      await entered.promise;
      await vi.advanceTimersByTimeAsync(5000);
      expect(login).toMatchObject({ status: 'rejected', error: { code: 'unavailable' } });
      const before = journal()[0]!;
      const frozen = identities();
      expect(before).toMatchObject({ state: 'pending', resolution: null });
      expect(locks()).toHaveLength(4);
      expect(
        await validateSession(fixture.db, {
          sub: U,
          identityRevision: 1,
          authProvider: 'discord',
          discordId: D,
        }),
      ).toMatchObject({ status: 'pending' });
      const payload = JSON.parse(before.payload_json as string) as { request: ContinuityRequest };
      held.resolve({
        v: 1,
        operationId: before.id,
        payloadHash: before.payload_hash,
        status: 'applied',
        matchedBanCount: 0,
      });
      await vi.advanceTimersByTimeAsync(1);
      expect(identities()).toEqual(frozen);
      expect(journal()[0]).toEqual(before);
      expect(locks()).toHaveLength(4);
      expect(login.status).toBe('rejected');
      peer.remote.getOperation = async (input) => ({ v: 1, ...input, status: 'missing' });
      peer.remote.apply = async (input) => {
        request = structuredClone(input);
        return {
          v: 1,
          operationId: input.operationId,
          payloadHash: input.payloadHash,
          status: 'applied',
          matchedBanCount: 0,
        };
      };
      expect(await findOrCreateUser(fixture.db, params, undefined, peer.config)).toMatchObject({
        xivauth_id: X,
        discord_id: null,
      });
      expect(request).toEqual(payload.request);
      expect(journal()[0]).toMatchObject({
        id: before.id,
        payload_hash: before.payload_hash,
        payload_json: before.payload_json,
        state: 'complete',
      });
    },
  );

  it('get and apply share one deadline, and a late rejection stays handled', async () => {
    const peer = boundary();
    const entered = deferred<void>();
    const held = deferred<unknown>();
    peer.remote.getOperation = async (input) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      return { v: 1, ...input, status: 'missing' };
    };
    peer.remote.apply = async () => {
      entered.resolve();
      return held.promise;
    };
    const login = observe(findOrCreateUser(fixture.db, params, undefined, peer.config));
    await vi.waitFor(() => expect(journal()).toHaveLength(1), { interval: 1 });
    await vi.advanceTimersByTimeAsync(4000);
    await entered.promise;
    await vi.advanceTimersByTimeAsync(1000);
    expect(login).toMatchObject({ status: 'rejected', error: { code: 'unavailable' } });
    held.reject(new Error('late transport rejection'));
    await vi.advanceTimersByTimeAsync(1);
    expect(journal()[0]).toMatchObject({ state: 'pending', resolution: null });
    expect(identities()).toHaveLength(1);
    expect(locks()).toHaveLength(4);
  });

  it.each(['applied', 'refused'] as const)(
    'acknowledgement timeout preserves confirmed %s and ignores a late acknowledgement',
    async (status) => {
      const peer = boundary();
      const entered = deferred<void>();
      const held = deferred<unknown>();
      let ackInput!: Parameters<BanContinuity['acknowledge']>[0];
      if (status === 'refused')
        peer.remote.apply = async (input) => ({
          v: 1,
          operationId: input.operationId,
          payloadHash: input.payloadHash,
          status: 'refused',
          reason: 'review_required',
        });
      peer.remote.acknowledge = async (input) => {
        ackInput = input;
        entered.resolve();
        return held.promise;
      };
      const login = observe(findOrCreateUser(fixture.db, params, undefined, peer.config));
      await entered.promise;
      await vi.advanceTimersByTimeAsync(1000);
      expect(login.status).toBe(status === 'applied' ? 'fulfilled' : 'rejected');
      if (status === 'refused') expect(login.error).toMatchObject({ code: 'retry' });
      expect(journal()[0]).toMatchObject({
        state: status === 'applied' ? 'complete' : 'aborted',
        resolution: status,
        acknowledged_at: null,
      });
      expect(locks()).toEqual([]);
      const frozen = identities();
      held.resolve({
        v: 1,
        ...ackInput,
        status: 'acknowledged',
        acknowledgedAt: Math.floor(Date.now() / 1000),
      });
      await vi.advanceTimersByTimeAsync(1);
      expect(journal()[0]!.acknowledged_at).toBeNull();
      expect(identities()).toEqual(frozen);
    },
  );

  it('eight stalled terminal acknowledgements share one second and unrelated login progresses even while inactive', async () => {
    const peer = boundary();
    await findOrCreateUser(fixture.db, params, undefined, peer.config);
    // Duplicate valid terminal transitions are built through the real service.
    for (let i = 2; i <= 8; i++) {
      const id = `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const x = `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      fixture.seed({ id, discord_id: String(BigInt(D) + BigInt(i)), xivauth_id: x });
      await findOrCreateUser(fixture.db, { ...params, xivauth_id: x }, undefined, peer.config);
    }
    fixture.sqlite.prepare('UPDATE identity_operations SET acknowledged_at=NULL').run();
    let count = 0;
    peer.remote.acknowledge = async () => {
      ++count;
      return new Promise(() => {});
    };
    const login = observe(
      findOrCreateUser(
        fixture.db,
        { discord_id: '923456789012345678', username: 'Unrelated', auth_provider: 'discord' },
        undefined,
        { ...peer.config, IDENTITY_SPLIT_ENABLED: 'false' },
      ),
    );
    await vi.waitFor(() => expect(count).toBeGreaterThan(0), { interval: 1 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(login).toMatchObject({
      status: 'fulfilled',
      value: { discord_id: '923456789012345678' },
    });
    expect(count).toBe(8);
    expect(journal()).toHaveLength(8);
    expect(journal().every((row) => row.acknowledged_at === null)).toBe(true);
  });

  it('a stalled acknowledgement cannot prevent another selected terminal row from being acknowledged', async () => {
    const peer = boundary();
    await findOrCreateUser(fixture.db, params, undefined, peer.config);
    const stalled = journal()[0]!;
    const secondX = '20000000-0000-4000-8000-000000000002';
    fixture.seed({ id: secondX, discord_id: '223456789012345678', xivauth_id: secondX });
    await findOrCreateUser(fixture.db, { ...params, xivauth_id: secondX }, undefined, peer.config);
    fixture.sqlite.prepare('UPDATE identity_operations SET acknowledged_at=NULL').run();
    const acknowledge = peer.remote.acknowledge;
    peer.remote.acknowledge = async (input) =>
      input.operationId === stalled.id ? new Promise(() => {}) : acknowledge(input);
    const cleanup = observe(cleanupIdentityOperations(fixture.db, peer.remote));
    await vi.waitFor(
      () =>
        expect(journal().find((row) => row.id !== stalled.id)!.acknowledged_at).toEqual(
          expect.any(Number),
        ),
      { interval: 1 },
    );
    expect(cleanup.status).toBe('waiting');
    expect(journal().find((row) => row.id === stalled.id)!.acknowledged_at).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(cleanup.status).toBe('fulfilled');
    expect(journal().find((row) => row.id === stalled.id)!.acknowledged_at).toBeNull();
  });

  it.each(['get', 'apply', 'ack'] as const)(
    'expired %s reply is rejected even before its timer callback runs',
    async (phase) => {
      const peer = boundary();
      const held = deferred<unknown>();
      const entered = deferred<void>();
      let reply: unknown;
      if (phase === 'get')
        peer.remote.getOperation = async (input) => {
          reply = { v: 1, ...input, status: 'applied', matchedBanCount: 0 };
          entered.resolve();
          return held.promise;
        };
      else if (phase === 'apply')
        peer.remote.apply = async (input) => {
          reply = {
            v: 1,
            operationId: input.operationId,
            payloadHash: input.payloadHash,
            status: 'applied',
            matchedBanCount: 0,
          };
          entered.resolve();
          return held.promise;
        };
      else
        peer.remote.acknowledge = async (input) => {
          reply = {
            v: 1,
            ...input,
            status: 'acknowledged',
            acknowledgedAt: Math.floor(Date.now() / 1000),
          };
          entered.resolve();
          return held.promise;
        };
      const login = observe(findOrCreateUser(fixture.db, params, undefined, peer.config));
      await entered.promise;
      vi.setSystemTime(Date.now() + 6000);
      held.resolve(reply);
      await setImmediate();
      expect(login.status).toBe(phase === 'ack' ? 'fulfilled' : 'rejected');
      expect(journal()[0]).toMatchObject({
        state: phase === 'ack' ? 'complete' : 'pending',
        acknowledged_at: null,
      });
      expect(locks()).toHaveLength(phase === 'ack' ? 0 : 4);
    },
  );

  it.each(['get', 'ack'] as const)(
    'late %s rejection stays handled and cannot rewrite local state',
    async (phase) => {
      const peer = boundary();
      const held = deferred<unknown>();
      const entered = deferred<void>();
      if (phase === 'get')
        peer.remote.getOperation = async () => {
          entered.resolve();
          return held.promise;
        };
      else
        peer.remote.acknowledge = async () => {
          entered.resolve();
          return held.promise;
        };
      const unhandled: unknown[] = [];
      const listener = (error: unknown) => unhandled.push(error);
      process.on('unhandledRejection', listener);
      try {
        const login = observe(findOrCreateUser(fixture.db, params, undefined, peer.config));
        await entered.promise;
        await vi.advanceTimersByTimeAsync(phase === 'get' ? 5000 : 1000);
        const frozen = { identities: identities(), journal: journal(), locks: locks() };
        held.reject(new Error('late rejected RPC'));
        await setImmediate();
        expect(unhandled).toEqual([]);
        expect({ identities: identities(), journal: journal(), locks: locks() }).toEqual(frozen);
        expect(login.status).toBe(phase === 'get' ? 'rejected' : 'fulfilled');
      } finally {
        process.off('unhandledRejection', listener);
      }
    },
  );

  it.each(['success', 'sync-throw', 'reject'] as const)(
    'releases all remote timers after %s',
    async (outcome) => {
      const peer = boundary();
      if (outcome === 'sync-throw')
        peer.remote.getOperation = () => {
          throw new Error('sync transport failure');
        };
      if (outcome === 'reject')
        peer.remote.getOperation = async () => {
          throw new Error('transport failure');
        };
      const login = findOrCreateUser(fixture.db, params, undefined, peer.config);
      if (outcome === 'success')
        expect(await login).toMatchObject({ discord_id: null, xivauth_id: X });
      else await expect(login).rejects.toMatchObject({ code: 'unavailable' });
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('deletes at most eight eligible records at the exact retention boundary and preserves pending or unacknowledged records', async () => {
    vi.setSystemTime(100000000000);
    const now = 100000000;
    const insert = (
      id: string,
      state: string,
      resolution: string | null,
      expires: number,
      finished: number | null,
      ack: number | null,
    ) =>
      fixture.sqlite
        .prepare(
          'INSERT INTO identity_operations (id,payload_json,payload_hash,state,created_at,expires_at,finished_at,resolution,acknowledged_at) VALUES (?,?,?,?,?,?,?,?,?)',
        )
        .run(id, '{}', 'a'.repeat(64), state, expires - 1, expires, finished, resolution, ack);
    insert('pending', 'pending', null, 2, null, null);
    insert('unacknowledged', 'complete', 'applied', 2, 2, null);
    insert('one-second-young', 'complete', 'applied', now - 86400 + 1, 2, 2);
    insert('missing-young', 'aborted', 'missing', 2, now - 86400 + 1, null);
    for (let i = 0; i < 10; i++)
      insert(
        `eligible-${i}`,
        i % 2 ? 'aborted' : 'complete',
        i % 2 ? 'missing' : 'applied',
        now - 86400,
        now - 86400,
        i % 2 ? null : now - 86400,
      );
    await cleanupIdentityOperations(fixture.db);
    const survivors = journal();
    expect(survivors).toHaveLength(6);
    expect(survivors.filter((row) => String(row.id).startsWith('eligible-'))).toHaveLength(2);
    expect(
      survivors
        .filter((row) => !String(row.id).startsWith('eligible-'))
        .map((row) => row.id)
        .sort(),
    ).toEqual(['missing-young', 'one-second-young', 'pending', 'unacknowledged']);
    await cleanupIdentityOperations(fixture.db);
    expect(
      journal()
        .map((row) => row.id)
        .sort(),
    ).toEqual(['missing-young', 'one-second-young', 'pending', 'unacknowledged']);
    vi.advanceTimersByTime(1000);
    await cleanupIdentityOperations(fixture.db);
    expect(
      journal()
        .map((row) => row.id)
        .sort(),
    ).toEqual(['pending', 'unacknowledged']);
  });

  it('rotates past eight poisoned terminal rows to acknowledge a ninth on the next cleanup', async () => {
    const peer = boundary();
    await findOrCreateUser(fixture.db, params, undefined, peer.config);
    const valid = journal()[0]!;
    fixture.sqlite.prepare('UPDATE identity_operations SET acknowledged_at=NULL').run();
    for (let i = 1; i <= 8; i++)
      fixture.sqlite
        .prepare(
          'INSERT INTO identity_operations (id,payload_json,payload_hash,state,created_at,expires_at,finished_at,resolution) VALUES (?,?,?,?,?,?,?,?)',
        )
        .run(
          `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          '{}',
          'a'.repeat(64),
          'complete',
          1,
          2,
          2,
          'applied',
        );
    await cleanupIdentityOperations(fixture.db, peer.remote);
    expect(journal().find((row) => row.id === valid.id)!.acknowledged_at).toBeNull();
    await cleanupIdentityOperations(fixture.db, peer.remote);
    expect(journal().find((row) => row.id === valid.id)!.acknowledged_at).toEqual(
      expect.any(Number),
    );
    expect(journal()).toHaveLength(9);
  });

  it('malformed housekeeping cannot prevent a later valid acknowledgement or eligible deletion', async () => {
    const peer = boundary();
    await findOrCreateUser(fixture.db, params, undefined, peer.config);
    const valid = journal()[0]!;
    fixture.sqlite
      .prepare(
        'INSERT INTO identity_operations (id,payload_json,payload_hash,state,created_at,expires_at,finished_at,resolution) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(crypto.randomUUID(), '{}', 'a'.repeat(64), 'complete', 1, 2, 2, 'applied');
    fixture.sqlite.prepare('UPDATE identity_operations SET acknowledged_at=NULL').run();
    await cleanupIdentityOperations(fixture.db, peer.remote);
    expect(journal().find((row) => row.id === valid.id)!.acknowledged_at).toEqual(
      expect.any(Number),
    );
    // Deletion is capped even when many records are eligible in a single request.
    for (let i = 0; i < 12; i++)
      fixture.sqlite
        .prepare(
          'INSERT INTO identity_operations (id,payload_json,payload_hash,state,created_at,expires_at,finished_at,resolution) VALUES (?,?,?,?,?,?,?,?)',
        )
        .run(crypto.randomUUID(), '{}', 'b'.repeat(64), 'aborted', 1, 2, 2, 'missing');
    vi.advanceTimersByTime(86400000);
    await cleanupIdentityOperations(fixture.db, peer.remote);
    expect(journal()).toHaveLength(6);
  });
});
