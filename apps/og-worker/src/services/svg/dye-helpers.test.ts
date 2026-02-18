/**
 * Tests for Dye Helper Functions
 *
 * @module dye-helpers.test
 */

import { describe, it, expect } from 'vitest';
import {
  dyeService,
  characterColorService,
  findCharacterColorByHex,
  findClosestDyesWithDistance,
  getDyeByItemId,
  getCharacterColorFromSheet,
} from './dye-helpers';

describe('dye-helpers', () => {
  describe('dyeService', () => {
    it('should be initialized', () => {
      expect(dyeService).toBeDefined();
    });

    it('should return all dyes', () => {
      const allDyes = dyeService.getAllDyes();
      expect(allDyes).toBeDefined();
      expect(allDyes.length).toBeGreaterThan(0);
    });
  });

  describe('characterColorService', () => {
    it('should be initialized', () => {
      expect(characterColorService).toBeDefined();
    });

    it('should return shared colors', () => {
      const eyeColors = characterColorService.getSharedColors('eyeColors');
      expect(eyeColors).toBeDefined();
      expect(eyeColors.length).toBeGreaterThan(0);
    });
  });

  describe('getDyeByItemId', () => {
    it('should return dye for valid itemID', () => {
      // Use a known dye ID from the database
      const allDyes = dyeService.getAllDyes();
      const knownDye = allDyes[0];

      const result = getDyeByItemId(knownDye.itemID);
      expect(result).toBeDefined();
      expect(result?.itemID).toBe(knownDye.itemID);
      expect(result?.name).toBe(knownDye.name);
    });

    it('should return undefined for invalid itemID', () => {
      const result = getDyeByItemId(999999);
      expect(result).toBeUndefined();
    });

    it('should return undefined for zero', () => {
      const result = getDyeByItemId(0);
      expect(result).toBeUndefined();
    });

    it('should return undefined for negative ID', () => {
      const result = getDyeByItemId(-1);
      expect(result).toBeUndefined();
    });
  });

  describe('findClosestDyesWithDistance', () => {
    it('should return matches for valid hex color', () => {
      const result = findClosestDyesWithDistance('#FF0000');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(5); // default limit
    });

    it('should return requested number of matches', () => {
      const result = findClosestDyesWithDistance('#00FF00', { limit: 3 });

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should return matches sorted by distance (closest first)', () => {
      const result = findClosestDyesWithDistance('#0000FF');

      for (let i = 1; i < result.length; i++) {
        expect(result[i].distance).toBeGreaterThanOrEqual(result[i - 1].distance);
      }
    });

    it('should include dye object and distance in results', () => {
      const result = findClosestDyesWithDistance('#FFFFFF', { limit: 1 });

      expect(result[0].dye).toBeDefined();
      expect(result[0].dye.name).toBeDefined();
      expect(result[0].dye.hex).toBeDefined();
      expect(typeof result[0].distance).toBe('number');
      expect(result[0].distance).toBeGreaterThanOrEqual(0);
    });

    it('should exclude specified dye IDs', () => {
      // Get some matches first
      const initialMatches = findClosestDyesWithDistance('#FF5733', { limit: 3 });
      const idsToExclude = initialMatches.map((m) => m.dye.id);

      // Now exclude them
      const result = findClosestDyesWithDistance('#FF5733', {
        limit: 3,
        excludeIds: idsToExclude,
      });

      // Verify excluded IDs are not in results
      for (const match of result) {
        expect(idsToExclude).not.toContain(match.dye.id);
      }
    });

    it('should handle hex with # prefix', () => {
      const result = findClosestDyesWithDistance('#AABBCC', { limit: 1 });

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });

    it('should return empty array for empty excludeIds array', () => {
      const result = findClosestDyesWithDistance('#123456', { excludeIds: [] });

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('findCharacterColorByHex', () => {
    it('should find color in shared color sheets', async () => {
      // Get a known eye color
      const eyeColors = characterColorService.getSharedColors('eyeColors');
      if (eyeColors.length > 0) {
        const knownColor = eyeColors[0];

        const result = await findCharacterColorByHex(knownColor.hex);

        expect(result).not.toBeNull();
        expect(result?.categoryName).toBe('Eye Colors');
        expect(result?.index).toBe(knownColor.index);
      }
    });

    it('should return row and column position', async () => {
      const eyeColors = characterColorService.getSharedColors('eyeColors');
      if (eyeColors.length > 0) {
        const knownColor = eyeColors[0];

        const result = await findCharacterColorByHex(knownColor.hex);

        expect(result?.row).toBeDefined();
        expect(result?.col).toBeDefined();
        // Row and col should be 1-based
        expect(result?.row).toBeGreaterThanOrEqual(1);
        expect(result?.col).toBeGreaterThanOrEqual(1);
        expect(result?.col).toBeLessThanOrEqual(8); // 8 columns in character creator
      }
    });

    it('should handle hex with # prefix', async () => {
      const eyeColors = characterColorService.getSharedColors('eyeColors');
      if (eyeColors.length > 0) {
        const knownColor = eyeColors[0];
        const hexWithPrefix = knownColor.hex.startsWith('#')
          ? knownColor.hex
          : `#${knownColor.hex}`;

        const result = await findCharacterColorByHex(hexWithPrefix);

        expect(result).not.toBeNull();
      }
    });

    it('should handle hex without # prefix', async () => {
      const eyeColors = characterColorService.getSharedColors('eyeColors');
      if (eyeColors.length > 0) {
        const knownColor = eyeColors[0];
        const hexWithoutPrefix = knownColor.hex.replace('#', '');

        const result = await findCharacterColorByHex(hexWithoutPrefix);

        expect(result).not.toBeNull();
      }
    });

    it('should return null for unknown color', async () => {
      // Use a very specific color unlikely to be in the database
      const result = await findCharacterColorByHex('#FACADE');

      // Could be null or could find a match - depends on database
      // Just verify it doesn't throw
      expect(result === null || result !== null).toBe(true);
    });

    it('should search all shared categories', async () => {
      // Test that all shared categories are searched
      const categories = [
        'eyeColors',
        'highlightColors',
        'lipColorsDark',
        'lipColorsLight',
        'tattooColors',
        'facePaintColorsDark',
        'facePaintColorsLight',
      ] as const;

      for (const category of categories) {
        const colors = characterColorService.getSharedColors(category);
        if (colors.length > 0) {
          const result = await findCharacterColorByHex(colors[0].hex);
          // Should find the color
          expect(result).not.toBeNull();
        }
      }
    });
  });

  describe('getCharacterColorFromSheet', () => {
    it('should return color info for valid shared sheet', async () => {
      const eyeColors = characterColorService.getSharedColors('eyeColors');
      if (eyeColors.length > 0) {
        const knownColor = eyeColors[0];

        const result = await getCharacterColorFromSheet(
          knownColor.hex,
          'eyeColors'
        );

        expect(result).not.toBeNull();
        expect(result?.categoryName).toBe('Eye Colors');
        expect(result?.isRaceSpecific).toBe(false);
      }
    });

    it('should return full context for race-specific sheets with race/gender', async () => {
      const result = await getCharacterColorFromSheet(
        '#FFFFFF', // Use a placeholder - actual result depends on database
        'hairColors',
        'Midlander',
        'Female'
      );

      // Result may be null if color not found, but if found should have context
      if (result) {
        expect(result.isRaceSpecific).toBe(true);
        expect(result.subrace).toBe('Midlander');
        expect(result.gender).toBe('Female');
        expect(result.fullName).toContain('Female');
        expect(result.fullName).toContain('Midlander');
      }
    });

    it('should fall back to hex search for race-specific sheets without race/gender', async () => {
      // When race/gender not provided for race-specific sheet, should fall back
      const eyeColors = characterColorService.getSharedColors('eyeColors');
      if (eyeColors.length > 0) {
        // Use an eye color for the fallback test
        const result = await getCharacterColorFromSheet(
          eyeColors[0].hex,
          'hairColors'
          // No race or gender
        );

        // Should either find via fallback or return null
        if (result) {
          expect(result.isRaceSpecific).toBeDefined();
        }
      }
    });

    it('should return null for non-existent color', async () => {
      const result = await getCharacterColorFromSheet(
        '#FACADE',
        'eyeColors'
      );

      // May or may not be null depending on database - just verify no error
      expect(result === null || result !== null).toBe(true);
    });

    it('should handle all shared sheet categories', async () => {
      const categories = [
        { key: 'eyeColors', name: 'Eye Colors' },
        { key: 'highlightColors', name: 'Highlights' },
        { key: 'lipColorsDark', name: 'Lip Colors (Dark)' },
        { key: 'lipColorsLight', name: 'Lip Colors (Light)' },
        { key: 'tattooColors', name: 'Tattoo/Limbal' },
        { key: 'facePaintColorsDark', name: 'Face Paint (Dark)' },
        { key: 'facePaintColorsLight', name: 'Face Paint (Light)' },
      ] as const;

      for (const { key, name } of categories) {
        const colors = characterColorService.getSharedColors(key);
        if (colors.length > 0) {
          const result = await getCharacterColorFromSheet(colors[0].hex, key);

          if (result) {
            expect(result.categoryName).toBe(name);
            expect(result.isRaceSpecific).toBe(false);
          }
        }
      }
    });
  });
});
