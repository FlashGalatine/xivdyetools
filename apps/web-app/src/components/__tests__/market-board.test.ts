/**
 * XIV Dye Tools - MarketBoard Unit Tests
 *
 * Tests the market board component for FFXIV price fetching.
 * Covers rendering, server selection, price toggle, and settings.
 *
 * @module components/__tests__/market-board.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarketBoard } from '../market-board';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  queryAll,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

// Use vi.hoisted to create mock before vi.mock runs (hoisted to top)
const { mockMarketBoardService } = vi.hoisted(() => ({
  mockMarketBoardService: {
    getSelectedServer: vi.fn().mockReturnValue('Aether'),
    getShowPrices: vi.fn().mockReturnValue(true),
    setServer: vi.fn(),
    setShowPrices: vi.fn(),
    shouldFetchPrice: vi.fn().mockReturnValue(true),
    fetchPricesForDyes: vi.fn().mockResolvedValue(new Map()),
    refreshPrices: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
}));

vi.mock('@services/market-board-service', () => ({
  MarketBoardService: {
    getInstance: vi.fn().mockReturnValue(mockMarketBoardService),
  },
  formatPrice: vi.fn((price: number) => `${price.toLocaleString()} Gil`),
}));

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  WorldService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAllDataCenters: vi.fn().mockReturnValue([
      { name: 'Aether', region: 'NA' },
      { name: 'Crystal', region: 'NA' },
    ]),
    getWorldsInDataCenter: vi.fn().mockReturnValue([{ name: 'Adamantoise' }, { name: 'Cactuar' }]),
    getWorldName: vi.fn((id: number) => `World-${id}`),
  },
}));

vi.mock('@services/toast-service', () => ({
  ToastService: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('MarketBoard', () => {
  let container: HTMLElement;
  let marketBoard: MarketBoard | null;

  beforeEach(() => {
    container = createTestContainer();
    marketBoard = null;
    vi.clearAllMocks();
    mockMarketBoardService.getShowPrices.mockReturnValue(true);
  });

  afterEach(() => {
    if (marketBoard) {
      try {
        marketBoard.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render server dropdown', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const serverSelect = query(container, '#mb-server-select');
      expect(serverSelect).not.toBeNull();
    });

    it('should render show prices toggle', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const toggle = query(container, '#show-mb-prices-toggle');
      expect(toggle).not.toBeNull();
    });

    it('should render refresh button', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const refreshBtn = query(container, '#mb-refresh-btn');
      expect(refreshBtn).not.toBeNull();
    });

    it('should not render any price category checkboxes (removed in Patch 7.5)', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const checkboxes = queryAll(container, '.mb-price-checkbox');
      expect(checkboxes.length).toBe(0);
    });
  });

  // ============================================================================
  // Server Selection Tests
  // ============================================================================

  describe('Server Selection', () => {
    it('should populate server dropdown with data centers', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const serverSelect = query(container, '#mb-server-select');
      const optgroups = serverSelect?.querySelectorAll('optgroup');
      expect(optgroups?.length).toBe(2);
    });

    it('should include worlds in optgroups', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const options = queryAll(container, '#mb-server-select option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('should call service setServer on change', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const serverSelect = query<HTMLSelectElement>(container, '#mb-server-select');
      if (serverSelect) {
        serverSelect.value = 'Crystal';
        serverSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      expect(mockMarketBoardService.setServer).toHaveBeenCalledWith('Crystal');
    });

    it('should emit server-changed event', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const eventSpy = vi.fn();
      container.addEventListener('server-changed', eventSpy);

      const serverSelect = query<HTMLSelectElement>(container, '#mb-server-select');
      if (serverSelect) {
        serverSelect.value = 'Crystal';
        serverSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Show Prices Toggle Tests
  // ============================================================================

  describe('Show Prices Toggle', () => {
    it('should reflect service state in toggle', () => {
      mockMarketBoardService.getShowPrices.mockReturnValue(true);

      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const toggle = query<HTMLInputElement>(container, '#show-mb-prices-toggle');
      expect(toggle?.checked).toBe(true);
    });

    it('should call service setShowPrices on toggle', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const toggle = query<HTMLInputElement>(container, '#show-mb-prices-toggle');
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }

      expect(mockMarketBoardService.setShowPrices).toHaveBeenCalledWith(false);
    });

    it('should emit showPricesChanged event', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const eventSpy = vi.fn();
      container.addEventListener('showPricesChanged', eventSpy);

      const toggle = query<HTMLInputElement>(container, '#show-mb-prices-toggle');
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should hide price settings when toggle is off', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const toggle = query<HTMLInputElement>(container, '#show-mb-prices-toggle');
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const priceSettings = query(container, '#mb-price-settings');
      expect(priceSettings?.classList.contains('hidden')).toBe(true);
    });
  });

  // ============================================================================
  // Refresh Tests
  // ============================================================================

  describe('Refresh Prices', () => {
    it('should call service refreshPrices on button click', async () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const refreshBtn = query<HTMLButtonElement>(container, '#mb-refresh-btn');
      click(refreshBtn);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockMarketBoardService.refreshPrices).toHaveBeenCalled();
    });

    it('should emit refresh-requested event', async () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const eventSpy = vi.fn();
      container.addEventListener('refresh-requested', eventSpy);

      const refreshBtn = query<HTMLButtonElement>(container, '#mb-refresh-btn');
      click(refreshBtn);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should disable button while refreshing', async () => {
      mockMarketBoardService.refreshPrices.mockImplementation(() => {
        return new Promise((resolve) => setTimeout(resolve, 100));
      });

      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const refreshBtn = query<HTMLButtonElement>(container, '#mb-refresh-btn');
      click(refreshBtn);

      expect(refreshBtn?.disabled).toBe(true);
    });
  });

  // ============================================================================
  // Dye Filtering Tests
  // ============================================================================

  describe('Dye Filtering', () => {
    it('should delegate shouldFetchPrice to service', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      marketBoard.shouldFetchPrice(mockDyes[0]);

      expect(mockMarketBoardService.shouldFetchPrice).toHaveBeenCalledWith(mockDyes[0]);
    });

    it('should return false for null dye', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      // @ts-expect-error testing null case
      const result = marketBoard.shouldFetchPrice(null);

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Price Fetching Tests
  // ============================================================================

  describe('Price Fetching', () => {
    it('should delegate fetchPricesForDyes to service', async () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      await marketBoard.fetchPricesForDyes(mockDyes);

      expect(mockMarketBoardService.fetchPricesForDyes).toHaveBeenCalledWith(mockDyes, undefined);
    });

    it('should pass progress callback to service', async () => {
      const onProgress = vi.fn();
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      await marketBoard.fetchPricesForDyes(mockDyes, onProgress);

      expect(mockMarketBoardService.fetchPricesForDyes).toHaveBeenCalledWith(mockDyes, onProgress);
    });
  });

  // ============================================================================
  // Static Methods Tests
  // ============================================================================

  describe('Static Methods', () => {
    it('should format price correctly', () => {
      const formatted = MarketBoard.formatPrice(10000);
      expect(formatted).toContain('10,000');
    });
  });

  // ============================================================================
  // State Management Tests
  // ============================================================================

  describe('State Management', () => {
    it('should return selected server', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      expect(marketBoard.getSelectedServer()).toBe('Aether');
    });

    it('should return showPrices setting', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      expect(marketBoard.getShowPrices()).toBe(true);
    });

    it('should set server programmatically', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      marketBoard.setSelectedServer('Crystal');

      expect(mockMarketBoardService.setServer).toHaveBeenCalledWith('Crystal');
    });

    it('should set showPrices programmatically', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      marketBoard.setShowPrices(false);

      expect(mockMarketBoardService.setShowPrices).toHaveBeenCalledWith(false);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have label for server select', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      const label = query(container, 'label[for="mb-server-select"]');
      expect(label).not.toBeNull();
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      marketBoard = new MarketBoard(container);
      marketBoard.init();

      marketBoard.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
