/**
 * Bot UI Translation Service (DISCORD-REF-003: Clarified separation from i18n.ts)
 *
 * This service handles:
 * - Bot-specific UI strings (commands, errors, messages, button labels)
 * - Static JSON locale files imported at build time (required for Workers)
 * - The Translator class for string interpolation and fallback handling
 *
 * Separation from i18n.ts:
 * - bot-i18n.ts (this file): Bot UI strings from static JSON locale files
 * - i18n.ts: User preferences (KV), locale resolution, core library integration
 *
 * Why two files?
 * - Dye names use xivdyetools-core (same as web app) - handled by i18n.ts
 * - Bot UI strings are Discord-specific - handled here
 * - Static JSON imports can't be async, while KV operations are async
 *
 * Usage:
 * ```typescript
 * const t = await createUserTranslator(kv, userId, interaction.locale);
 * const message = t.t('errors.dyeNotFound', { name: 'Snow White' });
 * ```
 *
 * @module services/bot-i18n
 */

import type { LocaleCode } from './i18n.js';
import { resolveUserLocale } from './i18n.js';
import type { ExtendedLogger } from '@xivdyetools/logger';

// Import locale files statically (required for Cloudflare Workers)
import enLocale from '../locales/en.json';
import jaLocale from '../locales/ja.json';
import deLocale from '../locales/de.json';
import frLocale from '../locales/fr.json';
import koLocale from '../locales/ko.json';
import zhLocale from '../locales/zh.json';

/**
 * Locale data structure (matches JSON files)
 */
interface LocaleData {
  meta: {
    locale: string;
    name: string;
    nativeName: string;
    flag: string;
  };
  [key: string]: unknown;
}

/**
 * All loaded locales
 */
const locales: Record<LocaleCode, LocaleData> = {
  en: enLocale as LocaleData,
  ja: jaLocale as LocaleData,
  de: deLocale as LocaleData,
  fr: frLocale as LocaleData,
  ko: koLocale as LocaleData,
  zh: zhLocale as LocaleData,
};

/**
 * Get a nested value from an object using dot notation
 *
 * @example
 * getNestedValue({ a: { b: 'hello' } }, 'a.b') // returns 'hello'
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Interpolate variables into a string
 *
 * @example
 * interpolate('Hello {name}!', { name: 'World' }) // returns 'Hello World!'
 */
function interpolate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key]?.toString() ?? match;
  });
}

/**
 * Translator class for a specific locale
 */
export class Translator {
  private locale: LocaleCode;
  private data: LocaleData;
  private fallbackData: LocaleData;
  private logger?: ExtendedLogger;

  constructor(locale: LocaleCode, logger?: ExtendedLogger) {
    this.locale = locale;
    this.data = locales[locale] || locales.en;
    this.fallbackData = locales.en;
    this.logger = logger;
  }

  /**
   * Get a translated string
   *
   * @param key - Dot-notation key (e.g., 'errors.dyeNotFound')
   * @param variables - Optional interpolation variables
   * @returns Translated string, or the key if not found
   *
   * @example
   * t('errors.dyeNotFound', { name: 'Snow White' })
   * // Returns: 'Could not find a dye named "Snow White".'
   */
  t(key: string, variables?: Record<string, string | number>): string {
    // Try the current locale first
    let value = getNestedValue(this.data as Record<string, unknown>, key);

    // Fall back to English if not found
    if (value === undefined && this.locale !== 'en') {
      value = getNestedValue(this.fallbackData as Record<string, unknown>, key);
    }

    // If still not found, return the key
    if (value === undefined || typeof value !== 'string') {
      if (this.logger) {
        this.logger.warn(`Missing translation: ${key} for locale ${this.locale}`);
      }
      return key;
    }

    // Interpolate variables if provided
    if (variables) {
      return interpolate(value, variables);
    }

    return value;
  }

  /**
   * Get the current locale code
   */
  getLocale(): LocaleCode {
    return this.locale;
  }

  /**
   * Get locale metadata
   */
  getMeta(): LocaleData['meta'] {
    return this.data.meta;
  }
}

/**
 * Create a translator for a specific locale
 *
 * @param locale - Locale code
 * @param logger - Optional logger for structured logging
 */
export function createTranslator(
  locale: LocaleCode,
  logger?: ExtendedLogger
): Translator {
  return new Translator(locale, logger);
}

/**
 * Create a translator for a user, resolving their locale preference
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param discordLocale - Discord's detected locale
 * @param logger - Optional logger for structured logging
 * @returns Translator instance
 *
 * @example
 * const t = await createUserTranslator(env.KV, userId, interaction.locale);
 * const message = t.t('errors.dyeNotFound', { name: 'Snow White' });
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
 * Quick translate function for one-off translations
 *
 * @param locale - Locale code
 * @param key - Translation key
 * @param variables - Optional interpolation variables
 * @param logger - Optional logger for structured logging
 */
export function translate(
  locale: LocaleCode,
  key: string,
  variables?: Record<string, string | number>,
  logger?: ExtendedLogger
): string {
  const translator = new Translator(locale, logger);
  return translator.t(key, variables);
}

/**
 * Get all available locales with metadata
 */
export function getAvailableLocales(): Array<LocaleData['meta']> {
  return Object.values(locales).map((data) => data.meta);
}

/**
 * Check if a locale is supported
 */
export function isLocaleSupported(locale: string): locale is LocaleCode {
  return locale in locales;
}
