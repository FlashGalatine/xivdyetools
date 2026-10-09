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
const DB_VERSION = 3; // v3: − image_cache (FINDING-009); v2: + image_cache (OPT-012)

/**
 * Store names in the database
 */
export const STORES = {
  PRICE_CACHE: 'price_cache',
  PALETTES: 'palettes',
  SETTINGS: 'settings',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/** Stores that wrap each value as `{ key, value }` — every one but PALETTES (keyPath 'id') */
type KeyValueStoreName = Exclude<StoreName, typeof STORES.PALETTES>;

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
          const db = request.result;
          // BUG-119: another tab opening a newer DB_VERSION fires this on
          // every open connection, and its upgrade stays `blocked` (that tab's
          // initialize() resolving false, so its price cache never hydrates)
          // until they close. Let go; the next call here re-opens and gets a
          // VersionError, the honest answer for code older than the database.
          db.onversionchange = () => {
            db.close();
            if (this.db === db) {
              this.db = null;
              this.initPromise = null;
            }
            logger.info('IndexedDB connection released for a newer version');
          };
          this.db = db;
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

          // FINDING-009: one-time purge of the images stored by ≤ 5.0.0 visits.
          // The extractor no longer persists anything, so the whole store goes
          // — this runs once per browser, on the first open at v3.
          if (db.objectStoreNames.contains('image_cache')) {
            db.deleteObjectStore('image_cache');
            logger.debug('Deleted image_cache store');
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
   * Get every key/value pair in a key-value store in ONE readonly transaction.
   *
   * OPT-009: what the price-cache hydration needs — the keys stay with their
   * values, and the former `keys()` plus a `get()` per key cost one
   * transaction per entry.
   */
  async entries<T>(storeName: KeyValueStoreName): Promise<Array<[string, T]>> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return [];
    }

    return new Promise<Array<[string, T]>>((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const pairs: Array<[string, T]> = [];
          for (const record of request.result as Array<{ key?: unknown; value?: T } | null>) {
            if (typeof record?.key === 'string' && record.value !== undefined) {
              pairs.push([record.key, record.value]);
            }
          }
          resolve(pairs);
        };

        request.onerror = () => {
          logger.warn(`Failed to get entries from ${storeName}:`, request.error);
          resolve([]);
        };
      } catch (error) {
        logger.error(`IndexedDB entries error:`, error);
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
}

// Export singleton instance
export const indexedDBService = IndexedDBService.getInstance();
