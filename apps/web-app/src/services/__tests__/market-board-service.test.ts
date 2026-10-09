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
import { CONSOLIDATED_IDS } from '@xivdyetools/core';
import type { Dye, PriceData } from '@xivdyetools/types';

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
  currency: 'Gil',
  isMetallic: false,
  isPastel: false,
  isDark: false,
  isCosmic: false,

  isIshgardian: false,

  consolidationType: null,
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

/** Core's answer when every upstream request succeeded (BUG-090). */
const ok = (prices: Map<number, PriceData>) => ({ prices, outcome: 'ok' as const });

describe('MarketBoardService', () => {
  let service: MarketBoardService;
  let mockApiService: { getPricesForDataCenter: Mock; getPricesForDataCenterWithOutcome: Mock };
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
      getPricesForDataCenterWithOutcome: vi.fn(() =>
        Promise.resolve({ prices: new Map(), outcome: 'ok' })
      ),
    };
    (APIService.getInstance as Mock).mockReturnValue(mockApiService);

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

  describe('shouldFetchPrice (Patch 7.5 tradeability policy)', () => {
    // Save and restore CONSOLIDATED_IDS so tests can simulate pre/post-datamine states.
    let originalA: number | null;
    let originalB: number | null;
    let originalC: number | null;

    beforeEach(() => {
      originalA = CONSOLIDATED_IDS.A;
      originalB = CONSOLIDATED_IDS.B;
      originalC = CONSOLIDATED_IDS.C;
      CONSOLIDATED_IDS.A = null;
      CONSOLIDATED_IDS.B = null;
      CONSOLIDATED_IDS.C = null;

      // Enable showPrices for the policy to fire
      if (configSubscriber) {
        configSubscriber({ selectedServer: 'Crystal', showPrices: true });
      }
    });

    afterEach(() => {
      CONSOLIDATED_IDS.A = originalA;
      CONSOLIDATED_IDS.B = originalB;
      CONSOLIDATED_IDS.C = originalC;
    });

    it('returns false when showPrices is disabled', () => {
      if (configSubscriber) {
        configSubscriber({ selectedServer: 'Crystal', showPrices: false });
      }
      const dye = createMockDye({ consolidationType: null });
      expect(service.shouldFetchPrice(dye)).toBe(false);
    });

    it('returns true for unconsolidated dyes (Pure White, Jet Black, Special)', () => {
      const dye = createMockDye({ consolidationType: null, itemID: 13114 });
      expect(service.shouldFetchPrice(dye)).toBe(true);
    });

    it('returns false for consolidated Type-A dyes when itemIDs are not yet datamined', () => {
      const dye = createMockDye({ consolidationType: 'A', itemID: 5729 });
      expect(service.shouldFetchPrice(dye)).toBe(false);
    });

    it('returns true for consolidated dyes once consolidation is active', () => {
      CONSOLIDATED_IDS.A = 99999;
      CONSOLIDATED_IDS.B = 99998;
      CONSOLIDATED_IDS.C = 99997;

      const typeA = createMockDye({ consolidationType: 'A', itemID: 5729 });
      const typeB = createMockDye({ consolidationType: 'B', itemID: 30116 });
      const typeC = createMockDye({ consolidationType: 'C', itemID: 48163 });

      expect(service.shouldFetchPrice(typeA)).toBe(true);
      expect(service.shouldFetchPrice(typeB)).toBe(true);
      expect(service.shouldFetchPrice(typeC)).toBe(true);
    });

    it('returns false for Facewear dyes (synthetic negative itemIDs)', () => {
      const dye = createMockDye({ consolidationType: null, itemID: -1 });
      expect(service.shouldFetchPrice(dye)).toBe(false);
    });
  });

  describe('fetchPricesForDyes', () => {
    beforeEach(() => {
      // Enable price fetching
      if (configSubscriber) {
        configSubscriber({ selectedServer: 'Crystal', showPrices: true });
      }
    });

    it('should return empty Map for empty dye array', async () => {
      const result = await service.fetchPricesForDyes([]);
      expect(result.size).toBe(0);
    });

    it('should fetch prices and emit events', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];
      const priceData = new Map([[12345, createMockPriceData()]]);
      mockApiService.getPricesForDataCenterWithOutcome.mockResolvedValue(ok(priceData));

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
      mockApiService.getPricesForDataCenterWithOutcome.mockResolvedValue(ok(priceData));

      const onProgress = vi.fn();
      await service.fetchPricesForDyes(dyes, onProgress);

      expect(onProgress).toHaveBeenCalledWith(0, 1);
      expect(onProgress).toHaveBeenCalledWith(1, 1);
    });

    it('should cache fetched prices', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];
      const priceData = new Map([[12345, createMockPriceData()]]);
      mockApiService.getPricesForDataCenterWithOutcome.mockResolvedValue(ok(priceData));

      await service.fetchPricesForDyes(dyes);

      expect(service.getPriceForDye(12345)).toBeDefined();
    });

    it('should handle fetch errors gracefully', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];
      mockApiService.getPricesForDataCenterWithOutcome.mockRejectedValue(new Error('API Error'));

      const fetchError = vi.fn();
      service.addEventListener('fetch-error', fetchError);

      const result = await service.fetchPricesForDyes(dyes);

      expect(result.size).toBe(0);
      expect(fetchError).toHaveBeenCalled();
    });

    it('should filter out consolidated dyes when consolidation IDs are not datamined', async () => {
      // Pre-patch fallback path: when CONSOLIDATED_IDS are still null, consolidated
      // dyes have no marketable target and `isConsolidationActive()` returns false,
      // so MarketBoardService should skip them entirely.
      const saved = { A: CONSOLIDATED_IDS.A, B: CONSOLIDATED_IDS.B, C: CONSOLIDATED_IDS.C };
      CONSOLIDATED_IDS.A = null;
      CONSOLIDATED_IDS.B = null;
      CONSOLIDATED_IDS.C = null;
      try {
        const dyes = [createMockDye({ consolidationType: 'A', itemID: 5729 })];
        await service.fetchPricesForDyes(dyes);

        expect(mockApiService.getPricesForDataCenterWithOutcome).not.toHaveBeenCalled();
      } finally {
        CONSOLIDATED_IDS.A = saved.A;
        CONSOLIDATED_IDS.B = saved.B;
        CONSOLIDATED_IDS.C = saved.C;
      }
    });

    /**
     * BUG-090 (2026-10-04 deep-dive): core absorbs upstream failures, so a
     * Universalis proxy outage resolves -- it never rejects -- with an empty
     * Map, exactly like a board with no listings. Only core's outcome tells
     * the two apart. Each test models core as it really answers: the Map-only
     * call returns the same prices the outcome-bearing one does.
     */
    describe('an unreachable market board (BUG-090)', () => {
      const coreAnswers = (outcome: 'ok' | 'partial' | 'error', prices = new Map()): void => {
        mockApiService.getPricesForDataCenter.mockResolvedValue(prices);
        mockApiService.getPricesForDataCenterWithOutcome.mockResolvedValue({ prices, outcome });
      };

      it('records an outage as outcome error', async () => {
        coreAnswers('error');

        const result = await service.fetchPricesForDyes([createMockDye({ itemID: 12345 })]);

        expect(result.size).toBe(0);
        expect(service.lastFetchOutcome).toBe('error');
      });

      it('records a partial fetch as error, but still returns and caches what arrived', async () => {
        const dyes = [createMockDye({ itemID: 12345 }), createMockDye({ itemID: 13114 })];
        coreAnswers('partial', new Map([[12345, createMockPriceData()]]));

        const result = await service.fetchPricesForDyes(dyes);

        expect(service.lastFetchOutcome).toBe('error');
        expect(result.get(12345)?.currentMinPrice).toBe(1000);
        expect(result.has(13114)).toBe(false);
        expect(service.getPriceForDye(12345)).toBeDefined();
      });

      it('records ok when every upstream request succeeded', async () => {
        coreAnswers('ok', new Map([[12345, createMockPriceData()]]));

        await service.fetchPricesForDyes([createMockDye({ itemID: 12345 })]);

        expect(service.lastFetchOutcome).toBe('ok');
      });

      it('reports a superseded outage as superseded, not error', async () => {
        const dyes = [createMockDye({ itemID: 12345 })];
        let releaseOutage!: () => void;
        const outage = new Promise<void>((resolve) => {
          releaseOutage = resolve;
        });
        mockApiService.getPricesForDataCenter.mockReturnValueOnce(outage.then(() => new Map()));
        mockApiService.getPricesForDataCenterWithOutcome.mockReturnValueOnce(
          outage.then(() => ({ prices: new Map(), outcome: 'error' }))
        );
        const stale = service.fetchPricesForDyes(dyes);

        coreAnswers('ok', new Map([[12345, createMockPriceData()]]));
        await service.fetchPricesForDyes(dyes);
        releaseOutage();

        expect((await stale).size).toBe(0);
        expect(service.lastFetchOutcome).toBe('superseded');
      });
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

  // BUG-079 (2026-10-04 deep-dive): Budget used to force the global Market
  // Board toggle on (and persist it) because this gate was its only way to get
  // prices. The per-call override fetches regardless of the toggle and hands
  // the result to that caller ONLY: tools that render from the shared cache
  // gate on their own display flag, not on market.showPrices, so a Budget
  // fetch landing there would leak prices into them with the board off.
  describe('fetchPricesForDyes with ignoreShowPrices', () => {
    // beforeEach leaves showPrices false (the getConfig mock), which is the
    // state every test here is about.

    it('fetches and returns prices while the Market Board toggle is off', async () => {
      expect(service.getShowPrices()).toBe(false);
      const dyes = [createMockDye({ itemID: 12345 })];
      mockApiService.getPricesForDataCenterWithOutcome.mockResolvedValue(
        ok(new Map([[12345, createMockPriceData({ currentMinPrice: 4321 })]]))
      );

      const result = await service.fetchPricesForDyes(dyes, undefined, { ignoreShowPrices: true });

      expect(mockApiService.getPricesForDataCenterWithOutcome).toHaveBeenCalledWith(
        [12345],
        'Crystal'
      );
      expect(result.get(12345)?.currentMinPrice).toBe(4321);
      expect(service.lastFetchOutcome).toBe('ok');
    });

    it('leaves the shared price cache untouched and emits no prices-updated', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];
      mockApiService.getPricesForDataCenterWithOutcome.mockResolvedValue(
        ok(new Map([[12345, createMockPriceData()]]))
      );
      const pricesUpdated = vi.fn();
      service.addEventListener('prices-updated', pricesUpdated);

      const result = await service.fetchPricesForDyes(dyes, undefined, { ignoreShowPrices: true });

      expect(result.size).toBe(1);
      expect(service.getPriceForDye(12345)).toBeUndefined();
      expect(service.getPricesView().size).toBe(0);
      expect(pricesUpdated).not.toHaveBeenCalled();
    });

    it('still skips dyes that are not on the market board', async () => {
      const saved = { A: CONSOLIDATED_IDS.A, B: CONSOLIDATED_IDS.B, C: CONSOLIDATED_IDS.C };
      CONSOLIDATED_IDS.A = null;
      CONSOLIDATED_IDS.B = null;
      CONSOLIDATED_IDS.C = null;
      try {
        const facewear = createMockDye({ itemID: -1 });
        const preDatamine = createMockDye({ consolidationType: 'A', itemID: 5729 });
        const tradeable = createMockDye({ itemID: 13114 });

        await service.fetchPricesForDyes([facewear, preDatamine, tradeable], undefined, {
          ignoreShowPrices: true,
        });

        expect(mockApiService.getPricesForDataCenterWithOutcome).toHaveBeenCalledTimes(1);
        expect(mockApiService.getPricesForDataCenterWithOutcome).toHaveBeenCalledWith(
          [13114],
          'Crystal'
        );
      } finally {
        CONSOLIDATED_IDS.A = saved.A;
        CONSOLIDATED_IDS.B = saved.B;
        CONSOLIDATED_IDS.C = saved.C;
      }
    });

    it('still discards a response a newer request superseded', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];
      let resolveSlowRequest: (value: ReturnType<typeof ok>) => void;
      mockApiService.getPricesForDataCenterWithOutcome.mockReturnValueOnce(
        new Promise<ReturnType<typeof ok>>((resolve) => {
          resolveSlowRequest = resolve;
        })
      );
      const firstRequest = service.fetchPricesForDyes(dyes, undefined, { ignoreShowPrices: true });

      mockApiService.getPricesForDataCenterWithOutcome.mockResolvedValueOnce(
        ok(new Map([[12345, createMockPriceData({ currentMinPrice: 2000 })]]))
      );
      const second = await service.fetchPricesForDyes(dyes, undefined, {
        ignoreShowPrices: true,
      });
      resolveSlowRequest!(ok(new Map([[12345, createMockPriceData({ currentMinPrice: 1000 })]])));
      const first = await firstRequest;

      expect(mockApiService.getPricesForDataCenterWithOutcome).toHaveBeenCalledTimes(2);
      expect(second.get(12345)?.currentMinPrice).toBe(2000);
      expect(first.size).toBe(0);
      expect(service.lastFetchOutcome).toBe('superseded');
    });

    it('keeps the default call gated on the toggle', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];

      const result = await service.fetchPricesForDyes(dyes);

      expect(result.size).toBe(0);
      expect(mockApiService.getPricesForDataCenterWithOutcome).not.toHaveBeenCalled();
    });
  });

  describe('request versioning (race condition protection)', () => {
    beforeEach(() => {
      if (configSubscriber) {
        configSubscriber({ selectedServer: 'Crystal', showPrices: true });
      }
    });

    it('should discard stale responses', async () => {
      const dyes = [createMockDye({ itemID: 12345 })];

      // Create a slow response that will be superseded
      let resolveSlowRequest: (value: ReturnType<typeof ok>) => void;
      const slowPromise = new Promise<ReturnType<typeof ok>>((resolve) => {
        resolveSlowRequest = resolve;
      });
      mockApiService.getPricesForDataCenterWithOutcome.mockReturnValueOnce(slowPromise);

      // Start first request
      const firstRequest = service.fetchPricesForDyes(dyes);

      // Start second request immediately (simulating rapid server switch)
      mockApiService.getPricesForDataCenterWithOutcome.mockResolvedValueOnce(
        ok(new Map([[12345, createMockPriceData({ currentMinPrice: 2000 })]]))
      );
      const secondRequest = service.fetchPricesForDyes(dyes);

      // Resolve slow request after fast one completes
      await secondRequest;
      resolveSlowRequest!(ok(new Map([[12345, createMockPriceData({ currentMinPrice: 1000 })]])));

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
});
