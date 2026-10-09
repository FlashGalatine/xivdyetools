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
import { SERVICE_BINDING_BUDGET_MULTIPLIER } from './config/service-budget';
import { resetAllMocks, createMockExecutionContext } from './test-setup';
import { createMockKV } from '@xivdyetools/test-utils';
import type { Env } from '../types';

const env = {
  ENVIRONMENT: 'production',
  API_VERSION: 'v1',
  UNIVERSALIS_API_BASE: 'https://universalis.example/api/v2',
  RATE_LIMIT_REQUESTS: '60',
  RATE_LIMIT_WINDOW_SECONDS: '60',
  // KV fallback backend for tests that bind no native rate-limit binding.
  RATE_LIMIT: createMockKV(),
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

  /**
   * FINDING-011: the proxy counts through native Workers Rate Limiting
   * bindings. A fake binding with a per-key counter stands in for the
   * runtime's: `limit({ key })` succeeds for the first `allowed` calls per key.
   */
  function fakeBinding(allowed: number) {
    const counts: Record<string, number> = {};
    return {
      counts,
      limit: vi.fn(async ({ key }: { key: string }) => {
        counts[key] = (counts[key] ?? 0) + 1;
        return { success: counts[key] <= allowed };
      }),
    };
  }

  const IP = { 'CF-Connecting-IP': '203.0.113.9' };
  const ctxFor = () => createMockExecutionContext() as unknown as ExecutionContext;
  const waitAll = (ctx: ExecutionContext) =>
    (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();
  const stubUpstream = () =>
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okJson({ results: [] }))));

  // FINDING-025 / API-7: the per-IP limiter is charged on cache misses only —
  // a fully cached answer is free, so a service-binding caller sharing one
  // bucket cannot throttle itself on repeats.
  it('charges the per-IP limiter only on cache misses (API-7)', async () => {
    const ipBinding = fakeBinding(1);
    const tightEnv = { ...env, UNIVERSALIS_RATE_LIMITER: ipBinding } as unknown as Env;
    const ctx = ctxFor();
    // BUG-048: send an IP. Without one this drives the SERVICE-BINDING bucket,
    // which has its own (much larger) budget — this test is about "charge on
    // miss only", and the per-IP path is the one it means.
    const tight = (path: string) => app.request(path, { headers: IP }, tightEnv, ctx);
    stubUpstream();

    const miss = await tight('/universalis/aggregated/Crystal/7001');
    expect(miss.status).toBe(200);
    expect(miss.headers.get('X-Cache')).toBe('MISS');
    await waitAll(ctx);
    expect(ipBinding.limit).toHaveBeenCalledTimes(1);

    const hit = await tight('/universalis/aggregated/Crystal/7001');
    expect(hit.status).toBe(200);
    expect(hit.headers.get('X-Cache')).toBe('HIT');
    // A cache hit never charges the limiter.
    expect(ipBinding.limit).toHaveBeenCalledTimes(1);

    const secondMiss = await tight('/universalis/aggregated/Crystal/7002');
    expect(secondMiss.status).toBe(429);
    expect(ipBinding.limit).toHaveBeenCalledTimes(2);
  });

  it('answers 429 with the unchanged body, Retry-After and X-RateLimit headers', async () => {
    const ipBinding = fakeBinding(0);
    const tightEnv = {
      ...env,
      RATE_LIMIT_REQUESTS: '30',
      UNIVERSALIS_RATE_LIMITER: ipBinding,
    } as unknown as Env;
    stubUpstream();

    const res = await app.request(
      '/universalis/aggregated/Crystal/7101',
      { headers: IP },
      tightEnv,
      ctxFor()
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string; retryAfter: number };
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.retryAfter).toBeGreaterThanOrEqual(1);
    expect(body.retryAfter).toBeLessThanOrEqual(60);
    expect(res.headers.get('Retry-After')).toBe(String(body.retryAfter));
    expect(res.headers.get('X-RateLimit-Limit')).toBe('30');
    // The binding reports no count: denied is always 0.
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('counts per-IP traffic on UNIVERSALIS_RATE_LIMITER under the universalis:ip: prefix', async () => {
    const ipBinding = fakeBinding(5);
    const svcBinding = fakeBinding(5);
    const e = {
      ...env,
      UNIVERSALIS_RATE_LIMITER: ipBinding,
      UNIVERSALIS_SERVICE_RATE_LIMITER: svcBinding,
    } as unknown as Env;
    stubUpstream();

    const res = await app.request('/universalis/aggregated/Crystal/7201', { headers: IP }, e, ctxFor());
    expect(res.status).toBe(200);
    expect(ipBinding.limit).toHaveBeenCalledTimes(1);
    expect(svcBinding.limit).not.toHaveBeenCalled();
    const key = ipBinding.limit.mock.calls[0]![0].key;
    expect(key.startsWith('universalis:ip:203.0.113.9')).toBe(true);
  });

  /**
   * BUG-048: every IP-less caller shared one public-sized bucket. discord-worker
   * builds its sub-request with no `CF-Connecting-IP`, so `getClientIp`
   * returned the literal `'unknown'` and the ENTIRE bot fleet competed for the
   * same 30/minute allowance — once ~30 *distinct* datacenter/item pairs missed
   * the cache in one window, the 31st `/budget` in ANY guild got a 429. The
   * "charge on miss only" mitigation above protects repeats of the SAME key,
   * which is not the pattern `/budget` produces: every new dye/world pair is a
   * fresh miss. Service-binding traffic now draws on its own binding, key and
   * 20x budget.
   */
  it('routes service-binding traffic to its own binding and key, not the per-IP one', async () => {
    const ipBinding = fakeBinding(0); // would 429 everything if it were consulted
    const svcBinding = fakeBinding(20);
    const e = {
      ...env,
      RATE_LIMIT_REQUESTS: '1',
      UNIVERSALIS_RATE_LIMITER: ipBinding,
      UNIVERSALIS_SERVICE_RATE_LIMITER: svcBinding,
    } as unknown as Env;
    const ctx = ctxFor();
    // No CF-Connecting-IP: exactly the shape discord-worker produces.
    stubUpstream();

    const first = await app.request('/universalis/aggregated/Crystal/8001', {}, e, ctx);
    const second = await app.request('/universalis/aggregated/Crystal/8002', {}, e, ctx);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers.get('X-Cache')).toBe('MISS');
    expect(ipBinding.limit).not.toHaveBeenCalled();
    expect(svcBinding.limit).toHaveBeenCalledTimes(2);
    const key = svcBinding.limit.mock.calls[0]![0].key;
    expect(key.startsWith('universalis:svc:svc:universalis')).toBe(true);
  });

  it('still bounds service-binding traffic at 20x — the bucket is separate, not absent', async () => {
    // 20x RATE_LIMIT_REQUESTS = 20 misses before the ceiling.
    const svcBinding = fakeBinding(20);
    const e = {
      ...env,
      RATE_LIMIT_REQUESTS: '1',
      UNIVERSALIS_SERVICE_RATE_LIMITER: svcBinding,
    } as unknown as Env;
    const ctx = ctxFor();
    stubUpstream();

    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) {
      const res = await app.request(`/universalis/aggregated/Crystal/${9000 + i}`, {}, e, ctx);
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 20).every((st) => st === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
    expect(statuses[21]).toBe(429);
  });

  // BUG-039: on the binding path the multiplier only feeds the reported
  // limit (and the KV fallback budget), so nothing else failed when it drifted.
  it('reports the service-scope limit as RATE_LIMIT_REQUESTS x the shared multiplier on a 429', async () => {
    const svcBinding = fakeBinding(0);
    const e = {
      ...env,
      RATE_LIMIT_REQUESTS: '30',
      UNIVERSALIS_SERVICE_RATE_LIMITER: svcBinding,
    } as unknown as Env;
    stubUpstream();

    const res = await app.request('/universalis/aggregated/Crystal/9901', {}, e, ctxFor());
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBe(String(30 * SERVICE_BINDING_BUDGET_MULTIPLIER));
  });

  it('falls back to KV (universalis:ip: prefix) when no binding is bound', async () => {
    const kv = createMockKV();
    const e = { ...env, RATE_LIMIT_REQUESTS: '1', RATE_LIMIT: kv } as unknown as Env;
    const ctx = ctxFor();
    stubUpstream();

    const first = await app.request('/universalis/aggregated/Crystal/7301', { headers: IP }, e, ctx);
    const second = await app.request('/universalis/aggregated/Crystal/7302', { headers: IP }, e, ctx);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    const keys = (await kv.list({ prefix: 'universalis:' })).keys.map((k) => k.name);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k.startsWith('universalis:ip:'))).toBe(true);
  });

  it('falls back to KV under universalis:svc: for service-binding traffic', async () => {
    const kv = createMockKV();
    const e = { ...env, RATE_LIMIT: kv } as unknown as Env;
    stubUpstream();

    const res = await app.request('/universalis/aggregated/Crystal/7401', {}, e, ctxFor());

    expect(res.status).toBe(200);
    const keys = (await kv.list({ prefix: 'universalis:' })).keys.map((k) => k.name);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k.startsWith('universalis:svc:'))).toBe(true);
  });

  it('fails open when the rate-limit binding throws', async () => {
    const broken = {
      limit: vi.fn(async () => {
        throw new Error('binding unavailable');
      }),
    };
    const e = { ...env, UNIVERSALIS_RATE_LIMITER: broken } as unknown as Env;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    stubUpstream();

    const res = await app.request('/universalis/aggregated/Crystal/7501', { headers: IP }, e, ctxFor());

    expect(res.status).toBe(200);
    expect(broken.limit).toHaveBeenCalled();
  });

  it('does not log the client IP when failing open', async () => {
    const broken = {
      limit: vi.fn(async () => {
        throw new Error('binding unavailable');
      }),
    };
    const e = { ...env, UNIVERSALIS_RATE_LIMITER: broken } as unknown as Env;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    stubUpstream();

    await app.request('/universalis/aggregated/Crystal/7502', { headers: IP }, e, ctxFor());

    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('203.0.113.9');
  });

  it('surfaces a misnamed binding as a failure instead of a silent unlimited proxy', async () => {
    // A bound value with no callable limit() — a wrangler name typo / wrong kind.
    const e = { ...env, UNIVERSALIS_RATE_LIMITER: {} } as unknown as Env;
    const fetchMock = vi.fn(() => Promise.resolve(okJson({ results: [] })));
    vi.stubGlobal('fetch', fetchMock);

    const res = await app.request('/universalis/aggregated/Crystal/7601', { headers: IP }, e, ctxFor());

    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
