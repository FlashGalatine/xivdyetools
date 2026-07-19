/**
 * Bot UI Translation Service — Discord Worker thin wrapper
 *
 * Re-exports the platform-agnostic @xivdyetools/bot-i18n package and adds
 * the Discord-specific createUserTranslator (which resolves locale from KV).
 *
 * @module services/bot-i18n
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { resolveUserLocale } from './i18n.js';
import { isValidLocale } from './i18n.js';
import { getUserPreferences } from './preferences.js';
import type { UserPreferences } from '../types/preferences.js';

// Re-export from the shared package
export {
  Translator,
  createTranslator,
} from '@xivdyetools/bot-i18n';
export type { LocaleCode } from '@xivdyetools/bot-i18n';

import { Translator } from '@xivdyetools/bot-i18n';

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
  logger?: ExtendedLogger
): Promise<Translator> {
  const locale = await resolveUserLocale(kv, userId, discordLocale);
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
  logger?: ExtendedLogger
): Promise<{ t: Translator; prefs: UserPreferences }> {
  const prefs = await getUserPreferences(kv, userId, logger);
  if (prefs.language && isValidLocale(prefs.language)) {
    return { t: new Translator(prefs.language, logger), prefs };
  }
  const locale = await resolveUserLocale(kv, userId, discordLocale);
  return { t: new Translator(locale, logger), prefs };
}
