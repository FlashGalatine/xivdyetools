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

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
const {
  mockGetAllDyes,
  mockGetDyeById,
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
}));

vi.mock('@services/index', () => ({
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
  ConfigController: {
    getInstance: vi.fn().mockReturnValue({
      getConfig: vi.fn().mockReturnValue({}),
      subscribe: vi.fn().mockReturnValue(() => {}),
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

vi.mock('../dye-action-dropdown', () => ({
  createDyeActionDropdown: vi.fn().mockImplementation(() => {
    const div = document.createElement('div');
    div.className = 'dye-action-dropdown';
    return div;
  }),
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
    mockGetAllDyes.mockReturnValue(mockDyes);
    mockGetDyeById.mockImplementation((id: number) => mockDyes.find((d) => d.id === id));
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

    it('picks a row as the new target', async () => {
      await build();

      ledgerRows()[0].click();
      await settle();

      // Dalamud Red is now the target, so it can no longer be its own candidate.
      expect(rowNames()).not.toContain(label(DALAMUD));
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
