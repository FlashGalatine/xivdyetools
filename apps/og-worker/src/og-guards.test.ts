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

  it('keys the cache on the full URL (lang/frame/algo vary the image)', async () => {
    await app.request('/og/harmony/1/complementary?lang=de', {}, TEST_ENV, execCtx);
    await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));
    await app.request('/og/harmony/1/complementary?lang=ja', {}, TEST_ENV, execCtx);
    expect(renderOGImage).toHaveBeenCalledTimes(2);
  });

  it('does not cache error responses', async () => {
    const res = await app.request('/og/swatch/ZZZZZZ/999', {}, TEST_ENV, execCtx);
    expect(res.status).toBe(400);
    await Promise.all(vi.mocked(execCtx.waitUntil).mock.calls.map(([p]) => p));
    expect(caches.store.size).toBe(0);
  });
});
