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
   * OPT-010 (2026-07-18 audit): memoized availability probe. The un-memoized
   * version performed two synchronous localStorage WRITES per storage access
   * (hundreds per tool navigation) and pinged every other open tab's
   * 'storage' listener. A backend that becomes unavailable mid-session is
   * caught by the try/catch in the actual operation instead.
   */
  private static available: boolean | null = null;

  /**
   * Clear the memoized availability probe.
   *
   * Test-isolation hook: `beforeEach` calls it so one suite's stubbed
   * localStorage cannot leak into the next. Kept for that reason rather than
   * pruned as test-only (2026-09-01 dead-code audit, DEAD-005).
   *
   * @testonly `beforeEach` isolation — a stubbed localStorage must not leak
   * between suites.
   */
  static resetAvailabilityCache(): void {
    this.available = null;
  }

  /**
   * Check if localStorage is available
   */
  static isAvailable(): boolean {
    if (this.available !== null) {
      return this.available;
    }
    try {
      const test = `${STORAGE_PREFIX}_test`;
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      this.available = true;
    } catch {
      this.available = false;
    }
    return this.available;
  }

  /**
   * Get an item from localStorage with type safety
   */
  static getItem<T>(key: string, defaultValue?: T): T | null {
    try {
      if (!this.isAvailable()) {
        return defaultValue ?? null;
      }

      const item = localStorage.getItem(key);

      if (item === null) {
        return defaultValue ?? null;
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
      return defaultValue ?? null;
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
        return defaultValue ?? null;
      }

      if (data.expiresAt && Date.now() > data.expiresAt) {
        this.removeItem(key);
        return defaultValue ?? null;
      }

      return data.value ?? defaultValue ?? null;
    } catch (error) {
      logger.warn(`Failed to get item with TTL: ${key}`, error);
      return defaultValue ?? null;
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
