/**
 * Localization — Platform-Agnostic Core Functions
 *
 * Wraps xivdyetools-core LocalizationService for per-locale dye name and
 * category lookups. Uses a per-locale instance cache to avoid singleton
 * race conditions in concurrent Cloudflare Worker requests.
 *
 * NOT included here (KV-specific, stay in discord-worker):
 * - resolveUserLocale
 * - getUserLanguagePreference / setUserLanguagePreference
 * - discordLocaleToLocaleCode
 *
 * @module localization
 */

import { LocalizationService } from '@xivdyetools/core';
export type { LocaleCode } from '@xivdyetools/bot-i18n';
import type { LocaleCode } from '@xivdyetools/bot-i18n';

// ============================================================================
// Per-Locale Instance Cache (avoids singleton race condition in CF Workers)
// ============================================================================

/**
 * Per-locale LocalizationService instance cache.
 *
 * Each locale gets its own instance with `currentLocale` permanently set.
 * This eliminates the race condition where concurrent requests could
 * overwrite a singleton's `currentLocale` during I/O yield points.
 *
 * Instances persist across requests within the same Worker isolate.
 */
const localeInstances = new Map<LocaleCode, LocalizationService>();

/**
 * Get or create a LocalizationService instance for a specific locale.
 * Instances are cached so each locale is loaded at most once per isolate.
 */
async function getLocaleInstance(locale: LocaleCode): Promise<LocalizationService> {
  const existing = localeInstances.get(locale);
  if (existing) return existing;

  const instance = new LocalizationService();
  await instance.setLocale(locale);
  localeInstances.set(locale, instance);
  return instance;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize localization for a specific locale.
 *
 * Pre-loads the locale instance into the cache for subsequent getter calls.
 * Does NOT mutate singleton state, so concurrent requests cannot interfere.
 *
 * @param locale - Locale code to initialize
 */
export async function initializeLocale(locale: LocaleCode): Promise<void> {
  try {
    await getLocaleInstance(locale);
  } catch {
    // Ensure English fallback is loaded on error
    await getLocaleInstance('en');
  }
}

/**
 * Get localized dye name from xivdyetools-core.
 *
 * Uses per-locale instances to avoid singleton race conditions.
 * Defaults to 'en' for backward compatibility with callers that don't pass locale.
 *
 * @param itemID - The dye's item ID (e.g., 5729)
 * @param fallbackName - Fallback name if localization fails
 * @param locale - Locale code (defaults to 'en')
 * @returns Localized name or fallback
 */
export function getLocalizedDyeName(itemID: number, fallbackName: string, locale: LocaleCode = 'en'): string {
  try {
    const instance = localeInstances.get(locale);
    if (!instance) return fallbackName;
    const localizedName = instance.getDyeName(itemID);
    return localizedName ?? fallbackName;
  } catch {
    return fallbackName;
  }
}

/**
 * Get localized category name from xivdyetools-core.
 *
 * Uses per-locale instances to avoid singleton race conditions.
 *
 * @param category - The category key (e.g., "Reds", "Blues")
 * @param locale - Locale code (defaults to 'en')
 * @returns Localized category name
 */
export function getLocalizedCategory(category: string, locale: LocaleCode = 'en'): string {
  try {
    const instance = localeInstances.get(locale);
    if (!instance) return category;
    return instance.getCategory(category);
  } catch {
    return category;
  }
}
