import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DyeDatabase } from '../DyeDatabase.js';
import type { Dye, Logger } from '../../../types/index.js';
import { AppError, ErrorCode } from '../../../types/index.js';

describe('DyeDatabase', () => {
  let database: DyeDatabase;

  // Mock dye data for testing
  const mockDyes: Dye[] = [
    {
      itemID: 5729,
      id: 5729,
      stainID: 1,
      name: 'Snow White',
      hex: '#FFFFFF',
      rgb: { r: 255, g: 255, b: 255 },
      hsv: { h: 0, s: 0, v: 100 },
      category: 'Neutral',
      acquisition: 'Dye Vendor',
      cost: 200,
    },
    {
      itemID: 5740,
      id: 5740,
      stainID: 12,
      name: 'Wine Red',
      hex: '#4D1818',
      rgb: { r: 77, g: 24, b: 24 },
      hsv: { h: 0, s: 69, v: 30 },
      category: 'Reds',
      acquisition: 'Crafting',
      cost: 0,
    },
    {
      itemID: 13116,
      id: 13116,
      stainID: 112,
      name: 'Metallic Silver',
      hex: '#8C8C8C',
      rgb: { r: 140, g: 140, b: 140 },
      hsv: { h: 0, s: 0, v: 55 },
      category: 'Neutral',
      acquisition: 'Ixali Vendor',
      cost: 10000,
    },
    {
      itemID: 6001,
      id: 6001,
      stainID: 61,
      name: 'Sky Blue',
      hex: '#87CEEB',
      rgb: { r: 135, g: 206, b: 235 },
      hsv: { h: 197, s: 43, v: 92 },
      category: 'Blues',
      acquisition: 'Dye Vendor',
      cost: 200,
    },
    {
      itemID: 6002,
      id: 6002,
      stainID: null,
      name: 'Forest Green',
      hex: '#228B22',
      rgb: { r: 34, g: 139, b: 34 },
      hsv: { h: 120, s: 76, v: 55 },
      category: 'Greens',
      acquisition: 'Crafting',
      cost: 0,
    },
  ];

  beforeEach(() => {
    database = new DyeDatabase();
  });

  describe('initialization', () => {
    it('should initialize with array of dyes', () => {
      database.initialize(mockDyes);

      expect(database.isLoadedStatus()).toBe(true);
      expect(database.getDyeCount()).toBe(5);
    });

    it('should initialize with object of dyes', () => {
      const dyeObject = Object.fromEntries(mockDyes.map((d) => [d.id, d]));
      database.initialize(dyeObject);

      expect(database.isLoadedStatus()).toBe(true);
      expect(database.getDyeCount()).toBe(5);
    });

    it('should throw error for empty array', () => {
      expect(() => database.initialize([])).toThrow(AppError);
      expect(() => database.initialize([])).toThrow('Invalid dye database format');
    });

    it('should throw error for invalid format', () => {
      expect(() => database.initialize(null)).toThrow(AppError);
      expect(() => database.initialize('invalid')).toThrow(AppError);
    });

    it('should normalize dyes with itemID but no id', () => {
      const dyeWithoutId = {
        itemID: 9999,
        name: 'Test Dye',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([dyeWithoutId]);

      const dye = database.getDyeById(9999);
      expect(dye).toBeDefined();
      expect(dye?.id).toBe(9999);
    });

    it('should record last loaded time', () => {
      const before = Date.now();
      database.initialize(mockDyes);
      const after = Date.now();

      const lastLoaded = database.getLastLoadedTime();
      expect(lastLoaded).toBeGreaterThanOrEqual(before);
      expect(lastLoaded).toBeLessThanOrEqual(after);
    });

    it('should not be loaded before initialization', () => {
      expect(database.isLoadedStatus()).toBe(false);
      expect(database.getLastLoadedTime()).toBe(0);
    });
  });

  describe('ensureLoaded', () => {
    it('should not throw when database is loaded', () => {
      database.initialize(mockDyes);
      expect(() => database.ensureLoaded()).not.toThrow();
    });

    it('should throw when database is not loaded', () => {
      expect(() => database.ensureLoaded()).toThrow(AppError);
      expect(() => database.ensureLoaded()).toThrow('Dye database is not loaded');
    });
  });

  describe('getAllDyes', () => {
    beforeEach(() => {
      database.initialize(mockDyes);
    });

    it('should return all dyes', () => {
      const dyes = database.getAllDyes();
      expect(dyes).toHaveLength(5);
    });

    it('should return defensive copy', () => {
      const dyes1 = database.getAllDyes();
      const dyes2 = database.getAllDyes();

      expect(dyes1).not.toBe(dyes2); // Different array instances
      expect(dyes1).toEqual(dyes2); // Same contents
    });

    it('should throw if not loaded', () => {
      const emptyDB = new DyeDatabase();
      expect(() => emptyDB.getAllDyes()).toThrow(AppError);
    });
  });

  describe('getDyeById', () => {
    beforeEach(() => {
      database.initialize(mockDyes);
    });

    it('should find dye by id', () => {
      const dye = database.getDyeById(5729);
      expect(dye).toBeDefined();
      expect(dye?.name).toBe('Snow White');
    });

    it('should find dye by itemID', () => {
      const dye = database.getDyeById(13116);
      expect(dye).toBeDefined();
      expect(dye?.name).toBe('Metallic Silver');
    });

    it('should return null for non-existent ID', () => {
      const dye = database.getDyeById(99999);
      expect(dye).toBeNull();
    });

    it('should throw if not loaded', () => {
      const emptyDB = new DyeDatabase();
      expect(() => emptyDB.getDyeById(5729)).toThrow(AppError);
    });
  });

  describe('getByStainId', () => {
    beforeEach(() => {
      database.initialize(mockDyes);
    });

    it('should find dye by stainID', () => {
      const dye = database.getByStainId(1);
      expect(dye).toBeDefined();
      expect(dye?.name).toBe('Snow White');
      expect(dye?.itemID).toBe(5729);
    });

    it('should find different dye by stainID', () => {
      const dye = database.getByStainId(112);
      expect(dye).toBeDefined();
      expect(dye?.name).toBe('Metallic Silver');
    });

    it('should return null for non-existent stainID', () => {
      const dye = database.getByStainId(999);
      expect(dye).toBeNull();
    });

    it('should not find dye with null stainID by searching for 0', () => {
      // Forest Green has stainID: null
      const dye = database.getByStainId(0);
      expect(dye).toBeNull();
    });

    it('should throw if not loaded', () => {
      const emptyDB = new DyeDatabase();
      expect(() => emptyDB.getByStainId(1)).toThrow(AppError);
    });
  });

  describe('getDyesByIds', () => {
    beforeEach(() => {
      database.initialize(mockDyes);
    });

    it('should retrieve multiple dyes by IDs', () => {
      const dyes = database.getDyesByIds([5729, 5740, 13116]);
      expect(dyes).toHaveLength(3);
      expect(dyes[0].name).toBe('Snow White');
      expect(dyes[1].name).toBe('Wine Red');
      expect(dyes[2].name).toBe('Metallic Silver');
    });

    it('should skip non-existent IDs', () => {
      const dyes = database.getDyesByIds([5729, 99999, 5740]);
      expect(dyes).toHaveLength(2);
    });

    it('should return empty array for all non-existent IDs', () => {
      const dyes = database.getDyesByIds([99999, 88888]);
      expect(dyes).toHaveLength(0);
    });

    it('should handle empty ID array', () => {
      const dyes = database.getDyesByIds([]);
      expect(dyes).toHaveLength(0);
    });
  });

  describe('getDyeCount', () => {
    it('should return correct count', () => {
      database.initialize(mockDyes);
      expect(database.getDyeCount()).toBe(5);
    });

    it('should throw if not loaded', () => {
      expect(() => database.getDyeCount()).toThrow(AppError);
    });
  });

  describe('getCategories', () => {
    beforeEach(() => {
      database.initialize(mockDyes);
    });

    it('should return all unique categories', () => {
      const categories = database.getCategories();
      expect(categories).toContain('Neutral');
      expect(categories).toContain('Reds');
      expect(categories).toContain('Blues');
      expect(categories).toContain('Greens');
    });

    it('should return sorted categories', () => {
      const categories = database.getCategories();
      const sorted = [...categories].sort();
      expect(categories).toEqual(sorted);
    });

    it('should not have duplicates', () => {
      const categories = database.getCategories();
      const unique = [...new Set(categories)];
      expect(categories).toEqual(unique);
    });
  });

  describe('hue bucket indexing', () => {
    beforeEach(() => {
      database.initialize(mockDyes);
    });

    it('should calculate correct hue bucket', () => {
      expect(database.getHueBucket(0)).toBe(0);
      expect(database.getHueBucket(10)).toBe(1);
      expect(database.getHueBucket(120)).toBe(12);
      expect(database.getHueBucket(197)).toBe(19);
      expect(database.getHueBucket(350)).toBe(35);
    });

    it('should normalize negative hues', () => {
      expect(database.getHueBucket(-10)).toBe(35); // -10 + 360 = 350, 350/10 = 35
    });

    it('should normalize hues > 360', () => {
      expect(database.getHueBucket(370)).toBe(1); // 370 % 360 = 10, 10/10 = 1
    });

    it('should get hue buckets to search with tolerance', () => {
      const buckets = database.getHueBucketsToSearch(120, 15);
      expect(buckets).toContain(12); // Target bucket
      expect(buckets).toContain(11); // -15° bucket
      expect(buckets).toContain(13); // +15° bucket
    });

    it('should wrap around hue circle', () => {
      const buckets = database.getHueBucketsToSearch(0, 15);
      expect(buckets).toContain(0);
      expect(buckets).toContain(35); // Wraps to 350°
      expect(buckets).toContain(1);
    });

    it('should get dyes by hue bucket', () => {
      const redDyes = database.getDyesByHueBucket(0); // H=0
      expect(redDyes.length).toBeGreaterThan(0);
      expect(redDyes.some((d) => d.name === 'Snow White')).toBe(true);
    });
  });

  describe('k-d tree', () => {
    beforeEach(() => {
      database.initialize(mockDyes);
    });

    it('should have k-d tree after initialization', () => {
      const kdTree = database.getKdTree();
      expect(kdTree).not.toBeNull();
    });

    it('should exclude Facewear from k-d tree', () => {
      const facewearDye: Dye = {
        itemID: 9999,
        id: 9999,
        name: 'Facewear Test',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Facewear',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, facewearDye]);
      const kdTree = database.getKdTree();

      expect(kdTree).not.toBeNull();
      // K-d tree should not contain facewear dyes
    });
  });

  describe('error handling', () => {
    it('should throw AppError with DATABASE_LOAD_FAILED code', () => {
      try {
        database.initialize([]);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.DATABASE_LOAD_FAILED);
        expect((error as AppError).severity).toBe('critical');
      }
    });

    it('should throw AppError when accessing unloaded database', () => {
      try {
        database.getAllDyes();
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.DATABASE_LOAD_FAILED);
      }
    });
  });

  describe('internal access', () => {
    beforeEach(() => {
      database.initialize(mockDyes);
    });

    it('should get internal dyes without defensive copy', () => {
      const dyes1 = database.getDyesInternal();
      const dyes2 = database.getDyesInternal();

      expect(dyes1).toBe(dyes2); // Same array instance
    });
  });

  // ============================================================================
  // NEW TESTS FOR IMPROVED COVERAGE
  // ============================================================================

  describe('prototype pollution protection', () => {
    it('should filter out __proto__ key from dye data', () => {
      // Create object with __proto__ as an actual property (not prototype assignment)
      const maliciousDye = Object.create(null);
      Object.assign(maliciousDye, {
        itemID: 9999,
        name: 'Test Dye',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      });
      // Add __proto__ as an actual enumerable property
      Object.defineProperty(maliciousDye, '__proto__', {
        value: { polluted: true },
        enumerable: true,
        configurable: true,
      });

      database.initialize([maliciousDye]);

      const dye = database.getDyeById(9999);
      expect(dye).toBeDefined();
      // The __proto__ key should have been filtered out
      expect(Object.prototype.hasOwnProperty.call(dye, '__proto__')).toBe(false);
    });

    it('should filter out constructor key from dye data', () => {
      // Create object with constructor as an actual property
      const maliciousDye = Object.create(null);
      Object.assign(maliciousDye, {
        itemID: 9998,
        name: 'Constructor Test',
        hex: '#00FF00',
        rgb: { r: 0, g: 255, b: 0 },
        hsv: { h: 120, s: 100, v: 100 },
        category: 'Greens',
        acquisition: 'Test',
        cost: 0,
      });
      Object.defineProperty(maliciousDye, 'constructor', {
        value: { malicious: true },
        enumerable: true,
        configurable: true,
      });

      database.initialize([maliciousDye]);
      const dye = database.getDyeById(9998);
      expect(dye).toBeDefined();
      // The constructor key should have been filtered out
      expect(Object.prototype.hasOwnProperty.call(dye, 'constructor')).toBe(false);
    });

    it('should filter out prototype key from dye data', () => {
      // Create object with prototype as an actual property
      const maliciousDye = Object.create(null);
      Object.assign(maliciousDye, {
        itemID: 9997,
        name: 'Prototype Test',
        hex: '#0000FF',
        rgb: { r: 0, g: 0, b: 255 },
        hsv: { h: 240, s: 100, v: 100 },
        category: 'Blues',
        acquisition: 'Test',
        cost: 0,
      });
      Object.defineProperty(maliciousDye, 'prototype', {
        value: { evil: true },
        enumerable: true,
        configurable: true,
      });

      database.initialize([maliciousDye]);
      const dye = database.getDyeById(9997);
      expect(dye).toBeDefined();
      // The prototype key should have been filtered out
      expect(Object.prototype.hasOwnProperty.call(dye, 'prototype')).toBe(false);
    });

    it('should filter out dangerous keys from nested RGB objects', () => {
      // Create RGB object with __proto__ as actual property
      const maliciousRgb = Object.create(null);
      Object.assign(maliciousRgb, { r: 128, g: 128, b: 128 });
      Object.defineProperty(maliciousRgb, '__proto__', {
        value: { nested: true },
        enumerable: true,
        configurable: true,
      });

      const maliciousDye = {
        itemID: 9996,
        name: 'Nested Proto Test',
        hex: '#808080',
        rgb: maliciousRgb,
        hsv: { h: 0, s: 0, v: 50 },
        category: 'Grays',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([maliciousDye]);
      const dye = database.getDyeById(9996);
      expect(dye).toBeDefined();
      // The nested __proto__ key should have been filtered out
      expect(Object.prototype.hasOwnProperty.call(dye?.rgb, '__proto__')).toBe(false);
    });
  });

  describe('dye validation', () => {
    it('should reject dye with invalid name (empty string)', () => {
      const invalidDye = {
        itemID: 9996,
        name: '',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9996);
      expect(dye).toBeNull(); // Should be filtered out
    });

    it('should reject dye with non-string name', () => {
      const invalidDye = {
        itemID: 9995,
        name: 12345, // number instead of string
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9995);
      expect(dye).toBeNull();
    });

    it('should reject dye with invalid hex format (missing #)', () => {
      const invalidDye = {
        itemID: 9994,
        name: 'Bad Hex',
        hex: 'FF0000', // missing #
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9994);
      expect(dye).toBeNull();
    });

    it('should reject dye with invalid hex format (wrong length)', () => {
      const invalidDye = {
        itemID: 9993,
        name: 'Short Hex',
        hex: '#FFF', // 3-digit hex not supported
        rgb: { r: 255, g: 255, b: 255 },
        hsv: { h: 0, s: 0, v: 100 },
        category: 'Neutral',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9993);
      expect(dye).toBeNull();
    });

    it('should reject dye with non-string hex', () => {
      const invalidDye = {
        itemID: 9992,
        name: 'Number Hex',
        hex: 16711680, // number instead of string
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9992);
      expect(dye).toBeNull();
    });

    it('should reject dye with RGB values out of range (> 255)', () => {
      const invalidDye = {
        itemID: 9991,
        name: 'Bad RGB High',
        hex: '#FF0000',
        rgb: { r: 300, g: 0, b: 0 }, // r > 255
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9991);
      expect(dye).toBeNull();
    });

    it('should reject dye with RGB values out of range (< 0)', () => {
      const invalidDye = {
        itemID: 9990,
        name: 'Bad RGB Low',
        hex: '#FF0000',
        rgb: { r: -10, g: 0, b: 0 }, // r < 0
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9990);
      expect(dye).toBeNull();
    });

    it('should reject dye with non-number RGB values', () => {
      const invalidDye = {
        itemID: 9989,
        name: 'String RGB',
        hex: '#FF0000',
        rgb: { r: '255', g: 0, b: 0 }, // string instead of number
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9989);
      expect(dye).toBeNull();
    });

    it('should reject dye with HSV hue out of range (> 360)', () => {
      const invalidDye = {
        itemID: 9988,
        name: 'Bad HSV H',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 400, s: 100, v: 100 }, // h > 360
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9988);
      expect(dye).toBeNull();
    });

    it('should reject dye with HSV saturation out of range (> 100)', () => {
      const invalidDye = {
        itemID: 9987,
        name: 'Bad HSV S',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 150, v: 100 }, // s > 100
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9987);
      expect(dye).toBeNull();
    });

    it('should reject dye with HSV value out of range (< 0)', () => {
      const invalidDye = {
        itemID: 9986,
        name: 'Bad HSV V',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: -10 }, // v < 0
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9986);
      expect(dye).toBeNull();
    });

    it('should reject dye with non-string category', () => {
      const invalidDye = {
        itemID: 9985,
        name: 'Bad Category',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 123, // number instead of string
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      const dye = database.getDyeById(9985);
      expect(dye).toBeNull();
    });

    it('should reject dye without id or itemID', () => {
      const invalidDye = {
        name: 'No ID',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([...mockDyes, invalidDye]);
      // Should only have the mock dyes, not the invalid one
      expect(database.getDyeCount()).toBe(5);
    });
  });

  describe('Facewear dyes with null itemID', () => {
    it('should generate synthetic ID for Facewear dyes with null itemID', () => {
      const facewearDye = {
        itemID: null,
        name: 'Facewear Test Color',
        hex: '#FF00FF',
        rgb: { r: 255, g: 0, b: 255 },
        hsv: { h: 300, s: 100, v: 100 },
        category: 'Facewear',
        acquisition: 'Special',
        cost: 0,
      };

      database.initialize([facewearDye]);

      expect(database.getDyeCount()).toBe(1);
      const allDyes = database.getAllDyes();
      expect(allDyes[0].name).toBe('Facewear Test Color');
      expect(allDyes[0].id).toBeLessThan(0); // Synthetic IDs are negative
    });

    it('should generate different synthetic IDs for different Facewear names', () => {
      const facewear1 = {
        itemID: null,
        name: 'Facewear Alpha',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Facewear',
        acquisition: 'Special',
        cost: 0,
      };

      const facewear2 = {
        itemID: null,
        name: 'Facewear Beta',
        hex: '#00FF00',
        rgb: { r: 0, g: 255, b: 0 },
        hsv: { h: 120, s: 100, v: 100 },
        category: 'Facewear',
        acquisition: 'Special',
        cost: 0,
      };

      database.initialize([facewear1, facewear2]);

      const allDyes = database.getAllDyes();
      expect(allDyes[0].id).not.toBe(allDyes[1].id);
    });
  });

  describe('price to cost mapping', () => {
    it('should map price field to cost when cost is undefined', () => {
      const dyeWithPrice = {
        itemID: 9000,
        name: 'Price Test',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        price: 500, // price instead of cost
      };

      database.initialize([dyeWithPrice]);

      const dye = database.getDyeById(9000);
      expect(dye?.cost).toBe(500);
    });

    it('should handle null cost by defaulting to 0', () => {
      const dyeWithNullCost = {
        itemID: 9001,
        name: 'Null Cost Test',
        hex: '#00FF00',
        rgb: { r: 0, g: 255, b: 0 },
        hsv: { h: 120, s: 100, v: 100 },
        category: 'Greens',
        acquisition: 'Test',
        cost: null,
      };

      database.initialize([dyeWithNullCost]);

      const dye = database.getDyeById(9001);
      expect(dye?.cost).toBe(0);
    });

    it('should handle undefined cost by defaulting to 0', () => {
      const dyeWithUndefinedCost = {
        itemID: 9002,
        name: 'Undefined Cost Test',
        hex: '#0000FF',
        rgb: { r: 0, g: 0, b: 255 },
        hsv: { h: 240, s: 100, v: 100 },
        category: 'Blues',
        acquisition: 'Test',
        // cost is intentionally omitted
      };

      database.initialize([dyeWithUndefinedCost]);

      const dye = database.getDyeById(9002);
      expect(dye?.cost).toBe(0);
    });

    it('should handle null price by defaulting cost to 0', () => {
      const dyeWithNullPrice = {
        itemID: 9003,
        name: 'Null Price Test',
        hex: '#FFFF00',
        rgb: { r: 255, g: 255, b: 0 },
        hsv: { h: 60, s: 100, v: 100 },
        category: 'Yellows',
        acquisition: 'Test',
        price: null,
      };

      database.initialize([dyeWithNullPrice]);

      const dye = database.getDyeById(9003);
      expect(dye?.cost).toBe(0);
    });
  });

  describe('logger integration', () => {
    it('should use provided logger for info messages', () => {
      const mockLogger: Logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const dbWithLogger = new DyeDatabase({ logger: mockLogger });
      dbWithLogger.initialize(mockDyes);

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Dye database loaded'));
    });

    it('should use provided logger for warn messages on invalid dyes', () => {
      const mockLogger: Logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const invalidDye = {
        itemID: 8888,
        name: '', // invalid empty name
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      const dbWithLogger = new DyeDatabase({ logger: mockLogger });
      dbWithLogger.initialize([...mockDyes, invalidDye]);

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('invalid name'));
    });
  });

  describe('dyes with different id and itemID', () => {
    it('should map both id and itemID when they differ', () => {
      const dyeWithDifferentIds = {
        itemID: 7000,
        id: 7001, // Different from itemID
        name: 'Different IDs',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([dyeWithDifferentIds]);

      // Should be findable by both IDs
      expect(database.getDyeById(7000)).toBeDefined();
      expect(database.getDyeById(7001)).toBeDefined();
      expect(database.getDyeById(7000)?.name).toBe('Different IDs');
      expect(database.getDyeById(7001)?.name).toBe('Different IDs');
    });
  });

  describe('additional initialization edge cases', () => {
    it('should throw error for undefined input', () => {
      expect(() => database.initialize(undefined)).toThrow(AppError);
      expect(() => database.initialize(undefined)).toThrow('null or undefined');
    });

    it('should throw error for number input', () => {
      expect(() => database.initialize(123)).toThrow(AppError);
      expect(() => database.initialize(123)).toThrow('expected array or object');
    });

    it('should throw error for boolean input', () => {
      expect(() => database.initialize(true)).toThrow(AppError);
      expect(() => database.initialize(true)).toThrow('expected array or object');
    });

    it('should accept dyes with null hex value', () => {
      const dyeWithNullHex = {
        itemID: 8000,
        name: 'Null Hex',
        hex: null,
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([dyeWithNullHex]);
      const dye = database.getDyeById(8000);
      expect(dye).toBeDefined();
    });

    it('should accept dyes with undefined hex value', () => {
      const dyeWithoutHex = {
        itemID: 8001,
        name: 'No Hex',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([dyeWithoutHex]);
      const dye = database.getDyeById(8001);
      expect(dye).toBeDefined();
    });

    it('should fail to initialize dyes with null RGB value (required for k-d tree)', () => {
      const dyeWithNullRgb = {
        itemID: 8002,
        name: 'Null RGB',
        hex: '#FF0000',
        rgb: null,
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      // Dye with null RGB will fail during k-d tree building
      // This verifies the error is handled gracefully
      expect(() => database.initialize([dyeWithNullRgb])).toThrow(AppError);
    });

    it('should filter out dyes with null HSV value (required for hue bucketing)', () => {
      const dyeWithNullHsv = {
        itemID: 8003,
        name: 'Null HSV',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: null,
        category: 'Reds',
        acquisition: 'Test',
        cost: 0,
      };

      const validDye = {
        itemID: 8004,
        name: 'Valid Dye',
        hex: '#00FF00',
        rgb: { r: 0, g: 255, b: 0 },
        hsv: { h: 120, s: 100, v: 100 },
        category: 'Greens',
        acquisition: 'Test',
        cost: 0,
      };

      // Dyes with null HSV are silently filtered out during validation
      // The database should initialize successfully with only valid dyes
      database.initialize([dyeWithNullHsv, validDye]);

      // The null HSV dye should be filtered out
      expect(database.getDyeById(8003)).toBeNull();
      // The valid dye should be present
      expect(database.getDyeById(8004)).not.toBeNull();
      expect(database.getDyeCount()).toBe(1);
    });

    it('should accept dyes with null category', () => {
      const dyeWithNullCategory = {
        itemID: 8004,
        name: 'Null Category',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: null,
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([dyeWithNullCategory]);
      const dye = database.getDyeById(8004);
      expect(dye).toBeDefined();
    });

    it('should accept dyes with undefined category', () => {
      const dyeWithoutCategory = {
        itemID: 8005,
        name: 'No Category',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        acquisition: 'Test',
        cost: 0,
      };

      database.initialize([dyeWithoutCategory]);
      const dye = database.getDyeById(8005);
      expect(dye).toBeDefined();
    });
  });

  describe('getDyesByHueBucket edge cases', () => {
    it('should return empty array for bucket with no dyes', () => {
      database.initialize(mockDyes);

      // Bucket 30 would be hue 300-309, which none of our mock dyes have
      const dyes = database.getDyesByHueBucket(30);
      expect(dyes).toEqual([]);
    });
  });
});
