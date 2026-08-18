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

import type { PresetStatus, CommunityPreset } from '@xivdyetools/types';

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
 * Status display metadata for embeds
 */
export const STATUS_DISPLAY: Record<PresetStatus, { icon: string; color: number }> = {
  pending: { icon: '\uD83D\uDFE1', color: 0xfee75c },
  approved: { icon: '\uD83D\uDFE2', color: 0x57f287 },
  rejected: { icon: '\uD83D\uDD34', color: 0xed4245 },
  flagged: { icon: '\uD83D\uDFE0', color: 0xf5a623 },
  hidden: { icon: '\uD83D\uDEAB', color: 0x747f8d },
};

// ============================================================================
// Moderation Queue
// ============================================================================

/**
 * A moderation-queue entry: the preset plus the pending-image URL, when any.
 *
 * Mirrors presets-api's `ModerationQueueEntry`
 * (apps/presets-api/src/services/preset-service.ts) \u2014 duplicated here rather
 * than imported because that type is local to presets-api's own service
 * module, not part of the shared @xivdyetools/types package.
 *
 * `pending_preview_image_url` is optional here (the source type has it as
 * always-present `string | null`) purely so existing `getPendingPresets`
 * test fixtures written before this field existed stay valid without being
 * touched \u2014 the real API always includes it. Handler code must treat a
 * missing value the same as null.
 */
export interface ModerationQueueEntry extends CommunityPreset {
  pending_preview_image_url?: string | null;
}
