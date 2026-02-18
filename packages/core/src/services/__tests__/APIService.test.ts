/**
 * APIService Comprehensive Tests
 * Phase 3.3: Target 70-90 tests covering caching, rate limiting, API calls, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  APIService,
  MemoryCacheBackend,
  DefaultRateLimiter,
  DefaultFetchClient,
  FetchClient,
  RateLimiter,
  ICacheBackend,
} from '../APIService.js';
import type { PriceData, CachedData } from '../../types/index.js';
import { API_CACHE_VERSION, API_CACHE_TTL } from '../../constants/index.js';

// ============================================================================
// Mock Implementations
// ============================================================================

/**
 * Mock fetch client for testing
 */
class MockFetchClient implements FetchClient {
  private responses: Map<
    string,
    { status: number; body: unknown; headers?: Record<string, string> }
  > = new Map();
  public callHistory: Array<{ url: string; options?: RequestInit }> = [];

  setResponse(
    url: string,
    response: { status: number; body: unknown; headers?: Record<string, string> }
  ) {
    this.responses.set(url, response);
  }

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    this.callHistory.push({ url, options });

    const mockResponse = this.responses.get(url);
    if (!mockResponse) {
      throw new Error(`No mock response configured for: ${url}`);
    }

    const headers = new Headers({
      'content-type': 'application/json',
      ...mockResponse.headers,
    });

    return {
      ok: mockResponse.status >= 200 && mockResponse.status < 300,
      status: mockResponse.status,
      statusText: mockResponse.status === 200 ? 'OK' : 'Error',
      headers,
      text: async () => JSON.stringify(mockResponse.body),
      json: async () => mockResponse.body,
    } as Response;
  }

  reset() {
    this.responses.clear();
    this.callHistory = [];
  }
}

/**
 * No-op rate limiter for testing (doesn't wait)
 */
class NoOpRateLimiter implements RateLimiter {
  public waitCalled = 0;
  public recordCalled = 0;

  async waitIfNeeded(): Promise<void> {
    this.waitCalled++;
  }

  recordRequest(): void {
    this.recordCalled++;
  }

  reset() {
    this.waitCalled = 0;
    this.recordCalled = 0;
  }
}

// ============================================================================
// MemoryCacheBackend Tests
// ============================================================================

describe('MemoryCacheBackend', () => {
  let cache: MemoryCacheBackend;

  beforeEach(() => {
    cache = new MemoryCacheBackend();
  });

  describe('basic operations', () => {
    it('should return null for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should store and retrieve value', () => {
      const data: CachedData<PriceData> = {
        data: {
          itemID: 1,
          currentAverage: 100,
          currentMinPrice: 90,
          currentMaxPrice: 110,
          lastUpdate: Date.now(),
        },
        timestamp: Date.now(),
        ttl: API_CACHE_TTL,
      };
      cache.set('item_1', data);
      expect(cache.get('item_1')).toEqual(data);
    });

    it('should delete value', () => {
      const data: CachedData<PriceData> = {
        data: {
          itemID: 1,
          currentAverage: 100,
          currentMinPrice: 90,
          currentMaxPrice: 110,
          lastUpdate: Date.now(),
        },
        timestamp: Date.now(),
        ttl: API_CACHE_TTL,
      };
      cache.set('item_1', data);
      cache.delete('item_1');
      expect(cache.get('item_1')).toBeNull();
    });

    it('should clear all values', () => {
      const data1: CachedData<PriceData> = {
        data: {
          itemID: 1,
          currentAverage: 100,
          currentMinPrice: 90,
          currentMaxPrice: 110,
          lastUpdate: Date.now(),
        },
        timestamp: Date.now(),
        ttl: API_CACHE_TTL,
      };
      const data2: CachedData<PriceData> = {
        data: {
          itemID: 2,
          currentAverage: 200,
          currentMinPrice: 180,
          currentMaxPrice: 220,
          lastUpdate: Date.now(),
        },
        timestamp: Date.now(),
        ttl: API_CACHE_TTL,
      };
      cache.set('item_1', data1);
      cache.set('item_2', data2);
      cache.clear();
      expect(cache.get('item_1')).toBeNull();
      expect(cache.get('item_2')).toBeNull();
    });

    it('should return all keys', () => {
      const data1: CachedData<PriceData> = {
        data: {
          itemID: 1,
          currentAverage: 100,
          currentMinPrice: 90,
          currentMaxPrice: 110,
          lastUpdate: Date.now(),
        },
        timestamp: Date.now(),
        ttl: API_CACHE_TTL,
      };
      const data2: CachedData<PriceData> = {
        data: {
          itemID: 2,
          currentAverage: 200,
          currentMinPrice: 180,
          currentMaxPrice: 220,
          lastUpdate: Date.now(),
        },
        timestamp: Date.now(),
        ttl: API_CACHE_TTL,
      };
      cache.set('item_1', data1);
      cache.set('item_2', data2);
      const keys = cache.keys();
      expect(keys).toContain('item_1');
      expect(keys).toContain('item_2');
      expect(keys.length).toBe(2);
    });

    it('should overwrite existing value', () => {
      const data1: CachedData<PriceData> = {
        data: {
          itemID: 1,
          currentAverage: 100,
          currentMinPrice: 90,
          currentMaxPrice: 110,
          lastUpdate: Date.now(),
        },
        timestamp: Date.now(),
        ttl: API_CACHE_TTL,
      };
      const data2: CachedData<PriceData> = {
        data: {
          itemID: 1,
          currentAverage: 200,
          currentMinPrice: 180,
          currentMaxPrice: 220,
          lastUpdate: Date.now(),
        },
        timestamp: Date.now(),
        ttl: API_CACHE_TTL,
      };
      cache.set('item_1', data1);
      cache.set('item_1', data2);
      expect(cache.get('item_1')).toEqual(data2);
    });
  });
});

// ============================================================================
// DefaultRateLimiter Tests
// ============================================================================

describe('DefaultRateLimiter', () => {
  it('should create with default delay', () => {
    const limiter = new DefaultRateLimiter();
    expect(limiter).toBeDefined();
  });

  it('should create with custom delay', () => {
    const limiter = new DefaultRateLimiter(100);
    expect(limiter).toBeDefined();
  });

  it('should not wait on first request', async () => {
    const limiter = new DefaultRateLimiter(1000);
    const start = Date.now();
    await limiter.waitIfNeeded();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50); // Should be nearly instant
  });

  it('should wait after recording a request', async () => {
    const limiter = new DefaultRateLimiter(100);
    limiter.recordRequest();
    const start = Date.now();
    await limiter.waitIfNeeded();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(50); // Should wait at least some time
  });

  it('should not wait if enough time has passed', async () => {
    const limiter = new DefaultRateLimiter(50);
    limiter.recordRequest();
    await new Promise((resolve) => setTimeout(resolve, 60));
    const start = Date.now();
    await limiter.waitIfNeeded();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(20); // Should be nearly instant
  });
});

// ============================================================================
// DefaultFetchClient Tests
// ============================================================================

describe('DefaultFetchClient', () => {
  it('should exist', () => {
    const client = new DefaultFetchClient();
    expect(client).toBeDefined();
    expect(typeof client.fetch).toBe('function');
  });
});

// ============================================================================
// APIService Tests
// ============================================================================

describe('APIService', () => {
  let mockFetch: MockFetchClient;
  let noOpRateLimiter: NoOpRateLimiter;
  let memoryCache: MemoryCacheBackend;
  let apiService: APIService;

  beforeEach(() => {
    mockFetch = new MockFetchClient();
    noOpRateLimiter = new NoOpRateLimiter();
    memoryCache = new MemoryCacheBackend();
    apiService = new APIService(memoryCache, mockFetch, noOpRateLimiter);
  });

  afterEach(() => {
    mockFetch.reset();
    noOpRateLimiter.reset();
    memoryCache.clear();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default implementations', () => {
      const service = new APIService();
      expect(service).toBeDefined();
    });

    it('should create with custom cache', () => {
      const service = new APIService(memoryCache);
      expect(service).toBeDefined();
    });

    it('should create with custom fetch client', () => {
      const service = new APIService(undefined, mockFetch);
      expect(service).toBeDefined();
    });

    it('should create with custom rate limiter', () => {
      const service = new APIService(undefined, undefined, noOpRateLimiter);
      expect(service).toBeDefined();
    });

    it('should create with all custom implementations', () => {
      const service = new APIService(memoryCache, mockFetch, noOpRateLimiter);
      expect(service).toBeDefined();
    });
  });

  // ==========================================================================
  // Cache Management Tests
  // ==========================================================================

  describe('cache management', () => {
    it('should clear cache', async () => {
      // Setup: Add data to cache via getPriceData
      const itemID = 5729;
      const mockResponse = {
        results: [
          {
            itemId: itemID,
            nq: { minListing: { dc: { price: 1000 } } },
          },
        ],
      };
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: mockResponse,
      });

      await apiService.getPriceData(itemID);
      let stats = await apiService.getCacheStats();
      expect(stats.size).toBe(1);

      await apiService.clearCache();
      stats = await apiService.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should return cache stats', async () => {
      const stats = await apiService.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });

    it('should invalidate cache on version mismatch', async () => {
      // Manually add entry with old version
      const itemID = 5729;
      const cachedData: CachedData<PriceData> = {
        data: {
          itemID,
          currentAverage: 100,
          currentMinPrice: 90,
          currentMaxPrice: 110,
          lastUpdate: Date.now(),
        },
        timestamp: Date.now(),
        ttl: API_CACHE_TTL,
        version: '0.0.0', // Old version
      };
      memoryCache.set(`${itemID}_global`, cachedData);

      // Setup mock for fresh fetch
      const mockResponse = {
        results: [
          {
            itemId: itemID,
            nq: { minListing: { dc: { price: 2000 } } },
          },
        ],
      };
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: mockResponse,
      });

      const result = await apiService.getPriceData(itemID);
      expect(result?.currentAverage).toBe(2000); // Fresh data, not cached
    });

    it('should invalidate expired cache', async () => {
      const itemID = 5729;
      const cachedData: CachedData<PriceData> = {
        data: {
          itemID,
          currentAverage: 100,
          currentMinPrice: 90,
          currentMaxPrice: 110,
          lastUpdate: Date.now(),
        },
        timestamp: Date.now() - API_CACHE_TTL - 1000, // Expired
        ttl: API_CACHE_TTL,
        version: API_CACHE_VERSION,
      };
      memoryCache.set(`${itemID}_global`, cachedData);

      const mockResponse = {
        results: [
          {
            itemId: itemID,
            nq: { minListing: { dc: { price: 2000 } } },
          },
        ],
      };
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: mockResponse,
      });

      const result = await apiService.getPriceData(itemID);
      expect(result?.currentAverage).toBe(2000); // Fresh data
    });

    it('should invalidate corrupted cache (checksum mismatch)', async () => {
      const itemID = 5729;
      const cachedData: CachedData<PriceData> = {
        data: {
          itemID,
          currentAverage: 100,
          currentMinPrice: 90,
          currentMaxPrice: 110,
          lastUpdate: Date.now(),
        },
        timestamp: Date.now(),
        ttl: API_CACHE_TTL,
        version: API_CACHE_VERSION,
        checksum: 'invalid_checksum',
      };
      memoryCache.set(`${itemID}_global`, cachedData);

      const mockResponse = {
        results: [
          {
            itemId: itemID,
            nq: { minListing: { dc: { price: 2000 } } },
          },
        ],
      };
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: mockResponse,
      });

      // Suppress console.warn for this test
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      warnSpy.mockRestore();

      expect(result?.currentAverage).toBe(2000); // Fresh data
    });
  });

  // ==========================================================================
  // getPriceData Tests
  // ==========================================================================

  describe('getPriceData', () => {
    it('should fetch and return price data', async () => {
      const itemID = 5729;
      const mockResponse = {
        results: [
          {
            itemId: itemID,
            nq: { minListing: { dc: { price: 1500 } } },
          },
        ],
      };
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: mockResponse,
      });

      const result = await apiService.getPriceData(itemID);
      expect(result).not.toBeNull();
      expect(result?.itemID).toBe(itemID);
      expect(result?.currentAverage).toBe(1500);
    });

    it('should return cached data on second call', async () => {
      const itemID = 5729;
      const mockResponse = {
        results: [
          {
            itemId: itemID,
            nq: { minListing: { dc: { price: 1500 } } },
          },
        ],
      };
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: mockResponse,
      });

      // First call
      await apiService.getPriceData(itemID);
      expect(mockFetch.callHistory.length).toBe(1);

      // Second call should use cache
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      infoSpy.mockRestore();

      expect(result?.currentAverage).toBe(1500);
      expect(mockFetch.callHistory.length).toBe(1); // No additional fetch
    });

    it('should use data center in URL when provided', async () => {
      const itemID = 5729;
      const dataCenterID = 'Crystal';
      const mockResponse = {
        results: [
          {
            itemId: itemID,
            nq: { minListing: { dc: { price: 1200 } } },
          },
        ],
      };
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/${dataCenterID}/${itemID}`, {
        status: 200,
        body: mockResponse,
      });

      const result = await apiService.getPriceData(itemID, undefined, dataCenterID);
      expect(result?.currentAverage).toBe(1200);
      expect(mockFetch.callHistory[0].url).toContain(dataCenterID);
    });

    it('should return null on API error', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 500,
        body: { error: 'Internal Server Error' },
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      errorSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should use rate limiter', async () => {
      const itemID = 5729;
      const mockResponse = {
        results: [
          {
            itemId: itemID,
            nq: { minListing: { dc: { price: 1500 } } },
          },
        ],
      };
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: mockResponse,
      });

      await apiService.getPriceData(itemID);
      expect(noOpRateLimiter.waitCalled).toBe(1);
      expect(noOpRateLimiter.recordCalled).toBe(1);
    });
  });

  // ==========================================================================
  // Request Deduplication Tests
  // ==========================================================================

  describe('request deduplication', () => {
    it('should deduplicate concurrent requests for same item', async () => {
      const itemID = 5729;
      let resolveResponse: () => void;
      const responsePromise = new Promise<void>((resolve) => {
        resolveResponse = resolve;
      });

      // Create a mock fetch that delays
      const delayedFetch: FetchClient = {
        async fetch(url: string) {
          await responsePromise;
          const headers = new Headers({ 'content-type': 'application/json' });
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers,
            text: async () =>
              JSON.stringify({
                results: [{ itemId: itemID, nq: { minListing: { dc: { price: 1000 } } } }],
              }),
          } as Response;
        },
      };

      const service = new APIService(memoryCache, delayedFetch, noOpRateLimiter);

      // Start two concurrent requests
      const promise1 = service.getPriceData(itemID);
      const promise2 = service.getPriceData(itemID);

      // Resolve the fetch
      resolveResponse!();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual(result2);
      // Both should get the same data
      expect(result1?.currentAverage).toBe(1000);
    });
  });

  // ==========================================================================
  // API Response Parsing Tests
  // ==========================================================================

  describe('API response parsing', () => {
    it('should parse NQ DC price', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [
            {
              itemId: itemID,
              nq: { minListing: { dc: { price: 1000 } } },
            },
          ],
        },
      });

      const result = await apiService.getPriceData(itemID);
      expect(result?.currentAverage).toBe(1000);
    });

    it('should fall back to NQ world price', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [
            {
              itemId: itemID,
              nq: { minListing: { world: { price: 900 } } },
            },
          ],
        },
      });

      const result = await apiService.getPriceData(itemID);
      expect(result?.currentAverage).toBe(900);
    });

    it('should fall back to NQ region price', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [
            {
              itemId: itemID,
              nq: { minListing: { region: { price: 800 } } },
            },
          ],
        },
      });

      const result = await apiService.getPriceData(itemID);
      expect(result?.currentAverage).toBe(800);
    });

    it('should return null when only HQ prices available (dyes are always NQ)', async () => {
      // Note: FFXIV dyes are always Normal Quality, so HQ prices are intentionally not used
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [
            {
              itemId: itemID,
              hq: { minListing: { dc: { price: 1100 } } },
            },
          ],
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      warnSpy.mockRestore();

      // Should return null since dyes don't have HQ variants
      expect(result).toBeNull();
    });

    it('should return null when only HQ world price available', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [
            {
              itemId: itemID,
              hq: { minListing: { world: { price: 950 } } },
            },
          ],
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      warnSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should return null when only HQ region price available', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [
            {
              itemId: itemID,
              hq: { minListing: { region: { price: 850 } } },
            },
          ],
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      warnSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should return null for empty results array', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: { results: [] },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      warnSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should return null for item ID mismatch', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [
            {
              itemId: 9999, // Wrong ID
              nq: { minListing: { dc: { price: 1000 } } },
            },
          ],
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      warnSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should return null for missing price data', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [
            {
              itemId: itemID,
              // No nq or hq data
            },
          ],
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      warnSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should return null for invalid response structure', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: 'invalid',
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      warnSpy.mockRestore();

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // HTTP Error Handling Tests
  // ==========================================================================

  describe('HTTP error handling', () => {
    it('should handle 404 error', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 404,
        body: { error: 'Not Found' },
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      errorSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should handle 500 error', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 500,
        body: { error: 'Internal Server Error' },
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      errorSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should handle invalid content type', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: { results: [] },
        headers: { 'content-type': 'text/html' },
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      errorSpy.mockRestore();

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Batch Operations Tests
  // ==========================================================================

  describe('batch operations', () => {
    it('should fetch prices for multiple items', async () => {
      const itemIDs = [5729, 5730, 5731];

      // Mock the batched API request (comma-separated item IDs)
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/5729,5730,5731`, {
        status: 200,
        body: {
          results: [
            { itemId: 5729, nq: { minListing: { dc: { price: 572900 } } } },
            { itemId: 5730, nq: { minListing: { dc: { price: 573000 } } } },
            { itemId: 5731, nq: { minListing: { dc: { price: 573100 } } } },
          ],
          failedItems: [],
        },
      });

      const results = await apiService.getPricesForItems(itemIDs);
      expect(results.size).toBe(3);
      expect(results.get(5729)?.currentAverage).toBe(572900);
      expect(results.get(5730)?.currentAverage).toBe(573000);
      expect(results.get(5731)?.currentAverage).toBe(573100);
    });

    it('should skip items with no price data', async () => {
      const itemIDs = [5729, 5730];

      // Mock batched request - 5730 has no price data (empty minListing)
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/5729,5730`, {
        status: 200,
        body: {
          results: [
            { itemId: 5729, nq: { minListing: { dc: { price: 1000 } } } },
            { itemId: 5730, nq: { minListing: {} } }, // No price
          ],
          failedItems: [],
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const results = await apiService.getPricesForItems(itemIDs);
      warnSpy.mockRestore();

      expect(results.size).toBe(1);
      expect(results.has(5729)).toBe(true);
      expect(results.has(5730)).toBe(false);
    });

    it('should fetch prices for data center', async () => {
      const itemIDs = [5729, 5730];
      const dataCenterID = 'Crystal';

      // Mock the batched API request for data center
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/${dataCenterID}/5729,5730`, {
        status: 200,
        body: {
          results: [
            { itemId: 5729, nq: { minListing: { dc: { price: 57290 } } } },
            { itemId: 5730, nq: { minListing: { dc: { price: 57300 } } } },
          ],
          failedItems: [],
        },
      });

      const results = await apiService.getPricesForDataCenter(itemIDs, dataCenterID);
      expect(results.size).toBe(2);
    });

    it('should return cached results when all items are cached (getPricesForItems)', async () => {
      const itemIDs = [5729, 5730];

      // First, populate the cache by fetching
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/5729,5730`, {
        status: 200,
        body: {
          results: [
            { itemId: 5729, nq: { minListing: { dc: { price: 10000 } } } },
            { itemId: 5730, nq: { minListing: { dc: { price: 20000 } } } },
          ],
          failedItems: [],
        },
      });

      // First call to populate cache
      await apiService.getPricesForItems(itemIDs);
      const initialCallCount = mockFetch.callHistory.length;

      // Second call should use cache (no additional fetch)
      const results = await apiService.getPricesForItems(itemIDs);

      expect(results.size).toBe(2);
      expect(results.get(5729)?.currentAverage).toBe(10000);
      expect(results.get(5730)?.currentAverage).toBe(20000);
      // No additional fetch calls should be made
      expect(mockFetch.callHistory.length).toBe(initialCallCount);
    });

    it('should return cached results when all items are cached (getPricesForDataCenter)', async () => {
      const itemIDs = [5729, 5730];
      const dataCenterID = 'Aether';

      // First, populate the cache by fetching
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/${dataCenterID}/5729,5730`, {
        status: 200,
        body: {
          results: [
            { itemId: 5729, nq: { minListing: { dc: { price: 30000 } } } },
            { itemId: 5730, nq: { minListing: { dc: { price: 40000 } } } },
          ],
          failedItems: [],
        },
      });

      // First call to populate cache
      await apiService.getPricesForDataCenter(itemIDs, dataCenterID);
      const initialCallCount = mockFetch.callHistory.length;

      // Second call should use cache (no additional fetch)
      const results = await apiService.getPricesForDataCenter(itemIDs, dataCenterID);

      expect(results.size).toBe(2);
      expect(results.get(5729)?.currentAverage).toBe(30000);
      expect(results.get(5730)?.currentAverage).toBe(40000);
      // No additional fetch calls should be made
      expect(mockFetch.callHistory.length).toBe(initialCallCount);
    });

    it('should fetch only uncached items when some are cached (getPricesForDataCenter)', async () => {
      const dataCenterID = 'Primal';

      // First, cache item 5729 only
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/${dataCenterID}/5729`, {
        status: 200,
        body: {
          results: [{ itemId: 5729, nq: { minListing: { dc: { price: 50000 } } } }],
          failedItems: [],
        },
      });
      await apiService.getPricesForDataCenter([5729], dataCenterID);

      // Now request both 5729 and 5730
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/${dataCenterID}/5730`, {
        status: 200,
        body: {
          results: [{ itemId: 5730, nq: { minListing: { dc: { price: 60000 } } } }],
          failedItems: [],
        },
      });

      const results = await apiService.getPricesForDataCenter([5729, 5730], dataCenterID);

      expect(results.size).toBe(2);
      expect(results.get(5729)?.currentAverage).toBe(50000); // From cache
      expect(results.get(5730)?.currentAverage).toBe(60000); // Freshly fetched
    });
  });

  // ==========================================================================
  // Health Check Tests
  // ==========================================================================

  describe('health checks', () => {
    it('should return true when API is available', async () => {
      mockFetch.setResponse('https://universalis.app/api/v2/data-centers', {
        status: 200,
        body: [],
      });

      const result = await apiService.isAPIAvailable();
      expect(result).toBe(true);
    });

    it('should return false when API returns error', async () => {
      mockFetch.setResponse('https://universalis.app/api/v2/data-centers', {
        status: 500,
        body: { error: 'Server Error' },
      });

      const result = await apiService.isAPIAvailable();
      expect(result).toBe(false);
    });

    it('should return API status with latency', async () => {
      mockFetch.setResponse('https://universalis.app/api/v2/data-centers', {
        status: 200,
        body: [],
      });

      const status = await apiService.getAPIStatus();
      expect(status.available).toBe(true);
      expect(status.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return unavailable status on error', async () => {
      mockFetch.setResponse('https://universalis.app/api/v2/data-centers', {
        status: 500,
        body: { error: 'Server Error' },
      });

      const status = await apiService.getAPIStatus();
      expect(status.available).toBe(false);
    });
  });

  // ==========================================================================
  // Static Utility Tests
  // ==========================================================================

  describe('formatPrice', () => {
    it('should format small price', () => {
      expect(APIService.formatPrice(100)).toBe('100G');
    });

    it('should format price with thousands separator', () => {
      expect(APIService.formatPrice(1000)).toBe('1,000G');
    });

    it('should format large price', () => {
      expect(APIService.formatPrice(1000000)).toBe('1,000,000G');
    });

    it('should format zero', () => {
      expect(APIService.formatPrice(0)).toBe('0G');
    });

    it('should format 69420', () => {
      expect(APIService.formatPrice(69420)).toBe('69,420G');
    });
  });

  describe('getPriceTrend', () => {
    it('should return stable for small change', () => {
      const result = APIService.getPriceTrend(100, 100);
      expect(result.trend).toBe('stable');
      expect(result.change).toBe(0);
    });

    it('should return up for significant increase', () => {
      const result = APIService.getPriceTrend(120, 100);
      expect(result.trend).toBe('up');
      expect(result.change).toBe(20);
      expect(result.changePercent).toBe(20);
    });

    it('should return down for significant decrease', () => {
      const result = APIService.getPriceTrend(80, 100);
      expect(result.trend).toBe('down');
      expect(result.change).toBe(-20);
      expect(result.changePercent).toBe(-20);
    });

    it('should return stable for 5% threshold', () => {
      const result = APIService.getPriceTrend(105, 100);
      expect(result.trend).toBe('stable');
    });

    it('should handle zero previous price', () => {
      const result = APIService.getPriceTrend(100, 0);
      expect(result.changePercent).toBe(0);
    });

    it('should round change percent to 2 decimals', () => {
      const result = APIService.getPriceTrend(133, 100);
      expect(result.changePercent).toBe(33);
    });
  });

  // ==========================================================================
  // Cache Key Building Tests
  // ==========================================================================

  describe('cache key building', () => {
    it('should create global key for no parameters', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [{ itemId: itemID, nq: { minListing: { dc: { price: 1000 } } } }],
        },
      });

      await apiService.getPriceData(itemID);
      const stats = await apiService.getCacheStats();
      // Cache key format: itemID:global
      expect(stats.keys).toContain(`${itemID}:global`);
    });

    it('should create DC key for data center', async () => {
      const itemID = 5729;
      const dataCenterID = 'Crystal';
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/${dataCenterID}/${itemID}`, {
        status: 200,
        body: {
          results: [{ itemId: itemID, nq: { minListing: { dc: { price: 1000 } } } }],
        },
      });

      await apiService.getPriceData(itemID, undefined, dataCenterID);
      const stats = await apiService.getCacheStats();
      // Cache key format: itemID:dc:dataCenterID
      expect(stats.keys).toContain(`${itemID}:dc:${dataCenterID}`);
    });

    it('should create worldID key when only worldID provided (line 571)', async () => {
      const itemID = 5729;
      const worldID = 73; // Gilgamesh world ID

      // Note: The API uses dataCenterID in the URL, worldID is used only for cache key
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [{ itemId: itemID, nq: { minListing: { dc: { price: 1000 } } } }],
        },
      });

      await apiService.getPriceData(itemID, worldID, undefined);
      const stats = await apiService.getCacheStats();
      // Cache key format: itemID:world:worldID
      expect(stats.keys).toContain(`${itemID}:world:${worldID}`);
    });
  });

  // ==========================================================================
  // Response Size and Content Tests (lines 409-411, 420, 447)
  // ==========================================================================

  describe('response size and content validation', () => {
    it('should handle content-length header indicating oversized response (lines 409-411)', async () => {
      const itemID = 5729;
      // Create a mock fetch that returns a very large content-length header
      const oversizedFetch: FetchClient = {
        async fetch() {
          const headers = new Headers({
            'content-type': 'application/json',
            'content-length': '999999999', // Way over the max response size
          });
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers,
            text: async () => '{}',
          } as Response;
        },
      };

      const service = new APIService(memoryCache, oversizedFetch, noOpRateLimiter);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await service.getPriceData(itemID);
      errorSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should handle response text too large (line 420)', async () => {
      const itemID = 5729;
      // Create a mock fetch that returns text larger than max size
      const largeTextFetch: FetchClient = {
        async fetch() {
          const headers = new Headers({
            'content-type': 'application/json',
            // No content-length header, so size check happens on text
          });
          // Create a very large text (> API_MAX_RESPONSE_SIZE)
          const largeText = 'x'.repeat(20 * 1024 * 1024); // 20MB
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers,
            text: async () => largeText,
          } as Response;
        },
      };

      const service = new APIService(memoryCache, largeTextFetch, noOpRateLimiter);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await service.getPriceData(itemID);
      errorSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should handle invalid JSON response (line 447)', async () => {
      const itemID = 5729;
      // Create a mock fetch that returns invalid JSON
      const invalidJsonFetch: FetchClient = {
        async fetch() {
          const headers = new Headers({
            'content-type': 'application/json',
          });
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers,
            text: async () => 'this is not valid JSON {{{',
          } as Response;
        },
      };

      const service = new APIService(memoryCache, invalidJsonFetch, noOpRateLimiter);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await service.getPriceData(itemID);
      errorSpy.mockRestore();

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Invalid Result Structure Tests (lines 496-497, 548-549)
  // ==========================================================================

  describe('invalid result structure handling', () => {
    it('should return null for result that is not an object (lines 496-497)', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [null], // First result is null, not an object
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      warnSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should return null for result with non-number itemId (lines 496-497)', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [
            {
              itemId: 'not-a-number', // itemId should be a number
              nq: { minListing: { dc: { price: 1000 } } },
            },
          ],
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      warnSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should handle undefined result in array', async () => {
      const itemID = 5729;
      mockFetch.setResponse(`https://universalis.app/api/v2/aggregated/universal/${itemID}`, {
        status: 200,
        body: {
          results: [undefined],
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await apiService.getPriceData(itemID);
      warnSpy.mockRestore();

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Health Check Error Handling Tests (lines 628, 644)
  // ==========================================================================

  describe('health check error handling', () => {
    it('should return false when fetch throws (line 628)', async () => {
      // Create a fetch client that throws an error
      const throwingFetch: FetchClient = {
        async fetch() {
          throw new Error('Network error');
        },
      };

      const service = new APIService(memoryCache, throwingFetch, noOpRateLimiter);

      const result = await service.isAPIAvailable();
      expect(result).toBe(false);
    });

    it('should return unavailable status when isAPIAvailable returns false (line 644)', async () => {
      // Create a fetch client that throws an error
      const throwingFetch: FetchClient = {
        async fetch() {
          throw new Error('Network error');
        },
      };

      const service = new APIService(memoryCache, throwingFetch, noOpRateLimiter);

      const status = await service.getAPIStatus();
      expect(status.available).toBe(false);
      // isAPIAvailable catches the error internally and returns false
      // so getAPIStatus calculates the latency normally (>= 0)
      expect(status.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return -1 latency when getAPIStatus catch block is triggered (line 644)', async () => {
      // To trigger the catch block in getAPIStatus, we need isAPIAvailable to throw
      // This is an edge case that's hard to trigger in practice
      const service = new APIService(memoryCache, mockFetch, noOpRateLimiter);

      // Mock isAPIAvailable to throw an error
      vi.spyOn(service, 'isAPIAvailable').mockRejectedValue(new Error('Unexpected error'));

      const status = await service.getAPIStatus();
      expect(status.available).toBe(false);
      expect(status.latency).toBe(-1);

      vi.restoreAllMocks();
    });
  });

  // ==========================================================================
  // Retry Logic Tests (line 351)
  // ==========================================================================

  describe('retry logic', () => {
    it('should return null when retry returns no data (line 351)', async () => {
      const itemID = 5729;
      // Create a fetch that returns null-like data after retries
      let callCount = 0;
      const failingFetch: FetchClient = {
        async fetch() {
          callCount++;
          // Return a response that will result in null data after parsing
          const headers = new Headers({
            'content-type': 'application/json',
          });
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers,
            text: async () => JSON.stringify(null), // Will result in !data check failing
          } as Response;
        },
      };

      const service = new APIService(memoryCache, failingFetch, noOpRateLimiter);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await service.getPriceData(itemID);
      warnSpy.mockRestore();

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // DefaultFetchClient Integration Test (line 46)
  // ==========================================================================

  describe('DefaultFetchClient', () => {
    it('should use global fetch when called', async () => {
      const client = new DefaultFetchClient();
      // We can't easily test the actual fetch call without making a real network request
      // but we can verify the method exists and is callable
      expect(typeof client.fetch).toBe('function');

      // Verify it returns a promise
      // Note: This would make a real network request in production, so we just check the signature
      const fetchFn = client.fetch;
      expect(fetchFn.length).toBe(2); // url and options parameters
    });
  });
});
