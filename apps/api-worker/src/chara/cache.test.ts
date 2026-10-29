import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharaRowCache } from './cache';
import { XivapiClient } from './xivapi';
import type { ItemRow, SlotLookup } from './types';
import { lookupKey } from './types';
import { createMockExecutionContext, resetAllMocks } from '../universalis/test-setup';

const version = 'aaaaaaaaaaaaaaaa';
const schema = 'exdschema@2:rev:' + 'a'.repeat(40);
const lookup: SlotLookup = { field: 'Head', key: '1' };
const row: ItemRow = {
  rowId: 10,
  names: { en: 'A', ja: '', de: '', fr: '' },
  iconId: null,
  modelMain: '1',
  modelSub: '0',
  slots: ['Head'],
  levelEquip: 1,
  uiCategory: 1,
  rules: null,
};
const flush = (ctx: ExecutionContext) =>
  (ctx as unknown as { _waitForAll(): Promise<unknown> })._waitForAll();

describe('verified row-cache partitions', () => {
  beforeEach(resetAllMocks);
  afterEach(() => vi.unstubAllGlobals());

  it('isolates row families and cached Glasses null by base and schema, including old keys', async () => {
    const ctx = createMockExecutionContext();
    const namespaces = await Promise.all(
      [
        { XIVAPI_BASE: 'https://cache-a.test', XIVAPI_SCHEMA: schema },
        { XIVAPI_BASE: 'https://cache-b.test', XIVAPI_SCHEMA: schema },
        { XIVAPI_BASE: 'https://cache-a.test', XIVAPI_SCHEMA: 'exdschema@2:rev:' + 'b'.repeat(40) },
      ].map(
        async (env) =>
          (await new XivapiClient({ ...env, XIVAPI_VERSION: version }).resolveContext())
            .cacheNamespace!,
      ),
    );
    const first = new CharaRowCache(ctx, namespaces[0]);
    first.storeRows(lookup, [row]);
    first.storeGlasses(3, null);
    await flush(ctx);
    expect((await first.getRows([lookup])).get(lookupKey(lookup))).toEqual([row]);
    expect(await first.getGlasses(3)).toBeNull();
    for (const namespace of [...namespaces.slice(1), version]) {
      const other = new CharaRowCache(ctx, namespace);
      expect((await other.getRows([lookup])).size).toBe(0);
      expect(await other.getGlasses(3)).toBeUndefined();
    }
  });

  it('caches complete empty families and treats corrupt entries as misses', async () => {
    const ctx = createMockExecutionContext();
    const cache = new CharaRowCache(ctx, 'verified-identity');
    cache.storeRows(lookup, []);
    await flush(ctx);
    expect((await cache.getRows([lookup])).has(lookupKey(lookup))).toBe(true);
    const edge = await caches.open('chara-resolve');
    vi.spyOn(edge, 'match').mockResolvedValue(new Response('not-json'));
    expect((await cache.getRows([lookup])).size).toBe(0);
    expect(await cache.getGlasses(3)).toBeUndefined();
  });
});


it('excludes literal shape-5 Item and Glasses entries', async () => {
  resetAllMocks();
  const ctx = createMockExecutionContext();
  const cache = new CharaRowCache(ctx, 'old-shape');
  const edge = await caches.open('chara-resolve');
  const match = vi.spyOn(edge, 'match').mockImplementation(async (request) => {
    const key = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
    return decodeURIComponent(key).includes('chara:5:old-shape:') ? new Response(JSON.stringify([row]), { headers: { 'X-Cached-At': String(Date.now()), 'X-Cache-TTL': '604800', 'X-SWR-Window': '86400' } }) : undefined;
  });
  expect((await cache.getRows([lookup])).size).toBe(0);
  expect(await cache.getGlasses(3)).toBeUndefined();
  expect(match).toHaveBeenCalledTimes(2);
  match.mockRestore();
});
