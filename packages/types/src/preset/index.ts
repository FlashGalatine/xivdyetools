/**
 * @xivdyetools/types - Preset Module
 *
 * Preset palette type definitions for curated and community presets.
 *
 * @module preset
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see root CLAUDE.md's Tooling →
// knip bullet and this repo's root `knip.jsonc`.

// Core types
export type {
  PresetCategory,
  PresetStatus,
  CategoryMeta,
  PresetPalette,
  PresetData,
} from './core.js';

// Community preset types
export type { PresetPreviousValues, CommunityPreset, PresetSubmission } from './community.js';

// Request types
export type { PresetFilters, PresetEditRequest, PresetSortOption } from './request.js';

// Review custom_ids + status list (REFACTOR-001) — shared by discord-worker,
// moderation-worker and presets-api
export type {
  ReviewAction,
  ReviewKind,
  ReviewBinding,
  ParsedReviewId,
} from './review-custom-id.js';
export {
  REVIEW_STATUSES,
  isReviewStatus,
  parseReviewCustomId,
  buildReviewCustomId,
  buildReviewCustomIdOrLegacy,
} from './review-custom-id.js';

// Response types
export type {
  PresetListResponse,
  /** @public */
  PresetSubmitCreatedResponse,
  /** @public */
  PresetSubmitDuplicateResponse,
  /** @public */
  PresetSubmitErrorResponse,
  PresetSubmitResponse,
  /** @public */
  PresetEditDuplicateInfo,
  /** @public */
  PresetEditSuccessResponse,
  /** @public */
  PresetEditDuplicateResponse,
  /** @public */
  PresetEditErrorResponse,
  PresetEditResponse,
  /** @public */
  VoteSuccessResponse,
  /** @public */
  VoteErrorResponse,
  VoteResponse,
} from './response.js';
