import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharaIconCache } from './icon-cache';
import { resetAllMocks } from '../universalis/test-setup';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const context = { base: 'https://icons.test', version: 'aaaaaaaaaaaaaaaa', cacheable: true };

describe('retained binary icon cache', () => {
  let now: number;
  beforeEach(() => {
    resetAllMocks();
    now = 100 * 86400000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retains independent validated bytes and validators, partitioned by base/version/id', async () => {
    const cache = new CharaIconCache();
    await cache.put(context, 1, { bytes: PNG, etag: '"one"', cachedAt: now });
    const one = await cache.get(context, 1);
    expect(one).toEqual({ bytes: PNG, etag: '"one"', cachedAt: now });
    one!.bytes[8] = 99;
    expect((await cache.get(context, 1))!.bytes[8]).toBe(1);
    expect(await cache.get({ ...context, base: 'https://other.test' }, 1)).toBeNull();
    expect(await cache.get({ ...context, version: 'bbbbbbbbbbbbbbbb' }, 1)).toBeNull();
    expect(await cache.get(context, 2)).toBeNull();
    now += 30 * 86400000;
    expect(await cache.get(context, 1)).toBeNull();
  });

  it('never touches storage for an unresolved asset context', async () => {
    const open = vi.spyOn(caches, 'open');
    const cache = new CharaIconCache();
    const unresolved = { ...context, cacheable: false };
    await cache.put(unresolved, 1, { bytes: PNG, etag: null, cachedAt: now });
    expect(await cache.get(unresolved, 1)).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('works with no Cache API and tolerates read/write failures', async () => {
    const cache = new CharaIconCache();
    vi.stubGlobal('caches', undefined);
    expect(await cache.get(context, 1)).toBeNull();
    await expect(
      cache.put(context, 1, { bytes: PNG, etag: null, cachedAt: now }),
    ).resolves.toBeUndefined();
    vi.unstubAllGlobals();
    vi.spyOn(caches, 'open').mockRejectedValue(new Error('storage unavailable'));
    expect(await cache.get(context, 1)).toBeNull();
    await expect(
      cache.put(context, 1, { bytes: PNG, etag: null, cachedAt: now }),
    ).resolves.toBeUndefined();
  });

  it.each(['missing', 'NaN', 'future', 'expired', 'non-png', 'oversized'])(
    'treats corrupt or unusable entries as misses: %s',
    async (kind) => {
      const edge = await caches.open('chara-icons');
      const headers = new Headers();
      if (kind !== 'missing')
        headers.set(
          'X-Cached-At',
          kind === 'NaN'
            ? 'garbage'
            : String(kind === 'future' ? now + 1 : kind === 'expired' ? now - 30 * 86400000 : now),
        );
      const bytes =
        kind === 'oversized'
          ? new Uint8Array(1024 * 1024 + 1)
          : kind === 'non-png'
            ? new Uint8Array([1])
            : PNG;
      vi.spyOn(edge, 'match').mockResolvedValue(new Response(bytes, { headers }));
      expect(await new CharaIconCache().get(context, 1)).toBeNull();
    },
  );
});
