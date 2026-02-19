/**
 * @xivdyetools/types
 *
 * Shared TypeScript type definitions for the xivdyetools ecosystem.
 *
 * This package consolidates types from:
 * - xivdyetools-core
 * - xivdyetools-web-app
 * - xivdyetools-discord-worker
 * - xivdyetools-presets-api
 * - xivdyetools-oauth
 *
 * @packageDocumentation
 */

// ============================================================================
// Color Types
// ============================================================================
export type { RGB, HSV, LAB, OKLAB, OKLCH, LCH, HSL } from './color/index.js';
export type { HexColor, DyeId, Hue, Saturation } from './color/index.js';
export { createHexColor, createDyeId, createHue, createSaturation } from './color/index.js';
export type { VisionType, Matrix3x3, ColorblindMatrices } from './color/index.js';

// ============================================================================
// Dye Types
// ============================================================================
export type { Dye, LocalizedDye, DyeWithDistance, DyeDatabase } from './dye/index.js';

// ============================================================================
// Character Color Types
// ============================================================================
export type {
  CharacterColor,
  CharacterColorMatch,
  SharedColorCategory,
  RaceSpecificColorCategory,
  CharacterColorCategory,
  SubRace,
  Gender,
  Race,
} from './character/index.js';
export {
  RACE_SUBRACES,
  SUBRACE_TO_RACE,
  COLOR_GRID_DIMENSIONS,
} from './character/index.js';

// ============================================================================
// Preset Types
// ============================================================================
export type {
  PresetCategory,
  PresetStatus,
  PresetSortOption,
  CategoryMeta,
  PresetPalette,
  ResolvedPreset,
  PresetData,
  PresetPreviousValues,
  CommunityPreset,
  PresetSubmission,
  AuthenticatedPresetSubmission,
  PresetFilters,
  PresetEditRequest,
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
} from './preset/index.js';

// ============================================================================
// Auth Types
// ============================================================================
export type {
  AuthProvider,
  AuthSource,
  AuthContext,
  PrimaryCharacter,
  JWTPayload,
  OAuthState,
  DiscordTokenResponse,
  DiscordUser,
  DiscordSnowflake,
  XIVAuthTokenResponse,
  XIVAuthCharacter,
  XIVAuthCharacterRegistration,
  XIVAuthSocialIdentity,
  XIVAuthUser,
  AuthUser,
  AuthSuccessResponse,
  AuthErrorResponse,
  AuthResponse,
  RefreshSuccessResponse,
  RefreshErrorResponse,
  RefreshResponse,
  UserInfoData,
  UserInfoSuccessResponse,
  UserInfoErrorResponse,
  UserInfoResponse,
} from './auth/index.js';
export { isValidSnowflake, createSnowflake } from './auth/index.js';

// ============================================================================
// API Types
// ============================================================================
export type {
  APISuccessResponse,
  APIErrorResponse,
  APIResponse,
  CachedData,
  ModerationResult,
  ModerationLogEntry,
  ModerationStats,
  PriceData,
  RateLimitResult,
} from './api/index.js';

// ============================================================================
// Localization Types
// ============================================================================
export type {
  LocaleCode,
  TranslationKey,
  HarmonyTypeKey,
  JobKey,
  GrandCompanyKey,
  RaceKey,
  ClanKey,
  LocaleData,
  LocalePreference,
} from './localization/index.js';

// ============================================================================
// Error Types
// ============================================================================
export { ErrorCode } from './error/index.js';
export { AppError } from './error/index.js';
export type { ErrorSeverity } from './error/index.js';

// ============================================================================
// Utility Types
// ============================================================================
export type { Result, AsyncResult, Nullable, Optional } from './utility/index.js';
export { isOk, isErr } from './utility/index.js';
