/**
 * XIV Dye Tools - Market Board Service Tests
 *
 * Tests for the MarketBoardService singleton that manages market price data.
 * This service implements request versioning for race condition protection
 * and event-driven updates for reactive UI components.
 *
 * @module services/__tests__/market-board-service.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { MarketBoardService } from '../market-board-service';
import { APIService } from '../api-service-wrapper';
import { ConfigController } from '../config-controller';
import { WorldService } from '../world-service';
import { appStorage } from '../storage-service';
import type { Dye, PriceData } from '@shared/types';

// Mock dependencies
vi.mock('../api-service-wrapper', () => ({
  APIService: {
    getInstance: vi.fn(() => ({
      getPricesForDataCenter: vi.fn(),
    })),
    clearCache: vi.fn(),
    formatPrice: vi.fn((price: number) => `${price.toLocaleString()} gil`),
  },
}));

vi.mock('../config-controller', () => ({
  ConfigController: {
    getInstance: vi.fn(() => ({
      getConfig: vi.fn(),
      setConfig: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    })),
  },
}));

vi.mock('../world-service', () => ({
  WorldService: {
    getWorldName: vi.fn(),
  },
}));

vi.mock('../storage-service', () => ({
  appStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

// Sample test data
const createMockDye = (overrides: Partial<Dye> = {}): Dye => ({
  id: 1,
  itemID: 12345,
  stainID: 1,
  name: 'Snow White',
  hex: '#FFFFFF',
  rgb: { r: 255, g: 255, b: 255 },
  hsv: { h: 0, s: 0, v: 100 },
  category: 'White',
  acquisition: 'Dye Vendor',
  cost: 216,
  isMetallic: false,
  isPastel: false,
  isDark: false,
  isCosmic: false,
  ...overrides,
});

const createMockPriceData = (overrides: Partial<PriceData> = {}): PriceData => ({
  itemID: 12345,
  currentAverage: 1200,
  currentMinPrice: 1000,
  currentMaxPrice: 1500,
  lastUpdate: Date.now(),
  worldId: 34,
  worldName: 'Brynhildr',
  ...overrides,
});

describe('MarketBoardService', () => {
  let service: MarketBoardService;
  let mockApiService: { getPricesForDataCenter: Mock };
  let mockConfigController: {
    getConfig: Mock;
    setConfig: Mock;
    subscribe: Mock;
  };
  let configSubscriber: ((config: unknown) => void) | null = null;

  beforeEach(() => {
    // Reset singleton before each test
    MarketBoardService.resetInstance();

    // Reset mocks
    vi.clearAllMocks();

    // Set up config controller mock with subscriber capture
    mockConfigController = {
      getConfig: vi.fn(() => ({ selectedServer: 'Crystal', showPrices: false })),
      setConfig: vi.fn(),
      subscribe: vi.fn((key, callback) => {
        if (key === 'market') {
          configSubscriber = callback;
        }
        return vi.fn(); // Return unsubscribe function
      }),
    };
    (ConfigController.getInstance as Mock).mockReturnValue(mockConfigController);

    // Set up API service mock
    mockApiService = {
      getPricesForDataCenter: vi.fn(() => Promise.resolve(new Map())),
    };
    (APIService.getInstance as Mock).mockReturnValue(mockApiService);

    // Set up storage mock
    (appStorage.getItem as Mock).mockReturnValue(null);

    // Get service instance
    service = MarketBoardService.getInstance();
  });

  afterEach(() => {
    MarketBoardService.resetInstance();
    configSubscriber = null;
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MarketBoardService.getInstance();
      const instance2 = MarketBoardService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should reset instance correctly', () => {
      const instance1 = MarketBoardService.getInstance();
      MarketBoardService.resetInstance();
      const instance2 = MarketBoardService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('getters', () => {
    it('should return selected server', () => {
      expect(service.getSelectedServer()).toBe('Crystal');
    });

    it('should return show prices state', () => {
      expect(service.getShowPrices()).toBe(false);
    });

    it('should return is fetching state', () => {
      expect(service.getIsFetching()).toBe(false);
    });

    it('should return price categories', () => {
      const categories = service.getPriceCategories();
      expect(categories).toBeDefined();
      expect(typeof categories.baseDyes).toBe('boolean');
      expect(typeof categories.craftDyes).toBe('boolean');
    });

    it('should return all prices as a new Map', () => {
      const prices1 = service.getAllPrices();
      const prices2 = service.getAllPrices();
      expect(prices1).not.toBe(prices2);
    });
  });

  describe('setters', () => {
    it('should update server via ConfigController', () => {
      service.setServer('Aether');
      expect(mockConfigController.setConfig).toHaveBeenCalledWith('market', {
        selectedServer: 'Aether',
      });
    });

    it('should not update server if same value', () => {
      service.setServer('Crystal');
      expect(mockConfigController.setConfig).not.toHaveBeenCalled();
    });

    it('should update showPrices via ConfigController', () => {
      service.setShowPrices(true);
      expect(mockConfigController.setConfig).toHaveBeenCalledWith('market', {
        showPrices: true,
      });
    });

    it('should not update showPrices if same value', () => {
      service.setShowPrices(false);
      expect(mockConfigController.setConfig).not.toHaveBeenCalled();
    });

    it('should update categories and persist to storage', () => {
      service.setCategories({ baseDyes: true, craftDyes: false });
      expect(appStorage.setItem).toHaveBeenCalled();
    });

    it('should emit settings-changed event when categories change', () => {
      const eventHandler = vi.fn();
      service.addEventListener('settings-changed', eventHandler);

      service.setCategories({ baseDyes: true });

      expect(eventHandler).toHaveBeenCalled();
    });

    it('should not emit event if categories unchanged', () => {
      // First set categories to known state
      service.setCategories({ baseDyes: true });
      vi.clearAllMocks();

      const eventHandler = vi.fn();
      service.addEventListener('settings-changed', eventHandler);

      // Set same value again
      service.setCategories({ baseDyes: true });

      expect(eventHandler).not.toHaveBeenCalled();
    });
  });

  describe('ConfigController integration', () => {
    it('should emit server-changed event when config changes', () => {
      const eventHandler = vi.fn();
      service.addEventListener('server-changed', eventHandler);

      // Simulate config change
      if (configSubscriber) {
        configSubscriber({ selectedServer: 'Aether', showPrices: false });
      }

      expect(eventHandler).toHaveBeenCalled();
      const eventDetail = eventHandler.mock.calls[0][0].detail;
      expect(eventDetail.server).toBe('Aether');
      expect(eventDetail.previousServer).toBe('Crystal');
    });

    it('should clear prices on server change', () => {
      // Add some prices first
      service['priceData'].set(12345, createMockPriceData());
      expect(service.getPriceForDye(12345)).toBeDefined();

      // Change server
      if (configSubscriber) {
        configSubscriber({ selectedServer: 'Aether', showPrices: false });
      }

      expect(service.getPriceForDye(12345)).toBeUndefined();
    });

    it('should emit settings-changed event when showPrices changes', () => {
      const eventHandler = vi.fn();
      service.addEventListener('settings-changed', eventHandler);

      if (configSubscriber) {
        configSubscriber({ selectedServer: 'Crystal', showPrices: true });
      }

      expect(eventHandler).toHaveBeenCalled();
      const eventDetail = eventHandler.mock.calls[0][0].detail;
      expect(eventDetail.showPrices).toBe(true);
    });
  });

  describe('price data methods', () => {
    it('should get cached price for a dye', () => {
      const priceData = createMockPriceData({ itemID: 12345 });
      service['priceData'].set(12345, priceData);

      expect(service.getPriceForDye(12345)).toBe(priceData);
    });

    it('should return undefined for uncached dye', () => {
      expect(service.getPriceForDye(99999)).toBeUndefined();
    });

    it('should get world name for price data', () => {
      (WorldService.getWorldName as Mock).mockReturnValue('Brynhildr');
      const priceData = createMockPriceData({ worldId: 34 });

      const worldName = service.getWorldNameForPrice(priceData);

      expect(worldName).toBe('Brynhildr');
    });

    it('should return selected server if worldId is undefined', () => {
      const priceData = createMockPriceData({ worldId: undefined });

      const worldName = service.getWorldNameForPrice(priceData);

      expect(worldName).toBe('Crystal');
    });

    it('should return selected server for undefined price data', () => {
      const worldName = service.getWorldNameForPrice(undefined);
      expect(worldName).toBe('Crystal');
    });
  });

  describe('shouldFetchPrice', () => {
    beforeEach(() => {
      service.setCategories({
        baseDyes: true,
        craftDyes: true,
        alliedSocietyDyes: true,
        cosmicDyes: true,
        specialDyes: true,
      });
    });

    it('should return true for base dye when baseDyes enabled', () => {
      const dye = createMockDye({ acquisition: 'Dye Vendor' });
      expect(service.shouldFetchPrice(dye)).toBe(true);
    });

    it('should return true for craft dye when craftDyes enabled', () => {
      // V4: craftDyes uses 'Crafting' acquisition (not 'Crafted')
      const dye = createMockDye({ acquisition: 'Crafting' });
      expect(service.shouldFetchPrice(dye)).toBe(true);
    });

    it('should return true for special dye when specialDyes enabled', () => {
      const dye = createMockDye({ category: 'Special', acquisition: 'Event' });
      expect(service.shouldFetchPrice(dye)).toBe(true);
    });

    it('should return false when all categories disabled', () => {
      service.setCategories({
        baseDyes: false,
        craftDyes: false,
        alliedSocietyDyes: false,
        cosmicDyes: false,
        specialDyes: false,
      });

      const dye = createMockDye({ acquisition: 'Dye Vendor' });
      expect(service.shouldFetchPrice(dye)).toBe(false);
    });

    it('should return false for non-matching acquisition', () => {
      service.setCategories({
        baseDyes: false,
        craftDyes: false,
        alliedSocietyDyes: false,
        cosmicDyes: false,
        specialDyes: false,
      });

      const dye = createMockDye({ acquisition: 'Quest', category: 'Red' });
      expect(service.shouldFetchPrice(dye)).toBe(false);
    });
  });

  describe('fetchPricesForDyes', () => {
    beforeEach(() => {
      // Enable price fetching
      if (configSubscriber) {
        configSubscriber({ selectedServer: 'Crystal', showPrices: true });
      }
      service.setCategories({
        baseDyes: true,
        craftDyes: true,
        alliedSocietyDyes: true,
        cosmicDyes: true,
        specialDyes: true,
      });
    });

    it('should return empty Map for empty dye array', async () => {
      const result = await service.fetchPricesForDyes([]);
      expect(result.size).toBe(0);
    });

    it('should fetch prices and emit events', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];
      const priceData = new Map([[12345, createMockPriceData()]]);
      mockApiService.getPricesForDataCenter.mockResolvedValue(priceData);

      const fetchStarted = vi.fn();
      const pricesUpdated = vi.fn();
      const fetchCompleted = vi.fn();

      service.addEventListener('fetch-started', fetchStarted);
      service.addEventListener('prices-updated', pricesUpdated);
      service.addEventListener('fetch-completed', fetchCompleted);

      await service.fetchPricesForDyes(dyes);

      expect(fetchStarted).toHaveBeenCalled();
      expect(pricesUpdated).toHaveBeenCalled();
      expect(fetchCompleted).toHaveBeenCalled();
    });

    it('should call progress callback', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];
      const priceData = new Map([[12345, createMockPriceData()]]);
      mockApiService.getPricesForDataCenter.mockResolvedValue(priceData);

      const onProgress = vi.fn();
      await service.fetchPricesForDyes(dyes, onProgress);

      expect(onProgress).toHaveBeenCalledWith(0, 1);
      expect(onProgress).toHaveBeenCalledWith(1, 1);
    });

    it('should cache fetched prices', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];
      const priceData = new Map([[12345, createMockPriceData()]]);
      mockApiService.getPricesForDataCenter.mockResolvedValue(priceData);

      await service.fetchPricesForDyes(dyes);

      expect(service.getPriceForDye(12345)).toBeDefined();
    });

    it('should handle fetch errors gracefully', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];
      mockApiService.getPricesForDataCenter.mockRejectedValue(new Error('API Error'));

      const fetchError = vi.fn();
      service.addEventListener('fetch-error', fetchError);

      const result = await service.fetchPricesForDyes(dyes);

      expect(result.size).toBe(0);
      expect(fetchError).toHaveBeenCalled();
    });

    it('should filter out dyes based on category settings', async () => {
      service.setCategories({
        baseDyes: false,
        craftDyes: false,
        alliedSocietyDyes: false,
        cosmicDyes: false,
        specialDyes: false,
      });

      const dyes = [createMockDye({ acquisition: 'Dye Vendor' })];
      await service.fetchPricesForDyes(dyes);

      expect(mockApiService.getPricesForDataCenter).not.toHaveBeenCalled();
    });

    it('should return empty Map when showPrices is false', async () => {
      // Disable prices
      if (configSubscriber) {
        configSubscriber({ selectedServer: 'Crystal', showPrices: false });
      }

      const dyes = [createMockDye()];
      const result = await service.fetchPricesForDyes(dyes);

      expect(result.size).toBe(0);
    });
  });

  describe('request versioning (race condition protection)', () => {
    beforeEach(() => {
      if (configSubscriber) {
        configSubscriber({ selectedServer: 'Crystal', showPrices: true });
      }
      service.setCategories({ baseDyes: true });
    });

    it('should discard stale responses', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];

      // Create a slow response that will be superseded
      let resolveSlowRequest: (value: Map<number, PriceData>) => void;
      const slowPromise = new Promise<Map<number, PriceData>>((resolve) => {
        resolveSlowRequest = resolve;
      });
      mockApiService.getPricesForDataCenter.mockReturnValueOnce(slowPromise);

      // Start first request
      const firstRequest = service.fetchPricesForDyes(dyes);

      // Start second request immediately (simulating rapid server switch)
      mockApiService.getPricesForDataCenter.mockResolvedValueOnce(
        new Map([[12345, createMockPriceData({ currentMinPrice: 2000 })]])
      );
      const secondRequest = service.fetchPricesForDyes(dyes);

      // Resolve slow request after fast one completes
      await secondRequest;
      resolveSlowRequest!(new Map([[12345, createMockPriceData({ currentMinPrice: 1000 })]]));

      await firstRequest;

      // The cached price should be from the second (newer) request
      const cachedPrice = service.getPriceForDye(12345);
      expect(cachedPrice?.currentMinPrice).toBe(2000);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      service['priceData'].set(12345, createMockPriceData());
      expect(service.getPriceForDye(12345)).toBeDefined();

      service.clearCache();

      expect(service.getPriceForDye(12345)).toBeUndefined();
    });

    it('should refresh prices and clear API cache', async () => {
      service['priceData'].set(12345, createMockPriceData());

      await service.refreshPrices();

      expect(APIService.clearCache).toHaveBeenCalled();
      expect(service.getPriceForDye(12345)).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('should clean up subscriptions and data', () => {
      service['priceData'].set(12345, createMockPriceData());

      service.destroy();

      expect(service.getPriceForDye(12345)).toBeUndefined();
    });
  });

  describe('convenience functions', () => {
    it('should export formatPrice function', async () => {
      const { formatPrice } = await import('../market-board-service');
      const result = formatPrice(1000);
      expect(result).toBe('1,000 gil');
    });

    it('should export getMarketBoardService function', async () => {
      const { getMarketBoardService } = await import('../market-board-service');
      const instance = getMarketBoardService();
      expect(instance).toBe(service);
    });
  });
});
