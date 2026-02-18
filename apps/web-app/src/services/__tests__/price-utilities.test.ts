/**
 * XIV Dye Tools - Price Utilities Unit Tests
 *
 * Tests the price formatting and card data preparation utilities.
 *
 * @module services/__tests__/price-utilities.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatPriceWithSuffix,
  getDyePriceDisplay,
  getPriceInfo,
  preparePriceCardData,
  preparePriceCardDataFromMap,
  getItemIdsForPriceFetch,
  hasCachedPrices,
  type DyePriceDisplayOptions,
  type PriceCardData,
} from '../price-utilities';
import type { Dye, PriceData } from '@shared/types';
import type { MarketBoardService } from '../market-board-service';

// Mock dye data
const createMockDye = (overrides: Partial<Dye> = {}): Dye => ({
  id: 1,
  name: 'Test Dye',
  itemID: 12345,
  stainID: 1,
  hex: '#FF0000',
  rgb: { r: 255, g: 0, b: 0 },
  hsv: { h: 0, s: 100, v: 100 },
  category: 'General-purpose',
  acquisition: 'NPC',
  cost: 0,
  isMetallic: false,
  isPastel: false,
  isDark: false,
  isCosmic: false,
  ...overrides,
});

// Mock price data
const createMockPriceData = (overrides: Partial<PriceData> = {}): PriceData => ({
  itemID: 12345,
  currentAverage: 1200,
  currentMinPrice: 1000,
  currentMaxPrice: 1500,
  lastUpdate: Date.now(),
  worldId: 1,
  worldName: 'Cactuar',
  ...overrides,
});

describe('price-utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // formatPriceWithSuffix Tests
  // ============================================================================

  describe('formatPriceWithSuffix', () => {
    it('should format price with default gil suffix', () => {
      expect(formatPriceWithSuffix(1000)).toBe('1,000 gil');
    });

    it('should format large prices with thousand separators', () => {
      expect(formatPriceWithSuffix(1234567)).toBe('1,234,567 gil');
    });

    it('should format small prices correctly', () => {
      expect(formatPriceWithSuffix(1)).toBe('1 gil');
      expect(formatPriceWithSuffix(0)).toBe('0 gil');
    });

    it('should use custom suffix when provided', () => {
      expect(formatPriceWithSuffix(1000, ' G')).toBe('1,000 G');
      expect(formatPriceWithSuffix(1000, '')).toBe('1,000');
    });

    it('should handle decimal numbers by using locale formatting', () => {
      // Note: toLocaleString() behavior may vary
      const result = formatPriceWithSuffix(1234);
      expect(result).toContain('1,234');
    });
  });

  // ============================================================================
  // getDyePriceDisplay Tests
  // ============================================================================

  describe('getDyePriceDisplay', () => {
    it('should return null when showPrices is false', () => {
      const dye = createMockDye();
      const priceData = new Map([[12345, createMockPriceData()]]);

      const result = getDyePriceDisplay(dye, {
        showPrices: false,
        priceData,
      });

      expect(result).toBeNull();
    });

    it('should return null when price data not available', () => {
      const dye = createMockDye();
      const priceData = new Map<number, PriceData>();

      const result = getDyePriceDisplay(dye, {
        showPrices: true,
        priceData,
      });

      expect(result).toBeNull();
    });

    it('should return null when currentMinPrice is undefined', () => {
      const dye = createMockDye();
      const priceData = new Map([
        [12345, createMockPriceData({ currentMinPrice: undefined as unknown as number })],
      ]);

      const result = getDyePriceDisplay(dye, {
        showPrices: true,
        priceData,
      });

      expect(result).toBeNull();
    });

    it('should return null when currentMinPrice is 0', () => {
      const dye = createMockDye();
      const priceData = new Map([[12345, createMockPriceData({ currentMinPrice: 0 })]]);

      const result = getDyePriceDisplay(dye, {
        showPrices: true,
        priceData,
      });

      expect(result).toBeNull();
    });

    it('should return formatted price when available', () => {
      const dye = createMockDye();
      const priceData = new Map([[12345, createMockPriceData({ currentMinPrice: 2500 })]]);

      const result = getDyePriceDisplay(dye, {
        showPrices: true,
        priceData,
      });

      expect(result).toBe('2,500 gil');
    });

    it('should use custom suffix', () => {
      const dye = createMockDye();
      const priceData = new Map([[12345, createMockPriceData({ currentMinPrice: 1000 })]]);

      const result = getDyePriceDisplay(dye, {
        showPrices: true,
        priceData,
        suffix: ' G',
      });

      expect(result).toBe('1,000 G');
    });

    it('should format without locale when useLocale is false', () => {
      const dye = createMockDye();
      const priceData = new Map([[12345, createMockPriceData({ currentMinPrice: 1000 })]]);

      const result = getDyePriceDisplay(dye, {
        showPrices: true,
        priceData,
        useLocale: false,
      });

      expect(result).toBe('1000 gil');
    });
  });

  // ============================================================================
  // getPriceInfo Tests
  // ============================================================================

  describe('getPriceInfo', () => {
    it('should return price data for existing dye', () => {
      const dye = createMockDye();
      const mockPriceData = createMockPriceData();
      const priceData = new Map([[12345, mockPriceData]]);

      const result = getPriceInfo(dye, priceData);

      expect(result).toBe(mockPriceData);
    });

    it('should return undefined for non-existing dye', () => {
      const dye = createMockDye({ itemID: 99999 });
      const priceData = new Map([[12345, createMockPriceData()]]);

      const result = getPriceInfo(dye, priceData);

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty map', () => {
      const dye = createMockDye();
      const priceData = new Map<number, PriceData>();

      const result = getPriceInfo(dye, priceData);

      expect(result).toBeUndefined();
    });
  });

  // ============================================================================
  // preparePriceCardData Tests
  // ============================================================================

  describe('preparePriceCardData', () => {
    it('should return complete price card data', () => {
      const dye = createMockDye();
      const mockService = {
        getPriceForDye: vi.fn().mockReturnValue(createMockPriceData()),
        getShowPrices: vi.fn().mockReturnValue(true),
        getWorldNameForPrice: vi.fn().mockReturnValue('Cactuar'),
      } as unknown as MarketBoardService;

      const result = preparePriceCardData(dye, mockService);

      expect(result).toEqual({
        marketServer: 'Cactuar',
        price: 1000,
        showPrice: true,
      });
      expect(mockService.getPriceForDye).toHaveBeenCalledWith(12345);
    });

    it('should handle missing price data', () => {
      const dye = createMockDye();
      const mockService = {
        getPriceForDye: vi.fn().mockReturnValue(undefined),
        getShowPrices: vi.fn().mockReturnValue(false),
        getWorldNameForPrice: vi.fn().mockReturnValue(undefined),
      } as unknown as MarketBoardService;

      const result = preparePriceCardData(dye, mockService);

      expect(result).toEqual({
        marketServer: undefined,
        price: undefined,
        showPrice: false,
      });
    });
  });

  // ============================================================================
  // preparePriceCardDataFromMap Tests
  // ============================================================================

  describe('preparePriceCardDataFromMap', () => {
    it('should return complete price card data from map', () => {
      const dye = createMockDye();
      const priceData = new Map([[12345, createMockPriceData({ currentMinPrice: 1500 })]]);

      const result = preparePriceCardDataFromMap(dye, priceData, true, 'Crystal');

      expect(result).toEqual({
        marketServer: 'Crystal',
        price: 1500,
        showPrice: true,
      });
    });

    it('should handle missing price data in map', () => {
      const dye = createMockDye({ itemID: 99999 });
      const priceData = new Map([[12345, createMockPriceData()]]);

      const result = preparePriceCardDataFromMap(dye, priceData, false);

      expect(result).toEqual({
        marketServer: undefined,
        price: undefined,
        showPrice: false,
      });
    });

    it('should handle undefined server name', () => {
      const dye = createMockDye();
      const priceData = new Map([[12345, createMockPriceData()]]);

      const result = preparePriceCardDataFromMap(dye, priceData, true);

      expect(result.marketServer).toBeUndefined();
    });
  });

  // ============================================================================
  // getItemIdsForPriceFetch Tests
  // ============================================================================

  describe('getItemIdsForPriceFetch', () => {
    it('should return item IDs for dyes that should fetch prices', () => {
      const dyes = [
        createMockDye({ itemID: 1001 }),
        createMockDye({ itemID: 1002 }),
        createMockDye({ itemID: 1003 }),
      ];
      const mockService = {
        shouldFetchPrice: vi.fn().mockReturnValue(true),
      } as unknown as MarketBoardService;

      const result = getItemIdsForPriceFetch(dyes, mockService);

      expect(result).toEqual([1001, 1002, 1003]);
      expect(mockService.shouldFetchPrice).toHaveBeenCalledTimes(3);
    });

    it('should filter out dyes that should not fetch prices', () => {
      const dyes = [
        createMockDye({ itemID: 1001 }),
        createMockDye({ itemID: 1002 }),
        createMockDye({ itemID: 1003 }),
      ];
      const mockService = {
        shouldFetchPrice: vi.fn((dye: Dye) => dye.itemID !== 1002),
      } as unknown as MarketBoardService;

      const result = getItemIdsForPriceFetch(dyes, mockService);

      expect(result).toEqual([1001, 1003]);
    });

    it('should return empty array when no dyes match', () => {
      const dyes = [createMockDye()];
      const mockService = {
        shouldFetchPrice: vi.fn().mockReturnValue(false),
      } as unknown as MarketBoardService;

      const result = getItemIdsForPriceFetch(dyes, mockService);

      expect(result).toEqual([]);
    });

    it('should return empty array for empty dyes array', () => {
      const mockService = {
        shouldFetchPrice: vi.fn(),
      } as unknown as MarketBoardService;

      const result = getItemIdsForPriceFetch([], mockService);

      expect(result).toEqual([]);
      expect(mockService.shouldFetchPrice).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // hasCachedPrices Tests
  // ============================================================================

  describe('hasCachedPrices', () => {
    it('should return true when at least one dye has cached price', () => {
      const dyes = [
        createMockDye({ itemID: 1001 }),
        createMockDye({ itemID: 1002 }),
      ];
      const priceData = new Map([[1001, createMockPriceData()]]);

      const result = hasCachedPrices(dyes, priceData);

      expect(result).toBe(true);
    });

    it('should return false when no dyes have cached prices', () => {
      const dyes = [
        createMockDye({ itemID: 1001 }),
        createMockDye({ itemID: 1002 }),
      ];
      const priceData = new Map([[9999, createMockPriceData()]]);

      const result = hasCachedPrices(dyes, priceData);

      expect(result).toBe(false);
    });

    it('should return false for empty dyes array', () => {
      const priceData = new Map([[12345, createMockPriceData()]]);

      const result = hasCachedPrices([], priceData);

      expect(result).toBe(false);
    });

    it('should return false for empty price data map', () => {
      const dyes = [createMockDye()];
      const priceData = new Map<number, PriceData>();

      const result = hasCachedPrices(dyes, priceData);

      expect(result).toBe(false);
    });

    it('should return true when all dyes have cached prices', () => {
      const dyes = [
        createMockDye({ itemID: 1001 }),
        createMockDye({ itemID: 1002 }),
      ];
      const priceData = new Map([
        [1001, createMockPriceData()],
        [1002, createMockPriceData()],
      ]);

      const result = hasCachedPrices(dyes, priceData);

      expect(result).toBe(true);
    });
  });
});
