/**
 * ColorService tests
 *
 * Tests for the ColorService facade which delegates to focused service classes.
 * Ensures all static methods and branch coverage for default parameters.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ColorService } from '../ColorService.js';

describe('ColorService', () => {
  beforeEach(() => {
    ColorService.clearCaches();
  });

  // ============================================================================
  // Cache Management
  // ============================================================================

  describe('cache management', () => {
    it('should clear all caches', () => {
      // Populate caches first
      ColorService.hexToRgb('#FF0000');
      ColorService.rgbToHex(255, 0, 0);
      ColorService.simulateColorblindness({ r: 255, g: 0, b: 0 }, 'deuteranopia');

      const statsBefore = ColorService.getCacheStats();
      expect(statsBefore.hexToRgb).toBeGreaterThan(0);

      ColorService.clearCaches();

      const statsAfter = ColorService.getCacheStats();
      expect(statsAfter.hexToRgb).toBe(0);
      expect(statsAfter.rgbToHex).toBe(0);
      expect(statsAfter.colorblind).toBe(0);
    });

    it('should return cache statistics', () => {
      const stats = ColorService.getCacheStats();
      expect(stats).toHaveProperty('hexToRgb');
      expect(stats).toHaveProperty('rgbToHex');
      expect(stats).toHaveProperty('rgbToHsv');
      expect(stats).toHaveProperty('hsvToRgb');
      expect(stats).toHaveProperty('hexToHsv');
      expect(stats).toHaveProperty('colorblind');
    });

    it('should increment cache stats on conversions', () => {
      ColorService.hexToRgb('#FF0000');
      ColorService.hexToRgb('#00FF00');
      ColorService.rgbToHex(0, 0, 255);

      const stats = ColorService.getCacheStats();
      expect(stats.hexToRgb).toBe(2);
      expect(stats.rgbToHex).toBe(1);
    });
  });

  // ============================================================================
  // Color Conversion (delegated methods)
  // ============================================================================

  describe('color conversion', () => {
    it('should convert hex to RGB', () => {
      const rgb = ColorService.hexToRgb('#FF0000');
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should convert RGB to hex', () => {
      const hex = ColorService.rgbToHex(255, 0, 0);
      expect(hex).toBe('#FF0000');
    });

    it('should convert RGB to HSV', () => {
      const hsv = ColorService.rgbToHsv(255, 0, 0);
      expect(hsv).toEqual({ h: 0, s: 100, v: 100 });
    });

    it('should convert HSV to RGB', () => {
      const rgb = ColorService.hsvToRgb(0, 100, 100);
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should convert hex to HSV', () => {
      const hsv = ColorService.hexToHsv('#FF0000');
      expect(hsv).toEqual({ h: 0, s: 100, v: 100 });
    });

    it('should convert HSV to hex', () => {
      const hex = ColorService.hsvToHex(0, 100, 100);
      expect(hex).toBe('#FF0000');
    });

    it('should normalize hex colors', () => {
      expect(ColorService.normalizeHex('#f00')).toBe('#FF0000');
      // Without hash not supported
      expect(ColorService.normalizeHex('#ff0000')).toBe('#FF0000');
    });

    it('should calculate color distance', () => {
      const distance = ColorService.getColorDistance('#FF0000', '#00FF00');
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(450);
    });
  });

  // ============================================================================
  // Colorblindness Simulation
  // ============================================================================

  describe('colorblindness simulation', () => {
    it('should simulate colorblindness on RGB', () => {
      const rgb = { r: 255, g: 0, b: 0 };
      const simulated = ColorService.simulateColorblindness(rgb, 'deuteranopia');
      expect(simulated).toBeDefined();
      expect(simulated.r).toBeDefined();
      expect(simulated.g).toBeDefined();
      expect(simulated.b).toBeDefined();
    });

    it('should simulate colorblindness on hex', () => {
      const simulated = ColorService.simulateColorblindnessHex('#FF0000', 'protanopia');
      expect(simulated).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should return same color for normal vision', () => {
      const simulated = ColorService.simulateColorblindnessHex('#FF0000', 'normal');
      expect(simulated).toBe('#FF0000');
    });
  });

  // ============================================================================
  // Color Accessibility
  // ============================================================================

  describe('color accessibility', () => {
    it('should calculate perceived luminance', () => {
      const whiteLuminance = ColorService.getPerceivedLuminance('#FFFFFF');
      const blackLuminance = ColorService.getPerceivedLuminance('#000000');
      expect(whiteLuminance).toBeCloseTo(1, 1);
      expect(blackLuminance).toBeCloseTo(0, 1);
    });

    it('should calculate contrast ratio', () => {
      const ratio = ColorService.getContrastRatio('#FFFFFF', '#000000');
      expect(ratio).toBeCloseTo(21, 0); // Max contrast
    });

    describe('WCAG AA compliance', () => {
      it('should check WCAG AA with default largeText (false)', () => {
        // High contrast - should pass
        expect(ColorService.meetsWCAGAA('#000000', '#FFFFFF')).toBe(true);
        // Low contrast - should fail
        expect(ColorService.meetsWCAGAA('#777777', '#888888')).toBe(false);
      });

      it('should check WCAG AA with largeText = false', () => {
        // Threshold is 4.5:1 for normal text
        expect(ColorService.meetsWCAGAA('#000000', '#FFFFFF', false)).toBe(true);
      });

      it('should check WCAG AA with largeText = true', () => {
        // Threshold is 3:1 for large text - more lenient
        expect(ColorService.meetsWCAGAA('#000000', '#FFFFFF', true)).toBe(true);
        // Medium contrast that might pass large text but fail normal
        const ratio = ColorService.getContrastRatio('#595959', '#FFFFFF');
        if (ratio >= 3 && ratio < 4.5) {
          expect(ColorService.meetsWCAGAA('#595959', '#FFFFFF', true)).toBe(true);
          expect(ColorService.meetsWCAGAA('#595959', '#FFFFFF', false)).toBe(false);
        }
      });
    });

    describe('WCAG AAA compliance', () => {
      it('should check WCAG AAA with default largeText (false)', () => {
        // High contrast - should pass
        expect(ColorService.meetsWCAGAAA('#000000', '#FFFFFF')).toBe(true);
        // Low contrast - should fail
        expect(ColorService.meetsWCAGAAA('#777777', '#888888')).toBe(false);
      });

      it('should check WCAG AAA with largeText = false', () => {
        // Threshold is 7:1 for normal text
        expect(ColorService.meetsWCAGAAA('#000000', '#FFFFFF', false)).toBe(true);
      });

      it('should check WCAG AAA with largeText = true', () => {
        // Threshold is 4.5:1 for large text
        expect(ColorService.meetsWCAGAAA('#000000', '#FFFFFF', true)).toBe(true);
      });
    });

    it('should determine if color is light', () => {
      expect(ColorService.isLightColor('#FFFFFF')).toBe(true);
      expect(ColorService.isLightColor('#000000')).toBe(false);
      expect(ColorService.isLightColor('#FFFF00')).toBe(true); // Yellow is light
    });

    it('should get optimal text color', () => {
      expect(ColorService.getOptimalTextColor('#FFFFFF')).toBe('#000000');
      expect(ColorService.getOptimalTextColor('#000000')).toBe('#FFFFFF');
    });
  });

  // ============================================================================
  // Color Manipulation
  // ============================================================================

  describe('color manipulation', () => {
    it('should adjust brightness', () => {
      const brighter = ColorService.adjustBrightness('#808080', 50);
      const darker = ColorService.adjustBrightness('#808080', -50);

      const brighterRgb = ColorService.hexToRgb(brighter);
      const darkerRgb = ColorService.hexToRgb(darker);
      const originalRgb = ColorService.hexToRgb('#808080');

      expect(brighterRgb.r).toBeGreaterThan(originalRgb.r);
      expect(darkerRgb.r).toBeLessThanOrEqual(originalRgb.r);
    });

    it('should adjust saturation', () => {
      const moreSaturated = ColorService.adjustSaturation('#8080FF', 50);
      const lessSaturated = ColorService.adjustSaturation('#8080FF', -50);

      expect(moreSaturated).toBeDefined();
      expect(lessSaturated).toBeDefined();
    });

    it('should rotate hue', () => {
      const rotated = ColorService.rotateHue('#FF0000', 120);
      // Red rotated 120° should be green-ish
      const rgb = ColorService.hexToRgb(rotated);
      expect(rgb.g).toBeGreaterThan(rgb.r);
    });

    it('should invert color', () => {
      const inverted = ColorService.invert('#FF0000');
      expect(inverted).toBe('#00FFFF'); // Red inverts to cyan
    });

    it('should desaturate color', () => {
      const desaturated = ColorService.desaturate('#FF0000');
      const rgb = ColorService.hexToRgb(desaturated);
      // Grayscale has R = G = B
      expect(rgb.r).toBe(rgb.g);
      expect(rgb.g).toBe(rgb.b);
    });
  });

  // ============================================================================
  // LAB Color Space
  // ============================================================================

  describe('LAB color space', () => {
    it('should convert RGB to LAB', () => {
      const lab = ColorService.rgbToLab(255, 0, 0);
      expect(lab).toHaveProperty('L');
      expect(lab).toHaveProperty('a');
      expect(lab).toHaveProperty('b');
      expect(lab.L).toBeGreaterThan(50); // Red has high lightness
      expect(lab.a).toBeGreaterThan(0); // Red has positive a
    });

    it('should convert hex to LAB', () => {
      const lab = ColorService.hexToLab('#00FF00');
      expect(lab.L).toBeGreaterThan(80); // Green has very high lightness
      expect(lab.a).toBeLessThan(0); // Green has negative a
    });

    it('should convert LAB to RGB', () => {
      const rgb = ColorService.labToRgb(53.23, 80.11, 67.22);
      expect(rgb.r).toBeGreaterThan(200); // Should be near red
      expect(rgb.g).toBeLessThan(50);
      expect(rgb.b).toBeLessThan(50);
    });

    it('should convert LAB to hex', () => {
      const hex = ColorService.labToHex(100, 0, 0);
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      // L=100, a=0, b=0 should be white
      expect(hex).toBe('#FFFFFF');
    });

    it('should calculate DeltaE with cie76 formula (default)', () => {
      const deltaE = ColorService.getDeltaE('#FF0000', '#FF0001');
      expect(deltaE).toBeGreaterThanOrEqual(0);
      expect(deltaE).toBeLessThan(5); // Very similar colors
    });

    it('should calculate DeltaE with cie2000 formula', () => {
      const deltaE = ColorService.getDeltaE('#FF0000', '#00FF00', 'cie2000');
      expect(deltaE).toBeGreaterThan(50); // Very different colors
    });
  });

  // ============================================================================
  // OKLAB/OKLCH Color Space
  // ============================================================================

  describe('OKLAB color space', () => {
    it('should convert RGB to OKLAB', () => {
      const oklab = ColorService.rgbToOklab(255, 0, 0);
      expect(oklab).toHaveProperty('L');
      expect(oklab).toHaveProperty('a');
      expect(oklab).toHaveProperty('b');
      expect(oklab.L).toBeGreaterThan(0.5); // Red has medium-high lightness
      expect(oklab.L).toBeLessThan(1);
    });

    it('should convert hex to OKLAB', () => {
      const oklab = ColorService.hexToOklab('#0000FF');
      expect(oklab.L).toBeGreaterThan(0);
      expect(oklab.b).toBeLessThan(0); // Blue has negative b in OKLAB
    });

    it('should convert OKLAB to RGB', () => {
      const rgb = ColorService.oklabToRgb(0.628, 0.225, 0.126);
      expect(rgb.r).toBeGreaterThan(200); // Should be red-ish
    });

    it('should convert OKLAB to hex', () => {
      const hex = ColorService.oklabToHex(1, 0, 0);
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      // L=1, a=0, b=0 should be white
      expect(hex).toBe('#FFFFFF');
    });
  });

  describe('OKLCH color space', () => {
    it('should convert RGB to OKLCH', () => {
      const oklch = ColorService.rgbToOklch(255, 0, 0);
      expect(oklch).toHaveProperty('L');
      expect(oklch).toHaveProperty('C');
      expect(oklch).toHaveProperty('h');
      expect(oklch.C).toBeGreaterThan(0); // Saturated red has high chroma
    });

    it('should convert hex to OKLCH', () => {
      const oklch = ColorService.hexToOklch('#FF00FF');
      expect(oklch.h).toBeGreaterThan(0);
      expect(oklch.h).toBeLessThan(360);
    });

    it('should convert OKLCH to RGB', () => {
      const rgb = ColorService.oklchToRgb(0.628, 0.258, 29.23);
      expect(rgb.r).toBeDefined();
      expect(rgb.g).toBeDefined();
      expect(rgb.b).toBeDefined();
    });

    it('should convert OKLCH to hex', () => {
      const hex = ColorService.oklchToHex(0.5, 0.1, 180);
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    });
  });

  // ============================================================================
  // LCH Color Space
  // ============================================================================

  describe('LCH color space', () => {
    it('should convert LAB to LCH', () => {
      const lch = ColorService.labToLch(53, 80, 67);
      expect(lch).toHaveProperty('L');
      expect(lch).toHaveProperty('C');
      expect(lch).toHaveProperty('h');
      expect(lch.L).toBeCloseTo(53, 0);
      expect(lch.C).toBeGreaterThan(0);
    });

    it('should convert LCH to LAB', () => {
      const lab = ColorService.lchToLab(50, 50, 90);
      expect(lab.L).toBeCloseTo(50, 0);
      expect(lab.a).toBeDefined();
      expect(lab.b).toBeDefined();
    });

    it('should convert RGB to LCH', () => {
      const lch = ColorService.rgbToLch(255, 0, 0);
      expect(lch.L).toBeGreaterThan(50);
      expect(lch.C).toBeGreaterThan(0);
    });

    it('should convert hex to LCH', () => {
      const lch = ColorService.hexToLch('#00FF00');
      expect(lch.h).toBeGreaterThan(0);
    });

    it('should convert LCH to RGB', () => {
      const rgb = ColorService.lchToRgb(50, 50, 90);
      expect(rgb.r).toBeDefined();
      expect(rgb.g).toBeDefined();
      expect(rgb.b).toBeDefined();
    });

    it('should convert LCH to hex', () => {
      const hex = ColorService.lchToHex(50, 50, 180);
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    });
  });

  // ============================================================================
  // HSL Color Space
  // ============================================================================

  describe('HSL color space', () => {
    it('should convert RGB to HSL', () => {
      const hsl = ColorService.rgbToHsl(255, 0, 0);
      expect(hsl.h).toBeCloseTo(0, 0);
      expect(hsl.s).toBeCloseTo(100, 0);
      expect(hsl.l).toBeCloseTo(50, 0);
    });

    it('should convert hex to HSL', () => {
      const hsl = ColorService.hexToHsl('#00FF00');
      expect(hsl.h).toBeCloseTo(120, 0); // Green is at 120 degrees
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    it('should convert HSL to RGB', () => {
      const rgb = ColorService.hslToRgb(0, 100, 50);
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should convert HSL to hex', () => {
      const hex = ColorService.hslToHex(0, 100, 50);
      expect(hex).toBe('#FF0000');
    });

    it('should handle achromatic colors in HSL', () => {
      const hsl = ColorService.rgbToHsl(128, 128, 128);
      expect(hsl.s).toBe(0); // Gray has no saturation
    });
  });

  // ============================================================================
  // Color Mixing
  // ============================================================================

  describe('color mixing', () => {
    describe('RGB mixing', () => {
      it('should mix colors with default ratio (0.5)', () => {
        const mixed = ColorService.mixColorsRgb('#FF0000', '#0000FF');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
        // Red + Blue at 0.5 should give purple-ish
        const rgb = ColorService.hexToRgb(mixed);
        expect(rgb.r).toBeGreaterThan(100);
        expect(rgb.b).toBeGreaterThan(100);
      });

      it('should mix colors with custom ratio', () => {
        const moreRed = ColorService.mixColorsRgb('#FF0000', '#0000FF', 0.25);
        const moreBlue = ColorService.mixColorsRgb('#FF0000', '#0000FF', 0.75);

        const redRgb = ColorService.hexToRgb(moreRed);
        const blueRgb = ColorService.hexToRgb(moreBlue);

        expect(redRgb.r).toBeGreaterThan(blueRgb.r);
        expect(redRgb.b).toBeLessThan(blueRgb.b);
      });
    });

    describe('LAB mixing', () => {
      it('should mix colors in LAB space with default ratio', () => {
        const mixed = ColorService.mixColorsLab('#FF0000', '#00FF00');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should mix colors in LAB space with custom ratio', () => {
        const moreRed = ColorService.mixColorsLab('#FF0000', '#00FF00', 0.2);
        const moreGreen = ColorService.mixColorsLab('#FF0000', '#00FF00', 0.8);
        expect(moreRed).not.toBe(moreGreen);
      });
    });

    describe('RYB mixing', () => {
      it('should mix colors using RYB (paint-like)', () => {
        // Blue + Yellow should produce green-ish in RYB
        const mixed = ColorService.mixColorsRyb('#0000FF', '#FFFF00');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should convert RGB to RYB', () => {
        const ryb = ColorService.rgbToRyb(255, 0, 0);
        expect(ryb).toHaveProperty('r');
        expect(ryb).toHaveProperty('y');
        expect(ryb).toHaveProperty('b');
      });

      it('should convert RYB to RGB', () => {
        const rgb = ColorService.rybToRgb(255, 0, 0);
        expect(rgb).toHaveProperty('r');
        expect(rgb).toHaveProperty('g');
        expect(rgb).toHaveProperty('b');
      });

      it('should convert hex to RYB', () => {
        const ryb = ColorService.hexToRyb('#FF0000');
        expect(ryb.r).toBeDefined();
      });

      it('should convert RYB to hex', () => {
        const hex = ColorService.rybToHex(255, 128, 0);
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      });
    });

    describe('OKLAB mixing', () => {
      it('should mix colors using OKLAB (perceptually uniform)', () => {
        const mixed = ColorService.mixColorsOklab('#FF0000', '#00FF00');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should mix blue and yellow to green in OKLAB', () => {
        const mixed = ColorService.mixColorsOklab('#0000FF', '#FFFF00', 0.5);
        const rgb = ColorService.hexToRgb(mixed);
        // OKLAB should produce green-ish for blue+yellow
        expect(rgb.g).toBeGreaterThan(0);
      });
    });

    describe('hue interpolation', () => {
      it('should interpolate hue using shorter path (default)', () => {
        const h = ColorService.interpolateHue(10, 350, 0.5);
        // Shorter path goes through 0 (from 10 to 350)
        expect(h).toBeLessThan(20);
      });

      it('should interpolate hue using longer path', () => {
        const h = ColorService.interpolateHue(10, 350, 0.5, 'longer');
        // Longer path goes through 180
        expect(h).toBeGreaterThan(100);
        expect(h).toBeLessThan(260);
      });

      it('should interpolate hue using increasing direction', () => {
        const h = ColorService.interpolateHue(350, 10, 0.5, 'increasing');
        expect(h).toBeLessThan(20);
      });

      it('should interpolate hue using decreasing direction', () => {
        const h = ColorService.interpolateHue(10, 350, 0.5, 'decreasing');
        // Decreasing from 10 towards 350 goes backwards through 0
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
      });
    });

    describe('OKLCH mixing', () => {
      it('should mix colors using OKLCH with default hue method', () => {
        const mixed = ColorService.mixColorsOklch('#FF0000', '#0000FF');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should mix colors using OKLCH with longer hue path', () => {
        const mixed = ColorService.mixColorsOklch('#FF0000', '#0000FF', 0.5, 'longer');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should mix colors using OKLCH with increasing hue', () => {
        const mixed = ColorService.mixColorsOklch('#FF0000', '#00FF00', 0.5, 'increasing');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should mix colors using OKLCH with decreasing hue', () => {
        const mixed = ColorService.mixColorsOklch('#FF0000', '#00FF00', 0.5, 'decreasing');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });
    });

    describe('LCH mixing', () => {
      it('should mix colors using LCH with default hue method', () => {
        const mixed = ColorService.mixColorsLch('#FF0000', '#0000FF');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should mix colors using LCH with longer hue path', () => {
        const mixed = ColorService.mixColorsLch('#FF0000', '#0000FF', 0.5, 'longer');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });
    });

    describe('HSL mixing', () => {
      it('should mix colors using HSL with default hue method', () => {
        const mixed = ColorService.mixColorsHsl('#FF0000', '#00FF00');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should mix colors using HSL with longer hue path', () => {
        const mixed = ColorService.mixColorsHsl('#FF0000', '#00FF00', 0.5, 'longer');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });
    });

    describe('HSV mixing', () => {
      it('should mix colors using HSV with default hue method', () => {
        const mixed = ColorService.mixColorsHsv('#FF0000', '#00FF00');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should mix colors using HSV with longer hue path', () => {
        const mixed = ColorService.mixColorsHsv('#FF0000', '#00FF00', 0.5, 'longer');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });
    });

    describe('spectral mixing', () => {
      it('should mix colors using Kubelka-Munk spectral theory', () => {
        const mixed = ColorService.mixColorsSpectral('#FF0000', '#0000FF');
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should mix blue and yellow to green spectral (like paint)', () => {
        const mixed = ColorService.mixColorsSpectral('#0000FF', '#FFFF00', 0.5);
        const rgb = ColorService.hexToRgb(mixed);
        // Spectral mixing should produce green for blue+yellow
        expect(rgb.g).toBeGreaterThan(50);
      });

      it('should mix multiple colors spectrally', () => {
        const mixed = ColorService.mixMultipleSpectral(['#FF0000', '#00FF00', '#0000FF']);
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should mix multiple colors with custom weights', () => {
        const mixed = ColorService.mixMultipleSpectral(
          ['#FF0000', '#00FF00', '#0000FF'],
          [0.5, 0.3, 0.2]
        );
        expect(mixed).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should generate spectral gradient', () => {
        const gradient = ColorService.gradientSpectral('#FF0000', '#0000FF', 5);
        expect(gradient).toHaveLength(5);
        expect(gradient[0]).toBe('#FF0000');
        expect(gradient[4]).toBe('#0000FF');
      });

      it('should check spectral availability', () => {
        const available = ColorService.isSpectralAvailable();
        expect(typeof available).toBe('boolean');
        expect(available).toBe(true); // spectral.js should be loaded
      });
    });
  });
});
