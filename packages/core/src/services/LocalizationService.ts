/**
 * LocalizationService - Facade for localization functionality
 *
 * Per R-4: Facade pattern - delegates to focused service classes
 * Provides multi-language support with lazy loading and fallback chains
 *
 * @module services
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
  LocalePreference,
} from '../types/index.js';
import { LocaleLoader } from './localization/LocaleLoader.js';
import { LocaleRegistry } from './localization/LocaleRegistry.js';
import { TranslationProvider } from './localization/TranslationProvider.js';

// ============================================================================
// Pure Utility Functions (Extracted for testability)
// ============================================================================

/**
 * List of supported locale codes
 */
export const SUPPORTED_LOCALES: readonly LocaleCode[] = [
  'en',
  'ja',
  'de',
  'fr',
  'ko',
  'zh',
] as const;

/**
 * Extract 2-letter locale code from longer locale strings
 * Pure function - no side effects, easy to test
 *
 * @param locale - Locale string (e.g., 'en-US', 'ja', 'de-DE')
 * @returns 2-letter locale code or null
 *
 * @example
 * ```typescript
 * extractLocaleCode('en-US') // 'en'
 * extractLocaleCode('ja') // 'ja'
 * extractLocaleCode('zh-CN') // null (not supported)
 * ```
 */
export function extractLocaleCode(locale: string): LocaleCode | null {
  const code = locale.split('-')[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(code as LocaleCode) ? (code as LocaleCode) : null;
}

/**
 * Resolve locale from preference chain
 * Pure function - determines locale based on priority without side effects
 *
 * Priority: explicit > guild > system > fallback
 *
 * @param preference - Locale preference with fallback chain
 * @returns Resolved locale code
 *
 * @example
 * ```typescript
 * resolveLocaleFromPreference({
 *     explicit: 'de',
 *     guild: 'ja',
 *     system: 'en-US',
 *     fallback: 'en'
 * }); // Returns 'de' (highest priority)
 *
 * resolveLocaleFromPreference({
 *     explicit: null,
 *     guild: 'ja-JP',
 *     system: 'en',
 *     fallback: 'en'
 * }); // Returns 'ja' (extracted from guild)
 * ```
 */
export function resolveLocaleFromPreference(preference: LocalePreference): LocaleCode {
  // 1. Try explicit user selection (highest priority)
  if (preference.explicit && SUPPORTED_LOCALES.includes(preference.explicit)) {
    return preference.explicit;
  }

  // 2. Try guild/server preference
  if (preference.guild) {
    const guildLocale = extractLocaleCode(preference.guild);
    if (guildLocale && SUPPORTED_LOCALES.includes(guildLocale)) {
      return guildLocale;
    }
  }

  // 3. Try user's system language
  if (preference.system) {
    const systemLocale = extractLocaleCode(preference.system);
    if (systemLocale && SUPPORTED_LOCALES.includes(systemLocale)) {
      return systemLocale;
    }
  }

  // 4. Fallback
  return preference.fallback;
}

// ============================================================================
// LocalizationService Configuration
// ============================================================================

/**
 * Configuration for LocalizationService dependencies
 */
export interface LocalizationServiceConfig {
  loader?: LocaleLoader;
  registry?: LocaleRegistry;
  translator?: TranslationProvider;
}

/**
 * LocalizationService - Main entry point for localization features
 *
 * Refactored for testability: Supports dependency injection of loader, registry, and translator
 *
 * @example Basic usage (static API)
 * ```typescript
 * import { LocalizationService } from 'xivdyetools-core';
 *
 * // Set locale (lazy loads locale data)
 * await LocalizationService.setLocale('ja');
 *
 * // Get localized label
 * const label = LocalizationService.getLabel('dye'); // "カララント:"
 *
 * // Get localized dye name
 * const dyeName = LocalizationService.getDyeName(5729); // "スノウホワイト"
 * ```
 *
 * @example Instance-based usage for testing
 * ```typescript
 * const mockLoader = new MockLocaleLoader();
 * const service = new LocalizationService({ loader: mockLoader });
 * await service.setLocale('ja');
 * ```
 *
 * @example Discord bot locale resolution
 * ```typescript
 * const preference: LocalePreference = {
 *     explicit: interaction.options.getString('language'),
 *     guild: interaction.guildLocale,
 *     system: interaction.locale,
 *     fallback: 'en'
 * };
 * await LocalizationService.setLocaleFromPreference(preference);
 * ```
 */
export class LocalizationService {
  // Instance dependencies (injectable for testing)
  private readonly loader: LocaleLoader;
  private readonly registry: LocaleRegistry;
  private readonly translator: TranslationProvider;

  private currentLocale: LocaleCode = 'en';
  private isInitialized: boolean = false;

  // Default singleton instance for static API compatibility
  // Per Issue #6: Eager initialization to avoid race conditions in concurrent scenarios
  private static defaultInstance: LocalizationService = new LocalizationService();

  /**
   * Constructor with optional dependency injection
   * @param config Configuration with optional loader, registry, and translator
   */
  constructor(config: LocalizationServiceConfig = {}) {
    this.loader = config.loader || new LocaleLoader();
    this.registry = config.registry || new LocaleRegistry();
    this.translator = config.translator || new TranslationProvider(this.registry);
  }

  /**
   * Get the default singleton instance
   * Per Issue #6: Returns eagerly-initialized instance to avoid race conditions
   */
  private static getDefault(): LocalizationService {
    return this.defaultInstance;
  }

  /**
   * Set active locale (loads locale file if not cached)
   *
   * @param locale - Locale code ('en', 'ja', 'de', 'fr')
   * @throws {AppError} If locale file fails to load
   *
   * @example
   * ```typescript
   * await service.setLocale('ja');
   * console.log(service.getCurrentLocale()); // 'ja'
   * ```
   */
  async setLocale(locale: LocaleCode): Promise<void> {
    // Check if already loaded
    if (this.registry.hasLocale(locale)) {
      this.currentLocale = locale;
      this.isInitialized = true;
      return;
    }

    // Load locale data (synchronous as of v1.1.3, async signature kept for API compatibility)
    await Promise.resolve(); // Satisfy async requirement while maintaining sync behavior
    const localeData = this.loader.loadLocale(locale);
    this.registry.registerLocale(localeData);
    this.currentLocale = locale;
    this.isInitialized = true;
  }

  /**
   * Static method: Set locale using default instance
   */
  static async setLocale(locale: LocaleCode): Promise<void> {
    return this.getDefault().setLocale(locale);
  }

  /**
   * Set locale from preference object with priority chain
   * Uses pure function resolveLocaleFromPreference for resolution logic
   *
   * Priority: explicit > guild > system > fallback
   *
   * @param preference - Locale preference with fallback chain
   *
   * @example
   * ```typescript
   * // Discord bot usage
   * await service.setLocaleFromPreference({
   *     explicit: 'de',     // User selected German
   *     guild: 'ja',        // Server is Japanese
   *     system: 'en-US',    // User's system is English
   *     fallback: 'en'
   * });
   * // Sets locale to 'de' (highest priority)
   * ```
   */
  async setLocaleFromPreference(preference: LocalePreference): Promise<void> {
    const locale = resolveLocaleFromPreference(preference);
    await this.setLocale(locale);
  }

  /**
   * Static method: Set locale from preference using default instance
   */
  static async setLocaleFromPreference(preference: LocalePreference): Promise<void> {
    return this.getDefault().setLocaleFromPreference(preference);
  }

  /**
   * Get current active locale
   *
   * @returns Current locale code
   *
   * @example
   * ```typescript
   * console.log(service.getCurrentLocale()); // 'ja'
   * ```
   */
  getCurrentLocale(): LocaleCode {
    return this.currentLocale;
  }

  /**
   * Static method: Get current locale from default instance
   */
  static getCurrentLocale(): LocaleCode {
    return this.getDefault().getCurrentLocale();
  }

  /**
   * Check if service is initialized with a locale
   *
   * @returns true if locale data is loaded
   *
   * @example
   * ```typescript
   * if (!service.isLocaleLoaded()) {
   *     await service.setLocale('en');
   * }
   * ```
   */
  isLocaleLoaded(): boolean {
    return this.isInitialized;
  }

  /**
   * Static method: Check if locale is loaded in default instance
   */
  static isLocaleLoaded(): boolean {
    return this.getDefault().isLocaleLoaded();
  }

  /**
   * Get localized UI label (with fallback to English)
   *
   * @param key - Translation key
   * @returns Localized label
   */
  getLabel(key: TranslationKey): string {
    return this.translator.getLabel(key, this.currentLocale);
  }

  /**
   * Static method: Get localized label using default instance
   */
  static getLabel(key: TranslationKey): string {
    return this.getDefault().getLabel(key);
  }

  /**
   * Get localized dye name by itemID
   *
   * @param itemID - Dye item ID (5729-48227)
   * @returns Localized name or null if not found
   */
  getDyeName(itemID: number): string | null {
    return this.translator.getDyeName(itemID, this.currentLocale);
  }

  /**
   * Static method: Get localized dye name using default instance
   */
  static getDyeName(itemID: number): string | null {
    return this.getDefault().getDyeName(itemID);
  }

  /**
   * Get localized category name
   *
   * @param category - Category key (e.g., "Reds", "Blues")
   * @returns Localized category name
   */
  getCategory(category: string): string {
    return this.translator.getCategory(category, this.currentLocale);
  }

  /**
   * Static method: Get localized category using default instance
   */
  static getCategory(category: string): string {
    return this.getDefault().getCategory(category);
  }

  /**
   * Get localized acquisition method
   *
   * @param acquisition - Acquisition key (e.g., "Dye Vendor", "Crafting")
   * @returns Localized acquisition method
   */
  getAcquisition(acquisition: string): string {
    return this.translator.getAcquisition(acquisition, this.currentLocale);
  }

  /**
   * Static method: Get localized acquisition using default instance
   */
  static getAcquisition(acquisition: string): string {
    return this.getDefault().getAcquisition(acquisition);
  }

  /**
   * Get all metallic dye IDs (for exclusion filtering)
   *
   * @returns Array of metallic dye item IDs
   */
  getMetallicDyeIds(): number[] {
    return this.translator.getMetallicDyeIds(this.currentLocale);
  }

  /**
   * Static method: Get metallic dye IDs using default instance
   */
  static getMetallicDyeIds(): number[] {
    return this.getDefault().getMetallicDyeIds();
  }

  /**
   * Get localized harmony type name
   *
   * @param key - Harmony type key
   * @returns Localized harmony type
   */
  getHarmonyType(key: HarmonyTypeKey): string {
    return this.translator.getHarmonyType(key, this.currentLocale);
  }

  /**
   * Static method: Get localized harmony type using default instance
   */
  static getHarmonyType(key: HarmonyTypeKey): string {
    return this.getDefault().getHarmonyType(key);
  }

  /**
   * Get localized vision type name
   *
   * @param key - Vision type key
   * @returns Localized vision type
   */
  getVisionType(key: VisionType): string {
    return this.translator.getVisionType(key, this.currentLocale);
  }

  /**
   * Static method: Get localized vision type using default instance
   */
  static getVisionType(key: VisionType): string {
    return this.getDefault().getVisionType(key);
  }

  /**
   * Get localized job name
   *
   * @param key - Job key
   * @returns Localized job name
   */
  getJobName(key: JobKey): string {
    return this.translator.getJobName(key, this.currentLocale);
  }

  /**
   * Static method: Get localized job name using default instance
   */
  static getJobName(key: JobKey): string {
    return this.getDefault().getJobName(key);
  }

  /**
   * Get localized Grand Company name
   *
   * @param key - Grand Company key
   * @returns Localized Grand Company name
   */
  getGrandCompanyName(key: GrandCompanyKey): string {
    return this.translator.getGrandCompanyName(key, this.currentLocale);
  }

  /**
   * Static method: Get localized Grand Company name using default instance
   */
  static getGrandCompanyName(key: GrandCompanyKey): string {
    return this.getDefault().getGrandCompanyName(key);
  }

  /**
   * Get localized race name
   *
   * @param key - Race key
   * @returns Localized race name
   */
  getRace(key: RaceKey): string {
    return this.translator.getRace(key, this.currentLocale);
  }

  /**
   * Static method: Get localized race name using default instance
   */
  static getRace(key: RaceKey): string {
    return this.getDefault().getRace(key);
  }

  /**
   * Get localized clan (subrace) name
   *
   * @param key - Clan key
   * @returns Localized clan name
   */
  getClan(key: ClanKey): string {
    return this.translator.getClan(key, this.currentLocale);
  }

  /**
   * Static method: Get localized clan name using default instance
   */
  static getClan(key: ClanKey): string {
    return this.getDefault().getClan(key);
  }

  /**
   * Get all available locale codes
   *
   * @returns Array of supported locale codes
   */
  getAvailableLocales(): LocaleCode[] {
    return [...SUPPORTED_LOCALES];
  }

  /**
   * Static method: Get available locales
   */
  static getAvailableLocales(): LocaleCode[] {
    return [...SUPPORTED_LOCALES];
  }

  /**
   * Preload multiple locales for instant switching
   * Useful for apps that need to switch locales without delay
   *
   * @param locales - Array of locale codes to preload
   */
  async preloadLocales(locales: LocaleCode[]): Promise<void> {
    await Promise.all(locales.map((locale) => this.setLocale(locale)));
  }

  /**
   * Static method: Preload locales using default instance
   */
  static async preloadLocales(locales: LocaleCode[]): Promise<void> {
    return this.getDefault().preloadLocales(locales);
  }

  /**
   * Clear all loaded locales from cache
   * Useful for testing or memory management
   */
  clear(): void {
    this.registry.clear();
    this.currentLocale = 'en';
    this.isInitialized = false;
  }

  /**
   * Static method: Clear cache of default instance
   */
  static clear(): void {
    this.getDefault().clear();
  }

  /**
   * Reset the static singleton instance
   * Useful for testing to prevent test pollution between test suites
   * Per Issue #6: Creates a fresh instance since we use eager initialization
   *
   * @example
   * ```typescript
   * // In test cleanup
   * afterEach(() => {
   *     LocalizationService.resetInstance();
   * });
   * ```
   */
  static resetInstance(): void {
    this.defaultInstance.clear();
    this.defaultInstance = new LocalizationService();
  }
}
