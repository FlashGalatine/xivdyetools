/**
 * XIV Dye Tools - HarmonyResultPanel Unit Tests
 *
 * Tests the harmony result panel component for individual harmony results.
 * Covers rendering, swap functionality, card actions, and accessibility.
 *
 * @module components/__tests__/harmony-result-panel.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HarmonyResultPanel, HarmonyResultPanelOptions } from '../harmony-result-panel';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  queryAll,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  APIService: {
    formatPrice: vi.fn((price: number) => `${price.toLocaleString()} Gil`),
  },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../dye-action-dropdown', () => ({
  createDyeActionDropdown: vi.fn().mockImplementation(() => {
    const div = document.createElement('div');
    div.className = 'dye-action-dropdown';
    return div;
  }),
}));

describe('HarmonyResultPanel', () => {
  let container: HTMLElement;
  let panel: HarmonyResultPanel | null;

  const createOptions = (overrides: Partial<HarmonyResultPanelOptions> = {}): HarmonyResultPanelOptions => ({
    label: 'Harmony 1',
    targetColor: '#FF0000',
    matchedDye: mockDyes[0],
    deviance: 15.5,
    closestDyes: mockDyes.slice(1, 4),
    showPrices: false,
    priceData: new Map(),
    isBase: false,
    ...overrides,
  });

  beforeEach(() => {
    container = createTestContainer();
    panel = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (panel) {
      try {
        panel.destroy();
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
    it('should render panel container', () => {
      panel = new HarmonyResultPanel(container, createOptions());
      panel.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should render dye name', () => {
      panel = new HarmonyResultPanel(container, createOptions());
      panel.init();

      expect(container.textContent).toContain(`Dye-${mockDyes[0].itemID}`);
    });

    it('should render hex badge', () => {
      panel = new HarmonyResultPanel(container, createOptions());
      panel.init();

      expect(container.textContent).toContain(mockDyes[0].hex.toUpperCase());
    });

    it('should render panel label', () => {
      panel = new HarmonyResultPanel(container, createOptions({ label: 'Base' }));
      panel.init();

      expect(container.textContent).toContain('Base');
    });

    it('should render color swatch', () => {
      panel = new HarmonyResultPanel(container, createOptions());
      panel.init();

      const swatch = query(container, '[style*="background"]');
      expect(swatch).not.toBeNull();
    });

    it('should render action dropdown', () => {
      panel = new HarmonyResultPanel(container, createOptions());
      panel.init();

      const actionDropdown = query(container, '.dye-action-dropdown');
      expect(actionDropdown).not.toBeNull();
    });
  });

  // ============================================================================
  // Deviance Display Tests
  // ============================================================================

  describe('Deviance Display', () => {
    it('should display deviance for harmony panels', () => {
      panel = new HarmonyResultPanel(container, createOptions({ isBase: false, deviance: 15.5 }));
      panel.init();

      expect(container.textContent).toContain('15.5');
    });

    it('should not display deviance for base panels', () => {
      panel = new HarmonyResultPanel(container, createOptions({ isBase: true, deviance: 15.5 }));
      panel.init();

      // Base panels don't show deviance
      const devianceText = container.textContent?.includes('from ideal');
      expect(devianceText).toBe(false);
    });

    it('should show green for low deviance (<=5)', () => {
      panel = new HarmonyResultPanel(container, createOptions({ deviance: 3.0 }));
      panel.init();

      expect(container.innerHTML).toContain('#22c55e');
    });

    it('should show blue for medium deviance (<=15)', () => {
      panel = new HarmonyResultPanel(container, createOptions({ deviance: 10.0 }));
      panel.init();

      expect(container.innerHTML).toContain('#3b82f6');
    });

    it('should show yellow for higher deviance (<=30)', () => {
      panel = new HarmonyResultPanel(container, createOptions({ deviance: 25.0 }));
      panel.init();

      expect(container.innerHTML).toContain('#eab308');
    });

    it('should show red for high deviance (>30)', () => {
      panel = new HarmonyResultPanel(container, createOptions({ deviance: 45.0 }));
      panel.init();

      expect(container.innerHTML).toContain('#ef4444');
    });
  });

  // ============================================================================
  // Closest Dyes Section Tests
  // ============================================================================

  describe('Closest Dyes Section', () => {
    it('should render closest dyes for harmony panels', () => {
      panel = new HarmonyResultPanel(
        container,
        createOptions({ isBase: false, closestDyes: mockDyes.slice(1, 4) })
      );
      panel.init();

      expect(container.textContent).toContain('harmony.closestDyes');
    });

    it('should not render closest dyes for base panels', () => {
      panel = new HarmonyResultPanel(
        container,
        createOptions({ isBase: true, closestDyes: mockDyes.slice(1, 4) })
      );
      panel.init();

      expect(container.textContent).not.toContain('harmony.closestDyes');
    });

    it('should render clickable swatches for closest dyes', () => {
      panel = new HarmonyResultPanel(
        container,
        createOptions({ closestDyes: mockDyes.slice(1, 4) })
      );
      panel.init();

      const swatchButtons = queryAll(container, 'button[aria-label^="Swap to"]');
      expect(swatchButtons.length).toBe(3);
    });

    it('should call onSwapDye when swatch clicked', () => {
      const onSwapDye = vi.fn();
      panel = new HarmonyResultPanel(
        container,
        createOptions({ closestDyes: mockDyes.slice(1, 3), onSwapDye })
      );
      panel.init();

      const swatchButton = query<HTMLButtonElement>(container, 'button[aria-label^="Swap to"]');
      click(swatchButton);

      expect(onSwapDye).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Price Display Tests
  // ============================================================================

  describe('Price Display', () => {
    it('should show price when showPrices is true and price exists', () => {
      const priceData = new Map([[mockDyes[0].itemID, { itemID: mockDyes[0].itemID, currentAverage: 5000, currentMinPrice: 4500, currentMaxPrice: 5500, lastUpdate: Date.now() }]]);
      panel = new HarmonyResultPanel(
        container,
        createOptions({ showPrices: true, priceData })
      );
      panel.init();

      expect(container.textContent).toContain('5,000');
    });

    it('should not show price when showPrices is false', () => {
      const priceData = new Map([[mockDyes[0].itemID, { itemID: mockDyes[0].itemID, currentAverage: 5000, currentMinPrice: 4500, currentMaxPrice: 5500, lastUpdate: Date.now() }]]);
      panel = new HarmonyResultPanel(
        container,
        createOptions({ showPrices: false, priceData })
      );
      panel.init();

      expect(container.textContent).not.toContain('5,000');
    });
  });

  // ============================================================================
  // API Tests
  // ============================================================================

  describe('API', () => {
    it('should update price data', () => {
      panel = new HarmonyResultPanel(container, createOptions({ showPrices: true }));
      panel.init();

      const priceData = new Map([[mockDyes[0].itemID, { itemID: mockDyes[0].itemID, currentAverage: 10000, currentMinPrice: 9000, currentMaxPrice: 11000, lastUpdate: Date.now() }]]);
      panel.setPriceData(priceData);

      expect(container.textContent).toContain('10,000');
    });

    it('should update showPrices setting', () => {
      const priceData = new Map([[mockDyes[0].itemID, { itemID: mockDyes[0].itemID, currentAverage: 5000, currentMinPrice: 4500, currentMaxPrice: 5500, lastUpdate: Date.now() }]]);
      panel = new HarmonyResultPanel(container, createOptions({ showPrices: false, priceData }));
      panel.init();

      panel.setShowPrices(true);

      expect(container.textContent).toContain('5,000');
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have accessible swap buttons', () => {
      panel = new HarmonyResultPanel(
        container,
        createOptions({ closestDyes: mockDyes.slice(1, 3) })
      );
      panel.init();

      const swatchButtons = queryAll<HTMLButtonElement>(container, 'button[aria-label^="Swap to"]');
      swatchButtons.forEach((btn) => {
        expect(btn.getAttribute('type')).toBe('button');
        expect(btn.hasAttribute('aria-label')).toBe(true);
      });
    });

    it('should have color swatch aria-label', () => {
      panel = new HarmonyResultPanel(container, createOptions());
      panel.init();

      const swatch = query(container, '[aria-label*="Color swatch"]');
      expect(swatch).not.toBeNull();
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      panel = new HarmonyResultPanel(container, createOptions());
      panel.init();

      panel.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
