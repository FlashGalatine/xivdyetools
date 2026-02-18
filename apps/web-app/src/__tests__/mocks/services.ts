/**
 * XIV Dye Tools - Mock Services for Component Testing
 *
 * Provides mock implementations of all services used by components.
 * These mocks are designed for unit testing in isolation from real services.
 *
 * @module __tests__/mocks/services
 */

import { vi } from 'vitest';
import type { Dye, RGB, HSV, HexColor } from '@xivdyetools/types';

// ============================================================================
// Mock Dye Data
// ============================================================================

/**
 * Representative set of mock dyes covering different categories and acquisition types
 */
export const mockDyes: Dye[] = [
  {
    id: 1,
    itemID: 5729,
    stainID: 1,
    name: 'Snow White',
    hex: '#FFFFFF' as HexColor,
    rgb: { r: 255, g: 255, b: 255 } as RGB,
    hsv: { h: 0, s: 0, v: 100 } as HSV,
    category: 'White',
    acquisition: 'merchant',
    cost: 216,
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
  },
  {
    id: 2,
    itemID: 5730,
    stainID: 2,
    name: 'Ash Grey',
    hex: '#888888' as HexColor,
    rgb: { r: 136, g: 136, b: 136 } as RGB,
    hsv: { h: 0, s: 0, v: 53 } as HSV,
    category: 'Grey',
    acquisition: 'merchant',
    cost: 216,
    isMetallic: false,
    isPastel: false,
    isDark: true,
    isCosmic: false,
  },
  {
    id: 3,
    itemID: 5731,
    stainID: 3,
    name: 'Soot Black',
    hex: '#1A1A1A' as HexColor,
    rgb: { r: 26, g: 26, b: 26 } as RGB,
    hsv: { h: 0, s: 0, v: 10 } as HSV,
    category: 'Black',
    acquisition: 'merchant',
    cost: 216,
    isMetallic: false,
    isPastel: false,
    isDark: true,
    isCosmic: false,
  },
  {
    id: 4,
    itemID: 5732,
    stainID: 4,
    name: 'Rose Pink',
    hex: '#FF9999' as HexColor,
    rgb: { r: 255, g: 153, b: 153 } as RGB,
    hsv: { h: 0, s: 40, v: 100 } as HSV,
    category: 'Red',
    acquisition: 'crafted',
    cost: 0,
    isMetallic: false,
    isPastel: true,
    isDark: false,
    isCosmic: false,
  },
  {
    id: 5,
    itemID: 5733,
    stainID: 5,
    name: 'Wine Red',
    hex: '#991111' as HexColor,
    rgb: { r: 153, g: 17, b: 17 } as RGB,
    hsv: { h: 0, s: 89, v: 60 } as HSV,
    category: 'Red',
    acquisition: 'crafted',
    cost: 0,
    isMetallic: false,
    isPastel: false,
    isDark: true,
    isCosmic: false,
  },
  {
    id: 6,
    itemID: 5734,
    stainID: 6,
    name: 'Coral Pink',
    hex: '#FF7F7F' as HexColor,
    rgb: { r: 255, g: 127, b: 127 } as RGB,
    hsv: { h: 0, s: 50, v: 100 } as HSV,
    category: 'Red',
    acquisition: 'achievement',
    cost: 0,
    isMetallic: false,
    isPastel: true,
    isDark: false,
    isCosmic: false,
  },
  {
    id: 7,
    itemID: 5735,
    stainID: 7,
    name: 'Blood Red',
    hex: '#CC0000' as HexColor,
    rgb: { r: 204, g: 0, b: 0 } as RGB,
    hsv: { h: 0, s: 100, v: 80 } as HSV,
    category: 'Red',
    acquisition: 'special',
    cost: 0,
    isMetallic: false,
    isPastel: false,
    isDark: true,
    isCosmic: false,
  },
  {
    id: 8,
    itemID: 5736,
    stainID: 8,
    name: 'Sunset Orange',
    hex: '#FF6600' as HexColor,
    rgb: { r: 255, g: 102, b: 0 } as RGB,
    hsv: { h: 24, s: 100, v: 100 } as HSV,
    category: 'Orange',
    acquisition: 'merchant',
    cost: 500,
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
  },
  {
    id: 9,
    itemID: 5737,
    stainID: 9,
    name: 'Dalamud Red',
    hex: '#990000' as HexColor,
    rgb: { r: 153, g: 0, b: 0 } as RGB,
    hsv: { h: 0, s: 100, v: 60 } as HSV,
    category: 'Red',
    acquisition: 'special',
    cost: 0,
    isMetallic: true,
    isPastel: false,
    isDark: true,
    isCosmic: true,
  },
  {
    id: 10,
    itemID: 5738,
    stainID: 10,
    name: 'Sky Blue',
    hex: '#87CEEB' as HexColor,
    rgb: { r: 135, g: 206, b: 235 } as RGB,
    hsv: { h: 197, s: 43, v: 92 } as HSV,
    category: 'Blue',
    acquisition: 'merchant',
    cost: 216,
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
  },
];

// ============================================================================
// Mock DyeService
// ============================================================================

export interface MockDyeService {
  getAllDyes: ReturnType<typeof vi.fn>;
  getDyeById: ReturnType<typeof vi.fn>;
  getDyesByCategory: ReturnType<typeof vi.fn>;
  getDyeByName: ReturnType<typeof vi.fn>;
  getCategories: ReturnType<typeof vi.fn>;
}

export function createMockDyeService(customDyes?: Dye[]): MockDyeService {
  const dyes = customDyes || mockDyes;

  return {
    getAllDyes: vi.fn(() => dyes),
    getDyeById: vi.fn((id: number) => dyes.find((d) => d.id === id) || null),
    getDyesByCategory: vi.fn((category: string) =>
      dyes.filter((d) => d.category.toLowerCase() === category.toLowerCase())
    ),
    getDyeByName: vi.fn((name: string) =>
      dyes.find((d) => d.name.toLowerCase() === name.toLowerCase()) || null
    ),
    getCategories: vi.fn(() => [...new Set(dyes.map((d) => d.category))]),
  };
}

// ============================================================================
// Mock StorageService
// ============================================================================

export interface MockStorageService {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  _store: Map<string, unknown>;
}

export function createMockStorageService(): MockStorageService {
  const store = new Map<string, unknown>();

  return {
    _store: store,
    getItem: vi.fn(<T>(key: string, defaultValue?: T): T | null => {
      const value = store.get(key);
      if (value === undefined) return defaultValue ?? null;
      return value as T;
    }),
    setItem: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

// ============================================================================
// Mock CollectionService
// ============================================================================

export interface MockCollectionService {
  getFavorites: ReturnType<typeof vi.fn>;
  subscribeFavorites: ReturnType<typeof vi.fn>;
  addFavorite: ReturnType<typeof vi.fn>;
  removeFavorite: ReturnType<typeof vi.fn>;
  isFavorite: ReturnType<typeof vi.fn>;
  getCollections: ReturnType<typeof vi.fn>;
  createCollection: ReturnType<typeof vi.fn>;
  deleteCollection: ReturnType<typeof vi.fn>;
  _favorites: number[];
}

export function createMockCollectionService(initialFavorites: number[] = []): MockCollectionService {
  const favorites = [...initialFavorites];
  const subscribers: Array<(favorites: number[]) => void> = [];

  const notifySubscribers = () => {
    subscribers.forEach((cb) => cb([...favorites]));
  };

  return {
    _favorites: favorites,
    getFavorites: vi.fn(() => [...favorites]),
    subscribeFavorites: vi.fn((callback: (favorites: number[]) => void) => {
      subscribers.push(callback);
      callback([...favorites]);
      return () => {
        const idx = subscribers.indexOf(callback);
        if (idx > -1) subscribers.splice(idx, 1);
      };
    }),
    addFavorite: vi.fn((dyeId: number) => {
      if (!favorites.includes(dyeId)) {
        favorites.push(dyeId);
        notifySubscribers();
      }
    }),
    removeFavorite: vi.fn((dyeId: number) => {
      const idx = favorites.indexOf(dyeId);
      if (idx > -1) {
        favorites.splice(idx, 1);
        notifySubscribers();
      }
    }),
    isFavorite: vi.fn((dyeId: number) => favorites.includes(dyeId)),
    getCollections: vi.fn(() => []),
    createCollection: vi.fn(() => ({ id: 'mock-collection', name: 'Test', dyes: [] })),
    deleteCollection: vi.fn(),
  };
}

// ============================================================================
// Mock MarketBoardService
// ============================================================================

export interface MockMarketBoardService {
  getShowPrices: ReturnType<typeof vi.fn>;
  setShowPrices: ReturnType<typeof vi.fn>;
  getAllPrices: ReturnType<typeof vi.fn>;
  getPriceForDye: ReturnType<typeof vi.fn>;
  fetchPricesForDyes: ReturnType<typeof vi.fn>;
  getWorldNameForPrice: ReturnType<typeof vi.fn>;
  getSelectedServer: ReturnType<typeof vi.fn>;
  setSelectedServer: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

export function createMockMarketBoardService(): MockMarketBoardService {
  const prices = new Map<number, number>();
  let showPrices = false;
  let selectedServer = 'Crystal';

  return {
    getShowPrices: vi.fn(() => showPrices),
    setShowPrices: vi.fn((value: boolean) => {
      showPrices = value;
    }),
    getAllPrices: vi.fn(() => new Map(prices)),
    getPriceForDye: vi.fn((dyeId: number) => prices.get(dyeId) || null),
    fetchPricesForDyes: vi.fn(async (dyeIds: number[]) => {
      const result = new Map<number, number>();
      dyeIds.forEach((id) => {
        result.set(id, Math.floor(Math.random() * 10000) + 100);
      });
      return result;
    }),
    getWorldNameForPrice: vi.fn(() => selectedServer),
    getSelectedServer: vi.fn(() => selectedServer),
    setSelectedServer: vi.fn((server: string) => {
      selectedServer = server;
    }),
    subscribe: vi.fn(() => () => {}),
  };
}

// ============================================================================
// Mock ToastService
// ============================================================================

export interface MockToastService {
  show: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  dismiss: ReturnType<typeof vi.fn>;
  dismissAll: ReturnType<typeof vi.fn>;
  getToasts: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

export function createMockToastService(): MockToastService {
  return {
    show: vi.fn(() => 'toast_123'),
    success: vi.fn(() => 'toast_123'),
    error: vi.fn(() => 'toast_123'),
    warning: vi.fn(() => 'toast_123'),
    info: vi.fn(() => 'toast_123'),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
    getToasts: vi.fn(() => []),
    subscribe: vi.fn(() => () => {}),
  };
}

// ============================================================================
// Mock ModalService
// ============================================================================

export interface MockModalService {
  show: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  closeAll: ReturnType<typeof vi.fn>;
  getActiveModals: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

export function createMockModalService(): MockModalService {
  return {
    show: vi.fn(() => 'modal_123'),
    close: vi.fn(),
    closeAll: vi.fn(),
    getActiveModals: vi.fn(() => []),
    subscribe: vi.fn(() => () => {}),
  };
}

// ============================================================================
// Mock RouterService
// ============================================================================

export interface MockRouterService {
  navigate: ReturnType<typeof vi.fn>;
  getCurrentRoute: ReturnType<typeof vi.fn>;
  getParam: ReturnType<typeof vi.fn>;
  setParam: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

export function createMockRouterService(): MockRouterService {
  let currentRoute = '/';
  const params = new Map<string, string>();

  return {
    navigate: vi.fn((route: string) => {
      currentRoute = route;
    }),
    getCurrentRoute: vi.fn(() => currentRoute),
    getParam: vi.fn((key: string) => params.get(key) || null),
    setParam: vi.fn((key: string, value: string) => {
      params.set(key, value);
    }),
    subscribe: vi.fn(() => () => {}),
  };
}

// ============================================================================
// Mock ColorService (Pure functions - typically don't need mocking)
// ============================================================================

export interface MockColorService {
  hexToRgb: ReturnType<typeof vi.fn>;
  rgbToHex: ReturnType<typeof vi.fn>;
  hexToHsv: ReturnType<typeof vi.fn>;
  hsvToHex: ReturnType<typeof vi.fn>;
  getColorDistance: ReturnType<typeof vi.fn>;
  getContrastRatio: ReturnType<typeof vi.fn>;
}

export function createMockColorService(): MockColorService {
  return {
    hexToRgb: vi.fn((hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 };
    }),
    rgbToHex: vi.fn((rgb: RGB) => {
      return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
    }),
    hexToHsv: vi.fn(() => ({ h: 0, s: 0, v: 100 })),
    hsvToHex: vi.fn(() => '#FFFFFF'),
    getColorDistance: vi.fn(() => 0),
    getContrastRatio: vi.fn(() => 21),
  };
}

// ============================================================================
// Helper to create all mocks at once
// ============================================================================

export interface AllMockServices {
  dyeService: MockDyeService;
  storageService: MockStorageService;
  collectionService: MockCollectionService;
  marketBoardService: MockMarketBoardService;
  toastService: MockToastService;
  modalService: MockModalService;
  routerService: MockRouterService;
  colorService: MockColorService;
}

export function createAllMockServices(): AllMockServices {
  return {
    dyeService: createMockDyeService(),
    storageService: createMockStorageService(),
    collectionService: createMockCollectionService(),
    marketBoardService: createMockMarketBoardService(),
    toastService: createMockToastService(),
    modalService: createMockModalService(),
    routerService: createMockRouterService(),
    colorService: createMockColorService(),
  };
}
