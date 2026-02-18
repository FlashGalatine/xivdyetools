/**
 * @xivdyetools/core - Color Service
 *
 * Color conversion algorithms and colorblindness simulation.
 * Provides utilities for converting between RGB, HSV, and hex color formats,
 * calculating color distances, and simulating color vision deficiencies.
 *
 * Per R-4: Facade class that delegates to focused service classes
 * Maintains backward compatibility while using split services internally
 *
 * @module services/ColorService
 * @example
 * ```typescript
 * import { ColorService } from '@xivdyetools/core';
 *
 * // Convert hex to RGB
 * const rgb = ColorService.hexToRgb('#FF0000');
 * // { r: 255, g: 0, b: 0 }
 *
 * // Convert RGB to HSV
 * const hsv = ColorService.rgbToHsv(rgb);
 * // { h: 0, s: 100, v: 100 }
 *
 * // Calculate color distance
 * const distance = ColorService.getColorDistance('#FF0000', '#00FF00');
 * ```
 */

import type {
  RGB,
  HSV,
  HexColor,
  VisionType,
  LAB,
  OKLAB,
  OKLCH,
  LCH,
  HSL,
} from '../types/index.js';
import { ColorConverter, type DeltaEFormula } from './color/ColorConverter.js';
import { ColorblindnessSimulator } from './color/ColorblindnessSimulator.js';
import { ColorAccessibility } from './color/ColorAccessibility.js';
import { ColorManipulator } from './color/ColorManipulator.js';
import { RybColorMixer, type RYB } from './color/RybColorMixer.js';
import { SpectralMixer } from './color/SpectralMixer.js';

/**
 * Color conversion and manipulation service (Facade)
 * Per R-4: Delegates to focused service classes for better separation of concerns
 * Maintains backward compatibility with existing API
 */
export class ColorService {
  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear all caches (useful for testing or memory management)
   */
  static clearCaches(): void {
    ColorConverter.clearCaches();
    ColorblindnessSimulator.clearCache();
  }

  /**
   * Get cache statistics (for monitoring)
   */
  static getCacheStats(): {
    hexToRgb: number;
    rgbToHex: number;
    rgbToHsv: number;
    hsvToRgb: number;
    hexToHsv: number;
    colorblind: number;
  } {
    const converterStats = ColorConverter.getCacheStats();
    const simulatorStats = ColorblindnessSimulator.getCacheStats();
    return {
      ...converterStats,
      colorblind: simulatorStats.colorblind,
    };
  }

  // ============================================================================
  // Color Conversion (delegated to ColorConverter)
  // ============================================================================

  /**
   * Convert hexadecimal color to RGB
   * @example hexToRgb("#FF0000") -> { r: 255, g: 0, b: 0 }
   */
  static hexToRgb(hex: string): RGB {
    return ColorConverter.hexToRgb(hex);
  }

  /**
   * Convert RGB to hexadecimal color
   * @example rgbToHex(255, 0, 0) -> "#FF0000"
   */
  static rgbToHex(r: number, g: number, b: number): HexColor {
    return ColorConverter.rgbToHex(r, g, b);
  }

  /**
   * Convert RGB to HSV
   * @example rgbToHsv(255, 0, 0) -> { h: 0, s: 100, v: 100 }
   */
  static rgbToHsv(r: number, g: number, b: number): HSV {
    return ColorConverter.rgbToHsv(r, g, b);
  }

  /**
   * Convert HSV to RGB
   * @example hsvToRgb(0, 100, 100) -> { r: 255, g: 0, b: 0 }
   */
  static hsvToRgb(h: number, s: number, v: number): RGB {
    return ColorConverter.hsvToRgb(h, s, v);
  }

  /**
   * Convert hex to HSV
   */
  static hexToHsv(hex: string): HSV {
    return ColorConverter.hexToHsv(hex);
  }

  /**
   * Convert HSV to hex
   */
  static hsvToHex(h: number, s: number, v: number): HexColor {
    return ColorConverter.hsvToHex(h, s, v);
  }

  /**
   * Normalize a hex color to #RRGGBB format
   */
  static normalizeHex(hex: string): HexColor {
    return ColorConverter.normalizeHex(hex);
  }

  /**
   * Calculate Euclidean distance between two RGB colors
   * Returns 0 for identical colors, ~441.67 for white vs black
   */
  static getColorDistance(hex1: string, hex2: string): number {
    return ColorConverter.getColorDistance(hex1, hex2);
  }

  // ============================================================================
  // Colorblindness Simulation (delegated to ColorblindnessSimulator)
  // ============================================================================

  /**
   * Simulate colorblindness on an RGB color
   * @example simulateColorblindness({ r: 255, g: 0, b: 0 }, 'deuteranopia')
   */
  static simulateColorblindness(rgb: RGB, visionType: VisionType): RGB {
    return ColorblindnessSimulator.simulateColorblindness(rgb, visionType);
  }

  /**
   * Simulate colorblindness on a hex color
   */
  static simulateColorblindnessHex(hex: string, visionType: VisionType): HexColor {
    return ColorblindnessSimulator.simulateColorblindnessHex(hex, visionType);
  }

  // ============================================================================
  // Color Accessibility (delegated to ColorAccessibility)
  // ============================================================================

  /**
   * Calculate perceived luminance of a color (0-1)
   * Uses relative luminance formula from WCAG
   */
  static getPerceivedLuminance(hex: string): number {
    return ColorAccessibility.getPerceivedLuminance(hex);
  }

  /**
   * Calculate contrast ratio between two colors
   * Returns 1 (no contrast) to 21 (maximum contrast)
   */
  static getContrastRatio(hex1: string, hex2: string): number {
    return ColorAccessibility.getContrastRatio(hex1, hex2);
  }

  /**
   * Check if two colors meet WCAG AA contrast ratio
   */
  static meetsWCAGAA(hex1: string, hex2: string, largeText: boolean = false): boolean {
    return ColorAccessibility.meetsWCAGAA(hex1, hex2, largeText);
  }

  /**
   * Check if two colors meet WCAG AAA contrast ratio
   */
  static meetsWCAGAAA(hex1: string, hex2: string, largeText: boolean = false): boolean {
    return ColorAccessibility.meetsWCAGAAA(hex1, hex2, largeText);
  }

  /**
   * Check if a color is light (for determining text color on background)
   */
  static isLightColor(hex: string): boolean {
    return ColorAccessibility.isLightColor(hex);
  }

  /**
   * Get optimal text color for a background color
   */
  static getOptimalTextColor(backgroundColor: string): HexColor {
    return ColorAccessibility.getOptimalTextColor(backgroundColor);
  }

  // ============================================================================
  // Color Manipulation (delegated to ColorManipulator)
  // ============================================================================

  /**
   * Adjust brightness of a color
   * @param amount -100 to 100 (negative = darker, positive = lighter)
   */
  static adjustBrightness(hex: string, amount: number): HexColor {
    return ColorManipulator.adjustBrightness(hex, amount);
  }

  /**
   * Adjust saturation of a color
   * @param amount -100 to 100 (negative = less saturated, positive = more saturated)
   */
  static adjustSaturation(hex: string, amount: number): HexColor {
    return ColorManipulator.adjustSaturation(hex, amount);
  }

  /**
   * Rotate hue of a color
   * @param degrees 0-360 (amount to rotate hue)
   */
  static rotateHue(hex: string, degrees: number): HexColor {
    return ColorManipulator.rotateHue(hex, degrees);
  }

  /**
   * Invert a color (create complementary color)
   */
  static invert(hex: string): HexColor {
    return ColorManipulator.invert(hex);
  }

  /**
   * Desaturate a color (convert to grayscale)
   */
  static desaturate(hex: string): HexColor {
    return ColorManipulator.desaturate(hex);
  }

  // ============================================================================
  // LAB Color Space (delegated to ColorConverter)
  // ============================================================================

  /**
   * Convert RGB to CIE LAB color space
   * @example rgbToLab(255, 0, 0) -> { L: 53.23, a: 80.11, b: 67.22 }
   */
  static rgbToLab(r: number, g: number, b: number): LAB {
    return ColorConverter.rgbToLab(r, g, b);
  }

  /**
   * Convert hex color to CIE LAB
   * @example hexToLab("#FF0000") -> { L: 53.23, a: 80.11, b: 67.22 }
   */
  static hexToLab(hex: string): LAB {
    return ColorConverter.hexToLab(hex);
  }

  /**
   * Calculate DeltaE (color difference) between two hex colors
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param formula DeltaE formula to use ('cie76' or 'cie2000', default: 'cie76')
   * @returns DeltaE value (0 = identical, <1 imperceptible, <3 barely noticeable, >5 clearly different)
   */
  static getDeltaE(hex1: string, hex2: string, formula: DeltaEFormula = 'cie76'): number {
    return ColorConverter.getDeltaE(hex1, hex2, formula);
  }

  /**
   * Convert CIE LAB to RGB
   * @example labToRgb(53.23, 80.11, 67.22) -> { r: 255, g: 0, b: 0 }
   */
  static labToRgb(L: number, a: number, b: number): RGB {
    return ColorConverter.labToRgb(L, a, b);
  }

  /**
   * Convert CIE LAB to hex color
   * @example labToHex(53.23, 80.11, 67.22) -> "#FF0000"
   */
  static labToHex(L: number, a: number, b: number): HexColor {
    return ColorConverter.labToHex(L, a, b);
  }

  // ============================================================================
  // OKLAB/OKLCH Color Space (Modern Perceptual)
  // ============================================================================

  /**
   * Convert RGB to OKLAB color space
   *
   * OKLAB is a modern perceptually uniform color space that fixes issues
   * with CIELAB, particularly for blue colors. Blue + Yellow = Green in OKLAB.
   *
   * @example rgbToOklab(255, 0, 0) -> { L: 0.628, a: 0.225, b: 0.126 }
   */
  static rgbToOklab(r: number, g: number, b: number): OKLAB {
    return ColorConverter.rgbToOklab(r, g, b);
  }

  /**
   * Convert hex color to OKLAB
   */
  static hexToOklab(hex: string): OKLAB {
    return ColorConverter.hexToOklab(hex);
  }

  /**
   * Convert OKLAB to RGB
   */
  static oklabToRgb(L: number, a: number, b: number): RGB {
    return ColorConverter.oklabToRgb(L, a, b);
  }

  /**
   * Convert OKLAB to hex color
   */
  static oklabToHex(L: number, a: number, b: number): HexColor {
    return ColorConverter.oklabToHex(L, a, b);
  }

  /**
   * Convert RGB to OKLCH (cylindrical OKLAB)
   *
   * OKLCH expresses OKLAB in cylindrical coordinates for intuitive
   * hue manipulation. Ideal for gradient interpolation.
   */
  static rgbToOklch(r: number, g: number, b: number): OKLCH {
    return ColorConverter.rgbToOklch(r, g, b);
  }

  /**
   * Convert hex color to OKLCH
   */
  static hexToOklch(hex: string): OKLCH {
    return ColorConverter.hexToOklch(hex);
  }

  /**
   * Convert OKLCH to RGB
   */
  static oklchToRgb(L: number, C: number, h: number): RGB {
    return ColorConverter.oklchToRgb(L, C, h);
  }

  /**
   * Convert OKLCH to hex color
   */
  static oklchToHex(L: number, C: number, h: number): HexColor {
    return ColorConverter.oklchToHex(L, C, h);
  }

  // ============================================================================
  // LCH Color Space (Cylindrical LAB)
  // ============================================================================

  /**
   * Convert CIE LAB to LCH (cylindrical LAB)
   */
  static labToLch(L: number, a: number, b: number): LCH {
    return ColorConverter.labToLch(L, a, b);
  }

  /**
   * Convert LCH to CIE LAB
   */
  static lchToLab(L: number, C: number, h: number): LAB {
    return ColorConverter.lchToLab(L, C, h);
  }

  /**
   * Convert RGB to LCH
   */
  static rgbToLch(r: number, g: number, b: number): LCH {
    return ColorConverter.rgbToLch(r, g, b);
  }

  /**
   * Convert hex color to LCH
   */
  static hexToLch(hex: string): LCH {
    return ColorConverter.hexToLch(hex);
  }

  /**
   * Convert LCH to RGB
   */
  static lchToRgb(L: number, C: number, h: number): RGB {
    return ColorConverter.lchToRgb(L, C, h);
  }

  /**
   * Convert LCH to hex color
   */
  static lchToHex(L: number, C: number, h: number): HexColor {
    return ColorConverter.lchToHex(L, C, h);
  }

  // ============================================================================
  // HSL Color Space
  // ============================================================================

  /**
   * Convert RGB to HSL
   * @example rgbToHsl(255, 0, 0) -> { h: 0, s: 100, l: 50 }
   */
  static rgbToHsl(r: number, g: number, b: number): HSL {
    return ColorConverter.rgbToHsl(r, g, b);
  }

  /**
   * Convert hex color to HSL
   */
  static hexToHsl(hex: string): HSL {
    return ColorConverter.hexToHsl(hex);
  }

  /**
   * Convert HSL to RGB
   * @example hslToRgb(0, 100, 50) -> { r: 255, g: 0, b: 0 }
   */
  static hslToRgb(h: number, s: number, l: number): RGB {
    return ColorConverter.hslToRgb(h, s, l);
  }

  /**
   * Convert HSL to hex color
   */
  static hslToHex(h: number, s: number, l: number): HexColor {
    return ColorConverter.hslToHex(h, s, l);
  }

  // ============================================================================
  // Color Mixing (RGB, LAB, RYB, OKLAB, HSL)
  // ============================================================================

  /**
   * Mix two colors using RGB additive mixing (averaging)
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @returns Mixed color as hex
   */
  static mixColorsRgb(hex1: string, hex2: string, ratio: number = 0.5): HexColor {
    const rgb1 = ColorConverter.hexToRgb(hex1);
    const rgb2 = ColorConverter.hexToRgb(hex2);

    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * ratio);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * ratio);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * ratio);

    return ColorConverter.rgbToHex(r, g, b);
  }

  /**
   * Mix two colors using LAB perceptually uniform mixing
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @returns Mixed color as hex
   */
  static mixColorsLab(hex1: string, hex2: string, ratio: number = 0.5): HexColor {
    const lab1 = ColorConverter.hexToLab(hex1);
    const lab2 = ColorConverter.hexToLab(hex2);

    const L = lab1.L + (lab2.L - lab1.L) * ratio;
    const a = lab1.a + (lab2.a - lab1.a) * ratio;
    const b = lab1.b + (lab2.b - lab1.b) * ratio;

    return ColorConverter.labToHex(L, a, b);
  }

  // ============================================================================
  // RYB Color Mixing (delegated to RybColorMixer)
  // ============================================================================

  /**
   * Mix two colors using RYB (Red-Yellow-Blue) subtractive color mixing
   *
   * This produces results similar to mixing physical paints:
   * - Blue + Yellow = Green (not gray like in RGB)
   * - Red + Yellow = Orange
   * - Red + Blue = Violet
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @returns Mixed color as hex
   *
   * @example
   * // Mix blue and yellow to get green
   * ColorService.mixColorsRyb('#0000FF', '#FFFF00') // Returns greenish color
   */
  static mixColorsRyb(hex1: string, hex2: string, ratio: number = 0.5): HexColor {
    return RybColorMixer.mixColors(hex1, hex2, ratio);
  }

  /**
   * Convert RYB (Red-Yellow-Blue) to RGB
   * Uses trilinear interpolation in the Gossett-Chen color cube
   *
   * @param r Red component (0-255)
   * @param y Yellow component (0-255)
   * @param b Blue component (0-255)
   * @returns RGB color
   */
  static rybToRgb(r: number, y: number, b: number): RGB {
    return RybColorMixer.rybToRgb(r, y, b);
  }

  /**
   * Convert RGB to RYB (Red-Yellow-Blue)
   * Uses Newton-Raphson iterative approximation
   *
   * @param r Red component (0-255)
   * @param g Green component (0-255)
   * @param b Blue component (0-255)
   * @returns RYB color
   */
  static rgbToRyb(r: number, g: number, b: number): RYB {
    return RybColorMixer.rgbToRyb(r, g, b);
  }

  /**
   * Convert hex color to RYB
   */
  static hexToRyb(hex: string): RYB {
    return RybColorMixer.hexToRyb(hex);
  }

  /**
   * Convert RYB to hex color
   */
  static rybToHex(r: number, y: number, b: number): HexColor {
    return RybColorMixer.rybToHex(r, y, b);
  }

  // ============================================================================
  // Advanced Color Mixing (OKLAB, OKLCH, LCH, HSL)
  // ============================================================================

  /**
   * Mix two colors using OKLAB perceptually uniform mixing
   *
   * OKLAB produces more intuitive results than LAB for complementary colors:
   * - Blue + Yellow = Green (not pink like LAB)
   * - Smooth, vibrant gradients without muddy midpoints
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @returns Mixed color as hex
   *
   * @example
   * // Mix blue and yellow to get green (not pink like LAB)
   * ColorService.mixColorsOklab('#0000FF', '#FFFF00') // Returns green-ish color
   */
  static mixColorsOklab(hex1: string, hex2: string, ratio: number = 0.5): HexColor {
    const oklab1 = ColorConverter.hexToOklab(hex1);
    const oklab2 = ColorConverter.hexToOklab(hex2);

    const L = oklab1.L + (oklab2.L - oklab1.L) * ratio;
    const a = oklab1.a + (oklab2.a - oklab1.a) * ratio;
    const b = oklab1.b + (oklab2.b - oklab1.b) * ratio;

    return ColorConverter.oklabToHex(L, a, b);
  }

  /**
   * Hue interpolation method for cylindrical color spaces
   * - 'shorter': Take the shorter arc around the hue wheel (default)
   * - 'longer': Take the longer arc around the hue wheel
   * - 'increasing': Always go clockwise (increasing hue values)
   * - 'decreasing': Always go counter-clockwise (decreasing hue values)
   */
  static interpolateHue(
    h1: number,
    h2: number,
    ratio: number,
    method: 'shorter' | 'longer' | 'increasing' | 'decreasing' = 'shorter'
  ): number {
    let diff = h2 - h1;

    switch (method) {
      case 'shorter':
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        break;
      case 'longer':
        if (diff > 0 && diff < 180) diff -= 360;
        if (diff < 0 && diff > -180) diff += 360;
        break;
      case 'increasing':
        if (diff < 0) diff += 360;
        break;
      case 'decreasing':
        if (diff > 0) diff -= 360;
        break;
    }

    return (((h1 + diff * ratio) % 360) + 360) % 360;
  }

  /**
   * Mix two colors using OKLCH cylindrical mixing
   *
   * OKLCH provides control over hue interpolation direction,
   * useful for creating gradients that go "through" specific colors.
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @param hueMethod Hue interpolation method ('shorter' | 'longer' | 'increasing' | 'decreasing')
   * @returns Mixed color as hex
   */
  static mixColorsOklch(
    hex1: string,
    hex2: string,
    ratio: number = 0.5,
    hueMethod: 'shorter' | 'longer' | 'increasing' | 'decreasing' = 'shorter'
  ): HexColor {
    const oklch1 = ColorConverter.hexToOklch(hex1);
    const oklch2 = ColorConverter.hexToOklch(hex2);

    const L = oklch1.L + (oklch2.L - oklch1.L) * ratio;
    const C = oklch1.C + (oklch2.C - oklch1.C) * ratio;
    const h = this.interpolateHue(oklch1.h, oklch2.h, ratio, hueMethod);

    return ColorConverter.oklchToHex(L, C, h);
  }

  /**
   * Mix two colors using LCH cylindrical mixing
   *
   * LCH is the cylindrical form of CIE LAB, providing hue control
   * for perceptual mixing. Note: May produce unexpected hues for
   * blue+yellow due to LAB's red bias (use OKLCH for better results).
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @param hueMethod Hue interpolation method ('shorter' | 'longer' | 'increasing' | 'decreasing')
   * @returns Mixed color as hex
   */
  static mixColorsLch(
    hex1: string,
    hex2: string,
    ratio: number = 0.5,
    hueMethod: 'shorter' | 'longer' | 'increasing' | 'decreasing' = 'shorter'
  ): HexColor {
    const lch1 = ColorConverter.hexToLch(hex1);
    const lch2 = ColorConverter.hexToLch(hex2);

    const L = lch1.L + (lch2.L - lch1.L) * ratio;
    const C = lch1.C + (lch2.C - lch1.C) * ratio;
    const h = this.interpolateHue(lch1.h, lch2.h, ratio, hueMethod);

    return ColorConverter.lchToHex(L, C, h);
  }

  /**
   * Mix two colors using HSL hue averaging
   *
   * Simple and intuitive mixing based on hue wheel position.
   * Blue + Yellow = Spring Green (hue ~150°).
   * Results may be over-saturated compared to perceptual methods.
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @param hueMethod Hue interpolation method ('shorter' | 'longer' | 'increasing' | 'decreasing')
   * @returns Mixed color as hex
   */
  static mixColorsHsl(
    hex1: string,
    hex2: string,
    ratio: number = 0.5,
    hueMethod: 'shorter' | 'longer' | 'increasing' | 'decreasing' = 'shorter'
  ): HexColor {
    const hsl1 = ColorConverter.hexToHsl(hex1);
    const hsl2 = ColorConverter.hexToHsl(hex2);

    const h = this.interpolateHue(hsl1.h, hsl2.h, ratio, hueMethod);
    const s = hsl1.s + (hsl2.s - hsl1.s) * ratio;
    const l = hsl1.l + (hsl2.l - hsl1.l) * ratio;

    return ColorConverter.hslToHex(h, s, l);
  }

  /**
   * Mix two colors using HSV hue averaging
   *
   * Similar to HSL but uses Value instead of Lightness.
   * Useful when working with existing HSV-based workflows.
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @param hueMethod Hue interpolation method ('shorter' | 'longer' | 'increasing' | 'decreasing')
   * @returns Mixed color as hex
   */
  static mixColorsHsv(
    hex1: string,
    hex2: string,
    ratio: number = 0.5,
    hueMethod: 'shorter' | 'longer' | 'increasing' | 'decreasing' = 'shorter'
  ): HexColor {
    const hsv1 = ColorConverter.hexToHsv(hex1);
    const hsv2 = ColorConverter.hexToHsv(hex2);

    const h = this.interpolateHue(hsv1.h, hsv2.h, ratio, hueMethod);
    const s = hsv1.s + (hsv2.s - hsv1.s) * ratio;
    const v = hsv1.v + (hsv2.v - hsv1.v) * ratio;

    return ColorConverter.hsvToHex(h, s, v);
  }

  // ============================================================================
  // Spectral Mixing (Kubelka-Munk Theory - Realistic Paint Mixing)
  // ============================================================================

  /**
   * Mix two colors using Kubelka-Munk spectral mixing
   *
   * This is the most physically accurate color mixing method available,
   * simulating how real pigments and paints interact with light.
   *
   * Key characteristics:
   * - Based on light absorption and scattering theory
   * - Blue + Yellow = Green (like real paint!)
   * - More realistic tinting and shading
   * - Uses spectral reflectance curves (380-750nm)
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @returns Mixed color as hex
   *
   * @example
   * // Mix blue and yellow to get green (like real paint)
   * ColorService.mixColorsSpectral('#0000FF', '#FFFF00')
   */
  static mixColorsSpectral(hex1: string, hex2: string, ratio: number = 0.5): HexColor {
    return SpectralMixer.mixColors(hex1, hex2, ratio);
  }

  /**
   * Mix multiple colors using Kubelka-Munk spectral mixing
   *
   * @param colors Array of hex colors to mix
   * @param weights Optional array of weights (defaults to equal weights)
   * @returns Mixed color as hex
   */
  static mixMultipleSpectral(colors: string[], weights?: number[]): HexColor {
    return SpectralMixer.mixMultiple(colors, weights);
  }

  /**
   * Generate a gradient using spectral mixing
   *
   * Creates a series of colors that transition smoothly using
   * Kubelka-Munk theory for realistic blending.
   *
   * @param hex1 Starting color
   * @param hex2 Ending color
   * @param steps Number of colors in the gradient
   * @returns Array of hex colors
   */
  static gradientSpectral(hex1: string, hex2: string, steps: number): HexColor[] {
    return SpectralMixer.gradient(hex1, hex2, steps);
  }

  /**
   * Check if spectral mixing is available
   *
   * @returns true if spectral.js is loaded and functional
   */
  static isSpectralAvailable(): boolean {
    return SpectralMixer.isAvailable();
  }
}

// Re-export RYB type for consumers
export type { RYB } from './color/RybColorMixer.js';
