/**
 * @xivdyetools/types - Moderation Types
 *
 * Content moderation types for preset submissions.
 *
 * @module api/moderation
 */

/**
 * Result of content moderation check
 */
export interface ModerationResult {
  /** True if content passed moderation */
  passed: boolean;

  /** Which field was flagged (if any) */
  flaggedField?: 'name' | 'description' | 'content';

  /** Reason for flagging */
  flaggedReason?: string;

  /** Which moderation method was used */
  method: 'local' | 'perspective' | 'all';

  /** Toxicity scores by category (if using Perspective API) */
  scores?: Record<string, number>;
}

/**
 * Moderation action log entry
 */
export interface ModerationLogEntry {
  /** Log entry ID */
  id: string;

  /** Preset that was moderated */
  preset_id: string;

  /** Discord ID of moderator who took action */
  moderator_discord_id: string;

  /** Action taken */
  action: 'approve' | 'reject' | 'flag' | 'unflag' | 'revert';

  /** Reason for action (optional) */
  reason: string | null;

  /** When action was taken */
  created_at: string;
}

/**
 * Moderation statistics, exactly as `GET /api/v1/moderation/stats` returns them.
 *
 * BUG-010: these four were named `pending_count`, `approved_count`,
 * `rejected_count` and `flagged_count`, and no such key has ever existed in the
 * response — presets-api's SQL aliases the counts `pending` / `approved` /
 * `rejected` / `flagged` and returns them unwrapped. So the only consumer,
 * moderation-worker's `/preset moderate action:stats`, rendered
 * `String(undefined)` in all four embed fields and a moderator working the
 * queue read "undefined" four times. The type was not merely unused, it was
 * wrong, and it made the client's mistake look correct.
 *
 * The field names here now mirror the aliases in
 * `apps/presets-api/src/handlers/moderation.ts`; change them together.
 */
export interface ModerationStats {
  /** Total presets pending review */
  pending: number;

  /** Total approved presets */
  approved: number;

  /** Total rejected presets */
  rejected: number;

  /** Total flagged presets */
  flagged: number;

  /** Moderation actions logged in the last seven days */
  actions_last_week: number;
}
