import type { LocaleCode, LocaleData, TranslatorLogger } from './types.js';

// Bundled locale data (static imports work in both CF Workers and Node.js)
import enLocale from './locales/en.json';
import jaLocale from './locales/ja.json';
import deLocale from './locales/de.json';
import frLocale from './locales/fr.json';
import koLocale from './locales/ko.json';
import zhLocale from './locales/zh.json';

const locales: Record<LocaleCode, LocaleData> = {
  en: enLocale,
  ja: jaLocale,
  de: deLocale,
  fr: frLocale,
  ko: koLocale,
  zh: zhLocale,
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
    let value = getNestedValue(this.data, key);

    if (value === undefined && this.locale !== 'en') {
      value = getNestedValue(this.fallbackData, key);
    }

    if (value === undefined || typeof value !== 'string') {
      this.logger?.warn(`Missing translation: ${key} for locale ${this.locale}`);
      return key;
    }

    return variables ? interpolate(value, variables) : value;
  }

  /**
   * Count-aware translate (2026-08-20 i18n audit, F-09). Resolves
   * `${key}_one` when `count === 1`, else `${key}_other`, falling back to
   * the bare `key`; `count` is always available as `{count}` in the
   * template alongside `variables`. Every locale file carries both forms
   * (ja/ko/zh with identical strings) so the six files keep key parity.
   *
   * Two CLDR categories (one/other) cover the shipped locales; a locale with
   * few/many forms would extend this, not the call sites.
   *
   * @example
   * t.tc('gradient.steps', 1)  // → '1 Step'
   * t.tc('gradient.steps', 4)  // → '4 Steps'
   */
  tc(key: string, count: number, variables?: Record<string, string | number>): string {
    const vars = { count, ...(variables ?? {}) };
    const suffixed = `${key}_${count === 1 ? 'one' : 'other'}`;
    if (this.has(suffixed)) return this.t(suffixed, vars);
    return this.t(key, vars);
  }

  /** Whether `key` resolves to a string in this locale or the English fallback. */
  private has(key: string): boolean {
    const v = getNestedValue(this.data, key) ?? getNestedValue(this.fallbackData, key);
    return typeof v === 'string';
  }

  /** Get the current locale code. */
  getLocale(): LocaleCode {
    return this.locale;
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
