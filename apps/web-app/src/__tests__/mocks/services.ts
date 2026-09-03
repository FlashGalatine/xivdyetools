/**
 * XIV Dye Tools - Mock dye fixtures for component testing
 *
 * `mockDyes` is the shared fixture set. (The service-factory mocks that used to
 * live here — createMock*Service / AllMockServices — had no importers; every
 * test uses vi.mock() module mocks instead. Removed 2026-08-16, DEAD-028.)
 *
 * @module __tests__/mocks/services
 */

import type { Dye, RGB, HSV, HexColor } from '@xivdyetools/types';

// ============================================================================
// Mock Dye Data
// ============================================================================

/**
 * Representative set of mock dyes covering different categories and acquisition types
 */
export const mockDyes: Dye[] = [
  {
    id: 5729,
    itemID: 5729,
    stainID: 1,
    name: 'Snow White',
    hex: '#FFFFFF' as HexColor,
    rgb: { r: 255, g: 255, b: 255 } as RGB,
    hsv: { h: 0, s: 0, v: 100 } as HSV,
    category: 'White',
    acquisition: 'merchant',
    cost: 216,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    id: 5730,
    itemID: 5730,
    stainID: 2,
    name: 'Ash Grey',
    hex: '#888888' as HexColor,
    rgb: { r: 136, g: 136, b: 136 } as RGB,
    hsv: { h: 0, s: 0, v: 53 } as HSV,
    category: 'Grey',
    acquisition: 'merchant',
    cost: 216,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: true,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    id: 5731,
    itemID: 5731,
    stainID: 3,
    name: 'Soot Black',
    hex: '#1A1A1A' as HexColor,
    rgb: { r: 26, g: 26, b: 26 } as RGB,
    hsv: { h: 0, s: 0, v: 10 } as HSV,
    category: 'Black',
    acquisition: 'merchant',
    cost: 216,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: true,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    id: 5732,
    itemID: 5732,
    stainID: 4,
    name: 'Rose Pink',
    hex: '#FF9999' as HexColor,
    rgb: { r: 255, g: 153, b: 153 } as RGB,
    hsv: { h: 0, s: 40, v: 100 } as HSV,
    category: 'Red',
    acquisition: 'crafted',
    cost: 0,
    currency: 'Gil',
    isMetallic: false,
    isPastel: true,
    isDark: false,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    id: 5733,
    itemID: 5733,
    stainID: 5,
    name: 'Wine Red',
    hex: '#991111' as HexColor,
    rgb: { r: 153, g: 17, b: 17 } as RGB,
    hsv: { h: 0, s: 89, v: 60 } as HSV,
    category: 'Red',
    acquisition: 'crafted',
    cost: 0,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: true,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    id: 5734,
    itemID: 5734,
    stainID: 6,
    name: 'Coral Pink',
    hex: '#FF7F7F' as HexColor,
    rgb: { r: 255, g: 127, b: 127 } as RGB,
    hsv: { h: 0, s: 50, v: 100 } as HSV,
    category: 'Red',
    acquisition: 'achievement',
    cost: 0,
    currency: 'Gil',
    isMetallic: false,
    isPastel: true,
    isDark: false,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    id: 5735,
    itemID: 5735,
    stainID: 7,
    name: 'Blood Red',
    hex: '#CC0000' as HexColor,
    rgb: { r: 204, g: 0, b: 0 } as RGB,
    hsv: { h: 0, s: 100, v: 80 } as HSV,
    category: 'Red',
    acquisition: 'special',
    cost: 0,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: true,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    id: 5736,
    itemID: 5736,
    stainID: 8,
    name: 'Sunset Orange',
    hex: '#FF6600' as HexColor,
    rgb: { r: 255, g: 102, b: 0 } as RGB,
    hsv: { h: 24, s: 100, v: 100 } as HSV,
    category: 'Orange',
    acquisition: 'merchant',
    cost: 500,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    id: 5737,
    itemID: 5737,
    stainID: 9,
    name: 'Dalamud Red',
    hex: '#990000' as HexColor,
    rgb: { r: 153, g: 0, b: 0 } as RGB,
    hsv: { h: 0, s: 100, v: 60 } as HSV,
    category: 'Red',
    acquisition: 'special',
    cost: 0,
    currency: 'Gil',
    isMetallic: true,
    isPastel: false,
    isDark: true,
    isCosmic: true,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    id: 5738,
    itemID: 5738,
    stainID: 10,
    name: 'Sky Blue',
    hex: '#87CEEB' as HexColor,
    rgb: { r: 135, g: 206, b: 235 } as RGB,
    hsv: { h: 197, s: 43, v: 92 } as HSV,
    category: 'Blue',
    acquisition: 'merchant',
    cost: 216,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
];
