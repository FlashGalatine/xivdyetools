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
import { nextId } from '../utils/counters.js';

// Re-export type for convenience
export type { Dye };

/**
 * Sample mock dyes for testing
 *
 * A small set of dyes covering different categories and properties.
 */
export const mockDyes: Dye[] = [
  {
    itemID: 5729,
    stainID: 1,
    id: 1,
    name: 'Snow White',
    hex: '#FFFFFF',
    rgb: { r: 255, g: 255, b: 255 },
    hsv: { h: 0, s: 0, v: 100 },
    category: 'White',
    acquisition: 'Vendor',
    cost: 216,
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
  },
  {
    itemID: 5730,
    stainID: 2,
    id: 2,
    name: 'Soot Black',
    hex: '#000000',
    rgb: { r: 0, g: 0, b: 0 },
    hsv: { h: 0, s: 0, v: 0 },
    category: 'Black',
    acquisition: 'Vendor',
    cost: 216,
    isMetallic: false,
    isPastel: false,
    isDark: true,
    isCosmic: false,
  },
  {
    itemID: 5731,
    stainID: 3,
    id: 3,
    name: 'Dalamud Red',
    hex: '#FF0000',
    rgb: { r: 255, g: 0, b: 0 },
    hsv: { h: 0, s: 100, v: 100 },
    category: 'Red',
    acquisition: 'Crafted',
    cost: 500,
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
  },
  {
    itemID: 5732,
    stainID: 4,
    id: 4,
    name: 'Royal Blue',
    hex: '#0000FF',
    rgb: { r: 0, g: 0, b: 255 },
    hsv: { h: 240, s: 100, v: 100 },
    category: 'Blue',
    acquisition: 'Crafted',
    cost: 500,
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
  },
  {
    itemID: 5733,
    stainID: 5,
    id: 5,
    name: 'Metallic Gold',
    hex: '#FFD700',
    rgb: { r: 255, g: 215, b: 0 },
    hsv: { h: 51, s: 100, v: 100 },
    category: 'Yellow',
    acquisition: 'Special',
    cost: 1000,
    isMetallic: true,
    isPastel: false,
    isDark: false,
    isCosmic: false,
  },
  {
    itemID: 5734,
    stainID: 6,
    id: 6,
    name: 'Pastel Pink',
    hex: '#FFB6C1',
    rgb: { r: 255, g: 182, b: 193 },
    hsv: { h: 351, s: 29, v: 100 },
    category: 'Red',
    acquisition: 'Vendor',
    cost: 216,
    isMetallic: false,
    isPastel: true,
    isDark: false,
    isCosmic: false,
  },
];

/**
 * Creates a mock dye with custom properties
 *
 * @param overrides - Optional overrides for the default values
 * @returns A Dye object
 */
export function createMockDye(overrides: Partial<Dye> = {}): Dye {
  const id = overrides.id ?? nextId('dye');
  const itemID = overrides.itemID ?? 5700 + id;

  return {
    itemID,
    stainID: overrides.stainID ?? id,
    id,
    name: `Test Dye ${id}`,
    hex: '#888888',
    rgb: { r: 136, g: 136, b: 136 },
    hsv: { h: 0, s: 0, v: 53 },
    category: 'Grey',
    acquisition: 'Vendor',
    cost: 216,
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
    ...overrides,
  };
}

/**
 * Creates multiple mock dyes
 *
 * @param count - Number of dyes to create
 * @param overrides - Optional overrides to apply to all dyes
 * @returns Array of Dye objects
 */
export function createMockDyes(
  count: number,
  overrides: Partial<Dye> = {}
): Dye[] {
  return Array.from({ length: count }, () => createMockDye(overrides));
}

/**
 * Creates a metallic dye
 *
 * @param overrides - Optional overrides
 * @returns A metallic Dye object
 */
export function createMetallicDye(overrides: Partial<Dye> = {}): Dye {
  return createMockDye({
    isMetallic: true,
    ...overrides,
  });
}

/**
 * Creates a pastel dye
 *
 * @param overrides - Optional overrides
 * @returns A pastel Dye object
 */
export function createPastelDye(overrides: Partial<Dye> = {}): Dye {
  return createMockDye({
    isPastel: true,
    ...overrides,
  });
}

/**
 * Creates a dark dye
 *
 * @param overrides - Optional overrides
 * @returns A dark Dye object
 */
export function createDarkDye(overrides: Partial<Dye> = {}): Dye {
  return createMockDye({
    isDark: true,
    hex: '#333333',
    rgb: { r: 51, g: 51, b: 51 },
    hsv: { h: 0, s: 0, v: 20 },
    ...overrides,
  });
}

/**
 * Get a dye by ID from the mock dyes
 *
 * @param id - The dye ID
 * @returns The Dye object or undefined
 */
export function getMockDyeById(id: number): Dye | undefined {
  return mockDyes.find((dye) => dye.id === id);
}

/**
 * Get dyes by IDs from the mock dyes
 *
 * @param ids - Array of dye IDs
 * @returns Array of Dye objects (missing IDs are filtered out)
 */
export function getMockDyesByIds(ids: number[]): Dye[] {
  return ids
    .map((id) => getMockDyeById(id))
    .filter((dye): dye is Dye => dye !== undefined);
}
