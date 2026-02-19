// Services
export { ColorService } from './services/ColorService.js';
export { ColorConverter } from './services/color/ColorConverter.js';
export { DyeService } from './services/DyeService.js';
export { APIService, MemoryCacheBackend } from './services/APIService.js';
export type { ICacheBackend, APIServiceOptions, CacheMetrics } from './services/APIService.js';
export { LocalizationService } from './services/LocalizationService.js';
export { PresetService } from './services/PresetService.js';
export { PaletteService } from './services/PaletteService.js';
export type {
  PaletteExtractionOptions,
  ExtractedColor,
  PaletteMatch,
  PaletteServiceOptions,
} from './services/PaletteService.js';
export {
  CharacterColorService,
  type CharacterMatchOptions,
} from './services/CharacterColorService.js';

// Types
export type {
  Dye,
  LocalizedDye,
  RGB,
  HSV,
  LAB,
  HexColor,
  VisionType,
  Matrix3x3,
  ColorblindMatrices,
  ErrorSeverity,
  PriceData,
  CachedData,
  LocaleCode,
  TranslationKey,
  HarmonyTypeKey,
  JobKey,
  GrandCompanyKey,
  LocaleData,
  LocalePreference,
  Logger,
  // Preset types
  PresetCategory,
  CategoryMeta,
  PresetPalette,
  ResolvedPreset,
  PresetData,
  // Community preset types (for API integration)
  PresetStatus,
  CommunityPreset,
  PresetSubmission,
  PresetListResponse,
  PresetSubmitResponse,
  VoteResponse,
  PresetFilters,
  // Character types
  CharacterColor,
  CharacterColorMatch,
  SubRace,
  Gender,
  Race,
  // Color matching types
  MatchingMethod,
  OklchWeights,
  MatchingConfig,
} from './types/index.js';

// Harmony types
export type {
  HarmonyOptions,
  HarmonyMatchingAlgorithm,
  HarmonyColorSpace,
} from './services/dye/HarmonyGenerator.js';

// Color converter types
export type { DeltaEFormula } from './services/color/ColorConverter.js';
export type { RYB } from './services/ColorService.js';

// Dye search types
export type { FindClosestOptions, FindWithinDistanceOptions } from './services/dye/DyeSearch.js';
export {
  AppError,
  ErrorCode,
  createHexColor,
  NoOpLogger,
  ConsoleLogger,
  // Character constants
  RACE_SUBRACES,
  SUBRACE_TO_RACE,
  COLOR_GRID_DIMENSIONS,
  // Color matching presets
  MATCHING_PRESETS,
} from './types/index.js';

// Constants
export {
  RGB_MIN,
  RGB_MAX,
  HUE_MIN,
  HUE_MAX,
  SATURATION_MIN,
  SATURATION_MAX,
  VALUE_MIN,
  VALUE_MAX,
  COLOR_DISTANCE_MAX,
  VISION_TYPES,
  VISION_TYPE_LABELS,
  BRETTEL_MATRICES,
  PATTERNS,
  UNIVERSALIS_API_BASE,
  UNIVERSALIS_API_TIMEOUT,
  UNIVERSALIS_API_RETRY_COUNT,
  UNIVERSALIS_API_RETRY_DELAY,
  API_CACHE_TTL,
  API_DEBOUNCE_DELAY,
  API_CACHE_VERSION,
  API_MAX_RESPONSE_SIZE,
  API_RATE_LIMIT_DELAY,
} from './constants/index.js';

// Utils
export {
  clamp,
  lerp,
  round,
  distance,
  unique,
  groupBy,
  sortByProperty,
  filterNulls,
  isValidHexColor,
  isValidRGB,
  isValidHSV,
  isString,
  isNumber,
  isArray,
  isObject,
  isNullish,
  sleep,
  retry,
  isAbortError,
  generateChecksum,
} from './utils/index.js';

// Data (for browser environments - to be injected)
export { default as dyeDatabase } from './data/colors_xiv.json' with { type: 'json' };
export { default as presetData } from './data/presets.json' with { type: 'json' };

// Character color data - individual exports for tree-shaking
export { default as characterColorMeta } from './data/character_colors/index.json' with { type: 'json' };
export { default as eyeColorsData } from './data/character_colors/shared/eye_colors.json' with { type: 'json' };
export { default as highlightColorsData } from './data/character_colors/shared/highlight_colors.json' with { type: 'json' };
export { default as lipColorsDarkData } from './data/character_colors/shared/lip_colors_dark.json' with { type: 'json' };
export { default as lipColorsLightData } from './data/character_colors/shared/lip_colors_light.json' with { type: 'json' };
export { default as tattooColorsData } from './data/character_colors/shared/tattoo_colors.json' with { type: 'json' };
export { default as facePaintDarkData } from './data/character_colors/shared/face_paint_dark.json' with { type: 'json' };
export { default as facePaintLightData } from './data/character_colors/shared/face_paint_light.json' with { type: 'json' };
export { default as hairColorsData } from './data/character_colors/race_specific/hair_colors.json' with { type: 'json' };
export { default as skinColorsData } from './data/character_colors/race_specific/skin_colors.json' with { type: 'json' };

/**
 * @deprecated Use the CharacterColorService instead, or import individual
 * color data exports (eyeColorsData, hairColorsData, etc.) for tree-shaking.
 */
export { default as characterColorData } from './data/character_colors.json' with { type: 'json' };

// Version (auto-generated from package.json during build)
export { VERSION } from './version.js';
