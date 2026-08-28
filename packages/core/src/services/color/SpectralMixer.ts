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

import * as spectral from 'spectral.js';

import type { HexColor } from '@xivdyetools/types';
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
    const hexResult = mixed.toString({ format: 'hex', method: 'map' });

    // Normalize to our HexColor format
    return ColorConverter.normalizeHex(hexResult);
  }
}
