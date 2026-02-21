import type { LocaleCode, LocaleData, TranslatorLogger } from './types.js';

// Bundled locale data (static imports work in both CF Workers and Node.js)
import enLocale from './locales/en.json';
import jaLocale from './locales/ja.json';
import deLocale from './locales/de.json';
import frLocale from './locales/fr.json';
import koLocale from './locales/ko.json';
import zhLocale from './locales/zh.json';

const locales: Record<LocaleCode, LocaleData> = {
  en: enLocale as LocaleData,
  ja: jaLocale as LocaleData,
  de: deLocale as LocaleData,
  fr: frLocale as LocaleData,
  ko: koLocale as LocaleData,
  zh: zhLocale as LocaleData,
};

// ============================================================================
// Internal helpers
// ============================================================================

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function interpolate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    return variables[key]?.toString() ?? match;
  });
}

// ============================================================================
// Translator class
// ============================================================================

/**
 * Translator for a specific locale.
 * Falls back to English for missing keys.
 */
export class Translator {
  private locale: LocaleCode;
  private data: LocaleData;
  private fallbackData: LocaleData;
  private logger?: TranslatorLogger;

  constructor(locale: LocaleCode, logger?: TranslatorLogger) {
    this.locale = locale;
    this.data = locales[locale] || locales.en;
    this.fallbackData = locales.en;
    this.logger = logger;
  }

  /**
   * Get a translated string by dot-notation key.
   * Falls back to English if the key is missing in the current locale.
   * Returns the raw key if not found in any locale.
   *
   * @example
   * t.t('errors.dyeNotFound', { name: 'Snow White' })
   * // → 'Could not find a dye named "Snow White".'
   */
  t(key: string, variables?: Record<string, string | number>): string {
    let value = getNestedValue(this.data as Record<string, unknown>, key);

    if (value === undefined && this.locale !== 'en') {
      value = getNestedValue(this.fallbackData as Record<string, unknown>, key);
    }

    if (value === undefined || typeof value !== 'string') {
      this.logger?.warn(`Missing translation: ${key} for locale ${this.locale}`);
      return key;
    }

    return variables ? interpolate(value, variables) : value;
  }

  /** Get the current locale code. */
  getLocale(): LocaleCode {
    return this.locale;
  }

  /** Get locale metadata (name, nativeName, flag). */
  getMeta(): LocaleData['meta'] {
    return this.data.meta;
  }
}

// ============================================================================
// Factory functions
// ============================================================================

/**
 * Create a translator for a specific locale.
 * Locale data is bundled — no I/O required.
 */
export function createTranslator(locale: LocaleCode, logger?: TranslatorLogger): Translator {
  return new Translator(locale, logger);
}

/**
 * Quick one-off translation helper.
 */
export function translate(
  locale: LocaleCode,
  key: string,
  variables?: Record<string, string | number>,
  logger?: TranslatorLogger
): string {
  return new Translator(locale, logger).t(key, variables);
}

/**
 * Get all available locales with metadata.
 * Used by language selection commands to show available options.
 */
export function getAvailableLocales(): Array<LocaleData['meta']> {
  return Object.values(locales).map((data) => data.meta);
}

/**
 * Type guard: check if a string is a supported locale code.
 */
export function isLocaleSupported(locale: string): locale is LocaleCode {
  return locale in locales;
}
