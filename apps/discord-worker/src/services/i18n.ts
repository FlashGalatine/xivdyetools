/**
 * I18n Service (DISCORD-REF-003: Clarified separation from bot-i18n.ts)
 *
 * This service handles:
 * - User language PREFERENCES stored in Cloudflare KV
 * - Locale resolution (user preference → Discord locale → default)
 * - Integration with xivdyetools-core LocalizationService for DYE NAMES and CATEGORIES
 *
 * Separation from bot-i18n.ts:
 * - i18n.ts (this file): Preferences, locale resolution, core library integration
 * - bot-i18n.ts: Bot UI strings (commands, errors, messages) from static JSON files
 *
 * Why two files?
 * - Dye names come from xivdyetools-core (shared with web app)
 * - Bot UI strings are specific to the Discord bot
 * - Both need user locale preferences, so i18n.ts handles that shared concern
 *
 * @module services/i18n
 */

import { LocalizationService } from '@xivdyetools/core';
import type { ExtendedLogger } from '@xivdyetools/logger';

// Note: getPreference import is lazy to avoid circular dependency
// We use dynamic import within resolveUserLocale

export type { LocaleCode } from '@xivdyetools/bot-i18n';
import type { LocaleCode } from '@xivdyetools/bot-i18n';

/**
 * Locale display information
 */
export interface LocaleInfo {
  code: LocaleCode;
  name: string;
  nativeName: string;
  flag: string;
}

/**
 * All supported locales with display info
 */
export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
];

/** KV key prefix for user language preferences */
const KEY_PREFIX = 'i18n:user:';

/**
 * Validates if a string is a valid locale code
 */
export function isValidLocale(code: string): code is LocaleCode {
  return ['en', 'ja', 'de', 'fr', 'ko', 'zh'].includes(code);
}

/**
 * Get locale info by code
 */
export function getLocaleInfo(code: LocaleCode): LocaleInfo | undefined {
  return SUPPORTED_LOCALES.find((l) => l.code === code);
}

/**
 * Maps Discord locale codes to our supported locales
 *
 * @see https://discord.com/developers/docs/reference#locales
 */
export function discordLocaleToLocaleCode(discordLocale: string): LocaleCode | null {
  const mapping: Record<string, LocaleCode> = {
    'en-US': 'en',
    'en-GB': 'en',
    'ja': 'ja',
    'de': 'de',
    'fr': 'fr',
    'ko': 'ko',
    'zh-CN': 'zh',
    'zh-TW': 'zh',
  };
  return mapping[discordLocale] ?? null;
}

/**
 * Get a user's language preference from KV
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param logger - Optional logger for structured logging
 * @returns Locale code or null if not set
 */
export async function getUserLanguagePreference(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger
): Promise<LocaleCode | null> {
  try {
    const value = await kv.get(`${KEY_PREFIX}${userId}`);
    if (value && isValidLocale(value)) {
      return value;
    }
    return null;
  } catch (error) {
    if (logger) {
      logger.error('Failed to get user language preference', error instanceof Error ? error : undefined);
    }
    return null;
  }
}

/**
 * Set a user's language preference in KV
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param locale - Locale code to set
 * @param logger - Optional logger for structured logging
 */
export async function setUserLanguagePreference(
  kv: KVNamespace,
  userId: string,
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<boolean> {
  try {
    await kv.put(`${KEY_PREFIX}${userId}`, locale);
    return true;
  } catch (error) {
    if (logger) {
      logger.error('Failed to set user language preference', error instanceof Error ? error : undefined);
    }
    return false;
  }
}

/**
 * Clear a user's language preference from KV
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param logger - Optional logger for structured logging
 */
export async function clearUserLanguagePreference(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger
): Promise<boolean> {
  try {
    await kv.delete(`${KEY_PREFIX}${userId}`);
    return true;
  } catch (error) {
    if (logger) {
      logger.error('Failed to clear user language preference', error instanceof Error ? error : undefined);
    }
    return false;
  }
}

/**
 * Resolve the effective locale for a user
 *
 * Priority:
 * 1. User's unified preferences (prefs:v1:{userId})
 * 2. User's legacy preference (i18n:user:{userId})
 * 3. Discord client locale (interaction.locale)
 * 4. Default (English)
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param discordLocale - Discord's detected locale
 * @returns Effective locale code
 */
export async function resolveUserLocale(
  kv: KVNamespace,
  userId: string,
  discordLocale?: string
): Promise<LocaleCode> {
  // 1. Check unified preferences first (V4 system)
  // Direct KV read to avoid circular dependency with preferences.ts
  try {
    const unifiedPrefsKey = `prefs:v1:${userId}`;
    const unifiedData = await kv.get(unifiedPrefsKey);
    if (unifiedData) {
      const prefs = JSON.parse(unifiedData) as { language?: string };
      if (prefs.language && isValidLocale(prefs.language)) {
        return prefs.language;
      }
    }
  } catch {
    // Continue to fallbacks if unified prefs read fails
  }

  // 2. Check legacy i18n preference
  const preference = await getUserLanguagePreference(kv, userId);
  if (preference) {
    return preference;
  }

  // 3. Try Discord locale
  if (discordLocale) {
    const mapped = discordLocaleToLocaleCode(discordLocale);
    if (mapped) {
      return mapped;
    }
  }

  // 4. Default to English
  return 'en';
}

// ============================================================================
// Per-Locale Instance Cache (BUG-001: Avoid singleton race condition)
// ============================================================================

/**
 * Per-locale LocalizationService instance cache.
 *
 * Each locale gets its own instance with `currentLocale` permanently set.
 * This eliminates the race condition where concurrent requests could
 * overwrite the singleton's `currentLocale` during I/O yield points.
 *
 * Instances persist across requests within the same Cloudflare Worker isolate.
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

/**
 * Initialize localization for a specific locale.
 *
 * Pre-loads the locale instance into the cache for subsequent getter calls.
 * Unlike the previous implementation, this does NOT mutate singleton state,
 * so concurrent requests cannot interfere with each other.
 *
 * @param locale - Locale code to initialize
 * @param logger - Optional logger for structured logging
 */
export async function initializeLocale(
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    await getLocaleInstance(locale);
  } catch (error) {
    if (logger) {
      logger.error('Failed to initialize locale', error instanceof Error ? error : undefined);
    }
    // Ensure English fallback is loaded
    await getLocaleInstance('en');
  }
}

/**
 * Format locale for display
 */
export function formatLocaleDisplay(locale: LocaleCode): string {
  const info = getLocaleInfo(locale);
  if (!info) return locale;
  return `${info.flag} ${info.name} (${info.nativeName})`;
}

/**
 * Get localized dye name from xivdyetools-core
 *
 * Uses per-locale instances to avoid singleton race conditions.
 * When locale is provided, looks up the correct per-locale instance.
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
 * Get localized category name from xivdyetools-core
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
