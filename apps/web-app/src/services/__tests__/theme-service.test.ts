/**
 * XIV Dye Tools - Theme Service Integration Tests
 *
 * 5.0: the theme system is Light and Dark only (fixed decision), on the
 * confirmed 16A palettes. Legacy stored names migrate on initialize().
 */

import type { ThemeName } from '@shared/types';
import { ThemeService } from '../theme-service';
import { StorageService } from '../storage-service';

// appStorage uses a double prefix (xivdyetools_xivdyetools_theme)
const THEME_STORAGE_KEY = 'xivdyetools_xivdyetools_theme';

describe('ThemeService Integration', () => {
  beforeEach(() => {
    // Clear storage before each test
    if (StorageService.isAvailable()) {
      StorageService.clear();
    }
    // Reset theme to default
    ThemeService.resetToDefault();
  });

  afterEach(() => {
    if (StorageService.isAvailable()) {
      StorageService.clear();
    }
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize with default theme', () => {
      const theme = ThemeService.getCurrentTheme();
      expect(theme).toBeDefined();
      expect(typeof theme).toBe('string');
    });

    it('should load saved theme from storage', () => {
      ThemeService.setTheme('standard-dark');
      const current = ThemeService.getCurrentTheme();
      expect(current).toBe('standard-dark');
    });
  });

  // ============================================================================
  // Theme Selection Tests
  // ============================================================================

  describe('Theme Selection', () => {
    it('should support exactly the two 5.0 themes', () => {
      const themes = ThemeService.getAllThemes();
      expect(themes.length).toBe(2);
      expect(themes.map((t) => t.name)).toEqual(['standard-light', 'standard-dark']);
    });

    it('should switch between light and dark themes', () => {
      ThemeService.setTheme('standard-light');
      expect(ThemeService.getCurrentTheme()).toBe('standard-light');

      ThemeService.setTheme('standard-dark');
      expect(ThemeService.getCurrentTheme()).toBe('standard-dark');
    });

    it('should validate theme names', () => {
      expect(() => {
        ThemeService.setTheme('invalid-theme' as ThemeName);
      }).toThrow();
    });

    it('should reject retired 4.x theme names', () => {
      expect(() => {
        ThemeService.setTheme('premium-dark' as ThemeName);
      }).toThrow();
      expect(() => {
        ThemeService.setTheme('sugar-riot' as ThemeName);
      }).toThrow();
    });
  });

  // ============================================================================
  // Theme Variants Tests
  // ============================================================================

  describe('Theme Variants', () => {
    it('should identify dark mode correctly', () => {
      ThemeService.setTheme('standard-light');
      expect(ThemeService.isDarkMode()).toBe(false);

      ThemeService.setTheme('standard-dark');
      expect(ThemeService.isDarkMode()).toBe(true);
    });
  });

  // ============================================================================
  // Palette and Colors Tests
  // ============================================================================

  describe('Theme Palettes and Colors', () => {
    it('should have valid color values in all palettes', () => {
      // Palettes can include hex, rgba, and other CSS color formats
      const colorPattern = /^(#[0-9A-Fa-f]{6}|rgba?\([^)]+\)|none|[a-z]+)$/i;
      const themes = ThemeService.getAllThemes();

      themes.forEach((theme) => {
        Object.entries(theme.palette).forEach(([key, value]) => {
          // Skip boolean properties like disableBlur
          if (typeof value === 'boolean') return;
          // Skip shadow/gradient properties which have complex values
          if (key.includes('shadow') || key.includes('gradient') || key === 'accentRgb') return;
          expect(value).toMatch(colorPattern);
        });
      });
    });
  });

  // ============================================================================
  // Persistence Tests
  // ============================================================================

  describe('Theme Persistence', () => {
    it('should persist theme selection in storage', () => {
      if (!StorageService.isAvailable()) {
        expect(true).toBe(true);
        return;
      }

      StorageService.clear();

      ThemeService.setTheme('standard-light');
      const saved = StorageService.getItem(THEME_STORAGE_KEY);
      expect(saved).toBe('standard-light');
    });

    it('should maintain theme selection across calls', () => {
      if (!StorageService.isAvailable()) {
        expect(true).toBe(true);
        return;
      }

      StorageService.clear();

      ThemeService.setTheme('standard-dark');
      const current = ThemeService.getCurrentTheme();
      expect(current).toBe('standard-dark');
    });

    it('should fall back to default if storage is empty', () => {
      if (!StorageService.isAvailable()) {
        expect(true).toBe(true);
        return;
      }

      StorageService.clear();
      ThemeService.__resetForTesting();
      ThemeService.initialize();

      expect(ThemeService.getCurrentTheme()).toBe('standard-dark');
    });
  });

  // ============================================================================
  // Legacy Theme Migration (5.0 reduction)
  // ============================================================================

  describe('Legacy Theme Migration', () => {
    const migrationCases: Array<[string, ThemeName]> = [
      ['premium-dark', 'standard-dark'],
      ['hydaelyn-light', 'standard-light'],
      ['og-classic-dark', 'standard-dark'],
      ['parchment-light', 'standard-light'],
      ['cotton-candy', 'standard-light'],
      ['sugar-riot', 'standard-dark'],
      ['grayscale-light', 'standard-light'],
      ['grayscale-dark', 'standard-dark'],
      ['high-contrast-light', 'standard-light'],
      ['high-contrast-dark', 'standard-dark'],
    ];

    migrationCases.forEach(([legacy, expected]) => {
      it(`should migrate stored "${legacy}" to ${expected}`, () => {
        if (!StorageService.isAvailable()) {
          expect(true).toBe(true);
          return;
        }

        StorageService.clear();
        StorageService.setItem(THEME_STORAGE_KEY, legacy);
        ThemeService.__resetForTesting();
        ThemeService.initialize();

        expect(ThemeService.getCurrentTheme()).toBe(expected);
        // The migrated value is written back so the mapping runs once
        expect(StorageService.getItem(THEME_STORAGE_KEY)).toBe(expected);
      });
    });
  });

  // ============================================================================
  // Subscription/Observer Tests
  // ============================================================================

  describe('Theme Change Subscriptions', () => {
    it('should notify subscribers when theme changes', () => {
      let notifiedTheme: string | null = null;

      const unsubscribe = ThemeService.subscribe((theme) => {
        notifiedTheme = theme;
      });

      ThemeService.setTheme('standard-light');
      expect(notifiedTheme).toBe('standard-light');

      unsubscribe();
    });

    it('should allow multiple subscribers', () => {
      const themes1: string[] = [];
      const themes2: string[] = [];

      const unsub1 = ThemeService.subscribe((t) => themes1.push(t));
      const unsub2 = ThemeService.subscribe((t) => themes2.push(t));

      ThemeService.setTheme('standard-light');

      expect(themes1.length).toBeGreaterThan(0);
      expect(themes2.length).toBeGreaterThan(0);

      unsub1();
      unsub2();
    });

    it('should unsubscribe properly', () => {
      let callCount = 0;

      const unsubscribe = ThemeService.subscribe(() => {
        callCount++;
      });

      ThemeService.setTheme('standard-light');
      const firstCount = callCount;

      unsubscribe();
      ThemeService.setTheme('standard-dark');

      expect(callCount).toBe(firstCount);
    });
  });

  // ============================================================================
  // DOM Integration Tests
  // ============================================================================

  describe('DOM Integration', () => {
    it('should apply theme class to document element', () => {
      if (typeof document === 'undefined') {
        expect(true).toBe(true);
        return;
      }

      ThemeService.setTheme('standard-light');
      const root = document.documentElement;

      expect(root.classList.contains('theme-standard-light')).toBe(true);
    });

    it('should set CSS custom properties', () => {
      if (typeof document === 'undefined') {
        expect(true).toBe(true);
        return;
      }

      ThemeService.setTheme('standard-dark');
      const root = document.documentElement;

      const primaryColor = root.style.getPropertyValue('--theme-primary');
      expect(primaryColor.length).toBeGreaterThan(0);
    });

    it('should remove old theme classes when switching', () => {
      if (typeof document === 'undefined') {
        expect(true).toBe(true);
        return;
      }

      ThemeService.setTheme('standard-light');
      const root = document.documentElement;

      ThemeService.setTheme('standard-dark');

      expect(root.classList.contains('theme-standard-light')).toBe(false);
      expect(root.classList.contains('theme-standard-dark')).toBe(true);
    });
  });
});
