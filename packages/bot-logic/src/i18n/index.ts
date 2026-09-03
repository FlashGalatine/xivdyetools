export type {
  LocaleCode,
  /** @public */ LocaleData,
  /** @public */ TranslatorLogger,
} from './types.js';
export { LOCALE_CODES } from './types.js';
export { Translator, createTranslator } from './translator.js';

/**
 * REFACTOR-001: locale resolution, shared by both Discord bots. Each used to
 * carry a private copy, and the copies drifted -- BUG-001 was exactly that.
 */
export type {
  LocaleInfo,
  LocalePreferenceStore,
  /** @public */ LocaleResolutionLogger,
} from './locale-resolution.js';
export {
  SUPPORTED_LOCALES,
  isValidLocale,
  discordLocaleToLocaleCode,
  getLegacyLanguagePreference,
  resolveUserLocale,
} from './locale-resolution.js';
