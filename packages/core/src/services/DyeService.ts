/**
 * @xivdyetools/core - Dye Service
 *
 * FFXIV dye database management and search.
 * Provides access to the complete FFXIV dye database with search,
 * matching, and color harmony generation capabilities.
 *
 * Per R-4: Facade class that delegates to focused service classes
 * Maintains backward compatibility while using split services internally
 *
 * Environment-agnostic (Node.js + Browser).
 *
 * @module services/DyeService
 * @example
 * ```typescript
 * import { DyeService, dyeDatabase } from '@xivdyetools/core';
 *
 * const dyeService = new DyeService(dyeDatabase);
 *
 * // Find closest dye to a color
 * const closestDye = dyeService.findClosestDye('#FF0000');
 *
 * // Generate color harmonies
 * const harmonies = dyeService.findTriadicDyes('#FF0000');
 * ```
 */

import type { Dye, LocaleCode } from '@xivdyetools/types';
import type { Logger } from '@xivdyetools/logger/library';
import { NoOpLogger } from '@xivdyetools/logger/library';
import { DyeDatabase } from './dye/DyeDatabase.js';
import type { FindClosestOptions, FindWithinDistanceOptions } from './dye/DyeSearch.js';

// Re-export options types for consumers
export type { FindClosestOptions, FindWithinDistanceOptions } from './dye/DyeSearch.js';
import { DyeSearch } from './dye/DyeSearch.js';
import { HarmonyGenerator, type HarmonyOptions } from './dye/HarmonyGenerator.js';
import { LocalizationService } from './LocalizationService.js';

/**
 * Configuration options for DyeService
 */
export interface DyeServiceOptions {
  /**
   * Logger for service operations (defaults to NoOpLogger)
   */
  logger?: Logger;
}

/**
 * Service for managing FFXIV dye database (Facade)
 * Per R-4: Delegates to focused service classes for better separation of concerns
 * Maintains backward compatibility with existing API
 *
 * @example
 * // Node.js
 * import { DyeService, dyeDatabase } from '@xivdyetools/core';
 * const dyeService = new DyeService(dyeDatabase);
 *
 * // Browser (Vite auto-imports JSON)
 * import { DyeService, dyeDatabase } from '@xivdyetools/core';
 * const dyeService = new DyeService(dyeDatabase);
 *
 * // With custom logger
 * import { ConsoleLogger } from '@xivdyetools/logger/library';
 * const dyeService = new DyeService(dyeDatabase, { logger: ConsoleLogger });
 */
export class DyeService {
  private database: DyeDatabase;
  private search: DyeSearch;
  private harmony: HarmonyGenerator;

  /**
   * Initialize the dye database
   * @param dyeData - Array of dyes or JSON object with dye array
   * @param options - Optional configuration including logger
   */
  constructor(dyeData?: unknown, options: DyeServiceOptions = {}) {
    const logger = options.logger ?? NoOpLogger;
    this.database = new DyeDatabase({ logger });
    this.search = new DyeSearch(this.database);
    this.harmony = new HarmonyGenerator(this.database, this.search);

    if (dyeData) {
      this.database.initialize(dyeData);
    }
  }

  // ============================================================================
  // Database Access (delegated to DyeDatabase)
  // ============================================================================

  /**
   * Get all dyes (defensive copy)
   */
  getAllDyes(): Dye[] {
    return this.database.getAllDyes();
  }

  /**
   * Get dye by ID
   */
  getDyeById(id: number): Dye | null {
    return this.database.getDyeById(id);
  }

  /**
   * Get dye by stainID (game's internal stain table ID)
   *
   * Use this method when interfacing with plugins like Glamourer or Mare Synchronos
   * that expose stainID rather than itemID. Post-Patch 7.5, new dyes may only have
   * stainIDs without individual itemIDs.
   *
   * @param stainId - The game's stain table ID (1-125, may expand post-7.5)
   * @returns The matching dye or null if not found
   *
   * @since 2.2.0
   */
  getByStainId(stainId: number): Dye | null {
    return this.database.getByStainId(stainId);
  }

  /**
   * Check if database is loaded
   */
  isLoadedStatus(): boolean {
    return this.database.isLoadedStatus();
  }

  /**
   * Get total dye count
   */
  getDyeCount(): number {
    return this.database.getDyeCount();
  }

  /**
   * Get all unique categories
   */
  getCategories(): string[] {
    return this.database.getCategories();
  }

  // ============================================================================
  // Search & Filter (delegated to DyeSearch)
  // ============================================================================

  /**
   * Search dyes by name (case-insensitive, partial match)
   */
  searchByName(query: string): Dye[] {
    return this.search.searchByName(query);
  }

  /**
   * Search dyes by category
   */
  searchByCategory(category: string): Dye[] {
    return this.search.searchByCategory(category);
  }

  /**
   * Filter dyes with optional exclusion list
   */
  filterDyes(
    filter: {
      category?: string;
      excludeIds?: number[];
      minPrice?: number;
      maxPrice?: number;
    } = {},
  ): Dye[] {
    return this.search.filterDyes(filter);
  }

  /**
   * Find closest dye to a given hex color.
   *
   * Per P-7: Uses k-d tree for O(log n) average case vs O(n) linear search.
   * Supports configurable matching algorithms via options object.
   *
   * @param hex - Target color in hex format
   * @param options - Options object (excludeIds, matchingMethod)
   * @returns Closest matching dye, or null if none found
   */
  findClosestDye(hex: string, options: FindClosestOptions = {}): Dye | null {
    return this.search.findClosestDye(hex, options);
  }

  /**
   * Find dyes within a color distance threshold.
   *
   * Per P-7: Uses k-d tree for efficient range queries.
   * Supports configurable matching algorithms via options object.
   *
   * @param hex - Target color in hex format
   * @param options - Options object (maxDistance, limit, matchingMethod)
   * @returns Array of dyes within the distance threshold
   */
  findDyesWithinDistance(hex: string, options: FindWithinDistanceOptions): Dye[] {
    return this.search.findDyesWithinDistance(hex, options);
  }

  // ============================================================================
  // Harmony & Palette Generation (delegated to HarmonyGenerator)
  // ============================================================================

  /**
   * Find dyes that form a complementary color pair
   * @param hex Base hex color
   * @param options Matching algorithm options (optional)
   *
   * @deprecated `options.colorSpace` only — the method itself is current.
   * Rotating hue in OKLCH/CIELCH/HSL abandons the base's saturation and value,
   * which is a different answer from the one every surface shows. Pass a
   * colour wheel instead: `generateHarmonySlots(hex, type, dyes, { …, wheel })`.
   */
  findComplementaryPair(hex: string, options?: HarmonyOptions): Dye | null {
    return this.harmony.findComplementaryPair(hex, options);
  }

  /**
   * Find analogous dyes (adjacent on color wheel)
   * Returns dyes at ±angle degrees from the base color
   * @param hex Base hex color
   * @param angle Hue offset in degrees (default: 30)
   * @param options Matching algorithm options (optional)
   *
   * @deprecated `options.colorSpace` only — the method itself is current.
   * Rotating hue in OKLCH/CIELCH/HSL abandons the base's saturation and value,
   * which is a different answer from the one every surface shows. Pass a
   * colour wheel instead: `generateHarmonySlots(hex, type, dyes, { …, wheel })`.
   */
  findAnalogousDyes(hex: string, angle: number = 30, options?: HarmonyOptions): Dye[] {
    return this.harmony.findAnalogousDyes(hex, angle, options);
  }

  /**
   * Find triadic color scheme (colors 120° apart on color wheel)
   * @param hex Base hex color
   * @param options Matching algorithm options (optional)
   *
   * @deprecated `options.colorSpace` only — the method itself is current.
   * Rotating hue in OKLCH/CIELCH/HSL abandons the base's saturation and value,
   * which is a different answer from the one every surface shows. Pass a
   * colour wheel instead: `generateHarmonySlots(hex, type, dyes, { …, wheel })`.
   */
  findTriadicDyes(hex: string, options?: HarmonyOptions): Dye[] {
    return this.harmony.findTriadicDyes(hex, options);
  }

  /**
   * Find square color scheme (colors 90° apart on color wheel)
   * @param hex Base hex color
   * @param options Matching algorithm options (optional)
   *
   * @deprecated `options.colorSpace` only — the method itself is current.
   * Rotating hue in OKLCH/CIELCH/HSL abandons the base's saturation and value,
   * which is a different answer from the one every surface shows. Pass a
   * colour wheel instead: `generateHarmonySlots(hex, type, dyes, { …, wheel })`.
   */
  findSquareDyes(hex: string, options?: HarmonyOptions): Dye[] {
    return this.harmony.findSquareDyes(hex, options);
  }

  /**
   * Find tetradic color scheme (two complementary pairs)
   * @param hex Base hex color
   * @param options Matching algorithm options (optional)
   *
   * @deprecated `options.colorSpace` only — the method itself is current.
   * Rotating hue in OKLCH/CIELCH/HSL abandons the base's saturation and value,
   * which is a different answer from the one every surface shows. Pass a
   * colour wheel instead: `generateHarmonySlots(hex, type, dyes, { …, wheel })`.
   */
  findTetradicDyes(hex: string, options?: HarmonyOptions): Dye[] {
    return this.harmony.findTetradicDyes(hex, options);
  }

  /**
   * Find inverted tetradic color scheme (two complementary pairs, mirrored from tetradic)
   * @param hex Base hex color
   * @param options Matching algorithm options (optional)
   *
   * @deprecated `options.colorSpace` only — the method itself is current.
   * Rotating hue in OKLCH/CIELCH/HSL abandons the base's saturation and value,
   * which is a different answer from the one every surface shows. Pass a
   * colour wheel instead: `generateHarmonySlots(hex, type, dyes, { …, wheel })`.
   */
  findInvertedTetradicDyes(hex: string, options?: HarmonyOptions): Dye[] {
    return this.harmony.findInvertedTetradicDyes(hex, options);
  }

  /**
   * Find monochromatic dyes (same hue, varying saturation/brightness)
   * @param hex Base hex color
   * @param limit Maximum number of dyes to return (default: 6)
   * @param options Matching algorithm options (optional)
   */
  findMonochromaticDyes(hex: string, limit: number = 6, options?: HarmonyOptions): Dye[] {
    return this.harmony.findMonochromaticDyes(hex, limit, options);
  }

  /**
   * Find split-complementary harmony (±30° from the complementary hue)
   * @param hex Base hex color
   * @param options Matching algorithm options (optional)
   *
   * @deprecated `options.colorSpace` only — the method itself is current.
   * Rotating hue in OKLCH/CIELCH/HSL abandons the base's saturation and value,
   * which is a different answer from the one every surface shows. Pass a
   * colour wheel instead: `generateHarmonySlots(hex, type, dyes, { …, wheel })`.
   */
  findSplitComplementaryDyes(hex: string, options?: HarmonyOptions): Dye[] {
    return this.harmony.findSplitComplementaryDyes(hex, options);
  }

  // ============================================================================
  // Localization Support (NEW)
  // ============================================================================

  /**
   * Search dyes by name (searches both English + localized names)
   * If no locale is loaded, falls back to English-only search
   *
   * @param query - Search query
   * @returns Matching dyes
   *
   * @example
   * ```typescript
   * await LocalizationService.setLocale('ja');
   * const results = dyeService.searchByLocalizedName('スノウ');
   * // Finds "Snow White" (スノウホワイト)
   * ```
   */
  searchByLocalizedName(query: string, locale?: LocaleCode): Dye[] {
    // BUG-006 (2026-07-18 audit): pass an explicit locale in concurrent
    // multi-locale servers — reading the singleton's current locale races
    // across requests
    if (!LocalizationService.isLocaleLoaded(locale)) {
      return this.searchByName(query); // Fallback to English-only
    }

    const lowerQuery = query.toLowerCase().trim();
    const dyes = this.database.getDyesInternal();

    return dyes.filter((dye) => {
      // Search English name - MEM-001: Use pre-computed nameLower
      if (dye.nameLower.includes(lowerQuery)) {
        return true;
      }

      // Search localized name (not pre-computed as it's dynamically loaded)
      const localizedName = LocalizationService.getDyeName(dye.itemID, locale);
      if (localizedName?.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      return false;
    });
  }
}
