/**
 * XIV Dye Tools v2.0.0 - Storage Service
 *
 * Phase 12: Architecture Refactor
 * Safe localStorage wrapper with defensive checks
 *
 * @module services/storage-service
 */

import { STORAGE_PREFIX } from '@shared/constants';
import { logger } from '@shared/logger';

// ============================================================================
// Storage Service Class
// ============================================================================

/**
 * Safe localStorage wrapper with error handling and quota management
 */
export class StorageService {
  /**
   * Check if localStorage is available
   */
  static isAvailable(): boolean {
    try {
      const test = `${STORAGE_PREFIX}_test`;
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get an item from localStorage with type safety
   */
  static getItem<T>(key: string, defaultValue?: T): T | null {
    try {
      if (!this.isAvailable()) {
        return defaultValue || null;
      }

      const item = localStorage.getItem(key);

      if (item === null) {
        return defaultValue || null;
      }

      // Always try JSON.parse first for proper type restoration
      // This correctly handles all JSON types: objects, arrays, numbers, booleans, and strings
      try {
        return JSON.parse(item) as T;
      } catch {
        // If parsing fails, return raw string (for legacy non-JSON string values)
        return item as T;
      }
    } catch (error) {
      logger.warn(`Failed to get item from localStorage: ${key}`, error);
      return defaultValue || null;
    }
  }

  /**
   * Set an item in localStorage with error handling
   * WEB-BUG-004: Now returns false instead of throwing on quota exceeded
   * for consistent behavior with the boolean return type
   */
  static setItem<T>(key: string, value: T): boolean {
    try {
      if (!this.isAvailable()) {
        logger.warn('localStorage is not available');
        return false;
      }

      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'QuotaExceededError') {
          // WEB-BUG-004: Log error and return false instead of throwing
          // to match the boolean return type contract
          logger.error(`Storage quota exceeded when setting key: ${key}`);
          return false;
        }
      }

      logger.error(`Failed to set item in localStorage: ${key}`, error);
      return false;
    }
  }

  /**
   * Remove an item from localStorage
   */
  static removeItem(key: string): boolean {
    try {
      if (!this.isAvailable()) {
        return false;
      }

      localStorage.removeItem(key);
      return true;
    } catch (error) {
      logger.warn(`Failed to remove item from localStorage: ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all items from localStorage
   */
  static clear(): boolean {
    try {
      if (!this.isAvailable()) {
        return false;
      }

      localStorage.clear();
      return true;
    } catch (error) {
      logger.warn('Failed to clear localStorage', error);
      return false;
    }
  }

  /**
   * Get all storage keys
   */
  static getKeys(): string[] {
    try {
      if (!this.isAvailable()) {
        return [];
      }

      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      logger.warn('Failed to get storage keys', error);
      return [];
    }
  }

  /**
   * Get all items with a specific prefix
   */
  static getItemsByPrefix<T = unknown>(prefix: string): Record<string, T> {
    const result: Record<string, T> = {};

    try {
      if (!this.isAvailable()) {
        return result;
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              result[key] = JSON.parse(value) as T;
            } catch {
              result[key] = value as T;
            }
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to get items by prefix: ${prefix}`, error);
    }

    return result;
  }

  /**
   * Check if a key exists in localStorage
   */
  static hasItem(key: string): boolean {
    try {
      if (!this.isAvailable()) {
        return false;
      }

      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get the size of localStorage in bytes
   */
  static getSize(): number {
    let size = 0;

    try {
      if (!this.isAvailable()) {
        return 0;
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            size += key.length + value.length;
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to calculate storage size', error);
    }

    return size;
  }

  /**
   * Get the number of items stored
   */
  static getItemCount(): number {
    try {
      if (!this.isAvailable()) {
        return 0;
      }

      return localStorage.length;
    } catch {
      return 0;
    }
  }

  /**
   * Remove all items with a specific prefix
   */
  static removeByPrefix(prefix: string): number {
    let removed = 0;

    try {
      if (!this.isAvailable()) {
        return 0;
      }

      const keys = this.getKeys();
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
          removed++;
        }
      }
    } catch (error) {
      logger.warn(`Failed to remove items by prefix: ${prefix}`, error);
    }

    return removed;
  }

  /**
   * Store data with TTL (time to live)
   */
  static setItemWithTTL<T>(key: string, value: T, ttlMs: number): boolean {
    try {
      const data = {
        value,
        expiresAt: Date.now() + ttlMs,
      };

      return this.setItem(key, data);
    } catch (error) {
      logger.error(`Failed to set item with TTL: ${key}`, error);
      return false;
    }
  }

  /**
   * Get data with TTL, returns null if expired
   */
  static getItemWithTTL<T>(key: string, defaultValue?: T): T | null {
    try {
      const data = this.getItem<{ value: T; expiresAt: number }>(key);

      if (!data) {
        return defaultValue || null;
      }

      if (data.expiresAt && Date.now() > data.expiresAt) {
        this.removeItem(key);
        return defaultValue || null;
      }

      return data.value || defaultValue || null;
    } catch (error) {
      logger.warn(`Failed to get item with TTL: ${key}`, error);
      return defaultValue || null;
    }
  }

  /**
   * Create a namespaced storage instance
   */
  static createNamespace(prefix: string): NamespacedStorage {
    return new NamespacedStorage(prefix);
  }
}

// ============================================================================
// Namespaced Storage Class
// ============================================================================

/**
 * Storage instance with automatic key prefixing
 */
export class NamespacedStorage {
  constructor(private prefix: string) {}

  private getFullKey(key: string): string {
    return `${this.prefix}_${key}`;
  }

  getItem<T>(key: string, defaultValue?: T): T | null {
    return StorageService.getItem(this.getFullKey(key), defaultValue);
  }

  setItem<T>(key: string, value: T): boolean {
    return StorageService.setItem(this.getFullKey(key), value);
  }

  removeItem(key: string): boolean {
    return StorageService.removeItem(this.getFullKey(key));
  }

  hasItem(key: string): boolean {
    return StorageService.hasItem(this.getFullKey(key));
  }

  clear(): boolean {
    const keysToRemove = StorageService.getKeys().filter((k) => k.startsWith(this.prefix));

    for (const key of keysToRemove) {
      StorageService.removeItem(key);
    }

    return true;
  }

  getAll<T = unknown>(): Record<string, T> {
    return StorageService.getItemsByPrefix(this.prefix);
  }

  setItemWithTTL<T>(key: string, value: T, ttlMs: number): boolean {
    return StorageService.setItemWithTTL(this.getFullKey(key), value, ttlMs);
  }

  getItemWithTTL<T>(key: string, defaultValue?: T): T | null {
    return StorageService.getItemWithTTL(this.getFullKey(key), defaultValue);
  }
}

/**
 * Convenience export of app storage namespace
 */
export const appStorage = StorageService.createNamespace('xivdyetools');

// ============================================================================
// Secure Storage with Integrity Checks
// ============================================================================

/**
 * Maximum cache size in bytes (5 MB)
 */
const MAX_CACHE_SIZE = 5 * 1024 * 1024;

/**
 * Key for storing the size index metadata
 */
const SIZE_INDEX_KEY = '__secure_storage_size_index__';

/**
 * Storage entry with integrity check
 */
interface SecureStorageEntry<T> {
  value: T;
  checksum: string;
  timestamp: number;
}

/**
 * Metadata for tracking entry sizes (stored separately for efficient LRU)
 */
interface SizeIndexEntry {
  size: number;
  timestamp: number;
}

/**
 * Size index for efficient LRU eviction
 */
type SizeIndex = Record<string, SizeIndexEntry>;

/**
 * Generate HMAC checksum for data integrity
 */
async function generateChecksum(data: string): Promise<string> {
  try {
    // Use a simple secret key derived from the app (not truly secret, but prevents casual tampering)
    const secretKey = 'xivdyetools-integrity-key-v1';
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(data);

    // Import key for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Generate HMAC
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    logger.warn('Failed to generate checksum, falling back to simple hash', error);
    // Fallback: simple hash for environments without Web Crypto API
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Verify checksum for data integrity
 */
async function verifyChecksum(data: string, checksum: string): Promise<boolean> {
  const computed = await generateChecksum(data);
  return computed === checksum;
}

/**
 * Secure storage methods with integrity checks and size limits
 */
export class SecureStorage {
  /** In-memory cache of the size index for fast lookups */
  private static sizeIndexCache: SizeIndex | null = null;

  /** BUG-007 FIX: Mutex for size index operations to prevent race conditions */
  private static sizeIndexMutex: Promise<void> = Promise.resolve();

  /**
   * Load the size index from storage (with caching)
   */
  private static loadSizeIndex(): SizeIndex {
    if (this.sizeIndexCache !== null) {
      return this.sizeIndexCache;
    }

    const index = StorageService.getItem<SizeIndex>(SIZE_INDEX_KEY);
    this.sizeIndexCache = index || {};
    return this.sizeIndexCache;
  }

  /**
   * Save the size index to storage
   */
  private static saveSizeIndex(): void {
    if (this.sizeIndexCache !== null) {
      StorageService.setItem(SIZE_INDEX_KEY, this.sizeIndexCache);
    }
  }

  /**
   * Update the size index for a key
   * BUG-007 FIX: Use mutex to prevent race conditions on concurrent writes
   */
  private static updateSizeIndex(key: string, size: number, timestamp: number): void {
    this.sizeIndexMutex = this.sizeIndexMutex.then(() => {
      const index = this.loadSizeIndex();
      index[key] = { size, timestamp };
      this.sizeIndexCache = index;
      this.saveSizeIndex();
    });
  }

  /**
   * Remove a key from the size index
   */
  private static removeFromSizeIndex(key: string): void {
    const index = this.loadSizeIndex();
    delete index[key];
    this.sizeIndexCache = index;
    this.saveSizeIndex();
  }

  /**
   * Get total cached size from the index
   */
  private static getCachedTotalSize(): number {
    const index = this.loadSizeIndex();
    return Object.values(index).reduce((sum, entry) => sum + entry.size, 0);
  }

  /**
   * Store item with integrity check
   */
  static async setItem<T>(key: string, value: T): Promise<boolean> {
    try {
      if (!StorageService.isAvailable()) {
        return false;
      }

      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const checksum = await generateChecksum(serialized);
      const timestamp = Date.now();

      // Check cache size after checksum generation to avoid race conditions
      await this.enforceSizeLimit();

      const entry: SecureStorageEntry<T> = {
        value,
        checksum,
        timestamp,
      };

      const success = StorageService.setItem(key, entry);

      // Update size index if successful
      if (success) {
        const entrySize = key.length + JSON.stringify(entry).length;
        this.updateSizeIndex(key, entrySize, timestamp);
      }

      return success;
    } catch (error) {
      logger.error(`Failed to set secure item: ${key}`, error);
      return false;
    }
  }

  /**
   * Get item with integrity verification
   */
  static async getItem<T>(key: string, defaultValue?: T): Promise<T | null> {
    try {
      const entry = StorageService.getItem<SecureStorageEntry<T>>(key);

      if (!entry) {
        return defaultValue || null;
      }

      // Verify integrity
      const serialized =
        typeof entry.value === 'string' ? String(entry.value) : JSON.stringify(entry.value);
      const isValid = await verifyChecksum(serialized, entry.checksum);

      if (!isValid) {
        logger.warn(`Integrity check failed for key: ${key}. Removing corrupted entry.`);
        StorageService.removeItem(key);
        return defaultValue || null;
      }

      return entry.value;
    } catch (error) {
      logger.warn(`Failed to get secure item: ${key}`, error);
      // If entry structure is invalid, remove it
      StorageService.removeItem(key);
      return defaultValue || null;
    }
  }

  /**
   * Remove item
   */
  static removeItem(key: string): boolean {
    const success = StorageService.removeItem(key);
    if (success) {
      this.removeFromSizeIndex(key);
    }
    return success;
  }

  /**
   * Clear all secure storage
   */
  static clear(): boolean {
    const success = StorageService.clear();
    if (success) {
      this.sizeIndexCache = {};
    }
    return success;
  }

  /**
   * Enforce maximum cache size using LRU eviction (optimized with size index)
   */
  private static async enforceSizeLimit(): Promise<void> {
    try {
      // Use cached size from index for fast check
      const currentSize = this.getCachedTotalSize();

      if (currentSize < MAX_CACHE_SIZE) {
        return; // Within limits
      }

      // Use the size index for LRU eviction (no need to read all entries)
      const index = this.loadSizeIndex();
      const entries = Object.entries(index)
        .filter(([key]) => key !== SIZE_INDEX_KEY) // Don't evict the index itself
        .map(([key, data]) => ({
          key,
          timestamp: data.timestamp,
          size: data.size,
        }));

      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest entries until under limit
      let freed = 0;
      const totalSize = currentSize;
      for (const entry of entries) {
        if (totalSize - freed < MAX_CACHE_SIZE) {
          break;
        }
        StorageService.removeItem(entry.key);
        delete index[entry.key];
        freed += entry.size;
      }

      // Update the index cache and persist
      if (freed > 0) {
        this.sizeIndexCache = index;
        this.saveSizeIndex();
        logger.info(`LRU eviction: Freed ${freed} bytes from cache`);
      }
    } catch (error) {
      logger.warn('Failed to enforce size limit', error);
    }
  }

  /**
   * Get current cache size
   */
  static getSize(): number {
    return StorageService.getSize();
  }

  /**
   * Get cache size limit
   */
  static getSizeLimit(): number {
    return MAX_CACHE_SIZE;
  }

  /**
   * Rebuild size index from actual storage (for recovery/sync)
   */
  static rebuildSizeIndex(): void {
    const keys = StorageService.getKeys();
    const newIndex: SizeIndex = {};

    for (const key of keys) {
      // Skip the size index key itself
      if (key === SIZE_INDEX_KEY) continue;

      try {
        const entry = StorageService.getItem<SecureStorageEntry<unknown>>(key);
        if (entry && entry.timestamp) {
          const value = StorageService.getItem(key);
          const size = key.length + (value ? JSON.stringify(value).length : 0);
          newIndex[key] = { size, timestamp: entry.timestamp };
        }
      } catch {
        // Skip invalid entries
      }
    }

    this.sizeIndexCache = newIndex;
    this.saveSizeIndex();
    logger.info(`Size index rebuilt with ${Object.keys(newIndex).length} entries`);
  }

  /**
   * Clean up corrupted entries
   */
  static async cleanupCorrupted(): Promise<number> {
    let removed = 0;
    const keys = StorageService.getKeys();
    const index = this.loadSizeIndex();

    for (const key of keys) {
      // Skip the size index key itself
      if (key === SIZE_INDEX_KEY) continue;

      try {
        const entry = StorageService.getItem<SecureStorageEntry<unknown>>(key);
        if (!entry || !entry.checksum || !entry.timestamp) {
          // Invalid structure
          StorageService.removeItem(key);
          delete index[key];
          removed++;
          continue;
        }

        // Verify checksum
        const serialized =
          typeof entry.value === 'string' ? String(entry.value) : JSON.stringify(entry.value);
        const isValid = await verifyChecksum(serialized, entry.checksum);

        if (!isValid) {
          StorageService.removeItem(key);
          delete index[key];
          removed++;
        }
      } catch {
        // Entry is corrupted, remove it
        StorageService.removeItem(key);
        delete index[key];
        removed++;
      }
    }

    // Update the size index
    if (removed > 0) {
      this.sizeIndexCache = index;
      this.saveSizeIndex();
      logger.info(`Cleanup: Removed ${removed} corrupted entries`);
    }

    return removed;
  }
}
