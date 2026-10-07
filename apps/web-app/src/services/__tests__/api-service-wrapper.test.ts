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

  describe('clearCache', () => {
    it('should clear cache without throwing', async () => {
      await expect(APIService.clearCache()).resolves.not.toThrow();
    });
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
    it('should load from storage after successful initialization', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockInitialize = vi.spyOn(indexedDBServiceModule.indexedDBService, 'initialize');
      const mockEntries = vi.spyOn(indexedDBServiceModule.indexedDBService, 'entries');

      const first = { data: { minPrice: 1 }, timestamp: Date.now() };
      const second = { data: { minPrice: 2 }, timestamp: Date.now() };
      mockInitialize.mockResolvedValueOnce(true);
      mockEntries.mockResolvedValueOnce([
        ['key1', first],
        ['key2', second],
      ]);

      await cacheBackend.initialize();

      expect(mockEntries).toHaveBeenCalledWith('price_cache');
      expect(cacheBackend.get('key1')).toEqual(first);
      expect(cacheBackend.get('key2')).toEqual(second);
    });

    it('should not load from storage if initialization returns false', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockInitialize = vi.spyOn(indexedDBServiceModule.indexedDBService, 'initialize');
      const mockEntries = vi.spyOn(indexedDBServiceModule.indexedDBService, 'entries');

      mockInitialize.mockResolvedValueOnce(false);

      await cacheBackend.initialize();

      expect(mockEntries).not.toHaveBeenCalled();
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

    // webapp-services-17: this used to assert
    // `expect(() => cacheBackend.delete(...)).not.toThrow()` on a SYNCHRONOUS
    // void call whose rejection is already absorbed by an attached `.catch()`.
    // That holds for any implementation whatsoever. It also drove
    // `mockRejectedValueOnce`, a state the real IndexedDBService cannot produce
    // -- it resolves `false`. Assert the outcome the caller actually depends
    // on: the memory tier is evicted regardless of what IndexedDB does.
    it('evicts from the memory cache even when the IndexedDB delete fails', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockDelete = vi.spyOn(indexedDBServiceModule.indexedDBService, 'delete');
      mockDelete.mockResolvedValueOnce(false);

      await cacheBackend.set('fail-delete', { value: 1 } as never);
      expect(await cacheBackend.get('fail-delete')).not.toBeNull();

      cacheBackend.delete('fail-delete');
      await new Promise((r) => setTimeout(r, 50));

      expect(await cacheBackend.get('fail-delete')).toBeNull();
      expect(mockDelete).toHaveBeenCalledWith('price_cache', 'fail-delete');
    });

    it('does not let a rejected IndexedDB delete escape as an unhandled rejection', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockDelete = vi.spyOn(indexedDBServiceModule.indexedDBService, 'delete');
      mockDelete.mockRejectedValueOnce(new Error('Delete failed'));

      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      try {
        cacheBackend.delete('fail-delete');
        await new Promise((r) => setTimeout(r, 50));
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off('unhandledRejection', unhandled);
      }
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

    // webapp-services-17, same shape as the delete case above.
    it('empties the memory cache even when the IndexedDB clear fails', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockClear = vi.spyOn(indexedDBServiceModule.indexedDBService, 'clear');
      mockClear.mockResolvedValueOnce(false);

      await cacheBackend.set('a', { value: 1 } as never);
      await cacheBackend.set('b', { value: 2 } as never);

      cacheBackend.clear();
      await new Promise((r) => setTimeout(r, 50));

      expect(await cacheBackend.get('a')).toBeNull();
      expect(await cacheBackend.get('b')).toBeNull();
      expect(mockClear).toHaveBeenCalledWith('price_cache');
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
      const mockEntries = vi.spyOn(indexedDBServiceModule.indexedDBService, 'entries');

      const cachedData = { data: { minPrice: 999 }, timestamp: Date.now() };

      mockInitialize.mockResolvedValueOnce(true);
      mockEntries.mockResolvedValueOnce([['cached-key', cachedData]]);

      await cacheBackend.initialize();

      // Should have loaded the cached data
      expect(cacheBackend.get('cached-key')).toEqual(cachedData);
    });

    it('should skip entries that return null from IndexedDB', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockInitialize = vi.spyOn(indexedDBServiceModule.indexedDBService, 'initialize');
      const mockEntries = vi.spyOn(indexedDBServiceModule.indexedDBService, 'entries');

      mockInitialize.mockResolvedValueOnce(true);
      mockEntries.mockResolvedValueOnce([['null-key', null]]);

      await cacheBackend.initialize();

      // Should not have the null key
      expect(cacheBackend.get('null-key')).toBeNull();
    });

    /**
     * OPT-009 harness: points the real indexedDBService singleton at a fake
     * open connection over `records`, so the tests below count the
     * transactions the hydration actually opens rather than spying on which
     * service methods it happens to call. `getAll` can be held back to model a
     * slow read, and with `pendingOpen` the database open itself stays pending
     * (no connection, `initPromise` unresolved) until `completeOpen()`.
     * `getAll` snapshots the records when it is requested and `clear` empties
     * them, so the order the two transactions are created in is what counts.
     */
    async function withFakeConnection(
      records: Map<string, unknown>,
      run: (fake: {
        transaction: ReturnType<typeof vi.fn>;
        getAllCalled: () => boolean;
        releaseGetAll: () => void;
        completeOpen: () => void;
      }) => Promise<void>,
      { holdGetAll = false, pendingOpen = false } = {}
    ): Promise<void> {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const service = indexedDBServiceModule.indexedDBService as unknown as {
        db: unknown;
        initPromise: Promise<boolean> | null;
      };
      const saved = { db: service.db, initPromise: service.initPromise };

      interface FakeRequest {
        result: unknown;
        error: null;
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
      }
      const request = (result: unknown, hold = false): FakeRequest => {
        const r: FakeRequest = { result, error: null, onsuccess: null, onerror: null };
        if (!hold) queueMicrotask(() => r.onsuccess?.());
        else releaseGetAll = () => r.onsuccess?.();
        return r;
      };
      let releaseGetAll = (): void => {};
      let getAllCalled = false;
      const store = {
        get: (key: string) =>
          request(records.has(key) ? { key, value: records.get(key) } : undefined),
        getAllKeys: () => request([...records.keys()]),
        getAll: () => {
          getAllCalled = true;
          return request(
            [...records.entries()].map(([key, value]) => ({ key, value })),
            holdGetAll
          );
        },
        put: () => request(undefined),
        clear: () => {
          records.clear();
          return request(undefined);
        },
      };
      const transaction = vi.fn(() => ({ objectStore: () => store }));
      const db = { transaction };
      let completeOpen = (): void => {};
      if (pendingOpen) {
        service.db = null;
        service.initPromise = new Promise<boolean>((resolve) => {
          completeOpen = () => {
            service.db = db;
            resolve(true);
          };
        });
      } else {
        service.db = db;
        service.initPromise = Promise.resolve(true);
      }
      try {
        await run({
          transaction,
          getAllCalled: () => getAllCalled,
          releaseGetAll: () => releaseGetAll(),
          completeOpen: () => completeOpen(),
        });
      } finally {
        service.db = saved.db;
        service.initPromise = saved.initPromise;
      }
    }

    const priceEntry = (minPrice: number) => ({
      data: { minPrice },
      timestamp: Date.now(),
      ttl: 60_000,
    });

    // OPT-009: hydration ran keys() and then one serial readonly `get`
    // transaction per key, so the memory cache filled N transactions late.
    it('hydrates every persisted price in one read transaction (OPT-009)', async () => {
      const records = new Map<string, unknown>();
      for (let i = 0; i < 200; i++) records.set(`price-${i}`, priceEntry(i));

      await withFakeConnection(records, async ({ transaction }) => {
        await cacheBackend.initialize();

        expect(cacheBackend.keys().length).toBe(200);
        expect(cacheBackend.get('price-0')).toEqual(records.get('price-0'));
        expect(cacheBackend.get('price-199')).toEqual(records.get('price-199'));
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(transaction).toHaveBeenCalledWith('price_cache', 'readonly');
      });
    });

    it('keeps a price fetched while the hydration read was in flight (OPT-009)', async () => {
      const stale = priceEntry(1);
      const fresh = priceEntry(2);
      await withFakeConnection(
        new Map<string, unknown>([['price-1', stale]]),
        async ({ getAllCalled, releaseGetAll }) => {
          const init = cacheBackend.initialize();
          await vi.waitFor(() => expect(getAllCalled()).toBe(true));

          // A live fetch lands first; the stored copy is older
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cacheBackend.set('price-1', fresh as any);
          releaseGetAll();
          await init;

          expect(cacheBackend.get('price-1')).toEqual(fresh);
        },
        { holdGetAll: true }
      );
    });

    // FINDING-008 must hold for the bulk read too: one snapshot read would
    // otherwise put back EVERY cleared price, not just one in-flight entry.
    it('does not repopulate prices cleared while the hydration read was in flight (OPT-009)', async () => {
      await withFakeConnection(
        new Map<string, unknown>([
          ['price-1', priceEntry(1)],
          ['price-2', priceEntry(2)],
        ]),
        async ({ getAllCalled, releaseGetAll }) => {
          const init = cacheBackend.initialize();
          await vi.waitFor(() => expect(getAllCalled()).toBe(true));

          cacheBackend.clear(); // logout
          releaseGetAll();
          await init;

          expect(cacheBackend.keys()).toEqual([]);
        },
        { holdGetAll: true }
      );
    });

    // The guard was captured inside the hydration, AFTER the database open.
    // A clear() landing while the open is still pending queues behind the
    // same open as the hydration, but the hydration's continuation was
    // registered first: it read the already-bumped generation and took its
    // snapshot before the clear's transaction emptied the store, so every
    // cleared price came back.
    it('does not repopulate prices cleared while the database open was pending (OPT-009)', async () => {
      const records = new Map<string, unknown>([
        ['price-1', priceEntry(1)],
        ['price-2', priceEntry(2)],
      ]);
      await withFakeConnection(
        records,
        async ({ transaction, completeOpen }) => {
          const init = cacheBackend.initialize();
          await Promise.resolve();
          expect(transaction).not.toHaveBeenCalled(); // the open is still pending

          cacheBackend.clear(); // logout
          completeOpen();
          await init;
          await vi.waitFor(() => expect(records.size).toBe(0));

          // Precondition: the snapshot really was taken before the store was cleared
          expect(transaction.mock.calls.map((call) => call[1])).toEqual(['readonly', 'readwrite']);
          expect(cacheBackend.keys()).toEqual([]);
        },
        { pendingOpen: true }
      );
    });

    it('should handle loadFromStorage error gracefully', async () => {
      const indexedDBServiceModule = await import('../indexeddb-service');
      const mockInitialize = vi.spyOn(indexedDBServiceModule.indexedDBService, 'initialize');
      const mockEntries = vi.spyOn(indexedDBServiceModule.indexedDBService, 'entries');

      mockInitialize.mockResolvedValueOnce(true);
      mockEntries.mockRejectedValueOnce(new Error('Entries failed'));

      // Should not throw
      await expect(cacheBackend.initialize()).resolves.not.toThrow();
    });
  });
});
