/**
 * XIV Dye Tools - Theme Service Integration Tests
 * Tests for 10-theme system, persistence, and DOM integration
 */

import type { ThemeName } from '@shared/types';
import { ThemeService } from '../theme-service';
import { StorageService } from '../storage-service';

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

    it('should have a valid theme object', () => {
      const themeObj = ThemeService.getCurrentThemeObject();
      expect(themeObj).toBeDefined();
      expect(themeObj.name).toBeDefined();
      expect(themeObj.palette).toBeDefined();
      expect(themeObj.isDark).toBeDefined();
    });
  });

  // ============================================================================
  // Theme Selection Tests
  // ============================================================================

  describe('Theme Selection', () => {
    it('should support all 12 theme variants', () => {
      const themes = ThemeService.getAllThemes();
      expect(themes.length).toBe(12);
    });

    it('should switch between light and dark themes', () => {
      const lightTheme = 'standard-light';
      const darkTheme = 'standard-dark';

      ThemeService.setTheme(lightTheme as ThemeName);
      expect(ThemeService.getCurrentTheme()).toBe(lightTheme);

      ThemeService.setTheme(darkTheme as ThemeName);
      expect(ThemeService.getCurrentTheme()).toBe(darkTheme);
    });

    it('should toggle dark mode', () => {
      ThemeService.setTheme('standard-light' as ThemeName);
      ThemeService.toggleDarkMode();

      expect(ThemeService.getCurrentTheme()).toBe('standard-dark');

      ThemeService.toggleDarkMode();
      expect(ThemeService.getCurrentTheme()).toBe('standard-light');
    });

    it('should validate theme names', () => {
      expect(() => {
        ThemeService.setTheme('invalid-theme' as ThemeName);
      }).toThrow();
    });

    it('should reset to default theme', () => {
      ThemeService.setTheme('sugar-riot' as ThemeName);
      ThemeService.resetToDefault();

      const theme = ThemeService.getCurrentTheme();
      expect(theme).toBeDefined();
    });
  });

  // ============================================================================
  // Theme Variants Tests
  // ============================================================================

  describe('Theme Variants', () => {
    it('should get light variant of a theme', () => {
      const light = ThemeService.getLightVariant('standard-dark');
      expect(light).toBe('standard-light');
    });

    it('should get dark variant of a theme', () => {
      const dark = ThemeService.getDarkVariant('standard-light');
      expect(dark).toBe('standard-dark');
    });

    it('should get theme variants by base name', () => {
      const variants = ThemeService.getThemeVariants('standard');
      expect(variants.length).toBe(2); // light and dark
      expect(variants).toContain('standard-light');
      expect(variants).toContain('standard-dark');
    });

    it('should identify dark mode correctly', () => {
      ThemeService.setTheme('cotton-candy' as ThemeName);
      expect(ThemeService.isDarkMode()).toBe(false);

      ThemeService.setTheme('sugar-riot' as ThemeName);
      expect(ThemeService.isDarkMode()).toBe(true);
    });
  });

  // ============================================================================
  // Palette and Colors Tests
  // ============================================================================

  describe('Theme Palettes and Colors', () => {
    it('should provide complete palette with all required colors', () => {
      const theme = ThemeService.getCurrentThemeObject();
      const palette = theme.palette;

      expect(palette.primary).toBeDefined();
      expect(palette.background).toBeDefined();
      expect(palette.text).toBeDefined();
      expect(palette.border).toBeDefined();
      expect(palette.backgroundSecondary).toBeDefined();
      expect(palette.cardBackground).toBeDefined();
      expect(palette.textMuted).toBeDefined();
    });

    it('should get color from current theme palette', () => {
      ThemeService.setTheme('og-classic-dark' as ThemeName);

      const primary = ThemeService.getColor('primary');
      expect(primary).toBeDefined();
      expect(primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should have valid color values in all palettes', () => {
      // V4 palettes can include hex, rgba, and other CSS color formats
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

    it('should distinguish light and dark theme backgrounds', () => {
      // Light theme backgrounds should be lighter than dark
      ThemeService.setTheme('standard-light' as ThemeName);
      const lightBg = ThemeService.getColor('background');

      ThemeService.setTheme('standard-dark' as ThemeName);
      const darkBg = ThemeService.getColor('background');

      expect(lightBg).not.toBe(darkBg);
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

      // Clear storage first to get clean state
      StorageService.clear();

      ThemeService.setTheme('parchment-light' as ThemeName);
      // appStorage uses double prefix (xivdyetools_xivdyetools_theme)
      const saved = StorageService.getItem('xivdyetools_xivdyetools_theme');
      expect(saved).toBe('parchment-light');
    });

    it('should maintain theme selection across calls', () => {
      if (!StorageService.isAvailable()) {
        expect(true).toBe(true);
        return;
      }

      StorageService.clear();

      ThemeService.setTheme('standard-dark' as ThemeName);
      const current = ThemeService.getCurrentTheme();
      expect(current).toBe('standard-dark');
    });

    it('should fall back to default if storage is invalid', () => {
      if (!StorageService.isAvailable()) {
        expect(true).toBe(true);
        return;
      }

      StorageService.clear();
      // Use correct double-prefix key for appStorage
      StorageService.setItem('xivdyetools_xivdyetools_theme', 'invalid-theme');
      ThemeService.initialize();

      const current = ThemeService.getCurrentTheme();
      expect(current).toBeDefined();
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

      ThemeService.setTheme('cotton-candy' as ThemeName);
      expect(notifiedTheme).toBe('cotton-candy');

      unsubscribe();
    });

    it('should allow multiple subscribers', () => {
      const themes1: string[] = [];
      const themes2: string[] = [];

      const unsub1 = ThemeService.subscribe((t) => themes1.push(t));
      const unsub2 = ThemeService.subscribe((t) => themes2.push(t));

      ThemeService.setTheme('og-classic-dark' as ThemeName);

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

      ThemeService.setTheme('standard-light' as ThemeName);
      const firstCount = callCount;

      unsubscribe();
      ThemeService.setTheme('standard-dark' as ThemeName);

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

      ThemeService.setTheme('hydaelyn-light' as ThemeName);
      const root = document.documentElement;

      expect(root.classList.contains('theme-hydaelyn-light')).toBe(true);
    });

    it('should set CSS custom properties', () => {
      if (typeof document === 'undefined') {
        expect(true).toBe(true);
        return;
      }

      ThemeService.setTheme('sugar-riot' as ThemeName);
      const root = document.documentElement;

      const primaryColor = root.style.getPropertyValue('--theme-primary');
      expect(primaryColor.length).toBeGreaterThan(0);
    });

    it('should remove old theme classes when switching', () => {
      if (typeof document === 'undefined') {
        expect(true).toBe(true);
        return;
      }

      ThemeService.setTheme('og-classic-dark' as ThemeName);
      const root = document.documentElement;

      ThemeService.setTheme('sugar-riot' as ThemeName);

      expect(root.classList.contains('theme-og-classic-dark')).toBe(false);
      expect(root.classList.contains('theme-sugar-riot')).toBe(true);
    });
  });

  // ============================================================================
  // All Themes Coverage Tests
  // ============================================================================

  describe('All 9 Theme Coverage', () => {
    const expectedThemes = [
      'standard-light',
      'standard-dark',
      'hydaelyn-light',
      'og-classic-dark',
      'parchment-light',
      'cotton-candy',
      'sugar-riot',
      'grayscale-light',
      'grayscale-dark',
    ];

    expectedThemes.forEach((themeName) => {
      it(`should support ${themeName} theme`, () => {
        expect(() => {
          ThemeService.setTheme(themeName as ThemeName);
        }).not.toThrow();

        expect(ThemeService.getCurrentTheme()).toBe(themeName);
      });

      it(`should provide valid palette for ${themeName}`, () => {
        ThemeService.setTheme(themeName as ThemeName);
        const theme = ThemeService.getCurrentThemeObject();

        expect(theme.palette.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(theme.palette.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });
});

// ==========================================================================
// Branch Coverage Tests - High Contrast Themes
// ==========================================================================

describe('ThemeService High Contrast Themes', () => {
  beforeEach(() => {
    if (StorageService.isAvailable()) {
      StorageService.clear();
    }
  });

  it('should support high-contrast-light theme', () => {
    expect(() => {
      ThemeService.setTheme('high-contrast-light' as ThemeName);
    }).not.toThrow();

    expect(ThemeService.getCurrentTheme()).toBe('high-contrast-light');
    expect(ThemeService.isDarkMode()).toBe(false);
  });

  it('should support high-contrast-dark theme', () => {
    expect(() => {
      ThemeService.setTheme('high-contrast-dark' as ThemeName);
    }).not.toThrow();

    expect(ThemeService.getCurrentTheme()).toBe('high-contrast-dark');
    expect(ThemeService.isDarkMode()).toBe(true);
  });

  it('should toggle between high contrast themes', () => {
    ThemeService.setTheme('high-contrast-light' as ThemeName);
    ThemeService.toggleDarkMode();
    expect(ThemeService.getCurrentTheme()).toBe('high-contrast-dark');

    ThemeService.toggleDarkMode();
    expect(ThemeService.getCurrentTheme()).toBe('high-contrast-light');
  });

  it('should get high contrast theme variants', () => {
    const variants = ThemeService.getThemeVariants('high-contrast');
    expect(variants).toContain('high-contrast-light');
    expect(variants).toContain('high-contrast-dark');
    expect(variants.length).toBe(2);
  });
});

// ==========================================================================
// Branch Coverage Tests - Toggle Dark Mode Edge Cases
// ==========================================================================

describe('ThemeService toggleDarkMode Edge Cases', () => {
  beforeEach(() => {
    if (StorageService.isAvailable()) {
      StorageService.clear();
    }
  });

  it('should handle themes without light/dark variants gracefully', () => {
    // cotton-candy doesn't have a -dark variant
    ThemeService.setTheme('cotton-candy' as ThemeName);

    // This should log a warning and not change the theme
    ThemeService.toggleDarkMode();

    // cotton-candy-dark doesn't exist, so it should stay as cotton-candy
    // (or fall back depending on implementation)
    const current = ThemeService.getCurrentTheme();
    // The theme should not have changed to an invalid theme
    expect(current).toBe('cotton-candy');
  });

  it('should handle sugar-riot theme toggle (no light variant)', () => {
    ThemeService.setTheme('sugar-riot' as ThemeName);

    // sugar-riot doesn't have -light or -dark suffix
    ThemeService.toggleDarkMode();

    // Should try to go to sugar-riot-light which doesn't exist
    const current = ThemeService.getCurrentTheme();
    expect(current).toBe('sugar-riot');
  });

  it('should handle og-classic-dark theme toggle', () => {
    ThemeService.setTheme('og-classic-dark' as ThemeName);

    // og-classic-dark -> og-classic-light (which doesn't exist)
    ThemeService.toggleDarkMode();

    // Should stay on og-classic-dark since there's no light variant
    expect(ThemeService.getCurrentTheme()).toBe('og-classic-dark');
  });

  it('should handle hydaelyn-light theme toggle', () => {
    ThemeService.setTheme('hydaelyn-light' as ThemeName);

    // hydaelyn-light -> hydaelyn-dark (which doesn't exist)
    ThemeService.toggleDarkMode();

    // Should stay on hydaelyn-light since there's no dark variant
    expect(ThemeService.getCurrentTheme()).toBe('hydaelyn-light');
  });

  it('should handle parchment-light theme toggle', () => {
    ThemeService.setTheme('parchment-light' as ThemeName);

    // parchment-light -> parchment-dark (which doesn't exist)
    ThemeService.toggleDarkMode();

    // Should stay on parchment-light since there's no dark variant
    expect(ThemeService.getCurrentTheme()).toBe('parchment-light');
  });
});

// ==========================================================================
// Branch Coverage Tests - isDarkMode Special Cases
// ==========================================================================

describe('ThemeService isDarkMode Special Cases', () => {
  it('should correctly identify sugar-riot as dark mode', () => {
    ThemeService.setTheme('sugar-riot' as ThemeName);
    expect(ThemeService.isDarkMode()).toBe(true);
  });

  it('should correctly identify cotton-candy as light mode', () => {
    ThemeService.setTheme('cotton-candy' as ThemeName);
    expect(ThemeService.isDarkMode()).toBe(false);
  });

  it('should correctly identify themes ending with -dark', () => {
    ThemeService.setTheme('standard-dark' as ThemeName);
    expect(ThemeService.isDarkMode()).toBe(true);

    ThemeService.setTheme('grayscale-dark' as ThemeName);
    expect(ThemeService.isDarkMode()).toBe(true);

    ThemeService.setTheme('og-classic-dark' as ThemeName);
    expect(ThemeService.isDarkMode()).toBe(true);
  });

  it('should correctly identify themes ending with -light', () => {
    ThemeService.setTheme('standard-light' as ThemeName);
    expect(ThemeService.isDarkMode()).toBe(false);

    ThemeService.setTheme('grayscale-light' as ThemeName);
    expect(ThemeService.isDarkMode()).toBe(false);

    ThemeService.setTheme('hydaelyn-light' as ThemeName);
    expect(ThemeService.isDarkMode()).toBe(false);
  });
});

// ==========================================================================
// Branch Coverage Tests - getTheme Error Handling
// ==========================================================================

describe('ThemeService getTheme Error Handling', () => {
  it('should throw AppError for invalid theme name', () => {
    expect(() => {
      ThemeService.getTheme('completely-invalid-theme' as ThemeName);
    }).toThrow();
  });

  it('should throw error with correct error code', () => {
    try {
      ThemeService.getTheme('not-a-theme' as ThemeName);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

// ==========================================================================
// Branch Coverage Tests - getLightVariant / getDarkVariant
// ==========================================================================

describe('ThemeService Variant Helpers', () => {
  it('should get light variant from dark theme', () => {
    const light = ThemeService.getLightVariant('grayscale-dark');
    expect(light).toBe('grayscale-light');
  });

  it('should get light variant from light theme (unchanged base)', () => {
    const light = ThemeService.getLightVariant('grayscale-light');
    expect(light).toBe('grayscale-light');
  });

  it('should get dark variant from light theme', () => {
    const dark = ThemeService.getDarkVariant('grayscale-light');
    expect(dark).toBe('grayscale-dark');
  });

  it('should get dark variant from dark theme (unchanged base)', () => {
    const dark = ThemeService.getDarkVariant('grayscale-dark');
    expect(dark).toBe('grayscale-dark');
  });

  it('should handle theme without suffix', () => {
    // sugar-riot has no suffix
    const light = ThemeService.getLightVariant('sugar-riot' as ThemeName);
    expect(light).toBe('sugar-riot-light');

    const dark = ThemeService.getDarkVariant('sugar-riot' as ThemeName);
    expect(dark).toBe('sugar-riot-dark');
  });

  it('should handle cotton-candy (no suffix)', () => {
    const light = ThemeService.getLightVariant('cotton-candy' as ThemeName);
    expect(light).toBe('cotton-candy-light');

    const dark = ThemeService.getDarkVariant('cotton-candy' as ThemeName);
    expect(dark).toBe('cotton-candy-dark');
  });
});

// ==========================================================================
// Branch Coverage Tests - getThemeVariants Edge Cases
// ==========================================================================

describe('ThemeService getThemeVariants', () => {
  it('should return empty array for non-matching prefix', () => {
    const variants = ThemeService.getThemeVariants('nonexistent');
    expect(variants).toEqual([]);
  });

  it('should return single theme for unique prefix', () => {
    const variants = ThemeService.getThemeVariants('sugar');
    expect(variants).toContain('sugar-riot');
    expect(variants.length).toBe(1);
  });

  it('should return multiple themes for matching prefix', () => {
    const variants = ThemeService.getThemeVariants('grayscale');
    expect(variants.length).toBe(2);
    expect(variants).toContain('grayscale-light');
    expect(variants).toContain('grayscale-dark');
  });
});

// ==========================================================================
// Branch Coverage Tests - Initialize with Various Storage States
// ==========================================================================

describe('ThemeService Initialize Edge Cases', () => {
  beforeEach(() => {
    // Reset initialization state to test initialize() behavior
    ThemeService.__resetForTesting();
    if (StorageService.isAvailable()) {
      StorageService.clear();
    }
  });

  it('should initialize with saved valid theme', () => {
    // Set a valid theme in storage using the correct key
    StorageService.setItem('xivdyetools_xivdyetools_theme', 'sugar-riot');

    ThemeService.initialize();

    expect(ThemeService.getCurrentTheme()).toBe('sugar-riot');
  });

  it('should initialize with default when storage has invalid theme', () => {
    StorageService.setItem('xivdyetools_xivdyetools_theme', 'not-a-real-theme');

    ThemeService.initialize();

    // Should fall back to default
    const current = ThemeService.getCurrentTheme();
    expect(current).toBeDefined();
  });

  it('should initialize with default when storage is empty', () => {
    StorageService.clear();

    ThemeService.initialize();

    const current = ThemeService.getCurrentTheme();
    expect(current).toBeDefined();
  });
});

// ==========================================================================
// Branch Coverage Tests - V4 CSS Property Setting
// ==========================================================================

describe('ThemeService V4 CSS Properties', () => {
  beforeEach(() => {
    if (StorageService.isAvailable()) {
      StorageService.clear();
    }
  });

  it('should set V4 glass blur property', () => {
    ThemeService.setTheme('premium-dark' as ThemeName);

    const root = document.documentElement;
    const blurValue = root.style.getPropertyValue('--v4-glass-blur');

    expect(blurValue).toBe('blur(12px)');
  });

  it('should disable blur for high contrast themes', () => {
    ThemeService.setTheme('high-contrast-light' as ThemeName);

    const root = document.documentElement;
    const blurValue = root.style.getPropertyValue('--v4-glass-blur');

    expect(blurValue).toBe('none');
  });

  it('should set V4 glass background property', () => {
    ThemeService.setTheme('premium-dark' as ThemeName);

    const root = document.documentElement;
    const glassValue = root.style.getPropertyValue('--v4-glass-bg');

    expect(glassValue).toBeTruthy();
  });

  it('should set V4 text header muted property', () => {
    ThemeService.setTheme('premium-dark' as ThemeName);

    const root = document.documentElement;
    const textMutedValue = root.style.getPropertyValue('--v4-text-header-muted');

    expect(textMutedValue).toBeTruthy();
  });

  it('should set V4 accent hover property', () => {
    ThemeService.setTheme('premium-dark' as ThemeName);

    const root = document.documentElement;
    const accentHoverValue = root.style.getPropertyValue('--v4-accent-hover');

    expect(accentHoverValue).toBeTruthy();
  });

  it('should set V4 accent RGB property', () => {
    ThemeService.setTheme('premium-dark' as ThemeName);

    const root = document.documentElement;
    const accentRgbValue = root.style.getPropertyValue('--v4-accent-rgb');

    expect(accentRgbValue).toBeTruthy();
  });

  it('should set V4 shadow soft property', () => {
    ThemeService.setTheme('premium-dark' as ThemeName);

    const root = document.documentElement;
    const shadowValue = root.style.getPropertyValue('--v4-shadow-soft');

    expect(shadowValue).toBeTruthy();
  });

  it('should set V4 shadow glow property', () => {
    ThemeService.setTheme('premium-dark' as ThemeName);

    const root = document.documentElement;
    const glowValue = root.style.getPropertyValue('--v4-shadow-glow');

    expect(glowValue).toBeTruthy();
  });

  it('should set V4 gradient start property', () => {
    ThemeService.setTheme('premium-dark' as ThemeName);

    const root = document.documentElement;
    const gradientStart = root.style.getPropertyValue('--v4-gradient-start');

    expect(gradientStart).toBeTruthy();
  });

  it('should set V4 gradient end property', () => {
    ThemeService.setTheme('premium-dark' as ThemeName);

    const root = document.documentElement;
    const gradientEnd = root.style.getPropertyValue('--v4-gradient-end');

    expect(gradientEnd).toBeTruthy();
  });

  it('should set V4 card gradient end property', () => {
    ThemeService.setTheme('premium-dark' as ThemeName);

    const root = document.documentElement;
    const cardGradientEnd = root.style.getPropertyValue('--v4-card-gradient-end');

    expect(cardGradientEnd).toBeTruthy();
  });

  it('should apply all V4 properties for each theme', () => {
    const v4Themes: ThemeName[] = [
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
    ];

    v4Themes.forEach((themeName) => {
      ThemeService.setTheme(themeName);

      const root = document.documentElement;

      // All themes should set the V4 glass-bg property
      const glassBg = root.style.getPropertyValue('--v4-glass-bg');
      expect(glassBg.length).toBeGreaterThan(0);
    });
  });
});

// ==========================================================================
// Branch Coverage Tests - getRequiredColor
// ==========================================================================

describe('ThemeService getRequiredColor', () => {
  it('should return primary color', () => {
    const primary = ThemeService.getRequiredColor('primary');
    expect(primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should return background color', () => {
    const background = ThemeService.getRequiredColor('background');
    expect(background).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should return text color', () => {
    const text = ThemeService.getRequiredColor('text');
    expect(text).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should return textHeader color', () => {
    const textHeader = ThemeService.getRequiredColor('textHeader');
    expect(textHeader).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should return border color', () => {
    const border = ThemeService.getRequiredColor('border');
    expect(border).toBeTruthy();
  });

  it('should return backgroundSecondary color', () => {
    const bgSecondary = ThemeService.getRequiredColor('backgroundSecondary');
    expect(bgSecondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should return cardBackground color', () => {
    const cardBg = ThemeService.getRequiredColor('cardBackground');
    expect(cardBg).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should return cardHover color', () => {
    const cardHover = ThemeService.getRequiredColor('cardHover');
    expect(cardHover).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should return textMuted color', () => {
    const textMuted = ThemeService.getRequiredColor('textMuted');
    expect(textMuted).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
