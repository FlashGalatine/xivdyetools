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
   * Game's internal stain table ID — the **canonical dye key** since schema v2
   * (2026-07-31). Currently 1–125; `@xivdyetools/core` accepts the byte range
   * 1–254 so future dyes need no schema change.
   *
   * This is the row ID of the game's Stain Excel sheet and the ID used by
   * plugins like Glamourer and Mare Synchronos. It is what `dyes.json` stores,
   * what share URLs / og-worker paths / community presets key on, and what
   * `DyeDatabase.getDyeByStainId()` resolves.
   *
   * **Note:** Every dye produced by `DyeDatabase.initialize()` has a numeric
   * `stainID`. The `null` arm survives only for legacy fixture shapes that
   * carry `id`/`itemID` without a `stainID` (the loader warns and falls back).
   * Facewear glasses colours are **not** dyes any more — see `FacewearColor`
   * (`dye/facewear.ts`) — so there is no longer a class of dye without one.
   *
   * @since 2.1.0
   */
  stainID: number | null;

  /**
   * Numeric dye ID — always equal to `itemID` after `DyeDatabase.initialize()`
   * normalisation (schema v2 derives `itemID` from the stored `legacyItemID`,
   * falling back to `stainID`), so this is an FFXIV item ID such as 5729 or
   * 13115, not a small sequential index. Kept for the pre-v2 `Dye.id` contract;
   * prefer `stainID` for new references.
   */
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

  /** Vendor cost (0 if not purchasable) */
  cost: number;

  /**
   * Currency used for vendor purchase.
   *
   * Common values: `"Gil"`, `"Skybuilders Scrips"`, `"Cosmocredits"`,
   * `"Venture Coffer"`, `"Red Pigment"` (and other pigments),
   * `"Planet-specific Credit"`.
   *
   * `null` when the dye is not vendor-purchasable (cost 0).
   */
  currency: string | null;

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

  /** True if this dye originates from Ishgardian Restoration content */
  isIshgardian: boolean;

  /**
   * Dye consolidation group for Patch 7.5 market board lookups.
   *
   * - `'A'`: ARR dyes (itemIDs 5729-5813) — 85 dyes consolidated into one item
   * - `'B'`: Ishgardian Restoration dyes (itemIDs 30116-30124) — 9 dyes consolidated
   * - `'C'`: Cosmic Exploration dyes (itemIDs 48163-48172, 48227) — 11 dyes consolidated
   * - `null`: Special dyes — remain individual items (Facewear colours are no
   *   longer dyes; see `FacewearColor`)
   *
   * @since TBD (Patch 7.5)
   */
  consolidationType: 'A' | 'B' | 'C' | null;
}

/**
 * Localized dye with optional translated name
 *
 * Extends Dye with a localized name for display in non-English locales.
 * @internal Used by core's DyeService — apps use `getLocalizedDyeName()` instead
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
