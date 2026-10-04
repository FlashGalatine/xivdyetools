/**
 * Preset Types
 *
 * Re-exports shared types from @xivdyetools/types and defines
 * project-specific types for the moderation bot worker.
 *
 * @module types/preset
 */

// Shared preset types are imported from `@xivdyetools/types` at their use sites.
// This module used to re-export fourteen of them; nine had no importer at all and
// the other five had exactly one, so the pass-through was removed rather than
// trimmed (2026-09-01 dead-code audit, DEAD-019).

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

/**
 * FINDING-017: presets-api refused a status change because it is not bound to
 * the review the moderator saw. `REVISION_REQUIRED` — the request named no
 * revision — and `STALE_REVIEW` — the preset changed since — share one
 * recovery: show the current text and ask for a fresh click. `current` is the
 * status and revision the next review must be bound to (null when the API sent
 * no usable value).
 */
export class PresetReviewConflictError extends PresetAPIError {
  public readonly code: 'STALE_REVIEW' | 'REVISION_REQUIRED';
  public readonly current: { status: PresetStatus; content_revision: number } | null;

  constructor(
    code: 'STALE_REVIEW' | 'REVISION_REQUIRED',
    message: string,
    current: { status: PresetStatus; content_revision: number } | null,
    details?: unknown,
  ) {
    super(409, message, details);
    this.name = 'PresetReviewConflictError';
    this.code = code;
    this.current = current;
  }
}

/**
 * The preset as `GET /api/v1/moderation/:id` returns it. `moderation_status` is
 * derived from `status` alone ('flagged' | 'unknown') — it is NOT a content
 * filter verdict and must not be shown as one.
 */
export interface ModerationPresetView extends CommunityPreset {
  moderation_status: 'flagged' | 'unknown';
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
