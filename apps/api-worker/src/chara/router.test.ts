/**
 * `/v1/chara/*` through the real app (middleware chain, envelope, error
 * handler). Upstream XIVAPI is a stubbed `fetch`; the Cache API is the
 * universalis test-setup mock so the per-key cache is exercised for real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app from '../index';
import { createMockEnv } from '../../tests/test-utils';
import { resetAllMocks, createMockExecutionContext } from '../universalis/test-setup';
import { parseResolveBody } from './router';

const env = createMockEnv({ XIVAPI_BASE: 'https://xivapi.test', XIVAPI_VERSION: 'latest' });

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const BEECH_MASK = {
  row_id: 18085,
  fields: {
    Name: 'Beech Mask of Casting',
    'Name@ja': 'ビーチキャスターマスク',
    'Name@de': 'Buchenmaske der Magie',
    'Name@fr': "Masque d'incantateur en hêtre",
    Icon: { id: 41716 },
    ModelMain: 328041,
    ModelSub: 0,
    EquipSlotCategory: { fields: { Head: 1 } },
  },
};
const RUNAWAY_BOW = {
  row_id: 49486,
  fields: {
    Name: 'Runaway Bow',
    'Name@ja': '逃走の弓',
    'Name@de': 'Geistergleis-Bogen',
    'Name@fr': 'Arc de Glasya-Labolas',
    Icon: { id: 32065 },
    ModelMain: 4296213114,
    ModelSub: 4304732858,
    EquipSlotCategory: { fields: { MainHand: 1 } },
  },
};

const GALATINE_BODY = {
  gear: [
    { slot: 'HeadGear', base: 361, variant: 5 },
    { slot: 'MainHand', set: 634, base: 19, variant: 1 },
    { slot: 'OffHand', set: 698, base: 149, variant: 1 },
    { slot: 'Body', base: 9903, variant: 1 },
  ],
};

function post(body: unknown, ctx = createMockExecutionContext()) {
  return app.request(
    '/v1/chara/resolve',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    env,
    ctx,
  );
}

describe('POST /v1/chara/resolve', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('resolves a file in one upstream search, applies the off-hand rule, nulls unknown keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ version: '284bb7f44b9c0976', results: [BEECH_MASK, RUNAWAY_BOW] }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await post(GALATINE_BODY);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.version).toBe('284bb7f44b9c0976');
    expect(body.data.items.HeadGear).toMatchObject({
      itemId: 18085,
      names: { en: 'Beech Mask of Casting', de: 'Buchenmaske der Magie', ko: '너도밤나무 마술사 가면', zh: '山毛榉咏咒面具' },
      iconId: 41716,
      familySize: 1,
      alternates: [],
      viaMainHand: false,
    });
    expect(body.data.items.MainHand.itemId).toBe(49486);
    expect(body.data.items.OffHand).toMatchObject({ itemId: 49486, viaMainHand: true });
    expect(body.data.items.Body).toBeNull();
    expect(body.data.glasses).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('query')).toContain('(+EquipSlotCategory.OffHand=1 +ModelMain=4304732858)');
  });

  it('replays cached keys — the second identical import makes no upstream call', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ version: 'v', results: [BEECH_MASK, RUNAWAY_BOW] }));
    vi.stubGlobal('fetch', fetchMock);

    const ctx = createMockExecutionContext();
    await post(GALATINE_BODY, ctx);
    await (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();

    const second = await post(GALATINE_BODY);
    expect(second.status).toBe(200);
    expect(second.headers.get('X-Cache')).toBe('HIT');
    const body = (await second.json()) as any;
    expect(body.data.items.HeadGear.itemId).toBe(18085);
    expect(body.data.items.Body).toBeNull(); // the empty answer was cached too
    expect(body.data.version).toBeNull(); // served entirely from cache
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves facewear by Glasses row alongside the gear', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        url.includes('/api/sheet/Glasses/40')
          ? Promise.resolve(okJson({ row_id: 40, version: 'v', fields: { Name: 'Black Rose-colored Spectacles', 'Name@ja': 'ローズ', 'Name@de': 'Brille', 'Name@fr': 'Lunettes', Icon: { id: 200018 } } }))
          : Promise.resolve(okJson({ version: 'v', results: [BEECH_MASK] })),
      );
    vi.stubGlobal('fetch', fetchMock);

    const res = await post({ gear: [{ slot: 'HeadGear', base: 361, variant: 5 }], glasses: 40 });
    const body = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(body.data.glasses).toEqual({ id: 40, names: { en: 'Black Rose-colored Spectacles', ja: 'ローズ', de: 'Brille', fr: 'Lunettes' }, iconId: 200018 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('answers an empty gear list without touching upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await post({ gear: [] });
    expect(res.status).toBe(200);
    expect((await res.json() as any).data).toEqual({ version: null, items: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an upstream 503 (search re-indexing) to 503 UPSTREAM_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));
    const res = await post(GALATINE_BODY);
    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe('UPSTREAM_UNAVAILABLE');
    expect(body.details).toEqual({ upstreamStatus: 503 });
  });

  it('rejects a body that is not JSON / not an object / not a gear array', async () => {
    expect((await post('{not json')).status).toBe(400);
    expect(((await (await post('{not json')).json()) as any).error).toBe('INVALID_BODY');
    expect((await post([1, 2])).status).toBe(400);
    const noGear = await post({ glasses: 40 });
    expect(noGear.status).toBe(400);
    expect(((await noGear.json()) as any).error).toBe('VALIDATION_ERROR');
  });

  it('names the offending field on a bad slot, lane, duplicate or empty piece', async () => {
    const cases: Array<[unknown, RegExp]> = [
      [{ gear: [{ slot: 'Tail', base: 1, variant: 1 }] }, /gear\[0\]\.slot must be one of/],
      [{ gear: [{ slot: 'Body', base: 70000, variant: 1 }] }, /gear\[0\]\.base must be an integer between 0 and 65535/],
      [{ gear: [{ slot: 'Body', base: 1, variant: -1 }] }, /gear\[0\]\.variant/],
      [{ gear: [{ slot: 'Body', variant: 1 }] }, /gear\[0\]\.base is required/],
      [{ gear: [{ slot: 'Body', base: 1, variant: 1 }, { slot: 'Body', base: 2, variant: 1 }] }, /appears twice/],
      [{ gear: [{ slot: 'Body', base: 0, variant: 1 }] }, /empty slot/],
      [{ gear: [], glasses: 'forty' }, /`glasses` must be a Glasses sheet row id/],
      [{ gear: Array.from({ length: 13 }, (_, i) => ({ slot: 'Body', base: i + 1, variant: 0 })) }, /13 entries/],
    ];
    for (const [body, message] of cases) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).message).toMatch(message);
    }
  });

  it('parseResolveBody normalises weapon vs gear shapes and drops glasses 0', () => {
    expect(
      parseResolveBody({ gear: [{ slot: 'MainHand', base: 19, variant: 1 }, { slot: 'Feet', base: 376 }], glasses: 0 }),
    ).toEqual({
      gear: [
        { slot: 'MainHand', set: 0, base: 19, variant: 1 },
        { slot: 'Feet', base: 376, variant: 0 },
      ],
    });
  });
});

describe('GET /v1/chara/icon/:iconId', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  const png = () =>
    new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Content-Length': '4' },
    });

  it('proxies the icon PNG with a long immutable cache header and edge-caches it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(png());
    vi.stubGlobal('fetch', fetchMock);
    const ctx = createMockExecutionContext();

    const res = await app.request('/v1/chara/icon/41716', { method: 'GET' }, env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=2592000, immutable');
    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    const upstream = new URL(fetchMock.mock.calls[0][0] as string);
    expect(upstream.searchParams.get('path')).toBe('ui/icon/041000/041716_hr1.tex');

    await (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();
    const again = await app.request('/v1/chara/icon/41716?cb=1', { method: 'GET' }, env, createMockExecutionContext());
    expect(again.status).toBe(200);
    expect(again.headers.get('X-Cache')).toBe('HIT');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-integer or out-of-range id before any upstream call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await app.request('/v1/chara/icon/abc', {}, env, createMockExecutionContext())).status).toBe(400);
    expect((await app.request('/v1/chara/icon/0', {}, env, createMockExecutionContext())).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an upstream 404 to NOT_FOUND and a 5xx to UPSTREAM_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));
    const missing = await app.request('/v1/chara/icon/999998', {}, env, createMockExecutionContext());
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as any).error).toBe('NOT_FOUND');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('down', { status: 502 })));
    const down = await app.request('/v1/chara/icon/999997', {}, env, createMockExecutionContext());
    expect(down.status).toBe(503);
    expect(((await down.json()) as any).error).toBe('UPSTREAM_UNAVAILABLE');
  });
});

describe('CORS', () => {
  it('preflight allows POST for the resolve endpoint', async () => {
    const res = await app.request(
      '/v1/chara/resolve',
      { method: 'OPTIONS', headers: { Origin: 'https://xivdyetools.app', 'Access-Control-Request-Method': 'POST' } },
      env,
      createMockExecutionContext(),
    );
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
