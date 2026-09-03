/**
 * Every supported locale code, as a runtime value.
 * Matches XIVAPI languages plus Korean and Chinese (from manual data).
 *
 * REFACTOR-001: `LocaleCode` is DERIVED from this list and `isValidLocale`
 * checks against it, so a seventh locale cannot be added to the type while a
 * hand-written runtime guard silently goes on rejecting it -- which is what
 * moderation-worker's private copy (its own union AND its own array) allowed.
 */
export const LOCALE_CODES = ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const;

/** Supported locale codes. */
export type LocaleCode = (typeof LOCALE_CODES)[number];

/**
 * Structure of a locale JSON file.
 * @internal Exported for type completeness; not intended for external use.
 */
export interface LocaleData {
  meta: {
    locale: string;
    name: string;
  };
  [key: string]: unknown;
}

/**
 * Minimal logger interface accepted by Translator.
 * Compatible with @xivdyetools/logger's ExtendedLogger.
 * @internal Exported for type completeness; not intended for external use.
 */
export interface TranslatorLogger {
  warn: (msg: string) => void;
}
