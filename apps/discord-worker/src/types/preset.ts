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
import type { PresetStatus, PresetCategory, PresetPreviousValues } from '@xivdyetools/types';

/**
 * A new or re-flagged preset arriving from presets-api. Carries the whole
 * submission because the moderation embed renders all of it.
 */
export interface PresetSubmissionNotification {
  type: 'submission';
  /**
   * BUG-003 (presets-api 2.5.0+): `true` when an owner edit sent this, `false`
   * for a new submission. Optional — an older presets-api omits it, and an
   * absent value means a new submission.
   */
  is_edit?: boolean;
  /**
   * BUG-003 (presets-api 2.5.0+): the preset's status immediately BEFORE the
   * edit (`preset.status` is 'pending' for every edit that notifies). Revert
   * is offered only when `is_edit === true`, `preset.previous_values` is
   * present and this is 'approved'; an absent value counts as not approved.
   * Revert restores `previous_values`, which can be older than `edited_from`,
   * so the embed labels it as such rather than as "undo this edit".
   */
  edited_from_status?: PresetStatus;
  /**
   * Sprint 9 (presets-api, 2026-10-04 remediation): the text THIS edit
   * replaced — `name`, `description`, `tags` and `dyes` exactly as the row held
   * them before the write that sent this notification. Set on every owner
   * edit, absent on a new submission. It is the edit's diff base (shown as
   * `edited_from` → `preset`); it is never restored by anything — Revert
   * restores `preset.previous_values`. Absent from a presets-api older than
   * this field, when the diff falls back to `previous_values`, headed as
   * changes since that snapshot. Runtime data from another service — check its
   * shape before use.
   */
  edited_from?: PresetPreviousValues;
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
    /**
     * presets-api 2.4.0+: the text revision the moderation buttons bind to
     * (FINDING-017). Optional — an older presets-api omits it and the buttons
     * fall back to the legacy ids.
     */
    content_revision?: number;
    /**
     * The write-once revert snapshot: the text PATCH /moderation/:id/revert
     * would restore (and approve). Already on the wire with every submission
     * (presets-api spreads the whole row); `null` or absent when there is
     * none. The revert target only — not a diff base (see `edited_from`)
     * except on a presets-api that sends no `edited_from`. Runtime data from
     * another service — check its shape before use.
     */
    previous_values?: PresetPreviousValues | null;
  };
}

/**
 * An author-uploaded preview image awaiting review. The upload changes no
 * other column, so presets-api sends only what the embed needs — modelling it
 * as the full submission shape would promise fields that never arrive.
 */
export interface PreviewImageNotification {
  type: 'preview_image';
  /** Immutable R2 key binding the displayed image to its moderation actions. */
  preview_image_key: string;
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
// Identifier guards
// ============================================================================

/**
 * presets-api preset IDs are `crypto.randomUUID()` values (UUID v4), the same
 * shape moderation-worker's `isValidUuid` enforces on its own paths.
 */
const PRESET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * FINDING-020 (2026-08-21 security audit): handler-boundary check for values
 * that are about to be interpolated into a presets-api URL path. A value that
 * is not a UUID is a free-typed NAME (autocomplete sends the UUID, a user who
 * ignores it sends text) and must be resolved through the search query
 * parameter instead — never sent as a path segment.
 */
export function isValidPresetId(value: unknown): value is string {
  return typeof value === 'string' && PRESET_ID_PATTERN.test(value);
}

/** Current preview keys fit the Discord custom-id limit without truncation. */
export function isValidPreviewImageKey(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 78 || !value.endsWith('.webp')) return false;
  return (
    isValidPresetId(value.slice(0, 36)) && value[36] === '/' && isValidPresetId(value.slice(37, -5))
  );
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
