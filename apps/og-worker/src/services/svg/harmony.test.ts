/**
 * Tests for Harmony Tool OG Image Generator
 *
 * @module harmony.test
 */

import { describe, it, expect } from 'vitest';
import { generateHarmonyOG, type HarmonyOGOptions } from './harmony';
import { dyeService } from './dye-helpers';

describe('harmony SVG generator', () => {
  // Get a known valid dye for testing
  const getValidDyeId = (): number => {
    const allDyes = dyeService.getAllDyes();
    return allDyes[0]?.itemID ?? 5771;
  };

  describe('generateHarmonyOG', () => {
    it('should generate valid SVG for valid dye', () => {
      const dyeId = getValidDyeId();
      const result = generateHarmonyOG({
        dyeId,
        harmonyType: 'complementary',
      });

      expect(result).toContain('<svg');
      expect(result).toContain('</svg>');
      expect(result).toContain('HARMONY EXPLORER');
    });

    it('should include harmony type in output', () => {
      const dyeId = getValidDyeId();
      const result = generateHarmonyOG({
        dyeId,
        harmonyType: 'tetradic',
      });

      expect(result).toContain('TETRADIC');
    });

    it('should generate fallback for invalid dye', () => {
      const result = generateHarmonyOG({
        dyeId: 999999,
        harmonyType: 'complementary',
      });

      expect(result).toContain('<svg');
      expect(result).toContain('Explore Color Harmonies');
    });

    it('should handle all harmony types', () => {
      const dyeId = getValidDyeId();
      const harmonyTypes = [
        'complementary',
        'analogous',
        'triadic',
        'split-complementary',
        'tetradic',
        'square',
        'monochromatic',
        'compound',
        'shades',
      ] as const;

      harmonyTypes.forEach((harmonyType) => {
        const result = generateHarmonyOG({ dyeId, harmonyType });

        expect(result).toContain('<svg');
        expect(result).toContain('</svg>');
      });
    });

    it('should include INPUT label', () => {
      const dyeId = getValidDyeId();
      const result = generateHarmonyOG({
        dyeId,
        harmonyType: 'complementary',
      });

      expect(result).toContain('INPUT');
    });

    it('should include HARMONY MATCHES label', () => {
      const dyeId = getValidDyeId();
      const result = generateHarmonyOG({
        dyeId,
        harmonyType: 'complementary',
      });

      expect(result).toContain('HARMONY MATCHES');
    });

    it('should include dye name for valid dye', () => {
      const allDyes = dyeService.getAllDyes();
      const testDye = allDyes[0];

      const result = generateHarmonyOG({
        dyeId: testDye.itemID,
        harmonyType: 'complementary',
      });

      expect(result).toContain(testDye.name);
    });

    it('should include hex code for valid dye', () => {
      const allDyes = dyeService.getAllDyes();
      const testDye = allDyes[0];

      const result = generateHarmonyOG({
        dyeId: testDye.itemID,
        harmonyType: 'complementary',
      });

      expect(result.toUpperCase()).toContain(testDye.hex.toUpperCase().replace('#', ''));
    });

    it('should include category for valid dye', () => {
      const allDyes = dyeService.getAllDyes();
      const testDye = allDyes[0];

      const result = generateHarmonyOG({
        dyeId: testDye.itemID,
        harmonyType: 'complementary',
      });

      expect(result).toContain(testDye.category);
    });

    it('should include algorithm in footer', () => {
      const dyeId = getValidDyeId();
      const result = generateHarmonyOG({
        dyeId,
        harmonyType: 'complementary',
        algorithm: 'oklab',
      });

      expect(result).toContain('Algorithm');
      expect(result).toContain('OKLAB');
    });

    it('should show delta values for matches', () => {
      const dyeId = getValidDyeId();
      const result = generateHarmonyOG({
        dyeId,
        harmonyType: 'complementary',
      });

      // Delta values shown as Δ followed by number
      expect(result).toContain('Δ');
    });

    describe('harmony type name mapping', () => {
      const testCases: Array<{ type: HarmonyOGOptions['harmonyType']; expected: string }> = [
        { type: 'complementary', expected: 'COMPLEMENTARY' },
        { type: 'analogous', expected: 'ANALOGOUS' },
        { type: 'triadic', expected: 'TRIADIC' },
        { type: 'split-complementary', expected: 'SPLIT-COMPLEMENTARY' },
        { type: 'tetradic', expected: 'TETRADIC' },
        { type: 'square', expected: 'SQUARE' },
        { type: 'monochromatic', expected: 'MONOCHROMATIC' },
        { type: 'compound', expected: 'COMPOUND' },
        { type: 'shades', expected: 'SHADES' },
      ];

      testCases.forEach(({ type, expected }) => {
        it(`should display "${expected}" for harmony type "${type}"`, () => {
          const dyeId = getValidDyeId();
          const result = generateHarmonyOG({ dyeId, harmonyType: type });

          expect(result).toContain(expected);
        });
      });
    });

    it('should generate decorative circles in fallback', () => {
      const result = generateHarmonyOG({
        dyeId: 999999,
        harmonyType: 'complementary',
      });

      // Fallback includes decorative circles
      expect(result).toContain('<circle');
    });
  });
});
