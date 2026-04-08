/**
 * @xivdyetools/types - Preset Response Types
 *
 * Types for preset API responses.
 *
 * @module preset/response
 */

import type { CategoryMeta } from './core.js';
import type { CommunityPreset } from './community.js';

/**
 * Response when listing presets
 */
export interface PresetListResponse {
  /** Array of presets */
  presets: CommunityPreset[];

  /** Total count (for pagination) */
  total: number;

  /** Current page number */
  page: number;

  /** Results per page */
  limit: number;

  /** True if more pages available */
  has_more: boolean;
}

/**
 * Successful preset creation response
 */
export interface PresetSubmitCreatedResponse {
  /** Operation succeeded */
  success: true;

  /** The newly created preset */
  preset: CommunityPreset;

  /** Moderation result */
  moderation_status: 'approved' | 'pending';
}

/**
 * Duplicate preset found response
 */
export interface PresetSubmitDuplicateResponse {
  /** Operation succeeded (duplicate handling is not an error) */
  success: true;

  /** The existing preset that matched */
  duplicate: CommunityPreset;

  /** Whether a vote was added to the duplicate */
  vote_added: boolean;
}

/**
 * Failed preset submission response
 */
export interface PresetSubmitErrorResponse {
  /** Operation failed */
  success: false;

  /** Error message describing the failure */
  error: string;
}

/**
 * Response when submitting a preset
 *
 * Uses discriminated union with multiple success states:
 * - Created: new preset was created
 * - Duplicate: existing preset found, vote may have been added
 * - Error: submission failed
 */
export type PresetSubmitResponse =
  | PresetSubmitCreatedResponse
  | PresetSubmitDuplicateResponse
  | PresetSubmitErrorResponse;

/**
 * Duplicate preset info for edit conflict
 */
export interface PresetEditDuplicateInfo {
  id: string;
  name: string;
  author_name: string | null;
}

/**
 * Successful preset edit response
 */
export interface PresetEditSuccessResponse {
  /** Operation succeeded */
  success: true;

  /** The updated preset */
  preset: CommunityPreset;

  /** Moderation result (if content needed review) */
  moderation_status?: 'approved' | 'pending';
}

/**
 * Preset edit blocked due to duplicate
 */
export interface PresetEditDuplicateResponse {
  /** Operation failed due to duplicate */
  success: false;

  /** Info about the existing duplicate */
  duplicate: PresetEditDuplicateInfo;

  /** Error message */
  error: string;
}

/**
 * Failed preset edit response
 */
export interface PresetEditErrorResponse {
  /** Operation failed */
  success: false;

  /** Error message describing the failure */
  error: string;
}

/**
 * Response from preset edit endpoint
 *
 * Uses discriminated union for type-safe handling.
 */
export type PresetEditResponse =
  | PresetEditSuccessResponse
  | PresetEditDuplicateResponse
  | PresetEditErrorResponse;

/**
 * Successful vote response
 */
export interface VoteSuccessResponse {
  /** Operation succeeded */
  success: true;

  /** Updated vote count */
  new_vote_count: number;

  /** True if user already voted (vote was not added) */
  already_voted?: boolean;
}

/**
 * Failed vote response
 */
export interface VoteErrorResponse {
  /** Operation failed */
  success: false;

  /** Error message describing the failure */
  error: string;
}

/**
 * Response when voting on a preset
 *
 * Uses discriminated union for type-safe handling.
 */
export type VoteResponse = VoteSuccessResponse | VoteErrorResponse;

/**
 * Successful moderation response
 */
export interface ModerationSuccessResponse {
  /** Operation succeeded */
  success: true;

  /** The updated preset */
  preset: CommunityPreset;
}

/**
 * Failed moderation response
 */
export interface ModerationErrorResponse {
  /** Operation failed */
  success: false;

  /** Error message describing the failure */
  error: string;
}

/**
 * Response from moderation actions
 *
 * Uses discriminated union for type-safe handling.
 */
export type ModerationResponse = ModerationSuccessResponse | ModerationErrorResponse;

/**
 * Response when listing categories
 */
export interface CategoryListResponse {
  /** Array of category metadata */
  categories: CategoryMeta[];
}
