/**
 * XIV Dye Tools v2.1.0 - Internationalization Types
 *
 * Type definitions for multi-language support
 *
 * @module shared/i18n-types
 */

/**
 * Supported locale codes
 * Matches the locales available in xivdyetools-core v1.2.0
 */
export type LocaleCode = 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';

/**
 * Locale display information for UI
 */
export interface LocaleDisplay {
  /** ISO locale code */
  code: LocaleCode;
  /** Native language name (e.g., "日本語") */
  name: string;
  /** English name (e.g., "Japanese") */
  englishName: string;
  /** Emoji flag for visual identification */
  flag: string;
}

/**
 * Web app translation data structure
 */
export interface WebAppTranslations {
  meta: {
    locale: LocaleCode;
    version: string;
  };
  app: Record<string, string>;
  header: Record<string, string>;
  footer: Record<string, string>;
  tools: {
    harmony: Record<string, string>;
    matcher: Record<string, string>;
    accessibility: Record<string, string>;
    comparison: Record<string, string>;
    mixer: Record<string, string>;
  };
  common: Record<string, string>;
  harmony: Record<string, string>;
  matcher: Record<string, string>;
  accessibility: Record<string, string>;
  comparison: Record<string, string>;
  mixer: Record<string, string>;
  filters: Record<string, string>;
  marketBoard: Record<string, string>;
  export: Record<string, string>;
  errors: Record<string, string>;
  success: Record<string, string>;
  themes: Record<string, string>;
}

/**
 * Listener function type for locale changes
 */
export type LocaleChangeListener = (locale: LocaleCode) => void;
