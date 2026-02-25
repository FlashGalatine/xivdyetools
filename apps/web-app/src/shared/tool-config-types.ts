/**
 * XIV Dye Tools v4.0 - Tool Configuration Types
 *
 * TypeScript interfaces for all tool configurations.
 * Used by ConfigController and ConfigSidebar for type-safe config management.
 *
 * @module shared/tool-config-types
 */

import type { ToolId } from '@services/router-service';
import type { MatchingMethod } from '@xivdyetools/core';

// Re-export MatchingMethod for convenience
export type { MatchingMethod } from '@xivdyetools/core';

// ============================================================================
// Global Configuration
// ============================================================================

/**
 * Global application configuration (not tool-specific)
 */
export interface GlobalConfig {
  /** Selected theme name */
  theme: string;
  /** Global display options shared across all tools */
  displayOptions: DisplayOptionsConfig;
}

// ============================================================================
// Tool-Specific Configurations
// ============================================================================

/**
 * Harmony Explorer configuration
 */
export interface HarmonyConfig {
  /** Selected harmony type (complementary, analogous, triadic, etc.) */
  harmonyType: string;
  /** Use perceptual (DeltaE) color matching instead of hue-based */
  strictMatching: boolean;
  /** Color matching algorithm for finding closest dyes */
  matchingMethod: MatchingMethod;
  /** Prevent the same dye from appearing in multiple harmony slots */
  preventDuplicates: boolean;
  /** Display options for result cards */
  displayOptions: DisplayOptionsConfig;
  // Legacy fields (deprecated, for migration)
  /** @deprecated Use displayOptions.showHex */
  showHex?: boolean;
  /** @deprecated Use displayOptions.showRgb */
  showRgb?: boolean;
  /** @deprecated Use displayOptions.showHsv */
  showHsv?: boolean;
  /** @deprecated Use displayOptions.showLab */
  showLab?: boolean;
}

/**
 * Palette Extractor (Color Matcher) configuration
 */
export interface ExtractorConfig {
  /** Enable vibrancy boost for extracted colors */
  vibrancyBoost: boolean;
  /** Maximum number of colors to extract (3-10) */
  maxColors: number;
  /** Drag threshold in pixels for click vs drag differentiation (3-15, default 5) */
  dragThreshold: number;
  /** Color matching algorithm for finding closest dyes */
  matchingMethod: MatchingMethod;
  /** Prevent the same dye from appearing in multiple palette slots */
  preventDuplicates: boolean;
  /** Display options for result cards */
  displayOptions: DisplayOptionsConfig;
}

/**
 * Accessibility Checker configuration
 */
export interface AccessibilityConfig {
  /** Show normal vision preview */
  normalVision: boolean;
  /** Show deuteranopia (red-green) simulation */
  deuteranopia: boolean;
  /** Show protanopia (red-blind) simulation */
  protanopia: boolean;
  /** Show tritanopia (blue-yellow) simulation */
  tritanopia: boolean;
  /** Show achromatopsia (complete colorblindness) simulation */
  achromatopsia: boolean;
  /** Show labels on vision cards */
  showLabels: boolean;
  /** Show hex values on vision cards */
  showHexValues: boolean;
  /** Enable high contrast mode */
  highContrastMode: boolean;
  /** Display options for result cards */
  displayOptions: DisplayOptionsConfig;
}

/**
 * Dye Comparison configuration
 * Uses shared displayOptions for all color format and metadata visibility settings.
 */
export interface ComparisonConfig {
  /** Display options for result cards */
  displayOptions: DisplayOptionsConfig;
}

/**
 * Color interpolation mode for the Gradient Builder tool
 * - 'rgb': Linear RGB interpolation (gray midpoints for complements)
 * - 'hsv': HSV hue interpolation with wraparound
 * - 'lab': CIE LAB perceptual interpolation
 * - 'oklch': OKLCH perceptual interpolation (best for gradients)
 * - 'lch': LCH (cylindrical LAB) interpolation
 */
export type InterpolationMode = 'rgb' | 'hsv' | 'lab' | 'oklch' | 'lch';

/**
 * Gradient Builder (Dye Mixer) configuration
 */
export interface GradientConfig {
  /** Number of gradient steps (3-12) */
  stepCount: number;
  /** Interpolation color space mode */
  interpolation: InterpolationMode;
  /** Color matching algorithm for finding closest dyes */
  matchingMethod: MatchingMethod;
  /** Display options for result cards */
  displayOptions: DisplayOptionsConfig;
}

/**
 * Color mixing algorithm for the Dye Mixer tool
 * - 'rgb': RGB additive mixing (light-based, Blue + Yellow = Gray)
 * - 'lab': LAB perceptually uniform blending (Blue + Yellow = Pink)
 * - 'oklab': OKLAB perceptually uniform blending (Blue + Yellow = Cyan)
 * - 'ryb': RYB subtractive mixing (paint-like, Blue + Yellow = Olive Green)
 * - 'hsl': HSL hue-based blending
 * - 'spectral': Kubelka-Munk spectral mixing (realistic paint, Blue + Yellow = Green)
 */
export type MixingMode = 'rgb' | 'lab' | 'oklab' | 'ryb' | 'hsl' | 'spectral';

/**
 * Dye Mixer (NEW in v4) configuration
 */
export interface MixerConfig {
  /** Maximum results to show (3-8) */
  maxResults: number;
  /** Color mixing algorithm (default: 'ryb' for paint-like mixing) */
  mixingMode: MixingMode;
  /** Color matching algorithm for finding closest dyes */
  matchingMethod: MatchingMethod;
  /** Display options for result cards */
  displayOptions: DisplayOptionsConfig;
}

/**
 * Preset category types (matches backend categories)
 */
export type PresetCategoryFilter =
  | 'all'
  | 'jobs'
  | 'grand-companies'
  | 'seasons'
  | 'events'
  | 'aesthetics'
  | 'community';

/**
 * Preset sort options
 */
export type PresetSortOption = 'popular' | 'recent' | 'name';

/**
 * Community Presets configuration
 */
export interface PresetsConfig {
  /** Show only user's own presets */
  showMyPresetsOnly: boolean;
  /** Show only favorited presets */
  showFavorites: boolean;
  /** Sort order */
  sortBy: PresetSortOption;
  /** Category filter */
  category: PresetCategoryFilter;
  /** Display options for dye cards in preset details */
  displayOptions: DisplayOptionsConfig;
}

/**
 * Budget Suggestions configuration
 */
export interface BudgetConfig {
  /** Maximum price limit in gil (0-200000) */
  maxPrice: number;
  /** Maximum results to show (1-20) */
  maxResults: number;
  /** Maximum Delta-E color distance (0-100) */
  maxDeltaE: number;
  /** Display options for result cards */
  displayOptions: DisplayOptionsConfig;
}

/**
 * Swatch Matcher (Character Matcher) configuration
 */
export interface SwatchConfig {
  /**
   * Selected color sheet category.
   * Values: 'eyeColors', 'hairColors', 'skinColors', 'highlightColors',
   * 'lipColorsDark', 'lipColorsLight', 'tattooColors',
   * 'facePaintColorsDark', 'facePaintColorsLight'
   */
  colorSheet: string;
  /**
   * Selected subrace (SubRace type).
   * Values: 'Midlander', 'Highlander', 'Wildwood', 'Duskwight',
   * 'Plainsfolk', 'Dunesfolk', 'SeekerOfTheSun', 'KeeperOfTheMoon',
   * 'SeaWolf', 'Hellsguard', 'Raen', 'Xaela', 'Helion', 'TheLost',
   * 'Rava', 'Veena'
   */
  race: string;
  /** Selected gender: 'Male' or 'Female' */
  gender: string;
  /** Maximum results to show (1-6) */
  maxResults: number;
  /** Color matching algorithm for finding closest dyes */
  matchingMethod: MatchingMethod;
  /** Display options for result cards */
  displayOptions: DisplayOptionsConfig;
}

/**
 * Market Board configuration (shared across tools)
 */
export interface MarketConfig {
  /** Selected server (data center name or world name) */
  selectedServer: string;
  /** Whether to show market prices */
  showPrices: boolean;
}

/**
 * Advanced Settings configuration (debug/utility options)
 */
export interface AdvancedConfig {
  /** Enable anonymous analytics data collection (placeholder for future) */
  analyticsEnabled: boolean;
  /** Enable performance mode (reduce animations, disable blur effects) */
  performanceMode: boolean;
}

// ============================================================================
// Shared Display Options
// ============================================================================

/**
 * Shared display options for result cards across tools.
 * Controls visibility of color formats and result metadata.
 */
export interface DisplayOptionsConfig {
  // Color format visibility
  /** Show HEX color codes */
  showHex: boolean;
  /** Show RGB values */
  showRgb: boolean;
  /** Show HSV values */
  showHsv: boolean;
  /** Show LAB values */
  showLab: boolean;

  // Result metadata visibility
  /** Show market prices */
  showPrice: boolean;
  /** Show Delta-E color distance */
  showDeltaE: boolean;
  /** Show acquisition source information */
  showAcquisition: boolean;
}

/**
 * Default display options for result cards
 */
export const DEFAULT_DISPLAY_OPTIONS: DisplayOptionsConfig = {
  showHex: true,
  showRgb: true,
  showHsv: true,
  showLab: true,
  showPrice: true,
  showDeltaE: true,
  showAcquisition: true,
};

// ============================================================================
// Type Mapping
// ============================================================================

/**
 * Map of tool IDs to their configuration interfaces
 */
export interface ToolConfigMap {
  global: GlobalConfig;
  market: MarketConfig;
  advanced: AdvancedConfig;
  harmony: HarmonyConfig;
  extractor: ExtractorConfig;
  accessibility: AccessibilityConfig;
  comparison: ComparisonConfig;
  gradient: GradientConfig;
  mixer: MixerConfig;
  presets: PresetsConfig;
  budget: BudgetConfig;
  swatch: SwatchConfig;
}

/**
 * Union type of all possible tool config types
 */
export type ToolConfig = ToolConfigMap[keyof ToolConfigMap];

/**
 * Config key type (tool ID, 'global', 'market', or 'advanced')
 */
export type ConfigKey = ToolId | 'global' | 'market' | 'advanced';

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default configuration values for all tools
 */
export const DEFAULT_CONFIGS: ToolConfigMap = {
  global: {
    theme: '',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  },
  market: {
    selectedServer: 'Crystal',
    showPrices: false,
  },
  advanced: {
    analyticsEnabled: false,
    performanceMode: false,
  },
  harmony: {
    harmonyType: 'complementary',
    strictMatching: true,
    matchingMethod: 'oklab',
    preventDuplicates: true,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  },
  extractor: {
    vibrancyBoost: true,
    maxColors: 4,
    dragThreshold: 5,
    matchingMethod: 'oklab',
    preventDuplicates: true,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  },
  accessibility: {
    normalVision: true,
    deuteranopia: true,
    protanopia: true,
    tritanopia: true,
    achromatopsia: true,
    showLabels: true,
    showHexValues: false,
    highContrastMode: false,
    displayOptions: {
      ...DEFAULT_DISPLAY_OPTIONS,
      showPrice: false, // Accessibility tool doesn't show prices by default
      showDeltaE: false, // Not applicable for accessibility
      showAcquisition: false, // Keep focus on colors
    },
  },
  comparison: {
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  },
  gradient: {
    stepCount: 4,
    interpolation: 'hsv',
    matchingMethod: 'oklab',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  },
  mixer: {
    maxResults: 4,
    mixingMode: 'ryb',
    matchingMethod: 'oklab',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  },
  presets: {
    showMyPresetsOnly: false,
    showFavorites: false,
    sortBy: 'popular',
    category: 'all',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  },
  budget: {
    maxPrice: 100000,
    maxResults: 8,
    maxDeltaE: 50,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  },
  swatch: {
    colorSheet: 'hairColors',
    race: 'SeekerOfTheSun',
    gender: 'Female',
    maxResults: 3,
    matchingMethod: 'oklab',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  },
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a config key is a valid tool ID
 */
export function isToolId(key: ConfigKey): key is ToolId {
  return key !== 'global' && key !== 'market' && key !== 'advanced';
}

/**
 * Get the default config for a tool
 */
export function getDefaultConfig<K extends ConfigKey>(key: K): ToolConfigMap[K] {
  return DEFAULT_CONFIGS[key];
}
