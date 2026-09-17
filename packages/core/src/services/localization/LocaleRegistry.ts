/**
 * LocaleRegistry - Manages loaded locale data cache
 *
 * Per R-4: Single Responsibility - caching loaded locales only
 * Per R-5: Uses Map for O(1) lookup performance
 *
 * @module services/localization
 */

import type { LocaleCode, LocaleData } from '@xivdyetools/types';

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
   * Documentation-only note (2026-09-16 audit, coordinator ruling on
   * BUG-010's sibling finding): this returns the **shared bundled locale
   * module** registered via {@link registerLocale} (itself the same object
   * `LocaleLoader.loadLocale` returned) — every caller retrieving a given
   * locale gets back the same reference. Treat it as read-only; it is not
   * cloned per lookup for the same reason `LocaleLoader` doesn't clone per
   * load — six locale trees is real work to redo on every read for data
   * that is never legitimately mutated at runtime.
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
