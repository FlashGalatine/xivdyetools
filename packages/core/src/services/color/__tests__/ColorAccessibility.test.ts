import { describe, it, expect } from 'vitest';
import { ColorAccessibility } from '../ColorAccessibility.js';

describe('ColorAccessibility', () => {
  describe('getPerceivedLuminance', () => {
    it('should return 0 for black', () => {
      const luminance = ColorAccessibility.getPerceivedLuminance('#000000');
      expect(luminance).toBe(0);
    });

    it('should return 1 for white', () => {
      const luminance = ColorAccessibility.getPerceivedLuminance('#FFFFFF');
      expect(luminance).toBe(1);
    });

    it('should return value between 0 and 1 for colors', () => {
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

      colors.forEach((color) => {
        const luminance = ColorAccessibility.getPerceivedLuminance(color);
        expect(luminance).toBeGreaterThanOrEqual(0);
        expect(luminance).toBeLessThanOrEqual(1);
      });
    });

    it('should calculate correct luminance for pure red', () => {
      const luminance = ColorAccessibility.getPerceivedLuminance('#FF0000');
      // Red has low luminance due to WCAG formula weighting
      expect(luminance).toBeLessThan(0.5);
    });

    it('should calculate correct luminance for pure green', () => {
      const luminance = ColorAccessibility.getPerceivedLuminance('#00FF00');
      // Green has high luminance due to WCAG formula weighting
      expect(luminance).toBeGreaterThan(0.5);
    });

    it('should calculate correct luminance for pure blue', () => {
      const luminance = ColorAccessibility.getPerceivedLuminance('#0000FF');
      // Blue has low luminance
      expect(luminance).toBeLessThan(0.5);
    });

    it('should handle mid-tone gray', () => {
      const luminance = ColorAccessibility.getPerceivedLuminance('#808080');
      expect(luminance).toBeGreaterThan(0);
      expect(luminance).toBeLessThan(1);
    });
  });

  describe('getContrastRatio', () => {
    it('should return 1 for identical colors', () => {
      const ratio = ColorAccessibility.getContrastRatio('#FF0000', '#FF0000');
      expect(ratio).toBe(1);
    });

    it('should return 21 for black and white', () => {
      const ratio = ColorAccessibility.getContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeCloseTo(21, 1);
    });

    it('should return 21 for white and black (order independent)', () => {
      const ratio = ColorAccessibility.getContrastRatio('#FFFFFF', '#000000');
      expect(ratio).toBeCloseTo(21, 1);
    });

    it('should return value between 1 and 21', () => {
      const ratio = ColorAccessibility.getContrastRatio('#FF0000', '#00FF00');
      expect(ratio).toBeGreaterThanOrEqual(1);
      expect(ratio).toBeLessThanOrEqual(21);
    });

    it('should calculate consistent ratios regardless of order', () => {
      const ratio1 = ColorAccessibility.getContrastRatio('#FF0000', '#0000FF');
      const ratio2 = ColorAccessibility.getContrastRatio('#0000FF', '#FF0000');
      expect(ratio1).toBeCloseTo(ratio2, 5);
    });

    it('should have higher ratio for more contrasting colors', () => {
      const lowContrast = ColorAccessibility.getContrastRatio('#FF0000', '#FF6666');
      const highContrast = ColorAccessibility.getContrastRatio('#FF0000', '#00FFFF');

      expect(highContrast).toBeGreaterThan(lowContrast);
    });
  });

  describe('meetsWCAGAA', () => {
    it('should pass black on white for small text', () => {
      const passes = ColorAccessibility.meetsWCAGAA('#000000', '#FFFFFF', false);
      expect(passes).toBe(true);
    });

    it('should pass white on black for small text', () => {
      const passes = ColorAccessibility.meetsWCAGAA('#FFFFFF', '#000000', false);
      expect(passes).toBe(true);
    });

    it('should pass black on white for large text', () => {
      const passes = ColorAccessibility.meetsWCAGAA('#000000', '#FFFFFF', true);
      expect(passes).toBe(true);
    });

    it('should fail low contrast combinations for small text', () => {
      const passes = ColorAccessibility.meetsWCAGAA('#CCCCCC', '#FFFFFF', false);
      expect(passes).toBe(false);
    });

    it('should have different thresholds for small vs large text', () => {
      // A color pair with moderate contrast (between 3:1 and 4.5:1)
      const color1 = '#767676';
      const color2 = '#FFFFFF';

      const smallText = ColorAccessibility.meetsWCAGAA(color1, color2, false);
      const largeText = ColorAccessibility.meetsWCAGAA(color1, color2, true);

      // This specific combination should pass large text (3:1) but may fail small text (4.5:1)
      // We're testing that the threshold is different
      if (!smallText) {
        expect(largeText).toBe(true);
      }
    });

    it('should use 4.5:1 ratio for small text by default', () => {
      // Testing with a known color pair that has ~4.5:1 ratio
      const color1 = '#767676';
      const color2 = '#FFFFFF';
      const ratio = ColorAccessibility.getContrastRatio(color1, color2);
      const passes = ColorAccessibility.meetsWCAGAA(color1, color2);

      if (ratio >= 4.5) {
        expect(passes).toBe(true);
      } else {
        expect(passes).toBe(false);
      }
    });
  });

  describe('meetsWCAGAAA', () => {
    it('should pass black on white for small text', () => {
      const passes = ColorAccessibility.meetsWCAGAAA('#000000', '#FFFFFF', false);
      expect(passes).toBe(true);
    });

    it('should pass white on black for small text', () => {
      const passes = ColorAccessibility.meetsWCAGAAA('#FFFFFF', '#000000', false);
      expect(passes).toBe(true);
    });

    it('should have stricter requirements than AA', () => {
      const color1 = '#595959';
      const color2 = '#FFFFFF';

      const aaPass = ColorAccessibility.meetsWCAGAA(color1, color2, false);
      const aaaPass = ColorAccessibility.meetsWCAGAAA(color1, color2, false);

      // AAA is stricter, so if it passes AAA, it should pass AA
      if (aaaPass) {
        expect(aaPass).toBe(true);
      }
    });

    it('should use 7:1 ratio for small text', () => {
      const color1 = '#595959';
      const color2 = '#FFFFFF';
      const ratio = ColorAccessibility.getContrastRatio(color1, color2);
      const passes = ColorAccessibility.meetsWCAGAAA(color1, color2, false);

      if (ratio >= 7) {
        expect(passes).toBe(true);
      } else {
        expect(passes).toBe(false);
      }
    });

    it('should use 4.5:1 ratio for large text', () => {
      const color1 = '#767676';
      const color2 = '#FFFFFF';
      const ratio = ColorAccessibility.getContrastRatio(color1, color2);
      const passes = ColorAccessibility.meetsWCAGAAA(color1, color2, true);

      if (ratio >= 4.5) {
        expect(passes).toBe(true);
      } else {
        expect(passes).toBe(false);
      }
    });
  });

  describe('isLightColor', () => {
    it('should return true for white', () => {
      expect(ColorAccessibility.isLightColor('#FFFFFF')).toBe(true);
    });

    it('should return false for black', () => {
      expect(ColorAccessibility.isLightColor('#000000')).toBe(false);
    });

    it('should return true for light colors', () => {
      const lightColors = ['#FFFF00', '#00FFFF', '#00FF00', '#CCCCCC', '#EEEEEE'];

      lightColors.forEach((color) => {
        expect(ColorAccessibility.isLightColor(color)).toBe(true);
      });
    });

    it('should return false for dark colors', () => {
      const darkColors = ['#FF0000', '#0000FF', '#000080', '#333333', '#666666'];

      darkColors.forEach((color) => {
        expect(ColorAccessibility.isLightColor(color)).toBe(false);
      });
    });

    it('should use 0.5 luminance as threshold', () => {
      // Test a color close to the threshold
      const borderlineColor = '#808080';
      const luminance = ColorAccessibility.getPerceivedLuminance(borderlineColor);
      const isLight = ColorAccessibility.isLightColor(borderlineColor);

      if (luminance > 0.5) {
        expect(isLight).toBe(true);
      } else {
        expect(isLight).toBe(false);
      }
    });
  });

  describe('getOptimalTextColor', () => {
    it('should return black for white background', () => {
      const textColor = ColorAccessibility.getOptimalTextColor('#FFFFFF');
      expect(textColor).toBe('#000000');
    });

    it('should return white for black background', () => {
      const textColor = ColorAccessibility.getOptimalTextColor('#000000');
      expect(textColor).toBe('#FFFFFF');
    });

    it('should return black for light backgrounds', () => {
      const lightBackgrounds = ['#FFFF00', '#00FFFF', '#00FF00', '#EEEEEE'];

      lightBackgrounds.forEach((bg) => {
        const textColor = ColorAccessibility.getOptimalTextColor(bg);
        expect(textColor).toBe('#000000');
      });
    });

    it('should return white for dark backgrounds', () => {
      const darkBackgrounds = ['#FF0000', '#0000FF', '#000080', '#333333'];

      darkBackgrounds.forEach((bg) => {
        const textColor = ColorAccessibility.getOptimalTextColor(bg);
        expect(textColor).toBe('#FFFFFF');
      });
    });

    it('should return a valid hex color', () => {
      const textColor = ColorAccessibility.getOptimalTextColor('#667788');
      expect(textColor).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should ensure good contrast with background', () => {
      const background = '#FF6B6B';
      const textColor = ColorAccessibility.getOptimalTextColor(background);
      const ratio = ColorAccessibility.getContrastRatio(background, textColor);

      // Should have decent contrast (at least 2.5:1 for some visibility)
      expect(ratio).toBeGreaterThanOrEqual(2.5);
    });
  });

  describe('WCAG compliance integration', () => {
    it('should ensure optimal text color meets AA for large text', () => {
      const backgrounds = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];

      backgrounds.forEach((bg) => {
        const textColor = ColorAccessibility.getOptimalTextColor(bg);
        const meetsAA = ColorAccessibility.meetsWCAGAA(bg, textColor, true);
        expect(meetsAA).toBe(true);
      });
    });

    it('should work with real-world colors', () => {
      // Wine Red from FFXIV
      const wineRed = '#4D1818';
      const textColor = ColorAccessibility.getOptimalTextColor(wineRed);
      expect(textColor).toBe('#FFFFFF');

      // Snow White from FFXIV
      const snowWhite = '#FFFFFF';
      const textColor2 = ColorAccessibility.getOptimalTextColor(snowWhite);
      expect(textColor2).toBe('#000000');
    });
  });

  describe('edge cases', () => {
    it('should handle 3-digit hex colors', () => {
      const luminance = ColorAccessibility.getPerceivedLuminance('#FFF');
      expect(luminance).toBe(1);
    });

    it('should handle lowercase hex colors', () => {
      const luminance = ColorAccessibility.getPerceivedLuminance('#ffffff');
      expect(luminance).toBe(1);
    });

    it('should handle mixed case hex colors', () => {
      const luminance = ColorAccessibility.getPerceivedLuminance('#FfFfFf');
      expect(luminance).toBe(1);
    });
  });
});
