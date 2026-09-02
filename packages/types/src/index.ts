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

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see the package CLAUDE.md.

// ============================================================================
// Color Types
// ============================================================================
export type { RGB, HSV, LAB, OKLAB, OKLCH, LCH, HSL, CMYK } from './color/index.js';
export type { HexColor, DyeId, Hue, Saturation } from './color/index.js';
export { createHexColor, createDyeId, createHue, createSaturation } from './color/index.js';
export type { VisionType, ColorblindMatrices } from './color/index.js';
export type { MatchQualityKey } from './color/index.js';
export { /** @public */ MATCH_QUALITY_TIERS, classifyMatchDistance } from './color/index.js';

// ============================================================================
// Dye Types
// ============================================================================
export type {
  Dye,
  /** @public */
  LocalizedDye,
  DyeWithDistance,
  FacewearColor,
} from './dye/index.js';
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
  Race,
} from './character/index.js';
export { RACE_SUBRACES, SUBRACE_TO_RACE } from './character/index.js';

// ============================================================================
// Preset Types
// ============================================================================
export type {
  PresetCategory,
  PresetStatus,
  CategoryMeta,
  PresetPalette,
  PresetData,
  PresetPreviousValues,
  CommunityPreset,
  PresetSubmission,
  PresetFilters,
  PresetEditRequest,
  PresetSortOption,
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
} from './preset/index.js';

// ============================================================================
// Auth Types
// ============================================================================
export type {
  AuthProvider,
  AuthSource,
  AuthContext,
  /** @public */
  PrimaryCharacter,
  JWTPayload,
  DiscordTokenResponse,
  DiscordUser,
  XIVAuthTokenResponse,
  /** @public */
  XIVAuthCharacter,
  XIVAuthCharacterRegistration,
  /** @public */
  XIVAuthSocialIdentity,
  XIVAuthUser,
  AuthUser,
  AuthResponse,
  /** @public */
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
  ToolKey,
  SheetKey,
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
export type { /** @public */ ErrorSeverity } from './error/index.js';
