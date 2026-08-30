/**
 * Client for api-worker's POST /v1/chara/resolve — request shape, envelope
 * handling, session cache, and the "unavailable" contract the glamour block
 * relies on (any failure is one error type, never a thrown envelope).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveCharaEquipment,
  clearCharaResolveCache,
  charaIconUrl,
  itemNameFor,
  CharaResolveUnavailableError,
} from '../chara-resolve-service';
import { getApiWorkerBase } from '../api-worker-origin';

const GEAR = [
  { slot: 'HeadGear' as const, base: 361, variant: 5 },
  { slot: 'MainHand' as const, set: 634, base: 19, variant: 1 },
];

const envelope = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: status === 200, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('chara-resolve-service', () => {
  beforeEach(() => clearCharaResolveCache());
  afterEach(() => vi.unstubAllGlobals());

  it('posts the model keys (and glasses only when set) to /v1/chara/resolve', async () => {
    // A fresh Response per call — a body can only be read once.
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          envelope({ items: { HeadGear: null, MainHand: null }, glasses: null, version: 'v' })
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveCharaEquipment(GEAR, null);
    expect(result).toEqual({
      items: { HeadGear: null, MainHand: null },
      glasses: null,
      version: 'v',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${getApiWorkerBase()}/v1/chara/resolve`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ gear: GEAR });

    clearCharaResolveCache();
    await resolveCharaEquipment(GEAR, 40);
    expect(
      JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string)
    ).toEqual({
      gear: GEAR,
      glasses: 40,
    });
  });

  it('serves the same file from the session cache — one request per signature', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(envelope({ items: {}, glasses: null, version: null }))
      );
    vi.stubGlobal('fetch', fetchMock);
    await resolveCharaEquipment(GEAR, null);
    // Same pieces in a different order is the same glamour.
    await resolveCharaEquipment([...GEAR].reverse(), null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Different facewear is a different request.
    await resolveCharaEquipment(GEAR, 40);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with CharaResolveUnavailableError on a non-2xx, a network error, or a malformed envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelope({}, 503)));
    const down = await resolveCharaEquipment(GEAR, null).catch((e: unknown) => e);
    expect(down).toBeInstanceOf(CharaResolveUnavailableError);
    expect((down as CharaResolveUnavailableError).status).toBe(503);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(resolveCharaEquipment(GEAR, null)).rejects.toBeInstanceOf(
      CharaResolveUnavailableError
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"success":true}', { status: 200 }))
    );
    await expect(resolveCharaEquipment(GEAR, null)).rejects.toBeInstanceOf(
      CharaResolveUnavailableError
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));
    await expect(resolveCharaEquipment(GEAR, null)).rejects.toBeInstanceOf(
      CharaResolveUnavailableError
    );
  });

  it('does not cache a failure — the next import retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelope({}, 503))
      .mockResolvedValueOnce(envelope({ items: { HeadGear: null }, glasses: null, version: 'v' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveCharaEquipment(GEAR, null)).rejects.toBeInstanceOf(
      CharaResolveUnavailableError
    );
    expect((await resolveCharaEquipment(GEAR, null)).version).toBe('v');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('propagates the caller abort untouched', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            );
          })
      )
    );
    const pending = resolveCharaEquipment(GEAR, null, controller.signal);
    controller.abort();
    const err = await pending.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe('AbortError');
  });

  it('builds icon URLs on the api-worker origin and picks names with EN fallback', () => {
    expect(charaIconUrl(41716)).toBe(`${getApiWorkerBase()}/v1/chara/icon/41716`);
    const names = {
      en: 'Beech Mask of Casting',
      ja: 'ビーチキャスターマスク',
      de: 'Buchenmaske der Magie',
      fr: 'Masque',
      ko: '너도밤나무 마술사 가면',
    };
    expect(itemNameFor(names, 'ja')).toBe('ビーチキャスターマスク');
    expect(itemNameFor(names, 'ko')).toBe('너도밤나무 마술사 가면');
    expect(itemNameFor(names, 'zh')).toBe('Beech Mask of Casting');
    expect(itemNameFor({ ...names, de: '' }, 'de')).toBe('Beech Mask of Casting');
  });
});
