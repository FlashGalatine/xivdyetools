/**
 * Tests for Price Cache Service (Cache API backend)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCachedPrice,
  setCachedPrice,
  getCachedPrices,
  setCachedPrices,
  getCachedPriceWithStale,
  invalidateCachedPrice,
  CACHE_TTL_SECONDS,
} from './price-cache.js';
import type { DyePriceData } from '../../types/budget.js';

// Create mock Cache API (caches.default)
function createMockCache() {
  const store = new Map<string, Response>();

  const mockCache = {
    match: vi.fn(async (url: string) => {
      const response = store.get(url);
      if (!response) return undefined;
      // Clone the response so it can be consumed multiple times
      return response.clone();
    }),
    put: vi.fn(async (url: string, response: Response) => {
      store.set(url, response.clone());
    }),
    delete: vi.fn(async (url: string) => {
      return store.delete(url);
    }),
    _store: store, // For test inspection
  };

  return mockCache;
}

// Helper to store a cache entry directly into the mock store
function seedCache(
  mockCache: ReturnType<typeof createMockCache>,
  world: string,
  itemId: number,
  price: DyePriceData,
  cachedAt: number
) {
  const url = `https://cache.xivdyetools.internal/prices/v1/${world.toLowerCase()}/${itemId}`;
  const entry = { data: price, cachedAt };
  const response = new Response(JSON.stringify(entry), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=900',
    },
  });
  mockCache._store.set(url, response);
}

// Sample price data
const samplePrice: DyePriceData = {
  itemID: 5729,
  currentAverage: 75000,
  currentMinPrice: 50000,
  currentMaxPrice: 100000,
  lastUpdate: Date.now(),
  world: 'Crystal',
  listingCount: 10,
  fetchedAt: '2024-01-01T12:00:00Z',
};

describe('price-cache.ts', () => {
  let mockCache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    mockCache = createMockCache();

    // Mock the global caches.default
    vi.stubGlobal('caches', { default: mockCache });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('getCachedPrice', () => {
    it('should return null for cache miss', async () => {
      const result = await getCachedPrice('Crystal', 5729);
      expect(result).toBeNull();
    });

    it('should return cached price within TTL', async () => {
      seedCache(mockCache, 'Crystal', 5729, samplePrice, Date.now());

      const result = await getCachedPrice('Crystal', 5729);
      expect(result).toEqual(samplePrice);
    });

    it('should return null for expired cache entry', async () => {
      seedCache(mockCache, 'Crystal', 5729, samplePrice, Date.now() - (CACHE_TTL_SECONDS + 1) * 1000);

      const result = await getCachedPrice('Crystal', 5729);
      expect(result).toBeNull();
    });

    it('should return null on cache error', async () => {
      mockCache.match = vi.fn().mockRejectedValue(new Error('Cache unavailable'));

      const result = await getCachedPrice('Crystal', 5729);
      expect(result).toBeNull();
    });
  });

  describe('getCachedPriceWithStale', () => {
    it('should return fresh data when within TTL', async () => {
      seedCache(mockCache, 'Crystal', 5729, samplePrice, Date.now());

      const result = await getCachedPriceWithStale('Crystal', 5729);
      expect(result).toEqual({ data: samplePrice, isStale: false });
    });

    it('should return stale data when expired', async () => {
      seedCache(mockCache, 'Crystal', 5729, samplePrice, Date.now() - (CACHE_TTL_SECONDS + 1) * 1000);

      const result = await getCachedPriceWithStale('Crystal', 5729);
      expect(result).toEqual({ data: samplePrice, isStale: true });
    });

    it('should return data:null for cache miss', async () => {
      const result = await getCachedPriceWithStale('Crystal', 5729);
      expect(result).toEqual({ data: null, isStale: false });
    });
  });

  describe('setCachedPrice', () => {
    it('should store price data in cache', async () => {
      await setCachedPrice('Crystal', 5729, samplePrice);

      expect(mockCache.put).toHaveBeenCalled();

      const url = 'https://cache.xivdyetools.internal/prices/v1/crystal/5729';
      const stored = mockCache._store.get(url);
      expect(stored).toBeDefined();

      const parsed = (await stored!.clone().json()) as { data: DyePriceData; cachedAt: number };
      expect(parsed.data).toEqual(samplePrice);
      expect(parsed.cachedAt).toBeDefined();
    });

    it('should handle cache errors gracefully', async () => {
      mockCache.put = vi.fn().mockRejectedValue(new Error('Cache unavailable'));

      // Should not throw
      await expect(setCachedPrice('Crystal', 5729, samplePrice)).resolves.not.toThrow();
    });
  });

  describe('getCachedPrices (batch)', () => {
    it('should return map of cached prices', async () => {
      const price1 = { ...samplePrice, itemID: 5729 };
      const price2 = { ...samplePrice, itemID: 5730 };

      seedCache(mockCache, 'Crystal', 5729, price1, Date.now());
      seedCache(mockCache, 'Crystal', 5730, price2, Date.now());

      const result = await getCachedPrices('Crystal', [5729, 5730, 5731]);

      expect(result.get(5729)).toEqual(price1);
      expect(result.get(5730)).toEqual(price2);
      expect(result.has(5731)).toBe(false); // Not in cache
    });

    it('should skip expired entries', async () => {
      seedCache(mockCache, 'Crystal', 5729, samplePrice, Date.now() - (CACHE_TTL_SECONDS + 1) * 1000);

      const result = await getCachedPrices('Crystal', [5729]);
      expect(result.size).toBe(0);
    });
  });

  describe('setCachedPrices (batch)', () => {
    it('should store multiple prices', async () => {
      const prices = new Map<number, DyePriceData>([
        [5729, { ...samplePrice, itemID: 5729 }],
        [5730, { ...samplePrice, itemID: 5730 }],
      ]);

      await setCachedPrices('Crystal', prices);

      expect(mockCache.put).toHaveBeenCalledTimes(2);
      expect(mockCache._store.has('https://cache.xivdyetools.internal/prices/v1/crystal/5729')).toBe(true);
      expect(mockCache._store.has('https://cache.xivdyetools.internal/prices/v1/crystal/5730')).toBe(true);
    });
  });

  describe('invalidateCachedPrice', () => {
    it('should delete cached entry', async () => {
      seedCache(mockCache, 'Crystal', 5729, samplePrice, Date.now());

      await invalidateCachedPrice('Crystal', 5729);

      expect(mockCache.delete).toHaveBeenCalledWith(
        'https://cache.xivdyetools.internal/prices/v1/crystal/5729'
      );
    });
  });
});
