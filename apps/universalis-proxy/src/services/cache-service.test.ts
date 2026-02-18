/**
 * Tests for CacheService - Cache API caching
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CacheService } from './cache-service';
import {
  createMockExecutionContext,
  resetAllMocks,
} from '../test-setup';
import type { CacheConfig } from '../types/cache';

describe('CacheService', () => {
  let mockCtx: ReturnType<typeof createMockExecutionContext>;
  let cacheService: CacheService;
  const baseUrl = 'https://test.example.com';

  const testConfig: CacheConfig = {
    cacheTtl: 300,
    swrWindow: 120,
    keyPrefix: 'test',
  };

  beforeEach(() => {
    resetAllMocks();
    mockCtx = createMockExecutionContext();
    cacheService = new CacheService(mockCtx, baseUrl);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get', () => {
    it('should return null when cache is empty', async () => {
      const result = await cacheService.get('nonexistent-key');
      expect(result).toBeNull();
    });

    it('should return cached response when available', async () => {
      const testData = { items: [1, 2, 3] };
      const now = Date.now();

      // Manually populate the cache
      const cache = await caches.open('universalis-proxy');
      const cacheUrl = `${baseUrl}/__cache/test-key`;
      const response = new Response(JSON.stringify(testData), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cached-At': String(now),
          'X-Cache-TTL': '300',
          'X-SWR-Window': '120',
        },
      });
      await cache.put(new Request(cacheUrl), response);

      const result = await cacheService.get('test-key');
      expect(result).not.toBeNull();
      expect(result?.isStale).toBe(false);

      const data = await result?.response.json();
      expect(data).toEqual(testData);
    });

    it('should mark data as stale when beyond TTL but within SWR window', async () => {
      const testData = { items: [1, 2, 3] };
      const now = Date.now();
      const cachedAt = now - 350 * 1000; // 350 seconds ago (beyond 300s TTL, within 420s total)

      const cache = await caches.open('universalis-proxy');
      const cacheUrl = `${baseUrl}/__cache/stale-key`;
      const response = new Response(JSON.stringify(testData), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cached-At': String(cachedAt),
          'X-Cache-TTL': '300',
          'X-SWR-Window': '120',
        },
      });
      await cache.put(new Request(cacheUrl), response);

      const result = await cacheService.get('stale-key');
      expect(result).not.toBeNull();
      expect(result?.isStale).toBe(true);
    });

    it('should return null and delete when beyond SWR window', async () => {
      const testData = { items: [1, 2, 3] };
      const now = Date.now();
      const cachedAt = now - 500 * 1000; // 500 seconds ago (beyond 420s total window)

      const cache = await caches.open('universalis-proxy');
      const cacheUrl = `${baseUrl}/__cache/expired-key`;
      const response = new Response(JSON.stringify(testData), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cached-At': String(cachedAt),
          'X-Cache-TTL': '300',
          'X-SWR-Window': '120',
        },
      });
      await cache.put(new Request(cacheUrl), response);

      const result = await cacheService.get('expired-key');
      expect(result).toBeNull();

      // Check that waitUntil was called for deletion
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      const originalCaches = (globalThis as unknown as { caches: CacheStorage }).caches;
      // @ts-expect-error - Intentionally setting undefined for testing
      globalThis.caches = undefined;

      const service = new CacheService(mockCtx, baseUrl);
      const result = await service.get('any-key');
      expect(result).toBeNull();

      (globalThis as unknown as { caches: CacheStorage }).caches = originalCaches;
    });
  });

  describe('store', () => {
    it('should store data in Cache API with correct headers', async () => {
      const testData = { items: [1, 2, 3] };
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      await cacheService.store('store-test', testData, testConfig);

      const cache = await caches.open('universalis-proxy');
      const cacheUrl = `${baseUrl}/__cache/store-test`;
      const cached = await cache.match(new Request(cacheUrl));

      expect(cached).toBeDefined();
      expect(cached?.headers.get('Content-Type')).toBe('application/json');
      expect(cached?.headers.get('X-Cache-TTL')).toBe('300');
      expect(cached?.headers.get('X-SWR-Window')).toBe('120');
      expect(cached?.headers.get('Cache-Control')).toBe('public, max-age=420'); // TTL + SWR
    });

    it('should do nothing when caches is undefined', async () => {
      const originalCaches = (globalThis as unknown as { caches: CacheStorage }).caches;
      // @ts-expect-error - Intentionally setting undefined for testing
      globalThis.caches = undefined;

      const service = new CacheService(mockCtx, baseUrl);
      // Should not throw
      await service.store('key', { data: 'test' }, testConfig);

      (globalThis as unknown as { caches: CacheStorage }).caches = originalCaches;
    });
  });

  describe('storeAsync', () => {
    it('should store to cache asynchronously', async () => {
      const testData = { items: [1, 2, 3] };

      cacheService.storeAsync('async-test', testData, testConfig);

      // waitUntil should have been called
      expect(mockCtx.waitUntil).toHaveBeenCalled();

      // Wait for the async operations
      await (mockCtx as unknown as { _waitForAll: () => Promise<void> })._waitForAll();

      // Check Cache API
      const cache = await caches.open('universalis-proxy');
      const cacheUrl = `${baseUrl}/__cache/async-test`;
      const cached = await cache.match(new Request(cacheUrl));
      expect(cached).toBeDefined();
    });
  });

  describe('deleteEntry', () => {
    it('should delete from cache', async () => {
      const testData = { items: [1, 2, 3] };

      // First, store data
      await cacheService.store('delete-test', testData, testConfig);

      // Verify data exists
      const cache = await caches.open('universalis-proxy');
      const cacheUrl = `${baseUrl}/__cache/delete-test`;
      expect(await cache.match(new Request(cacheUrl))).toBeDefined();

      // Delete
      await cacheService.deleteEntry('delete-test');

      // Verify deleted
      expect(await cache.match(new Request(cacheUrl))).toBeUndefined();
    });
  });

  describe('deleteAsync', () => {
    it('should delete from cache asynchronously', async () => {
      const testData = { items: [1, 2, 3] };

      // First, store data
      await cacheService.store('delete-async-test', testData, testConfig);

      // Delete async
      cacheService.deleteAsync('delete-async-test');
      await (mockCtx as unknown as { _waitForAll: () => Promise<void> })._waitForAll();

      // Verify deleted
      const cache = await caches.open('universalis-proxy');
      const cacheUrl = `${baseUrl}/__cache/delete-async-test`;
      expect(await cache.match(new Request(cacheUrl))).toBeUndefined();
    });

    it('should handle errors gracefully during deletion', async () => {
      // This should not throw even with no data
      cacheService.deleteAsync('nonexistent-key');
      await (mockCtx as unknown as { _waitForAll: () => Promise<void> })._waitForAll();
    });
  });

  describe('URL encoding', () => {
    it('should properly encode cache keys with special characters', async () => {
      const key = 'aggregated:Crystal:123,456,789';
      const testData = { test: true };

      await cacheService.store(key, testData, testConfig);

      const result = await cacheService.get(key);
      expect(result).not.toBeNull();

      const data = await result?.response.json();
      expect(data).toEqual(testData);
    });
  });

  describe('concurrent access', () => {
    it('should handle multiple simultaneous reads', async () => {
      const testData = { items: [1, 2, 3] };
      await cacheService.store('concurrent-test', testData, testConfig);

      const reads = await Promise.all([
        cacheService.get('concurrent-test'),
        cacheService.get('concurrent-test'),
        cacheService.get('concurrent-test'),
      ]);

      reads.forEach((result, i) => {
        expect(result, `Read ${i} failed`).not.toBeNull();
      });
    });
  });
});
