/**
 * I18n Service (Simplified for Moderation Bot)
 *
 * This service handles:
 * - User language preferences stored in Cloudflare KV
 * - Locale resolution (user preference -> Discord locale -> default)
 *
 * Note: This is a simplified version that doesn't include @xivdyetools/core
 * integration since the moderation bot doesn't need dye name localization.
 *
 * @module services/i18n
 */

import type { ExtendedLogger } from '@xivdyetools/logger';

/**
 * Supported locale codes
 */
export type LocaleCode = 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';

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
  { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
  { code: 'ja', name: 'Japanese', nativeName: '\u65E5\u672C\u8A9E', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
  { code: 'fr', name: 'French', nativeName: 'Fran\u00E7ais', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { code: 'ko', name: 'Korean', nativeName: '\uD55C\uAD6D\uC5B4', flag: '\uD83C\uDDF0\uD83C\uDDF7' },
  { code: 'zh', name: 'Chinese', nativeName: '\u4E2D\u6587', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
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
 * Resolve the effective locale for a user
 */
export async function resolveUserLocale(
  kv: KVNamespace,
  userId: string,
  discordLocale?: string
): Promise<LocaleCode> {
  // 1. Check user preference
  const preference = await getUserLanguagePreference(kv, userId);
  if (preference) {
    return preference;
  }

  // 2. Try Discord locale
  if (discordLocale) {
    const mapped = discordLocaleToLocaleCode(discordLocale);
    if (mapped) {
      return mapped;
    }
  }

  // 3. Default to English
  return 'en';
}
