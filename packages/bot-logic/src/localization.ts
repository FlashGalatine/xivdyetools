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
import type { ColorWheelId } from '@xivdyetools/core';
import type { HarmonyTypeKey, VisionType } from '@xivdyetools/types';
export type { LocaleCode } from './i18n/index.js';
import type { LocaleCode } from './i18n/index.js';

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

/**
 * Get a localized harmony-type name from xivdyetools-core (TERM-001).
 *
 * The bot used to name harmonies from its own `harmony.*` keys while web-app
 * and og-worker both used core's, so one product called Split-Complementary
 * 分裂補色 and the other スプリット補色. Core is the single vocabulary now —
 * PR #159 already made it the single *algorithm*.
 *
 * @param key - Core's camelCase harmony key (`splitComplementary`, not `split-complementary`)
 * @param locale - Locale code (defaults to 'en')
 * @returns Localized harmony name, or the key when the locale is not loaded
 */
export function getLocalizedHarmonyType(key: HarmonyTypeKey, locale: LocaleCode = 'en'): string {
  try {
    const instance = localeInstances.get(locale);
    if (!instance) return key;
    return instance.getHarmonyType(key);
  } catch {
    return key;
  }
}

/** Localised colour-wheel name from core's shared vocabulary; the id if the locale is not loaded. */
export function getLocalizedColorWheelName(id: ColorWheelId, locale: LocaleCode = 'en'): string {
  try {
    const instance = localeInstances.get(locale);
    if (!instance) return id;
    return instance.getColorWheelName(id);
  } catch {
    return id;
  }
}

/**
 * Get a localized vision-type (colour-blindness lens) name from
 * xivdyetools-core (TERM-001) — the same one-vocabulary rule as harmonies.
 *
 * Uses core's SHORT `visions.*` form (`제1색맹`), not the long `visionTypes.*`
 * one that carries a parenthetical gloss: these appear as card and embed
 * labels, where the gloss does not fit.
 *
 * @param key - Vision type (`protanopia`, `normal`, …)
 * @param locale - Locale code (defaults to 'en')
 * @returns Localized vision name, or the key when the locale is not loaded
 */
export function getLocalizedVisionType(key: VisionType, locale: LocaleCode = 'en'): string {
  try {
    const instance = localeInstances.get(locale);
    if (!instance) return key;
    return instance.getVisionShort(key);
  } catch {
    return key;
  }
}

/**
 * Get localized acquisition source from xivdyetools-core (the 5.0 card's SRC
 * row value, e.g. "Dye Vendor" → "Farbstoffverkäufer").
 *
 * @param acquisition - The acquisition key (e.g., "Dye Vendor")
 * @param locale - Locale code (defaults to 'en')
 * @returns Localized acquisition name
 */
export function getLocalizedAcquisition(acquisition: string, locale: LocaleCode = 'en'): string {
  try {
    const instance = localeInstances.get(locale);
    if (!instance) return acquisition;
    return instance.getAcquisition(acquisition);
  } catch {
    return acquisition;
  }
}

/**
 * Get localized currency display label from xivdyetools-core
 * ("Gil" → "ギル", "Venture Coffer" → "Schatzkiste").
 *
 * @param currency - The currency key (e.g., "Gil")
 * @param locale - Locale code (defaults to 'en')
 * @returns Localized currency label
 */
export function getLocalizedCurrency(currency: string, locale: LocaleCode = 'en'): string {
  try {
    const instance = localeInstances.get(locale);
    if (!instance) return currency;
    return instance.getCurrency(currency);
  } catch {
    return currency;
  }
}
