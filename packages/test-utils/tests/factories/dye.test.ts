/**
 * Tests for dye factory functions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../../src/utils/counters.js';
import {
  mockDyes,
  createMockDye,
  createMockDyes,
  createMetallicDye,
  createPastelDye,
  createDarkDye,
  getMockDyeById,
  getMockDyesByIds,
} from '../../src/factories/dye.js';

beforeEach(() => {
  resetCounters();
});

describe('mockDyes', () => {
  it('is an array of dyes', () => {
    expect(Array.isArray(mockDyes)).toBe(true);
    expect(mockDyes.length).toBeGreaterThan(0);
  });

  it('has required properties on each dye', () => {
    for (const dye of mockDyes) {
      expect(dye.id).toBeDefined();
      expect(dye.itemID).toBeDefined();
      expect(dye.name).toBeDefined();
      expect(dye.hex).toBeDefined();
      expect(dye.rgb).toBeDefined();
      expect(dye.hsv).toBeDefined();
      expect(dye.category).toBeDefined();
      expect(dye.acquisition).toBeDefined();
      expect(typeof dye.isMetallic).toBe('boolean');
      expect(typeof dye.isPastel).toBe('boolean');
      expect(typeof dye.isDark).toBe('boolean');
      expect(typeof dye.isCosmic).toBe('boolean');
    }
  });

  it('contains variety of dye types', () => {
    const hasMetallic = mockDyes.some((d) => d.isMetallic);
    const hasPastel = mockDyes.some((d) => d.isPastel);
    const hasDark = mockDyes.some((d) => d.isDark);
    const hasWhite = mockDyes.some((d) => d.category === 'White');
    const hasBlack = mockDyes.some((d) => d.category === 'Black');

    expect(hasMetallic).toBe(true);
    expect(hasPastel).toBe(true);
    expect(hasDark).toBe(true);
    expect(hasWhite).toBe(true);
    expect(hasBlack).toBe(true);
  });

  it('has valid RGB values', () => {
    for (const dye of mockDyes) {
      expect(dye.rgb.r).toBeGreaterThanOrEqual(0);
      expect(dye.rgb.r).toBeLessThanOrEqual(255);
      expect(dye.rgb.g).toBeGreaterThanOrEqual(0);
      expect(dye.rgb.g).toBeLessThanOrEqual(255);
      expect(dye.rgb.b).toBeGreaterThanOrEqual(0);
      expect(dye.rgb.b).toBeLessThanOrEqual(255);
    }
  });

  it('has valid hex values', () => {
    for (const dye of mockDyes) {
      expect(dye.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('createMockDye', () => {
  it('creates a dye with defaults', () => {
    const dye = createMockDye();

    expect(dye.id).toBe(1);
    expect(dye.itemID).toBe(5701);
    expect(dye.name).toBe('Test Dye 1');
    expect(dye.hex).toBe('#888888');
    expect(dye.category).toBe('Grey');
    expect(dye.acquisition).toBe('Vendor');
    expect(dye.isMetallic).toBe(false);
    expect(dye.isPastel).toBe(false);
    expect(dye.isDark).toBe(false);
    expect(dye.isCosmic).toBe(false);
  });

  it('accepts overrides', () => {
    const dye = createMockDye({
      name: 'Custom Dye',
      hex: '#FF0000',
      isMetallic: true,
    });

    expect(dye.name).toBe('Custom Dye');
    expect(dye.hex).toBe('#FF0000');
    expect(dye.isMetallic).toBe(true);
  });

  it('generates unique IDs', () => {
    const dye1 = createMockDye();
    const dye2 = createMockDye();

    expect(dye1.id).not.toBe(dye2.id);
  });

  it('generates itemID based on ID', () => {
    const dye = createMockDye();

    expect(dye.itemID).toBe(5700 + dye.id);
  });

  it('uses overridden ID for itemID calculation', () => {
    const dye = createMockDye({ id: 100 });

    expect(dye.id).toBe(100);
    expect(dye.itemID).toBe(5800);
  });
});

describe('createMockDyes', () => {
  it('creates specified number of dyes', () => {
    const dyes = createMockDyes(5);

    expect(dyes).toHaveLength(5);
  });

  it('generates unique IDs', () => {
    const dyes = createMockDyes(3);
    const ids = dyes.map((d) => d.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);
  });

  it('applies overrides to all dyes', () => {
    const dyes = createMockDyes(3, { isMetallic: true, category: 'Gold' });

    expect(dyes.every((d) => d.isMetallic === true)).toBe(true);
    expect(dyes.every((d) => d.category === 'Gold')).toBe(true);
  });
});

describe('createMetallicDye', () => {
  it('creates a metallic dye', () => {
    const dye = createMetallicDye();

    expect(dye.isMetallic).toBe(true);
  });

  it('accepts overrides', () => {
    const dye = createMetallicDye({ name: 'Shiny Gold' });

    expect(dye.name).toBe('Shiny Gold');
    expect(dye.isMetallic).toBe(true);
  });
});

describe('createPastelDye', () => {
  it('creates a pastel dye', () => {
    const dye = createPastelDye();

    expect(dye.isPastel).toBe(true);
  });

  it('accepts overrides', () => {
    const dye = createPastelDye({ name: 'Soft Pink' });

    expect(dye.name).toBe('Soft Pink');
    expect(dye.isPastel).toBe(true);
  });
});

describe('createDarkDye', () => {
  it('creates a dark dye', () => {
    const dye = createDarkDye();

    expect(dye.isDark).toBe(true);
  });

  it('has dark default values', () => {
    const dye = createDarkDye();

    expect(dye.hex).toBe('#333333');
    expect(dye.rgb.r).toBe(51);
    expect(dye.rgb.g).toBe(51);
    expect(dye.rgb.b).toBe(51);
  });

  it('accepts overrides', () => {
    const dye = createDarkDye({ name: 'Midnight Black' });

    expect(dye.name).toBe('Midnight Black');
    expect(dye.isDark).toBe(true);
  });
});

describe('getMockDyeById', () => {
  it('returns dye with matching ID', () => {
    const dye = getMockDyeById(1);

    expect(dye).toBeDefined();
    expect(dye?.id).toBe(1);
    expect(dye?.name).toBe('Snow White');
  });

  it('returns undefined for missing ID', () => {
    const dye = getMockDyeById(999);

    expect(dye).toBeUndefined();
  });

  it('returns correct dye for each ID in mockDyes', () => {
    for (const expected of mockDyes) {
      const found = getMockDyeById(expected.id);
      expect(found).toEqual(expected);
    }
  });
});

describe('getMockDyesByIds', () => {
  it('returns dyes matching IDs', () => {
    const dyes = getMockDyesByIds([1, 2, 3]);

    expect(dyes).toHaveLength(3);
    expect(dyes.map((d) => d.id)).toEqual([1, 2, 3]);
  });

  it('filters out missing IDs', () => {
    const dyes = getMockDyesByIds([1, 999, 2, 888]);

    expect(dyes).toHaveLength(2);
    expect(dyes.map((d) => d.id)).toEqual([1, 2]);
  });

  it('returns empty array for all missing IDs', () => {
    const dyes = getMockDyesByIds([999, 888, 777]);

    expect(dyes).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    const dyes = getMockDyesByIds([]);

    expect(dyes).toEqual([]);
  });

  it('preserves order of input IDs', () => {
    const dyes = getMockDyesByIds([3, 1, 2]);

    expect(dyes.map((d) => d.id)).toEqual([3, 1, 2]);
  });
});
