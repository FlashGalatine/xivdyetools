/**
 * Tests for Comparison Tool OG Image Generator
 *
 * @module comparison.test
 */

import { describe, it, expect } from 'vitest';
import { generateComparisonOG } from './comparison';
import { dyeService } from './dye-helpers';

describe('comparison SVG generator', () => {
  // Get valid dye IDs for testing
  const getValidDyeIds = (count: number): number[] => {
    const allDyes = dyeService.getAllDyes();
    return allDyes.slice(0, count).map((d) => d.itemID);
  };

  describe('generateComparisonOG', () => {
    it('should generate valid SVG for single dye', () => {
      const [dyeId] = getValidDyeIds(1);
      const result = generateComparisonOG({ dyeIds: [dyeId] });

      expect(result).toContain('<svg');
      expect(result).toContain('</svg>');
      expect(result).toContain('COMPARISON');
    });

    it('should generate valid SVG for multiple dyes', () => {
      const dyeIds = getValidDyeIds(3);
      const result = generateComparisonOG({ dyeIds });

      expect(result).toContain('<svg');
      expect(result).toContain('COMPARISON');
    });

    it('should show correct count in subtitle for 1 dye', () => {
      const [dyeId] = getValidDyeIds(1);
      const result = generateComparisonOG({ dyeIds: [dyeId] });

      expect(result).toContain('1 DYE COMPARED');
    });

    it('should show correct count in subtitle for multiple dyes', () => {
      const dyeIds = getValidDyeIds(3);
      const result = generateComparisonOG({ dyeIds });

      expect(result).toContain('3 DYES COMPARED');
    });

    it('should limit to 4 dyes', () => {
      const dyeIds = getValidDyeIds(6);
      const result = generateComparisonOG({ dyeIds });

      expect(result).toContain('4 DYES COMPARED');
    });

    it('should include dye names', () => {
      const allDyes = dyeService.getAllDyes();
      const testDye = allDyes[0];

      const result = generateComparisonOG({ dyeIds: [testDye.itemID] });

      // Name may be truncated
      expect(result).toContain(testDye.name.slice(0, 12));
    });

    it('should include hex codes for large swatches', () => {
      const [dyeId] = getValidDyeIds(1);
      const result = generateComparisonOG({ dyeIds: [dyeId] });

      // Single dye has 220px swatch (>= 150), so hex inside
      expect(result).toMatch(/#[0-9A-F]{6}/i);
    });

    it('should include category', () => {
      const allDyes = dyeService.getAllDyes();
      const testDye = allDyes[0];

      const result = generateComparisonOG({ dyeIds: [testDye.itemID] });

      expect(result).toContain(testDye.category);
    });

    it('should scale swatch size based on count', () => {
      // 1 dye = 220px, uses largest swatch
      const result1 = generateComparisonOG({ dyeIds: getValidDyeIds(1) });
      expect(result1).toContain('height="220"'); // Swatch is square

      // 2 dyes = 180px
      const result2 = generateComparisonOG({ dyeIds: getValidDyeIds(2) });
      expect(result2).toContain('height="180"');

      // 3 dyes = 150px
      const result3 = generateComparisonOG({ dyeIds: getValidDyeIds(3) });
      expect(result3).toContain('height="150"');

      // 4 dyes = 130px
      const result4 = generateComparisonOG({ dyeIds: getValidDyeIds(4) });
      expect(result4).toContain('height="130"');
    });

    it('should show hex below swatch for small swatches', () => {
      const dyeIds = getValidDyeIds(4);
      const result = generateComparisonOG({ dyeIds });

      // 4 dyes have 130px swatches (< 150), so hex shown below
      // Multiple hex codes should appear
      const hexMatches = result.match(/#[0-9A-F]{6}/gi) || [];
      expect(hexMatches.length).toBeGreaterThan(0);
    });

    describe('fallback', () => {
      it('should generate fallback for empty dyes array', () => {
        const result = generateComparisonOG({ dyeIds: [] });

        expect(result).toContain('Compare Dyes Side-by-Side');
        expect(result).toContain('Select up to 4 dyes');
      });

      it('should generate fallback for all invalid dyes', () => {
        const result = generateComparisonOG({ dyeIds: [999999, 999998] });

        expect(result).toContain('Compare Dyes Side-by-Side');
      });

      it('should show example swatches in fallback', () => {
        const result = generateComparisonOG({ dyeIds: [] });

        // Example colors
        expect(result).toContain('#F2F2F2'); // White
        expect(result).toContain('#8A2A37'); // Red
        expect(result).toContain('#252A42'); // Blue
        expect(result).toContain('#C8B374'); // Yellow
      });
    });

    it('should filter out invalid dye IDs', () => {
      const validIds = getValidDyeIds(2);
      const result = generateComparisonOG({
        dyeIds: [validIds[0], 999999, validIds[1]],
      });

      // Should only show 2 valid dyes
      expect(result).toContain('2 DYES COMPARED');
    });
  });
});
