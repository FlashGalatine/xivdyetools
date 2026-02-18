/**
 * @xivdyetools/types - Preset Module
 *
 * Preset palette type definitions for curated and community presets.
 *
 * @module preset
 */

// Core types
export type {
  PresetCategory,
  PresetStatus,
  PresetSortOption,
  CategoryMeta,
  PresetPalette,
  ResolvedPreset,
  PresetData,
} from './core.js';

// Community preset types
export type {
  PresetPreviousValues,
  CommunityPreset,
  PresetSubmission,
  AuthenticatedPresetSubmission,
} from './community.js';

// Request types
export type { PresetFilters, PresetEditRequest } from './request.js';

// Response types
export type {
  PresetListResponse,
  PresetSubmitCreatedResponse,
  PresetSubmitDuplicateResponse,
  PresetSubmitErrorResponse,
  PresetSubmitResponse,
  PresetEditDuplicateInfo,
  PresetEditSuccessResponse,
  PresetEditDuplicateResponse,
  PresetEditErrorResponse,
  PresetEditResponse,
  VoteSuccessResponse,
  VoteErrorResponse,
  VoteResponse,
  ModerationSuccessResponse,
  ModerationErrorResponse,
  ModerationResponse,
  CategoryListResponse,
} from './response.js';
