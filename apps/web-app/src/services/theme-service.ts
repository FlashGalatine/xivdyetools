/**
 * XIV Dye Tools v2.0.0 - Theme Service
 *
 * Phase 12: Architecture Refactor
 * 11-theme system management (includes WCAG AAA high contrast themes)
 *
 * @module services/theme-service
 */

import type { Theme, ThemeName, ThemePalette } from '@shared/types';
import { ErrorCode, AppError } from '@xivdyetools/types';
import { GLYPH_ACCENT_LIGHT } from '@xivdyetools/svg';
import { THEME_NAMES, DEFAULT_THEME, STORAGE_KEYS } from '@shared/constants';
import { appStorage } from './storage-service';
import { logger } from '@shared/logger';

// ============================================================================
// Theme Factory
// ============================================================================

/**
 * Configuration for creating a theme palette
 */
interface ThemePaletteConfig {
  /** Primary accent color */
  primary: string;
  /** Main background color */
  background: string;
  /** Main text color */
  text: string;
  /** Whether this is a dark theme (affects defaults) */
  isDark: boolean;
  /** Optional overrides for derived properties */
  overrides?: Partial<Omit<ThemePalette, 'primary' | 'background' | 'text'>>;
}

/**
 * Creates a theme palette with sensible defaults for derived properties.
 * Core colors (primary, background, text) are required; others can be overridden.
 *
 * @param config - Theme configuration with core colors and optional overrides
 * @returns Complete theme palette
 */
function createThemePalette(config: ThemePaletteConfig): ThemePalette {
  const { primary, background, text, isDark, overrides = {} } = config;

  return {
    primary,
    background,
    text,
    // Default textHeader: white for light themes, inherit text for dark
    textHeader: overrides.textHeader ?? (isDark ? text : '#FFFFFF'),
    // Default border: use primary color
    border: overrides.border ?? primary,
    // Default secondary: same as main background
    backgroundSecondary: overrides.backgroundSecondary ?? background,
    // Default card: same as main background
    cardBackground: overrides.cardBackground ?? background,
    // Default hover: same as secondary background
    cardHover: overrides.cardHover ?? overrides.backgroundSecondary ?? background,
    // Default muted text: inherit from text (should be overridden for proper contrast)
    textMuted: overrides.textMuted ?? text,
    // Apply any additional overrides
    ...overrides,
  };
}

// ============================================================================
// Theme Definitions
// ============================================================================

/**
 * The two 5.0 themes on the confirmed 16A token sets (Modal Directions):
 * dark is #0B0B0C/#17171A with the #EA4133 accent, light is #F2F2F4/#FFFFFF
 * with the deeper #CE2222 accent (the suite red needs more pigment on white).
 */
const THEME_PALETTES: Record<ThemeName, ThemePalette> = {
  'standard-light': createThemePalette({
    primary: GLYPH_ACCENT_LIGHT,
    background: '#F2F2F4',
    text: '#17181B',
    isDark: false,
    overrides: {
      textHeader: '#FFFFFF',
      border: '#E4E4E7',
      backgroundSecondary: '#EBEBEE',
      cardBackground: '#FFFFFF',
      cardHover: '#E6E6EA',
      textMuted: '#63636A',
      // V4 properties
      bgGlass: 'rgba(255, 255, 255, 0.9)',
      textHeaderMuted: 'rgba(255, 255, 255, 0.7)',
      accentHover: '#B01C1C',
      accentRgb: '206, 34, 34',
      shadowSoft: '0 4px 6px rgba(0, 0, 0, 0.08)',
      shadowGlow: '0 0 10px rgba(206, 34, 34, 0.15)',
      gradientStart: '#F7F7F9',
      gradientEnd: '#F2F2F4',
      cardGradientEnd: '#FAFAFB',
    },
  }),
  'standard-dark': createThemePalette({
    primary: '#EA4133',
    background: '#0B0B0C',
    text: '#ECECEE',
    isDark: true,
    overrides: {
      textHeader: '#0A0A0A',
      border: 'rgba(255, 255, 255, 0.12)',
      backgroundSecondary: '#141416',
      cardBackground: '#17171A',
      cardHover: '#232327',
      textMuted: '#9C9CA2',
      // V4 properties
      bgGlass: 'rgba(23, 23, 26, 0.85)',
      textHeaderMuted: 'rgba(10, 10, 10, 0.7)',
      accentHover: '#FF6257',
      accentRgb: '234, 65, 51',
      shadowSoft: '0 4px 6px rgba(0, 0, 0, 0.4)',
      shadowGlow: '0 0 10px rgba(234, 65, 51, 0.25)',
      gradientStart: '#141416',
      gradientEnd: '#0B0B0C',
      cardGradientEnd: '#131316',
    },
  }),
};

/**
 * Map a pre-5.0 stored theme name onto Light or Dark by its family.
 * Every retired light theme lands on standard-light, everything else dark.
 */
function migrateLegacyThemeName(name: string): ThemeName {
  const wasLight = name.endsWith('-light') || name === 'cotton-candy' || name === 'parchment-light';
  return wasLight ? 'standard-light' : 'standard-dark';
}

// ============================================================================
// Theme Service Class
// ============================================================================

/**
 * Service for managing theme system
 * Handles loading, saving, and applying themes
 */
export class ThemeService {
  private static currentTheme: ThemeName = DEFAULT_THEME;
  private static listeners: Set<(theme: ThemeName) => void> = new Set();
  // WEB-BUG-003: Track initialization to prevent double initialization
  private static isInitialized: boolean = false;

  /**
   * Initialize theme service
   * WEB-BUG-003: Protected against double initialization
   */
  static initialize(): void {
    if (this.isInitialized) {
      logger.debug('Theme service already initialized, skipping');
      return;
    }

    const saved = appStorage.getItem<string>(STORAGE_KEYS.THEME);
    if (saved && this.isValidThemeName(saved)) {
      this.currentTheme = saved;
    } else if (saved) {
      // Pre-5.0 stored theme (premium-dark, hydaelyn-light, ...) — migrate
      // to its Light/Dark family member and persist the migrated value
      this.currentTheme = migrateLegacyThemeName(saved);
      appStorage.setItem(STORAGE_KEYS.THEME, this.currentTheme);
      logger.info(`Migrated legacy theme "${saved}" → ${this.currentTheme}`);
    } else {
      this.currentTheme = DEFAULT_THEME;
    }

    this.applyTheme(this.currentTheme);
    this.isInitialized = true;
    logger.info(`✅ Theme service initialized: ${this.currentTheme}`);
  }

  /**
   * Get the current theme
   */
  static getCurrentTheme(): ThemeName {
    return this.currentTheme;
  }

  /**
   * Get theme object with palette
   */
  static getTheme(name: ThemeName): Theme {
    if (!this.isValidThemeName(name)) {
      throw new AppError(ErrorCode.INVALID_THEME, `Invalid theme name: ${name}`, 'error');
    }

    const isDark = name.endsWith('-dark');
    return {
      name,
      palette: THEME_PALETTES[name],
      isDark,
    };
  }

  /**
   * Get all available themes
   */
  static getAllThemes(): Theme[] {
    return THEME_NAMES.map((name) => this.getTheme(name));
  }

  /**
   * Set the current theme
   */
  static setTheme(themeName: ThemeName): void {
    if (!this.isValidThemeName(themeName)) {
      throw new AppError(ErrorCode.INVALID_THEME, `Invalid theme name: ${themeName}`, 'error');
    }

    this.currentTheme = themeName;
    this.applyTheme(themeName);
    appStorage.setItem(STORAGE_KEYS.THEME, themeName);

    // Notify listeners
    this.listeners.forEach((listener) => listener(themeName));

    logger.info(`✅ Theme changed to: ${themeName}`);
  }

  /**
   * The other variant of the current theme (light ↔ dark), or null when the
   * current theme has none. Pure — nothing is applied.
   */
  static toggledVariant(): ThemeName | null {
    const isCurrentlyDark = this.currentTheme.endsWith('-dark');
    const baseName = this.currentTheme.replace(/-dark$|(-light)$/, '');
    const newTheme = (isCurrentlyDark ? `${baseName}-light` : `${baseName}-dark`) as ThemeName;
    return this.isValidThemeName(newTheme) ? newTheme : null;
  }

  /**
   * Apply theme to document
   * V4: Extended to set v4 CSS custom properties for glassmorphism, shadows, and gradients
   */
  private static applyTheme(themeName: ThemeName): void {
    const theme = this.getTheme(themeName);
    const root = document.documentElement;

    // Remove all theme classes
    THEME_NAMES.forEach((name) => {
      root.classList.remove(`theme-${name}`);
    });

    // Add current theme class
    root.classList.add(`theme-${themeName}`);

    // Set CSS custom properties
    const palette = theme.palette;
    const style = root.style;

    // ===== V3 Core Variables =====
    style.setProperty('--theme-primary', palette.primary);
    // Glyph accent chips follow the theme (#EA4133 dark / #CE2222 light);
    // the SVG package bakes the dark literal for raster targets, the web
    // shims swap it for this property (shared/glyph-accent.ts).
    style.setProperty('--glyph-accent', palette.primary);
    style.setProperty('--theme-background', palette.background);
    style.setProperty('--theme-text', palette.text);
    style.setProperty('--theme-text-header', palette.textHeader);
    style.setProperty('--theme-border', palette.border);
    style.setProperty('--theme-background-secondary', palette.backgroundSecondary);
    style.setProperty('--theme-card-background', palette.cardBackground);
    style.setProperty('--theme-card-hover', palette.cardHover);
    style.setProperty('--theme-text-muted', palette.textMuted);

    // ===== V4 Extended Variables (set only if defined) =====

    // Glassmorphism
    if (palette.bgGlass) {
      style.setProperty('--v4-glass-bg', palette.bgGlass);
    }
    if (palette.disableBlur) {
      style.setProperty('--v4-glass-blur', 'none');
    } else {
      style.setProperty('--v4-glass-blur', 'blur(12px)');
    }

    // Text variants
    if (palette.textHeaderMuted) {
      style.setProperty('--v4-text-header-muted', palette.textHeaderMuted);
    }

    // Accent colors
    if (palette.accentHover) {
      style.setProperty('--v4-accent-hover', palette.accentHover);
    }
    if (palette.accentRgb) {
      style.setProperty('--v4-accent-rgb', palette.accentRgb);
    }

    // Shadows
    if (palette.shadowSoft) {
      style.setProperty('--v4-shadow-soft', palette.shadowSoft);
    }
    if (palette.shadowGlow) {
      style.setProperty('--v4-shadow-glow', palette.shadowGlow);
    }

    // Gradients
    if (palette.gradientStart) {
      style.setProperty('--v4-gradient-start', palette.gradientStart);
    }
    if (palette.gradientEnd) {
      style.setProperty('--v4-gradient-end', palette.gradientEnd);
    }
    if (palette.cardGradientEnd) {
      style.setProperty('--v4-card-gradient-end', palette.cardGradientEnd);
    }
  }

  /**
   * Check if a theme name is valid
   */
  private static isValidThemeName(name: unknown): name is ThemeName {
    return typeof name === 'string' && THEME_NAMES.includes(name as ThemeName);
  }

  /**
   * Get a required color from current theme palette (v3 core properties only)
   * Use this for guaranteed string returns on core theme properties
   */
  static getRequiredColor(
    key:
      | 'primary'
      | 'background'
      | 'text'
      | 'textHeader'
      | 'border'
      | 'backgroundSecondary'
      | 'cardBackground'
      | 'cardHover'
      | 'textMuted'
  ): string {
    const palette = THEME_PALETTES[this.currentTheme];
    return palette[key];
  }

  /**
   * Check if current theme is dark
   */
  static isDarkMode(): boolean {
    return this.currentTheme.endsWith('-dark');
  }

  /**
   * Subscribe to theme changes
   */
  static subscribe(listener: (theme: ThemeName) => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Restore the default theme.
   *
   * Test-isolation hook: `beforeEach` calls it so a suite that switches themes
   * cannot leak into the next. Kept for that reason rather than pruned as
   * test-only (2026-09-01 dead-code audit, DEAD-005).
   *
   * @testonly `beforeEach` isolation — a theme switch must not leak between
   * suites.
   */
  static resetToDefault(): void {
    this.setTheme(DEFAULT_THEME);
  }

  /**
   * Reset initialization state (for testing only)
   * Allows testing initialize() behavior with different storage states
   * @internal
   *
   * @testonly `beforeEach` isolation — clears the `isInitialized` guard so a
   * suite can re-exercise `initialize()` (including legacy-theme migration)
   * against a fresh storage state without a prior test's init leaking in.
   */
  static __resetForTesting(): void {
    this.isInitialized = false;
  }
}

/**
 * Initialize theme service on module load
 */
if (typeof document !== 'undefined') {
  // Defer initialization to after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ThemeService.initialize();
    });
  } else {
    ThemeService.initialize();
  }
}
