/**
 * Tests for Budget Calculator Service
 */
import { describe, it, expect } from 'vitest';
import {
  searchDyes,
  getDyeById,
  getDyeByName,
  getDyeAutocomplete,
  getAllDyes,
  getCategories,
} from './budget-calculator.js';

describe('budget-calculator.ts', () => {
  describe('getDyeById', () => {
    it('should return dye for valid ID', () => {
      // Get any dye first to test with a known valid ID
      const allDyes = getAllDyes();
      expect(allDyes.length).toBeGreaterThan(0);

      const testDye = allDyes[0];
      const dye = getDyeById(testDye.itemID);
      expect(dye).toBeDefined();
      expect(dye?.itemID).toBe(testDye.itemID);
    });

    it('should return null for invalid ID', () => {
      const dye = getDyeById(999999);
      expect(dye).toBeNull();
    });
  });

  describe('getDyeByName', () => {
    it('should return dye for exact name match', () => {
      // Get any dye to test with a known name
      const allDyes = getAllDyes();
      const testDye = allDyes[0];

      const dye = getDyeByName(testDye.name);
      expect(dye).toBeDefined();
      expect(dye?.name).toBe(testDye.name);
    });

    it('should be case-insensitive', () => {
      const allDyes = getAllDyes();
      const testDye = allDyes[0];

      const dye = getDyeByName(testDye.name.toLowerCase());
      expect(dye).toBeDefined();
      expect(dye?.name).toBe(testDye.name);
    });

    it('should return null for non-existent dye', () => {
      const dye = getDyeByName('Fake Dye Color That Does Not Exist 12345');
      expect(dye).toBeNull();
    });
  });

  describe('searchDyes', () => {
    it('should find dyes by partial name match', () => {
      const results = searchDyes('white');
      expect(results.length).toBeGreaterThan(0);
      // All results should contain 'white' in name (case-insensitive)
      results.forEach((d) => {
        expect(d.name.toLowerCase()).toContain('white');
      });
    });

    it('should be case-insensitive', () => {
      const resultsLower = searchDyes('white');
      const resultsUpper = searchDyes('WHITE');
      expect(resultsLower.length).toBe(resultsUpper.length);
    });

    it('should return empty array for no matches', () => {
      const results = searchDyes('xyz123nonexistent9876');
      expect(results).toEqual([]);
    });
  });

  describe('getDyeAutocomplete', () => {
    it('should return choices formatted for Discord', () => {
      const choices = getDyeAutocomplete('black');
      expect(choices.length).toBeGreaterThan(0);
      expect(choices.length).toBeLessThanOrEqual(25); // Discord limit

      // Each choice should have name and value
      choices.forEach((choice) => {
        expect(choice).toHaveProperty('name');
        expect(choice).toHaveProperty('value');
        expect(typeof choice.name).toBe('string');
        expect(typeof choice.value).toBe('string');
      });
    });

    it('should return up to 25 choices', () => {
      const choices = getDyeAutocomplete(''); // Empty query returns all
      expect(choices.length).toBeLessThanOrEqual(25);
    });

    it('should match search query in results', () => {
      const choices = getDyeAutocomplete('red');
      expect(choices.length).toBeGreaterThan(0);
      // Each choice name should contain 'red' (case-insensitive)
      choices.forEach((choice) => {
        expect(choice.name.toLowerCase()).toContain('red');
      });
    });
  });

  describe('getAllDyes', () => {
    it('should return all dyes', () => {
      const dyes = getAllDyes();
      expect(dyes.length).toBeGreaterThan(50); // FFXIV has many dyes
    });

    it('should return dyes with required properties', () => {
      const dyes = getAllDyes();
      dyes.forEach((dye) => {
        expect(dye).toHaveProperty('itemID');
        expect(dye).toHaveProperty('name');
        expect(dye).toHaveProperty('hex');
        expect(dye).toHaveProperty('category');
      });
    });
  });

  describe('getCategories', () => {
    it('should return dye categories', () => {
      const categories = getCategories();
      expect(categories.length).toBeGreaterThan(0);
      // Just verify it returns an array of strings
      categories.forEach((cat) => {
        expect(typeof cat).toBe('string');
      });
    });

    it('should return unique categories', () => {
      const categories = getCategories();
      const uniqueCategories = [...new Set(categories)];
      expect(categories.length).toBe(uniqueCategories.length);
    });
  });
});
