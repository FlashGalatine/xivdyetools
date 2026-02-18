/**
 * Colorblindness Simulator
 * Per R-4: Focused class for colorblindness simulation
 * Uses Brettel 1997 transformation matrices
 */

import type { RGB, HexColor, VisionType } from '../../types/index.js';
import { ErrorCode, AppError } from '../../types/index.js';
import { BRETTEL_MATRICES } from '../../constants/index.js';
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
      return cached;
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
    return result;
  }

  /**
   * Simulate colorblindness on a hex color
   */
  static simulateColorblindnessHex(hex: string, visionType: VisionType): HexColor {
    const rgb = ColorConverter.hexToRgb(hex);
    const simulated = this.simulateColorblindness(rgb, visionType);
    return ColorConverter.rgbToHex(simulated.r, simulated.g, simulated.b);
  }
}
