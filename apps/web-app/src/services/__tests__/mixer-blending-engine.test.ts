/**
 * XIV Dye Tools - Mixer Blending Engine Unit Tests
 *
 * Tests the color blending algorithm functions for the mixer tool.
 *
 * @module services/__tests__/mixer-blending-engine.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  blendTwoColors,
  blendColors,
  calculateColorDistance,
} from '../mixer-blending-engine';
import type { MixingMode, MatchingMethod } from '@shared/tool-config-types';

// Mock the services
vi.mock('@services/index', () => ({
  ColorService: {
    mixColorsRgb: vi.fn((hex1: string, hex2: string, ratio: number) => '#7F7F7F'),
    mixColorsLab: vi.fn((hex1: string, hex2: string, ratio: number) => '#8080A0'),
    mixColorsOklab: vi.fn((hex1: string, hex2: string, ratio: number) => '#80A0B0'),
    mixColorsRyb: vi.fn((hex1: string, hex2: string, ratio: number) => '#808040'),
    mixColorsHsl: vi.fn((hex1: string, hex2: string, ratio: number) => '#80FF80'),
    mixColorsSpectral: vi.fn((hex1: string, hex2: string, ratio: number) => '#008000'),
    getColorDistance: vi.fn(() => 100),
  },
  dyeService: {
    getAllDyes: vi.fn(() => []),
  },
}));

vi.mock('@xivdyetools/core', () => ({
  ColorConverter: {
    getDeltaE: vi.fn((hex1: string, hex2: string, algorithm: string) => {
      if (algorithm === 'cie76') return 50;
      if (algorithm === 'cie2000') return 25;
      return 30;
    }),
    getDeltaE_Oklab: vi.fn(() => 15),
    getDeltaE_HyAB: vi.fn(() => 20),
    getDeltaE_OklchWeighted: vi.fn(() => 18),
  },
}));

describe('mixer-blending-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // blendTwoColors Tests
  // ============================================================================

  describe('blendTwoColors', () => {
    const hex1 = '#FF0000'; // Red
    const hex2 = '#0000FF'; // Blue

    it('should blend using RGB mode', async () => {
      const { ColorService } = await import('@services/index');

      blendTwoColors(hex1, hex2, 'rgb', 0.5);

      expect(ColorService.mixColorsRgb).toHaveBeenCalledWith(hex1, hex2, 0.5);
    });

    it('should blend using LAB mode', async () => {
      const { ColorService } = await import('@services/index');

      blendTwoColors(hex1, hex2, 'lab', 0.5);

      expect(ColorService.mixColorsLab).toHaveBeenCalledWith(hex1, hex2, 0.5);
    });

    it('should blend using OKLAB mode', async () => {
      const { ColorService } = await import('@services/index');

      blendTwoColors(hex1, hex2, 'oklab', 0.5);

      expect(ColorService.mixColorsOklab).toHaveBeenCalledWith(hex1, hex2, 0.5);
    });

    it('should blend using RYB mode', async () => {
      const { ColorService } = await import('@services/index');

      blendTwoColors(hex1, hex2, 'ryb', 0.5);

      expect(ColorService.mixColorsRyb).toHaveBeenCalledWith(hex1, hex2, 0.5);
    });

    it('should blend using HSL mode', async () => {
      const { ColorService } = await import('@services/index');

      blendTwoColors(hex1, hex2, 'hsl', 0.5);

      expect(ColorService.mixColorsHsl).toHaveBeenCalledWith(hex1, hex2, 0.5);
    });

    it('should blend using Spectral mode', async () => {
      const { ColorService } = await import('@services/index');

      blendTwoColors(hex1, hex2, 'spectral', 0.5);

      expect(ColorService.mixColorsSpectral).toHaveBeenCalledWith(hex1, hex2, 0.5);
    });

    it('should default to RYB for unknown mode', async () => {
      const { ColorService } = await import('@services/index');

      blendTwoColors(hex1, hex2, 'unknown' as MixingMode, 0.5);

      expect(ColorService.mixColorsRyb).toHaveBeenCalled();
    });

    it('should use default ratio of 0.5', async () => {
      const { ColorService } = await import('@services/index');

      blendTwoColors(hex1, hex2, 'rgb');

      expect(ColorService.mixColorsRgb).toHaveBeenCalledWith(hex1, hex2, 0.5);
    });

    it('should use custom ratio when provided', async () => {
      const { ColorService } = await import('@services/index');

      blendTwoColors(hex1, hex2, 'rgb', 0.75);

      expect(ColorService.mixColorsRgb).toHaveBeenCalledWith(hex1, hex2, 0.75);
    });
  });

  // ============================================================================
  // blendColors Tests
  // ============================================================================

  describe('blendColors', () => {
    it('should return black for empty array', () => {
      const result = blendColors([], 'rgb');

      expect(result).toBe('#000000');
    });

    it('should return the same color for single color array', () => {
      const result = blendColors(['#FF0000'], 'rgb');

      expect(result).toBe('#FF0000');
    });

    it('should blend two colors with equal weight', async () => {
      const { ColorService } = await import('@services/index');

      blendColors(['#FF0000', '#0000FF'], 'rgb');

      // First blend at 50/50 (ratio 0.5)
      expect(ColorService.mixColorsRgb).toHaveBeenCalledWith('#FF0000', '#0000FF', 0.5);
    });

    it('should blend multiple colors with correct ratios', async () => {
      const { ColorService } = await import('@services/index');

      blendColors(['#FF0000', '#00FF00', '#0000FF'], 'rgb');

      // First: Red + Green at 0.5 (each 50%)
      expect(ColorService.mixColorsRgb).toHaveBeenNthCalledWith(1, '#FF0000', '#00FF00', 0.5);
      // Second: Result + Blue at 0.333 (each color ends up at 33%)
      expect(ColorService.mixColorsRgb).toHaveBeenNthCalledWith(2, expect.any(String), '#0000FF', 1/3);
    });

    it('should blend four colors with correct ratios', async () => {
      const { ColorService } = await import('@services/index');

      blendColors(['#FF0000', '#00FF00', '#0000FF', '#FFFF00'], 'rgb');

      expect(ColorService.mixColorsRgb).toHaveBeenCalledTimes(3);
      // Last call should have ratio 1/4 = 0.25
      expect(ColorService.mixColorsRgb).toHaveBeenNthCalledWith(3, expect.any(String), '#FFFF00', 0.25);
    });
  });

  // ============================================================================
  // calculateColorDistance Tests
  // ============================================================================

  describe('calculateColorDistance', () => {
    const hex1 = '#FF0000';
    const hex2 = '#0000FF';

    it('should use RGB distance', async () => {
      const { ColorService } = await import('@services/index');

      const result = calculateColorDistance(hex1, hex2, 'rgb');

      expect(ColorService.getColorDistance).toHaveBeenCalledWith(hex1, hex2);
      expect(result).toBe(100);
    });

    it('should use CIE76 DeltaE', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'cie76');

      expect(ColorConverter.getDeltaE).toHaveBeenCalledWith(hex1, hex2, 'cie76');
      expect(result).toBe(50);
    });

    it('should use CIEDE2000 DeltaE', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'ciede2000');

      expect(ColorConverter.getDeltaE).toHaveBeenCalledWith(hex1, hex2, 'cie2000');
      expect(result).toBe(25);
    });

    it('should use OKLAB DeltaE', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'oklab');

      expect(ColorConverter.getDeltaE_Oklab).toHaveBeenCalledWith(hex1, hex2);
      expect(result).toBe(15);
    });

    it('should use HyAB DeltaE', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'hyab');

      expect(ColorConverter.getDeltaE_HyAB).toHaveBeenCalledWith(hex1, hex2);
      expect(result).toBe(20);
    });

    it('should use OKLCH weighted DeltaE', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'oklch-weighted');

      expect(ColorConverter.getDeltaE_OklchWeighted).toHaveBeenCalledWith(hex1, hex2);
      expect(result).toBe(18);
    });

    it('should default to OKLAB for unknown method', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'unknown' as MatchingMethod);

      expect(ColorConverter.getDeltaE_Oklab).toHaveBeenCalledWith(hex1, hex2);
      expect(result).toBe(15);
    });
  });
});
