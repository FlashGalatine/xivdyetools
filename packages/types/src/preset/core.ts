/**
 * @xivdyetools/types - Preset Core Types
 *
 * Core preset palette type definitions.
 *
 * @module preset/core
 */

import type { Dye } from '../dye/dye.js';

/**
 * Preset palette category identifiers
 */
export type PresetCategory =
  | 'jobs'
  | 'grand-companies'
  | 'seasons'
  | 'events'
  | 'aesthetics'
  | 'community';

/**
 * Status of a preset submission in the moderation workflow
 *
 * - `pending`: Awaiting moderation review
 * - `approved`: Approved and visible in listings
 * - `rejected`: Rejected by moderator
 * - `flagged`: Auto-flagged by content moderation
 * - `hidden`: Hidden due to user ban (restored on unban)
 */
export type PresetStatus = 'pending' | 'approved' | 'rejected' | 'flagged' | 'hidden';

/**
 * Sort options for preset listings
 */
export type PresetSortOption = 'popular' | 'recent' | 'name';

/**
 * Metadata for a preset category
 */
export interface CategoryMeta {
  /** Category identifier */
  id?: string;

  /** Display name (may be localized) */
  name: string;

  /** Category description */
  description: string;

  /** Optional icon/emoji */
  icon?: string | null;

  /** True if this is a curated (official) category */
  is_curated?: boolean;

  /** Display order for sorting */
  display_order?: number;

  /** Number of presets in this category */
  preset_count?: number;
}

/**
 * A preset color palette
 *
 * Represents a curated or user-created color palette using FFXIV dyes.
 */
export interface PresetPalette {
  /** Unique identifier (e.g., "job-rdm", "season-autumn", or UUID for community) */
  id: string;

  /** Display name (e.g., "Red Mage") */
  name: string;

  /** Category this preset belongs to */
  category: PresetCategory;

  /** Brief description of the palette */
  description: string;

  /** Array of dye itemIDs (2-5 dyes) */
  dyes: number[];

  /** Searchable tags */
  tags: string[];

  /** Credit for community submissions */
  author?: string;

  /** Version for future updates */
  version?: string;
}

/**
 * Preset with resolved Dye objects
 *
 * Used when displaying a preset with full dye information.
 */
export interface ResolvedPreset extends PresetPalette {
  /** Full Dye objects for each dye ID (null if dye not found) */
  resolvedDyes: (Dye | null)[];
}

/**
 * Full preset data structure
 *
 * The complete preset database including all categories and palettes.
 */
export interface PresetData {
  /** Data format version */
  version: string;

  /** Last update timestamp (ISO 8601) */
  lastUpdated: string;

  /** Category metadata */
  categories: Record<PresetCategory, CategoryMeta>;

  /** All preset palettes */
  palettes: PresetPalette[];
}
