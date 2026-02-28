/**
 * XIV Dye Tools v2.0.0 - Application Constants
 *
 * Phase 12: Architecture Refactor
 * Centralized configuration and constant values
 *
 * @module shared/constants
 */

import type { ThemeName, VisionType, ColorblindMatrices } from './types';
import type { LocaleCode, LocaleDisplay } from './i18n-types';

// ============================================================================
// Application Metadata
// ============================================================================

export const APP_NAME = 'XIV Dye Tools';
// Version injected from package.json by Vite at build time
declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const APP_DESCRIPTION =
  'A comprehensive web-based toolset for Final Fantasy XIV players to explore dye colors';

// ============================================================================
// FFXIV Constants
// ============================================================================

/**
 * Market Board price category definitions
 * Defines which dye acquisitions belong to which category
 * Used for filtering which dyes should have prices fetched
 */
export const PRICE_CATEGORIES = {
  baseDyes: {
    name: 'Base Dyes',
    acquisitions: ['Dye Vendor'],
    default: false,
  },
  craftDyes: {
    name: 'Craft Dyes',
    acquisitions: ['Crafting', 'Treasure Chest'],
    default: false,
  },
  alliedSocietyDyes: {
    name: 'Allied Society Dyes',
    acquisitions: [
      "Amalj'aa Vendor",
      'Ixali Vendor',
      'Sahagin Vendor',
      'Kobold Vendor',
      'Sylphic Vendor',
    ],
    default: true,
  },
  cosmicDyes: {
    name: 'Cosmic Dyes',
    acquisitions: ['Cosmic Exploration', 'Cosmic Fortunes'],
    default: true,
  },
  specialDyes: {
    name: 'Special Dyes',
    category: 'Special',
    default: true,
  },
} as const;

// ============================================================================
// Theme Configuration
// ============================================================================

export const THEME_NAMES: readonly ThemeName[] = [
  'standard-light',
  'standard-dark',
  'premium-dark',
  'hydaelyn-light',
  'og-classic-dark',
  'parchment-light',
  'cotton-candy',
  'sugar-riot',
  'grayscale-light',
  'grayscale-dark',
  'high-contrast-light',
  'high-contrast-dark',
] as const;

export const THEME_COUNT = THEME_NAMES.length;

export const DEFAULT_THEME: ThemeName = 'premium-dark';

/**
 * Theme display names for UI
 */
export const THEME_DISPLAY_NAMES: Record<ThemeName, string> = {
  'standard-light': 'Standard (Light)',
  'standard-dark': 'Standard (Dark)',
  'premium-dark': 'Premium Dark',
  'hydaelyn-light': 'Hydaelyn',
  'og-classic-dark': 'OG Classic',
  'parchment-light': 'Parchment',
  'cotton-candy': 'Cotton Candy',
  'sugar-riot': 'Sugar Riot',
  'grayscale-light': 'Grayscale (Light)',
  'grayscale-dark': 'Grayscale (Dark)',
  'high-contrast-light': 'High Contrast (Light)',
  'high-contrast-dark': 'High Contrast (Dark)',
};

// ============================================================================
// Localization Configuration
// ============================================================================

/**
 * Supported locale codes
 * Matches the locales available in xivdyetools-core v1.2.0
 */
export const SUPPORTED_LOCALES: readonly LocaleCode[] = [
  'en',
  'ja',
  'de',
  'fr',
  'ko',
  'zh',
] as const;

export const DEFAULT_LOCALE: LocaleCode = 'en';

/**
 * Locale display information with flags and native names
 */
export const LOCALE_DISPLAY_INFO: readonly LocaleDisplay[] = [
  { code: 'en', name: 'English', englishName: 'English', flag: '🇬🇧' },
  { code: 'ja', name: '日本語', englishName: 'Japanese', flag: '🇯🇵' },
  { code: 'de', name: 'Deutsch', englishName: 'German', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', englishName: 'French', flag: '🇫🇷' },
  { code: 'ko', name: '한국어', englishName: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: '中文', englishName: 'Chinese', flag: '🇨🇳' },
] as const;

// ============================================================================
// Vision Type Configuration
// ============================================================================

export const VISION_TYPES: readonly VisionType[] = [
  'normal',
  'deuteranopia',
  'protanopia',
  'tritanopia',
  'achromatopsia',
] as const;

export const VISION_TYPE_LABELS: Record<VisionType, string> = {
  normal: 'Normal Vision',
  deuteranopia: 'Deuteranopia (Red-Green Colorblindness)',
  protanopia: 'Protanopia (Red-Green Colorblindness)',
  tritanopia: 'Tritanopia (Blue-Yellow Colorblindness)',
  achromatopsia: 'Achromatopsia (Total Colorblindness)',
};

// ============================================================================
// Colorblindness Transformation Matrices (Brettel 1997)
// ============================================================================

/**
 * Brettel 1997 transformation matrices for colorblindness simulation
 * These matrices transform RGB values to simulate different types of colorblindness
 */
export const BRETTEL_MATRICES: ColorblindMatrices = {
  deuteranopia: [
    [0.625, 0.375, 0.0],
    [0.7, 0.3, 0.0],
    [0.0, 0.3, 0.7],
  ],
  protanopia: [
    [0.567, 0.433, 0.0],
    [0.558, 0.442, 0.0],
    [0.0, 0.242, 0.758],
  ],
  tritanopia: [
    [0.95, 0.05, 0.0],
    [0.0, 0.433, 0.567],
    [0.0, 0.475, 0.525],
  ],
  achromatopsia: [
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
  ],
};

// ============================================================================
// localStorage Configuration
// ============================================================================

export const STORAGE_PREFIX = 'xivdyetools';

export const STORAGE_KEYS = {
  THEME: `${STORAGE_PREFIX}_theme`,
  LOCALE: `${STORAGE_PREFIX}_locale`,
  DARK_MODE: `${STORAGE_PREFIX}_dark_mode`,
  DUAL_DYES: `${STORAGE_PREFIX}_dual_dyes`,
  SHOW_PRICES: `${STORAGE_PREFIX}_show_prices`,
  LAST_TOOL: `${STORAGE_PREFIX}_last_tool`,
  PRICE_CACHE: `${STORAGE_PREFIX}_price_cache`,
  SAVED_PALETTES: `${STORAGE_PREFIX}_saved_palettes`,
  HARMONY_FILTERS: `${STORAGE_PREFIX}_harmony_filters`,
  HARMONY_SUGGESTIONS_MODE: `${STORAGE_PREFIX}_harmony_suggestions_mode`,
  HARMONY_COMPANION_DYES: `${STORAGE_PREFIX}_harmony_companion_dyes`,
  // Phase 2: Discoverability
  WELCOME_SEEN: `${STORAGE_PREFIX}_welcome_seen`,
  LAST_VERSION_VIEWED: `${STORAGE_PREFIX}_last_version_viewed`,
  // Phase 2.2: Collections & Favorites
  FAVORITES: `${STORAGE_PREFIX}_favorites`,
  COLLECTIONS: `${STORAGE_PREFIX}_collections`,
  // Phase 2: Tutorials
  TUTORIALS_DISABLED: `${STORAGE_PREFIX}_tutorials_disabled`,
} as const;

// ============================================================================
// Color Conversion Constraints
// ============================================================================

/**
 * RGB value constraints
 */
export const RGB_MIN = 0;
export const RGB_MAX = 255;

/**
 * HSV value constraints
 */
export const HUE_MIN = 0;
export const HUE_MAX = 360;
export const SATURATION_MIN = 0;
export const SATURATION_MAX = 100;
export const VALUE_MIN = 0;
export const VALUE_MAX = 100;

// ============================================================================
// UI Configuration
// ============================================================================

/**
 * Common card styling classes
 */
export const CARD_CLASSES =
  'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6';

export const CARD_CLASSES_COMPACT =
  'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4';

/**
 * Maximum dyes selectable in comparisons
 */
export const MAX_DYES_COMPARISON = 4;

/**
 * Maximum dyes selectable in accessibility checker
 */
export const MAX_DYES_ACCESSIBILITY = 6; // 6 outfit slots

/**
 * Companion dyes configuration for Expanded Suggestions mode
 */
export const COMPANION_DYES_MIN = 1;
export const COMPANION_DYES_MAX = 3;
export const COMPANION_DYES_DEFAULT = 1;

/**
 * Expensive dye IDs for filtering
 */
export const EXPENSIVE_DYE_IDS = [13114, 13115]; // Pure White, Jet Black

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

export const KEYBOARD_SHORTCUTS = {
  TOGGLE_THEME: 'Shift+T',
  RESET_FILTERS: 'Ctrl+R',
  COPY_COLOR: 'Ctrl+C',
  EXPORT_DATA: 'Ctrl+E',
} as const;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  INVALID_HEX: 'Invalid hexadecimal color format. Use #RRGGBB.',
  INVALID_RGB: 'RGB values must be between 0 and 255.',
  INVALID_HSV: 'HSV values must be in ranges: H(0-360), S(0-100), V(0-100).',
  DYE_NOT_FOUND: 'Dye not found in database.',
  DATABASE_LOAD_FAILED: 'Failed to load dye database. Please refresh the page.',
  STORAGE_FULL: 'Storage quota exceeded. Please clear some data and try again.',
  API_FAILURE: 'Failed to fetch data from Universalis API.',
  NETWORK_ERROR: 'Network connection error. Please check your internet connection.',
  IMAGE_LOAD_FAILED: 'Failed to load image. Please ensure it is a valid image file.',
  THEME_INVALID: 'Invalid theme selected. Using default theme.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Feature flags for A/B testing and gradual rollout
 */
export const FEATURE_FLAGS = {
  ENABLE_PRICES: true,
  ENABLE_PRICE_HISTORY: false,
  ENABLE_SAVED_PALETTES: true,
  ENABLE_EXPORT_FORMATS: true,
  ENABLE_DARK_MODE: true,
  ENABLE_KEYBOARD_SHORTCUTS: true,
  DEBUG_MODE: false,
} as const;

// ============================================================================
// Regular Expressions
// ============================================================================

/**
 * Regex patterns for validation
 */
export const PATTERNS = {
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  RGB_COLOR: /^rgb\(\d+,\s*\d+,\s*\d+\)$/,
  URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]*$/,
} as const;

// ============================================================================
// Debounce/Throttle Delays
// ============================================================================

export const DEBOUNCE_DELAYS = {
  SEARCH: 300,
  API_CALL: 500,
  RESIZE: 200,
  SCROLL: 150,
} as const;
