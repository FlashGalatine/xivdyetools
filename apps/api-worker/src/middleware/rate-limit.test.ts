/**
 * Rate-limit middleware backend selection (FINDING-003, 2026-08-21 audit).
 *
 * The `/v1/*` limiter must use the native Workers Rate Limiting binding when
 * `API_RATE_LIMITER` is bound (KV cannot throttle a fast client — 1 write/s/key
 * and swallowed put failures) and only fall back to KV when it is not.
 */

import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import {
  createApiRateLimitMiddleware,
  createTelemetryRateLimitMiddleware,
  isTelemetryPath,
} from './rate-limit';
import type { Env } from '../types';

function fakeBinding(outcomes: boolean[]): RateLimit & { calls: string[] } {
  const calls: string[] = [];
  let i = 0;
  return {
    calls,
    limit: async ({ key }: { key: string }) => {
      calls.push(key);
      const success = outcomes[Math.min(i, outcomes.length - 1)];
      i++;
      return { success };
    },
  } as unknown as RateLimit & { calls: string[] };
}

/** A rate-limit binding that is simply broken — every `limit()` rejects. */
function throwingBinding(): RateLimit {
  return {
    limit: () => Promise.reject(new Error('rate limiter unavailable')),
  } as unknown as RateLimit;
}

/** A KV namespace whose reads and writes reject (the fallback backend, broken). */
function throwingKV(): KVNamespace {
  const boom = (): Promise<never> => Promise.reject(new Error('KV unavailable'));
  return { get: boom, put: boom, delete: boom, list: boom } as unknown as KVNamespace;
}

function fakeKV(): KVNamespace & { puts: number } {
  const store = new Map<string, string>();
  const kv = {
    puts: 0,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      kv.puts++;
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
  };
  return kv as unknown as KVNamespace & { puts: number };
}

function buildApp(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  app.use('/v1/*', createApiRateLimitMiddleware());
  app.get('/v1/ping', (c) => c.json({ ok: true }));
  return app;
}

/** Mirrors index.ts: the API bucket skips /v1/telemetry, which has its own limiter. */
function buildAppWithTelemetry(onTelemetry?: () => void): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  app.use('/v1/*', createApiRateLimitMiddleware(isTelemetryPath));
  app.use('/v1/telemetry', createTelemetryRateLimitMiddleware());
  app.get('/v1/ping', (c) => c.json({ ok: true }));
  app.post('/v1/telemetry', (c) => {
    onTelemetry?.();
    return c.body(null, 204);
  });
  return app;
}

const baseEnv = (overrides: Partial<Env>): Env =>
  ({
    ENVIRONMENT: 'test',
    API_VERSION: 'v1',
    UNIVERSALIS_API_BASE: 'https://universalis.app/api/v2',
    RATE_LIMIT_REQUESTS: '60',
    RATE_LIMIT_WINDOW_SECONDS: '60',
    RATE_LIMIT: fakeKV(),
    ...overrides,
  }) as unknown as Env;

describe('api-worker rate-limit middleware backend selection', () => {
  it('uses the API_RATE_LIMITER binding when bound and returns 429 when it denies', async () => {
    const binding = fakeBinding([true, false]);
    const kv = fakeKV();
    const env = baseEnv({ API_RATE_LIMITER: binding, RATE_LIMIT: kv });
    const app = buildApp();
    const headers = { 'CF-Connecting-IP': '203.0.113.9' };

    const first = await app.request('/v1/ping', { headers }, env);
    const second = await app.request('/v1/ping', { headers }, env);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBeTruthy();
    // pkg-worker-kit-test-utils-05: the binding key carries the tier's
    // (limit, period) so two tiers cannot share one counter. The api tier
    // is 65 requests / 60s.
    expect(binding.calls).toEqual(['api:ip:203.0.113.9:t65_60', 'api:ip:203.0.113.9:t65_60']);
    expect(kv.puts).toBe(0); // KV never touched when the binding is present
  });

  it('gives our own workers (a service binding: no client IP) their own, 20x bucket', async () => {
    const apiBinding = fakeBinding([true]);
    const serviceBinding = fakeBinding([true, false]);
    const env = baseEnv({ API_RATE_LIMITER: apiBinding, SERVICE_RATE_LIMITER: serviceBinding });
    const app = buildApp();

    const first = await app.request('/v1/ping', {}, env);
    const second = await app.request('/v1/ping', {}, env);
    const publicCall = await app.request('/v1/ping', { headers: { 'CF-Connecting-IP': '203.0.113.9' } }, env);

    expect([first.status, second.status, publicCall.status]).toEqual([200, 429, 200]);
    // The bot's resolve calls never draw on a public IP's bucket, and vice versa
    expect(serviceBinding.calls).toEqual(['api:svc:workers:t1300_60', 'api:svc:workers:t1300_60']);
    expect(apiBinding.calls).toEqual(['api:ip:203.0.113.9:t65_60']);
  });

  it('gives /v1/telemetry its own bucket so beacons never consume the API bucket', async () => {
    const apiBinding = fakeBinding([true]);
    const telemetryBinding = fakeBinding([true, true, false]);
    const env = baseEnv({
      API_RATE_LIMITER: apiBinding,
      TELEMETRY_RATE_LIMITER: telemetryBinding,
    });
    const app = buildAppWithTelemetry();
    const headers = { 'CF-Connecting-IP': '203.0.113.9' };

    const beacon1 = await app.request('/v1/telemetry', { method: 'POST', headers }, env);
    const beacon2 = await app.request('/v1/telemetry', { method: 'POST', headers }, env);
    const beacon3 = await app.request('/v1/telemetry', { method: 'POST', headers }, env);
    const api = await app.request('/v1/ping', { headers }, env);

    expect([beacon1.status, beacon2.status, beacon3.status]).toEqual([204, 204, 429]);
    // The API bucket saw only the API call — three beacons never touched it.
    expect(apiBinding.calls).toEqual(['api:ip:203.0.113.9:t65_60']);
    expect(telemetryBinding.calls).toEqual([
      'telemetry:ip:203.0.113.9:t240_60',
      'telemetry:ip:203.0.113.9:t240_60',
      'telemetry:ip:203.0.113.9:t240_60',
    ]);
    expect(api.status).toBe(200);
  });

  it('an exhausted API bucket does not block telemetry (and vice versa)', async () => {
    const env = baseEnv({
      API_RATE_LIMITER: fakeBinding([false]),
      TELEMETRY_RATE_LIMITER: fakeBinding([true]),
    });
    const app = buildAppWithTelemetry();
    const headers = { 'CF-Connecting-IP': '203.0.113.9' };

    expect((await app.request('/v1/ping', { headers }, env)).status).toBe(429);
    expect((await app.request('/v1/telemetry', { method: 'POST', headers }, env)).status).toBe(204);
  });

  it('telemetry falls back to KV under its own key prefix when TELEMETRY_RATE_LIMITER is not bound', async () => {
    const kv = fakeKV();
    const env = baseEnv({ RATE_LIMIT: kv });
    const app = buildAppWithTelemetry();

    const res = await app.request(
      '/v1/telemetry',
      { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.9' } },
      env,
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('240');
    expect(kv.puts).toBe(1);
    expect((kv.put as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('telemetry:ip:');
  });

  // FINDING-014 (2026-08-29 audit): a broken telemetry backend used to let
  // unlimited batches through — up to 25 metered Analytics Engine writes each.
  // A dropped beacon costs nothing, so this bucket fails closed.
  it('fails closed when the telemetry binding errors: 429 and the handler never runs', async () => {
    const handler = vi.fn();
    const env = baseEnv({ TELEMETRY_RATE_LIMITER: throwingBinding() });
    const app = buildAppWithTelemetry(handler);

    const res = await app.request(
      '/v1/telemetry',
      { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.9' } },
      env,
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(((await res.json()) as any).error).toBe('RATE_LIMITED');
    expect(handler).not.toHaveBeenCalled();
  });

  it('fails closed when the telemetry KV fallback errors', async () => {
    const handler = vi.fn();
    const env = baseEnv({ RATE_LIMIT: throwingKV() });
    const app = buildAppWithTelemetry(handler);

    const res = await app.request(
      '/v1/telemetry',
      { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.9' } },
      env,
    );

    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps the API bucket fail-open: a broken backend still serves the request', async () => {
    const env = baseEnv({ API_RATE_LIMITER: throwingBinding() });
    const app = buildApp();

    const res = await app.request(
      '/v1/ping',
      { headers: { 'CF-Connecting-IP': '203.0.113.9' } },
      env,
    );

    expect(res.status).toBe(200);
  });

  it('falls back to the KV limiter when API_RATE_LIMITER is not bound', async () => {
    const kv = fakeKV();
    const env = baseEnv({ RATE_LIMIT: kv });
    const app = buildApp();

    const res = await app.request('/v1/ping', { headers: { 'CF-Connecting-IP': '203.0.113.9' } }, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('65');
    expect(kv.puts).toBe(1);
  });
});

// These exercise the application's extractors and selectors, not just the IP helper.
describe.each([
  { name: 'API', path: '/v1/ping', method: 'GET', status: 200, limit: 65, prefix: 'api:ip:', tier: 't65_60' },
  { name: 'telemetry', path: '/v1/telemetry', method: 'POST', status: 204, limit: 240, prefix: 'telemetry:ip:', tier: 't240_60' },
])('$name client identity', ({ path, method, status, limit, prefix, tier }) => {
  const first = '2001:db8:abcd:1234::1';
  const same = '2001:0DB8:ABCD:1234:ffff:ffff:ffff:ffff';
  const other = '2001:db8:abcd:1235::1';

  it('shares a native budget within /64 and separates other networks', async () => {
    const counts = new Map<string, number>();
    const binding = {
      limit: vi.fn(async ({ key }: { key: string }) => {
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return { success: count <= 1 };
      }),
    };
    const env = baseEnv({ API_RATE_LIMITER: binding, TELEMETRY_RATE_LIMITER: binding });
    const app = buildAppWithTelemetry();
    const statuses = [];
    for (const ip of [first, same, other]) {
      statuses.push((await app.request(path, { method, headers: {
        'CF-Connecting-IP': ip, 'X-Forwarded-For': '198.51.100.99',
      } }, env)).status);
    }
    expect(statuses).toEqual([status, 429, status]);
    expect([...counts.keys()]).toEqual([
      `${prefix}2001:db8:abcd:1234:::${tier}`,
      `${prefix}2001:db8:abcd:1235:::${tier}`,
    ]);
  });

  it('shares and exhausts the KV budget within /64 while another network remains free', async () => {
    // A fixed clock prevents a slow CI run from crossing the fixed-window boundary.
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    try {
      const env = baseEnv({});
      const app = buildAppWithTelemetry();
      const send = (ip: string) => app.request(path, { method, headers: { 'CF-Connecting-IP': ip } }, env);
      for (let i = 0; i < limit; i++) expect((await send(first)).status).toBe(status);
      expect((await send(same)).status).toBe(429);
      expect((await send(other)).status).toBe(status);
    } finally {
      now.mockRestore();
    }
  });

  it('shares mapped IPv4 KV identity and keeps XFF-only traffic on its existing scope', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    try {
      const env = baseEnv({});
      const app = buildAppWithTelemetry();
      const send = (ip?: string) => app.request(path, { method, headers: {
        ...(ip ? { 'CF-Connecting-IP': ip } : {}), 'X-Forwarded-For': first,
      } }, env);
      for (const [ip, remaining] of [
        ['203.0.113.9', limit - 1], ['::ffff:203.0.113.9', limit - 2],
        ['::ffff:cb00:7109', limit - 3], ['203.0.113.10', limit - 1],
      ] as const) {
        const res = await send(ip);
        expect(res.status).toBe(status);
        expect(res.headers.get('X-RateLimit-Remaining')).toBe(String(remaining));
      }
      const noIp = await send();
      const xffOnlyAgain = await send();
      expect([noIp.status, xffOnlyAgain.status]).toEqual([status, status]);
      expect(noIp.headers.get('X-RateLimit-Limit')).toBe(String(method === 'GET' ? 1300 : limit));
      expect(xffOnlyAgain.headers.get('X-RateLimit-Remaining')).toBe(String(method === 'GET' ? 1298 : limit - 2));
    } finally {
      clock.mockRestore();
    }
  });

  it('retains dotted IPv4 identity for mapped clients and ignores spoofed XFF', async () => {
    const binding = fakeBinding([true]);
    const service = fakeBinding([true]);
    const env = baseEnv({ API_RATE_LIMITER: binding, TELEMETRY_RATE_LIMITER: binding, SERVICE_RATE_LIMITER: service });
    const app = buildAppWithTelemetry();
    for (const ip of ['203.0.113.9', '::ffff:203.0.113.9', '::ffff:cb00:7109', '203.0.113.10']) {
      expect((await app.request(path, { method, headers: {
        'CF-Connecting-IP': ip, 'X-Forwarded-For': '198.51.100.99',
      } }, env)).status).toBe(status);
    }
    expect(binding.calls).toEqual([
      `${prefix}203.0.113.9:${tier}`, `${prefix}203.0.113.9:${tier}`,
      `${prefix}203.0.113.9:${tier}`, `${prefix}203.0.113.10:${tier}`,
    ]);
    // XFF alone must not assign a public identity to an IP-less service request.
    expect((await app.request(path, { method, headers: { 'X-Forwarded-For': first } }, env)).status).toBe(status);
    if (method === 'GET') {
      expect(service.calls).toEqual(['api:svc:workers:t1300_60']);
      expect(binding.calls).toHaveLength(4);
    } else {
      expect(binding.calls[4]).toBe('telemetry:ip:unknown:t240_60');
      expect(service.calls).toEqual([]);
    }
  });
});


describe('downstream quota header ownership', () => {
  it.each([false, true])('preserves downstream 429 budget headers (service: %s)', async (service) => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', createApiRateLimitMiddleware());
    app.get('/quota', (c) => c.json({ error: 'RATE_LIMITED' }, 429, {
      'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': '1234567890', 'Retry-After': '12', 'Cache-Control': 'no-store',
    }));
    const binding = fakeBinding([true]);
    const response = await app.request('/quota', service ? {} : { headers: { 'CF-Connecting-IP': '192.0.2.1' } }, baseEnv({ API_RATE_LIMITER: binding, SERVICE_RATE_LIMITER: binding }));
    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('30');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1234567890');
    expect(response.headers.get('Retry-After')).toBe('12');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it.each([200, 429])('keeps general admission headers when downstream status %s has no quota headers', async (status) => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', createApiRateLimitMiddleware());
    app.get('/quota', () => new Response('result', { status }));
    const response = await app.request('/quota', { headers: { 'CF-Connecting-IP': '192.0.2.1' } }, baseEnv({ API_RATE_LIMITER: fakeBinding([true]) }));
    expect(response.status).toBe(status);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('65');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('64');
    expect(response.headers.get('Retry-After')).toBeNull();
  });
  it('retains the general budget on success even if the handler sets a rate header', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', createApiRateLimitMiddleware());
    app.get('/quota', () => new Response('ok', { headers: { 'X-RateLimit-Limit': '30' } }));
    const response = await app.request('/quota', {}, baseEnv({ SERVICE_RATE_LIMITER: fakeBinding([true]) }));
    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('1300');
  });
  it('general admission denial stops the handler and reports its own budget', async () => {
    const app = new Hono<{ Bindings: Env }>();
    const handler = vi.fn(() => new Response('unreachable'));
    app.use('*', createApiRateLimitMiddleware());
    app.get('/quota', handler);
    const response = await app.request('/quota', {}, baseEnv({ SERVICE_RATE_LIMITER: fakeBinding([false]) }));
    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('1300');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(handler).not.toHaveBeenCalled();
  });
});
