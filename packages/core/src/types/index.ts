/**
 * @xivdyetools/core - Shared Type Definitions
 *
 * Type definitions for color science and FFXIV dyes.
 *
 * NOTE: These types are now re-exported from @xivdyetools/types for consistency
 * across the xivdyetools ecosystem. For new projects, consider importing
 * directly from @xivdyetools/types.
 *
 * @module types
 */

/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/logger/library' instead.
 */
export type { Logger } from '@xivdyetools/logger/library';
/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/logger/library' instead.
 */
export { NoOpLogger, ConsoleLogger } from '@xivdyetools/logger/library';

// ============================================================================
// Re-export all types from @xivdyetools/types
// ============================================================================

/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
export type {
  RGB,
  HSV,
  LAB,
  OKLAB,
  OKLCH,
  LCH,
  HSL,
  HexColor,
  DyeId,
  Hue,
  Saturation,
} from '@xivdyetools/types';
/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
export { createHexColor, createDyeId, createHue, createSaturation } from '@xivdyetools/types';
/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
export type { VisionType, Matrix3x3, ColorblindMatrices } from '@xivdyetools/types';

/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
export type { Dye, LocalizedDye, DyeWithDistance, DyeDatabase } from '@xivdyetools/types';

/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
export type {
  CharacterColor,
  CharacterColorMatch,
  SharedColorCategory,
  RaceSpecificColorCategory,
  CharacterColorCategory,
  SubRace,
  Gender,
  Race,
} from '@xivdyetools/types';
export { RACE_SUBRACES, SUBRACE_TO_RACE, COLOR_GRID_DIMENSIONS } from '@xivdyetools/types';

/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
export type {
  PresetCategory,
  PresetStatus,
  PresetSortOption,
  CategoryMeta,
  PresetPalette,
  ResolvedPreset,
  PresetData,
  CommunityPreset,
  PresetSubmission,
  AuthenticatedPresetSubmission,
  PresetFilters,
  PresetEditRequest,
  PresetListResponse,
  PresetSubmitResponse,
  PresetEditResponse,
  VoteResponse,
  ModerationResponse,
  CategoryListResponse,
} from '@xivdyetools/types';

/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
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
} from '@xivdyetools/types';

/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
export type {
  APIResponse,
  CachedData,
  ModerationResult,
  ModerationLogEntry,
  ModerationStats,
  PriceData,
  RateLimitResult,
} from '@xivdyetools/types';

/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
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
} from '@xivdyetools/types';

/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
export { ErrorCode, AppError } from '@xivdyetools/types';
/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
export type { ErrorSeverity } from '@xivdyetools/types';

/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
export type { Result, AsyncResult, Nullable, Optional } from '@xivdyetools/types';
/**
 * @deprecated Removed in v2.0.0. Import directly from '@xivdyetools/types' instead.
 */
export { isOk, isErr } from '@xivdyetools/types';

// ============================================================================
// Color Matching Types (core-specific)
// ============================================================================

/**
 * Available color matching algorithms for finding closest dyes.
 *
 * - rgb: RGB Euclidean distance (fastest, least accurate)
 * - cie76: CIE76 LAB Euclidean (fast, fair accuracy)
 * - ciede2000: CIEDE2000 (industry standard, accurate)
 * - oklab: OKLAB Euclidean (modern, simpler than ciede2000, CSS standard)
 * - hyab: HyAB hybrid (best for large color differences/palette matching)
 * - oklch-weighted: OKLCH with custom L/C/H weights (advanced)
 */
export type MatchingMethod = 'rgb' | 'cie76' | 'ciede2000' | 'oklab' | 'hyab' | 'oklch-weighted';

/**
 * Configuration for OKLCH weighted matching.
 * Allows users to prioritize different color attributes.
 */
export interface OklchWeights {
  /** Lightness weight (default 1.0). Higher = prioritize brightness matching */
  kL: number;
  /** Chroma weight (default 1.0). Higher = prioritize saturation matching */
  kC: number;
  /** Hue weight (default 1.0). Higher = prioritize hue matching */
  kH: number;
}

/**
 * Color matching configuration options.
 */
export interface MatchingConfig {
  /** The matching algorithm to use */
  method: MatchingMethod;
  /** Custom weights for oklch-weighted method (ignored for other methods) */
  weights?: OklchWeights;
}

/**
 * Default OKLCH weights for common matching presets.
 */
export const MATCHING_PRESETS = {
  /** Equal weight to all attributes (default) */
  balanced: { kL: 1.0, kC: 1.0, kH: 1.0 },
  /** Prioritize matching the hue (color), tolerate brightness differences */
  matchHue: { kL: 0.5, kC: 0.8, kH: 2.0 },
  /** Prioritize matching brightness (for armor visibility) */
  matchBrightness: { kL: 2.0, kC: 1.0, kH: 0.5 },
  /** Prioritize matching saturation (find vibrant alternatives) */
  matchSaturation: { kL: 0.5, kC: 2.0, kH: 0.8 },
} as const;
