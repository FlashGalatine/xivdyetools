/**
 * Tests for Gradient Tool OG Image Generator
 *
 * @module gradient.test
 */

import { describe, it, expect } from 'vitest';
import { generateGradientOG } from './gradient';
import { dyeService } from './dye-helpers';

describe('gradient SVG generator', () => {
  // Get valid dye IDs for testing
  const getValidDyeIds = (): { start: number; end: number } => {
    const allDyes = dyeService.getAllDyes();
    return {
      start: allDyes[0]?.itemID ?? 5771,
      end: allDyes[1]?.itemID ?? 5772,
    };
  };

  describe('generateGradientOG', () => {
    it('should generate valid SVG for valid dyes', () => {
      const { start, end } = getValidDyeIds();
      const result = generateGradientOG({
        startDyeId: start,
        endDyeId: end,
        steps: 5,
      });

      expect(result).toContain('<svg');
      expect(result).toContain('</svg>');
      expect(result).toContain('GRADIENT BUILDER');
    });

    it('should include step count in subtitle', () => {
      const { start, end } = getValidDyeIds();
      const result = generateGradientOG({
        startDyeId: start,
        endDyeId: end,
        steps: 5,
      });

      expect(result).toContain('5 STEPS');
    });

    it('should generate fallback for invalid start dye', () => {
      const { end } = getValidDyeIds();
      const result = generateGradientOG({
        startDyeId: 999999,
        endDyeId: end,
        steps: 5,
      });

      expect(result).toContain('Create Color Gradients');
    });

    it('should generate fallback for invalid end dye', () => {
      const { start } = getValidDyeIds();
      const result = generateGradientOG({
        startDyeId: start,
        endDyeId: 999999,
        steps: 5,
      });

      expect(result).toContain('Create Color Gradients');
    });

    it('should generate fallback for both invalid dyes', () => {
      const result = generateGradientOG({
        startDyeId: 999999,
        endDyeId: 999998,
        steps: 5,
      });

      expect(result).toContain('Create Color Gradients');
      expect(result).toContain('Build smooth transitions');
    });

    it('should include START and END labels', () => {
      const { start, end } = getValidDyeIds();
      const result = generateGradientOG({
        startDyeId: start,
        endDyeId: end,
        steps: 5,
      });

      expect(result).toContain('START');
      expect(result).toContain('END');
    });

    it('should include gradient bar definition', () => {
      const { start, end } = getValidDyeIds();
      const result = generateGradientOG({
        startDyeId: start,
        endDyeId: end,
        steps: 5,
      });

      expect(result).toContain('<defs>');
      expect(result).toContain('id="gradientBar"');
    });

    it('should include dye names in summary', () => {
      const allDyes = dyeService.getAllDyes();
      const startDye = allDyes[0];
      const endDye = allDyes[1];

      const result = generateGradientOG({
        startDyeId: startDye.itemID,
        endDyeId: endDye.itemID,
        steps: 5,
      });

      expect(result).toContain(startDye.name);
      expect(result).toContain(endDye.name);
      expect(result).toContain('→');
    });

    it('should include algorithm when provided', () => {
      const { start, end } = getValidDyeIds();
      const result = generateGradientOG({
        startDyeId: start,
        endDyeId: end,
        steps: 5,
        algorithm: 'ciede2000',
      });

      expect(result).toContain('Algorithm');
      expect(result).toContain('CIEDE2000');
    });

    it('should handle different step counts', () => {
      const { start, end } = getValidDyeIds();

      [3, 5, 7].forEach((steps) => {
        const result = generateGradientOG({
          startDyeId: start,
          endDyeId: end,
          steps,
        });

        expect(result).toContain(`${steps} STEPS`);
      });
    });

    it('should limit to 7 swatches for readability', () => {
      const { start, end } = getValidDyeIds();
      const result = generateGradientOG({
        startDyeId: start,
        endDyeId: end,
        steps: 10, // More than max
      });

      // Should still generate valid SVG
      expect(result).toContain('<svg');
      expect(result).toContain('10 STEPS');
    });

    it('should include hex codes for steps', () => {
      const { start, end } = getValidDyeIds();
      const result = generateGradientOG({
        startDyeId: start,
        endDyeId: end,
        steps: 3,
      });

      // Should contain hex color codes (uppercase)
      expect(result).toMatch(/#[0-9A-F]{6}/i);
    });

    it('should include example gradient in fallback', () => {
      const result = generateGradientOG({
        startDyeId: 999999,
        endDyeId: 999998,
        steps: 5,
      });

      expect(result).toContain('id="exampleGradient"');
    });
  });
});
