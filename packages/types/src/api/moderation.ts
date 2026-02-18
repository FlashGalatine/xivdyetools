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
 * Moderation statistics
 */
export interface ModerationStats {
  /** Total presets pending review */
  pending_count: number;

  /** Total approved presets */
  approved_count: number;

  /** Total rejected presets */
  rejected_count: number;

  /** Total flagged presets */
  flagged_count: number;
}
