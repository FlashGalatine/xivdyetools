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
export type { VisionType, ColorblindMatrices } from './color/index.js';

// ============================================================================
// Dye Types
// ============================================================================
export type { Dye, LocalizedDye, DyeWithDistance } from './dye/index.js';
export type { DyeTypeFilters } from './dye/index.js';

// ============================================================================
// Character Color Types
// ============================================================================
export type {
  CharacterColor,
  CharacterColorMatch,
  SharedColorCategory,
  RaceSpecificColorCategory,
  SubRace,
  Gender,
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
  PresetData,
  PresetPreviousValues,
  CommunityPreset,
  PresetSubmission,
  PresetFilters,
  PresetEditRequest,
  PresetListResponse,
  PresetSubmitResponse,
  PresetEditResponse,
  VoteResponse,
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
  XIVAuthTokenResponse,
  XIVAuthCharacter,
  XIVAuthCharacterRegistration,
  XIVAuthSocialIdentity,
  XIVAuthUser,
  AuthUser,
  AuthResponse,
  RefreshResponse,
  UserInfoResponse,
} from './auth/index.js';
export { isValidSnowflake } from './auth/index.js';

// ============================================================================
// API Types
// ============================================================================
export type {
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
