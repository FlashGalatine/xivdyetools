import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharaIconCache } from './icon-cache';
import { loadIcon } from './icons';
import { XivapiClient } from './xivapi';
import { resetAllMocks } from '../universalis/test-setup';

const DAY = 86400000;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const context = { base: 'https://icon-refresh.test', version: 'aaaaaaaaaaaaaaaa', cacheable: true };

describe('retained icon refresh', () => {
  let now: number;
  let cache: CharaIconCache;
  let client: XivapiClient;
  beforeEach(() => {
    resetAllMocks();
    now = 100 * DAY;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    cache = new CharaIconCache();
    client = new XivapiClient({ XIVAPI_BASE: context.base, XIVAPI_VERSION: context.version });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const png = (etag = '"new"') => new Response(PNG, { headers: { ETag: etag } });
  async function seed(age: number, etag: string | null = '"old"') {
    await cache.put(context, 1, { bytes: PNG, etag, cachedAt: now - age });
  }

  it('serves a fresh retained PNG without touching upstream or rewriting freshness', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await seed(7 * DAY - 1);
    const result = await loadIcon(client, context, 1, cache);
    expect(result).toEqual({ bytes: PNG, cacheStatus: 'HIT', cacheUpdate: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'revalidates at exactly seven days and reuses bytes after 304 (new validator: %s)',
    async (newValidator) => {
      await seed(7 * DAY);
      const fetchMock = vi.fn(async (_raw: string, init: RequestInit) => {
        expect((init.headers as Record<string, string>)['If-None-Match']).toBe('"old"');
        return new Response(null, { status: 304, headers: newValidator ? { ETag: '"new"' } : {} });
      });
      vi.stubGlobal('fetch', fetchMock);
      const result = await loadIcon(client, context, 1, cache);
      expect(result.bytes).toEqual(PNG);
      expect(result.cacheStatus).toBe('MISS');
      expect(result.cacheUpdate).toEqual({
        bytes: PNG,
        etag: newValidator ? '"new"' : '"old"',
        cachedAt: now,
      });
      await cache.put(context, 1, result.cacheUpdate!);
      now++;
      expect((await loadIcon(client, context, 1, cache)).cacheStatus).toBe('HIT');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('accepts a changed 200 only after validating its PNG and records the new validator', async () => {
    await seed(7 * DAY);
    const changed = new Uint8Array(PNG);
    changed[8] = 2;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(changed, { headers: { ETag: '"changed"' } })),
    );
    const result = await loadIcon(client, context, 1, cache);
    expect(result.bytes).toEqual(changed);
    expect(result.cacheUpdate).toEqual({ bytes: changed, etag: '"changed"', cachedAt: now });
  });

  it.each(['missing-validator', 'retention-expired', 'corrupt-body'])(
    'fetches unconditionally without a usable validator: %s',
    async (kind) => {
      await seed(
        kind === 'retention-expired' ? 30 * DAY : 7 * DAY,
        kind === 'missing-validator' ? null : '"old"',
      );
      if (kind === 'corrupt-body') {
        const edge = await caches.open('chara-icons');
        vi.spyOn(edge, 'match').mockResolvedValue(
          new Response('corrupt', {
            headers: { 'X-Cached-At': String(now - 7 * DAY), 'X-Origin-ETag': '"old"' },
          }),
        );
      }
      const fetchMock = vi.fn(async (_raw: string, init: RequestInit) => {
        expect((init.headers as Record<string, string>)['If-None-Match']).toBeUndefined();
        return png();
      });
      vi.stubGlobal('fetch', fetchMock);
      expect((await loadIcon(client, context, 1, cache)).bytes).toEqual(PNG);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('refuses an unsolicited 304 without inventing bytes or retrying', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 304 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadIcon(client, context, 1, cache)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await cache.get(context, 1)).toBeNull();
  });

  it.each(['non-png', 'oversized', '404', '429', '503', 'redirect', 'timeout'])(
    'failed refresh does not replace bytes or advance their timestamp: %s',
    async (kind) => {
      await seed(7 * DAY);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          if (kind === 'timeout') throw new Error('aborted');
          if (kind === 'non-png') return new Response('html', { headers: { ETag: '"bad"' } });
          if (kind === 'oversized') return new Response(new Uint8Array(1024 * 1024 + 1));
          return new Response(null, { status: kind === 'redirect' ? 302 : Number(kind) });
        }),
      );
      await expect(loadIcon(client, context, 1, cache)).rejects.toThrow();
      expect(await cache.get(context, 1)).toEqual({
        bytes: PNG,
        etag: '"old"',
        cachedAt: now - 7 * DAY,
      });
    },
  );

  it('never offers a shared update for an unverified asset context', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => png()),
    );
    const result = await loadIcon(client, { ...context, cacheable: false }, 1, cache);
    expect(result.bytes).toEqual(PNG);
    expect(result.cacheUpdate).toBeNull();
  });
});
