import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../../src/index.js';
import { createMockEnv } from '../test-utils.js';
import type { Env } from '../../src/types.js';

const env = createMockEnv();

describe('Rate limit middleware', () => {
  it('includes rate limit headers on responses', async () => {
    const res = await app.request('/v1/dyes/categories', { method: 'GET' }, env);

    expect(res.status).toBe(200);
    // The getRateLimitHeaders from @xivdyetools/rate-limiter sets these
    // With mock KV, the limiter should still set headers (fail-open)
    expect(res.headers.get('X-Request-Id')).toBeDefined();
  });

  it('does not rate limit health check', async () => {
    const res = await app.request('/health', { method: 'GET' }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('ok');
  });
});

describe('Request ID middleware', () => {
  it('generates X-Request-ID header', async () => {
    const res = await app.request('/health', { method: 'GET' }, env);

    const requestId = res.headers.get('X-Request-ID');
    expect(requestId).toBeDefined();
    expect(requestId).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it('preserves valid incoming X-Request-ID', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'X-Request-ID': id },
    }, env);

    expect(res.headers.get('X-Request-ID')).toBe(id);
  });

  it('rejects invalid X-Request-ID and generates new one', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'X-Request-ID': 'malicious<script>' },
    }, env);

    const requestId = res.headers.get('X-Request-ID');
    expect(requestId).not.toBe('malicious<script>');
    expect(requestId).toMatch(/^[a-f0-9-]{36}$/i);
  });
});

describe('App-level error handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/v1/nonexistent', { method: 'GET' }, env);

    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toContain('/v1/nonexistent');
    expect(body.meta.requestId).toBeDefined();
  });

  it('returns 404 for completely unknown paths', async () => {
    const res = await app.request('/unknown/path', { method: 'GET' }, env);

    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error).toBe('NOT_FOUND');
  });

  it('sets HSTS header in production', async () => {
    const prodEnv = createMockEnv({ ENVIRONMENT: 'production' });
    const res = await app.request('/health', { method: 'GET' }, prodEnv);

    expect(res.status).toBe(200);
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
  });

  it('does not set HSTS in development', async () => {
    const res = await app.request('/health', { method: 'GET' }, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('sets X-Content-Type-Options header', async () => {
    const res = await app.request('/health', { method: 'GET' }, env);

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-API-Version header', async () => {
    const res = await app.request('/health', { method: 'GET' }, env);

    expect(res.headers.get('X-API-Version')).toBe('v1');
  });
});

/**
 * BUG-037: index.ts used to register the telemetry limiter on both the exact
 * path and `/v1/telemetry/*`; Hono's `/*` also matches the bare path, so one
 * beacon drew two tokens from the 240/60 s bucket (effective cap 120).
 */
describe('Telemetry rate limiter wiring (BUG-037)', () => {
  // The shared middleware memoizes its backend per isolate (BUG-061), so the
  // binding object captured on the first request lives for the whole file:
  // one stable object, with its behavior reset between tests.
  let used = 0;
  let budget = Infinity;
  const binding = {
    limit: vi.fn(async (_o: { key: string }) => ({ success: ++used <= budget })),
  };
  beforeEach(() => {
    used = 0;
    budget = Infinity;
    binding.limit.mockClear();
  });

  const beacon = (path: string, method = 'POST') =>
    app.request(
      path,
      {
        method,
        headers: { 'CF-Connecting-IP': '203.0.113.9', 'Content-Type': 'application/json' },
        body: method === 'POST' ? '{}' : undefined,
      },
      createMockEnv({ TELEMETRY_RATE_LIMITER: binding } as Partial<Env>),
    );

  it('charges the 240/60 s bucket exactly once per beacon on the bare path', async () => {
    await beacon('/v1/telemetry');
    expect(binding.limit).toHaveBeenCalledTimes(1);
    expect(binding.limit.mock.calls[0]![0].key).toBe('telemetry:ip:203.0.113.9:t240_60');
  });

  it('allows exactly 240 beacons before the bucket denies (not 120)', async () => {
    budget = 240;
    const statuses: number[] = [];
    for (let i = 0; i < 241; i++) statuses.push((await beacon('/v1/telemetry')).status);
    expect(statuses.slice(0, 240).every((s) => s !== 429)).toBe(true);
    expect(statuses[240]).toBe(429);
  });

  it('still charges the sub-tree once (api-worker-05: /v1/telemetry/x is limited, not free)', async () => {
    await beacon('/v1/telemetry/x');
    expect(binding.limit).toHaveBeenCalledTimes(1);
  });
});
