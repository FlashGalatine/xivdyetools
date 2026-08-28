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
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '9000' }, body: '{}' },
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
      .mockImplementation(() => Promise.resolve(okJson({ version: 'v', results: [BEECH_MASK], next: 'cursor-page-2' })));
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

  /** The 8-byte PNG signature plus a few bytes of "body". */
  const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const png = (contentType = 'image/png') =>
    new Response(PNG_BYTES, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Content-Length': String(PNG_BYTES.byteLength) },
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
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_BYTES);
    const upstream = new URL(fetchMock.mock.calls[0][0] as string);
    expect(upstream.searchParams.get('path')).toBe('ui/icon/041000/041716_hr1.tex');

    await flush(ctx);
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

  // FINDING-025 / API-4: lenient parseInt let `041716`, `41716abc`, `41716%20`
  // all resolve to icon 41716 under distinct edge-cache keys — one fresh
  // upstream fetch per alias. Only the canonical decimal form is accepted.
  it('rejects non-canonical spellings of an id (API-4)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(png());
    vi.stubGlobal('fetch', fetchMock);
    for (const alias of ['041716', '41716abc', '41716%20', '+41716', '41716.0', '0x41716']) {
      const res = await app.request(`/v1/chara/icon/${alias}`, {}, env, createMockExecutionContext());
      expect(res.status, alias).toBe(400);
      expect(((await res.json()) as any).error, alias).toBe('VALIDATION_ERROR');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keys the edge cache on the canonical id path (API-4)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(png()));
    const putSpy = vi.spyOn(caches.default, 'put');
    const ctx = createMockExecutionContext();
    await app.request('/v1/chara/icon/41716?cb=1&x=2', { method: 'GET' }, env, ctx);
    await flush(ctx);
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect((putSpy.mock.calls[0][0] as Request).url).toBe('http://localhost/v1/chara/icon/41716');
  });

  // FINDING-025 / API-12: the proxy serves image/png or nothing — the
  // upstream's Content-Type is never reflected and a non-PNG body is refused
  // (and not cached) rather than stored for 30 days.
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
    const putSpy = vi.spyOn(caches.default, 'put');
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
      vi.fn().mockResolvedValue(new Response(stream, { status: 200, headers: { 'Content-Type': 'image/png' } })),
    );
    const res = await app.request('/v1/chara/icon/41719', {}, env, createMockExecutionContext());
    expect(res.status).toBe(503);
    expect(counter.pulls).toBeLessThan(40);
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
