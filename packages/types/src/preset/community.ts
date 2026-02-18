/**
 * @xivdyetools/types - Community Preset Types
 *
 * Types for community-submitted presets with moderation data.
 *
 * @module preset/community
 */

import type { PresetCategory, PresetStatus } from './core.js';

/**
 * Stores pre-edit values for moderation revert capability
 *
 * When a preset is edited, the previous values are stored here
 * so moderators can revert if needed.
 */
export interface PresetPreviousValues {
  /** Previous preset name */
  name: string;

  /** Previous description */
  description: string;

  /** Previous tags array */
  tags: string[];

  /** Previous dye IDs array */
  dyes: number[];
}

/**
 * Community preset with voting and moderation data
 *
 * Extended version of PresetPalette for API responses, including
 * author information, vote counts, and moderation status.
 */
export interface CommunityPreset {
  /** Unique identifier (UUID) */
  id: string;

  /** Display name */
  name: string;

  /** Brief description */
  description: string;

  /** Category this preset belongs to */
  category_id: PresetCategory;

  /** Array of dye item IDs (2-5 dyes) */
  dyes: number[];

  /** Searchable tags */
  tags: string[];

  /** Discord user ID of author (null for curated presets) */
  author_discord_id: string | null;

  /** Display name of author at submission time */
  author_name: string | null;

  /** Number of votes */
  vote_count: number;

  /** Moderation status */
  status: PresetStatus;

  /** True for official/curated presets */
  is_curated: boolean;

  /** ISO 8601 creation timestamp */
  created_at: string;

  /** ISO 8601 last update timestamp */
  updated_at: string;

  /**
   * Sorted dye IDs signature for duplicate detection
   * Format: comma-separated sorted dye IDs (e.g., "1,5,12,45")
   */
  dye_signature?: string;

  /** Previous values for revert capability (if edited) */
  previous_values?: PresetPreviousValues | null;
}

/**
 * Data required to submit a new preset
 */
export interface PresetSubmission {
  /** Name (2-50 characters) */
  name: string;

  /** Description (10-200 characters) */
  description: string;

  /** Category */
  category_id: PresetCategory;

  /** Array of dye item IDs (2-5 dyes) */
  dyes: number[];

  /** Tags (0-10 tags, max 30 chars each) */
  tags: string[];
}

/**
 * Extended submission with author info (for authenticated submissions)
 */
export interface AuthenticatedPresetSubmission extends PresetSubmission {
  /** Submitter's Discord user ID */
  author_discord_id: string;

  /** Submitter's display name */
  author_name: string;
}
