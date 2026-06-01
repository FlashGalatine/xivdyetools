/**
 * XIV Dye Tools v2.0.0 - Application Constants
 *
 * Phase 12: Architecture Refactor
 * Centralized configuration and constant values
 *
 * @module shared/constants
 */

import type { ThemeName } from './types';
import type { LocaleCode, LocaleDisplay } from './i18n-types';

// ============================================================================
// Application Metadata
// ============================================================================

export const APP_NAME = 'XIV Dye Tools';
// Version injected from package.json by Vite at build time
declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
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

export const DEFAULT_THEME: ThemeName = 'premium-dark';

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
// UI Configuration
// ============================================================================

export const CARD_CLASSES_COMPACT =
  'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4';

/**
 * Companion dyes configuration for Expanded Suggestions mode
 */
export const COMPANION_DYES_MIN = 1;
export const COMPANION_DYES_MAX = 3;
export const COMPANION_DYES_DEFAULT = 1;

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
