/**
 * Tests for Dye Helper Functions
 *
 * @module dye-helpers.test
 */

import { describe, it, expect } from 'vitest';
import { dyeService, findClosestDyesWithDistance, getDyeByItemId } from './dye-helpers';

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

  describe('getDyeByItemId', () => {
    it('should return dye for valid itemID', () => {
      // Use a known dye ID from the database
      const allDyes = dyeService.getAllDyes();
      const knownDye = allDyes[0];

      const result = getDyeByItemId(knownDye.stainID ?? 0);
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
});
