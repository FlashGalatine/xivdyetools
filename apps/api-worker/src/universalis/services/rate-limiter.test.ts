/**
 * FINDING-011: the Universalis proxy's backend selector and seconds-based adapter.
 */
import { describe, it, expect, vi } from 'vitest';
import { createMockKV } from '@xivdyetools/test-utils';
import { CloudflareRateLimiter, KVRateLimiter } from '@xivdyetools/worker-kit/rate-limiter';
import { checkRateLimit, getRateLimitHeaders, selectProxyRateLimiter } from './rate-limiter';
import type { Env } from '../../types';

const config = { maxRequests: 30, windowSeconds: 60 };
const binding = () => ({ limit: vi.fn(async () => ({ success: true })) });
const envWith = (extra: Record<string, unknown>) =>
  ({ RATE_LIMIT: createMockKV(), ...extra }) as unknown as Env;

describe('selectProxyRateLimiter', () => {
  it('uses the per-IP binding for the ip scope', async () => {
    const ip = binding();
    const svc = binding();
    const env = envWith({ UNIVERSALIS_RATE_LIMITER: ip, UNIVERSALIS_SERVICE_RATE_LIMITER: svc });
    const limiter = selectProxyRateLimiter(env, 'ip', config);
    expect(limiter).toBeInstanceOf(CloudflareRateLimiter);
    await checkRateLimit(limiter, '203.0.113.9', config);
    expect(ip.limit).toHaveBeenCalledTimes(1);
    expect(svc.limit).not.toHaveBeenCalled();
  });

  it('uses the service binding for the service scope', async () => {
    const ip = binding();
    const svc = binding();
    const env = envWith({ UNIVERSALIS_RATE_LIMITER: ip, UNIVERSALIS_SERVICE_RATE_LIMITER: svc });
    const limiter = selectProxyRateLimiter(env, 'service', { ...config, maxRequests: 600 });
    await checkRateLimit(limiter, 'svc:universalis', { ...config, maxRequests: 600 });
    expect(svc.limit).toHaveBeenCalledTimes(1);
    expect(ip.limit).not.toHaveBeenCalled();
  });

  it('falls back to KV for each scope when its binding is absent', () => {
    expect(selectProxyRateLimiter(envWith({}), 'ip', config)).toBeInstanceOf(KVRateLimiter);
    expect(selectProxyRateLimiter(envWith({}), 'service', config)).toBeInstanceOf(KVRateLimiter);
    // The other scope's binding does not leak across.
    const onlySvc = envWith({ UNIVERSALIS_SERVICE_RATE_LIMITER: binding() });
    expect(selectProxyRateLimiter(onlySvc, 'ip', config)).toBeInstanceOf(KVRateLimiter);
  });

  it('throws at construction for a binding with no callable limit()', () => {
    expect(() =>
      selectProxyRateLimiter(envWith({ UNIVERSALIS_RATE_LIMITER: {} }), 'ip', config)
    ).toThrow(/no callable binding/);
  });
});

describe('checkRateLimit', () => {
  it('reports limit - 1 remaining while allowed (binding semantics)', async () => {
    const env = envWith({ UNIVERSALIS_RATE_LIMITER: binding() });
    const result = await checkRateLimit(selectProxyRateLimiter(env, 'ip', config), 'k', config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });

  it('reports 0 remaining and a 1-60 s reset when denied', async () => {
    const denied = { limit: vi.fn(async () => ({ success: false })) };
    const env = envWith({ UNIVERSALIS_RATE_LIMITER: denied });
    const result = await checkRateLimit(selectProxyRateLimiter(env, 'ip', config), 'k', config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetInSeconds).toBeGreaterThanOrEqual(1);
    expect(result.resetInSeconds).toBeLessThanOrEqual(60);
  });

  it('fails open when the backend errors', async () => {
    const broken = {
      limit: vi.fn(async () => {
        throw new Error('down');
      }),
    };
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const env = envWith({ UNIVERSALIS_RATE_LIMITER: broken });
    const result = await checkRateLimit(selectProxyRateLimiter(env, 'ip', config), 'k', config);
    expect(result.allowed).toBe(true);
  });
});

describe('getRateLimitHeaders', () => {
  it('formats the three X-RateLimit headers', () => {
    const headers = getRateLimitHeaders({ allowed: false, remaining: 0, resetInSeconds: 30 }, 30);
    expect(headers['X-RateLimit-Limit']).toBe('30');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
    expect(Number(headers['X-RateLimit-Reset'])).toBeGreaterThan(Date.now() / 1000);
  });
});
