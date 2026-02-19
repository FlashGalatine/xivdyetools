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

// Re-export everything from the shared package
export {
  Translator,
  createTranslator,
  translate,
  getAvailableLocales,
  isLocaleSupported,
} from '@xivdyetools/bot-i18n';
export type { LocaleCode, LocaleData } from '@xivdyetools/bot-i18n';

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
