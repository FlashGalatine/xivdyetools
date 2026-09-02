/**
 * @xivdyetools/core - Character Color Service
 *
 * Service for accessing FFXIV character customization colors and
 * finding matching dyes for hair, eye, skin tones etc.
 *
 * Uses hybrid loading: shared colors are loaded eagerly (sync),
 * race-specific colors are loaded lazily on demand (async).
 *
 * @module services/CharacterColorService
 * @example
 * ```typescript
 * import { CharacterColorService, DyeService, dyeDatabase } from '@xivdyetools/core';
 *
 * const characterColors = new CharacterColorService();
 * const dyeService = new DyeService(dyeDatabase);
 *
 * // Get all eye colors (sync)
 * const eyeColors = characterColors.getEyeColors();
 *
 * // Get hair colors for a specific race (async)
 * const hairColors = await characterColors.getHairColors('Midlander', 'Male');
 *
 * // Find closest dyes to an eye color
 * const matches = characterColors.findClosestDyes(eyeColors[47], dyeService, { count: 3 });
 * ```
 */

import type {
  CharacterColor,
  CharacterColorMatch,
  SharedColorCategory,
  RaceSpecificColorCategory,
  SubRace,
  Gender,
} from '@xivdyetools/types';
import type { RGB } from '@xivdyetools/types';
import type { MatchingMethod } from '../types/index.js';
import type { DyeService } from './DyeService.js';
import { ColorConverter } from './color/ColorConverter.js';

/**
 * Options for finding closest dye matches from character colors.
 */
export interface CharacterMatchOptions {
  /** Number of matches to return (default: 3) */
  count?: number;
  /** Color matching algorithm (default: 'oklab') */
  matchingMethod?: MatchingMethod;
}

// =============================================================================
// Eager imports for shared colors (always needed, loaded at build time)
// =============================================================================
import eyeColorsData from '../data/character_colors/shared/eye_colors.json';
import highlightColorsData from '../data/character_colors/shared/highlight_colors.json';
import lipColorsDarkData from '../data/character_colors/shared/lip_colors_dark.json';
import lipColorsLightData from '../data/character_colors/shared/lip_colors_light.json';
import tattooColorsData from '../data/character_colors/shared/tattoo_colors.json';
import facePaintDarkData from '../data/character_colors/shared/face_paint_dark.json';
import facePaintLightData from '../data/character_colors/shared/face_paint_light.json';

/**
 * Internal type for race-specific color data structure
 */
type RaceColorData = Record<string, Record<string, CharacterColor[]>>;

/**
 * Service for accessing FFXIV character customization colors
 *
 * Shared colors (eye, lip, tattoo, etc.) are loaded synchronously at import time.
 * Race-specific colors (hair, skin) are loaded lazily on first access.
 */
export class CharacterColorService {
  // Shared data loaded eagerly (sync access)
  private sharedData: Record<string, CharacterColor[]> = {
    eyeColors: eyeColorsData,
    highlightColors: highlightColorsData,
    lipColorsDark: lipColorsDarkData,
    lipColorsLight: lipColorsLightData,
    tattooColors: tattooColorsData,
    facePaintColorsDark: facePaintDarkData,
    facePaintColorsLight: facePaintLightData,
  };

  // Race-specific data loaded lazily (async access)
  private hairColorsData: RaceColorData | null = null;
  private skinColorsData: RaceColorData | null = null;

  // Loading promises for deduplication
  private hairColorsLoading: Promise<RaceColorData> | null = null;
  private skinColorsLoading: Promise<RaceColorData> | null = null;

  constructor() {
    // No initialization needed - shared data is already imported
  }

  // ==========================================================================
  // Shared Colors (Race-Agnostic) - Synchronous API
  // ==========================================================================

  /**
   * Get all eye colors (192 colors)
   */
  getEyeColors(): CharacterColor[] {
    return this.sharedData.eyeColors || [];
  }

  /**
   * Get all hair highlight colors (192 colors)
   */
  getHighlightColors(): CharacterColor[] {
    return this.sharedData.highlightColors || [];
  }

  /**
   * Get all dark lip colors (96 colors)
   */
  getLipColorsDark(): CharacterColor[] {
    return this.sharedData.lipColorsDark || [];
  }

  /**
   * Get all light lip colors (96 colors)
   */
  getLipColorsLight(): CharacterColor[] {
    return this.sharedData.lipColorsLight || [];
  }

  /**
   * Get all tattoo/limbal ring colors (192 colors)
   */
  getTattooColors(): CharacterColor[] {
    return this.sharedData.tattooColors || [];
  }

  /**
   * Get all dark face paint colors (96 colors)
   */
  getFacePaintColorsDark(): CharacterColor[] {
    return this.sharedData.facePaintColorsDark || [];
  }

  /**
   * Get all light face paint colors (96 colors)
   */
  getFacePaintColorsLight(): CharacterColor[] {
    return this.sharedData.facePaintColorsLight || [];
  }

  /**
   * Get shared colors by category
   *
   * @public published `@xivdyetools/core` API — removal is a MAJOR (DEAD-006).
   */
  getSharedColors(category: SharedColorCategory): CharacterColor[] {
    return this.sharedData[category] || [];
  }

  // ==========================================================================
  // Race-Specific Colors - Asynchronous API (lazy loaded)
  // ==========================================================================

  /**
   * Load hair colors data lazily
   */
  private async loadHairColors(): Promise<RaceColorData> {
    if (this.hairColorsData) {
      return this.hairColorsData;
    }

    // Deduplicate concurrent loads
    if (!this.hairColorsLoading) {
      this.hairColorsLoading = import('../data/character_colors/race_specific/hair_colors.json')
        .then((module) => {
          this.hairColorsData = module.default;
          this.hairColorsLoading = null;
          return this.hairColorsData;
        })
        .catch((err: unknown) => {
          // BUG-013 (2026-07-18 audit): reset on failure so a later call can
          // retry instead of rethrowing the cached rejection forever
          this.hairColorsLoading = null;
          throw err;
        });
    }

    return this.hairColorsLoading;
  }

  /**
   * Load skin colors data lazily
   */
  private async loadSkinColors(): Promise<RaceColorData> {
    if (this.skinColorsData) {
      return this.skinColorsData;
    }

    // Deduplicate concurrent loads
    if (!this.skinColorsLoading) {
      this.skinColorsLoading = import('../data/character_colors/race_specific/skin_colors.json')
        .then((module) => {
          this.skinColorsData = module.default;
          this.skinColorsLoading = null;
          return this.skinColorsData;
        })
        .catch((err: unknown) => {
          // BUG-013 (2026-07-18 audit): reset on failure so a later call can
          // retry instead of rethrowing the cached rejection forever
          this.skinColorsLoading = null;
          throw err;
        });
    }

    return this.skinColorsLoading;
  }

  /**
   * Get hair colors for a specific subrace and gender (192 colors each)
   *
   * @param subrace - The character subrace (e.g., 'Midlander', 'Highlander')
   * @param gender - The character gender ('Male' or 'Female')
   * @returns Promise resolving to array of hair colors
   */
  async getHairColors(subrace: SubRace, gender: Gender): Promise<CharacterColor[]> {
    const data = await this.loadHairColors();
    return data?.[subrace]?.[gender] || [];
  }

  /**
   * Get skin colors for a specific subrace and gender (192 colors each)
   *
   * @param subrace - The character subrace (e.g., 'Midlander', 'Highlander')
   * @param gender - The character gender ('Male' or 'Female')
   * @returns Promise resolving to array of skin colors
   */
  async getSkinColors(subrace: SubRace, gender: Gender): Promise<CharacterColor[]> {
    const data = await this.loadSkinColors();
    return data?.[subrace]?.[gender] || [];
  }

  /**
   * Get race-specific colors by category
   *
   * @param category - 'hairColors' or 'skinColors'
   * @param subrace - The character subrace
   * @param gender - The character gender
   * @returns Promise resolving to array of colors
   *
   * @public published `@xivdyetools/core` API — removal is a MAJOR (DEAD-006).
   */
  async getRaceSpecificColors(
    category: RaceSpecificColorCategory,
    subrace: SubRace,
    gender: Gender,
  ): Promise<CharacterColor[]> {
    if (category === 'hairColors') {
      return this.getHairColors(subrace, gender);
    } else {
      return this.getSkinColors(subrace, gender);
    }
  }

  // ==========================================================================
  // Color Matching
  // ==========================================================================

  /**
   * Calculate color distance using the specified matching method.
   * Converts RGB to hex for perceptual methods that require it.
   */
  private calculateDistanceWithMethod(rgb1: RGB, rgb2: RGB, method: MatchingMethod): number {
    // For RGB method, use simple Euclidean distance
    if (method === 'rgb') {
      return this.calculateDistance(rgb1, rgb2);
    }

    // Convert RGB to hex for perceptual methods
    const hex1 = ColorConverter.rgbToHex(rgb1.r, rgb1.g, rgb1.b);
    const hex2 = ColorConverter.rgbToHex(rgb2.r, rgb2.g, rgb2.b);

    switch (method) {
      // The three perceptual methods share their spelling with DeltaEFormula
      // (DEAD-037, 2026-08-18 audit) — no translation switch needed.
      case 'cie76':
      case 'ciede2000':
      case 'oklab':
        return ColorConverter.getDeltaE(hex1, hex2, method);
      case 'redmean':
        return ColorConverter.getRedmeanDistance(hex1, hex2);
      case 'distinguish':
        // Unrounded percent — identical ranks to RGB DIST, no ranking ties
        return ColorConverter.getColorDistance(hex1, hex2) / 4.416729559;
      default:
        return ColorConverter.getDeltaE(hex1, hex2, 'ciede2000');
    }
  }

  /**
   * Find the closest matching dyes to a character color.
   *
   * Supports configurable matching algorithms via the options parameter.
   *
   * @param color - The character color to match
   * @param dyeService - DyeService instance for dye lookup
   * @param options - Options object (count, matchingMethod)
   * @returns Array of matches sorted by distance (closest first)
   *
   * @example
   * ```typescript
   * const eyeColor = characterColors.getEyeColors()[47];
   *
   * const matches = characterColors.findClosestDyes(eyeColor, dyeService, {
   *   count: 3,
   *   matchingMethod: 'oklab'
   * });
   * ```
   */
  findClosestDyes(
    color: CharacterColor,
    dyeService: DyeService,
    options: CharacterMatchOptions = {},
  ): CharacterColorMatch[] {
    const { count = 3, matchingMethod = 'ciede2000' } = options;

    // BUG-056: with `count <= 0` the bounded top-k loop below never takes its
    // `best.length < count` branch, so the else-branch dereferences
    // `best[best.length - 1]` on an empty array and throws a TypeError. The
    // honest answer to "give me at most zero matches" is an empty list; the
    // reachable route to it is a corrupted `maxResults` read out of
    // localStorage.
    if (count <= 0) return [];

    const allDyes = dyeService.getAllDyes();

    // OPT-015 (2026-07-18 audit): single-pass bounded top-k selection instead
    // of allocating a match object for all ~130 dyes and full-sorting to take
    // the top 3 — this method runs per color across whole 192-color sheets,
    // so the score-all + sort-all pattern multiplied into ~25k transient
    // allocations per sheet.
    const best: Array<{ dye: (typeof allDyes)[number]; distance: number }> = [];

    for (const dye of allDyes) {
      // Skip Facewear dyes (not usable for regular glamour)
      if (dye.category === 'Facewear') {
        continue;
      }

      const distance = this.calculateDistanceWithMethod(color.rgb, dye.rgb, matchingMethod);

      if (best.length < count) {
        best.push({ dye, distance });
        best.sort((a, b) => a.distance - b.distance);
      } else if (distance < best[best.length - 1].distance) {
        best[best.length - 1] = { dye, distance };
        // Bubble the new entry into place (k is tiny, typically 3)
        for (let i = best.length - 1; i > 0 && best[i].distance < best[i - 1].distance; i--) {
          const tmp = best[i];
          best[i] = best[i - 1];
          best[i - 1] = tmp;
        }
      }
    }

    // Allocate result objects only for the winners
    return best.map(({ dye, distance }) => ({
      characterColor: color,
      dye,
      distance,
    }));
  }

  /**
   * Find the single closest dye to a character color
   */
  findClosestDye(color: CharacterColor, dyeService: DyeService): CharacterColorMatch | null {
    const matches = this.findClosestDyes(color, dyeService, { count: 1 });
    return matches[0] || null;
  }

  /**
   * Find all dyes within a color distance threshold
   */
  findDyesWithinDistance(
    color: CharacterColor,
    dyeService: DyeService,
    maxDistance: number,
  ): CharacterColorMatch[] {
    const allDyes = dyeService.getAllDyes();
    const results: CharacterColorMatch[] = [];

    for (const dye of allDyes) {
      if (dye.category === 'Facewear') {
        continue;
      }

      const distance = this.calculateDistance(color.rgb, dye.rgb);
      if (distance <= maxDistance) {
        results.push({
          characterColor: color,
          dye,
          distance,
        });
      }
    }

    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Calculate Euclidean distance in RGB space
   */
  private calculateDistance(rgb1: RGB, rgb2: RGB): number {
    const dr = rgb1.r - rgb2.r;
    const dg = rgb1.g - rgb2.g;
    const db = rgb1.b - rgb2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
}
