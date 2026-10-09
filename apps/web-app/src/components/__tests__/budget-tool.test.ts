/**
 * XIV Dye Tools - BudgetTool Unit Tests
 *
 * Tests the budget tool component for finding affordable dye alternatives.
 * Covers rendering, budget slider, price filtering, and sort modes.
 *
 * @module components/__tests__/budget-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BudgetTool } from '../budget-tool';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';
import { formatGil } from '@shared/format';
import { DEFAULT_DISPLAY_OPTIONS, DEFAULT_DYE_FILTERS } from '@shared/tool-config-types';
import type { ResultCard } from '@components/v4/result-card';
// The mocked barrel below: ConfigController is the real one, the other two are stubs.
import { ConfigController, MarketBoardService, StorageService } from '@services/index';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
const {
  mockGetAllDyes,
  mockGetDyeById,
  mockGetByStainId,
  mockFindClosestDyes,
  mockFindDyesWithinDistance,
  mockDistance,
} = vi.hoisted(() => {
  const rgb = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16) || 0,
    g: parseInt(hex.slice(3, 5), 16) || 0,
    b: parseInt(hex.slice(5, 7), 16) || 0,
  });
  return {
    mockGetAllDyes: vi.fn(),
    mockGetDyeById: vi.fn(),
    mockGetByStainId: vi.fn(),
    mockFindClosestDyes: vi.fn(),
    mockFindDyesWithinDistance: vi.fn(),
    /**
     * MUST be a real function of both hexes — never a constant.
     *
     * findAlternatives() keeps a candidate when `de <= matchLine` (default 8,
     * slider range 2–20), so a constant here is not a stand-in value, it is a
     * global on/off switch for the entire ledger. This mock returned 5 (every
     * dye inside the line); a later pass standardised it to 15 alongside its
     * sibling distance methods, which put every dye outside the line and
     * silently killed the candidate map, the sort, every ledger row and the
     * verdict — 6.6 points of statement coverage, with all 18 tests still
     * green because none of them looked at the ledger.
     *
     * Plain RGB euclidean over 20, which spreads the ten fixture dyes across
     * ~2.5–18.2 — the tool's own match-line range, with dyes on both sides of
     * the default line so BOTH arms of the filter are exercised.
     */
    mockDistance: vi.fn((a: string, b: string) => {
      const x = rgb(a);
      const y = rgb(b);
      return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2) / 20;
    }),
  };
});

// Icon modules are NOT mocked. They are compile-time string constants with
// no dependencies, and a hand-written stub only has to miss one export for
// the render to throw into BaseComponent.safeRender()'s catch — which
// swallows it into an error state, so the panel silently renders nothing
// and every assertion downstream sees an empty DOM instead of a failure.

vi.mock('@services/dye-service-wrapper', () => ({
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
      findClosestDyes: mockFindClosestDyes,
      findDyesWithinDistance: mockFindDyesWithinDistance,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
  // ShareService.resolveSharedDye imports this module's singleton directly,
  // so a `?dye=` deep link resolves its stainID here.
  dyeService: {
    getByStainId: mockGetByStainId,
  },
}));

// I18N-008: the "sort by name" column now goes through `compareDyeNames`
// (`@shared/dye-name`), which imports LanguageService from its OWN module,
// not the `@services/index` barrel — mocking only the barrel below would
// leave that comparator talking to the real service. `@shared/custom-dye`
// reaches LanguageService the same way, so this needs the full surface (a
// `t`-only or `getDyeName`-only stub throws inside `makeCustomDye`, which
// `safeRender()` swallows into a silently empty panel), not just the two
// methods `compareDyeNames` calls. Mirrors the barrel mock below exactly so
// the existing "re-sorts when a column header is clicked" ledger test keeps
// its expected order.
vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string, params: Record<string, string>) =>
      `${key}: ${Object.values(params).join('/')}`,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
    getCurrentLocale: () => 'en',
    getCurrency: (key: string) => `cur:${key}`,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@services/index', async () => ({
  /**
   * BUG-011 (2026-10-04 deep-dive): the REAL ConfigController and the REAL
   * applyDisplayOptions. The stub this replaces answered getConfig with {} and
   * had no setConfig, so nothing the tool reads from or writes to the
   * sidebar's store could be tested — a persisted config, the slider commit,
   * the broadcast that undid it (BUG-012) — and any setConfig carrying
   * displayOptions threw on the missing helper. The tests import the
   * controller through this barrel, so the tool and the tests share one
   * singleton; beforeEach/afterEach clear localStorage and reset it.
   */
  ConfigController: (
    await vi.importActual<typeof import('@services/config-controller')>(
      '@services/config-controller'
    )
  ).ConfigController,
  applyDisplayOptions: (
    await vi.importActual<typeof import('@services/display-options-helper')>(
      '@services/display-options-helper'
    )
  ).applyDisplayOptions,
  /**
   * The shared market-panel builder. Absent, renderMarketPanel throws and
   * safeRender swallows it, leaving the whole panel empty.
   */
  buildMarketPanel: vi.fn(() => ({
    panel: {
      init: vi.fn(),
      destroy: vi.fn(),
      setContent: vi.fn(),
      getContentContainer: vi.fn(() => document.createElement('div')),
      open: vi.fn(),
      close: vi.fn(),
    },
    // Mirrors the real MarketBoard component's public surface
    marketBoard: {
      init: vi.fn(),
      destroy: vi.fn(),
      getShowPrices: vi.fn().mockReturnValue(false),
      setShowPrices: vi.fn(),
      getSelectedServer: vi.fn().mockReturnValue(null),
      setSelectedServer: vi.fn(),
      loadServerData: vi.fn().mockResolvedValue(undefined),
      refreshPrices: vi.fn().mockResolvedValue(undefined),
      fetchPricesForDyes: vi.fn().mockResolvedValue(new Map()),
      shouldFetchPrice: vi.fn().mockReturnValue(false),
    },
  })),
  /** Picks readable text ink for a swatch background. */
  getContrastColor: vi.fn(() => '#FFFFFF'),
  /** Used by six of the tools; absent it throws as an unhandled rejection. */
  ThemeService: {
    getCurrentTheme: vi.fn().mockReturnValue('standard-dark'),
    getAllThemes: vi.fn().mockReturnValue([]),
    isDarkMode: vi.fn().mockReturnValue(true),
    setTheme: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
      findClosestDyes: mockFindClosestDyes,
      findDyesWithinDistance: mockFindDyesWithinDistance,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
  dyeService: {
    getAllDyes: mockGetAllDyes,
    getDyeById: mockGetDyeById,
    findClosestDyes: mockFindClosestDyes,
    findDyesWithinDistance: mockFindDyesWithinDistance,
    getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
  },
  /** Complete against every LanguageService method the tools call. */
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string, params: Record<string, string>) =>
      `${key}: ${Object.values(params).join('/')}`,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
    getRace: (key: string) => `race:${key}`,
    getClan: (key: string) => `clan:${key}`,
    getAcquisition: (key: string) => `acq:${key}`,
    getCurrency: (key: string) => `cur:${key}`,
    getVisionType: (key: string) => `vision:${key}`,
    getCurrentLocale: () => 'en',
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  StorageService: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  /**
   * Complete against every ColorService method the tool components call.
   * A missing one throws inside renderContent, which BaseComponent's
   * safeRender() swallows into an error state — so the panel renders nothing
   * and the tests see an empty DOM instead of a failure.
   */
  ColorService: {
    // Blend entry points. The mixer routes through
    // @services/mixer-blending-engine, which calls these — so a gap here
    // throws only once TWO dyes are selected, not on render.
    mixColorsRgb: vi.fn(() => '#808080'),
    mixColorsLab: vi.fn(() => '#808080'),
    mixColorsOklab: vi.fn(() => '#808080'),
    mixColorsHsl: vi.fn(() => '#808080'),
    mixColorsRyb: vi.fn(() => '#808080'),
    mixColorsSpectral: vi.fn(() => '#808080'),
    hexToRgb: vi.fn((hex: string) => ({
      r: parseInt(hex.slice(1, 3), 16) || 0,
      g: parseInt(hex.slice(3, 5), 16) || 0,
      b: parseInt(hex.slice(5, 7), 16) || 0,
    })),
    rgbToHex: vi.fn((r: number, g: number, b: number) =>
      `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
    ),
    rgbToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    hexToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    hsvToHex: vi.fn(() => '#FF0000'),
    rgbToLab: vi.fn(() => ({ l: 50, a: 0, b: 0 })),
    hexToLab: vi.fn(() => ({ l: 50, a: 0, b: 0 })),
    labToHex: vi.fn(() => '#FF0000'),
    hexToLch: vi.fn(() => ({ l: 50, c: 20, h: 30 })),
    lchToHex: vi.fn(() => '#FF0000'),
    hexToOklch: vi.fn(() => ({ l: 0.5, c: 0.1, h: 30 })),
    oklchToHex: vi.fn(() => '#FF0000'),
    // All five share the one real metric, so switching which of them the tool
    // calls cannot quietly change what the suite covers.
    getColorDistance: mockDistance,
    getDeltaE: mockDistance,
    getDistanceForMethod: mockDistance,
    calculateDistanceWithMethod: mockDistance,
    calculateColorDistance: mockDistance,
    getContrastRatio: vi.fn(() => 4.5),
    simulateColorblindnessHex: vi.fn((hex: string) => hex),
    findClosestDyes: vi.fn(() => []),
  },
  MarketBoardService: {
    getInstance: vi.fn().mockReturnValue({
      // Kept in step with the real MarketBoardService. A missing method
      // throws inside renderContent, which safeRender() swallows into an
      // error state — the panel then renders nothing, silently.
      getPriceForDye: vi.fn().mockReturnValue(null),
      getAllPrices: vi.fn().mockReturnValue(new Map()),
      getPricesView: vi.fn().mockReturnValue(new Map()),
      getSelectedServer: vi.fn().mockReturnValue(null),
      setServer: vi.fn(),
      clearCache: vi.fn(),
      getIsFetching: vi.fn().mockReturnValue(false),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getWorldId: vi.fn().mockReturnValue(null),
      setWorldId: vi.fn(),
      getPriceForItem: vi.fn().mockReturnValue(null),
      fetchPricesForDyes: vi.fn().mockResolvedValue(new Map()),
      getWorldNameForPrice: vi.fn().mockReturnValue('Balmung'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setShowPrices: vi.fn(),
      getShowPrices: vi.fn().mockReturnValue(false),
    }),
  },
  CollectionService: {
    getFavorites: vi.fn().mockReturnValue([]),
    subscribeFavorites: vi.fn().mockReturnValue(() => {}),
    isFavorite: vi.fn().mockReturnValue(false),
  },
  APIService: {
    formatPrice: vi.fn((price: number) => `${price.toLocaleString()} Gil`),
  },
  RouterService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    getCurrentToolId: vi.fn().mockReturnValue('budget'),
    navigateTo: vi.fn(),
    // TERM-002: the ResultCard this tool mounts for the target-dye overview
    // calls `toolLabel()`, which reads this. `toolLabel` optional-chains the
    // call so an absent mock degrades to an empty label instead of throwing;
    // this app's own ledger tests get the real title-key behaviour instead.
    getRouteForTool: (id: string) => ({ id, titleKey: `tools.${id}.title` }),
  },
  WorldService: {
    getWorlds: vi.fn().mockReturnValue([]),
    getSelectedWorld: vi.fn().mockReturnValue(null),
    setSelectedWorld: vi.fn(),
  },
  ToastService: {
    warning: vi.fn(),
    show: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@services/pricing-mixin', () => ({
  setupMarketBoardListeners: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('../collapsible-panel', () => ({
  /**
   * Mirrors the real CollapsiblePanel's public API. `setContent` as a no-op
   * silently swallowed every control the tools place in a panel, and a
   * missing `getContentContainer` throws into BaseComponent.safeRender()'s
   * catch — which converts it to an error state, so the panel renders
   * nothing and the tests see an empty DOM instead of a failure.
   */
  CollapsiblePanel: class MockCollapsiblePanel {
    container: HTMLElement;
    options: Record<string, unknown>;
    private body: HTMLElement | null = null;
    constructor(container: HTMLElement, options: Record<string, unknown>) {
      this.container = container;
      this.options = options;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'collapsible-panel';
      div.id = (this.options.id as string) || 'panel';
      this.container.appendChild(div);
      this.body = div;
    }
    getContentContainer(): HTMLElement {
      if (!this.body) this.init();
      return this.body!;
    }
    setContent(content: HTMLElement | string) {
      if (!this.body) this.init();
      if (typeof content === 'string') this.body!.innerHTML = content;
      else if (content) this.body!.appendChild(content);
    }
    destroy() {
      this.container.innerHTML = '';
      this.body = null;
    }
    open() {}
    close() {}
    expand() {}
    collapse() {}
    toggle() {}
  },
}));

vi.mock('../market-board', () => ({
  /**
   * Mirrors the real MarketBoard component's public surface. Tools that build
   * a second, mobile board construct it directly from here rather than through
   * buildMarketPanel, so a gap shows up only on the mobile path.
   */
  MarketBoard: class MockMarketBoard {
    container: HTMLElement;
    private showPrices = false;
    private selectedServer: string | null = null;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'market-board';
      div.id = 'market-board';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    getShowPrices() {
      return this.showPrices;
    }
    setShowPrices(value: boolean) {
      this.showPrices = value;
    }
    getSelectedServer() {
      return this.selectedServer;
    }
    setSelectedServer(server: string | null) {
      this.selectedServer = server;
    }
    async loadServerData() {}
    async refreshPrices() {}
    async fetchPricesForDyes() {
      return new Map();
    }
    shouldFetchPrice() {
      return false;
    }
  },
}));

vi.mock('../dye-selector', () => ({
  DyeSelector: class MockDyeSelector {
    container: HTMLElement;
    options: Record<string, unknown>;
    selectedDyes: unknown[] = [];
    constructor(container: HTMLElement, options: Record<string, unknown> = {}) {
      this.container = container;
      this.options = options;
    }
    element: HTMLElement | null = null;
    init() {
      const div = document.createElement('div');
      div.className = 'dye-selector';
      div.id = 'dye-selector';
      this.container.appendChild(div);
      this.element = div;
    }
    // Inherited from BaseComponent on the real DyeSelector; the tools
    // reach through it to bind selection-changed on its parent.
    getElement() {
      return this.element;
    }
    destroy() {
      this.container.innerHTML = '';
    }
    getSelectedDyes() {
      return this.selectedDyes;
    }
    setSelectedDyes(dyes: unknown[]) {
      this.selectedDyes = dyes;
    }
    clearSelection() {
      this.selectedDyes = [];
    }
  },
}));

describe('BudgetTool', () => {
  let container: HTMLElement;
  let leftPanel: HTMLElement;
  let rightPanel: HTMLElement;
  let drawerContent: HTMLElement;
  let tool: BudgetTool | null;

  beforeEach(() => {
    container = createTestContainer();
    leftPanel = document.createElement('div');
    leftPanel.id = 'left-panel';
    rightPanel = document.createElement('div');
    rightPanel.id = 'right-panel';
    drawerContent = document.createElement('div');
    drawerContent.id = 'drawer-content';
    container.appendChild(leftPanel);
    container.appendChild(rightPanel);
    container.appendChild(drawerContent);
    tool = null;
    vi.clearAllMocks();
    // jsdom localStorage outlives a test and setup.ts does not clear it; the
    // controller singleton caches what it read. handleDeepLink reads the URL
    // on every mount. A leak in any of the three moves the ledger's line.
    localStorage.clear();
    ConfigController.resetInstance();
    window.history.replaceState(null, '', '/');
    // clearAllMocks keeps implementations, so undo any per-test getItem one.
    vi.mocked(StorageService.getItem).mockImplementation(() => null);
    // Writes through like the real one (market-board-service.ts setShowPrices),
    // so a test sees the persisted market config, not just the call.
    vi.mocked(MarketBoardService.getInstance().setShowPrices).mockImplementation((show) => {
      ConfigController.getInstance().setConfig('market', { showPrices: show });
    });
    mockGetAllDyes.mockReturnValue(mockDyes);
    mockGetDyeById.mockImplementation((id: number) => mockDyes.find((d) => d.id === id));
    mockGetByStainId.mockImplementation(
      (stainID: number) => mockDyes.find((d) => d.stainID === stainID) ?? null
    );
    mockFindClosestDyes.mockReturnValue(mockDyes.slice(0, 5));
    mockFindDyesWithinDistance.mockReturnValue(mockDyes.slice(0, 20));
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    if (tool) {
      try {
        tool.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
    localStorage.clear();
    ConfigController.resetInstance();
    window.history.replaceState(null, '', '/');
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render budget tool', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      expect(() => tool!.init()).not.toThrow();
    });

    it('should render left panel content', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel).not.toBeNull();
    });

    it('should render right panel content', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(rightPanel).not.toBeNull();
    });

    it('should render drawer content when provided', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(drawerContent).not.toBeNull();
    });

    it('should work without drawer content', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel });
      expect(() => tool!.init()).not.toThrow();
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should have setConfig method', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.setConfig).toBe('function');
    });

    it('should accept config via setConfig', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      expect(() => tool!.setConfig({ maxDeltaE: 12 })).not.toThrow();
    });

    it('should reset an out-of-range legacy match line to the default', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel });
      tool.init();

      // Legacy v3 distance values (25-100) are outside the 2-20 line range
      tool.setConfig({ maxDeltaE: 50 });
      const line = (tool as unknown as { matchLine: number }).matchLine;
      expect(line).toBe(8);
    });
  });

  // ============================================================================
  // Dye Selection Tests
  // ============================================================================

  describe('Dye Selection', () => {
    it('should have selectDye method', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.selectDye).toBe('function');
    });

    it('should have clearDyes method', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.clearDyes).toBe('function');
    });

    it('should accept dye selection', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      expect(() => tool!.selectDye(mockDyes[0])).not.toThrow();
    });

    it('should clear dyes', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);

      // Should not throw
      expect(() => tool!.clearDyes()).not.toThrow();
    });
  });

  // ============================================================================
  // 9C Pricing Rules
  // ============================================================================

  describe('Pricing (9C rules)', () => {
    type PriceOf = (dye: (typeof mockDyes)[number]) => {
      tier: string;
      gil: number | null;
      board: number | null;
      localCost: string | null;
    };

    it('should scan the full dye list when a target is selected', async () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      tool.selectDye(mockDyes[0]);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockGetAllDyes).toHaveBeenCalled();
    });

    it('should never price a coffer dye from dye.cost', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // No consolidation bucket = market-only (Venture Coffer) dye. The shipped
      // 4.x defect read dye.cost here and priced these at ~1 gil.
      const coffer = { ...mockDyes[0], consolidationType: null, cost: 1 };
      const price = (tool as unknown as { priceOf: PriceOf }).priceOf(coffer);

      expect(price.tier).toBe('X');
      expect(price.gil).toBeNull();
      expect(price.board).toBeNull();
      expect(price.localCost).toBeNull();
    });

    it('should price a Standard Spectrum dye at the 216 gil vendor floor', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      const standard = { ...mockDyes[0], consolidationType: 'A' as const };
      const price = (tool as unknown as { priceOf: PriceOf }).priceOf(standard);

      expect(price.tier).toBe('A');
      expect(price.gil).toBe(216);
      // Tier-A localCost must route through formatGil() (like the sibling
      // gil display), not a hand-rolled `${formatNumber} ${getCurrency}` —
      // the latter drops ja's no-space-before-ギル rule.
      expect(price.localCost).toBe(formatGil(216));
    });

    it('should leave scrip/credit tiers without a gil figure when the board is silent', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      const wide = { ...mockDyes[0], consolidationType: 'C' as const };
      const price = (tool as unknown as { priceOf: PriceOf }).priceOf(wide);

      // Cosmocredits are never converted to gil — no board price, no gil figure.
      expect(price.tier).toBe('C');
      expect(price.gil).toBeNull();
      expect(price.localCost).toContain('Cosmocredits');
    });
  });

  // ============================================================================
  // The Ledger
  //
  // These exist because the 6.6-point coverage swing described on mockDistance
  // happened without a single failing assertion: nothing here had ever looked
  // at what the ledger contained. Every count below is arithmetic off the
  // mocked metric, not a figure read back off a run.
  // ============================================================================

  describe('The ledger', () => {
    /**
     * Distance from Blood Red (#CC0000) under mockDistance, display-rounded to
     * ΔE2000's 1 dp — which is the value findAlternatives() compares:
     *
     *   Dalamud Red   2.6    Soot Black   9.1     Rose Pink   11.1
     *   Wine Red      2.8    Coral Pink   9.3     Sky Blue    16.0
     *   Sunset Orange 5.7    Ash Grey    10.2     Snow White  18.2
     *
     * So the default line of 8 admits three, a line of 12 admits seven, and
     * the slider's minimum of 2 admits none.
     */
    const TARGET = mockDyes[6]; // Blood Red #CC0000
    const DALAMUD = mockDyes[8];
    const WINE = mockDyes[4];
    const SUNSET = mockDyes[7];

    /** findAlternatives() awaits fetchPrices(); one macrotask drains the chain. */
    const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

    /** role="button" appears exactly once in budget-tool.ts — on a ledger row. */
    const ledgerRows = (): HTMLElement[] =>
      Array.from(rightPanel.querySelectorAll<HTMLElement>('div[role="button"][tabindex="0"]'));

    /** Row spans in document order: swatch, name, ΔE, board, per-point. */
    const cells = (row: HTMLElement): string[] =>
      Array.from(row.querySelectorAll('span')).map((s) => s.textContent ?? '');

    const rowNames = (): string[] => ledgerRows().map((row) => cells(row)[1]);

    /** The LanguageService mock outranks dye.name, so rows read "Dye-<itemID>". */
    const label = (dye: (typeof mockDyes)[number]): string => `Dye-${dye.itemID}`;

    const build = async (): Promise<void> => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();
      tool.selectDye(TARGET);
      await settle();
    };

    it('lists only the dyes inside the match line, nearest first', async () => {
      await build();

      // Ordering is the perPoint tie-break: every fixture dye is a coffer dye
      // with no gil, so perPoint is null throughout and sortRows falls to ΔE.
      expect(rowNames()).toEqual([label(DALAMUD), label(WINE), label(SUNSET)]);
    });

    it('prints each row at its display-rounded distance', async () => {
      await build();

      expect(ledgerRows().map((row) => cells(row)[2])).toEqual(['2.6', '2.8', '5.7']);
    });

    it('admits more dyes as the match line is raised', async () => {
      await build();
      expect(ledgerRows()).toHaveLength(3);

      tool!.setConfig({ maxDeltaE: 12 });
      await settle();

      // 12 clears Soot Black 9.1, Coral Pink 9.3, Ash Grey 10.2, Rose Pink
      // 11.1 — and still excludes Sky Blue 16.0 and Snow White 18.2.
      expect(ledgerRows()).toHaveLength(7);
      expect(rowNames()).not.toContain(label(mockDyes[0])); // Snow White
    });

    it('empties the ledger at the tightest match line', async () => {
      await build();
      expect(ledgerRows()).toHaveLength(3);

      tool!.setConfig({ maxDeltaE: 2 });
      await settle();

      // The nearest dye sits at 2.6, so the slider's floor admits nothing.
      expect(ledgerRows()).toEqual([]);
    });

    it('counts the admitted dyes against the tier pool', async () => {
      await build();

      // All ten fixture dyes are coffer (consolidationType null) = tier X, so
      // the one populated group reports three of ten.
      expect(rightPanel.textContent).toContain('3 / 10');
    });

    it('re-sorts when a column header is clicked', async () => {
      await build();

      // Headers are real <button>s, but they are not the only ones in the
      // panel — the quick picks come first — so match on the column label.
      // The active column carries a ▾/▴ suffix; the name column is inactive.
      const nameHeader = Array.from(rightPanel.querySelectorAll('button')).find(
        (b) => b.textContent === 'budget.colDye'
      );
      expect(nameHeader).toBeDefined();
      nameHeader!.click();

      // By name ascending: Dye-5733 (Wine) < Dye-5736 (Sunset) < Dye-5737 (Dalamud).
      expect(rowNames()).toEqual([label(WINE), label(SUNSET), label(DALAMUD)]);
    });

    it('sorts by name through the locale-aware comparator, not a bare localeCompare (I18N-008)', async () => {
      await build();

      const localeCompareSpy = vi.spyOn(String.prototype, 'localeCompare');
      const nameHeader = Array.from(rightPanel.querySelectorAll('button')).find(
        (b) => b.textContent === 'budget.colDye'
      );
      nameHeader!.click();

      // `compareDyeNames` calls `localeCompare(other, LanguageService.getCurrentLocale())`.
      // A bare `a.localeCompare(b)` regression calls it with ONE argument, so
      // this fails the moment `sortRows` stops passing a locale through.
      expect(localeCompareSpy).toHaveBeenCalledWith(expect.any(String), 'en');
      localeCompareSpy.mockRestore();
    });

    it('picks a row as the new target', async () => {
      await build();

      ledgerRows()[0].click();
      await settle();

      // Dalamud Red is now the target, so it can no longer be its own candidate.
      expect(rowNames()).not.toContain(label(DALAMUD));
    });
  });

  // ============================================================================
  // Settings owned by ConfigController
  //
  // BUG-012/022/078/079 and BUG-014 (2026-10-04 deep-dive). Every setting is
  // seeded from, and committed to, the real controller — the sidebar's store.
  // Distances and row counts are the ledger table above: from Blood Red, a
  // line of 8 admits three dyes, 12 or 14 admit seven.
  // ============================================================================

  describe('Settings owned by ConfigController', () => {
    const TARGET = mockDyes[6]; // Blood Red #CC0000
    const DALAMUD = mockDyes[8]; // isMetallic, 2.6 away
    const WINE = mockDyes[4];
    const SUNSET = mockDyes[7];

    const RETIRED_KEYS = [
      'v5_budget_match_line',
      'v3_budget_matching_method',
      'v3_budget_show_hex',
      'v3_budget_show_rgb',
      'v3_budget_show_hsv',
      'v3_budget_show_lab',
      'v3_budget_show_cmyk',
      'v3_budget_show_price',
      'v3_budget_show_delta_e',
      'v3_budget_show_acquisition',
    ];

    const controller = (): ConfigController => ConfigController.getInstance();
    const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
    const ledgerRows = (): HTMLElement[] =>
      Array.from(rightPanel.querySelectorAll<HTMLElement>('div[role="button"][tabindex="0"]'));
    const rowNames = (): string[] =>
      ledgerRows().map((row) => row.querySelectorAll('span')[1]?.textContent ?? '');
    const label = (dye: (typeof mockDyes)[number]): string => `Dye-${dye.itemID}`;
    const matchLine = (): number => (tool as unknown as { matchLine: number }).matchLine;

    const slider = (panel: HTMLElement): HTMLInputElement =>
      panel.querySelector<HTMLInputElement>('input[type="range"]')!;
    /** The value span: the second span in the row above the slider. */
    const lineLabel = (panel: HTMLElement): string =>
      slider(panel).parentElement!.firstElementChild!.children[1].textContent ?? '';
    const targetCard = (): ResultCard => rightPanel.querySelector('v4-result-card') as ResultCard;

    const drag = (panel: HTMLElement, value: number): void => {
      slider(panel).value = String(value);
      slider(panel).dispatchEvent(new Event('input'));
      slider(panel).dispatchEvent(new Event('change'));
    };

    const mount = async (): Promise<void> => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();
      tool.selectDye(TARGET);
      await settle();
    };

    describe('seeded at mount', () => {
      it('takes the match line from the persisted budget config', async () => {
        controller().setConfig('budget', { maxDeltaE: 12 });
        await mount();

        expect(ledgerRows()).toHaveLength(7);
        expect(slider(rightPanel).value).toBe('12');
        expect(lineLabel(rightPanel)).toBe('12');
      });

      it('takes the dye filters from the persisted budget config (BUG-022)', async () => {
        controller().setConfig('budget', {
          dyeFilters: { ...DEFAULT_DYE_FILTERS, excludeMetallic: true },
        });
        await mount();

        // Dalamud Red is the one metallic dye inside the line.
        expect(rowNames()).toEqual([label(WINE), label(SUNSET)]);
        expect(rowNames()).not.toContain(label(DALAMUD));
      });

      it('takes the display options, the 5.0 rows included (BUG-078)', async () => {
        controller().setConfig('budget', {
          displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showHue: false, showRgb: false },
        });
        await mount();

        expect(targetCard().showHue).toBe(false);
        expect(targetCard().showRgb).toBe(false);
        expect(targetCard().showStain).toBe(true);
      });

      it('shows RGB, HSV and LAB by default, as the sidebar does', async () => {
        await mount();

        expect(targetCard().showRgb).toBe(true);
        expect(targetCard().showHsv).toBe(true);
        expect(targetCard().showLab).toBe(true);
        expect(targetCard().showCmyk).toBe(false);
      });

      it('takes the matching method from the persisted budget config', async () => {
        controller().setConfig('budget', { matchingMethod: 'oklab' });
        await mount();

        // Only ΔE2000 is calibrated against the slider; other methods pin it.
        expect(slider(rightPanel).disabled).toBe(true);
      });
    });

    describe('the in-page match line slider (BUG-012)', () => {
      it('previews on input and commits to the controller on change', async () => {
        await mount();

        slider(rightPanel).value = '14';
        slider(rightPanel).dispatchEvent(new Event('input'));
        expect(matchLine()).toBe(14);
        expect(lineLabel(rightPanel)).toBe('14');
        expect(slider(drawerContent).value).toBe('14');
        expect(controller().getConfig('budget').maxDeltaE).toBe(8);

        slider(rightPanel).dispatchEvent(new Event('change'));
        expect(controller().getConfig('budget').maxDeltaE).toBe(14);
      });

      it('keeps its value through a display-option broadcast', async () => {
        await mount();
        drag(rightPanel, 14);

        // The sidebar's display-option toggle writes budget.displayOptions;
        // the controller then notifies the FULL budget config, maxDeltaE too.
        controller().setConfig('budget', {
          displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showHex: false },
        });
        await settle();

        expect(matchLine()).toBe(14);
        expect(slider(rightPanel).value).toBe('14');
        expect(controller().getConfig('budget').maxDeltaE).toBe(14);
        expect(ledgerRows()).toHaveLength(7);
      });

      it('moves both thumbs and labels when the sidebar changes the line', async () => {
        await mount();

        controller().setConfig('budget', { maxDeltaE: 15 });

        expect(slider(rightPanel).value).toBe('15');
        expect(slider(drawerContent).value).toBe('15');
        expect(lineLabel(rightPanel)).toBe('15');
        expect(lineLabel(drawerContent)).toBe('15');
      });

      it('writes none of the retired budget storage keys', async () => {
        await mount();

        drag(rightPanel, 14);
        tool!.setConfig({ displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showCmyk: true } });
        tool!.setConfig({ matchingMethod: 'oklab' });

        const written = vi.mocked(StorageService.setItem).mock.calls.map(([key]) => key);
        expect(written.filter((key) => RETIRED_KEYS.includes(key))).toEqual([]);
      });
    });

    describe('migration of the retired storage keys', () => {
      it('moves a stored v5_budget_match_line into the controller, then deletes every retired key', async () => {
        vi.mocked(StorageService.getItem).mockImplementation((key: string) =>
          key === 'v5_budget_match_line' ? 14 : null
        );
        await mount();

        expect(controller().getConfig('budget').maxDeltaE).toBe(14);
        expect(slider(rightPanel).value).toBe('14');
        for (const key of RETIRED_KEYS) {
          expect(StorageService.removeItem).toHaveBeenCalledWith(key);
        }
      });

      it('drops an out-of-range legacy line without overwriting the saved one', async () => {
        controller().setConfig('budget', { maxDeltaE: 12 });
        vi.mocked(StorageService.getItem).mockImplementation((key: string) =>
          key === 'v5_budget_match_line' ? 50 : null
        );
        await mount();

        expect(controller().getConfig('budget').maxDeltaE).toBe(12);
        expect(StorageService.removeItem).toHaveBeenCalledWith('v5_budget_match_line');
      });
    });

    describe('market prices (BUG-079)', () => {
      it('fetches its own prices without switching the global Market Board on', async () => {
        await mount();

        const market = MarketBoardService.getInstance();
        expect(controller().getConfig('market').showPrices).toBe(false);
        expect(market.setShowPrices).not.toHaveBeenCalled();
        expect(market.fetchPricesForDyes).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Function),
          { ignoreShowPrices: true }
        );
      });

      it('refetches on a server change, not on a Market Board toggle', async () => {
        await mount();
        const fetchPrices = vi.mocked(MarketBoardService.getInstance().fetchPricesForDyes);
        fetchPrices.mockClear();

        controller().setConfig('market', { showPrices: true });
        controller().setConfig('market', { showPrices: false });
        await settle();
        expect(fetchPrices).not.toHaveBeenCalled();

        controller().setConfig('market', { selectedServer: 'Aether' });
        await settle();
        expect(fetchPrices).toHaveBeenCalledTimes(1);
      });
    });

    describe('share links', () => {
      it('shows a linked ?maxDelta= on the label and both sliders (BUG-014)', async () => {
        window.history.replaceState(null, '', '/budget?maxDelta=14');
        await mount();

        expect(lineLabel(rightPanel)).toBe('14');
        expect(slider(rightPanel).value).toBe('14');
        expect(slider(drawerContent).value).toBe('14');
        expect(controller().getConfig('budget').maxDeltaE).toBe(14);
        expect(ledgerRows()).toHaveLength(7);
      });

      it('ignores an out-of-range ?maxDelta= instead of resetting the saved line', async () => {
        controller().setConfig('budget', { maxDeltaE: 12 });
        window.history.replaceState(null, '', '/budget?maxDelta=50');
        await mount();

        expect(controller().getConfig('budget').maxDeltaE).toBe(12);
        expect(slider(rightPanel).value).toBe('12');
        expect(lineLabel(rightPanel)).toBe('12');
      });

      it('keeps the pinned-cut label when the method is not ΔE2000', async () => {
        controller().setConfig('budget', { matchingMethod: 'oklab' });
        window.history.replaceState(null, '', '/budget?maxDelta=14');
        await mount();

        expect(controller().getConfig('budget').maxDeltaE).toBe(14);
        expect(lineLabel(rightPanel)).toMatch(/^≤ /);
      });
    });
  });

  // ============================================================================
  // Superseded runs (BUG-015, 2026-10-04 deep-dive)
  //
  // findAlternatives() reads the target and the line before it awaits prices,
  // and wrote this.rows after it with nothing checking that a newer run had
  // started meanwhile. Two fetches over different market IDs can resolve out
  // of order; the later-resolving older run then drew its rows under the new
  // target. Distances are the ledger table above.
  // ============================================================================

  describe('Superseded runs (BUG-015)', () => {
    const TARGET = mockDyes[6]; // Blood Red: Dalamud, Wine, Sunset inside the line of 8
    const OTHER = mockDyes[0]; // Snow White: Sky Blue and Rose Pink instead
    const DALAMUD = mockDyes[8];
    const WINE = mockDyes[4];
    const SUNSET = mockDyes[7];

    type Prices = Awaited<ReturnType<MarketBoardService['fetchPricesForDyes']>>;
    type Outcome = MarketBoardService['lastFetchOutcome'];

    /** A price fetch the test settles when it chooses. */
    const deferred = (): {
      promise: Promise<Prices>;
      resolve: (prices: Prices) => void;
      reject: (error: Error) => void;
    } => {
      let resolve!: (prices: Prices) => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<Prices>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };

    const market = (): MarketBoardService => MarketBoardService.getInstance();
    const fetchPrices = () => vi.mocked(market().fetchPricesForDyes);
    /** The stub has no lastFetchOutcome; the real one is shared by every call. */
    const setOutcome = (outcome: Outcome): void => {
      (market() as unknown as { lastFetchOutcome: Outcome }).lastFetchOutcome = outcome;
    };

    const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
    const ledgerRows = (): HTMLElement[] =>
      Array.from(rightPanel.querySelectorAll<HTMLElement>('div[role="button"][tabindex="0"]'));
    const rowNames = (): string[] =>
      ledgerRows().map((row) => row.querySelectorAll('span')[1]?.textContent ?? '');
    const label = (dye: (typeof mockDyes)[number]): string => `Dye-${dye.itemID}`;
    const rows = (): unknown[] => (tool as unknown as { rows: unknown[] }).rows;
    const BLOOD_RED_ROWS = [label(DALAMUD), label(WINE), label(SUNSET)];

    const mount = async (): Promise<void> => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();
      await settle();
    };

    afterEach(() => {
      // mockReset drops any unconsumed Once queue, then restore the stub's default.
      fetchPrices().mockReset();
      fetchPrices().mockResolvedValue(new Map());
      delete (market() as unknown as { lastFetchOutcome?: Outcome }).lastFetchOutcome;
    });

    it('a mount fetch that resolves after the first pick does not empty its ledger', async () => {
      const mountFetch = deferred();
      const pickFetch = deferred();
      fetchPrices()
        .mockImplementationOnce(() => mountFetch.promise)
        .mockImplementationOnce(() => pickFetch.promise);

      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init(); // the mount run, with no target yet
      tool.selectDye(TARGET);

      pickFetch.resolve(new Map());
      await settle();
      expect(rowNames()).toEqual(BLOOD_RED_ROWS);

      // The mount run read `target = null` before its await.
      mountFetch.resolve(new Map());
      await settle();
      expect(rowNames()).toEqual(BLOOD_RED_ROWS);
    });

    it("an earlier pick's late fetch does not draw its rows under the later pick", async () => {
      await mount();
      const first = deferred();
      const second = deferred();
      fetchPrices()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise);

      tool!.selectDye(OTHER);
      tool!.selectDye(TARGET);

      second.resolve(new Map());
      await settle();
      const card = rightPanel.querySelector('v4-result-card');
      first.resolve(new Map());
      await settle();

      expect(rowNames()).toEqual(BLOOD_RED_ROWS);
      // Nor does it rebuild the target card, whose menu the user may have open.
      expect(rightPanel.querySelector('v4-result-card')).toBe(card);
    });

    /**
     * The older request fails after the newer one finished. The real service
     * reports a failure as an empty Map plus a shared `lastFetchOutcome`, which
     * then describes that request, not the run on screen; a rejection is the
     * other way fetchPrices() can hear of one.
     */
    const failures: Array<[string, (pending: ReturnType<typeof deferred>) => void]> = [
      [
        'reports an error outcome',
        (pending) => {
          setOutcome('error');
          pending.resolve(new Map());
        },
      ],
      ['rejects', (pending) => pending.reject(new Error('board down'))],
    ];

    it.each(failures)(
      'a superseded fetch that %s does not mark the market offline over a newer success',
      async (_how, fail) => {
        await mount();
        const first = deferred();
        fetchPrices()
          .mockImplementationOnce(() => first.promise)
          .mockImplementationOnce(() => {
            setOutcome('ok');
            return Promise.resolve(new Map());
          });

        tool!.selectDye(OTHER);
        tool!.selectDye(TARGET);
        await settle();
        expect(rightPanel.textContent).not.toContain('budget.offBadge');

        fail(first);
        await settle();
        // Re-sorting redraws the ledger without a fetch: an offline market
        // flags the unpriced coffer group with the offline badge.
        Array.from(rightPanel.querySelectorAll('button'))
          .find((b) => b.textContent === 'budget.colDye')!
          .click();
        expect(rightPanel.textContent).not.toContain('budget.offBadge');
      }
    );

    it('a run in flight when the target is cleared leaves no rows behind', async () => {
      await mount();
      const pending = deferred();
      fetchPrices().mockImplementationOnce(() => pending.promise);

      tool!.selectDye(TARGET);
      tool!.clearDyes();
      pending.resolve(new Map());
      await settle();

      expect(rows()).toEqual([]);
    });

    // The 2026-10-04 Sprint 5 review: clearing moved the run on, so the price
    // fetch it was awaiting was thrown away, and the quick picks stayed on
    // their unpriced offline fallback although the board had answered.
    it('a clear during a price fetch still prices the quick picks', async () => {
      await mount();
      const board: Prices = new Map(
        mockDyes.map((d, i) => [
          d.itemID,
          {
            itemID: d.itemID,
            currentAverage: 1000 + i,
            currentMinPrice: 1000 + i,
            currentMaxPrice: 1000 + i,
            lastUpdate: 0,
          },
        ])
      );
      const pending = deferred();
      fetchPrices()
        .mockImplementationOnce(() => pending.promise)
        .mockResolvedValue(board);

      tool!.selectDye(TARGET);
      tool!.clearDyes();
      pending.resolve(board);
      await settle();

      expect(container.textContent).toContain('budget.priciestNow');
      expect(container.textContent).not.toContain('budget.priciestOff');
      expect(rows()).toEqual([]);
    });

    it('a run in flight at destroy leaves no rows behind', async () => {
      await mount();
      const pending = deferred();
      fetchPrices().mockImplementationOnce(() => pending.promise);

      tool!.selectDye(TARGET);
      tool!.destroy();
      pending.resolve(new Map());
      await settle();

      expect(rows()).toEqual([]);
    });
  });

  // ============================================================================
  // The target in the address bar (BUG-013, 2026-10-04 deep-dive)
  //
  // RouterService carries `dye=` across every navigation, and the deep-link
  // handler applies it on every mount. A pick made in Budget reached storage
  // only, so leaving and coming back put the link's dye back over it.
  // ============================================================================

  describe('The target in the address bar (BUG-013)', () => {
    const TARGET = mockDyes[6]; // Blood Red
    const LINKED = mockDyes[0]; // Snow White, stainID 1
    const DALAMUD = mockDyes[8];
    const WINE = mockDyes[4];
    const SUNSET = mockDyes[7];

    const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
    const params = (): URLSearchParams => new URLSearchParams(window.location.search);
    const label = (dye: (typeof mockDyes)[number]): string => `Dye-${dye.itemID}`;
    const rowNames = (): string[] =>
      Array.from(rightPanel.querySelectorAll<HTMLElement>('div[role="button"][tabindex="0"]')).map(
        (row) => row.querySelectorAll('span')[1]?.textContent ?? ''
      );
    const shownTarget = (): number | undefined =>
      (rightPanel.querySelector('v4-result-card') as ResultCard | null)?.data?.dye.id;

    const mount = async (): Promise<void> => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();
      await settle();
    };

    beforeEach(() => {
      // A store that reads back what it was given, so a remount sees the pick.
      const stored = new Map<string, unknown>();
      vi.mocked(StorageService.setItem).mockImplementation((key: string, value: unknown) => {
        stored.set(key, value);
        return true;
      });
      vi.mocked(StorageService.getItem).mockImplementation(
        (key: string) => (stored.get(key) ?? null) as never
      );
    });

    afterEach(() => {
      // The outer beforeEach resets getItem; setItem is this block's alone.
      vi.mocked(StorageService.setItem).mockReset();
    });

    it('a linked ?dye= leaves the address bar once stored, so coming back keeps a later pick', async () => {
      window.history.replaceState({ toolId: 'budget' }, '', '/budget?dye=1&dc=Aether');
      await mount();

      expect(shownTarget()).toBe(LINKED.id);
      expect(StorageService.setItem).toHaveBeenCalledWith('v3_budget_target', LINKED.id);
      expect(params().has('dye')).toBe(false);
      expect(params().get('dc')).toBe('Aether');
      // RouterService's popstate handler reads the entry's own state.
      expect(window.history.state).toEqual({ toolId: 'budget' });

      tool!.selectDye(TARGET);
      await settle();

      // Leaving and coming back builds a new tool at whatever the router kept.
      tool!.destroy();
      await mount();
      expect(shownTarget()).toBe(TARGET.id);
      expect(rowNames()).toEqual([label(DALAMUD), label(WINE), label(SUNSET)]);
    });

    // The 2026-10-04 Sprint 5 review's repro: the result card's "Set as budget
    // target" lands on /budget?dye=…, and the next navigation carried that dye
    // into Harmony, which replaced its own stored base with it.
    it('a "Set as budget target" hand-off does not follow the user into the next tool', async () => {
      // Not mocked: the barrel above is, this module is not.
      const { RouterService: router } = await import('@services/router-service');
      window.history.replaceState({ toolId: 'budget' }, '', `/budget?dye=${LINKED.stainID}`);
      await mount();

      router.navigateTo('harmony');

      expect(window.location.pathname).toBe('/harmony');
      expect(params().has('dye')).toBe(false);
    });

    it('leaves a ?hex= target in the address bar, which is never stored', async () => {
      window.history.replaceState(null, '', '/budget?hex=123456');
      await mount();

      expect(params().get('hex')).toBe('123456');
    });

    it('takes a linked ?hex= out on a pick, which the deep link falls back to without a dye', async () => {
      window.history.replaceState(null, '', '/budget?hex=123456');
      await mount();

      tool!.selectDye(TARGET);

      expect(params().has('hex')).toBe(false);
    });

    /** A pre-5.0 itemID: refused with a toast, so the link stays unapplied. */
    const UNAPPLIED = '5772';

    it.each<[string, (t: BudgetTool) => void]>([
      ['an in-tool pick', (t) => t.selectDye(TARGET)],
      ['a custom colour from the palette drawer', (t) => t.selectCustomColor('#123456')],
      ['Clear All', (t) => t.clearDyes()],
    ])('%s takes out a ?dye= the tool could not apply', async (_label, act) => {
      window.history.replaceState(null, '', `/budget?dye=${UNAPPLIED}`);
      await mount();
      expect(params().get('dye')).toBe(UNAPPLIED);

      act(tool!);

      expect(params().has('dye')).toBe(false);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });

    it('should handle double destroy gracefully', () => {
      tool = new BudgetTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.destroy();

      // Second destroy should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });
  });
});
