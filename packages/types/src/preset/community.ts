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

  /**
   * Up to two additional categories. `category_id` remains the primary; these
   * never contain it, and the gallery matches a preset on either slot.
   */
  secondary_categories: PresetCategory[];

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

  /**
   * Example link (8A): page URL on an allowlisted host — glamour destinations
   * such as Eorzea Collection, Mirapri or the Lodestone, and social posts on
   * X, Bluesky, Reddit, Instagram, pixiv or Misskey. Raw image hosts are
   * deliberately excluded; see EXAMPLE_LINK_HOSTS in presets-api's
   * validation-service for the authoritative list. Stored, never copied; null
   * when the author gave none.
   */
  example_link?: string | null;

  /**
   * Public URL of the author-uploaded preview image. Present ONLY when the
   * image has been approved by a moderator — the serialiser omits it for every
   * other status, which is the moderation gate.
   */
  preview_image_url?: string | null;

  /**
   * Moderation state of the uploaded picture. Safe to serialize everywhere —
   * it is a status label, not a URL, and it is what lets the edit form say
   * "under review". The URL itself stays gated on 'approved'.
   */
  preview_image_status: 'none' | 'pending' | 'approved';

  /**
   * Rejection reason from the latest moderation action (8S My Submissions).
   * Populated only on the author's own-submissions listing; null elsewhere.
   */
  rejection_reason?: string | null;
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

  /** Optional: up to two additional categories, never containing category_id */
  secondary_categories?: PresetCategory[];

  /** Array of dye item IDs (2-5 dyes) */
  dyes: number[];

  /** Tags (0-10 tags, max 30 chars each) */
  tags: string[];

  /**
   * Example link (8A): a page URL on an allowlisted host — glamour
   * destinations (Eorzea Collection, Mirapri, the Lodestone) and social posts
   * (X, Bluesky, Reddit, Instagram, pixiv, Misskey), never a raw image host.
   * The link is stored, never a copy of the image.
   */
  example_link?: string | null;
}


