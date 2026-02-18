/**
 * Tests for cache configuration
 */

import { describe, it, expect } from 'vitest';
import { CACHE_CONFIGS, type CacheConfigKey } from './cache';
import type { CacheConfig } from '../types/cache';

describe('CACHE_CONFIGS', () => {
  describe('structure validation', () => {
    it('should have all required endpoint configurations', () => {
      expect(CACHE_CONFIGS).toHaveProperty('aggregated');
      expect(CACHE_CONFIGS).toHaveProperty('dataCenters');
      expect(CACHE_CONFIGS).toHaveProperty('worlds');
    });

    it('should have correct CacheConfig structure for all configs', () => {
      const requiredFields: (keyof CacheConfig)[] = [
        'cacheTtl',
        'swrWindow',
        'keyPrefix',
      ];

      Object.entries(CACHE_CONFIGS).forEach(([key, config]) => {
        requiredFields.forEach((field) => {
          expect(config, `Config "${key}" missing field "${field}"`).toHaveProperty(field);
        });
      });
    });

    it('should have all numeric TTL values', () => {
      Object.entries(CACHE_CONFIGS).forEach(([key, config]) => {
        expect(typeof config.cacheTtl, `${key}.cacheTtl`).toBe('number');
        expect(typeof config.swrWindow, `${key}.swrWindow`).toBe('number');
      });
    });

    it('should have string keyPrefix values', () => {
      Object.entries(CACHE_CONFIGS).forEach(([key, config]) => {
        expect(typeof config.keyPrefix, `${key}.keyPrefix`).toBe('string');
        expect(config.keyPrefix.length, `${key}.keyPrefix should not be empty`).toBeGreaterThan(0);
      });
    });
  });

  describe('aggregated config', () => {
    const config = CACHE_CONFIGS.aggregated;

    it('should have short TTL for frequently changing price data', () => {
      // 5 minutes = 300 seconds
      expect(config.cacheTtl).toBe(300);
    });

    it('should have reasonable SWR window', () => {
      // 2 minutes = 120 seconds
      expect(config.swrWindow).toBe(120);
    });

    it('should have SWR window shorter than TTL', () => {
      expect(config.swrWindow).toBeLessThan(config.cacheTtl);
    });

    it('should have correct key prefix', () => {
      expect(config.keyPrefix).toBe('aggregated');
    });
  });

  describe('dataCenters config', () => {
    const config = CACHE_CONFIGS.dataCenters;

    it('should have long TTL for static data', () => {
      // 24 hours = 86400 seconds
      expect(config.cacheTtl).toBe(86400);
    });

    it('should have longer SWR window for static data', () => {
      // 6 hours = 21600 seconds
      expect(config.swrWindow).toBe(21600);
    });

    it('should have correct key prefix', () => {
      expect(config.keyPrefix).toBe('data-centers');
    });
  });

  describe('worlds config', () => {
    const config = CACHE_CONFIGS.worlds;

    it('should have long TTL for static data', () => {
      // 24 hours = 86400 seconds
      expect(config.cacheTtl).toBe(86400);
    });

    it('should have longer SWR window for static data', () => {
      // 6 hours = 21600 seconds
      expect(config.swrWindow).toBe(21600);
    });

    it('should have correct key prefix', () => {
      expect(config.keyPrefix).toBe('worlds');
    });
  });

  describe('TTL consistency', () => {
    it('should have positive TTL values', () => {
      Object.entries(CACHE_CONFIGS).forEach(([key, config]) => {
        expect(config.cacheTtl, `${key}.cacheTtl`).toBeGreaterThan(0);
        expect(config.swrWindow, `${key}.swrWindow`).toBeGreaterThan(0);
      });
    });

    it('should have static data configs with longer TTLs than dynamic data', () => {
      expect(CACHE_CONFIGS.dataCenters.cacheTtl).toBeGreaterThan(CACHE_CONFIGS.aggregated.cacheTtl);
      expect(CACHE_CONFIGS.worlds.cacheTtl).toBeGreaterThan(CACHE_CONFIGS.aggregated.cacheTtl);
    });
  });

  describe('type safety', () => {
    it('should allow type-safe access to config keys', () => {
      const keys: CacheConfigKey[] = ['aggregated', 'dataCenters', 'worlds'];
      keys.forEach((key) => {
        expect(CACHE_CONFIGS[key]).toBeDefined();
      });
    });

    it('should satisfy CacheConfig interface', () => {
      const validateConfig = (config: CacheConfig): boolean => {
        return (
          typeof config.cacheTtl === 'number' &&
          typeof config.swrWindow === 'number' &&
          typeof config.keyPrefix === 'string'
        );
      };

      Object.values(CACHE_CONFIGS).forEach((config) => {
        expect(validateConfig(config)).toBe(true);
      });
    });
  });
});
