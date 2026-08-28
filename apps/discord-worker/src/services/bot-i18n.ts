/**
 * Bot UI Translation Service — Discord Worker thin wrapper
 *
 * Re-exports the platform-agnostic bot i18n engine (@xivdyetools/bot-logic/i18n,
 * formerly @xivdyetools/bot-i18n) and adds the Discord-specific
 * createUserTranslator (which resolves locale from KV).
 *
 * @module services/bot-i18n
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { resolveUserLocale, initializeLocale } from './i18n.js';
import { isValidLocale } from './i18n.js';
import { getUserPreferences } from './preferences.js';
import type { UserPreferences } from '../types/preferences.js';

// Re-export from the shared package
export { Translator, createTranslator } from '@xivdyetools/bot-logic/i18n';

import { Translator } from '@xivdyetools/bot-logic/i18n';

/**
 * Create a translator for a user, resolving their locale from KV preferences.
 *
 * @param kv            - KV namespace binding (Discord Worker specific)
 * @param userId        - Discord user ID
 * @param discordLocale - Discord's detected locale
 * @param logger        - Optional structured logger
 */
export async function createUserTranslator(
  kv: KVNamespace,
  userId: string,
  discordLocale?: string,
  logger?: ExtendedLogger,
): Promise<Translator> {
  const locale = await resolveUserLocale(kv, userId, discordLocale);
  // F-02 (2026-08-20 i18n audit): warm the per-locale dye-name cache here so
  // `resolveColorInput(..., { locale })` / `searchDyesByName` can match
  // localized names on the very first request of an isolate. Cached after
  // the first call per locale; the bot-logic command executors also call it.
  await initializeLocale(locale);
  return new Translator(locale, logger);
}

/**
 * OPT-026 (2026-07-18 audit): create the translator AND return the user's
 * preferences from a single KV read. The classic pairing of
 * createUserTranslator + a later getUserPreferences parsed the same
 * `prefs:v1:{userId}` blob twice with two serial KV round-trips inside the
 * pre-defer window. Fallback order preserved: unified prefs language →
 * legacy i18n preference → Discord locale → 'en' (resolveUserLocale still
 * performs the legacy/Discord fallbacks when the unified blob has no
 * language).
 */
export async function createUserTranslatorWithPrefs(
  kv: KVNamespace,
  userId: string,
  discordLocale?: string,
  logger?: ExtendedLogger,
): Promise<{ t: Translator; prefs: UserPreferences }> {
  const prefs = await getUserPreferences(kv, userId, logger);
  if (prefs.language && isValidLocale(prefs.language)) {
    await initializeLocale(prefs.language);
    return { t: new Translator(prefs.language, logger), prefs };
  }
  const locale = await resolveUserLocale(kv, userId, discordLocale);
  await initializeLocale(locale);
  return { t: new Translator(locale, logger), prefs };
}
