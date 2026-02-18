/**
 * LocaleRegistry - Manages loaded locale data cache
 *
 * Per R-4: Single Responsibility - caching loaded locales only
 * Per R-5: Uses Map for O(1) lookup performance
 *
 * @module services/localization
 */

import type { LocaleCode, LocaleData } from '../../types/index.js';

/**
 * Registry for loaded locale data with caching
 */
export class LocaleRegistry {
  private locales: Map<LocaleCode, LocaleData> = new Map();

  /**
   * Register a loaded locale in the cache
   *
   * @param data - Locale data to register
   *
   * @example
   * ```typescript
   * const registry = new LocaleRegistry();
   * registry.registerLocale(jaData);
   * ```
   */
  registerLocale(data: LocaleData): void {
    this.locales.set(data.locale, data);
  }

  /**
   * Check if locale is already loaded
   *
   * @param locale - Locale code to check
   * @returns true if locale is cached
   *
   * @example
   * ```typescript
   * if (!registry.hasLocale('ja')) {
   *     await loadJapanese();
   * }
   * ```
   */
  hasLocale(locale: LocaleCode): boolean {
    return this.locales.has(locale);
  }

  /**
   * Get loaded locale data
   *
   * @param locale - Locale code to retrieve
   * @returns Locale data if cached, null otherwise
   *
   * @example
   * ```typescript
   * const jaData = registry.getLocale('ja');
   * if (jaData) {
   *     console.log(jaData.labels.dye);
   * }
   * ```
   */
  getLocale(locale: LocaleCode): LocaleData | null {
    return this.locales.get(locale) || null;
  }

  /**
   * Clear all loaded locales from cache
   * Useful for memory management or testing
   *
   * @example
   * ```typescript
   * registry.clear(); // Free memory
   * ```
   */
  clear(): void {
    this.locales.clear();
  }

  /**
   * Get number of loaded locales
   *
   * @returns Count of cached locales
   */
  get size(): number {
    return this.locales.size;
  }
}
