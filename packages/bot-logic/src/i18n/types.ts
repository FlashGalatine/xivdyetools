/**
 * Supported locale codes.
 * Matches XIVAPI languages plus Korean and Chinese (from manual data).
 */
export type LocaleCode = 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';

/**
 * Structure of a locale JSON file.
 * @internal Exported for type completeness; not intended for external use.
 */
export interface LocaleData {
  meta: {
    locale: string;
    name: string;
    nativeName: string;
    flag: string;
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
