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

});
