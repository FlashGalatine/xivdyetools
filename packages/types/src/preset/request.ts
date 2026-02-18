/**
 * @xivdyetools/types - Preset Request Types
 *
 * Types for preset API requests.
 *
 * @module preset/request
 */

import type { PresetCategory, PresetStatus, PresetSortOption } from './core.js';

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

  /** New dye IDs (2-5 dyes) */
  dyes?: number[];

  /** New tags (0-10 tags, max 30 chars each) */
  tags?: string[];
}
