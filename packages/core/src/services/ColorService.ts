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
  CMYK,
} from '@xivdyetools/types';
import { ColorConverter, type DeltaEFormula } from './color/ColorConverter.js';
import type { MatchingMethod } from '../types/index.js';
import { ColorblindnessSimulator } from './color/ColorblindnessSimulator.js';
import { ColorAccessibility } from './color/ColorAccessibility.js';
import { ColorManipulator } from './color/ColorManipulator.js';
import { blendColors, interpolateHue } from '../blending/blending.js';
import { rgbToRyb as rgbToRybUnit, rybToRgb as rybToRgbUnit } from '../blending/conversions.js';
import type { RYB, HueMethod } from '../blending/types.js';

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
    // REFACTOR-015 (2026-07-18 audit): these two were returned at runtime but
    // omitted from the declared type, hiding them from TypeScript consumers
    rgbToLab: number;
    rgbToOklab: number;
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

  /**
   * Calculate "redmean" weighted RGB distance between two colors.
   * Low-cost perceptual approximation; 0 identical, ~765 white vs black.
   */
  static getRedmeanDistance(hex1: string, hex2: string): number {
    return ColorConverter.getRedmeanDistance(hex1, hex2);
  }

  /**
   * Distinguishability percentage: RGB distance rescaled to 0-100
   * (`round(distance / 441.67 × 100)`). Identical ranks to RGB distance —
   * a display unit, not a separate metric, and not a WCAG standard.
   */
  static getDistinguishabilityPercent(hex1: string, hex2: string): number {
    return ColorConverter.getDistinguishabilityPercent(hex1, hex2);
  }

  /**
   * Distance between two colors in a 5.0 matching-vocabulary method's native
   * unit — the one dispatch every surface shares (web readouts, bot cards,
   * OG images). `distinguish` returns the display-rounded integer percent;
   * for *ranking* use DyeSearch, which ranks distinguish by the unrounded
   * value so display ties never scramble an ordering.
   */
  static getDistanceForMethod(hex1: string, hex2: string, method: MatchingMethod): number {
    switch (method) {
      // The three perceptual methods share their spelling with DeltaEFormula
      // (DEAD-037, 2026-08-18 audit) — no translation switch needed.
      case 'ciede2000':
      case 'oklab':
      case 'cie76':
        return ColorConverter.getDeltaE(hex1, hex2, method);
      case 'redmean':
        return ColorConverter.getRedmeanDistance(hex1, hex2);
      case 'rgb':
        return ColorConverter.getColorDistance(hex1, hex2);
      case 'distinguish':
        return ColorConverter.getDistinguishabilityPercent(hex1, hex2);
    }
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

  /**
   * Simulate colorblindness using the Machado (2009) severity-1.0 model
   * (linear-RGB pipeline). The 5.0 SEPARATION band calibration uses this path.
   */
  static simulateColorblindnessMachado(rgb: RGB, visionType: VisionType): RGB {
    return ColorblindnessSimulator.simulateColorblindnessMachado(rgb, visionType);
  }

  /**
   * Simulate colorblindness on a hex color via the Machado (2009) model
   */
  static simulateColorblindnessMachadoHex(hex: string, visionType: VisionType): HexColor {
    return ColorblindnessSimulator.simulateColorblindnessMachadoHex(hex, visionType);
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
   * Rotate hue of a color in CIE LCh space (perceptual hue rotation).
   * Preserves perceived lightness/chroma; use for harmony "ideal hue" math.
   * @param degrees Amount to rotate hue (can be negative or positive)
   */
  static rotateHueLch(hex: string, degrees: number): HexColor {
    return ColorManipulator.rotateHueLch(hex, degrees);
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
   * @param formula DeltaE formula to use ('cie76', 'ciede2000' (alias: 'cie2000')
   *                or 'oklab'; default: 'cie76')
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

  /**
   * Convert RGB to CMYK (naive device-independent conversion)
   * @example rgbToCmyk(255, 0, 0) -> { c: 0, m: 100, y: 100, k: 0 }
   */
  static rgbToCmyk(r: number, g: number, b: number): CMYK {
    return ColorConverter.rgbToCmyk(r, g, b);
  }

  /**
   * Convert CMYK to RGB
   */
  static cmykToRgb(c: number, m: number, y: number, k: number): RGB {
    return ColorConverter.cmykToRgb(c, m, y, k);
  }

  /**
   * Convert hex color to CMYK
   */
  static hexToCmyk(hex: string): CMYK {
    return ColorConverter.hexToCmyk(hex);
  }

  /**
   * Convert CMYK to hex color
   */
  static cmykToHex(c: number, m: number, y: number, k: number): HexColor {
    return ColorConverter.cmykToHex(c, m, y, k);
  }

  // ============================================================================
  // Color Mixing — every mode delegates to `blending/blendColors`
  //
  // These six were independent re-implementations until 5.0.0. Five of them
  // happened to agree with `blendColors` byte-for-byte; `ryb` was a different
  // ALGORITHM and disagreed by up to ΔE₀₀ 38, so the same dye pair mixed one
  // colour on the web app and another on the Discord bot. Core is the single
  // source of truth for colour computation and a front end is a view onto it —
  // two functions with the same name returning different colours cannot both
  // be that source. `ColorService.blending-parity.test.ts` asserts the hexes
  // are identical, which is what stops them drifting apart again.
  //
  // ⚠️ CASE: the two surfaces have always disagreed on hex CASE — `blendColors`
  // emits lowercase, every `ColorService` method emits uppercase (the long-
  // standing `rgbToHex` delta documented in `conversions.equivalence.test.ts`).
  // Delegating naïvely would have flipped `mixColors*` to lowercase and broken
  // any caller comparing its result against an uppercase `dye.hex`. So the
  // delegation re-formats through `ColorConverter.rgbToHex`: same colour, each
  // surface keeps the case its callers already depend on.
  // ============================================================================

  /** Re-format a blend result in ColorService's uppercase hex convention. */
  private static fromBlend(result: { rgb: RGB }): HexColor {
    return ColorConverter.rgbToHex(result.rgb.r, result.rgb.g, result.rgb.b);
  }

  /**
   * Mix two colors by averaging the sRGB channels.
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @returns Mixed color as hex
   */
  static mixColorsRgb(hex1: string, hex2: string, ratio: number = 0.5): HexColor {
    return this.fromBlend(blendColors(hex1, hex2, 'rgb', ratio));
  }

  /**
   * Mix two colors in CIELAB.
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @returns Mixed color as hex
   */
  static mixColorsLab(hex1: string, hex2: string, ratio: number = 0.5): HexColor {
    return this.fromBlend(blendColors(hex1, hex2, 'lab', ratio));
  }

  // ============================================================================
  // RYB Color Mixing
  // ============================================================================

  /**
   * Mix two colors on the artist's Red-Yellow-Blue wheel.
   *
   * Blue + Yellow = Green, Red + Yellow = Orange, Red + Blue = Violet — the
   * subtractive relationships RGB averaging does not reproduce.
   *
   * Until 5.0.0 this ran the Gossett-Chen trilinear paint cube, which maps
   * into the convex hull of its eight corners. Pure green, blue, cyan, magenta
   * and true black sit OUTSIDE that hull, so they had no RYB pre-image and the
   * cube's added Newton-method inverse could not converge for them: mixing
   * such a dye with itself did not return that dye, on 53% of dye pairs and by
   * up to ΔE₀₀ 27.9. That is a defect visible in one drag of a 0-100% slider,
   * and no solver tuning fixes it — ColorAide documents the same limit on the
   * same cube. The chromatic-subtraction space this now uses inverts exactly.
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
    return this.fromBlend(blendColors(hex1, hex2, 'ryb', ratio));
  }

  /**
   * Convert RYB (Red-Yellow-Blue) to RGB.
   *
   * ⚠️ The axes changed meaning in 5.0.0. These are coordinates in the
   * chromatic-subtraction space `mixColorsRyb` mixes in, where BLACK is at the
   * origin; the retired Gossett-Chen cube put WHITE there. Stored RYB triples
   * from 4.x do not mean the same thing.
   *
   * @param r Red component (0-255)
   * @param y Yellow component (0-255)
   * @param b Blue component (0-255)
   * @returns RGB color
   */
  static rybToRgb(r: number, y: number, b: number): RGB {
    return rybToRgbUnit({ r: r / 255, y: y / 255, b: b / 255 });
  }

  /**
   * Convert RGB to RYB (Red-Yellow-Blue).
   *
   * The exact inverse of {@link ColorService.rybToRgb} — see its note on the
   * 5.0.0 change of axis convention. Components are 0-255 and may be
   * fractional; rounding them costs the exactness of the round trip.
   *
   * @param r Red component (0-255)
   * @param g Green component (0-255)
   * @param b Blue component (0-255)
   * @returns RYB color
   */
  static rgbToRyb(r: number, g: number, b: number): RYB {
    const ryb = rgbToRybUnit({ r, g, b });
    return { r: ryb.r * 255, y: ryb.y * 255, b: ryb.b * 255 };
  }

  /**
   * Convert hex color to RYB
   *
   * @public
   */
  static hexToRyb(hex: string): RYB {
    const rgb = ColorConverter.hexToRgb(hex);
    return this.rgbToRyb(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Convert RYB to hex color
   *
   * @public
   */
  static rybToHex(r: number, y: number, b: number): HexColor {
    const rgb = this.rybToRgb(r, y, b);
    return ColorConverter.rgbToHex(rgb.r, rgb.g, rgb.b);
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
    return this.fromBlend(blendColors(hex1, hex2, 'oklab', ratio));
  }

  /**
   * Hue interpolation method for cylindrical color spaces
   * - 'shorter': Take the shorter arc around the hue wheel (default)
   * - 'longer': Take the longer arc around the hue wheel
   * - 'increasing': Always go clockwise (increasing hue values)
   * - 'decreasing': Always go counter-clockwise (decreasing hue values)
   *
   * @public
   */
  static interpolateHue(
    h1: number,
    h2: number,
    ratio: number,
    method: HueMethod = 'shorter',
  ): number {
    return interpolateHue(h1, h2, ratio, method);
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
    hueMethod: HueMethod = 'shorter',
  ): HexColor {
    return this.fromBlend(blendColors(hex1, hex2, 'hsl', ratio, { hueMethod }));
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
    return this.fromBlend(blendColors(hex1, hex2, 'spectral', ratio));
  }
}

// Re-export RYB type for consumers
export type { RYB } from '../blending/types.js';
