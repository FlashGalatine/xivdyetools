import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharaLookupLoader } from './lookup-loader';
import { CharaRowCache } from './cache';
import { XivapiClient } from './xivapi';
import type { XivapiContext } from './xivapi';
import type { SlotLookup } from './types';
import { createMockExecutionContext, resetAllMocks } from '../universalis/test-setup';

const V = 'aaaaaaaaaaaaaaaa';
const S = 'exdschema@2:rev:' + 'a'.repeat(40);
const A: SlotLookup = { field: 'Head', key: '1' };
const B: SlotLookup = { field: 'Body', key: '2' };
const C: SlotLookup = { field: 'Feet', key: '3' };
const raw = (lookup: SlotLookup) => ({
  row_id: Number(lookup.key),
  fields: {
    Name: 'Item ' + lookup.key,
    ModelMain: Number(lookup.key),
    ModelSub: 0,
    EquipSlotCategory: { fields: { [lookup.field]: 1 } },
  },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function json(url: string, data: object) {
  const query = new URL(url).searchParams;
  return new Response(
    JSON.stringify({ version: query.get('version'), schema: query.get('schema'), ...data }),
  );
}

describe('pending chara lookup reuse', () => {
  let context: XivapiContext;
  let cache: CharaRowCache;
  let ctx: ExecutionContext;
  let sequence = 0;
  beforeEach(() => {
    resetAllMocks();
    const base = 'https://lookup-' + ++sequence + '.test';
    context = { base, version: V, schema: S, cacheNamespace: JSON.stringify([base, V, S]) };
    ctx = createMockExecutionContext();
    cache = new CharaRowCache(ctx, context.cacheNamespace!);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const flush = () => (ctx as unknown as { _waitForAll(): Promise<unknown> })._waitForAll();
  const loader = (snapshot = context) =>
    new CharaLookupLoader(
      new XivapiClient({ XIVAPI_BASE: snapshot.base }),
      snapshot,
      snapshot.cacheNamespace ? cache : null,
      ctx,
    );

  it('shares identical pending row families and gives each caller independent decoded data', async () => {
    const gate = deferred<void>();
    const fetchMock = vi.fn((url: string) =>
      gate.promise.then(() => json(url, { results: [raw(A)] })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const requests = [loader().loadRows([A]), loader().loadRows([A])];
    for (const pending of requests) pending.catch(() => undefined);
    try {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      gate.resolve();
    }
    const [first, second] = await Promise.all(requests);
    expect(first.version).toBe(V);
    expect(first.schema).toBe(S);
    expect(first.rows.get('Head:1')?.[0].names.en).toBe('Item 1');
    first.rows.get('Head:1')![0].names.en = 'mutated';
    expect(second.rows.get('Head:1')?.[0].names.en).toBe('Item 1');
    await flush();
    expect((await cache.getRows([A])).get('Head:1')?.[0].names.en).toBe('Item 1');
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it('batches only newly owned keys when two requests partially overlap', async () => {
    const gate = deferred<void>();
    const fetchMock = vi.fn((url: string) =>
      gate.promise.then(() => json(url, { results: [raw(A), raw(B), raw(C)] })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const requests = [loader().loadRows([A, B]), loader().loadRows([B, C])];
    for (const pending of requests) pending.catch(() => undefined);
    try {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const queries = fetchMock.mock.calls.map(([url]) => new URL(url).searchParams.get('query'));
      expect(queries).toEqual([
        '+((+EquipSlotCategory.Head=1 +ModelMain=1) (+EquipSlotCategory.Body=1 +ModelMain=2))',
        '+((+EquipSlotCategory.Feet=1 +ModelMain=3))',
      ]);
    } finally {
      gate.resolve();
    }
    const [first, second] = await Promise.all(requests);
    expect([...first.rows.keys()]).toEqual(['Head:1', 'Body:2']);
    expect([...second.rows.keys()]).toEqual(['Body:2', 'Feet:3']);
    expect(second.rows.get('Body:2')?.[0].rowId).toBe(2);
  });

  it('keeps all-new lookups in one upstream batch and skips an empty set', async () => {
    const fetchMock = vi.fn(async (url: string) => json(url, { results: [] }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await loader().loadRows([])).rows.size).toBe(0);
    const lookups = Array.from({ length: 12 }, (_, i) => ({ field: 'Head', key: String(i + 1) }));
    expect((await loader().loadRows(lookups)).rows.size).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      new URL(fetchMock.mock.calls[0][0]).searchParams.get('query')?.match(/ModelMain=/g),
    ).toHaveLength(12);
  });

  it('shares Glasses results including verified null, without sharing mutable names', async () => {
    const gate = deferred<void>();
    const fetchMock = vi.fn((url: string) =>
      gate.promise.then(() => json(url, { row_id: 3, fields: { Name: 'Glasses' } })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const requests = [loader().loadGlasses(3), loader().loadGlasses(3)];
    for (const pending of requests) pending.catch(() => undefined);
    try {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      gate.resolve();
    }
    const [one, two] = await Promise.all(requests);
    one.row!.names.en = 'changed';
    expect(two.row?.names.en).toBe('Glasses');
    await flush();
    expect((await cache.getGlasses(3))?.names.en).toBe('Glasses');
    fetchMock.mockImplementation(async () => new Response(null, { status: 404 }));
    const missing = await Promise.all([loader().loadGlasses(4), loader().loadGlasses(4)]);
    expect(missing.map((result) => result.row)).toEqual([null, null]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await flush();
    expect(await cache.getGlasses(4)).toBeNull();
  });

  it.each(['base', 'version', 'schema', 'slot', 'operation', 'glasses-id'])(
    'keeps independent lookup identities separate: %s',
    async (kind) => {
      const gate = deferred<void>();
      const fetchMock = vi.fn((url: string) =>
        gate.promise.then(() => {
          if (url.includes('/Glasses/'))
            return json(url, {
              row_id: Number(new URL(url).pathname.split('/').pop()),
              fields: { Name: 'G' },
            });
          return json(url, { results: [] });
        }),
      );
      vi.stubGlobal('fetch', fetchMock);
      const other = { ...context };
      if (kind === 'base') other.base = 'https://other.test';
      if (kind === 'version') other.version = 'bbbbbbbbbbbbbbbb';
      if (kind === 'schema') other.schema = 'exdschema@2:rev:' + 'b'.repeat(40);
      other.cacheNamespace = JSON.stringify([other.base, other.version, other.schema]);
      const one = kind === 'glasses-id' ? loader().loadGlasses(3) : loader().loadRows([A]);
      const two =
        kind === 'operation' || kind === 'glasses-id'
          ? loader(other).loadGlasses(4)
          : loader(other).loadRows([kind === 'slot' ? { ...A, field: 'Body' } : A]);
      try {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        gate.resolve();
      }
      await Promise.all([one, two]);
    },
  );

  it('never coalesces or persists an unresolved context', async () => {
    const gate = deferred<void>();
    const fetchMock = vi.fn((url: string) => gate.promise.then(() => json(url, { results: [] })));
    vi.stubGlobal('fetch', fetchMock);
    const unknown = { ...context, cacheNamespace: null };
    const requests = [loader(unknown).loadRows([A]), loader(unknown).loadRows([A])];
    for (const pending of requests) pending.catch(() => undefined);
    try {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      gate.resolve();
    }
    await Promise.all(requests);
    await flush();
    expect((await cache.getRows([A])).size).toBe(0);
  });

  it.each(['network', '429', '503'])(
    'rejects all waiters and permits retry after a failed owner: %s',
    async (kind) => {
      const gate = deferred<void>();
      const fetchMock = vi.fn<(url: string) => Promise<Response>>(() =>
        gate.promise.then(() =>
          kind === 'network'
            ? Promise.reject(new Error('timeout'))
            : Promise.resolve(new Response(null, { status: Number(kind) })),
        ),
      );
      vi.stubGlobal('fetch', fetchMock);
      const requests = [loader().loadRows([A]), loader().loadRows([A])];
      for (const pending of requests) pending.catch(() => undefined);
      try {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      } finally {
        gate.resolve();
      }
      const results = await Promise.allSettled(requests);
      expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
      await flush();
      expect((await cache.getRows([A])).size).toBe(0);
      fetchMock.mockImplementation(async (url: string) => json(url, { results: [] }));
      expect((await loader().loadRows([A])).rows.get('Head:1')).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('shares a truncated result only while pending and persists none of its families', async () => {
    const gate = deferred<void>();
    const fetchMock = vi.fn((url: string) =>
      gate.promise.then(() => json(url, { results: [raw(A)], next: 'more' })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const requests = [loader().loadRows([A, B]), loader().loadRows([A, B])];
    for (const pending of requests) pending.catch(() => undefined);
    try {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      gate.resolve();
    }
    for (const result of await Promise.all(requests)) {
      expect(result.truncated).toBe(true);
      expect(result.rows.get('Head:1')?.[0].rowId).toBe(1);
      expect(result.rows.get('Body:2')).toEqual([]);
    }
    await flush();
    expect((await cache.getRows([A, B])).size).toBe(0);
    fetchMock.mockImplementation(async (url: string) => json(url, { results: [] }));
    await loader().loadRows([A, B]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caps pending keys at 256, preserves existing owners, and fetches overflow normally', async () => {
    const gate = deferred<void>();
    const fetchMock = vi.fn((url: string) => gate.promise.then(() => json(url, { results: [] })));
    vi.stubGlobal('fetch', fetchMock);
    const requests = Array.from({ length: 256 }, (_, i) =>
      loader().loadRows([{ field: 'Head', key: String(i + 1) }]),
    );
    for (const pending of requests) pending.catch(() => undefined);
    requests.push(loader().loadRows([A]));
    requests.push(loader().loadRows([{ field: 'Head', key: '999' }]));
    requests.push(loader().loadRows([{ field: 'Head', key: '999' }]));
    try {
      expect(fetchMock).toHaveBeenCalledTimes(258);
    } finally {
      gate.resolve();
    }
    expect((await Promise.all(requests)).every((result) => result.rows.size === 1)).toBe(true);
    await flush();
    fetchMock.mockImplementation(async (url: string) => json(url, { results: [] }));
    await loader().loadRows([A]);
    expect(fetchMock).toHaveBeenCalledTimes(259);
  });
  it.each(['network', '503'])(
    'clears failed Glasses work without caching a negative: %s',
    async (kind) => {
      const gate = deferred<void>();
      const fetchMock = vi.fn<(url: string) => Promise<Response>>(() =>
        gate.promise.then(() => {
          if (kind === 'network') throw new Error('timeout');
          return new Response(null, { status: 503 });
        }),
      );
      vi.stubGlobal('fetch', fetchMock);
      const requests = [loader().loadGlasses(3), loader().loadGlasses(3)];
      for (const request of requests) request.catch(() => undefined);
      try {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      } finally {
        gate.resolve();
      }
      expect((await Promise.allSettled(requests)).map((result) => result.status)).toEqual([
        'rejected',
        'rejected',
      ]);
      await flush();
      expect(await cache.getGlasses(3)).toBeUndefined();
      fetchMock.mockImplementation(async (url) =>
        json(url, { row_id: 3, fields: { Name: 'Recovered' } }),
      );
      expect((await loader().loadGlasses(3)).row?.names.en).toBe('Recovered');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('an old overflow completion cannot remove a newer pending Glasses owner', async () => {
    const fillGate = deferred<void>();
    const oldGate = deferred<void>();
    const newGate = deferred<void>();
    let glassesCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (!url.includes('/Glasses/')) {
        await fillGate.promise;
        return json(url, { results: [] });
      }
      const call = ++glassesCalls;
      await (call === 1 ? oldGate.promise : newGate.promise);
      return json(url, { row_id: 999, fields: { Name: call === 1 ? 'Old' : 'New' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const filling = Array.from({ length: 256 }, (_, i) =>
      loader().loadRows([{ field: 'Head', key: String(i + 1) }]),
    );
    const old = loader().loadGlasses(999);
    try {
      expect(fetchMock).toHaveBeenCalledTimes(257);
      fillGate.resolve();
      await Promise.all(filling);
      await Promise.resolve();
      const fresh = loader().loadGlasses(999);
      expect(glassesCalls).toBe(2);
      oldGate.resolve();
      expect((await old).row?.names.en).toBe('Old');
      const waiter = loader().loadGlasses(999);
      expect(glassesCalls).toBe(2);
      newGate.resolve();
      expect((await Promise.all([fresh, waiter])).map((result) => result.row?.names.en)).toEqual([
        'New',
        'New',
      ]);
    } finally {
      fillGate.resolve();
      oldGate.resolve();
      newGate.resolve();
      await Promise.allSettled([...filling, old]);
    }
  });
});
