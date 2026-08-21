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
export type { PresetCategory, CommunityPreset } from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { PresetFilters, PresetSubmission, PresetEditRequest } from '@xivdyetools/types';

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

// ============================================================================
// PROJECT-SPECIFIC TYPES
// ============================================================================

// Import types needed for project-specific types
import type { PresetStatus, PresetCategory } from '@xivdyetools/types';

/**
 * A new or re-flagged preset arriving from presets-api. Carries the whole
 * submission because the moderation embed renders all of it.
 */
export interface PresetSubmissionNotification {
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

/**
 * An author-uploaded preview image awaiting review. The upload changes no
 * other column, so presets-api sends only what the embed needs — modelling it
 * as the full submission shape would promise fields that never arrive.
 */
export interface PreviewImageNotification {
  type: 'preview_image';
  /** R2 key of the pending object, used to build the embed's image URL. */
  preview_image_key?: string | null;
  preset: {
    id: string;
    name: string;
    author_name: string;
  };
}

/**
 * Payload received from preset API webhook notifications.
 * Discriminated on `type`: narrow first, then read.
 */
export type PresetNotificationPayload = PresetSubmissionNotification | PreviewImageNotification;

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
   * Get the locale key of a safe, user-friendly error message based on status
   * code (render with `t.t(error.getSafeMessageKey())`). This prevents
   * exposing internal API details to end users.
   *
   * SECURITY: Use this method when displaying errors to users instead of `message`
   */
  getSafeMessageKey(): string {
    switch (this.statusCode) {
      case 400:
        return 'preset.api.badRequest';
      case 401:
      case 403:
        return 'preset.api.permissionDenied';
      case 404:
        return 'preset.api.notFound';
      case 409:
        return 'preset.api.conflict';
      case 429:
        return 'preset.api.rateLimited';
      case 500:
      case 502:
      case 503:
        return 'preset.api.serverError';
      default:
        return 'preset.api.unknown';
    }
  }
}

// ============================================================================
// UI Constants
// ============================================================================

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
