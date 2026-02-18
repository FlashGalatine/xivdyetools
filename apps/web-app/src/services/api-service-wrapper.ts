/* istanbul ignore file */
/**
 * API Service Singleton Wrapper
 * Wraps xivdyetools-core APIService with IndexedDB cache (F4)
 */

import {
  APIService as CoreAPIService,
  type ICacheBackend,
  type PriceData,
  type CachedData,
  UNIVERSALIS_API_BASE,
  NoOpLogger,
} from '@xivdyetools/core';
import { indexedDBService, STORES } from './indexeddb-service';
import { logger } from '@shared/logger';

/**
 * Get the Universalis API base URL
 * Uses proxy URL in production to avoid CORS issues with rate limit responses
 *
 * Order of precedence:
 * 1. VITE_UNIVERSALIS_PROXY_URL environment variable (for local development)
 * 2. Production proxy URL (for deployed app)
 * 3. Direct Universalis API URL (fallback - not recommended for browser)
 */
function getUniversalisBaseUrl(): string {
  // Check for environment variable (local dev)
  const envUrl = import.meta.env.VITE_UNIVERSALIS_PROXY_URL;
  if (envUrl) {
    logger.info(`Using Universalis proxy from env: ${envUrl}`);
    return envUrl;
  }

  // In production, use the deployed proxy worker
  // This ensures CORS headers are always present, even on error responses (like 429)
  if (import.meta.env.PROD) {
    const proxyUrl = 'https://proxy.xivdyetools.app/api/v2';
    logger.info(`Using production Universalis proxy: ${proxyUrl}`);
    return proxyUrl;
  }

  // Fallback to direct API (development without proxy)
  // Note: This may cause CORS issues if Universalis returns 429 errors
  logger.warn('Using direct Universalis API - CORS issues may occur on rate limit');
  return UNIVERSALIS_API_BASE;
}

/**
 * IndexedDB Cache Backend for browser environment (F4)
 * Uses IndexedDB for larger storage capacity and better performance
 * Falls back to memory-only if IndexedDB is unavailable
 */
export class IndexedDBCacheBackend implements ICacheBackend {
  private memoryCache: Map<string, CachedData<PriceData>> = new Map();
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the backend asynchronously
   * BUG-004 FIX: Don't clear initPromise on error to prevent race conditions
   * with concurrent callers. Use reinitialize() for explicit retry.
   */
  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  /**
   * Perform the actual initialization
   */
  private async doInitialize(): Promise<void> {
    const success = await indexedDBService.initialize();
    if (success) {
      await this.loadFromStorage();
    }
  }

  /**
   * Force re-initialization (for recovery after errors)
   */
  async reinitialize(): Promise<void> {
    this.initPromise = null;
    return this.initialize();
  }

  get(key: string): CachedData<PriceData> | null {
    // Return from memory cache for sync operation
    return this.memoryCache.get(key) ?? null;
  }

  set(key: string, value: CachedData<PriceData>): void {
    // Update memory cache immediately
    this.memoryCache.set(key, value);

    // Persist to IndexedDB asynchronously with retry logic
    void this.persistWithRetry(key, value);
  }

  /**
   * Persist to IndexedDB with retry logic
   * If persistence consistently fails, remove from memory cache to avoid state mismatch
   */
  private async persistWithRetry(
    key: string,
    value: CachedData<PriceData>,
    attempt = 1,
    maxAttempts = 2
  ): Promise<void> {
    try {
      await indexedDBService.set(STORES.PRICE_CACHE, key, value);
    } catch (error) {
      if (attempt < maxAttempts) {
        logger.warn(
          `Failed to persist price data (attempt ${attempt}/${maxAttempts}), retrying:`,
          error
        );
        // Retry with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, attempt * 100));
        await this.persistWithRetry(key, value, attempt + 1, maxAttempts);
      } else {
        logger.error(
          'Failed to persist price data after retries, removing from memory cache:',
          error
        );
        // Remove from memory cache to prevent false positive caching
        this.memoryCache.delete(key);
      }
    }
  }

  delete(key: string): void {
    this.memoryCache.delete(key);
    void indexedDBService.delete(STORES.PRICE_CACHE, key).catch((error) => {
      logger.warn('Failed to delete from IndexedDB:', error);
    });
  }

  clear(): void {
    this.memoryCache.clear();
    indexedDBService.clear(STORES.PRICE_CACHE).catch((error) => {
      logger.warn('Failed to clear IndexedDB cache:', error);
    });
  }

  keys(): string[] {
    return Array.from(this.memoryCache.keys());
  }

  /**
   * Load all cached data from IndexedDB into memory
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const keys = await indexedDBService.keys(STORES.PRICE_CACHE);
      for (const key of keys) {
        const data = await indexedDBService.get<CachedData<PriceData>>(STORES.PRICE_CACHE, key);
        if (data) {
          this.memoryCache.set(key, data);
        }
      }
      if (keys.length > 0) {
        logger.debug(`Loaded ${keys.length} price cache entries from IndexedDB`);
      }
    } catch (error) {
      logger.warn('Failed to load price cache from IndexedDB:', error);
    }
  }
}

/**
 * LocalStorage Cache Backend (fallback when IndexedDB unavailable)
 * @deprecated Use IndexedDBCacheBackend instead
 */
export class LocalStorageCacheBackend implements ICacheBackend {
  private keyPrefix = 'xivdyetools_api_';

  get(key: string): CachedData<PriceData> | null {
    try {
      const data = localStorage.getItem(this.keyPrefix + key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  set(key: string, value: CachedData<PriceData>): void {
    try {
      localStorage.setItem(this.keyPrefix + key, JSON.stringify(value));
    } catch (error) {
      logger.warn('Failed to cache price data:', error);
    }
  }

  delete(key: string): void {
    try {
      localStorage.removeItem(this.keyPrefix + key);
    } catch {
      // Ignore errors
    }
  }

  clear(): void {
    try {
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.keyPrefix)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore errors
    }
  }

  keys(): string[] {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.keyPrefix)) {
          keys.push(key.substring(this.keyPrefix.length));
        }
      }
      return keys;
    } catch {
      return [];
    }
  }
}

/**
 * Web app singleton wrapper for APIService
 * Maintains backward compatibility with existing code using getInstance()
 */
export class APIService {
  private static instance: CoreAPIService | null = null;
  private static cacheBackend: IndexedDBCacheBackend | null = null;
  private static initialized: boolean = false;

  /**
   * Get singleton instance of APIService
   */
  static getInstance(): CoreAPIService {
    if (!APIService.instance) {
      // Use IndexedDB cache backend (F4)
      APIService.cacheBackend = new IndexedDBCacheBackend();

      // Get the appropriate base URL (proxy in production, direct in dev)
      const baseUrl = getUniversalisBaseUrl();

      // Create APIService with cache backend and proxy URL
      // Include logger to ensure options-based API is used (backwards compatible with older core versions)
      APIService.instance = new CoreAPIService({
        cacheBackend: APIService.cacheBackend,
        baseUrl,
        logger: NoOpLogger,
      });
      logger.info('✅ APIService initialized from xivdyetools-core with IndexedDB cache');

      // Initialize cache backend asynchronously (won't block)
      void APIService.cacheBackend.initialize().then(() => {
        APIService.initialized = true;
        const dbg = (logger as unknown as Record<string, unknown>).debug as
          | ((...args: unknown[]) => void)
          | undefined;
        if (typeof dbg === 'function') {
          dbg('IndexedDB cache backend initialized');
        } else {
          // Fallback to console in test/mocked environments
          console.debug('IndexedDB cache backend initialized');
        }
      });
    }
    return APIService.instance;
  }

  /**
   * Check if the cache backend is fully initialized
   */
  static isInitialized(): boolean {
    return APIService.initialized;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    APIService.instance = null;
  }

  /**
   * Format price with commas and G suffix
   * Delegates to core APIService
   */
  static formatPrice(price: number): string {
    return CoreAPIService.formatPrice(price);
  }

  /**
   * Clear all cached price data
   */
  static async clearCache(): Promise<void> {
    return APIService.getInstance().clearCache();
  }

  /**
   * Get price data for a specific item
   */
  static async getPriceData(
    itemID: number,
    worldID?: number,
    dataCenterID?: string
  ): Promise<PriceData | null> {
    return APIService.getInstance().getPriceData(itemID, worldID, dataCenterID);
  }
}

// Export singleton instance for direct use
export const apiService = APIService.getInstance();

// Re-export types
export type { PriceData };
