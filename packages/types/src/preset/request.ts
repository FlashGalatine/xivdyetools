/**
 * @xivdyetools/types - Preset Request Types
 *
 * Types for preset API requests.
 *
 * @module preset/request
 */

import type { PresetCategory, PresetStatus } from './core.js';

/**
 * Sort order for preset listings.
 *
 * Restored 2026-08-18 after the dead-code audit (DEAD-025) removed it as
 * chain-dead — web-app had stopped importing it and kept two local copies
 * instead (`services/hybrid-preset-service.ts`, `shared/tool-config-types.ts`).
 * Both now import this export.
 */
export type PresetSortOption = 'popular' | 'recent' | 'name';

/**
 * Filters for listing presets
 */
export interface PresetFilters {
  /** Filter by category */
  category?: PresetCategory;

  /** Search term (searches name, description, tags) */
  search?: string;

  /** Filter by moderation status */
  status?: PresetStatus;

  /** Sort order */
  sort?: PresetSortOption;

  /** Page number (1-indexed) */
  page?: number;

  /** Results per page (default: 20, max: 50) */
  limit?: number;

  /** Filter by curated status */
  is_curated?: boolean;
}

/**
 * Request body for editing a preset
 *
 * All fields are optional - only provided fields will be updated.
 */
export interface PresetEditRequest {
  /** New name (2-50 characters) */
  name?: string;

  /** New description (10-200 characters) */
  description?: string;

  /** New primary category (the edit form unlocked this in 5.1) */
  category_id?: PresetCategory;

  /** Replacement secondary list; `[]` clears it */
  secondary_categories?: PresetCategory[];

  /** New dye IDs (2-5 dyes) */
  dyes?: number[];

  /** New tags (0-10 tags, max 30 chars each) */
  tags?: string[];

  /** New example link (8A) — allowlisted host, or null to clear */
  example_link?: string | null;
}
