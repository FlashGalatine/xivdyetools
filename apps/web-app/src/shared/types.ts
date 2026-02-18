/* istanbul ignore file */
/**
 * XIV Dye Tools v2.0.0 - Shared Type Definitions
 *
 * Phase 12: Architecture Refactor
 * Comprehensive type definitions for the application
 *
 * Types are now sourced from @xivdyetools/types where possible.
 * Web-app specific types remain defined locally.
 *
 * @module shared/types
 */

// ============================================================================
// Re-exports from @xivdyetools/types
// ============================================================================

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type {
  RGB,
  HSV,
  HexColor,
  VisionType,
  Matrix3x3,
  ColorblindMatrices,
} from '@xivdyetools/types';
/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export { createHexColor } from '@xivdyetools/types';

// Import HexColor for local use in this file
import type { HexColor } from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { Dye, DyeWithDistance, DyeDatabase } from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { APIResponse, CachedData, PriceData, RateLimitResult } from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { ErrorSeverity } from '@xivdyetools/types';
/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export { AppError, ErrorCode } from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { Result, AsyncResult, Nullable, Optional } from '@xivdyetools/types';

// ============================================================================
// Theme Types
// ============================================================================

/**
 * Theme names available in the system
 */
export type ThemeName =
  | 'standard-light'
  | 'standard-dark'
  | 'premium-dark'
  | 'hydaelyn-light'
  | 'og-classic-dark'
  | 'parchment-light'
  | 'cotton-candy'
  | 'sugar-riot'
  | 'grayscale-light'
  | 'grayscale-dark'
  | 'high-contrast-light'
  | 'high-contrast-dark';

/**
 * Color palette for a theme
 * V4: Extended with glassmorphism, gradients, and shadow properties
 */
export interface ThemePalette {
  // ===== V3 Core Properties =====
  primary: string;
  background: string;
  text: string;
  textHeader: string; // Header text color (for titles, activated buttons, etc.)
  border: string;
  backgroundSecondary: string;
  cardBackground: string;
  cardHover: string;
  textMuted: string;

  // ===== V4 Extensions (optional for backward compatibility) =====

  /** Glassmorphism background color, e.g., "rgba(245, 245, 245, 0.9)" */
  bgGlass?: string;

  /** Muted header text, e.g., "rgba(255, 255, 255, 0.7)" */
  textHeaderMuted?: string;

  /** Hover state for accent/primary color */
  accentHover?: string;

  /** RGB triplet for rgba() operations, e.g., "139, 26, 26" */
  accentRgb?: string;

  /** Soft shadow value, e.g., "0 4px 6px rgba(0, 0, 0, 0.1)" */
  shadowSoft?: string;

  /** Glow effect for accent elements */
  shadowGlow?: string;

  /** Gradient start color for backgrounds */
  gradientStart?: string;

  /** Gradient end color for backgrounds */
  gradientEnd?: string;

  /** Card-specific gradient end color */
  cardGradientEnd?: string;

  /** Disable backdrop blur for high-contrast themes */
  disableBlur?: boolean;
}

/**
 * Complete theme definition
 */
export interface Theme {
  name: ThemeName;
  palette: ThemePalette;
  isDark: boolean;
}

// ============================================================================
// Application State Types
// ============================================================================

/**
 * Global application state
 */
export interface AppState {
  currentTheme: ThemeName;
  prefersDarkMode: boolean;
  showPrices: boolean;
  lastUpdate: number;
}

/**
 * Tool-specific state extending AppState
 */
export interface HarmonyState extends AppState {
  harmonyType:
    | 'complementary'
    | 'analogous'
    | 'triadic'
    | 'split-complementary'
    | 'tetradic'
    | 'square';
  baseColor: HexColor;
  selectedDyes: number[];
}

export interface MatcherState extends AppState {
  imageUrl: string;
  sampleSize: number; // 1-64 pixels
  zoomLevel: number;
  matchedDyeId: number | null;
}

export interface ComparisonState extends AppState {
  selectedDyes: number[]; // Up to 4 dye IDs
  exportFormat: 'json' | 'css' | 'text';
}

// ============================================================================
// Web-App Specific API Types
// ============================================================================

/**
 * FFXIV Data Center information
 */
export interface DataCenter {
  name: string;
  region: string;
  worlds: number[];
}

/**
 * FFXIV World (server) information
 */
export interface World {
  id: number;
  name: string;
}
