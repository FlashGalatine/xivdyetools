/**
 * `/v1/chara/*` through the real app (middleware chain, envelope, error
 * handler). Upstream XIVAPI is a stubbed `fetch`; the Cache API is the
 * universalis test-setup mock so the per-key cache is exercised for real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app from '../index';
import { Hono } from 'hono';
import { ApiError } from '../lib/api-error';
import { createApiRateLimitMiddleware } from '../middleware/rate-limit';
import type { Env } from '../types';
import { createMockEnv } from '../../tests/test-utils';
import { resetAllMocks, createMockExecutionContext } from '../universalis/test-setup';
import { charaRouter, parseResolveBody } from './router';
import { CharaLookupLoader } from './lookup-loader';

// A real version key is its own cache namespace, so these tests stay about
// resolution. The moving `latest` alias has its own block at the bottom (BUG-040).
const V = 'aaaaaaaaaaaaaaaa';
const S = 'exdschema@2:rev:' + 'a'.repeat(40);
const env = createMockEnv({
  XIVAPI_BASE: 'https://xivapi.test',
  XIVAPI_VERSION: V,
  XIVAPI_SCHEMA: S,
});

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify({ version: V, schema: S, ...(body as object) }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

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

/**
 * A pull-counted stream: `chunks` × `chunk`, and `pulls` tells how many the
 * consumer actually took before it stopped reading (cancel / completion).
 */
function countedStream(chunk: Uint8Array, chunks: number) {
  const counter = { pulls: 0 };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (counter.pulls >= chunks) {
        controller.close();
        return;
      }
      counter.pulls++;
      controller.enqueue(chunk);
    },
  });
  return { stream, counter };
}

const flush = (ctx: ExecutionContext) =>
  (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();

describe('POST /v1/chara/resolve', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('replaces retired rows on fresh and cached imports using the exact model family', async () => {
    const result = (row_id: number, Name: string, LevelEquip: number) => ({
      row_id,
      fields: {
        Name,
        LevelEquip,
        ModelMain: 65540,
        ModelSub: 0,
        EquipSlotCategory: { fields: { Head: 1 } },
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      okJson({
        version: V,
        results: [
          result(372, 'Dated Hempen Coif', 1),
          result(2629, 'Hempen Coif', 1),
          result(2630, 'Hempen Coif of Gathering', 1),
          result(10, 'Aetherial Test Coif', 50),
          result(11, 'Deepmist Test Coif', 60),
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const body = { gear: [{ slot: 'HeadGear', base: 4, variant: 1 }] };
    const ctx = createMockExecutionContext();
    const fresh = await post(body, ctx);
    expect(fresh.status).toBe(200);
    await flush(ctx);
    const cached = await post(body);
    expect(cached.headers.get('X-Cache')).toBe('HIT');
    for (const response of [fresh, cached]) {
      const payload = (await response.json()) as any;
      expect(payload.data.items.HeadGear).toMatchObject({
        itemId: 2629,
        names: { en: 'Hempen Coif' },
        familySize: 2,
        alternates: [{ itemId: 2630, names: { en: 'Hempen Coif of Gathering' } }],
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('fields')).toContain('LevelEquip');
    const again = (await (await post(body)).json()) as any;
    expect(again.data.items.HeadGear).not.toHaveProperty('retired');
  });

  it('names an all-retired family flagged retired, fresh and cached, instead of null', async () => {
    // 2026-10-09 merge-day review: the cache keeps raw rows, so the fallback
    // is decided at resolve time and a replay answers the same as upstream.
    const result = (row_id: number, Name: string, LevelEquip: number) => ({
      row_id,
      fields: {
        Name,
        LevelEquip,
        ModelMain: 65540,
        ModelSub: 0,
        EquipSlotCategory: { fields: { Head: 1 } },
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      okJson({
        version: V,
        results: [result(372, 'Dated Hempen Coif', 1), result(10, 'Aetherial Test Coif', 50)],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const body = { gear: [{ slot: 'HeadGear', base: 4, variant: 1 }] };
    const ctx = createMockExecutionContext();
    const fresh = await post(body, ctx);
    await flush(ctx);
    const cached = await post(body);
    expect(cached.headers.get('X-Cache')).toBe('HIT');
    for (const response of [fresh, cached]) {
      const payload = (await response.json()) as any;
      expect(payload.data.items.HeadGear).toMatchObject({
        itemId: 10,
        names: { en: 'Aetherial Test Coif' },
        familySize: 2,
        alternates: [{ itemId: 372, names: { en: 'Dated Hempen Coif' } }],
        retired: true,
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves a file in one upstream search, applies the off-hand rule, nulls unknown keys', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okJson({ version: V, results: [BEECH_MASK, RUNAWAY_BOW] }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await post(GALATINE_BODY);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.version).toBe(V);
    expect(body.data.items.HeadGear).toMatchObject({
      itemId: 18085,
      names: {
        en: 'Beech Mask of Casting',
        de: 'Buchenmaske der Magie',
        ko: '너도밤나무 마술사 가면',
        zh: '山毛榉咏咒面具',
      },
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
    expect(url.searchParams.get('query')).toContain(
      '(+EquipSlotCategory.OffHand=1 +ModelMain=4304732858)',
    );
  });

  it("carries each item's acquisition line from the build-time table, fresh or cached, and omits it when the table has none", async () => {
    // Body {9903, 1} packs to ModelMain 75439; row 2 is not equippable, so the table has no line for it.
    const UNLISTED_BODY = {
      row_id: 2,
      fields: {
        Name: 'Unlisted Body',
        Icon: { id: 1 },
        ModelMain: 75439,
        ModelSub: 0,
        EquipSlotCategory: { fields: { Body: 1 } },
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okJson({ version: V, results: [BEECH_MASK, RUNAWAY_BOW, UNLISTED_BODY] }));
    vi.stubGlobal('fetch', fetchMock);

    const ctx = createMockExecutionContext();
    const fresh = await post(GALATINE_BODY, ctx);
    await flush(ctx);
    const cached = await post(GALATINE_BODY);
    expect(fresh.headers.get('X-Cache')).toBe('MISS');
    expect(cached.headers.get('X-Cache')).toBe('HIT');
    for (const res of [fresh, cached]) {
      const { items } = ((await res.json()) as any).data;
      expect(items.HeadGear.acquisition).toBe(
        'Crafted (CRP Lvl. 61) / Norlaise - Ishgard - The Pillars (19,994 Gil)',
      );
      expect(items.MainHand.acquisition).toBe('Hell on Rails (Extreme)');
      expect(items.OffHand.acquisition).toBe('Hell on Rails (Extreme)');
      expect(items.Body.itemId).toBe(2);
      expect(items.Body).not.toHaveProperty('acquisition');
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('replays cached keys — the second identical import makes no upstream call', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okJson({ version: V, results: [BEECH_MASK, RUNAWAY_BOW] }));
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

  it('answers the in-game rules, and a cache replay keeps them', async () => {
    const everyone = {
      Hyur: true,
      Elezen: true,
      Lalafell: true,
      Miqote: true,
      Roegadyn: true,
      AuRa: true,
      Hrothgar: true,
      Viera: true,
      Male: true,
      Female: true,
    };
    const mask = {
      ...BEECH_MASK,
      fields: {
        ...BEECH_MASK.fields,
        DyeCount: 1,
        IsGlamorous: true,
        EquipRestriction: { fields: everyone },
        GrandCompany: { value: 0, row_id: 0 },
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ version: V, results: [mask] })));
    const expected = [
      { itemIds: [18085], dyeCount: 1, glamourable: true, wearMask: 0xffff, grandCompany: 0 },
    ];

    const ctx = createMockExecutionContext();
    const first = (await (
      await post({ gear: [{ slot: 'HeadGear', base: 361, variant: 5 }] }, ctx)
    ).json()) as any;
    expect(first.data.items.HeadGear.rules).toEqual(expected);
    await flush(ctx);

    const replay = await post({ gear: [{ slot: 'HeadGear', base: 361, variant: 5 }] });
    expect(replay.headers.get('X-Cache')).toBe('HIT');
    expect(((await replay.json()) as any).data.items.HeadGear.rules).toEqual(expected);
  });

  it('resolves facewear by Glasses row alongside the gear', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      url.includes('/api/sheet/Glasses/40')
        ? Promise.resolve(
            okJson({
              row_id: 40,
              version: V,
              fields: {
                Name: 'Black Rose-colored Spectacles',
                'Name@ja': 'ローズ',
                'Name@de': 'Brille',
                'Name@fr': 'Lunettes',
                Icon: { id: 200018 },
              },
            }),
          )
        : Promise.resolve(okJson({ version: V, results: [BEECH_MASK] })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await post({ gear: [{ slot: 'HeadGear', base: 361, variant: 5 }], glasses: 40 });
    const body = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(body.data.glasses).toEqual({
      id: 40,
      names: { en: 'Black Rose-colored Spectacles', ja: 'ローズ', de: 'Brille', fr: 'Lunettes' },
      iconId: 200018,
      acquisition: 'Mount Rokkon',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('answers an empty gear list without touching upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await post({ gear: [] });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).data).toEqual({ version: null, items: {} });
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
      [
        { gear: [{ slot: 'Body', base: 70000, variant: 1 }] },
        /gear\[0\]\.base must be an integer between 0 and 65535/,
      ],
      [{ gear: [{ slot: 'Body', base: 1, variant: -1 }] }, /gear\[0\]\.variant/],
      [{ gear: [{ slot: 'Body', variant: 1 }] }, /gear\[0\]\.base is required/],
      [
        {
          gear: [
            { slot: 'Body', base: 1, variant: 1 },
            { slot: 'Body', base: 2, variant: 1 },
          ],
        },
        /appears twice/,
      ],
      [{ gear: [{ slot: 'Body', base: 0, variant: 1 }] }, /empty slot/],
      [{ gear: [], glasses: 'forty' }, /`glasses` must be a Glasses sheet row id/],
      [
        { gear: Array.from({ length: 13 }, (_, i) => ({ slot: 'Body', base: i + 1, variant: 0 })) },
        /13 entries/,
      ],
    ];
    for (const [body, message] of cases) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).message).toMatch(message);
    }
  });

  // FINDING-025 / API-2: the 8 KB cap is enforced while the body streams in —
  // a chunked POST with no Content-Length must be cut off, not buffered whole.
  it('stops reading a chunked body once it passes 8 KB instead of buffering it (API-2)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { stream, counter } = countedStream(new Uint8Array(1024).fill(0x61), 100); // 100 KB of "a"
    const req = new Request('http://localhost/v1/chara/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stream,
      // Node needs the duplex hint for stream bodies; workers-types does not declare it
      duplex: 'half',
    } as RequestInit);
    const res = await app.request(req, undefined, env, createMockExecutionContext());
    expect(res.status).toBe(413);
    expect(((await res.json()) as any).error).toBe('INVALID_BODY');
    // 8 KB cap → ~9 chunks read before the reader is cancelled; never the whole 100
    expect(counter.pulls).toBeLessThan(20);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still rejects an honestly-declared oversized body up front', async () => {
    const res = await app.request(
      '/v1/chara/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': '9000' },
        body: '{}',
      },
      env,
      createMockExecutionContext(),
    );
    expect(res.status).toBe(413);
  });

  // FINDING-025 / API-3: a truncated XIVAPI page (next cursor / full 500-row
  // page) may be missing tail groups — those keys must not be cached as
  // "no item row" for a week.
  it('does not cache the misses of a truncated upstream page (API-3)', async () => {
    // a fresh Response per call — the second POST must reach upstream again
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(okJson({ version: V, results: [BEECH_MASK], next: 'cursor-page-2' })),
      );
    vi.stubGlobal('fetch', fetchMock);

    const ctx = createMockExecutionContext();
    const first = await post(GALATINE_BODY, ctx);
    expect(first.status).toBe(200);
    // the rows that did come back still answer this request
    expect(((await first.json()) as any).data.items.HeadGear.itemId).toBe(18085);
    await flush(ctx);

    const second = await post(GALATINE_BODY);
    expect(second.status).toBe(200);
    expect(second.headers.get('X-Cache')).toBe('MISS');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('parseResolveBody normalises weapon vs gear shapes and drops glasses 0', () => {
    expect(
      parseResolveBody({
        gear: [
          { slot: 'MainHand', base: 19, variant: 1 },
          { slot: 'Feet', base: 376 },
        ],
        glasses: 0,
      }),
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

  /** The 8-byte PNG signature plus a few bytes of "body". */
  const PNG_BYTES = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const png = (contentType = 'image/png') =>
    new Response(PNG_BYTES, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Content-Length': String(PNG_BYTES.byteLength) },
    });

  it('proxies an unversioned PNG with a short browser policy and shared edge storage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(png());
    vi.stubGlobal('fetch', fetchMock);
    const ctx = createMockExecutionContext();

    const res = await app.request('/v1/chara/icon/41716', { method: 'GET' }, env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300, must-revalidate');
    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_BYTES);
    const upstream = new URL(fetchMock.mock.calls[0][0] as string);
    expect(upstream.searchParams.get('path')).toBe('ui/icon/041000/041716_hr1.tex');

    await flush(ctx);
    const again = await app.request(
      '/v1/chara/icon/41716?cb=1',
      { method: 'GET' },
      env,
      createMockExecutionContext(),
    );
    expect(again.status).toBe(200);
    expect(again.headers.get('X-Cache')).toBe('HIT');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-integer or out-of-range id before any upstream call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (await app.request('/v1/chara/icon/abc', {}, env, createMockExecutionContext())).status,
    ).toBe(400);
    expect(
      (await app.request('/v1/chara/icon/0', {}, env, createMockExecutionContext())).status,
    ).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // FINDING-025 / API-4: lenient parseInt let `041716`, `41716abc`, `41716%20`
  // all resolve to icon 41716 under distinct edge-cache keys — one fresh
  // upstream fetch per alias. Only the canonical decimal form is accepted.
  it('rejects non-canonical spellings of an id (API-4)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(png());
    vi.stubGlobal('fetch', fetchMock);
    for (const alias of ['041716', '41716abc', '41716%20', '+41716', '41716.0', '0x41716']) {
      const res = await app.request(
        `/v1/chara/icon/${alias}`,
        {},
        env,
        createMockExecutionContext(),
      );
      expect(res.status, alias).toBe(400);
      expect(((await res.json()) as any).error, alias).toBe('VALIDATION_ERROR');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shares canonical icon data across query noise and request hostnames', async () => {
    const fetchMock = vi.fn().mockResolvedValue(png());
    vi.stubGlobal('fetch', fetchMock);
    const ctx = createMockExecutionContext();
    await app.request('/v1/chara/icon/41716?cb=1&x=2', {}, env, ctx);
    await flush(ctx);
    const again = await app.request(
      'https://internal/v1/chara/icon/41716?cb=3',
      {},
      env,
      createMockExecutionContext(),
    );
    expect(again.status).toBe(200);
    expect(again.headers.get('X-Cache')).toBe('HIT');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['', 'abc', 'AAAAAAAAAAAAAAAA', 'aaaa', 'aaaaaaaaaaaaaaag', V + '&version=' + V])(
    'rejects malformed or repeated icon versions before network access: %s',
    async (version) => {
      const fetchMock = vi.fn().mockResolvedValue(png());
      vi.stubGlobal('fetch', fetchMock);
      const result = await app.request(
        '/v1/chara/icon/41716?version=' + version,
        {},
        env,
        createMockExecutionContext(),
      );
      expect(result.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('pins icon assets and partitions bytes by version/base without metadata discovery', async () => {
    const requested: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (raw: string, init: RequestInit) => {
        requested.push(raw);
        expect(new URL(raw).pathname).toBe('/api/asset');
        expect((init.headers as Record<string, string>).Accept).toBe('image/png');
        const bytes = new Uint8Array(PNG_BYTES);
        bytes[bytes.length - 1] = requested.length;
        return new Response(bytes);
      }),
    );
    const get = async (version: string, upstream = 'https://xivapi.test') => {
      const ctx = createMockExecutionContext();
      const response = await app.request(
        '/v1/chara/icon/41716?version=' + version,
        {},
        createMockEnv({ XIVAPI_BASE: upstream, XIVAPI_VERSION: version }),
        ctx,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=2592000, immutable');
      for (const header of ['X-Cached-At', 'X-Origin-ETag', 'ETag'])
        expect(response.headers.get(header)).toBeNull();
      const bytes = new Uint8Array(await response.arrayBuffer());
      await flush(ctx);
      return bytes[bytes.length - 1];
    };
    expect(await get(V)).toBe(1);
    expect(await get('bbbbbbbbbbbbbbbb')).toBe(2);
    expect(await get(V, 'https://other.test')).toBe(3);
    expect(await get(V)).toBe(1);
    expect(requested.map((url) => new URL(url).searchParams.get('version'))).toEqual([
      V,
      'bbbbbbbbbbbbbbbb',
      V,
    ]);
  });

  // FINDING-025 / API-12: the proxy serves image/png or nothing — the
  // upstream's Content-Type is never reflected and a non-PNG body is refused
  // (and not cached) rather than stored for 30 days.
  it.each([false, true])(
    'returns independent HTTP 200 PNG bodies after a conditional 304 (versioned: %s)',
    async (versioned) => {
      let now = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => now);
      let calls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: string, init: RequestInit) => {
          calls++;
          if (calls === 1) return new Response(PNG_BYTES, { headers: { ETag: '"initial"' } });
          expect((init.headers as Record<string, string>)['If-None-Match']).toBe('"initial"');
          return new Response(null, { status: 304 });
        }),
      );
      const path = '/v1/chara/icon/41716' + (versioned ? '?version=' + V : '');
      const firstCtx = createMockExecutionContext();
      await app.request(path, {}, env, firstCtx);
      await flush(firstCtx);
      now += 7 * 86400000;
      const refreshCtx = createMockExecutionContext();
      const refreshed = await app.request(path, {}, env, refreshCtx);
      await flush(refreshCtx);
      const cached = await app.request(path, {}, env, createMockExecutionContext());
      for (const response of [refreshed, cached]) {
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe(
          versioned ? 'public, max-age=2592000, immutable' : 'public, max-age=300, must-revalidate',
        );
        expect(response.headers.get('ETag')).toBeNull();
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
      }
      expect(calls).toBe(2);
    },
  );

  it('pins Content-Type to image/png and sandboxes the response (API-12)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(png('application/octet-stream')));
    const res = await app.request('/v1/chara/icon/41717', {}, env, createMockExecutionContext());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Disposition')).toBe('inline');
    expect(res.headers.get('Content-Security-Policy')).toBe('sandbox');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('refuses a 2xx upstream body that is not a PNG and does not cache it (API-12)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const putSpy = vi.spyOn(await caches.open('chara-icons'), 'put');
    const ctx = createMockExecutionContext();
    const res = await app.request('/v1/chara/icon/41718', {}, env, ctx);
    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.error).toBe('UPSTREAM_UNAVAILABLE');
    expect(res.headers.get('Content-Type')).toContain('application/json');
    await flush(ctx);
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('stops reading an oversized upstream body at the 1 MB ceiling (API-12)', async () => {
    // 64 KB chunks, no Content-Length: the cap has to be enforced on the stream
    const { stream, counter } = countedStream(new Uint8Array(64 * 1024).fill(0x00), 100);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(stream, { status: 200, headers: { 'Content-Type': 'image/png' } }),
        ),
    );
    const res = await app.request('/v1/chara/icon/41719', {}, env, createMockExecutionContext());
    expect(res.status).toBe(503);
    expect(counter.pulls).toBeLessThan(40);
  });

  it('maps an upstream 404 to NOT_FOUND and a 5xx to UPSTREAM_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));
    const missing = await app.request(
      '/v1/chara/icon/999998',
      {},
      env,
      createMockExecutionContext(),
    );
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as any).error).toBe('NOT_FOUND');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('down', { status: 502 })));
    const down = await app.request('/v1/chara/icon/999997', {}, env, createMockExecutionContext());
    expect(down.status).toBe(503);
    expect(((await down.json()) as any).error).toBe('UPSTREAM_UNAVAILABLE');
  });
});

/**
 * BUG-040: with XIVAPI_VERSION = "latest" the row-cache namespace used to be
 * the literal string, constant across patches, so a patch that added an Item
 * row to a cached ModelMain kept serving the pre-patch family for up to
 * 7 d + 1 d SWR. The namespace is now the key `latest` currently points at.
 */
describe('POST /v1/chara/resolve — row cache follows the game version behind "latest" (BUG-040)', () => {
  const BODY = { gear: [{ slot: 'HeadGear', base: 361, variant: 5 }] };
  const NEW_TWIN = { ...BEECH_MASK, row_id: 99999 };
  const versions = (key: string) => okJson({ row_id: 1, version: key, fields: { Name: 'Gil' } });
  let now = 1_000_000;

  beforeEach(() => {
    resetAllMocks();
    vi.restoreAllMocks();
    now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => vi.unstubAllGlobals());

  const resolve = (base: string, ctx: ExecutionContext) =>
    app.request(
      '/v1/chara/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(BODY),
      },
      createMockEnv({ XIVAPI_BASE: base, XIVAPI_VERSION: 'latest' }),
      ctx,
    );

  it('serves a repeat from the cache within a patch, then goes upstream again once the version moves', async () => {
    const base = 'https://xivapi-latest.test';
    let current = 'aaaaaaaaaaaaaaaa';
    let searches = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (new URL(url).pathname === '/api/sheet/Item/1') return versions(current);
        searches++;
        return okJson({
          version: current,
          results: searches === 1 ? [BEECH_MASK] : [BEECH_MASK, NEW_TWIN],
        });
      }),
    );

    const ctx1 = createMockExecutionContext() as unknown as ExecutionContext;
    const first = await resolve(base, ctx1);
    expect(first.headers.get('X-Cache')).toBe('MISS');
    await flush(ctx1);

    const second = await resolve(base, createMockExecutionContext() as unknown as ExecutionContext);
    expect(second.headers.get('X-Cache')).toBe('HIT');
    expect(searches).toBe(1);

    // Patch day: `latest` re-points. Past the version-lookup TTL the namespace
    // changes, so the cached pre-patch family is no longer read.
    current = 'bbbbbbbbbbbbbbbb';
    now += 11 * 60_000;
    const third = await resolve(base, createMockExecutionContext() as unknown as ExecutionContext);
    expect(third.headers.get('X-Cache')).toBe('MISS');
    expect(searches).toBe(2);
    const body = (await third.json()) as any;
    expect(body.data.items.HeadGear.familySize).toBe(2);
  });

  it('bypasses shared row storage, and still answers, when context discovery is unavailable', async () => {
    let searches = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (new URL(url).pathname === '/api/sheet/Item/1')
          return new Response('down', { status: 502 });
        searches++;
        return okJson({ version: V, results: [BEECH_MASK] });
      }),
    );
    const res = await resolve(
      'https://xivapi-versiondown.test',
      createMockExecutionContext() as unknown as ExecutionContext,
    );
    expect(res.status).toBe(200);
    expect(searches).toBe(1);
    const again = await resolve(
      'https://xivapi-versiondown.test',
      createMockExecutionContext() as unknown as ExecutionContext,
    );
    expect(again.status).toBe(200);
    expect(again.headers.get('X-Cache')).toBe('MISS');
    expect(searches).toBe(2);
    expect(((await caches.open('chara-resolve')) as any).size).toBe(0);
  });
});

describe('POST /v1/chara/resolve — partial bootstrap identities', () => {
  const otherVersion = 'bbbbbbbbbbbbbbbb';
  const otherSchema = 'exdschema@2:rev:' + 'b'.repeat(40);
  type Identity = { version?: string; schema?: string };

  beforeEach(() => {
    resetAllMocks();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  async function resolvePartial(name: string, item: Identity, glasses: Identity) {
    // Do not use okJson: these fixtures must actually omit identity fields.
    const json = (body: object) =>
      new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    const fetchMock = vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (path === '/api/sheet/Item/1') return new Response('down', { status: 503 });
      if (path === '/api/search') return json({ ...item, results: [BEECH_MASK] });
      if (path === '/api/sheet/Glasses/40')
        return json({
          ...glasses,
          row_id: 40,
          fields: { Name: 'Black Rose-colored Spectacles', Icon: { id: 200018 } },
        });
      throw new Error('Unexpected upstream path: ' + path);
    });
    vi.stubGlobal('fetch', fetchMock);
    const cache = await caches.open('chara-resolve');
    const putSpy = vi.spyOn(cache, 'put');
    const ctx = createMockExecutionContext();
    const response = await app.request(
      '/v1/chara/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gear: [{ slot: 'HeadGear', base: 361, variant: 5 }], glasses: 40 }),
      },
      createMockEnv({
        XIVAPI_BASE: 'https://' + name.replaceAll(' ', '-') + '.test',
        XIVAPI_VERSION: 'latest',
      }),
      ctx,
    );
    await flush(ctx);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(putSpy).not.toHaveBeenCalled();
    return response;
  }

  it.each<[string, Identity, Identity]>([
    ['missing Item version', { schema: S }, { version: V, schema: otherSchema }],
    ['missing Glasses version', { version: V, schema: S }, { schema: otherSchema }],
    ['missing both versions', { schema: S }, { schema: otherSchema }],
    ['missing both schemas', { version: V }, { version: otherVersion }],
  ])('rejects conflicting known coordinates with %s', async (name, item, glasses) => {
    const response = await resolvePartial(name, item, glasses);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'UPSTREAM_UNAVAILABLE' });
  });

  it.each<[string, Identity, Identity]>([
    ['matching schema only', { schema: S }, { version: V, schema: S }],
    ['missing Item schema', { version: V }, { version: V, schema: S }],
    ['missing Glasses schema', { version: V, schema: S }, { version: V }],
  ])(
    'answers without persistence when no known coordinates conflict: %s',
    async (name, item, glasses) => {
      const response = await resolvePartial(name, item, glasses);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('MISS');
      expect(await response.json()).toMatchObject({
        data: {
          items: { HeadGear: { itemId: 18085 } },
          glasses: { id: 40, names: { en: 'Black Rose-colored Spectacles' } },
        },
      });
    },
  );
});

describe('CORS', () => {
  it('preflight allows POST for the resolve endpoint', async () => {
    const res = await app.request(
      '/v1/chara/resolve',
      {
        method: 'OPTIONS',
        headers: { Origin: 'https://xivdyetools.app', 'Access-Control-Request-Method': 'POST' },
      },
      env,
      createMockExecutionContext(),
    );
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});


describe('chara upstream admission and current icon version', () => {
  const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
  let sequence = 0;
  beforeEach(() => { resetAllMocks(); vi.restoreAllMocks(); });
  afterEach(() => vi.unstubAllGlobals());
  const setup = (extra = {}) => {
    const budget = { limit: vi.fn(async () => ({ success: true })) };
    const localEnv = createMockEnv({ XIVAPI_BASE: 'https://route-budget-' + ++sequence + '.test', XIVAPI_VERSION: V, XIVAPI_SCHEMA: S, CHARA_SERVICE_RATE_LIMITER: budget, ...extra });
    return { budget, localEnv };
  };
  const resolve = (localEnv: typeof env, body: object, ctx = createMockExecutionContext(), locale = '', headers: Record<string, string> = {}) => app.request('/v1/chara/resolve' + locale, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }, localEnv, ctx);
  const gear = [{ slot: 'HeadGear', base: 361, variant: 5 }];
  const upstream = () => vi.fn(async (url: string) => url.includes('/Glasses/') ? okJson({ row_id: 3, fields: { Name: 'G' } }) : okJson({ results: [BEECH_MASK] }));
  it.each([
    [{ gear }, 1], [{ gear: [], glasses: 3 }, 1], [{ gear, glasses: 3 }, 2],
  ] as const)('charges real cold operations and zero repeat hits: %s', async (body, count) => {
    const { budget, localEnv } = setup();
    const fetchMock = upstream();
    vi.stubGlobal('fetch', fetchMock);
    const ctx = createMockExecutionContext();
    expect((await resolve(localEnv, body, ctx)).status).toBe(200);
    await flush(ctx);
    expect(budget.limit).toHaveBeenCalledTimes(count);
    budget.limit.mockResolvedValue({ success: false });
    const hit = await resolve(localEnv, body);
    expect(hit.status).toBe(200);
    expect(hit.headers.get('X-Cache')).toBe('HIT');
    expect(budget.limit).toHaveBeenCalledTimes(count);
    expect(fetchMock).toHaveBeenCalledTimes(count);
  });
  it('negative Item and Glasses hits consume no upstream budget', async () => {
    const { budget, localEnv } = setup();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/Glasses/') ? new Response(null, { status: 404 }) : okJson({ results: [] })));
    const ctx = createMockExecutionContext();
    expect((await resolve(localEnv, { gear, glasses: 3 }, ctx)).status).toBe(200);
    await flush(ctx);
    budget.limit.mockResolvedValue({ success: false });
    expect((await resolve(localEnv, { gear, glasses: 3 })).status).toBe(200);
    expect(budget.limit).toHaveBeenCalledTimes(2);
  });
  it('mixed hits charge only the newly fetched Glasses operation', async () => {
    const { budget, localEnv } = setup();
    vi.stubGlobal('fetch', upstream());
    const ctx = createMockExecutionContext();
    await resolve(localEnv, { gear }, ctx);
    await flush(ctx);
    expect((await resolve(localEnv, { gear, glasses: 3 })).status).toBe(200);
    expect(budget.limit).toHaveBeenCalledTimes(2);
  });
  it('denied owner and waiter each build 429 metadata from their own admission with quota headers and permit retry', async () => {
    const { budget, localEnv } = setup();
    let release!: () => void;
    const gate = new Promise<void>((yes) => { release = yes; });
    budget.limit.mockImplementation(async () => { await gate; return { success: false }; });
    const fetchMock = upstream();
    vi.stubGlobal('fetch', fetchMock);
    const ownerCtx = createMockExecutionContext();
    const waiterCtx = createMockExecutionContext();
    const loaderCalls = vi.spyOn(CharaLookupLoader.prototype, 'loadRows');
    const owner = resolve(localEnv, { gear }, ownerCtx, '?locale=ja');
    await vi.waitFor(() => expect(budget.limit).toHaveBeenCalledOnce());
    const waiter = resolve(localEnv, { gear }, waiterCtx, '?locale=fr');
    await vi.waitFor(() => expect(loaderCalls).toHaveBeenCalledTimes(2));
    release();
    const responses = await Promise.all([owner, waiter]);
    const bodies = [];
    for (const response of responses) {
      expect(response.status).toBe(429);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Retry-After')).toMatch(/^[1-6]?[0-9]$/);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('1200');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toMatch(/^\d+$/);
      const body = await response.json() as any;
      expect(body.error).toBe('RATE_LIMITED');
      expect(body.message).toBe('Too many upstream character-data requests. Please try again later.');
      expect(body.meta.requestId).toBe(response.headers.get('X-Request-Id'));
      bodies.push(body);
    }
    expect(bodies[0].meta.locale).toBe('ja');
    expect(bodies[1].meta.locale).toBe('fr');
    expect(bodies[0].meta.requestId).not.toBe(bodies[1].meta.requestId);
    expect(budget.limit).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
    await Promise.all([flush(ownerCtx), flush(waiterCtx)]);
    budget.limit.mockResolvedValue({ success: true });
    expect((await resolve(localEnv, { gear })).status).toBe(200);
    expect(budget.limit).toHaveBeenCalledTimes(3);
  });
  it("a coalesced waiter from another client is not denied by the owner's quota", async () => {
    let release!: () => void;
    const gate = new Promise<void>((yes) => { release = yes; });
    const limit = vi.fn(async ({ key }: { key: string }) => { await gate; return { success: !key.includes('198.51.100.1') }; });
    const { localEnv } = setup({ CHARA_RATE_LIMITER: { limit } });
    const fetchMock = upstream();
    vi.stubGlobal('fetch', fetchMock);
    const ownerCtx = createMockExecutionContext();
    const waiterCtx = createMockExecutionContext();
    const loaderCalls = vi.spyOn(CharaLookupLoader.prototype, 'loadRows');
    const owner = resolve(localEnv, { gear }, ownerCtx, '', { 'CF-Connecting-IP': '198.51.100.1' });
    await vi.waitFor(() => expect(limit).toHaveBeenCalledOnce());
    const waiter = resolve(localEnv, { gear }, waiterCtx, '', { 'CF-Connecting-IP': '203.0.113.9' });
    await vi.waitFor(() => expect(loaderCalls).toHaveBeenCalledTimes(2));
    release();
    const [denied, served] = await Promise.all([owner, waiter]);
    expect(denied.status).toBe(429);
    expect(denied.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(served.status).toBe(200);
    expect(((await served.json()) as any).data.items.HeadGear.itemId).toBe(18085);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(limit).toHaveBeenCalledTimes(2);
    expect(new Set(limit.mock.calls.map(([{ key }]) => key)).size).toBe(2);
    await Promise.all([flush(ownerCtx), flush(waiterCtx)]);
  });
  it.each(['resolve', 'icon'])('malformed binding fails before discovery on %s', async (kind) => {
    const { localEnv } = setup({ XIVAPI_VERSION: 'latest', CHARA_SERVICE_RATE_LIMITER: {} as RateLimit });
    const fetchMock = upstream();
    vi.stubGlobal('fetch', fetchMock);
    const response = kind === 'resolve' ? await resolve(localEnv, { gear }) : await app.request('/v1/chara/icon/41716', {}, localEnv, createMockExecutionContext());
    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['search', 'glasses'] as const)('oversized/malformed/read-failed %s is uncached 503 and retry succeeds', async (kind) => {
    for (const mode of ['oversize', 'malformed', 'stream']) {
      resetAllMocks();
      const { budget, localEnv } = setup();
      const fetchMock = vi.fn(async (_url: string) => new Response(mode === 'oversize' ? ' '.repeat((kind === 'search' ? 2 * 1024 * 1024 : 32 * 1024) + 1) : mode === 'malformed' ? '{' : new ReadableStream({ pull(c) { c.error(new Error('read failure')); } })));
      vi.stubGlobal('fetch', fetchMock);
      const body = kind === 'search' ? { gear } : { gear: [], glasses: 3 };
      const ctx = createMockExecutionContext();
      expect((await resolve(localEnv, body, ctx)).status).toBe(503);
      await flush(ctx);
      expect(((await caches.open('chara-resolve')) as any).size).toBe(0);
      fetchMock.mockImplementation(upstream());
      expect((await resolve(localEnv, body)).status).toBe(200);
      expect(budget.limit).toHaveBeenCalledTimes(2);
    }
  });
  it('cleans new upstream names before persistence and cached replay', async () => {
    const { localEnv } = setup();
    vi.stubGlobal('fetch', vi.fn(async () => okJson({ results: [{ ...BEECH_MASK, fields: { ...BEECH_MASK.fields, Name: ' A\n\tB\u200f' } }] })));
    const ctx = createMockExecutionContext();
    const first = await resolve(localEnv, { gear }, ctx);
    await flush(ctx);
    const hit = await resolve(localEnv, { gear });
    for (const response of [first, hit]) expect((await response.json() as any).data.items.HeadGear.names.en).toBe('A B');
  });
  it('canonical pin alone accepts matching version and rejects mismatch before cache or asset reads', async () => {
    const { budget, localEnv } = setup({ XIVAPI_SCHEMA: undefined });
    const fetchMock = vi.fn(async (_url: string) => new Response(PNG_BYTES));
    vi.stubGlobal('fetch', fetchMock);
    const open = vi.spyOn(caches, 'open');
    const mismatch = await app.request('/v1/chara/icon/41716?version=bbbbbbbbbbbbbbbb', {}, localEnv, createMockExecutionContext());
    expect(mismatch.status).toBe(400);
    expect(await mismatch.json()).toMatchObject({ error: 'VALIDATION_ERROR', message: 'The icon version must match the current XIVAPI game version.' });
    expect(open).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(budget.limit).not.toHaveBeenCalled();
    const ctx = createMockExecutionContext();
    const match = await app.request('/v1/chara/icon/41716?version=' + V + '&noise=ignored', {}, localEnv, ctx);
    expect(match.status).toBe(200);
    await flush(ctx);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(new URL(fetchMock.mock.calls[0][0] as unknown as string).searchParams.has('noise')).toBe(false);
    budget.limit.mockResolvedValue({ success: false });
    expect((await app.request('/v1/chara/icon/41716?version=' + V + '&noise=other', {}, localEnv, createMockExecutionContext())).status).toBe(200);
    expect(budget.limit).toHaveBeenCalledOnce();
  });
  it('compares explicit versions to discovered and last-known-good game keys; probes only deployment config', async () => {
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const { budget, localEnv } = setup({ XIVAPI_VERSION: 'latest', XIVAPI_SCHEMA: undefined });
    let fail = false;
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (raw: string) => {
      urls.push(raw);
      if (raw.includes('/Item/1')) return fail ? new Response(null, { status: 503 }) : okJson({ row_id: 1, fields: { Name: 'Gil' } });
      return new Response(PNG_BYTES);
    }));
    const call = (version: string, id = 41716) => app.request('/v1/chara/icon/' + id + '?version=' + version, {}, localEnv, createMockExecutionContext());
    expect((await call('bbbbbbbbbbbbbbbb')).status).toBe(400);
    expect(budget.limit).not.toHaveBeenCalled();
    expect(urls).toHaveLength(1);
    expect(new URL(urls[0]).searchParams.get('version')).toBe('latest');
    expect((await call(V)).status).toBe(200);
    fail = true;
    now += 11 * 60_000;
    expect((await call(V, 41717)).status).toBe(200);
    expect((await call('bbbbbbbbbbbbbbbb', 41718)).status).toBe(400);
    expect(budget.limit).toHaveBeenCalledTimes(2);
    expect(urls.filter((url) => url.includes('/Item/1'))).toHaveLength(2);
  });
  it('bootstrap explicit version is 503 while unversioned fallback remains uncached and budgeted', async () => {
    const { budget, localEnv } = setup({ XIVAPI_VERSION: 'latest', XIVAPI_SCHEMA: undefined });
    const fetchMock = vi.fn(async (raw: string) => raw.includes('/Item/1') ? new Response(null, { status: 503 }) : new Response(PNG_BYTES));
    vi.stubGlobal('fetch', fetchMock);
    const explicit = await app.request('/v1/chara/icon/41716?version=' + V, {}, localEnv, createMockExecutionContext());
    expect(explicit.status).toBe(503);
    expect(await explicit.json()).toMatchObject({ message: 'XIVAPI game version is unavailable.' });
    expect(budget.limit).not.toHaveBeenCalled();
    for (let i = 0; i < 2; i++) expect((await app.request('/v1/chara/icon/41716', {}, localEnv, createMockExecutionContext())).status).toBe(200);
    expect(budget.limit).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(((await caches.open('chara-icons')) as any).size).toBe(0);
  });
  it('icon quota denial performs no asset fetch', async () => {
    const { budget, localEnv } = setup();
    budget.limit.mockResolvedValue({ success: false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await app.request('/v1/chara/icon/41716', {}, localEnv, createMockExecutionContext());
    expect(response.status).toBe(429);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(budget.limit).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});


describe('strict canonical icon inputs reject encoded final terminators', () => {
  let sequence = 0;
  beforeEach(() => { resetAllMocks(); vi.restoreAllMocks(); });
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    ['version', '%0A'], ['version', '%0D'], ['version', '%0D%0A'], ['version', '%E2%80%A8'], ['version', '%E2%80%A9'],
    ['iconId', '%0A'], ['iconId', '%0D'], ['iconId', '%0D%0A'], ['iconId', '%E2%80%A8'], ['iconId', '%E2%80%A9'],
  ])('rejects encoded final terminator on %s: %s before chara work', async (kind, suffix) => {
    const generic = { limit: vi.fn(async () => ({ success: true })) };
    const charaBudget = { limit: vi.fn(async () => ({ success: true })) };
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const cacheOpen = vi.spyOn(caches, 'open');
    const localEnv = createMockEnv({
      XIVAPI_BASE: 'https://strict-icon-' + ++sequence + '.test',
      XIVAPI_VERSION: 'latest',
      SERVICE_RATE_LIMITER: generic,
      CHARA_SERVICE_RATE_LIMITER: charaBudget,
    });
    const path = kind === 'version'
      ? '/v1/chara/icon/41716?version=' + V + suffix
      : '/v1/chara/icon/41716' + suffix;
    // Fresh general-admission middleware keeps each case's binding observable;
    // the production index intentionally memoizes its first backend per isolate.
    const isolatedApp = new Hono<{ Bindings: Env }>();
    isolatedApp.use('/v1/*', createApiRateLimitMiddleware());
    isolatedApp.route('/v1/chara', charaRouter);
    isolatedApp.onError((error) => {
      if (error instanceof ApiError)
        return new Response(JSON.stringify({ error: error.code }), {
          status: error.statusCode,
          headers: { 'Content-Type': 'application/json' },
        });
      throw error;
    });
    const response = await isolatedApp.request(path, {}, localEnv, createMockExecutionContext());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'VALIDATION_ERROR' });
    expect(generic.limit).toHaveBeenCalledOnce();
    expect(charaBudget.limit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cacheOpen).not.toHaveBeenCalled();
  });
});
