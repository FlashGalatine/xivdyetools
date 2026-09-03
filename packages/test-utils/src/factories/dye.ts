/**
 * Dye factory functions and mock data for testing
 *
 * Provides mock dye data and factory functions for testing
 * dye-related functionality.
 *
 * @example
 * ```typescript
 * import { mockDyes, createMockDye } from '@xivdyetools/test-utils/factories';
 *
 * // Use predefined mock dyes
 * const dyes = mockDyes;
 *
 * // Create a custom mock dye
 * const dye = createMockDye({ name: 'Custom Dye', hex: '#FF0000' });
 * ```
 */

import type { Dye } from '@xivdyetools/types/dye';


// Re-export type for convenience
export type { Dye };

/**
 * Real dye stain IDs occupy 1-254 in the Stain sheet. Anything outside that is
 * rejected by presets-api and treated as an invalid id class by api-worker.
 */
const MAX_STAIN_ID = 254;

/** Snow White is stainID 1 / itemID 5729, so legacy item IDs start here. */
const LEGACY_ITEM_ID_BASE = 5728;

/** TEST-DESIGN-001: random, so parallel test files do not collide. */
function randomStainId(): number {
  return Math.floor(Math.random() * MAX_STAIN_ID) + 1;
}

function legacyItemIdForStain(stainID: number | null): number {
  return LEGACY_ITEM_ID_BASE + (stainID ?? 1);
}

/**
 * Sample mock dyes for testing
 *
 * A small set of dyes covering different categories and properties.
 */
export const mockDyes: Dye[] = [
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
];

/**
 * Creates a mock dye with custom properties
 *
 * @param overrides - Optional overrides for the default values
 * @returns A Dye object
 */
export function createMockDye(overrides: Partial<Dye> = {}): Dye {
  // pkg-worker-kit-test-utils-15: these fixtures could not represent a real
  // dye. `id` defaulted to a 9-digit randomId() and `stainID` copied it, so
  // stainID landed far outside the real 1-254 Stain range (presets-api's
  // validatePresetDyes rejects >254; api-worker's resolveIdType calls
  // 255-5728 invalid), and `id !== itemID` contradicted the contract in
  // types/src/dye/dye.ts: "always equal to `itemID` after
  // DyeDatabase.initialize()". That inversion is exactly the shape that
  // manufactured green for a whole class of dye-id defects elsewhere in this
  // audit, so the shared factory must not reproduce it.
  const stainID = overrides.stainID ?? randomStainId();
  const itemID = overrides.itemID ?? legacyItemIdForStain(stainID);
  const id = overrides.id ?? itemID;

  return {
    itemID,
    stainID,
    id,
    name: `Test Dye ${stainID ?? id}`,
    hex: '#888888',
    rgb: { r: 136, g: 136, b: 136 },
    hsv: { h: 0, s: 0, v: 53 },
    category: 'Grey',
    acquisition: 'Vendor',
    cost: 216,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
    isIshgardian: false,
    consolidationType: null,
    ...overrides,
  };
}
