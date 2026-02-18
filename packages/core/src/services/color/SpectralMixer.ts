/**
 * Spectral Color Mixer
 *
 * Wrapper for spectral.js library that provides Kubelka-Munk theory-based
 * realistic pigment/paint mixing. This produces results that closely match
 * how actual paints and pigments mix in the physical world.
 *
 * Key characteristics:
 * - Based on Kubelka-Munk light absorption/scattering theory
 * - Simulates how pigments interact with light
 * - Blue + Yellow = Green (like real paint!)
 * - Uses spectral reflectance curves (380-750nm)
 *
 * @module services/color/SpectralMixer
 */

// @ts-expect-error - spectral.js has no type definitions
import * as spectral from 'spectral.js';

import type { HexColor } from '../../types/index.js';
import { ColorConverter } from './ColorConverter.js';

/**
 * Spectral Color Mixer using Kubelka-Munk theory
 *
 * Provides realistic paint/pigment color mixing by simulating
 * how light interacts with pigmented materials.
 */
export class SpectralMixer {
  /**
   * Mix two colors using Kubelka-Munk spectral mixing
   *
   * This produces results similar to mixing physical paints:
   * - Blue + Yellow = Green (like mixing paints)
   * - More realistic tinting and shading
   * - Handles complementary colors naturally
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param ratio Mix ratio (0 = all hex1, 0.5 = equal mix, 1 = all hex2). Default: 0.5
   * @returns Mixed color as hex
   *
   * @example
   * // Mix blue and yellow to get green
   * SpectralMixer.mixColors('#0000FF', '#FFFF00') // Returns green-ish color
   */
  static mixColors(hex1: string, hex2: string, ratio: number = 0.5): HexColor {
    // Clamp ratio to valid range
    ratio = Math.max(0, Math.min(1, ratio));

    // Create spectral Color objects
    const color1 = new spectral.Color(hex1);
    const color2 = new spectral.Color(hex2);

    // Mix using Kubelka-Munk theory
    // The mix function takes [color, concentration] pairs
    // We use (1 - ratio) for color1 and ratio for color2
    const mixed = spectral.mix([color1, 1 - ratio], [color2, ratio]);

    // Convert to hex string
    // toString returns hex format by default with gamut mapping
    const hexResult = mixed.toString({ format: 'hex', method: 'map' }) as string;

    // Normalize to our HexColor format
    return ColorConverter.normalizeHex(hexResult);
  }

  /**
   * Mix multiple colors using Kubelka-Munk spectral mixing
   *
   * @param colors Array of hex colors to mix
   * @param weights Optional array of weights (defaults to equal weights)
   * @returns Mixed color as hex
   *
   * @example
   * // Mix three colors
   * SpectralMixer.mixMultiple(['#FF0000', '#00FF00', '#0000FF'])
   */
  static mixMultiple(colors: string[], weights?: number[]): HexColor {
    if (colors.length === 0) {
      throw new Error('At least one color is required');
    }

    if (colors.length === 1) {
      return ColorConverter.normalizeHex(colors[0]);
    }

    // Use equal weights if not provided
    const effectiveWeights = weights ?? colors.map(() => 1 / colors.length);

    // Normalize weights to sum to 1
    const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = effectiveWeights.map((w) => w / totalWeight);

    // Create spectral Color objects with weights
    const colorPairs: [typeof spectral.Color, number][] = colors.map((hex, i) => [
      new spectral.Color(hex),
      normalizedWeights[i],
    ]);

    // Mix using Kubelka-Munk theory
    const mixed = spectral.mix(...colorPairs);

    // Convert to hex string
    const hexResult = mixed.toString({ format: 'hex', method: 'map' }) as string;

    return ColorConverter.normalizeHex(hexResult);
  }

  /**
   * Generate a gradient palette using spectral mixing
   *
   * Creates a series of colors that transition smoothly between
   * two colors using Kubelka-Munk theory for realistic blending.
   *
   * @param hex1 Starting color
   * @param hex2 Ending color
   * @param steps Number of colors in the gradient (including start and end)
   * @returns Array of hex colors
   *
   * @example
   * // Generate a 5-step gradient from red to blue
   * SpectralMixer.gradient('#FF0000', '#0000FF', 5)
   */
  static gradient(hex1: string, hex2: string, steps: number): HexColor[] {
    if (steps < 2) {
      throw new Error('Gradient requires at least 2 steps');
    }

    const result: HexColor[] = [];

    for (let i = 0; i < steps; i++) {
      const ratio = i / (steps - 1);
      result.push(this.mixColors(hex1, hex2, ratio));
    }

    return result;
  }

  /**
   * Check if the spectral.js library is available
   *
   * @returns true if spectral.js is loaded and functional
   */
  static isAvailable(): boolean {
    try {
      return typeof spectral.Color === 'function' && typeof spectral.mix === 'function';
    } catch {
      return false;
    }
  }
}
