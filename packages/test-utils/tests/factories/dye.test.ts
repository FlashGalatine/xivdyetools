/**
 * Tests for dye factory functions
 */
import { describe, it, expect } from 'vitest';
import { mockDyes, createMockDye } from '../../src/factories/dye.js';

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

    expect(dye.id).toBeGreaterThan(0);
    expect(dye.itemID).toBe(5700 + dye.id);
    expect(dye.name).toBe(`Test Dye ${dye.id}`);
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
