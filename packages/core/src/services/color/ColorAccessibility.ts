/**
 * Color Accessibility
 * Per R-4: Focused class for accessibility-related color operations
 * Handles WCAG contrast, luminance, and text color optimization
 */

import type { HexColor } from '@xivdyetools/types';
import { createHexColor } from '@xivdyetools/types';
import { ColorConverter } from './ColorConverter.js';

/**
 * Color accessibility utilities
 * Per R-4: Single Responsibility - accessibility operations only
 */
export class ColorAccessibility {
  /**
   * Calculate perceived luminance of a color (0-1)
   * Uses relative luminance formula from WCAG
   */
  static getPerceivedLuminance(hex: string): number {
    const rgb = ColorConverter.hexToRgb(hex);

    // Convert to sRGB (linear RGB)
    const toLinear = (c: number): number => {
      const cNorm = c / 255;
      return cNorm <= 0.03928 ? cNorm / 12.92 : Math.pow((cNorm + 0.055) / 1.055, 2.4);
    };

    const r = toLinear(rgb.r);
    const g = toLinear(rgb.g);
    const b = toLinear(rgb.b);

    // WCAG relative luminance formula
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Calculate contrast ratio between two colors
   * Returns 1 (no contrast) to 21 (maximum contrast)
   */
  static getContrastRatio(hex1: string, hex2: string): number {
    const lum1 = this.getPerceivedLuminance(hex1);
    const lum2 = this.getPerceivedLuminance(hex2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Check if two colors meet WCAG AA contrast ratio (4.5:1 for small text, 3:1 for large)
   */
  static meetsWCAGAA(hex1: string, hex2: string, largeText: boolean = false): boolean {
    const ratio = this.getContrastRatio(hex1, hex2);
    return ratio >= (largeText ? 3 : 4.5);
  }

  /**
   * Check if two colors meet WCAG AAA contrast ratio (7:1 for small text, 4.5:1 for large)
   */
  static meetsWCAGAAA(hex1: string, hex2: string, largeText: boolean = false): boolean {
    const ratio = this.getContrastRatio(hex1, hex2);
    return ratio >= (largeText ? 4.5 : 7);
  }

  /**
   * Check if a color is light (for determining text color on background):
   * true when black text has a higher WCAG contrast ratio against it than
   * white text does.
   *
   * BUG-134 (2026-10-04 deep-dive): this was `luminance > 0.5`, which called
   * every color with luminance in (~0.179, 0.5] "dark" and so put white text
   * on it at the LOWER contrast — #FF8000 got white at 2.5:1 instead of
   * black at 8.3:1. Comparing the two ratios directly puts the crossover
   * where they are equal, L = √(1.05 × 0.05) − 0.05 ≈ 0.179 (the same cut
   * `@xivdyetools/svg`'s getContrastTextColor uses).
   */
  static isLightColor(hex: string): boolean {
    const luminance = this.getPerceivedLuminance(hex);
    const contrastWithBlack = (luminance + 0.05) / 0.05;
    const contrastWithWhite = 1.05 / (luminance + 0.05);
    return contrastWithBlack > contrastWithWhite;
  }

  /**
   * Get optimal text color for a background color: whichever of black or
   * white has the higher WCAG contrast ratio against it (see isLightColor).
   */
  static getOptimalTextColor(backgroundColor: string): HexColor {
    return this.isLightColor(backgroundColor)
      ? createHexColor('#000000')
      : createHexColor('#FFFFFF');
  }
}
