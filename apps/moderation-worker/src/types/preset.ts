/**
 * Preset Types
 *
 * Re-exports shared types from @xivdyetools/types and defines
 * project-specific types for the moderation bot worker.
 *
 * @module types/preset
 */

// ============================================================================
// RE-EXPORT SHARED TYPES FROM @xivdyetools/types
// ============================================================================

export type {
  PresetStatus,
  PresetCategory,
  PresetSortOption,
  CategoryMeta,
  CommunityPreset,
  PresetPreviousValues,
  PresetFilters,
  PresetSubmission,
  PresetEditRequest,
  PresetListResponse,
  PresetSubmitResponse,
  PresetEditResponse,
  VoteResponse,
  ModerationLogEntry,
  ModerationStats,
} from '@xivdyetools/types';

// ============================================================================
// PROJECT-SPECIFIC TYPES
// ============================================================================

import type { PresetStatus, PresetCategory } from '@xivdyetools/types';

/**
 * Custom error class for preset API errors
 */
export class PresetAPIError extends Error {
  /** HTTP status code */
  public readonly statusCode: number;
  /** Additional error details */
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'PresetAPIError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ============================================================================
// UI Constants
// ============================================================================

/**
 * Category display metadata for embeds
 */
export const CATEGORY_DISPLAY: Record<PresetCategory, { icon: string; name: string }> = {
  jobs: { icon: '\u2694\uFE0F', name: 'FFXIV Jobs' },
  'grand-companies': { icon: '\uD83C\uDFDB\uFE0F', name: 'Grand Companies' },
  seasons: { icon: '\uD83C\uDF42', name: 'Seasons' },
  events: { icon: '\uD83C\uDF89', name: 'FFXIV Events' },
  aesthetics: { icon: '\uD83C\uDFA8', name: 'Aesthetics' },
  community: { icon: '\uD83C\uDF10', name: 'Community' },
};

/**
 * Status display metadata for embeds
 */
export const STATUS_DISPLAY: Record<PresetStatus, { icon: string; color: number }> = {
  pending: { icon: '\uD83D\uDFE1', color: 0xfee75c },
  approved: { icon: '\uD83D\uDFE2', color: 0x57f287 },
  rejected: { icon: '\uD83D\uDD34', color: 0xed4245 },
  flagged: { icon: '\uD83D\uDFE0', color: 0xf5a623 },
  hidden: { icon: '\uD83D\uDEAB', color: 0x747f8d },
};
