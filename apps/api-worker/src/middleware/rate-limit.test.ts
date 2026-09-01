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
    expect(binding.calls).toEqual(['api:ip:203.0.113.9', 'api:ip:203.0.113.9']);
    expect(kv.puts).toBe(0); // KV never touched when the binding is present
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
    expect(apiBinding.calls).toEqual(['api:ip:203.0.113.9']);
    expect(telemetryBinding.calls).toEqual([
      'telemetry:ip:203.0.113.9',
      'telemetry:ip:203.0.113.9',
      'telemetry:ip:203.0.113.9',
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
