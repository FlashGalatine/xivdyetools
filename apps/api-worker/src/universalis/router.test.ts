/**
 * Route tests for the absorbed Universalis proxy.
 *
 * Successor to the retired apps/universalis-proxy `index.test.ts` — the CORS /
 * health / notFound suites there tested worker-level plumbing that api-worker
 * now owns; these tests cover the router itself on both mounts. The
 * cache/coalesce/fetch internals keep their own co-located unit tests under
 * ./services and ./config.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { universalisRouter } from './router';
import { resetAllMocks, createMockExecutionContext } from './test-setup';
import { clearRateLimits } from './services/rate-limiter';
import type { Env } from '../types';

const env = {
  ENVIRONMENT: 'production',
  API_VERSION: 'v1',
  UNIVERSALIS_API_BASE: 'https://universalis.example/api/v2',
  RATE_LIMIT_REQUESTS: '60',
  RATE_LIMIT_WINDOW_SECONDS: '60',
} as unknown as Env;

const app = new Hono<{ Bindings: Env }>();
app.route('/universalis', universalisRouter);
app.route('/api/v2', universalisRouter);

const request = (path: string) =>
  app.request(path, {}, env, createMockExecutionContext() as unknown as ExecutionContext);

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('universalis router', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('proxies aggregated data un-enveloped on the canonical mount', async () => {
    const upstream = { results: [{ itemId: 5729, nq: { minListing: { dc: { price: 100 } } } }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(upstream)));

    const res = await request('/universalis/aggregated/Crystal/5729');
    expect(res.status).toBe(200);
    // Raw Universalis shape — NOT the api-worker {success,data,meta} envelope
    expect(await res.json()).toEqual(upstream);
    expect(res.headers.get('X-Cache')).toBe('MISS');
  });

  it('serves the same routes on the /api/v2 compatibility mount', async () => {
    const upstream = { results: [{ itemId: 5730 }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(upstream)));

    const res = await request('/api/v2/aggregated/Crystal/5730');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(upstream);
  });

  it('normalizes item IDs into the upstream URL (dedupe + sort)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ results: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await request('/universalis/aggregated/Crystal/5731,5729,5731');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/aggregated/crystal/5729,5731?listings=5&entries=5'),
      expect.anything()
    );
  });

  it('proxies data-centers and worlds lists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson([{ name: 'Crystal' }])));
    const dc = await request('/universalis/data-centers');
    expect(dc.status).toBe(200);
    expect(await dc.json()).toEqual([{ name: 'Crystal' }]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson([{ id: 91, name: 'Balmung' }])));
    const worlds = await request('/api/v2/worlds');
    expect(worlds.status).toBe(200);
    expect(await worlds.json()).toEqual([{ id: 91, name: 'Balmung' }]);
  });

  // Runs after the list tests above: the module-scope cache handle in
  // cache-service outlives resetAllMocks, so the BUG-029 fallback below hits
  // the already-cached real lists (which don't contain the bogus name).
  it('rejects an unknown datacenter after the live-list fallback misses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson([])));
    const res = await request('/universalis/aggregated/NotARealPlace/5729');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid datacenter or world name' });
  });

  it('rejects malformed itemIds', async () => {
    const res = await request('/universalis/aggregated/Crystal/abc');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid itemIds parameter' });
  });

  it('rejects more than 100 item IDs', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => 10000 + i).join(',');
    const res = await request(`/universalis/aggregated/Crystal/${ids}`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Item count must be between 1 and 100');
  });

  it('rejects out-of-range item IDs', async () => {
    const res = await request('/universalis/aggregated/Crystal/2000000');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { invalidIds: number[] };
    expect(body.invalidIds).toEqual([2000000]);
  });

  it('maps upstream 429 to 429 with Retry-After', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }))
    );
    const res = await request('/universalis/aggregated/Crystal/48163');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  // FINDING-025 / API-8: upstream statusText and raw Error.message are
  // implementation detail — log them, answer with a constant.
  it('does not echo upstream statusText or internal error messages (API-8)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('x', { status: 404, statusText: 'Secret Upstream Detail' }))
    );
    const notFound = await request('/universalis/aggregated/Crystal/48164');
    expect(notFound.status).toBe(404);
    const notFoundBody = (await notFound.json()) as { error: string; message?: string };
    expect(notFoundBody.error).toBe('Upstream API error: 404');
    expect(JSON.stringify(notFoundBody)).not.toContain('Secret Upstream Detail');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNRESET at node:internal/undici/index.js:42'))
    );
    const failed = await request('/universalis/aggregated/Crystal/48165');
    expect(failed.status).toBe(502);
    const failedBody = (await failed.json()) as { error: string };
    expect(failedBody.error).toBe('Failed to fetch from upstream API');
    expect(JSON.stringify(failedBody)).not.toContain('ECONNRESET');
  });

  // FINDING-025 / API-7: the per-IP limiter is charged on cache misses only —
  // a fully cached answer is free, so a service-binding caller sharing one
  // bucket cannot throttle itself on repeats.
  it('charges the per-IP limiter only on cache misses (API-7)', async () => {
    await clearRateLimits();
    const tightEnv = { ...env, RATE_LIMIT_REQUESTS: '1' } as unknown as Env;
    const ctx = createMockExecutionContext() as unknown as ExecutionContext;
    // BUG-048: send an IP. Without one this drives the SERVICE-BINDING bucket,
    // which now has its own (much larger) budget — so the assertion below would
    // be measuring the wrong path. This test is about "charge on miss only",
    // not about which bucket, and the per-IP path is the one it means.
    const tight = (path: string) =>
      app.request(path, { headers: { 'CF-Connecting-IP': '203.0.113.9' } }, tightEnv, ctx);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okJson({ results: [] }))));

    const miss = await tight('/universalis/aggregated/Crystal/7001');
    expect(miss.status).toBe(200);
    expect(miss.headers.get('X-Cache')).toBe('MISS');
    await (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();

    const hit = await tight('/universalis/aggregated/Crystal/7001');
    expect(hit.status).toBe(200);
    expect(hit.headers.get('X-Cache')).toBe('HIT');

    const secondMiss = await tight('/universalis/aggregated/Crystal/7002');
    expect(secondMiss.status).toBe(429);
    expect(secondMiss.headers.get('Retry-After')).toBeTruthy();
    await clearRateLimits();
  });

  /**
   * BUG-048: every IP-less caller shared one public-sized bucket. discord-worker
   * builds its sub-request with no `CF-Connecting-IP`, so `getClientIp`
   * returned the literal `'unknown'` and the ENTIRE bot fleet competed for the
   * same 30/minute allowance — once ~30 *distinct* datacenter/item pairs missed
   * the cache in one window, the 31st `/budget` in ANY guild got a 429. The
   * "charge on miss only" mitigation above protects repeats of the SAME key,
   * which is not the pattern `/budget` produces: every new dye/world pair is a
   * fresh miss.
   *
   * The old suite could not see this — it drove `app.request` with no IP, so it
   * WAS the shared bucket, and with one caller the sharing is invisible.
   */
  it('does not throttle service-binding traffic at the public per-IP budget', async () => {
    await clearRateLimits();
    const tightEnv = { ...env, RATE_LIMIT_REQUESTS: '1' } as unknown as Env;
    const ctx = createMockExecutionContext() as unknown as ExecutionContext;
    // No CF-Connecting-IP: exactly the shape discord-worker produces.
    const svc = (path: string) => app.request(path, {}, tightEnv, ctx);
    // A fresh Response per call: a body can only be read once, and this test
    // makes several distinct (i.e. uncached) requests.
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okJson({ results: [] }))));

    // Two DISTINCT keys, so both are misses and both charge the limiter. On
    // the public budget of 1 the second would be a 429.
    const first = await svc('/universalis/aggregated/Crystal/8001');
    const second = await svc('/universalis/aggregated/Crystal/8002');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers.get('X-Cache')).toBe('MISS');
    await clearRateLimits();
  });

  it('still bounds service-binding traffic — the bucket is separate, not absent', async () => {
    await clearRateLimits();
    // 1 × the 20× multiplier = 20 misses before the ceiling.
    const tightEnv = { ...env, RATE_LIMIT_REQUESTS: '1' } as unknown as Env;
    const ctx = createMockExecutionContext() as unknown as ExecutionContext;
    const svc = (path: string) => app.request(path, {}, tightEnv, ctx);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okJson({ results: [] }))));

    let lastStatus = 200;
    for (let i = 0; i < 22; i++) {
      const res = await svc(`/universalis/aggregated/Crystal/${9000 + i}`);
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
    await clearRateLimits();
  });

});
