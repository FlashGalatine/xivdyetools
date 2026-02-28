/**
 * XIV Dye Tools - API Service Wrapper Tests
 *
 * Tests for APIService singleton wrapper and IndexedDB cache backend
 *
 * @module services/__tests__/api-service-wrapper.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APIService } from '../api-service-wrapper';

describe('APIService Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset the singleton
    APIService.resetInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Singleton Pattern
  // ==========================================================================

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = APIService.getInstance();
      const instance2 = APIService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = APIService.getInstance();
      APIService.resetInstance();
      const instance2 = APIService.getInstance();

      // Different objects because we reset
      expect(instance1).not.toBe(instance2);
    });

    it('should return an instance with required methods', () => {
      const instance = APIService.getInstance();

      expect(typeof instance.getPriceData).toBe('function');
      expect(typeof instance.clearCache).toBe('function');
    });
  });

  describe('resetInstance', () => {
    it('should reset the singleton', () => {
      APIService.getInstance();
      APIService.resetInstance();

      // After reset, next getInstance should create new instance
      const newInstance = APIService.getInstance();
      expect(newInstance).toBeTruthy();
    });
  });

  // ==========================================================================
  // Static Methods
  // ==========================================================================

  describe('formatPrice', () => {
    it('should format prices with G suffix', () => {
      const result = APIService.formatPrice(1000);
      expect(result).toContain('G');
    });

    it('should handle zero', () => {
      const result = APIService.formatPrice(0);
      expect(result).toBe('0G');
    });

    it('should handle large numbers with formatting', () => {
      const result = APIService.formatPrice(1000000);
      expect(result).toContain('G');
      // Should have comma formatting
      expect(result).toMatch(/\d.*G$/);
    });
  });

  describe('clearCache', () => {
    it('should clear cache without throwing', async () => {
      await expect(APIService.clearCache()).resolves.not.toThrow();
    });
  });

  describe('getPriceData', () => {
    it('should accept itemID parameter', async () => {
      // This calls the actual API - we just verify it doesn't throw
      // and returns expected shape (or null for non-existent item)
      const result = await APIService.getPriceData(99999999);
      // Non-existent item should return null or price data
      expect(result === null || typeof result === 'object').toBe(true);
    }, 15000); // Extended timeout for real API call

    it('should accept worldID parameter', async () => {
      // Verify the method accepts the parameter without throwing
      const result = await APIService.getPriceData(99999999, 67);
      expect(result === null || typeof result === 'object').toBe(true);
    }, 15000); // Extended timeout for real API call

    it('should accept dataCenterID parameter', async () => {
      // Verify the method accepts the parameter without throwing
      const result = await APIService.getPriceData(99999999, undefined, 'Crystal');
      expect(result === null || typeof result === 'object').toBe(true);
    }, 15000); // Extended timeout for real API call
  });
});

describe('apiService export', () => {
  it('should export a singleton instance', async () => {
    const { apiService } = await import('../api-service-wrapper');

    expect(apiService).toBeTruthy();
    expect(typeof apiService.getPriceData).toBe('function');
  });
});

// ==========================================================================
// IndexedDBCacheBackend Tests (Branch Coverage for api-service-wrapper.ts)
// ==========================================================================

describe('IndexedDBCacheBackend', () => {
  // We need to import IndexedDBCacheBackend
  let IndexedDBCacheBackend: typeof import('../api-service-wrapper').IndexedDBCacheBackend;
  let cacheBackend: InstanceType<typeof IndexedDBCacheBackend>;

  beforeEach(async () => {
    vi.clearAllMocks();
    APIService.resetInstance();
    // Dynamic import to avoid circular dependencies
    const module = await import('../api-service-wrapper');
    IndexedDBCacheBackend = module.IndexedDBCacheBackend;
    cacheBackend = new IndexedDBCacheBackend();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // initialize() Method
  // ==========================================================================

  describe('initialize()', () => {
    it('should handle indexedDBService.initialize failure', async () => {
      // Mock the indexedDBService to fail
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockInitialize = vi.spyOn(indexedDBServiceModule.indexedDBService, 'initialize');
      mockInitialize.mockRejectedValueOnce(new Error('DB init failed'));

      // Should throw on failure
      await expect(cacheBackend.initialize()).rejects.toThrow('DB init failed');

      // BUG-004 FIX: initPromise is NOT cleared on error to prevent race conditions
      // Use reinitialize() for explicit retry after failure
      mockInitialize.mockResolvedValueOnce(true);
      await expect(cacheBackend.reinitialize()).resolves.not.toThrow();
    });

    it('should load from storage after successful initialization', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockInitialize = vi.spyOn(indexedDBServiceModule.indexedDBService, 'initialize');
      const mockKeys = vi.spyOn(indexedDBServiceModule.indexedDBService, 'keys');

      mockInitialize.mockResolvedValueOnce(true);
      mockKeys.mockResolvedValueOnce(['key1', 'key2']);

      await cacheBackend.initialize();

      expect(mockKeys).toHaveBeenCalled();
    });

    it('should not load from storage if initialization returns false', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockInitialize = vi.spyOn(indexedDBServiceModule.indexedDBService, 'initialize');
      const mockKeys = vi.spyOn(indexedDBServiceModule.indexedDBService, 'keys');

      mockInitialize.mockResolvedValueOnce(false);

      await cacheBackend.initialize();

      expect(mockKeys).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // get() Method
  // ==========================================================================

  describe('get()', () => {
    it('should return value from memory cache', () => {
      const testData = { data: { minPrice: 100 }, timestamp: Date.now() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheBackend.set('test-key', testData as any);

      const result = cacheBackend.get('test-key');
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent key', () => {
      const result = cacheBackend.get('non-existent-key');
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // set() Method
  // ==========================================================================

  describe('set()', () => {
    it('should store value in memory cache', () => {
      const testData = { data: { minPrice: 200 }, timestamp: Date.now() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheBackend.set('test-key', testData as any);

      const result = cacheBackend.get('test-key');
      expect(result).toEqual(testData);
    });

    it('should call persistWithRetry to save to IndexedDB', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockSet = vi.spyOn(indexedDBServiceModule.indexedDBService, 'set');
      mockSet.mockResolvedValueOnce(true);

      const testData = { data: { minPrice: 300 }, timestamp: Date.now() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheBackend.set('persist-test', testData as any);

      // Wait for async persist
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSet).toHaveBeenCalledWith('price_cache', 'persist-test', testData);
    });
  });

  // ==========================================================================
  // persistWithRetry() Method (Private - tested via set())
  // ==========================================================================

  describe('persistWithRetry (via set())', () => {
    it('should retry on first failure and succeed on second', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockSet = vi.spyOn(indexedDBServiceModule.indexedDBService, 'set');

      // Fail first, succeed second
      mockSet.mockRejectedValueOnce(new Error('First failure'));
      mockSet.mockResolvedValueOnce(true);

      const testData = { data: { minPrice: 400 }, timestamp: Date.now() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheBackend.set('retry-test', testData as any);

      // Wait for retry with backoff
      await new Promise((r) => setTimeout(r, 300));

      expect(mockSet).toHaveBeenCalledTimes(2);
      // Data should still be in memory cache
      expect(cacheBackend.get('retry-test')).toEqual(testData);
    });

    it('should remove from memory cache after max retries fail', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockSet = vi.spyOn(indexedDBServiceModule.indexedDBService, 'set');

      // Always fail
      mockSet.mockRejectedValue(new Error('Persistent failure'));

      const testData = { data: { minPrice: 500 }, timestamp: Date.now() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheBackend.set('fail-test', testData as any);

      // Wait for retries with backoff
      await new Promise((r) => setTimeout(r, 500));

      // Should have been removed from memory cache
      expect(cacheBackend.get('fail-test')).toBeNull();
    });
  });

  // ==========================================================================
  // delete() Method
  // ==========================================================================

  describe('delete()', () => {
    it('should remove from memory cache', () => {
      const testData = { data: { minPrice: 600 }, timestamp: Date.now() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheBackend.set('delete-test', testData as any);

      cacheBackend.delete('delete-test');

      expect(cacheBackend.get('delete-test')).toBeNull();
    });

    it('should call indexedDBService.delete', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockDelete = vi.spyOn(indexedDBServiceModule.indexedDBService, 'delete');
      mockDelete.mockResolvedValueOnce(true);

      cacheBackend.delete('delete-idb-test');

      await new Promise((r) => setTimeout(r, 50));

      expect(mockDelete).toHaveBeenCalledWith('price_cache', 'delete-idb-test');
    });

    it('should handle indexedDBService.delete failure gracefully', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockDelete = vi.spyOn(indexedDBServiceModule.indexedDBService, 'delete');
      mockDelete.mockRejectedValueOnce(new Error('Delete failed'));

      // Should not throw
      expect(() => cacheBackend.delete('fail-delete')).not.toThrow();
    });
  });

  // ==========================================================================
  // clear() Method
  // ==========================================================================

  describe('clear()', () => {
    it('should clear memory cache', () => {
      const testData = { data: { minPrice: 700 }, timestamp: Date.now() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheBackend.set('clear-test-1', testData as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheBackend.set('clear-test-2', testData as any);

      cacheBackend.clear();

      expect(cacheBackend.keys().length).toBe(0);
    });

    it('should call indexedDBService.clear', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockClear = vi.spyOn(indexedDBServiceModule.indexedDBService, 'clear');
      mockClear.mockResolvedValueOnce(true);

      cacheBackend.clear();

      await new Promise((r) => setTimeout(r, 50));

      expect(mockClear).toHaveBeenCalledWith('price_cache');
    });

    it('should handle indexedDBService.clear failure gracefully', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockClear = vi.spyOn(indexedDBServiceModule.indexedDBService, 'clear');
      mockClear.mockRejectedValueOnce(new Error('Clear failed'));

      // Should not throw
      expect(() => cacheBackend.clear()).not.toThrow();
    });
  });

  // ==========================================================================
  // keys() Method
  // ==========================================================================

  describe('keys()', () => {
    it('should return all keys from memory cache', () => {
      const testData = { data: { minPrice: 800 }, timestamp: Date.now() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheBackend.set('key1', testData as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheBackend.set('key2', testData as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheBackend.set('key3', testData as any);

      const keys = cacheBackend.keys();

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
      expect(keys.length).toBe(3);
    });

    it('should return empty array when no keys', () => {
      const keys = cacheBackend.keys();
      expect(keys).toEqual([]);
    });
  });

  // ==========================================================================
  // loadFromStorage() (Private - tested via initialize())
  // ==========================================================================

  describe('loadFromStorage (via initialize())', () => {
    it('should load existing cache entries from IndexedDB', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockInitialize = vi.spyOn(indexedDBServiceModule.indexedDBService, 'initialize');
      const mockKeys = vi.spyOn(indexedDBServiceModule.indexedDBService, 'keys');
      const mockGet = vi.spyOn(indexedDBServiceModule.indexedDBService, 'get');

      const cachedData = { data: { minPrice: 999 }, timestamp: Date.now() };

      mockInitialize.mockResolvedValueOnce(true);
      mockKeys.mockResolvedValueOnce(['cached-key']);
      mockGet.mockResolvedValueOnce(cachedData);

      await cacheBackend.initialize();

      // Should have loaded the cached data
      expect(cacheBackend.get('cached-key')).toEqual(cachedData);
    });

    it('should skip entries that return null from IndexedDB', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockInitialize = vi.spyOn(indexedDBServiceModule.indexedDBService, 'initialize');
      const mockKeys = vi.spyOn(indexedDBServiceModule.indexedDBService, 'keys');
      const mockGet = vi.spyOn(indexedDBServiceModule.indexedDBService, 'get');

      mockInitialize.mockResolvedValueOnce(true);
      mockKeys.mockResolvedValueOnce(['null-key']);
      mockGet.mockResolvedValueOnce(null);

      await cacheBackend.initialize();

      // Should not have the null key
      expect(cacheBackend.get('null-key')).toBeNull();
    });

    it('should handle loadFromStorage error gracefully', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockInitialize = vi.spyOn(indexedDBServiceModule.indexedDBService, 'initialize');
      const mockKeys = vi.spyOn(indexedDBServiceModule.indexedDBService, 'keys');

      mockInitialize.mockResolvedValueOnce(true);
      mockKeys.mockRejectedValueOnce(new Error('Keys failed'));

      // Should not throw
      await expect(cacheBackend.initialize()).resolves.not.toThrow();
    });
  });
});

// ==========================================================================
// APIService.isInitialized() Test
// ==========================================================================

describe('APIService.isInitialized', () => {
  beforeEach(() => {
    APIService.resetInstance();
  });

  it('should eventually return true after getInstance and initialization completes', async () => {
    const indexedDBServiceModule = await import('../indexeddb-service');
    const mockInitialize = vi.spyOn(indexedDBServiceModule.indexedDBService, 'initialize');
    mockInitialize.mockResolvedValueOnce(true);

    APIService.getInstance();

    // Wait for async initialization
    await new Promise((r) => setTimeout(r, 100));

    expect(APIService.isInitialized()).toBe(true);
  });
});
