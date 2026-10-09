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
      // BUG-032 (2026-09-16 audit): the previous fixture (#767676 on
      // #FFFFFF) is ~4.55:1, ABOVE the 4.5:1 small-text threshold, so
      // `smallText` was always true and the `if (!smallText)` branch below
      // never ran — nothing was ever asserted. #858585 on #FFFFFF sits
      // between the two WCAG AA thresholds (3.69:1: below 4.5:1 small-text,
      // above 3:1 large-text), computed here with the service's own
      // contrast function so the fixture can't silently drift back above
      // 4.5:1 (or below 3:1) without failing this test.
      const color1 = '#858585';
      const color2 = '#FFFFFF';

      const ratio = ColorAccessibility.getContrastRatio(color1, color2);
      expect(ratio).toBeGreaterThan(3);
      expect(ratio).toBeLessThan(4.5);

      // If meetsWCAGAA's small/large threshold split were ever collapsed to
      // a single value, one of these two unconditional assertions would
      // fail — unlike the old `if (!smallText)` guard, neither can be
      // skipped.
      expect(ColorAccessibility.meetsWCAGAA(color1, color2, false)).toBe(false);
      expect(ColorAccessibility.meetsWCAGAA(color1, color2, true)).toBe(true);
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
      const darkColors = ['#0000FF', '#000080', '#333333', '#666666'];

      darkColors.forEach((color) => {
        expect(ColorAccessibility.isLightColor(color)).toBe(false);
      });
    });

    // BUG-134 (2026-10-04 deep-dive): the old `luminance > 0.5` cut called
    // every colour with luminance in (~0.179, 0.5] "dark", so it got white
    // text although black contrasts more. These were all "dark" before.
    it('treats mid-tones that contrast more with black as light (BUG-134)', () => {
      // #FF8000 L≈0.367: black 8.3:1 vs white 2.5:1
      // #FF0000 L≈0.213: black 5.3:1 vs white 4.0:1
      // #808080 L≈0.216: black 5.3:1 vs white 3.9:1
      // #FF00FF L≈0.285: black 6.7:1 vs white 3.1:1
      ['#FF8000', '#FF0000', '#808080', '#FF00FF'].forEach((color) => {
        expect(ColorAccessibility.isLightColor(color)).toBe(true);
      });
    });

    it('crosses over where black and white text contrast equally (L≈0.179)', () => {
      // Neighbouring greys straddle the crossover: #757575 (L≈0.178) still
      // takes white text, #767676 (L≈0.181) takes black.
      const below = '#757575';
      const above = '#767676';
      expect(ColorAccessibility.getPerceivedLuminance(below)).toBeLessThan(0.179);
      expect(ColorAccessibility.getPerceivedLuminance(above)).toBeGreaterThan(0.179);

      expect(ColorAccessibility.isLightColor(below)).toBe(false);
      expect(ColorAccessibility.isLightColor(above)).toBe(true);
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
      const darkBackgrounds = ['#0000FF', '#000080', '#333333', '#666666'];

      darkBackgrounds.forEach((bg) => {
        const textColor = ColorAccessibility.getOptimalTextColor(bg);
        expect(textColor).toBe('#FFFFFF');
      });
    });

    it('returns black on the orange from the BUG-134 report', () => {
      // Was white at ~2.5:1; black gives ~8.3:1.
      expect(ColorAccessibility.getOptimalTextColor('#FF8000')).toBe('#000000');
    });

    it('always picks whichever of black or white contrasts more (BUG-134)', () => {
      // A spread of hues and luminances, incl. the old (0.179, 0.5] dead zone.
      const backgrounds = [
        '#FF8000',
        '#FF0000',
        '#FF00FF',
        '#808080',
        '#767676',
        '#757575',
        '#FF6B6B',
        '#4D1818',
        '#87CEEB',
        '#228B22',
        '#0000FF',
        '#666666',
        '#00FF00',
        '#FFFF00',
        '#8C8C8C',
        '#B5651D',
        '#20B2AA',
        '#9370DB',
      ];

      backgrounds.forEach((bg) => {
        const chosen = ColorAccessibility.getOptimalTextColor(bg);
        const other = chosen === '#000000' ? '#FFFFFF' : '#000000';
        expect(
          ColorAccessibility.getContrastRatio(bg, chosen),
          `${bg}: ${chosen} vs ${other}`,
        ).toBeGreaterThanOrEqual(ColorAccessibility.getContrastRatio(bg, other));
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
