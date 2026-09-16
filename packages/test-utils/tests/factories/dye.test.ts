/**
 * Tests for dye factory functions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockDyes, createMockDye, resetMockDyeSequence, randomStainId } from '../../src/factories/dye.js';

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

  it('is byte-identical fixed content, not sequence-based (BUG-007)', () => {
    // mockDyes is a static array; it must not be perturbed by
    // createMockDye()'s default stainID sequence in either direction.
    resetMockDyeSequence();
    createMockDye();
    createMockDye();
    expect(mockDyes).toEqual([
      {
        itemID: 5729,
        stainID: 1,
        id: 5729,
        name: 'Snow White',
        hex: '#FFFFFF',
        rgb: { r: 255, g: 255, b: 255 },
        hsv: { h: 0, s: 0, v: 100 },
        category: 'White',
        acquisition: 'Vendor',
        cost: 216,
        currency: 'Gil',
        isMetallic: false,
        isPastel: false,
        isDark: false,
        isCosmic: false,
        isIshgardian: false,
        consolidationType: 'A',
      },
      {
        itemID: 5730,
        stainID: 2,
        id: 5730,
        name: 'Soot Black',
        hex: '#000000',
        rgb: { r: 0, g: 0, b: 0 },
        hsv: { h: 0, s: 0, v: 0 },
        category: 'Black',
        acquisition: 'Vendor',
        cost: 216,
        currency: 'Gil',
        isMetallic: false,
        isPastel: false,
        isDark: true,
        isCosmic: false,
        isIshgardian: false,
        consolidationType: 'A',
      },
      {
        itemID: 5731,
        stainID: 3,
        id: 5731,
        name: 'Dalamud Red',
        hex: '#FF0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsv: { h: 0, s: 100, v: 100 },
        category: 'Red',
        acquisition: 'Crafted',
        cost: 500,
        currency: 'Gil',
        isMetallic: false,
        isPastel: false,
        isDark: false,
        isCosmic: false,
        isIshgardian: false,
        consolidationType: 'A',
      },
      {
        itemID: 5732,
        stainID: 4,
        id: 5732,
        name: 'Royal Blue',
        hex: '#0000FF',
        rgb: { r: 0, g: 0, b: 255 },
        hsv: { h: 240, s: 100, v: 100 },
        category: 'Blue',
        acquisition: 'Crafted',
        cost: 500,
        currency: 'Gil',
        isMetallic: false,
        isPastel: false,
        isDark: false,
        isCosmic: false,
        isIshgardian: false,
        consolidationType: 'A',
      },
      {
        itemID: 5733,
        stainID: 5,
        id: 5733,
        name: 'Metallic Gold',
        hex: '#FFD700',
        rgb: { r: 255, g: 215, b: 0 },
        hsv: { h: 51, s: 100, v: 100 },
        category: 'Yellow',
        acquisition: 'Special',
        cost: 1000,
        currency: 'Gil',
        isMetallic: true,
        isPastel: false,
        isDark: false,
        isCosmic: false,
        isIshgardian: false,
        consolidationType: 'A',
      },
      {
        itemID: 5734,
        stainID: 6,
        id: 5734,
        name: 'Pastel Pink',
        hex: '#FFB6C1',
        rgb: { r: 255, g: 182, b: 193 },
        hsv: { h: 351, s: 29, v: 100 },
        category: 'Red',
        acquisition: 'Vendor',
        cost: 216,
        currency: 'Gil',
        isMetallic: false,
        isPastel: true,
        isDark: false,
        isCosmic: false,
        isIshgardian: false,
        consolidationType: 'A',
      },
    ]);
  });
});

describe('createMockDye', () => {
  beforeEach(() => {
    resetMockDyeSequence();
  });

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

  // BUG-007: the default stainID is a deterministic module-level counter
  // over the real 1-254 Stain range, not a Math.random() draw — the old
  // random default collided ~1/254 per pair (this audit's own coverage run
  // failed on exactly that). Building every value in the range, in order,
  // and rejecting the 255th call replaces the flaky "generates unique IDs"
  // test that only ever sampled two dyes.
  it('assigns default stainIDs 1..254 across successive calls, then throws', () => {
    const dyes = Array.from({ length: MAX_STAIN_ID_FOR_TEST() }, () => createMockDye());

    const stainIDs = dyes.map((d) => d.stainID);
    const itemIDs = dyes.map((d) => d.itemID);
    const ids = dyes.map((d) => d.id);

    expect(stainIDs).toEqual(Array.from({ length: 254 }, (_, i) => i + 1));
    expect(new Set(stainIDs).size).toBe(254);
    expect(new Set(itemIDs).size).toBe(254);
    expect(new Set(ids).size).toBe(254);

    expect(() => createMockDye()).toThrowError(/254/);
  });

  it('resetMockDyeSequence() restarts the default stainID sequence at 1', () => {
    createMockDye();
    createMockDye();
    resetMockDyeSequence();

    const dye = createMockDye();
    expect(dye.stainID).toBe(1);
  });

  it('honours an explicit stainID: null override (BUG-021)', () => {
    const dye = createMockDye({ stainID: null });

    expect(dye.stainID).toBeNull();
    // legacyItemIdForStain(null) falls back to Snow White's slot (5728 + 1).
    expect(dye.itemID).toBe(5729);
    expect(dye.id).toBe(5729);
  });

  it('does not advance the default sequence when stainID is explicitly overridden', () => {
    createMockDye({ stainID: null });
    const dye = createMockDye();
    expect(dye.stainID).toBe(1);
  });

  it('exposes an opt-in random draw, unused by the default path', () => {
    for (let i = 0; i < 50; i++) {
      const value = randomStainId();
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(254);
    }
  });

  it('puts default stainIDs inside the real 1-254 Stain range', () => {
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

/** Kept as a function so the 254 literal only needs to change in one place if MAX_STAIN_ID ever does. */
function MAX_STAIN_ID_FOR_TEST(): number {
  return 254;
}
