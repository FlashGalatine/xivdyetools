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
    expect(dye.itemID).toBe(dye.id);
    expect(dye.name).toBe(`Test Dye ${dye.stainID}`);
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

  // pkg-worker-kit-test-utils-15: these three tests pinned a fixture that
  // could not represent a real dye -- `stainID` copied a 9-digit randomId()
  // and `id` was 5700 less than `itemID`, inverting the contract in
  // types/src/dye/dye.ts ("`id` is always equal to `itemID`"). That is the same
  // inversion that manufactured green for a class of dye-id defects elsewhere
  // in this audit, so the shared factory must not reproduce it.
  it('puts stainID inside the real 1-254 Stain range', () => {
    for (let i = 0; i < 50; i++) {
      const dye = createMockDye();
      expect(dye.stainID).toBeGreaterThanOrEqual(1);
      expect(dye.stainID).toBeLessThanOrEqual(254);
    }
  });

  it('derives itemID from stainID, and id from itemID', () => {
    const dye = createMockDye({ stainID: 1 });

    // Snow White: stainID 1, itemID 5729.
    expect(dye.itemID).toBe(5729);
    expect(dye.id).toBe(dye.itemID);
  });

  it('keeps id === itemID, the invariant DyeDatabase.initialize() guarantees', () => {
    const dye = createMockDye();

    expect(dye.id).toBe(dye.itemID);
    expect(dye.id).not.toBe(dye.stainID);
  });

  it('honours an explicit itemID override, and id follows it', () => {
    const dye = createMockDye({ itemID: 13115 });

    expect(dye.itemID).toBe(13115);
    expect(dye.id).toBe(13115);
  });

  it('still allows id to be overridden independently', () => {
    const dye = createMockDye({ id: 100 });

    expect(dye.id).toBe(100);
  });
});
