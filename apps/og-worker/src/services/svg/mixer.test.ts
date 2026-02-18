/**
 * Tests for Mixer Tool OG Image Generator
 *
 * @module mixer.test
 */

import { describe, it, expect } from 'vitest';
import { generateMixerOG } from './mixer';
import { dyeService } from './dye-helpers';

describe('mixer SVG generator', () => {
  // Get valid dye IDs for testing
  const getValidDyeIds = (): { a: number; b: number; c: number } => {
    const allDyes = dyeService.getAllDyes();
    return {
      a: allDyes[0]?.itemID ?? 5771,
      b: allDyes[1]?.itemID ?? 5772,
      c: allDyes[2]?.itemID ?? 5773,
    };
  };

  describe('generateMixerOG', () => {
    describe('2-dye mix', () => {
      it('should generate valid SVG for valid dyes', () => {
        const { a, b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          ratio: 60,
        });

        expect(result).toContain('<svg');
        expect(result).toContain('</svg>');
        expect(result).toContain('DYE MIXER');
      });

      it('should include ratio in subtitle', () => {
        const { a, b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          ratio: 60,
        });

        expect(result).toContain('60/40 BLEND');
      });

      it('should include percentage labels', () => {
        const { a, b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          ratio: 70,
        });

        expect(result).toContain('70%');
        expect(result).toContain('30%');
      });

      it('should include + and = operators', () => {
        const { a, b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          ratio: 50,
        });

        expect(result).toContain('+</text>');
        expect(result).toContain('=</text>');
      });

      it('should include RESULT label', () => {
        const { a, b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          ratio: 50,
        });

        expect(result).toContain('RESULT');
      });

      it('should include closest match info', () => {
        const { a, b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          ratio: 50,
        });

        // Should show closest match with ≈
        expect(result).toContain('≈');
        // Should show delta value
        expect(result).toContain('Δ');
      });

      it('should include dye names', () => {
        const allDyes = dyeService.getAllDyes();
        const dyeA = allDyes[0];
        const dyeB = allDyes[1];

        const result = generateMixerOG({
          dyeAId: dyeA.itemID,
          dyeBId: dyeB.itemID,
          ratio: 50,
        });

        // Names may be truncated
        expect(result).toContain(dyeA.name.slice(0, 10));
        expect(result).toContain(dyeB.name.slice(0, 10));
      });

      it('should include algorithm when provided', () => {
        const { a, b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          ratio: 50,
          algorithm: 'euclidean',
        });

        expect(result).toContain('EUCLIDEAN');
      });
    });

    describe('3-dye mix', () => {
      it('should generate valid SVG for 3 valid dyes', () => {
        const { a, b, c } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          dyeCId: c,
          ratio: 50, // Ratio ignored for 3-dye
        });

        expect(result).toContain('<svg');
        expect(result).toContain('</svg>');
        expect(result).toContain('DYE MIXER');
      });

      it('should show 3-Dye Blend subtitle', () => {
        const { a, b, c } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          dyeCId: c,
          ratio: 50,
        });

        expect(result).toContain('3-DYE BLEND');
      });

      it('should include all three dye names', () => {
        const allDyes = dyeService.getAllDyes();
        const dyeA = allDyes[0];
        const dyeB = allDyes[1];
        const dyeC = allDyes[2];

        const result = generateMixerOG({
          dyeAId: dyeA.itemID,
          dyeBId: dyeB.itemID,
          dyeCId: dyeC.itemID,
          ratio: 50,
        });

        expect(result).toContain(dyeA.name.slice(0, 8));
        expect(result).toContain(dyeB.name.slice(0, 8));
        expect(result).toContain(dyeC.name.slice(0, 8));
      });

      it('should include two + operators', () => {
        const { a, b, c } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          dyeCId: c,
          ratio: 50,
        });

        const plusMatches = result.match(/>\+<\/text>/g) || [];
        expect(plusMatches.length).toBe(2);
      });

      it('should include arrow pointing to result', () => {
        const { a, b, c } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          dyeCId: c,
          ratio: 50,
        });

        expect(result).toContain('▼');
      });

      it('should fall back to 2-dye mix if dyeC not found', () => {
        const { a, b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          dyeCId: 999999, // Invalid
          ratio: 60,
        });

        // Should show 2-dye blend subtitle
        expect(result).toContain('60/40 BLEND');
      });
    });

    describe('fallback', () => {
      it('should generate fallback for invalid dye A', () => {
        const { b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: 999999,
          dyeBId: b,
          ratio: 50,
        });

        expect(result).toContain('Mix Dye Colors');
      });

      it('should generate fallback for invalid dye B', () => {
        const { a } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: 999999,
          ratio: 50,
        });

        expect(result).toContain('Mix Dye Colors');
      });

      it('should generate fallback for both invalid dyes', () => {
        const result = generateMixerOG({
          dyeAId: 999999,
          dyeBId: 999998,
          ratio: 50,
        });

        expect(result).toContain('Mix Dye Colors');
        expect(result).toContain('Blend two FFXIV dyes');
      });

      it('should show example mixing visualization', () => {
        const result = generateMixerOG({
          dyeAId: 999999,
          dyeBId: 999998,
          ratio: 50,
        });

        // Example has + and = operators
        expect(result).toContain('+</text>');
        expect(result).toContain('=</text>');
      });
    });

    describe('ratio handling', () => {
      it('should handle 0% ratio', () => {
        const { a, b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          ratio: 0,
        });

        expect(result).toContain('0%');
        expect(result).toContain('100%');
      });

      it('should handle 100% ratio', () => {
        const { a, b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          ratio: 100,
        });

        expect(result).toContain('100%');
        expect(result).toContain('0%');
      });

      it('should handle 50/50 ratio', () => {
        const { a, b } = getValidDyeIds();
        const result = generateMixerOG({
          dyeAId: a,
          dyeBId: b,
          ratio: 50,
        });

        // Subtitle is uppercased
        expect(result).toContain('50/50 BLEND');
      });
    });
  });
});
