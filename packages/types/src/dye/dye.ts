/**
 * @xivdyetools/types - Dye Types
 *
 * FFXIV dye object definitions with color and metadata.
 *
 * ## TYPES-103: Field Presence Guarantee
 *
 * All fields in the `Dye` interface are required and non-nullable.
 * The dye database (`xivdyetools-core`) ensures complete data initialization.
 *
 * **For consumers:** You can safely access all Dye fields without null checks.
 * If you're receiving dye data from external sources (JSON APIs, user input),
 * validate the data matches the interface before casting to `Dye`.
 *
 * @module dye/dye
 */

import type { RGB, HSV } from '../color/rgb.js';

/**
 * FFXIV dye object with color and metadata
 *
 * Represents a single dye item from FFXIV, including its color values,
 * acquisition information, and type flags for filtering.
 */
export interface Dye {
  /** FFXIV item ID */
  itemID: number;

  /**
   * Game's internal stain table ID (1-125).
   *
   * This is the ID used in the game's Stain Excel table and by plugins
   * like Glamourer and Mare Synchronos. Unlike itemID, stainID may shift
   * when new dyes are added to the game.
   *
   * **Note:** Facewear dyes do not have stainIDs (null).
   *
   * **Recommendation:** Use `itemID` for stable references. Use `stainID`
   * only when interfacing with plugins or datamined content.
   *
   * @since 2.1.0
   */
  stainID: number | null;

  /** Unique dye ID (1-200) */
  id: number;

  /** English dye name */
  name: string;

  /** Hex color value (#RRGGBB format) */
  hex: string;

  /** RGB color representation */
  rgb: RGB;

  /** HSV color representation */
  hsv: HSV;

  /** Category name (e.g., 'Neutral', 'Red', 'Blue') */
  category: string;

  /** How to obtain the dye (e.g., 'NPC', 'Crafted', 'Achievement') */
  acquisition: string;

  /** Gil cost (0 if not purchasable) */
  cost: number;

  /**
   * Type flags for locale-independent filtering
   * Added in xivdyetools-core v1.3.0
   */

  /** True if this is a metallic dye */
  isMetallic: boolean;

  /** True if this is a pastel dye */
  isPastel: boolean;

  /** True if this is a dark-toned dye */
  isDark: boolean;

  /** True if this is a cosmic (starlight/glittery) dye */
  isCosmic: boolean;
}

/**
 * Localized dye with optional translated name
 *
 * Extends Dye with a localized name for display in non-English locales.
 */
export interface LocalizedDye extends Dye {
  /** Translated dye name (if available) */
  localizedName?: string;
}

/**
 * Dye with calculated color distance
 *
 * Used when searching for dyes by color similarity.
 * The distance represents how close this dye is to a target color.
 */
export interface DyeWithDistance extends Dye {
  /** Color distance from target (lower = more similar) */
  distance: number;
}
