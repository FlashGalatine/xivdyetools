/**
 * TranslationProvider - Provides translations with fallback logic
 *
 * Per R-4: Single Responsibility - translation retrieval only
 * Fallback chain: requested locale → English → formatted key
 *
 * @module services/localization
 */

import type {
  LocaleCode,
  TranslationKey,
  HarmonyTypeKey,
  VisionType,
  JobKey,
  GrandCompanyKey,
  RaceKey,
  ClanKey,
} from '../../types/index.js';
import type { LocaleRegistry } from './LocaleRegistry.js';

/**
 * Provides translations with automatic fallback to English
 */
export class TranslationProvider {
  constructor(private registry: LocaleRegistry) {}

  /**
   * Get UI label with fallback chain
   *
   * @param key - Translation key
   * @param locale - Requested locale
   * @returns Translated label or formatted key
   *
   * @example
   * ```typescript
   * const label = provider.getLabel('dye', 'ja');
   * // Returns "カララント:" (ja) or "Dye" (en fallback)
   * ```
   */
  getLabel(key: TranslationKey, locale: LocaleCode): string {
    const localeData = this.registry.getLocale(locale);

    // Try requested locale
    if (localeData?.labels[key]) {
      return localeData.labels[key];
    }

    // Fallback to English
    if (locale !== 'en') {
      const englishData = this.registry.getLocale('en');
      if (englishData?.labels[key]) {
        return englishData.labels[key];
      }
    }

    // Final fallback: format key (camelCase → Title Case)
    return this.formatKey(key);
  }

  /**
   * Get dye name with fallback
   *
   * @param itemID - Dye item ID
   * @param locale - Requested locale
   * @returns Localized dye name or null if not found
   *
   * @example
   * ```typescript
   * const name = provider.getDyeName(5729, 'ja');
   * // Returns "スノウホワイト" (ja) or "Snow White" (en fallback)
   * ```
   */
  getDyeName(itemID: number, locale: LocaleCode): string | null {
    const localeData = this.registry.getLocale(locale);
    const idStr = String(itemID);

    // Try requested locale
    if (localeData?.dyeNames[idStr]) {
      return localeData.dyeNames[idStr];
    }

    // Fallback to English
    if (locale !== 'en') {
      const englishData = this.registry.getLocale('en');
      if (englishData?.dyeNames[idStr]) {
        return englishData.dyeNames[idStr];
      }
    }

    return null;
  }

  /**
   * Get category name with fallback
   *
   * @param category - Category key (e.g., "Reds", "Blues")
   * @param locale - Requested locale
   * @returns Localized category name
   *
   * @example
   * ```typescript
   * const category = provider.getCategory('Reds', 'ja');
   * // Returns "赤系" (ja) or "Reds" (en fallback)
   * ```
   */
  getCategory(category: string, locale: LocaleCode): string {
    const localeData = this.registry.getLocale(locale);

    // Try requested locale
    if (localeData?.categories[category]) {
      return localeData.categories[category];
    }

    // Fallback to English
    if (locale !== 'en') {
      const englishData = this.registry.getLocale('en');
      if (englishData?.categories[category]) {
        return englishData.categories[category];
      }
    }

    // Final fallback: return original category
    return category;
  }

  /**
   * Get acquisition method with fallback
   *
   * @param acquisition - Acquisition key (e.g., "Dye Vendor", "Crafting")
   * @param locale - Requested locale
   * @returns Localized acquisition method
   *
   * @example
   * ```typescript
   * const acq = provider.getAcquisition('Dye Vendor', 'ja');
   * // Returns "染料販売業者" (ja) or "Dye Vendor" (en fallback)
   * ```
   */
  getAcquisition(acquisition: string, locale: LocaleCode): string {
    const localeData = this.registry.getLocale(locale);

    // Try requested locale
    if (localeData?.acquisitions[acquisition]) {
      return localeData.acquisitions[acquisition];
    }

    // Fallback to English
    if (locale !== 'en') {
      const englishData = this.registry.getLocale('en');
      if (englishData?.acquisitions[acquisition]) {
        return englishData.acquisitions[acquisition];
      }
    }

    // Final fallback: return original acquisition
    return acquisition;
  }

  /**
   * Get metallic dye IDs (locale-independent)
   *
   * @param locale - Current locale (for consistency)
   * @returns Array of metallic dye item IDs
   *
   * @example
   * ```typescript
   * const metallicIds = provider.getMetallicDyeIds('fr');
   * // Returns [13116, 13117, ...] for any locale
   * ```
   */
  getMetallicDyeIds(locale: LocaleCode): number[] {
    const localeData = this.registry.getLocale(locale);

    if (localeData?.metallicDyeIds) {
      return localeData.metallicDyeIds;
    }

    // Fallback to English
    const englishData = this.registry.getLocale('en');
    return englishData?.metallicDyeIds || [];
  }

  /**
   * Get harmony type with fallback
   *
   * @param key - Harmony type key
   * @param locale - Requested locale
   * @returns Localized harmony type name
   *
   * @example
   * ```typescript
   * const harmony = provider.getHarmonyType('triadic', 'ja');
   * // Returns "三色配色" (ja) or "Triadic" (en fallback)
   * ```
   */
  getHarmonyType(key: HarmonyTypeKey, locale: LocaleCode): string {
    const localeData = this.registry.getLocale(locale);

    // Try requested locale
    if (localeData?.harmonyTypes[key]) {
      return localeData.harmonyTypes[key];
    }

    // Fallback to English
    if (locale !== 'en') {
      const englishData = this.registry.getLocale('en');
      if (englishData?.harmonyTypes[key]) {
        return englishData.harmonyTypes[key];
      }
    }

    // Final fallback: format key
    return this.formatKey(key);
  }

  /**
   * Get vision type with fallback
   *
   * @param key - Vision type key
   * @param locale - Requested locale
   * @returns Localized vision type name
   *
   * @example
   * ```typescript
   * const vision = provider.getVisionType('deuteranopia', 'ja');
   * // Returns "2型色覚（赤緑色盲）" (ja) or English fallback
   * ```
   */
  getVisionType(key: VisionType, locale: LocaleCode): string {
    const localeData = this.registry.getLocale(locale);

    // Try requested locale
    if (localeData?.visionTypes[key]) {
      return localeData.visionTypes[key];
    }

    // Fallback to English
    if (locale !== 'en') {
      const englishData = this.registry.getLocale('en');
      if (englishData?.visionTypes[key]) {
        return englishData.visionTypes[key];
      }
    }

    // Final fallback: format key
    return this.formatKey(key);
  }

  /**
   * Get job name with fallback
   *
   * @param key - Job key
   * @param locale - Requested locale
   * @returns Localized job name
   *
   * @example
   * ```typescript
   * const job = provider.getJobName('darkKnight', 'ja');
   * // Returns "暗黒騎士" (ja) or "Dark Knight" (en fallback)
   * ```
   */
  getJobName(key: JobKey, locale: LocaleCode): string {
    const localeData = this.registry.getLocale(locale);

    // Try requested locale
    if (localeData?.jobNames[key]) {
      return localeData.jobNames[key];
    }

    // Fallback to English
    if (locale !== 'en') {
      const englishData = this.registry.getLocale('en');
      if (englishData?.jobNames[key]) {
        return englishData.jobNames[key];
      }
    }

    // Final fallback: format key
    return this.formatKey(key);
  }

  /**
   * Get Grand Company name with fallback
   *
   * @param key - Grand Company key
   * @param locale - Requested locale
   * @returns Localized Grand Company name
   *
   * @example
   * ```typescript
   * const gc = provider.getGrandCompanyName('maelstrom', 'ja');
   * // Returns "黒渦団" (ja) or "The Maelstrom" (en fallback)
   * ```
   */
  getGrandCompanyName(key: GrandCompanyKey, locale: LocaleCode): string {
    const localeData = this.registry.getLocale(locale);

    // Try requested locale
    if (localeData?.grandCompanyNames[key]) {
      return localeData.grandCompanyNames[key];
    }

    // Fallback to English
    if (locale !== 'en') {
      const englishData = this.registry.getLocale('en');
      if (englishData?.grandCompanyNames[key]) {
        return englishData.grandCompanyNames[key];
      }
    }

    // Final fallback: format key
    return this.formatKey(key);
  }

  /**
   * Get race name with fallback
   *
   * @param key - Race key
   * @param locale - Requested locale
   * @returns Localized race name
   *
   * @example
   * ```typescript
   * const race = provider.getRace('miqote', 'ja');
   * // Returns "ミコッテ" (ja) or "Miqo'te" (en fallback)
   * ```
   */
  getRace(key: RaceKey, locale: LocaleCode): string {
    const localeData = this.registry.getLocale(locale);

    // Try requested locale
    if (localeData?.races?.[key]) {
      return localeData.races[key];
    }

    // Fallback to English
    if (locale !== 'en') {
      const englishData = this.registry.getLocale('en');
      if (englishData?.races?.[key]) {
        return englishData.races[key];
      }
    }

    // Final fallback: format key
    return this.formatKey(key);
  }

  /**
   * Get clan (subrace) name with fallback
   *
   * @param key - Clan key
   * @param locale - Requested locale
   * @returns Localized clan name
   *
   * @example
   * ```typescript
   * const clan = provider.getClan('seekerOfTheSun', 'ja');
   * // Returns "サンシーカー" (ja) or "Seeker of the Sun" (en fallback)
   * ```
   */
  getClan(key: ClanKey, locale: LocaleCode): string {
    const localeData = this.registry.getLocale(locale);

    // Try requested locale
    if (localeData?.clans?.[key]) {
      return localeData.clans[key];
    }

    // Fallback to English
    if (locale !== 'en') {
      const englishData = this.registry.getLocale('en');
      if (englishData?.clans?.[key]) {
        return englishData.clans[key];
      }
    }

    // Final fallback: format key
    return this.formatKey(key);
  }

  /**
   * Format camelCase/PascalCase key to Title Case
   *
   * @param key - Key to format
   * @returns Formatted string
   * @private
   *
   * @example
   * ```typescript
   * formatKey('splitComplementary') // "Split Complementary"
   * formatKey('cosmicExploration') // "Cosmic Exploration"
   * ```
   */
  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
}
