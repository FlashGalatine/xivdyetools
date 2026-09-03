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
 * REFACTOR-001: the locale layer itself — `isValidLocale`,
 * `discordLocaleToLocaleCode`, the legacy-key reader and `resolveUserLocale` —
 * used to be implemented here AND, separately, in
 * `apps/moderation-worker/src/services/i18n.ts`. The two copies drifted:
 * BUG-001 was moderation-worker's never learning about the unified `prefs:v1:`
 * blob this one reads, even though both workers bind the SAME production KV
 * namespace. There is one implementation now, in
 * `@xivdyetools/bot-logic/i18n`; this module re-exports it so existing imports
 * keep working.
 *
 * @module services/i18n
 */

// Re-export pure localization functions from @xivdyetools/bot-logic so
// existing imports from this file continue to work without changes.
export {
  initializeLocale,
  getLocalizedDyeName,
  getLocalizedCategory,
} from '@xivdyetools/bot-logic';

export type { LocaleCode } from '@xivdyetools/bot-logic/i18n';
export {
  isValidLocale,
  discordLocaleToLocaleCode,
  resolveUserLocale,
} from '@xivdyetools/bot-logic/i18n';
