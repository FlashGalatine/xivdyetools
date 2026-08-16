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
 * Listener function type for locale changes
 */
export type LocaleChangeListener = (locale: LocaleCode) => void;
