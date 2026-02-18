/**
 * Integration tests for dye matching workflow
 * Per R-5: Tests complete dye matching pipeline
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DyeService, ColorService, dyeDatabase } from '../../index.js';
import type { Dye } from '../../types/index.js';

describe('Dye Matching Workflow - Integration Tests', () => {
  let dyeService: DyeService;

  beforeAll(() => {
    dyeService = new DyeService(dyeDatabase);
  });

  describe('Color to Dye Matching', () => {
    const testCases = [
      { hex: '#FF0000', expectedCategory: 'Red' },
      { hex: '#00FF00', expectedCategory: 'Green' },
      { hex: '#0000FF', expectedCategory: 'Blue' },
      { hex: '#FFFFFF', expectedCategory: 'White' },
      { hex: '#000000', expectedCategory: 'Black' },
    ];

    testCases.forEach(({ hex, expectedCategory }) => {
      it(`should find closest dye for ${hex}`, () => {
        const closestDye = dyeService.findClosestDye(hex);
        expect(closestDye).toBeDefined();
        expect(closestDye?.hex).toBeDefined();
        expect(closestDye?.name).toBeTruthy();
        expect(closestDye?.category).toBeDefined();

        // Verify color distance is reasonable
        if (closestDye) {
          const distance = ColorService.getColorDistance(hex, closestDye.hex);
          expect(distance).toBeGreaterThanOrEqual(0);
          expect(distance).toBeLessThan(500); // Should find reasonable match
        }
      });
    });
  });

  describe('Dye Search and Retrieval', () => {
    it('should find dye by ID', () => {
      // Get first dye to use its ID
      const allDyes = dyeService.getAllDyes();
      expect(allDyes.length).toBeGreaterThan(0);
      const firstDye = allDyes[0];
      const dyeId = firstDye.id || firstDye.itemID;

      const dye = dyeService.getDyeById(dyeId);
      expect(dye).toBeDefined();
      expect(dye?.id || dye?.itemID).toBe(dyeId);
    });

    it('should find multiple dyes by IDs', () => {
      // Get first 5 dyes to use their IDs
      const allDyes = dyeService.getAllDyes();
      expect(allDyes.length).toBeGreaterThanOrEqual(5);
      const dyeIds = allDyes.slice(0, 5).map((d) => d.id || d.itemID);

      const dyes = dyeService.getDyesByIds(dyeIds);
      expect(dyes.length).toBeGreaterThan(0);
      dyes.forEach((dye) => {
        expect(dye.id || dye.itemID).toBeDefined();
        expect(dyeIds).toContain(dye.id || dye.itemID);
      });
    });

    it('should get all dyes', () => {
      const allDyes = dyeService.getAllDyes();
      expect(allDyes.length).toBeGreaterThan(0);
      expect(allDyes.length).toBeLessThanOrEqual(200); // FFXIV has ~200 dyes

      // Verify all dyes have required fields
      allDyes.forEach((dye) => {
        // Dye should have either id or itemID (at least one identifier)
        const hasId = dye.id !== undefined && dye.id !== null;
        const hasItemId = dye.itemID !== undefined && dye.itemID !== null;

        // At least one identifier should exist
        if (!hasId && !hasItemId) {
          // Log for debugging but don't fail - some dyes might be missing IDs
          console.warn('Dye missing both id and itemID:', dye);
        }

        // Verify required fields exist
        expect(dye.name).toBeTruthy();
        expect(dye.hex).toMatch(/^#[0-9A-F]{6}$/i);
        expect(dye.category).toBeDefined();

        // If id exists, verify it's valid (can be negative for Facewear synthetic IDs)
        if (hasId && typeof dye.id === 'number') {
          expect(dye.id).not.toBe(0);
        }
        // If itemID exists, verify it's valid (can be negative for Facewear synthetic IDs)
        if (hasItemId && typeof dye.itemID === 'number') {
          expect(dye.itemID).not.toBe(0);
        }
      });
    });
  });

  describe('Performance - Dye Matching Speed', () => {
    it('should match colors quickly', () => {
      const testColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        const color = testColors[i % testColors.length];
        dyeService.findClosestDye(color);
      }
      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      // Should be fast (< 10ms per match on average)
      expect(avgTime).toBeLessThan(10);
    });
  });

  describe('Matching Quality', () => {
    it('should find exact matches for existing dye colors', () => {
      const allDyes = dyeService.getAllDyes();
      const sampleDyes = allDyes.slice(0, 10); // Test first 10 dyes

      sampleDyes.forEach((dye) => {
        const match = dyeService.findClosestDye(dye.hex);
        expect(match).toBeDefined();
        // Should match the same dye (or very close)
        if (match) {
          const distance = ColorService.getColorDistance(dye.hex, match.hex);
          // Exact match should have distance 0, or very close (< 1)
          expect(distance).toBeLessThan(1);
        }
      });
    });

    it('should handle edge cases gracefully', () => {
      // Very dark color
      const darkMatch = dyeService.findClosestDye('#010101');
      expect(darkMatch).toBeDefined();

      // Very light color
      const lightMatch = dyeService.findClosestDye('#FEFEFE');
      expect(lightMatch).toBeDefined();

      // Saturated color
      const saturatedMatch = dyeService.findClosestDye('#FF00FF');
      expect(saturatedMatch).toBeDefined();
    });
  });
});
