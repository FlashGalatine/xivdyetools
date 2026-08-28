/**
 * Rate-limit middleware backend selection (FINDING-003, 2026-08-21 audit).
 *
 * The `/v1/*` limiter must use the native Workers Rate Limiting binding when
 * `API_RATE_LIMITER` is bound (KV cannot throttle a fast client — 1 write/s/key
 * and swallowed put failures) and only fall back to KV when it is not.
 */

import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createApiRateLimitMiddleware } from './rate-limit';
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
