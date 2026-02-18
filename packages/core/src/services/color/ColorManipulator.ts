/**
 * Color Manipulator
 * Per R-4: Focused class for color manipulation operations
 * Handles brightness, saturation, hue rotation, inversion, and desaturation
 */

import type { HexColor } from '../../types/index.js';
import { clamp } from '../../utils/index.js';
import { ColorConverter } from './ColorConverter.js';

/**
 * Color manipulation utilities
 * Per R-4: Single Responsibility - color manipulation only
 */
export class ColorManipulator {
  /**
   * Adjust brightness of a color
   * @param amount -100 to 100 (negative = darker, positive = lighter)
   */
  static adjustBrightness(hex: string, amount: number): HexColor {
    const hsv = ColorConverter.hexToHsv(hex);
    hsv.v = clamp(hsv.v + amount, 0, 100);
    return ColorConverter.hsvToHex(hsv.h, hsv.s, hsv.v);
  }

  /**
   * Adjust saturation of a color
   * @param amount -100 to 100 (negative = less saturated, positive = more saturated)
   */
  static adjustSaturation(hex: string, amount: number): HexColor {
    const hsv = ColorConverter.hexToHsv(hex);
    hsv.s = clamp(hsv.s + amount, 0, 100);
    return ColorConverter.hsvToHex(hsv.h, hsv.s, hsv.v);
  }

  /**
   * Rotate hue of a color
   * @param degrees Amount to rotate hue (can be negative or positive)
   */
  static rotateHue(hex: string, degrees: number): HexColor {
    const hsv = ColorConverter.hexToHsv(hex);
    // Normalize to 0-360 to handle negative values properly
    hsv.h = (((hsv.h + degrees) % 360) + 360) % 360;
    return ColorConverter.hsvToHex(hsv.h, hsv.s, hsv.v);
  }

  /**
   * Invert a color (create complementary color)
   */
  static invert(hex: string): HexColor {
    const rgb = ColorConverter.hexToRgb(hex);
    return ColorConverter.rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
  }

  /**
   * Desaturate a color (convert to grayscale)
   */
  static desaturate(hex: string): HexColor {
    const hsv = ColorConverter.hexToHsv(hex);
    return ColorConverter.hsvToHex(hsv.h, 0, hsv.v);
  }
}
