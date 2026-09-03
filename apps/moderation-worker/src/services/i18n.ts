/**
 * I18n Service (Moderation Bot)
 *
 * REFACTOR-001: this module used to carry a full private copy of the locale
 * layer — its own `LocaleCode` union, its own `SUPPORTED_LOCALES`, its own
 * `isValidLocale` array, its own Discord-locale map and its own KV resolution.
 * The copies drifted, and BUG-001 was the result: only discord-worker's copy
 * learned about the unified `prefs:v1:` preferences blob, so a user who set
 * their language through `/preferences` got every moderation-bot string back in
 * their Discord client locale, with no way to correct it — this worker ships no
 * language command of its own. Both workers bind the SAME production KV
 * namespace, so there was never a reason for two readers of it.
 *
 * The layer now lives in `@xivdyetools/bot-logic/i18n`, which both bots already
 * depend on. This file stays as a re-export so existing imports keep working
 * and the module's own tests keep their subject.
 *
 * @module services/i18n
 */

export type { LocaleCode } from '@xivdyetools/bot-logic/i18n';
export {
  SUPPORTED_LOCALES,
  isValidLocale,
  discordLocaleToLocaleCode,
  resolveUserLocale,
  /**
   * Legacy `i18n:user:` reader. Nothing writes that key any more, but
   * `discord-worker/src/services/preferences.ts` deliberately does not delete
   * it, so entries predating the unified system still resolve.
   */
  getLegacyLanguagePreference as getUserLanguagePreference,
} from '@xivdyetools/bot-logic/i18n';
