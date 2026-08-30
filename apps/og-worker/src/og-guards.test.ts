/**
 * /og/* request guards (FINDING-005, 2026-08-21 audit):
 * - path segments are length-capped before any card is generated (a 16 KB
 *   `:color` used to reach a cubic-time text-wrap on the not-found card)
 * - successful PNG renders are stored in `caches.default` so repeat requests
 *   do not re-rasterise (the Cache-Control headers alone were inert)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const rendered: string[] = [];
vi.mock('./services/renderer', () => ({
  renderOGImage: vi.fn(async (svg: string) => {
    rendered.push(svg);
    return new Response('mock-png-data', {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  }),
}));

const { default: app } = await import('./index');
const { renderOGImage } = await import('./services/renderer');

const TEST_ENV = {
  APP_BASE_URL: 'https://xivdyetools.app',
  OG_IMAGE_BASE_URL: 'https://og.xivdyetools.app/og',
};

function fakeCacheStorage(): { default: Cache; store: Map<string, Response> } {
  const store = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (req: Request | string) => {
      const key = typeof req === 'string' ? req : req.url;
      const hit = store.get(key);
      return hit ? hit.clone() : undefined;
    }),
    put: vi.fn(async (req: Request | string, res: Response) => {
      const key = typeof req === 'string' ? req : req.url;
      store.set(key, res);
    }),
  } as unknown as Cache;
  return { default: cache, store };
}

const execCtx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

const CRAWLER_UA = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';

describe('/og/* parameter length guard', () => {
  beforeEach(() => {
    rendered.length = 0;
    vi.mocked(renderOGImage).mockClear();
  });

  it('rejects a 16 KB swatch colour segment with 400 without rendering', async () => {
    const junk = 'X'.repeat(16 * 1024);
    const started = Date.now();
    const res = await app.request(`/og/swatch/${junk}/4`, {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  it('rejects any /og/* path segment longer than 64 characters', async () => {
    const long = 'a'.repeat(65);
    const res = await app.request(`/og/harmony/${long}/complementary`, {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  it('still serves a normal /og/* request', async () => {
    const res = await app.request('/og/harmony/1/complementary', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(200);
    expect(renderOGImage).toHaveBeenCalledTimes(1);
  });

  // FINDING-024 / OG-3 (defence in depth for the image surface): a PNG is a
  // PNG — the browser must never sniff a card response as anything else.
  it('image responses carry X-Content-Type-Options: nosniff', async () => {
    const res = await app.request('/og/harmony/1/complementary', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});

// 2026-08-29 FINDING-024 (OG-4): the /og/* query-key allowlist. Without it,
// appending an arbitrary throwaway key (?x=1, ?x=2, …) to a valid /og/* URL
// was free — each variant missed the edge cache and forced a fresh,
// unauthenticated, unrate-limited resvg raster.
describe('/og/* query-key allowlist', () => {
  beforeEach(() => {
    rendered.length = 0;
    vi.mocked(renderOGImage).mockClear();
  });

  it('rejects an unknown query key on a valid /og/* path with 404, without rendering', async () => {
    const res = await app.request('/og/harmony/1/complementary?x=1', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(404);
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  // OG-8: a validation response never echoes attacker input.
  it('does not echo the offending key name in the 404 body', async () => {
    const res = await app.request('/og/harmony/1/complementary?utm_source=evil', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).not.toContain('utm_source');
    expect(body).not.toContain('evil');
  });

  it('allows exactly lang, frame, and algo together', async () => {
    const res = await app.request(
      '/og/harmony/1/complementary?lang=ja&frame=x&algo=oklab',
      {},
      TEST_ENV,
      execCtx,
    );
    expect(res.status).toBe(200);
    expect(renderOGImage).toHaveBeenCalledTimes(1);
  });

  // 2026-08-29 FINDING-024 (OG-4, ruling S7-R7): `algo` is an allowed KEY on
  // every /og/* route, but comparison (like accessibility / extractor /
  // presets / budget / both default-card routes) never reads it — without
  // this check, ?algo=1, ?algo=2, … on a route with no isAlgorithm check of
  // its own would each mint a fresh canonical cache key and force a fresh
  // render, the same amplification the allowlist otherwise closes.
  it('rejects an invalid algo value even on a route that never reads algo, without rendering', async () => {
    const res = await app.request('/og/comparison/1,2,3.png?algo=1', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid algorithm' });
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  it('still renders a valid algo value on a route that never reads algo', async () => {
    const res = await app.request('/og/comparison/1,2,3.png?algo=oklab', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(200);
    expect(renderOGImage).toHaveBeenCalledTimes(1);
  });

  it('a repeated allowed key is not an error', async () => {
    const res = await app.request('/og/harmony/1/complementary?lang=ja&lang=de', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(200);
  });

  // The allowlist is scoped to /og/* only — the crawler-intercept tool
  // routes carry the SPA's own share params (utm_source and friends) and
  // must keep passing a crawler UA through to the crawler HTML untouched.
  it('leaves the crawler-intercept tool routes unaffected by the /og/* allowlist', async () => {
    const res = await app.request(
      '/harmony/?dye=102&harmony=tetradic&utm_source=x',
      { headers: { 'User-Agent': CRAWLER_UA } },
      TEST_ENV,
      execCtx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
  });
});

describe('/og/* edge cache', () => {
  let caches: ReturnType<typeof fakeCacheStorage>;

  beforeEach(() => {
    vi.mocked(renderOGImage).mockClear();
    caches = fakeCacheStorage();
    vi.stubGlobal('caches', caches);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders once and serves the second identical request from caches.default', async () => {
    const first = await app.request('/og/harmony/1/complementary?lang=de', {}, TEST_ENV, execCtx);
    expect(first.status).toBe(200);
    // the put may be deferred via waitUntil — flush it
    await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));

    const second = await app.request('/og/harmony/1/complementary?lang=de', {}, TEST_ENV, execCtx);
    expect(second.status).toBe(200);
    expect(await second.text()).toBe('mock-png-data');
    expect(renderOGImage).toHaveBeenCalledTimes(1);
    expect(caches.store.size).toBe(1);
  });

  // 2026-08-29 FINDING-024 (OG-4): the key is now canonical — pathname plus
  // the RESOLVED lang/frame and the RAW algo — instead of the full URL. This
  // block replaces the old "keys the cache on the full URL" test, which
  // described the pre-fix behaviour that let an unbounded key space defeat
  // this exact cache.
  describe('canonical key contract', () => {
    it('lang varies the key: ?lang=de and ?lang=ja render twice', async () => {
      await app.request('/og/harmony/1/complementary?lang=de', {}, TEST_ENV, execCtx);
      await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));
      await app.request('/og/harmony/1/complementary?lang=ja', {}, TEST_ENV, execCtx);
      expect(renderOGImage).toHaveBeenCalledTimes(2);
    });

    it('frame varies the key: default and ?frame=x render twice', async () => {
      await app.request('/og/harmony/1/complementary', {}, TEST_ENV, execCtx);
      await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));
      await app.request('/og/harmony/1/complementary?frame=x', {}, TEST_ENV, execCtx);
      expect(renderOGImage).toHaveBeenCalledTimes(2);
    });

    it('algo varies the key: ?algo=oklab and ?algo=cie76 render twice', async () => {
      await app.request('/og/harmony/1/complementary?algo=oklab', {}, TEST_ENV, execCtx);
      await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));
      await app.request('/og/harmony/1/complementary?algo=cie76', {}, TEST_ENV, execCtx);
      expect(renderOGImage).toHaveBeenCalledTimes(2);
    });

    // The amplification this sprint closes: a query value that RESOLVES to
    // the same card must not buy a fresh cache entry. Under the old
    // full-URL key, both of these missed the cache a second time — that gap
    // is FINDING-024 / OG-4.
    it('closes the amplification: ?lang=en-US resolves like a missing lang, so the second request is a cache hit', async () => {
      const first = await app.request('/og/harmony/1/complementary', {}, TEST_ENV, execCtx);
      expect(first.status).toBe(200);
      await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));

      const second = await app.request('/og/harmony/1/complementary?lang=en-US', {}, TEST_ENV, execCtx);
      expect(second.status).toBe(200);
      expect(renderOGImage).toHaveBeenCalledTimes(1);
    });

    it('closes the amplification: ?frame=bogus resolves like a missing frame, so the second request is a cache hit', async () => {
      const first = await app.request('/og/harmony/1/complementary', {}, TEST_ENV, execCtx);
      expect(first.status).toBe(200);
      await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));

      const second = await app.request('/og/harmony/1/complementary?frame=bogus', {}, TEST_ENV, execCtx);
      expect(second.status).toBe(200);
      expect(renderOGImage).toHaveBeenCalledTimes(1);
    });
  });

  it('does not cache error responses', async () => {
    const res = await app.request('/og/swatch/ZZZZZZ/999', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));
    expect(caches.store.size).toBe(0);
  });
});
