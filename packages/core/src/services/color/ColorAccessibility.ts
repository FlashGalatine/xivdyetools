/**
 * Color Accessibility
 * Per R-4: Focused class for accessibility-related color operations
 * Handles WCAG contrast, luminance, and text color optimization
 */

import type { HexColor } from '../../types/index.js';
import { createHexColor } from '../../types/index.js';
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
   * Check if a color is light (for determining text color on background)
   */
  static isLightColor(hex: string): boolean {
    const luminance = this.getPerceivedLuminance(hex);
    return luminance > 0.5;
  }

  /**
   * Get optimal text color for a background color
   */
  static getOptimalTextColor(backgroundColor: string): HexColor {
    return this.isLightColor(backgroundColor)
      ? createHexColor('#000000')
      : createHexColor('#FFFFFF');
  }
}
