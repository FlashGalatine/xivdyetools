import { describe, it, expect, beforeEach } from 'vitest';
import { ColorService } from '../services/ColorService.js';
import { DyeService } from '../services/DyeService.js';
import { APIService, MemoryCacheBackend } from '../services/APIService.js';
import dyeDatabase from '../data/colors_xiv.json' with { type: 'json' };
import {
  clamp,
  lerp,
  round,
  isValidHexColor,
  isValidRGB,
  isValidHSV,
  sleep,
  retry,
  generateChecksum
} from '../utils/index.js';

describe('ColorService', () => {
  describe('hexToRgb', () => {
    it('should convert hex to RGB', () => {
      const rgb = ColorService.hexToRgb('#FF6B6B');
      expect(rgb).toEqual({ r: 255, g: 107, b: 107 });
    });

    it('should handle 3-digit hex', () => {
      const rgb = ColorService.hexToRgb('#F00');
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex', () => {
      const hex = ColorService.rgbToHex(255, 107, 107);
      expect(hex).toBe('#FF6B6B');
    });
  });

  describe('rgbToHsv', () => {
    it('should convert RGB to HSV', () => {
      const hsv = ColorService.rgbToHsv(255, 0, 0);
      expect(hsv.h).toBe(0);
      expect(hsv.s).toBe(100);
      expect(hsv.v).toBe(100);
    });
  });

  describe('hsvToRgb', () => {
    it('should convert HSV to RGB', () => {
      const rgb = ColorService.hsvToRgb(0, 100, 100);
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
    });
  });

  describe('getColorDistance', () => {
    it('should return 0 for identical colors', () => {
      const distance = ColorService.getColorDistance('#FF0000', '#FF0000');
      expect(distance).toBe(0);
    });

    it('should calculate distance between colors', () => {
      const distance = ColorService.getColorDistance('#FF0000', '#0000FF');
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('simulateColorblindness', () => {
    it('should return same color for normal vision', () => {
      const rgb = { r: 255, g: 107, b: 107 };
      const result = ColorService.simulateColorblindness(rgb, 'normal');
      expect(result).toEqual(rgb);
    });

    it('should simulate protanopia', () => {
      const rgb = { r: 255, g: 0, b: 0 };
      const result = ColorService.simulateColorblindness(rgb, 'protanopia');
      expect(result).toBeDefined();
    });
  });
});

describe('DyeService', () => {
  let dyeService: DyeService;

  beforeEach(() => {
    dyeService = new DyeService(dyeDatabase);
  });

  describe('initialization', () => {
    it('should load all dyes from database', () => {
      const allDyes = dyeService.getAllDyes();
      expect(allDyes).toHaveLength(136);
    });
  });

  describe('getDyeById', () => {
    it('should find dye by ID', () => {
      const dye = dyeService.getDyeById(5740);
      expect(dye).toBeDefined();
      expect(dye?.name).toBe('Wine Red');
    });

    it('should return null for non-existent ID', () => {
      const dye = dyeService.getDyeById(99999);
      expect(dye).toBeNull();
    });
  });

  describe('searchByName', () => {
    it('should find dyes by name query', () => {
      const dyes = dyeService.searchByName('Red');
      expect(dyes.length).toBeGreaterThan(0);
    });
  });

  describe('searchByCategory', () => {
    it('should filter dyes by category', () => {
      const redDyes = dyeService.searchByCategory('Reds');
      expect(redDyes.length).toBeGreaterThan(0);
      redDyes.forEach(dye => {
        expect(dye.category).toBe('Reds');
      });
    });
  });

  describe('getCategories', () => {
    it('should return all unique categories', () => {
      const categories = dyeService.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain('Reds');
    });
  });

  describe('findClosestDye', () => {
    it('should find closest dye', () => {
      const dye = dyeService.findClosestDye('#FF0000');
      expect(dye).toBeDefined();
      expect(dye?.category).toBe('Reds');
    });
  });

  describe('findComplementaryPair', () => {
    it('should find complementary dye', () => {
      const complement = dyeService.findComplementaryPair('#FF0000');
      expect(complement).toBeDefined();
    });
  });

  describe('findTriadicDyes', () => {
    it('should return triadic dyes', () => {
      const dyes = dyeService.findTriadicDyes('#FF0000');
      expect(dyes.length).toBeGreaterThan(0);
    });
  });

  describe('findAnalogousDyes', () => {
    it('should find analogous dyes', () => {
      const dyes = dyeService.findAnalogousDyes('#FF0000');
      expect(dyes.length).toBeGreaterThan(0);
    });
  });

  describe('findMonochromaticDyes', () => {
    it('should find monochromatic dyes', () => {
      const dyes = dyeService.findMonochromaticDyes('#FF0000');
      expect(dyes.length).toBeGreaterThan(0);
    });
  });

  describe('getDyesSortedByHue', () => {
    it('should sort dyes by hue', () => {
      const sorted = dyeService.getDyesSortedByHue();
      expect(sorted.length).toBe(136);
    });
  });
});

describe('APIService', () => {
  let apiService: APIService;

  beforeEach(() => {
    const cacheBackend = new MemoryCacheBackend();
    apiService = new APIService(cacheBackend);
  });

  describe('clearCache', () => {
    it('should clear cache', async () => {
      await apiService.clearCache();
      const stats = await apiService.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const stats = await apiService.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(stats.size).toBe(0);
    });
  });

  describe('formatPrice', () => {
    it('should format price with commas and G suffix', () => {
      expect(APIService.formatPrice(1000)).toBe('1,000G');
      expect(APIService.formatPrice(1000000)).toBe('1,000,000G');
      expect(APIService.formatPrice(0)).toBe('0G');
    });
  });

  describe('MemoryCacheBackend', () => {
    it('should store and retrieve data', async () => {
      const cache = new MemoryCacheBackend();
      const data = {
        data: {
          itemID: 5740,
          currentAverage: 1000,
          currentMinPrice: 500,
          currentMaxPrice: 1500,
          lastUpdate: Date.now()
        },
        timestamp: Date.now(),
        ttl: 300000
      };

      await cache.set('test_key', data);
      const retrieved = await cache.get('test_key');
      expect(retrieved).toEqual(data);
    });

    it('should delete data', async () => {
      const cache = new MemoryCacheBackend();
      const data = {
        data: {
          itemID: 5740,
          currentAverage: 1000,
          currentMinPrice: 500,
          currentMaxPrice: 1500,
          lastUpdate: Date.now()
        },
        timestamp: Date.now(),
        ttl: 300000
      };

      await cache.set('test_key', data);
      await cache.delete('test_key');
      const result = await cache.get('test_key');
      expect(result).toBeNull();
    });

    it('should clear all data', async () => {
      const cache = new MemoryCacheBackend();
      const data = {
        data: {
          itemID: 5740,
          currentAverage: 1000,
          currentMinPrice: 500,
          currentMaxPrice: 1500,
          lastUpdate: Date.now()
        },
        timestamp: Date.now(),
        ttl: 300000
      };

      await cache.set('key1', data);
      await cache.set('key2', data);
      await cache.clear();
      const keys = await cache.keys();
      expect(keys).toHaveLength(0);
    });
  });
});

describe('Utilities', () => {
  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(150, 0, 100)).toBe(100);
    });
  });

  describe('lerp', () => {
    it('should interpolate between values', () => {
      expect(lerp(0, 100, 0)).toBe(0);
      expect(lerp(0, 100, 1)).toBe(100);
      expect(lerp(0, 100, 0.5)).toBe(50);
    });
  });

  describe('round', () => {
    it('should round to specified decimals', () => {
      expect(round(3.14159, 2)).toBe(3.14);
      expect(round(3.14159, 0)).toBe(3);
    });
  });

  describe('isValidHexColor', () => {
    it('should validate hex colors', () => {
      expect(isValidHexColor('#FF6B6B')).toBe(true);
      expect(isValidHexColor('#F00')).toBe(true);
      expect(isValidHexColor('invalid')).toBe(false);
    });
  });

  describe('isValidRGB', () => {
    it('should validate RGB values', () => {
      expect(isValidRGB(255, 107, 107)).toBe(true);
      expect(isValidRGB(256, 0, 0)).toBe(false);
      expect(isValidRGB(-1, 0, 0)).toBe(false);
    });
  });

  describe('isValidHSV', () => {
    it('should validate HSV values', () => {
      expect(isValidHSV(180, 50, 75)).toBe(true);
      expect(isValidHSV(361, 50, 50)).toBe(false);
      expect(isValidHSV(180, 101, 50)).toBe(false);
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await sleep(100);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(95);
    });
  });

  describe('retry', () => {
    it('should succeed on first attempt', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        return 'success';
      };

      const result = await retry(fn, 3, 10);
      expect(result).toBe('success');
      expect(callCount).toBe(1);
    });

    it('should retry on failure', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 3) throw new Error('fail');
        return 'success';
      };

      const result = await retry(fn, 3, 10);
      expect(result).toBe('success');
      expect(callCount).toBe(3);
    });
  });

  describe('generateChecksum', () => {
    it('should generate consistent checksums', () => {
      const data = { test: 123 };
      const checksum1 = generateChecksum(data);
      const checksum2 = generateChecksum(data);
      expect(checksum1).toBe(checksum2);
    });

    it('should generate different checksums for different data', () => {
      const checksum1 = generateChecksum({ test: 123 });
      const checksum2 = generateChecksum({ test: 456 });
      expect(checksum1).not.toBe(checksum2);
    });
  });
});
