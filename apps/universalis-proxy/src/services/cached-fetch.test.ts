/**
 * Tests for cached-fetch - main orchestration for Cache API caching
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { cachedFetch, buildCacheHeaders, UpstreamError } from './cached-fetch';
import { createMockExecutionContext, resetAllMocks } from '../test-setup';
import type { CacheConfig, CacheSource } from '../types/cache';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('cachedFetch', () => {
  let mockCtx: ReturnType<typeof createMockExecutionContext>;
  const baseUrl = 'https://test.example.com';
  const upstreamUrl = 'https://universalis.app/api/v2/aggregated/Crystal/12345';

  const testConfig: CacheConfig = {
    cacheTtl: 300,
    swrWindow: 120,
    keyPrefix: 'test',
  };

  beforeEach(() => {
    resetAllMocks();
    mockCtx = createMockExecutionContext();
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cache miss - upstream fetch', () => {
    it('should fetch from upstream when cache is empty', async () => {
      const upstreamData = { items: [{ id: 1, price: 100 }] };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(upstreamData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await cachedFetch({
        cacheKey: 'test-key',
        config: testConfig,
        upstreamUrl,
        ctx: mockCtx,
        baseUrl,
      });

      expect(result.data).toEqual(upstreamData);
      expect(result.source).toBe('upstream');
      expect(result.isStale).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(upstreamUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': expect.stringContaining('XIVDyeTools'),
        },
      });
    });

    it('should throw UpstreamError on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        })
      );

      await expect(
        cachedFetch({
          cacheKey: 'missing-key',
          config: testConfig,
          upstreamUrl,
          ctx: mockCtx,
          baseUrl,
        })
      ).rejects.toThrow(UpstreamError);
    });

    it('should store fetched data in cache', async () => {
      const upstreamData = { items: [{ id: 1, price: 100 }] };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(upstreamData), {
          status: 200,
        })
      );

      await cachedFetch({
        cacheKey: 'store-test',
        config: testConfig,
        upstreamUrl,
        ctx: mockCtx,
        baseUrl,
      });

      // waitUntil should be called to store to cache
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });
  });

  describe('cache hit - Cache API', () => {
    it('should return fresh data from Cache API', async () => {
      const cachedData = { items: [{ id: 1, price: 100 }] };
      const now = Date.now();

      // Pre-populate Cache API
      const cache = await caches.open('universalis-proxy');
      const cacheUrl = `${baseUrl}/__cache/cache-hit-test`;
      const response = new Response(JSON.stringify(cachedData), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cached-At': String(now),
          'X-Cache-TTL': '300',
          'X-SWR-Window': '120',
        },
      });
      await cache.put(new Request(cacheUrl), response);

      const result = await cachedFetch({
        cacheKey: 'cache-hit-test',
        config: testConfig,
        upstreamUrl,
        ctx: mockCtx,
        baseUrl,
      });

      expect(result.data).toEqual(cachedData);
      expect(result.source).toBe('cache-api');
      expect(result.isStale).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return stale data and trigger background revalidation', async () => {
      const cachedData = { items: [{ id: 1, price: 100 }] };
      const now = Date.now();
      const cachedAt = now - 350 * 1000; // Beyond TTL but within SWR

      // Pre-populate Cache API with stale data
      const cache = await caches.open('universalis-proxy');
      const cacheUrl = `${baseUrl}/__cache/stale-test`;
      const response = new Response(JSON.stringify(cachedData), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cached-At': String(cachedAt),
          'X-Cache-TTL': '300',
          'X-SWR-Window': '120',
        },
      });
      await cache.put(new Request(cacheUrl), response);

      // Mock the background revalidation fetch
      const freshData = { items: [{ id: 1, price: 150 }] };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(freshData), { status: 200 })
      );

      const result = await cachedFetch({
        cacheKey: 'stale-test',
        config: testConfig,
        upstreamUrl,
        ctx: mockCtx,
        baseUrl,
      });

      expect(result.data).toEqual(cachedData);
      expect(result.source).toBe('cache-api');
      expect(result.isStale).toBe(true);
      // Background revalidation should be triggered
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });
  });
});

describe('UpstreamError', () => {
  it('should create error with correct properties', () => {
    const error = new UpstreamError(404, 'Not Found');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error.name).toBe('UpstreamError');
    expect(error.status).toBe(404);
    expect(error.statusText).toBe('Not Found');
    expect(error.message).toBe('Upstream API error: 404 Not Found');
  });

  it('should handle different status codes', () => {
    const errors = [
      new UpstreamError(400, 'Bad Request'),
      new UpstreamError(429, 'Too Many Requests'),
      new UpstreamError(500, 'Internal Server Error'),
      new UpstreamError(502, 'Bad Gateway'),
      new UpstreamError(503, 'Service Unavailable'),
    ];

    errors.forEach((error) => {
      expect(error.status).toBeGreaterThanOrEqual(400);
      expect(error.statusText).toBeTruthy();
    });
  });
});

describe('buildCacheHeaders', () => {
  const testConfig: CacheConfig = {
    cacheTtl: 300,
    swrWindow: 120,
    keyPrefix: 'test',
  };

  it('should return MISS for upstream source', () => {
    const headers = buildCacheHeaders('upstream', false, testConfig);

    expect(headers['X-Cache']).toBe('MISS');
    expect(headers['X-Cache-Source']).toBe('upstream');
    expect(headers['X-Cache-Stale']).toBe('false');
    expect(headers['Cache-Control']).toBe('public, max-age=300');
  });

  it('should return HIT for cache-api source', () => {
    const headers = buildCacheHeaders('cache-api', false, testConfig);

    expect(headers['X-Cache']).toBe('HIT');
    expect(headers['X-Cache-Source']).toBe('cache-api');
    expect(headers['X-Cache-Stale']).toBe('false');
  });

  it('should mark stale data correctly', () => {
    const headers = buildCacheHeaders('cache-api', true, testConfig);

    expect(headers['X-Cache']).toBe('HIT');
    expect(headers['X-Cache-Stale']).toBe('true');
  });

  it('should use config cacheTtl for Cache-Control', () => {
    const customConfig: CacheConfig = {
      ...testConfig,
      cacheTtl: 86400,
    };

    const headers = buildCacheHeaders('cache-api', false, customConfig);
    expect(headers['Cache-Control']).toBe('public, max-age=86400');
  });

  it('should handle all cache sources', () => {
    const sources: CacheSource[] = ['cache-api', 'upstream'];

    sources.forEach((source) => {
      const headers = buildCacheHeaders(source, false, testConfig);
      expect(headers['X-Cache-Source']).toBe(source);
    });
  });
});
