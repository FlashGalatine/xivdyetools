/**
 * Colorblindness Simulator
 * Per R-4: Focused class for colorblindness simulation
 * Uses Brettel 1997 transformation matrices
 */

import type { RGB, HexColor, VisionType } from '@xivdyetools/types';
import { ErrorCode, AppError } from '@xivdyetools/types';
import { BRETTEL_MATRICES, MACHADO_MATRICES } from '../../constants/index.js';
import { clamp, round, isValidRGB, LRUCache } from '../../utils/index.js';
import { ColorConverter } from './ColorConverter.js';

/**
 * Colorblindness simulator using Brettel 1997 matrices
 * Per R-4: Single Responsibility - colorblindness simulation only
 */
export class ColorblindnessSimulator {
  // Per P-1: LRU cache for colorblindness simulation
  private static readonly colorblindCache = new LRUCache<string, RGB>(1000);

  /**
   * Clear colorblindness cache
   */
  static clearCache(): void {
    this.colorblindCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { colorblind: number } {
    return {
      colorblind: this.colorblindCache.size,
    };
  }

  /**
   * Simulate colorblindness on an RGB color
   * Uses Brettel 1997 transformation matrices (pre-computed constants)
   * Per P-1: Cached by ${r},${g},${b}_${visionType} key
   * @example simulateColorblindness({ r: 255, g: 0, b: 0 }, 'deuteranopia')
   */
  static simulateColorblindness(rgb: RGB, visionType: VisionType): RGB {
    if (visionType === 'normal') {
      return { ...rgb };
    }

    if (!isValidRGB(rgb.r, rgb.g, rgb.b)) {
      throw new AppError(
        ErrorCode.INVALID_RGB_VALUE,
        'Invalid RGB values for colorblindness simulation',
        'error'
      );
    }

    // Per P-1: Cache key format: ${r},${g},${b}_${visionType}
    const cacheKey = `${rgb.r},${rgb.g},${rgb.b}_${visionType}`;

    // Check cache
    const cached = this.colorblindCache.get(cacheKey);
    if (cached) {
      // BUG-005 (2026-07-18 audit): defensive copy — protects the cache from
      // caller mutation
      return { ...cached };
    }

    // Per P-1: BRETTEL_MATRICES are already pre-computed constants (no recalculation needed)
    const matrix = BRETTEL_MATRICES[visionType];

    // Normalize RGB to 0-1 range
    const rNorm = rgb.r / 255;
    const gNorm = rgb.g / 255;
    const bNorm = rgb.b / 255;

    // Apply transformation matrix
    const transformedR = round(
      clamp((matrix[0][0] * rNorm + matrix[0][1] * gNorm + matrix[0][2] * bNorm) * 255, 0, 255)
    );
    const transformedG = round(
      clamp((matrix[1][0] * rNorm + matrix[1][1] * gNorm + matrix[1][2] * bNorm) * 255, 0, 255)
    );
    const transformedB = round(
      clamp((matrix[2][0] * rNorm + matrix[2][1] * gNorm + matrix[2][2] * bNorm) * 255, 0, 255)
    );

    const result = { r: transformedR, g: transformedG, b: transformedB };
    // Cache result
    this.colorblindCache.set(cacheKey, result);
    return { ...result };
  }

  /**
   * Simulate colorblindness on a hex color
   */
  static simulateColorblindnessHex(hex: string, visionType: VisionType): HexColor {
    const rgb = ColorConverter.hexToRgb(hex);
    const simulated = this.simulateColorblindness(rgb, visionType);
    return ColorConverter.rgbToHex(simulated.r, simulated.g, simulated.b);
  }

  /** sRGB electro-optical transfer (gamma expansion), 0-1 domain */
  private static srgbToLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  /** Inverse sRGB transfer (gamma compression), 0-1 domain */
  private static linearToSrgb(c: number): number {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  /**
   * Simulate colorblindness using the Machado et al. (2009) severity-1.0
   * matrices, applied in **linear RGB** as the model requires.
   *
   * This is the simulation path the 5.0 band calibration (SEPARATION cuts)
   * was computed against; the legacy Brettel path operates on gamma-encoded
   * values and produces different (less physiologically grounded) results.
   */
  static simulateColorblindnessMachado(rgb: RGB, visionType: VisionType): RGB {
    if (visionType === 'normal') {
      return { ...rgb };
    }

    if (!isValidRGB(rgb.r, rgb.g, rgb.b)) {
      throw new AppError(
        ErrorCode.INVALID_RGB_VALUE,
        'Invalid RGB values for colorblindness simulation',
        'error'
      );
    }

    const cacheKey = `m:${rgb.r},${rgb.g},${rgb.b}_${visionType}`;
    const cached = this.colorblindCache.get(cacheKey);
    if (cached) {
      return { ...cached };
    }

    const matrix = MACHADO_MATRICES[visionType];

    const rLin = this.srgbToLinear(rgb.r / 255);
    const gLin = this.srgbToLinear(rgb.g / 255);
    const bLin = this.srgbToLinear(rgb.b / 255);

    const toChannel = (row: readonly [number, number, number]): number => {
      const lin = clamp(row[0] * rLin + row[1] * gLin + row[2] * bLin, 0, 1);
      return round(clamp(this.linearToSrgb(lin) * 255, 0, 255));
    };

    const result = {
      r: toChannel(matrix[0]),
      g: toChannel(matrix[1]),
      b: toChannel(matrix[2]),
    };
    this.colorblindCache.set(cacheKey, result);
    return { ...result };
  }

  /**
   * Simulate colorblindness on a hex color via the Machado (2009) model
   */
  static simulateColorblindnessMachadoHex(hex: string, visionType: VisionType): HexColor {
    const rgb = ColorConverter.hexToRgb(hex);
    const simulated = this.simulateColorblindnessMachado(rgb, visionType);
    return ColorConverter.rgbToHex(simulated.r, simulated.g, simulated.b);
  }
}
