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
// Theme Types
// ============================================================================

/**
 * Theme names available in the system
 */
/**
 * 5.0 fixed decision: the theme system reduces to Light and Dark, on the
 * confirmed 16A palette. Legacy stored names migrate on read in
 * ThemeService.initialize().
 */
export type ThemeName = 'standard-light' | 'standard-dark';

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
