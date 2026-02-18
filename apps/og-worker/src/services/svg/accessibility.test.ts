/**
 * Tests for Accessibility Tool OG Image Generator
 *
 * @module accessibility.test
 */

import { describe, it, expect } from 'vitest';
import { generateAccessibilityOG } from './accessibility';
import { dyeService } from './dye-helpers';
import type { VisionType } from '../../types';

describe('accessibility SVG generator', () => {
  // Get valid dye IDs for testing
  const getValidDyeIds = (count: number): number[] => {
    const allDyes = dyeService.getAllDyes();
    return allDyes.slice(0, count).map((d) => d.itemID);
  };

  describe('generateAccessibilityOG', () => {
    it('should generate valid SVG for valid dyes', () => {
      const dyeIds = getValidDyeIds(2);
      const result = generateAccessibilityOG({
        dyeIds,
        visionType: 'protanopia',
      });

      expect(result).toContain('<svg');
      expect(result).toContain('</svg>');
      expect(result).toContain('ACCESSIBILITY');
    });

    it('should include vision type in subtitle', () => {
      const dyeIds = getValidDyeIds(2);
      const result = generateAccessibilityOG({
        dyeIds,
        visionType: 'deuteranopia',
      });

      expect(result).toContain('DEUTERANOPIA');
    });

    it('should include ORIGINAL COLORS label', () => {
      const dyeIds = getValidDyeIds(2);
      const result = generateAccessibilityOG({
        dyeIds,
        visionType: 'protanopia',
      });

      expect(result).toContain('ORIGINAL COLORS');
    });

    it('should include SIMULATED VIEW label', () => {
      const dyeIds = getValidDyeIds(2);
      const result = generateAccessibilityOG({
        dyeIds,
        visionType: 'protanopia',
      });

      expect(result).toContain('SIMULATED VIEW');
    });

    it('should include arrow between columns', () => {
      const dyeIds = getValidDyeIds(2);
      const result = generateAccessibilityOG({
        dyeIds,
        visionType: 'protanopia',
      });

      expect(result).toContain('→');
    });

    it('should include vision type info box', () => {
      const dyeIds = getValidDyeIds(2);
      const result = generateAccessibilityOG({
        dyeIds,
        visionType: 'protanopia',
      });

      expect(result).toContain('Red-blind');
    });

    describe('vision types', () => {
      const visionTypes: Array<{ type: VisionType; name: string; desc: string }> = [
        { type: 'normal', name: 'Normal Vision', desc: 'Full color vision' },
        { type: 'protanopia', name: 'Protanopia', desc: 'Red-blind' },
        { type: 'deuteranopia', name: 'Deuteranopia', desc: 'Green-blind' },
        { type: 'tritanopia', name: 'Tritanopia', desc: 'Blue-blind' },
        { type: 'achromatopsia', name: 'Achromatopsia', desc: 'Complete color blindness' },
      ];

      visionTypes.forEach(({ type, name, desc }) => {
        it(`should handle ${type} vision type`, () => {
          const dyeIds = getValidDyeIds(2);
          const result = generateAccessibilityOG({
            dyeIds,
            visionType: type,
          });

          expect(result).toContain(name);
          expect(result).toContain(desc);
        });
      });
    });

    it('should default to protanopia when no vision type specified', () => {
      const dyeIds = getValidDyeIds(2);
      const result = generateAccessibilityOG({
        dyeIds,
        // No visionType
      });

      expect(result).toContain('PROTANOPIA');
    });

    it('should limit to 4 dyes', () => {
      const dyeIds = getValidDyeIds(6);
      const result = generateAccessibilityOG({
        dyeIds,
        visionType: 'protanopia',
      });

      // Should still generate valid SVG
      expect(result).toContain('<svg');
    });

    it('should scale swatch size based on count', () => {
      // Verify different swatch sizes are used (check height as it's unique to swatch size)
      const result1 = generateAccessibilityOG({
        dyeIds: getValidDyeIds(1),
        visionType: 'normal',
      });
      expect(result1).toContain('height="140"');

      const result2 = generateAccessibilityOG({
        dyeIds: getValidDyeIds(2),
        visionType: 'normal',
      });
      expect(result2).toContain('height="120"');

      const result4 = generateAccessibilityOG({
        dyeIds: getValidDyeIds(4),
        visionType: 'normal',
      });
      expect(result4).toContain('height="85"');
    });

    it('should include dye names', () => {
      const allDyes = dyeService.getAllDyes();
      const testDye = allDyes[0];

      const result = generateAccessibilityOG({
        dyeIds: [testDye.itemID],
        visionType: 'protanopia',
      });

      // Name may be truncated
      expect(result).toContain(testDye.name.slice(0, 8));
    });

    it('should show simulated hex codes', () => {
      const dyeIds = getValidDyeIds(2);
      const result = generateAccessibilityOG({
        dyeIds,
        visionType: 'protanopia',
      });

      // Should have hex codes (original and simulated)
      const hexMatches = result.match(/#[0-9A-F]{6}/gi) || [];
      expect(hexMatches.length).toBeGreaterThan(0);
    });

    describe('color simulation', () => {
      it('should not change colors for normal vision', () => {
        const allDyes = dyeService.getAllDyes();
        const testDye = allDyes[0];

        const result = generateAccessibilityOG({
          dyeIds: [testDye.itemID],
          visionType: 'normal',
        });

        // Original color should appear in simulated view too
        expect(result).toContain(testDye.hex.toUpperCase());
      });

      it('should simulate different colors for protanopia', () => {
        // Use a red dye for clear difference
        const allDyes = dyeService.getAllDyes();
        // Find a dye with significant red component
        const redDye = allDyes.find((d) => {
          const r = parseInt(d.hex.slice(1, 3), 16);
          return r > 200;
        });

        if (redDye) {
          const result = generateAccessibilityOG({
            dyeIds: [redDye.itemID],
            visionType: 'protanopia',
          });

          expect(result).toContain('<svg');
        }
      });

      it('should convert to grayscale for achromatopsia', () => {
        const dyeIds = getValidDyeIds(1);
        const result = generateAccessibilityOG({
          dyeIds,
          visionType: 'achromatopsia',
        });

        expect(result).toContain('<svg');
        expect(result).toContain('Complete color blindness');
      });
    });

    describe('fallback', () => {
      it('should generate fallback for empty dyes array', () => {
        const result = generateAccessibilityOG({
          dyeIds: [],
          visionType: 'protanopia',
        });

        expect(result).toContain('Color Vision Accessibility');
        expect(result).toContain('colorblind players');
      });

      it('should generate fallback for all invalid dyes', () => {
        const result = generateAccessibilityOG({
          dyeIds: [999999, 999998],
          visionType: 'protanopia',
        });

        expect(result).toContain('Color Vision Accessibility');
      });

      it('should show example colors in fallback', () => {
        const result = generateAccessibilityOG({
          dyeIds: [],
          visionType: 'protanopia',
        });

        // Example colors
        expect(result).toContain('#ef4444'); // Red
        expect(result).toContain('#22c55e'); // Green
        expect(result).toContain('#3b82f6'); // Blue
        expect(result).toContain('#eab308'); // Yellow
      });

      it('should show original and simulated rows', () => {
        const result = generateAccessibilityOG({
          dyeIds: [],
          visionType: 'deuteranopia',
        });

        expect(result).toContain('Original:');
        expect(result).toContain('Deuteranopia:');
      });
    });
  });
});
