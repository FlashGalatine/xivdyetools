/**
 * Preset Types
 *
 * Re-exports shared types from @xivdyetools/types and defines
 * project-specific types for the Discord bot worker.
 *
 * @module types/preset
 */

// ============================================================================
// RE-EXPORT SHARED TYPES FROM @xivdyetools/types
// ============================================================================

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type {
  PresetStatus,
  PresetCategory,
  PresetSortOption,
  CategoryMeta,
  CommunityPreset,
  PresetPreviousValues,
} from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type {
  PresetFilters,
  PresetSubmission,
  PresetEditRequest,
} from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type {
  PresetListResponse,
  PresetSubmitResponse,
  PresetEditResponse,
  VoteResponse,
} from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { ModerationLogEntry, ModerationStats } from '@xivdyetools/types';

// ============================================================================
// PROJECT-SPECIFIC TYPES
// ============================================================================

// Import types needed for project-specific types
import type { PresetStatus, PresetCategory } from '@xivdyetools/types';

/**
 * Payload received from preset API webhook notifications
 */
export interface PresetNotificationPayload {
  /** Notification type */
  type: 'submission';
  /** Preset data */
  preset: {
    id: string;
    name: string;
    description: string;
    category_id: PresetCategory;
    dyes: number[];
    tags: string[];
    author_name: string;
    author_discord_id: string;
    status: PresetStatus;
    /** Moderation result */
    moderation_status: 'clean' | 'flagged' | 'auto_approved';
    /** Submission source */
    source: 'bot' | 'web' | 'none';
    created_at: string;
  };
}

// ============================================================================
// Error Types
// ============================================================================

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

  /**
   * Get a safe, user-friendly error message based on status code.
   * This prevents exposing internal API details to end users.
   *
   * SECURITY: Use this method when displaying errors to users instead of `message`
   */
  getSafeMessage(): string {
    switch (this.statusCode) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
      case 403:
        return 'Permission denied.';
      case 404:
        return 'Not found.';
      case 409:
        return 'This already exists or conflicts with another resource.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
        return 'A server error occurred. Please try again later.';
      default:
        return 'An error occurred. Please try again.';
    }
  }
}

// ============================================================================
// UI Constants
// ============================================================================

/**
 * Category display metadata for embeds
 */
export const CATEGORY_DISPLAY: Record<PresetCategory, { icon: string; name: string }> = {
  jobs: { icon: '⚔️', name: 'FFXIV Jobs' },
  'grand-companies': { icon: '🏛️', name: 'Grand Companies' },
  seasons: { icon: '🍂', name: 'Seasons' },
  events: { icon: '🎉', name: 'FFXIV Events' },
  aesthetics: { icon: '🎨', name: 'Aesthetics' },
  community: { icon: '🌐', name: 'Community' },
};

/**
 * Status display metadata for embeds
 */
export const STATUS_DISPLAY: Record<PresetStatus, { icon: string; color: number }> = {
  pending: { icon: '🟡', color: 0xfee75c },
  approved: { icon: '🟢', color: 0x57f287 },
  rejected: { icon: '🔴', color: 0xed4245 },
  flagged: { icon: '🟠', color: 0xf5a623 },
  hidden: { icon: '🚫', color: 0x747f8d }, // Hidden due to user ban
};
