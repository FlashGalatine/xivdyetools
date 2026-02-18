/**
 * XIV Dye Tools v2.0.0 - IndexedDB Service
 *
 * Phase 4: Advanced Features (F4)
 * Provides IndexedDB storage for larger data like price caches
 *
 * @module services/indexeddb-service
 */

import { logger } from '@shared/logger';

/**
 * Database configuration
 */
const DB_NAME = 'xivdyetools';
const DB_VERSION = 1;

/**
 * Store names in the database
 */
export const STORES = {
  PRICE_CACHE: 'price_cache',
  PALETTES: 'palettes',
  SETTINGS: 'settings',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/**
 * BUG-013 FIX: Result type for get operations with error context
 */
export type GetResult<T> = { found: true; value: T } | { found: false; error?: Error };

/**
 * IndexedDB Service
 * Provides async key-value storage using IndexedDB
 */
export class IndexedDBService {
  private static instance: IndexedDBService | null = null;
  private db: IDBDatabase | null = null;
  private isSupported: boolean = false;
  private initPromise: Promise<boolean> | null = null;

  private constructor() {
    this.isSupported = typeof indexedDB !== 'undefined';
  }

  /**
   * Get singleton instance
   */
  static getInstance(): IndexedDBService {
    if (!IndexedDBService.instance) {
      IndexedDBService.instance = new IndexedDBService();
    }
    return IndexedDBService.instance;
  }

  /**
   * Check if IndexedDB is supported
   */
  isIndexedDBSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<boolean> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<boolean> {
    if (!this.isSupported) {
      logger.warn('IndexedDB is not supported in this browser');
      return false;
    }

    if (this.db) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          logger.error('Failed to open IndexedDB:', request.error);
          resolve(false);
        };

        request.onsuccess = () => {
          this.db = request.result;
          logger.info('📦 IndexedDB initialized successfully');
          resolve(true);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create stores if they don't exist
          if (!db.objectStoreNames.contains(STORES.PRICE_CACHE)) {
            db.createObjectStore(STORES.PRICE_CACHE, { keyPath: 'key' });
            logger.debug('Created price_cache store');
          }

          if (!db.objectStoreNames.contains(STORES.PALETTES)) {
            const paletteStore = db.createObjectStore(STORES.PALETTES, { keyPath: 'id' });
            paletteStore.createIndex('dateCreated', 'dateCreated', { unique: false });
            logger.debug('Created palettes store');
          }

          if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
            db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
            logger.debug('Created settings store');
          }

          logger.info('📦 IndexedDB schema upgraded');
        };

        request.onblocked = () => {
          logger.warn('IndexedDB upgrade blocked - please close other tabs');
          resolve(false);
        };
      } catch (error) {
        logger.error('IndexedDB initialization error:', error);
        resolve(false);
      }
    });
  }

  /**
   * Check if the database is ready
   */
  isReady(): boolean {
    return this.db !== null;
  }

  /**
   * Get a value from a store
   */
  async get<T>(storeName: StoreName, key: string): Promise<T | null> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return null;
    }

    return new Promise<T | null>((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? (result.value ?? result) : null);
        };

        request.onerror = () => {
          logger.warn(`Failed to get ${key} from ${storeName}:`, request.error);
          resolve(null);
        };
      } catch (error) {
        logger.error(`IndexedDB get error:`, error);
        resolve(null);
      }
    });
  }

  /**
   * BUG-013 FIX: Get a value with error context
   * Returns a discriminated union to distinguish between "not found" and "error"
   */
  async getWithContext<T>(storeName: StoreName, key: string): Promise<GetResult<T>> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return { found: false, error: new Error('Database not initialized') };
    }

    return new Promise<GetResult<T>>((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            resolve({ found: true, value: (result.value ?? result) as T });
          } else {
            resolve({ found: false }); // Key doesn't exist (no error)
          }
        };

        request.onerror = () => {
          const error = request.error ?? new Error(`Failed to get ${key} from ${storeName}`);
          logger.warn(`Failed to get ${key} from ${storeName}:`, error);
          resolve({ found: false, error: error as Error });
        };
      } catch (error) {
        logger.error(`IndexedDB get error:`, error);
        resolve({ found: false, error: error as Error });
      }
    });
  }

  /**
   * Set a value in a store
   */
  async set<T>(storeName: StoreName, key: string, value: T): Promise<boolean> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        // Special handling for PALETTES store (uses keyPath: 'id')
        // Store the value directly instead of wrapping it
        const data = storeName === STORES.PALETTES ? value : { key, value };
        const request = store.put(data);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          logger.warn(`Failed to set ${key} in ${storeName}:`, request.error);
          resolve(false);
        };
      } catch (error) {
        logger.error(`IndexedDB set error:`, error);
        resolve(false);
      }
    });
  }

  /**
   * Delete a value from a store
   */
  async delete(storeName: StoreName, key: string): Promise<boolean> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          logger.warn(`Failed to delete ${key} from ${storeName}:`, request.error);
          resolve(false);
        };
      } catch (error) {
        logger.error(`IndexedDB delete error:`, error);
        resolve(false);
      }
    });
  }

  /**
   * Get all keys in a store
   */
  async keys(storeName: StoreName): Promise<string[]> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return [];
    }

    return new Promise<string[]>((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAllKeys();

        request.onsuccess = () => {
          resolve(request.result as string[]);
        };

        request.onerror = () => {
          logger.warn(`Failed to get keys from ${storeName}:`, request.error);
          resolve([]);
        };
      } catch (error) {
        logger.error(`IndexedDB keys error:`, error);
        resolve([]);
      }
    });
  }

  /**
   * Get all entries in a store
   */
  async getAll<T>(storeName: StoreName): Promise<T[]> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return [];
    }

    return new Promise<T[]>((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result.map((item: { value?: T }) => item.value ?? item);
          resolve(results as T[]);
        };

        request.onerror = () => {
          logger.warn(`Failed to get all from ${storeName}:`, request.error);
          resolve([]);
        };
      } catch (error) {
        logger.error(`IndexedDB getAll error:`, error);
        resolve([]);
      }
    });
  }

  /**
   * Clear all entries in a store
   */
  async clear(storeName: StoreName): Promise<boolean> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          logger.debug(`Cleared store ${storeName}`);
          resolve(true);
        };

        request.onerror = () => {
          logger.warn(`Failed to clear ${storeName}:`, request.error);
          resolve(false);
        };
      } catch (error) {
        logger.error(`IndexedDB clear error:`, error);
        resolve(false);
      }
    });
  }

  /**
   * Get count of entries in a store
   */
  async count(storeName: StoreName): Promise<number> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return 0;
    }

    return new Promise<number>((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          logger.warn(`Failed to count ${storeName}:`, request.error);
          resolve(0);
        };
      } catch (error) {
        logger.error(`IndexedDB count error:`, error);
        resolve(0);
      }
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
      logger.debug('IndexedDB connection closed');
    }
  }

  /**
   * Delete the entire database
   */
  async deleteDatabase(): Promise<boolean> {
    this.close();

    return new Promise<boolean>((resolve) => {
      if (!this.isSupported) {
        resolve(false);
        return;
      }

      try {
        const request = indexedDB.deleteDatabase(DB_NAME);

        request.onsuccess = () => {
          logger.info('IndexedDB database deleted');
          resolve(true);
        };

        request.onerror = () => {
          logger.error('Failed to delete IndexedDB:', request.error);
          resolve(false);
        };

        request.onblocked = () => {
          logger.warn('IndexedDB deletion blocked - please close other tabs');
          resolve(false);
        };
      } catch (error) {
        logger.error('IndexedDB deleteDatabase error:', error);
        resolve(false);
      }
    });
  }
}

// Export singleton instance
export const indexedDBService = IndexedDBService.getInstance();
