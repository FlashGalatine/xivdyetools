// @xivdyetools/core — public barrel.
//
// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see the package CLAUDE.md.

// Services
export { ColorService } from './services/ColorService.js';
export { /** @public */ ColorConverter } from './services/color/ColorConverter.js';
export { DyeService } from './services/DyeService.js';
export { APIService, /** @public */ MemoryCacheBackend } from './services/APIService.js';
export type { ICacheBackend, /** @public */ APIServiceOptions } from './services/APIService.js';
export {
  LocalizationService,
  SUPPORTED_LOCALES,
  extractLocaleCode,
  /** @public */
  resolveLocaleFromPreference,
} from './services/LocalizationService.js';
// Localization internals — exported for stateless callers (e.g., og-worker)
// that prefer explicit-locale APIs over the singleton + setLocale pattern.
export { LocaleLoader } from './services/localization/LocaleLoader.js';
export { LocaleRegistry } from './services/localization/LocaleRegistry.js';
export { TranslationProvider } from './services/localization/TranslationProvider.js';
export { PresetService } from './services/PresetService.js';
export type { /** @public */ ResolvedPreset } from './services/PresetService.js';
export { PaletteService } from './services/PaletteService.js';
export type {
  /** @public */
  PaletteExtractionOptions,
  /** @public */
  ExtractedColor,
  PaletteMatch,
  /** @public */
  PaletteServiceOptions,
} from './services/PaletteService.js';
export {
  CharacterColorService,
  /** @public */
  type CharacterMatchOptions,
} from './services/CharacterColorService.js';

// Types (core-specific)
export type { MatchingMethod } from './types/index.js';

// Harmony types
export type {
  HarmonyOptions,
  /** @public */
  HarmonyMatchingAlgorithm,
  HarmonyColorSpace,
} from './services/dye/HarmonyGenerator.js';

// Color converter types
export type { /** @public */ DeltaEFormula } from './services/color/ColorConverter.js';
export type { /** @public */ RYB } from './services/ColorService.js';

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
  // 5.0 matching vocabulary (one list suite-wide, dE2000 default)
  MATCHING_METHODS,
  DEFAULT_MATCHING_METHOD,
  MATCHING_METHOD_TAGS,
  LEGACY_MATCHING_METHOD_MAP,
  isMatchingMethod,
  normalizeMatchingMethod,
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
  /** @public */
  ConsolidatedDye,
  /** @public */
  LocalizedDyeName,
} from './config/consolidated-ids.js';

// Dye vocabulary (closed value sets + acquisition → price/currency coupling)
export {
  /** @public */
  DYE_CATEGORIES,
  /** @public */
  DYE_ACQUISITIONS,
  /** @public */
  ACQUISITION_META,
  /** @public */
  METALLIC_STAIN_IDS,
} from './config/dye-vocabulary.js';
export type {
  /** @public */ DyeCategory,
  /** @public */ DyeAcquisition,
  /** @public */ AcquisitionMeta,
} from './config/dye-vocabulary.js';

// Band vocabulary (5.0 calibrated per-method tier boundaries)
export {
  BAND_VOCABULARY,
  BAND_METHOD_DP,
  /** @public */
  RATIO_BANDS,
  classifyBandTier,
  /** @public */
  classifyBandTierWithCuts,
  /** @public */
  deriveDistinguishCuts,
  roundToBandDisplay,
} from './config/band-vocabulary.js';
export type {
  /** @public */ BandContext,
  /** @public */ BandMethod,
  /** @public */ BandTier,
  /** @public */ MethodBandSet,
} from './config/band-vocabulary.js';
export { SOCIAL_LINKS, PRODUCT_LINKS } from './config/product-links.js';
export type { /** @public */ ProductLink } from './config/product-links.js';

// .chara character-file import (5.0 Swatch Matcher; parse rules live in core)
export { parseCharaFile } from './services/chara/chara-parser.js';
export type {
  /** @public */
  ParsedCharaFile,
  /** @public */
  CharaColorSlotRaw,
  /** @public */
  CharaGearDye,
  CharaSlotId,
  /** @public */
  CharaGearSlotId,
  /** @public */
  CharaSlotInertReason,
} from './services/chara/chara-parser.js';
export {
  resolveCharaColors,
  /** @public */ OFF_GRID_DELTA_E2000,
} from './services/chara/chara-resolver.js';
// Equipment model identity (packing helpers shared by api-worker's resolver
// and the web-app client; the parser emits the keys, nothing in core resolves)
export {
  /** @public */ gearModelKey,
  /** @public */ weaponModelKey,
  charaModelKey,
  formatCharaModelLabel,
  CHARA_SLOT_SEARCH_FIELD,
  /** @public */ CHARA_WEAPON_SLOTS,
  isCharaWeaponSlot,
  isWornCharaModel,
} from './services/chara/chara-models.js';
export type { CharaGearModel } from './services/chara/chara-models.js';
export type {
  ResolvedCharaCharacter,
  ResolvedCharaSlot,
  /** @public */
  ResolvedGearDye,
  /** @public */
  CharaSlotVerdict,
  /** @public */
  CharaSlotErrorCode,
  /** @public */
  StainIdLookup,
} from './services/chara/chara-resolver.js';

// /manual topics + learn-more links (shared data for web, bot, og-worker)
export {
  MANUAL_TOPICS,
  /** @public */
  LODESTONE_BY_REGION,
  /** @public */
  XIVDYETOOLS_DOCS_URL,
  getLearnLink,
  getLodestoneLink,
} from './config/learn-links.js';
export type {
  ManualTopicId,
  LodestoneRegion,
  LearnLink,
  /** @public */
  ManualTopic,
} from './config/learn-links.js';

// Facewear colors (split out of the dye database in schema v2)
export {
  /** @public */
  facewearColors,
  /** @public */
  LEGACY_FACEWEAR_ITEM_IDS,
  /** @public */
  getFacewearColor,
  getFacewearColorByLegacyItemID,
} from './config/facewear.js';

// Constants
export {
  /** @public */
  RGB_MIN,
  /** @public */
  RGB_MAX,
  /** @public */
  HUE_MIN,
  /** @public */
  HUE_MAX,
  /** @public */
  SATURATION_MIN,
  /** @public */
  SATURATION_MAX,
  /** @public */
  VALUE_MIN,
  /** @public */
  VALUE_MAX,
  /** @public */
  BRETTEL_MATRICES,
  /** @public */
  MACHADO_MATRICES,
  /** @public */
  PATTERNS,
  UNIVERSALIS_API_BASE,
  /** @public */
  UNIVERSALIS_API_TIMEOUT,
  /** @public */
  UNIVERSALIS_API_RETRY_COUNT,
  /** @public */
  UNIVERSALIS_API_RETRY_DELAY,
  /** @public */
  API_CACHE_TTL,
  /** @public */
  API_CACHE_VERSION,
  /** @public */
  API_MAX_RESPONSE_SIZE,
  /** @public */
  API_RATE_LIMIT_DELAY,
} from './constants/index.js';

// Utils
export {
  /** @public */
  clamp,
  /** @public */
  round,
  /** @public */
  isValidHexColor,
  /** @public */
  isValidRGB,
  /** @public */
  isValidHSV,
  /** @public */
  sleep,
  /** @public */
  retry,
  /** @public */
  isAbortError,
  /** @public */
  generateChecksum,
  abbreviateDyeName,
} from './utils/index.js';

// Data (for browser environments - to be injected)
export { default as dyeDatabase } from './data/dyes.json' with { type: 'json' };
export { default as presetData } from './data/presets.json' with { type: 'json' };
