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

// 2026-08-29 FINDING-024 (OG-4, ruling S7-R12): the query axis was bounded
// in the earlier rounds; this block closes the PATH axis, at the same
// attacker cost — every one of these used to render the identical card
// under a distinct cache key.
describe('/og/* canonical path grammar', () => {
  beforeEach(() => {
    rendered.length = 0;
    vi.mocked(renderOGImage).mockClear();
  });

  it('rejects trailing junk on a dye ID', async () => {
    const res = await app.request('/og/harmony/102aaa/complementary', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  it('rejects a leading-zero dye ID', async () => {
    const res = await app.request('/og/harmony/00102/complementary', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  it('rejects a signed dye ID', async () => {
    const res = await app.request('/og/harmony/+102/complementary', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  // Hono's getPath() decodes with decodeURI, which deliberately leaves %2F
  // encoded — it survives routing as a literal path segment and only
  // becomes an actual "/" once c.req.param() runs decodeURIComponent on it,
  // so parseInt("1/0", 10) used to resolve to dye 1.
  it('rejects a %2F-encoded dye ID spelling', async () => {
    const res = await app.request('/og/harmony/1%2F0/complementary', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  // 2026-08-29 FINDING-024 (OG-4, ruling S7-R16): /og/:tool/default.png is
  // registered before /og/presets/:presetId, so the suffixed spelling
  // always rendered the real default card — but once S7-R13 made `.png`
  // optional, `/og/presets/default` (no suffix) started reaching THIS
  // handler instead, passing the slug grammar and rendering presets' own
  // notFoundBand: a DIFFERENT card, a 200, cached under the SAME key the
  // real default.png uses. `default` is now reserved and renders the
  // identical default card either way — verified here by comparing the
  // actual rendered SVG (not just the cached response), with caching
  // inactive in this describe block so both requests genuinely render.
  it('/og/presets/default and /og/presets/default.png render byte-identical output', async () => {
    const noSuffix = await app.request('/og/presets/default', {}, TEST_ENV, execCtx);
    const withSuffix = await app.request('/og/presets/default.png', {}, TEST_ENV, execCtx);
    expect(noSuffix.status).toBe(200);
    expect(withSuffix.status).toBe(200);
    expect(rendered).toHaveLength(2);
    // band.ts's mark clip-path id carries a module-level call counter
    // (`ogm5b`, `ogm6b`, …) that is cosmetic, not content — normalise it out
    // before comparing, same as the services/svg pinning tests do.
    const normalizeMarkUid = (svg: string): string => svg.replace(/ogm\d+/g, 'ogmX');
    expect(normalizeMarkUid(rendered[0])).toBe(normalizeMarkUid(rendered[1]));
  });

  // Ruling S7-R13: String.replace('.png', '') is unanchored and
  // first-occurrence, so a `.png` appearing anywhere in the segment used to
  // strip and leave a "valid" enum value.
  it('rejects a harmonyType with .png as a prefix rather than a true suffix', async () => {
    const res = await app.request('/og/harmony/1/.pngcomplementary', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  it('rejects a harmonyType with .png in the middle rather than a true suffix', async () => {
    const res = await app.request('/og/harmony/1/co.pngmplementary', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  it('rejects a lowercase swatch colour', async () => {
    const res = await app.request('/og/swatch/ff5500/5', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  it('still renders the canonical (upper-case) swatch colour', async () => {
    const res = await app.request('/og/swatch/FF5500/5', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(200);
    expect(renderOGImage).toHaveBeenCalledTimes(1);
  });

  // The bug this closes: `.filter((id) => !isNaN(id))` used to drop "x"
  // silently and render a 3-dye card from [1, 2, 3] — a caller could not
  // tell the request had been degraded, and every way of spelling the
  // dropped entry bought a fresh cache key for that same silently-degraded
  // card.
  it('rejects a comparison dye list containing a non-canonical entry, rather than silently rendering the valid ones', async () => {
    const res = await app.request('/og/comparison/1,2,x,3', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    expect(renderOGImage).not.toHaveBeenCalled();
  });

  // 2026-08-29 FINDING-024 (OG-4, ruling S7-R16): re-verifying the reviewer's
  // claim that presets is the ONLY /og/<literal-tool>/:singleParam route the
  // `default.png`-shadowing regression reaches — comparison, extractor, and
  // budget share that exact route shape, but their grammars are
  // numeric/hex-only, so "default" is rejected as malformed before it could
  // ever reach a render, let alone get cached as a 200 under the shared key.
  it('does NOT collide on the stripped "default" path for comparison, extractor, or budget', async () => {
    const comparison = await app.request('/og/comparison/default', {}, TEST_ENV, execCtx);
    expect(comparison.status).toBe(400);
    const extractor = await app.request('/og/extractor/default', {}, TEST_ENV, execCtx);
    expect(extractor.status).toBe(400);
    const budget = await app.request('/og/budget/default', {}, TEST_ENV, execCtx);
    expect(budget.status).toBe(400);
    expect(renderOGImage).not.toHaveBeenCalled();
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

  // 2026-08-29 FINDING-024 (OG-4, ruling S7-R8): Hono re-dispatches a HEAD
  // request as GET for routing but builds this middleware's Context from the
  // original request, so c.req.method reads 'HEAD' — before this fix the
  // cache middleware's `c.req.method !== 'GET'` check treated every HEAD as
  // uncacheable and the route re-rendered on every single one, no distinct
  // URLs required (a plain `curl -I` loop against ONE url).
  it('a HEAD after a GET of the same URL is served from the cache, not re-rendered', async () => {
    const first = await app.request('/og/harmony/1/complementary', {}, TEST_ENV, execCtx);
    expect(first.status).toBe(200);
    await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));

    const head = await app.request('/og/harmony/1/complementary', { method: 'HEAD' }, TEST_ENV, execCtx);
    expect(head.status).toBe(200);
    expect(renderOGImage).toHaveBeenCalledTimes(1);
  });

  // 2026-08-29 FINDING-024 (OG-4, ruling S7-R11): the untested direction of
  // the S7-R8 fix — a HEAD arriving on a COLD cache. It renders and must
  // `cache.put` the FULL response body, because a later GET is served
  // whatever got stored. If a future change ever stored what the HEAD
  // *client* sees (a bodiless response — Hono strips the body only in the
  // outer wrapper, after this middleware has already run) instead of what
  // the inner render actually produced, every GET after a HEAD would return
  // an empty PNG: a broken preview image, cached for a week. A status-only
  // or call-count-only assertion would not catch that — this test reads the
  // GET's actual body.
  it('a HEAD on a cold cache renders and stores the FULL body for a later GET', async () => {
    const head = await app.request('/og/harmony/1/complementary', { method: 'HEAD' }, TEST_ENV, execCtx);
    expect(head.status).toBe(200);
    await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));

    const get = await app.request('/og/harmony/1/complementary', {}, TEST_ENV, execCtx);
    expect(get.status).toBe(200);
    expect(await get.text()).toBe('mock-png-data');
    expect(renderOGImage).toHaveBeenCalledTimes(1);
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

    // Ruling S7-R13: `.png` stays optional (both spellings render the same
    // card), so it must not buy a second cache entry either.
    it('closes the amplification: .png and no suffix share one cache entry', async () => {
      const first = await app.request('/og/harmony/1/complementary', {}, TEST_ENV, execCtx);
      expect(first.status).toBe(200);
      await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));

      const second = await app.request('/og/harmony/1/complementary.png', {}, TEST_ENV, execCtx);
      expect(second.status).toBe(200);
      expect(renderOGImage).toHaveBeenCalledTimes(1);
    });

    // 2026-08-29 FINDING-024 (OG-4, ruling S7-R16): the regression this
    // closes — before it, these two spellings rendered DIFFERENT cards (the
    // real default vs presets' own not-found band) under the one cache key
    // S7-R13 gave them, so a single unauthenticated GET of the suffix-less
    // spelling could poison the cached entry the emitted
    // /og/presets/default.png URL depends on for up to 7 days. Now they
    // render the same card, so sharing the key is safe — one render, two
    // requests, exactly like the harmony case above.
    it('closes the amplification: /og/presets/default and /og/presets/default.png share one cache entry', async () => {
      const first = await app.request('/og/presets/default.png', {}, TEST_ENV, execCtx);
      expect(first.status).toBe(200);
      await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));

      const second = await app.request('/og/presets/default', {}, TEST_ENV, execCtx);
      expect(second.status).toBe(200);
      expect(renderOGImage).toHaveBeenCalledTimes(1);
    });

    // 2026-08-29 FINDING-024 (OG-4, ruling S7-R9): the key is built from
    // c.req.path (Hono's DECODED path — what the router actually matched
    // on), not the raw pathname. Before this fix, every percent-encoded
    // spelling of the same path bought its own cache entry for the
    // identical card.
    it('closes the amplification: a percent-encoded spelling of an already-cached path is a cache hit', async () => {
      const first = await app.request('/og/harmony/1/complementary', {}, TEST_ENV, execCtx);
      expect(first.status).toBe(200);
      await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));

      // %63 = 'c' — decodes to the identical /og/harmony/1/complementary path.
      const second = await app.request('/og/harmony/1/%63omplementary', {}, TEST_ENV, execCtx);
      expect(second.status).toBe(200);
      expect(renderOGImage).toHaveBeenCalledTimes(1);
    });

    // 2026-08-29 FINDING-024 (OG-4, ruling S7-R10): an empty `algo` value
    // (`?algo=`) is absent, not invalid — verified against Hono 4.13.4 that
    // both `?algo=` and bare `?algo` yield `''` from `URLSearchParams.get`,
    // same as Hono's own query parser. `isAlgorithm('')` is false, so
    // without this carve-out the guard would 400 a spelling that used to
    // fall through `c.req.query('algo') || DEFAULT_MATCHING_METHOD` and
    // render the default algorithm's card. This test fails on `.toBe(200)`
    // if the guard fix is reverted, and on `.toHaveBeenCalledTimes(1)` if
    // only the guard (not ogCacheKey) is fixed — an empty algo would then
    // pass the guard but still mint its own cache entry.
    it('treats an empty ?algo= as absent: renders 200 and shares the no-algo cache entry', async () => {
      const first = await app.request('/og/harmony/1/complementary', {}, TEST_ENV, execCtx);
      expect(first.status).toBe(200);
      await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));

      const second = await app.request('/og/harmony/1/complementary?algo=', {}, TEST_ENV, execCtx);
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
