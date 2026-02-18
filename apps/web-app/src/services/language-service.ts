/**
 * XIV Dye Tools v2.1.0 - Language Service
 *
 * Multi-language support management
 * Wraps core LocalizationService + manages web app translations
 *
 * @module services/language-service
 */

import { LocalizationService } from '@xivdyetools/core';
import type { LocaleCode, LocaleDisplay, LocaleChangeListener } from '@shared/i18n-types';
import { StorageService } from './storage-service';
import {
  STORAGE_KEYS,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_DISPLAY_INFO,
} from '@shared/constants';
import { logger } from '@shared/logger';

// ============================================================================
// Web App Translation Cache
// ============================================================================

/**
 * Cache for web app translations (loaded from JSON files)
 */
const webAppTranslations: Map<LocaleCode, Record<string, unknown>> = new Map();

// ============================================================================
// Language Service Class
// ============================================================================

/**
 * Service for managing multi-language support
 * Follows the ThemeService pattern with subscription model
 */
export class LanguageService {
  private static currentLocale: LocaleCode = DEFAULT_LOCALE;
  private static listeners: Set<LocaleChangeListener> = new Set();
  private static isInitialized: boolean = false;

  /**
   * Initialize language service
   * Loads saved locale preference or detects browser language
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Try to load saved locale preference
      const saved = StorageService.getItem<LocaleCode>(STORAGE_KEYS.LOCALE);

      let locale: LocaleCode;
      if (saved && this.isValidLocale(saved)) {
        locale = saved;
        logger.info(`Loaded saved locale preference: ${locale}`);
      } else {
        // Detect browser language
        locale = this.detectBrowserLocale();
        logger.info(`Detected browser locale: ${locale}`);
      }

      await this.setLocale(locale);
      this.isInitialized = true;
      logger.info(`Language service initialized: ${this.currentLocale}`);
    } catch (error) {
      logger.error('Failed to initialize language service:', error);
      // Fallback to default locale
      this.currentLocale = DEFAULT_LOCALE;
      this.isInitialized = true;
    }
  }

  /**
   * Get the current locale
   */
  static getCurrentLocale(): LocaleCode {
    return this.currentLocale;
  }

  /**
   * Get current locale display info
   */
  static getCurrentLocaleDisplay(): LocaleDisplay {
    return LOCALE_DISPLAY_INFO.find((l) => l.code === this.currentLocale) || LOCALE_DISPLAY_INFO[0];
  }

  /**
   * Set the current locale
   * Updates both core library and web app translations
   */
  static async setLocale(locale: LocaleCode): Promise<void> {
    if (!this.isValidLocale(locale)) {
      logger.warn(`Invalid locale: ${locale}, falling back to ${DEFAULT_LOCALE}`);
      locale = DEFAULT_LOCALE;
    }

    try {
      // Set locale in core library (handles dye names, categories, etc.)
      await LocalizationService.setLocale(locale);

      // Load web app translations if not cached
      if (!webAppTranslations.has(locale)) {
        await this.loadWebAppTranslations(locale);
      }

      this.currentLocale = locale;

      // Save preference
      StorageService.setItem(STORAGE_KEYS.LOCALE, locale);

      // Notify all listeners
      this.listeners.forEach((listener) => {
        try {
          listener(locale);
        } catch (error) {
          logger.error('Error in locale change listener:', error);
        }
      });

      logger.info(`Locale changed to: ${locale}`);
    } catch (error) {
      logger.error(`Failed to set locale ${locale}:`, error);
      throw error;
    }
  }

  /**
   * Cycle to the next locale in the supported locales list
   * Wraps around to the first locale after the last
   */
  static async cycleToNextLocale(): Promise<void> {
    const currentIndex = SUPPORTED_LOCALES.indexOf(this.currentLocale);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LOCALES.length;
    await this.setLocale(SUPPORTED_LOCALES[nextIndex]);
  }

  /**
   * Subscribe to locale changes
   * Returns an unsubscribe function
   */
  static subscribe(listener: LocaleChangeListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get translation for a web app key
   * Uses dot notation: "tools.harmony.title"
   * Falls back to English if key not found in current locale
   */
  static t(key: string): string {
    const translations = webAppTranslations.get(this.currentLocale);
    const englishTranslations = webAppTranslations.get('en');

    // Try current locale first
    let value = this.getNestedValue(translations, key);

    // Fall back to English
    if (value === undefined && this.currentLocale !== 'en') {
      value = this.getNestedValue(englishTranslations, key);
    }

    // Return key if translation not found
    if (value === undefined) {
      logger.warn(`Translation not found: ${key}`);
      return key;
    }

    return String(value);
  }

  /**
   * Get translation with interpolation
   * Replaces {placeholder} with values from the params object
   */
  static tInterpolate(key: string, params: Record<string, string | number>): string {
    let translation = this.t(key);

    for (const [param, value] of Object.entries(params)) {
      translation = translation.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
    }

    return translation;
  }

  // ============================================================================
  // Core Library Proxy Methods
  // ============================================================================

  /**
   * Get localized dye name from core library
   */
  static getDyeName(itemID: number): string | null {
    return LocalizationService.getDyeName(itemID);
  }

  /**
   * Get localized category from core library
   */
  static getCategory(category: string): string {
    return LocalizationService.getCategory(category);
  }

  /**
   * Get localized acquisition method from core library
   */
  static getAcquisition(acquisition: string): string {
    return LocalizationService.getAcquisition(acquisition);
  }

  /**
   * Get localized harmony type from core library
   */
  static getHarmonyType(key: string): string {
    return LocalizationService.getHarmonyType(
      key as Parameters<typeof LocalizationService.getHarmonyType>[0]
    );
  }

  /**
   * Get localized vision type from core library
   */
  static getVisionType(key: string): string {
    return LocalizationService.getVisionType(
      key as Parameters<typeof LocalizationService.getVisionType>[0]
    );
  }

  /**
   * Get localized label from core library
   */
  static getLabel(key: string): string {
    return LocalizationService.getLabel(key as Parameters<typeof LocalizationService.getLabel>[0]);
  }

  /**
   * Get localized race name from core library
   */
  static getRace(key: string): string {
    return LocalizationService.getRace(key as Parameters<typeof LocalizationService.getRace>[0]);
  }

  /**
   * Get localized clan (subrace) name from core library
   */
  static getClan(key: string): string {
    return LocalizationService.getClan(key as Parameters<typeof LocalizationService.getClan>[0]);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get all available locales with display info
   */
  static getAvailableLocales(): readonly LocaleDisplay[] {
    return LOCALE_DISPLAY_INFO;
  }

  /**
   * Check if locale is valid
   */
  static isValidLocale(locale: unknown): locale is LocaleCode {
    return typeof locale === 'string' && SUPPORTED_LOCALES.includes(locale as LocaleCode);
  }

  /**
   * Detect browser locale
   */
  private static detectBrowserLocale(): LocaleCode {
    try {
      // Get browser language (e.g., "en-US", "ja", "de-DE")
      const browserLang =
        navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'en';

      // Extract language code (first 2 characters)
      const langCode = browserLang.split('-')[0].toLowerCase();

      // Check if it's a supported locale
      if (this.isValidLocale(langCode)) {
        return langCode;
      }

      logger.info(`Browser language ${browserLang} not supported, using default`);
      return DEFAULT_LOCALE;
    } catch (error) {
      logger.warn('Failed to detect browser locale:', error);
      return DEFAULT_LOCALE;
    }
  }

  /**
   * Load web app translations from JSON file
   */
  private static async loadWebAppTranslations(locale: LocaleCode): Promise<void> {
    try {
      // Dynamic import of locale JSON
      const module = await import(`../locales/${locale}.json`);
      webAppTranslations.set(locale, module.default || module);
      logger.info(`Loaded web app translations for: ${locale}`);
    } catch (error) {
      logger.warn(`Failed to load translations for ${locale}:`, error);

      // If not English, try to load English as fallback
      if (locale !== 'en' && !webAppTranslations.has('en')) {
        try {
          const enModule = await import('../locales/en.json');
          webAppTranslations.set('en', enModule.default || enModule);
          logger.info('Loaded English translations as fallback');
        } catch (enError) {
          logger.error('Failed to load English fallback translations:', enError);
        }
      }
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: Record<string, unknown> | undefined, path: string): unknown {
    if (!obj) return undefined;

    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  /**
   * Preload translations for multiple locales
   * Useful for reducing latency when switching languages
   */
  static async preloadLocales(locales: LocaleCode[]): Promise<void> {
    const loadPromises = locales
      .filter((locale) => !webAppTranslations.has(locale))
      .map((locale) => this.loadWebAppTranslations(locale));

    await Promise.all(loadPromises);
  }

  /**
   * Clear cached translations
   * Useful for development/testing
   */
  static clearCache(): void {
    webAppTranslations.clear();
  }

  /**
   * Check if service is initialized
   */
  static isReady(): boolean {
    return this.isInitialized;
  }
}
