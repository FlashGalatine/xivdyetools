// Services
export { ColorService } from './services/ColorService.js';
export { ColorConverter } from './services/color/ColorConverter.js';
export { DyeService } from './services/DyeService.js';
export { APIService, MemoryCacheBackend } from './services/APIService.js';
export type { ICacheBackend, APIServiceOptions, CacheMetrics } from './services/APIService.js';
export {
  LocalizationService,
  SUPPORTED_LOCALES,
  extractLocaleCode,
  resolveLocaleFromPreference,
} from './services/LocalizationService.js';
// Localization internals — exported for stateless callers (e.g., og-worker)
// that prefer explicit-locale APIs over the singleton + setLocale pattern.
export { LocaleLoader } from './services/localization/LocaleLoader.js';
export { LocaleRegistry } from './services/localization/LocaleRegistry.js';
export { TranslationProvider } from './services/localization/TranslationProvider.js';
export { PresetService } from './services/PresetService.js';
export type { ResolvedPreset } from './services/PresetService.js';
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

// Types (core-specific)
export type {
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

// Dye filtering
export {
  isDyeExcluded,
  filterDyes,
  hasActiveFilters,
  EXPENSIVE_DYE_IDS,
  VENDOR_ACQUISITIONS,
  CRAFT_ACQUISITIONS,
} from './services/dye/DyeFilter.js';

export {
  // Color matching presets (core-specific, not deprecated)
  MATCHING_PRESETS,
} from './types/index.js';

// Dye consolidation (Patch 7.5)
export {
  CONSOLIDATED_IDS,
  CONSOLIDATED_DYES,
  isConsolidationActive,
  getMarketItemID,
  getConsolidatedDyeName,
} from './config/consolidated-ids.js';
export type {
  ConsolidationType,
  ConsolidatedDye,
  LocalizedDyeName,
} from './config/consolidated-ids.js';

// Dye vocabulary (closed value sets + acquisition → price/currency coupling)
export {
  DYE_CATEGORIES,
  DYE_ACQUISITIONS,
  ACQUISITION_META,
  METALLIC_STAIN_IDS,
} from './config/dye-vocabulary.js';
export type {
  DyeCategory,
  DyeAcquisition,
  AcquisitionMeta,
} from './config/dye-vocabulary.js';

// Band vocabulary (5.0 calibrated per-method tier boundaries)
export {
  BAND_VOCABULARY,
  BAND_METHOD_DP,
  RATIO_BANDS,
  SEPARATION_TIER_KEYS,
  classifyBandTier,
  classifyBandTierWithCuts,
  deriveDistinguishCuts,
  roundToBandDisplay,
} from './config/band-vocabulary.js';
export type {
  BandContext,
  BandMethod,
  BandTier,
  MethodBandSet,
} from './config/band-vocabulary.js';
export {
  calibrateBandVocabulary,
  DE2000_GROUND_TRUTH,
  METHOD_DISPLAY_DP,
} from './config/band-calibration.js';
export type {
  BandCalibrationResult,
  CalibratedMethodId,
  CalibratedMethodBands,
  RatioCalibration,
} from './config/band-calibration.js';

// .chara character-file import (5.0 Swatch Matcher; parse rules live in core)
export { parseCharaFile } from './services/chara/chara-parser.js';
export type {
  ParsedCharaFile,
  CharaColorSlotRaw,
  CharaGearDye,
  CharaSlotId,
  CharaGearSlotId,
  CharaSlotInertReason,
} from './services/chara/chara-parser.js';
export {
  resolveCharaColors,
  OFF_GRID_DELTA_E2000,
} from './services/chara/chara-resolver.js';
export type {
  ResolvedCharaCharacter,
  ResolvedCharaSlot,
  ResolvedGearDye,
  CharaSlotVerdict,
  CharaSlotErrorCode,
  StainIdLookup,
} from './services/chara/chara-resolver.js';

// /manual topics + learn-more links (shared data for web, bot, og-worker)
export {
  MANUAL_TOPICS,
  LODESTONE_BY_REGION,
  XIVDYETOOLS_DOCS_URL,
  getLearnLink,
  getLodestoneLink,
} from './config/learn-links.js';
export type {
  ManualTopicId,
  LodestoneRegion,
  LearnLink,
  ManualTopic,
} from './config/learn-links.js';

// Facewear colors (split out of the dye database in schema v2)
export {
  facewearColors,
  LEGACY_FACEWEAR_ITEM_IDS,
  getFacewearColor,
  getFacewearColorByLegacyItemID,
} from './config/facewear.js';

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
  MACHADO_MATRICES,
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
export { default as dyeDatabase } from './data/dyes.json' with { type: 'json' };
export { default as presetData } from './data/presets.json' with { type: 'json' };

// Version (auto-generated from package.json during build)
export { VERSION } from './version.js';
