/**
 * LocaleLoader - Loads locale JSON files
 *
 * Per R-4: Single Responsibility - locale file loading only
 * Uses static imports for browser/bundler compatibility
 *
 * @module services/localization
 */

import type { LocaleCode, LocaleData } from '../../types/index.js';
import { AppError, ErrorCode } from '../../types/index.js';

// Static imports for all locale files (bundler-compatible)
import enLocale from '../../data/locales/en.json' with { type: 'json' };
import jaLocale from '../../data/locales/ja.json' with { type: 'json' };
import deLocale from '../../data/locales/de.json' with { type: 'json' };
import frLocale from '../../data/locales/fr.json' with { type: 'json' };
import koLocale from '../../data/locales/ko.json' with { type: 'json' };
import zhLocale from '../../data/locales/zh.json' with { type: 'json' };

// Map of locale codes to pre-loaded data
const localeMap: Record<LocaleCode, unknown> = {
  en: enLocale,
  ja: jaLocale,
  de: deLocale,
  fr: frLocale,
  ko: koLocale,
  zh: zhLocale,
};

/**
 * Loads locale data from pre-bundled JSON files
 */
export class LocaleLoader {
  /**
   * Load locale data from pre-bundled JSON
   *
   * @param locale - Locale code to load
   * @returns Locale data
   * @throws {AppError} If locale file fails to load or is invalid
   *
   * @example
   * ```typescript
   * const loader = new LocaleLoader();
   * const jaData = loader.loadLocale('ja');
   * console.log(jaData.labels.dye); // "カララント:"
   * ```
   */
  loadLocale(locale: LocaleCode): LocaleData {
    try {
      const data = localeMap[locale];

      if (!data) {
        throw new Error(`Locale "${locale}" not found in bundled locales`);
      }

      // Validate structure
      if (!this.isValidLocaleData(data)) {
        throw new Error(`Invalid locale data structure for ${locale}`);
      }

      return data as LocaleData;
    } catch (error) {
      throw new AppError(
        ErrorCode.LOCALE_LOAD_FAILED,
        `Failed to load locale "${locale}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }

  /**
   * Validate locale data structure
   *
   * @param data - Unknown data to validate
   * @returns true if data matches LocaleData interface
   * @private
   */
  private isValidLocaleData(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const localeData = data as Record<string, unknown>;

    return (
      typeof localeData.locale === 'string' &&
      typeof localeData.meta === 'object' &&
      typeof localeData.labels === 'object' &&
      typeof localeData.dyeNames === 'object' &&
      typeof localeData.categories === 'object' &&
      typeof localeData.acquisitions === 'object' &&
      Array.isArray(localeData.metallicDyeIds) &&
      typeof localeData.harmonyTypes === 'object' &&
      typeof localeData.visionTypes === 'object'
    );
  }
}
