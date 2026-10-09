/**
 * XIV Dye Tools - ComparisonTool Unit Tests
 *
 * Tests the comparison tool component for comparing multiple dyes.
 * Covers rendering, multi-dye selection, HSV stats, and distance matrix.
 *
 * @module components/__tests__/comparison-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComparisonTool } from '../comparison-tool';
import { CollapsiblePanel } from '../collapsible-panel';
import { DyeSelector } from '../dye-selector';
import { MarketBoard } from '../market-board';
import { methodShort } from '../metric-help';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
const { mockGetAllDyes, mockGetDyeById } = vi.hoisted(() => ({
  mockGetAllDyes: vi.fn(),
  mockGetDyeById: vi.fn(),
}));

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
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
}));

vi.mock('@services/index', () => ({
  ToastService: {
    show: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
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
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
  dyeService: {
    getAllDyes: mockGetAllDyes,
    getDyeById: mockGetDyeById,
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
    getColorDistance: vi.fn(() => 15),
    getDeltaE: vi.fn(() => 15),
    getDistanceForMethod: vi.fn(() => 15),
    calculateDistanceWithMethod: vi.fn(() => 15),
    calculateColorDistance: vi.fn(() => 15),
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
      getWorldNameForPrice: vi.fn().mockReturnValue(null),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getWorldId: vi.fn().mockReturnValue(null),
      setWorldId: vi.fn(),
      getPriceForItem: vi.fn().mockReturnValue(null),
      fetchPricesForDyes: vi.fn().mockResolvedValue(new Map()),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getShowPrices: vi.fn().mockReturnValue(false),
      setShowPrices: vi.fn(),
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
  RouterService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    getCurrentToolId: vi.fn().mockReturnValue('compare'),
    navigateTo: vi.fn(),
  },
  WorldService: {
    getWorlds: vi.fn().mockReturnValue([]),
    getSelectedWorld: vi.fn().mockReturnValue(null),
    setSelectedWorld: vi.fn(),
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

describe('ComparisonTool', () => {
  let container: HTMLElement;
  let leftPanel: HTMLElement;
  let rightPanel: HTMLElement;
  let drawerContent: HTMLElement;
  let tool: ComparisonTool | null;

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
    it('should render comparison tool', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });

    it('should render left panel content', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });

    it('should render right panel content', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Right panel should exist and tool should not throw
      expect(rightPanel).not.toBeNull();
    });

    it('should render drawer content when provided', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Drawer content should exist and tool should not throw
      expect(drawerContent).not.toBeNull();
    });

    it('should work without drawer content', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Persisted Dye Restore (BUG-042)
  // ============================================================================

  describe('Persisted Dye Restore', () => {
    // BUG-042 (2026-07-18 audit): getDyeById returns null (not undefined) for
    // unknown IDs; stale persisted IDs must be dropped, not crash the tool on
    // every load
    it('should drop stale persisted IDs that no longer resolve and self-heal storage', async () => {
      const { StorageService } = await import('@services/index');
      const staleId = 999999;
      vi.mocked(StorageService.getItem).mockImplementation((key: string) =>
        key === 'v3_comparison_selected_dyes' ? [mockDyes[0].id, staleId] : null
      );
      // Match the real DyeService contract: null (not undefined) for misses
      mockGetDyeById.mockImplementation((id: number) => mockDyes.find((d) => d.id === id) ?? null);

      tool = new ComparisonTool(container, { leftPanel, rightPanel, drawerContent });
      expect(() => tool!.init()).not.toThrow();

      expect(vi.mocked(StorageService.getItem)).toHaveBeenCalledWith('v3_comparison_selected_dyes');

      // The stale ID is pruned from storage so it can't break future loads
      expect(vi.mocked(StorageService.setItem)).toHaveBeenCalledWith(
        'v3_comparison_selected_dyes',
        [mockDyes[0].id]
      );
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should have setConfig method', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.setConfig).toBe('function');
    });

    it('should accept config via setConfig', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      tool.setConfig({
        displayOptions: {
          showHex: true,
          showRgb: false,
          showHsv: false,
          showLab: false,
          showCmyk: false,
          showPrice: false,
          showDeltaE: false,
          showAcquisition: false,
        },
      });

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Dye Selection Tests
  // ============================================================================

  describe('Dye Selection', () => {
    it('should have selectDye method', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.selectDye).toBe('function');
    });

    it('should have clearDyes method', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.clearDyes).toBe('function');
    });

    it('should accept dye selection', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      expect(() => tool!.selectDye(mockDyes[0])).not.toThrow();
    });

    it('should clear dyes', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);

      // Should not throw
      expect(() => tool!.clearDyes()).not.toThrow();
    });

    it('should support multiple dye selection', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw when adding multiple dyes
      expect(() => {
        tool!.selectDye(mockDyes[0]);
        tool!.selectDye(mockDyes[1]);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Export / Share reachability (7C duel)
  // ============================================================================

  describe('Export and Share actions', () => {
    /** Walks up from `el` and reports whether any ancestor is display:none. */
    const isHiddenByAncestor = (el: HTMLElement): boolean => {
      let node: HTMLElement | null = el;
      while (node && node !== rightPanel) {
        if (node.style.display === 'none') return true;
        node = node.parentElement;
      }
      return false;
    };

    it('keeps Export and Share reachable with a pair loaded (duel view)', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);
      tool.selectDye(mockDyes[1]);

      const exportBtn = rightPanel.querySelector<HTMLElement>('[data-testid="comparison-export"]');
      const shareBtn = rightPanel.querySelector<HTMLElement>('v4-share-button');
      expect(exportBtn).not.toBeNull();
      expect(shareBtn).not.toBeNull();
      expect(exportBtn!.isConnected).toBe(true);
      expect(shareBtn!.isConnected).toBe(true);
      // The defect: the pair view hid the whole "selected dyes" section, and
      // the actions lived inside it, so nothing above could be reached.
      expect(isHiddenByAncestor(exportBtn!)).toBe(false);
      expect(isHiddenByAncestor(shareBtn!)).toBe(false);

      // Share payload carries both dyes
      const share = shareBtn as unknown as {
        disabled: boolean;
        shareParams: { dyes?: number[] };
      };
      expect(share.disabled).toBe(false);
      expect(share.shareParams.dyes).toEqual([mockDyes[0].stainID, mockDyes[1].stainID]);
    });

    it('keeps Export and Share reachable with three and four dyes loaded', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);
      tool.selectDye(mockDyes[1]);
      tool.selectDye(mockDyes[2]);
      const exportBtn = rightPanel.querySelector<HTMLElement>('[data-testid="comparison-export"]');
      expect(isHiddenByAncestor(exportBtn!)).toBe(false);

      tool.selectDye(mockDyes[3]);
      expect(isHiddenByAncestor(exportBtn!)).toBe(false);
      expect(isHiddenByAncestor(rightPanel.querySelector<HTMLElement>('v4-share-button')!)).toBe(
        false
      );
    });

    it('still shows the plain single-dye card row only for exactly one dye', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      const cards = rightPanel.querySelector<HTMLElement>('.comparison-cards-container');
      expect(cards).not.toBeNull();

      tool.selectDye(mockDyes[0]);
      expect(isHiddenByAncestor(cards!)).toBe(false);

      tool.selectDye(mockDyes[1]);
      expect(isHiddenByAncestor(cards!)).toBe(true);
    });

    it('hides the actions again in the empty state', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);
      tool.selectDye(mockDyes[1]);
      tool.clearDyes();

      const exportBtn = rightPanel.querySelector<HTMLElement>('[data-testid="comparison-export"]');
      expect(isHiddenByAncestor(exportBtn!)).toBe(true);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });

    it('should handle double destroy gracefully', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.destroy();

      // Second destroy should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });
  });

  // ==========================================================================
  // Shared by the two describes below. The persisted-restore test above leaves
  // StorageService.getItem answering with a saved selection, and
  // clearAllMocks keeps implementations, so each describe resets it.
  // ==========================================================================

  const resetStorageReads = async () => {
    const { StorageService } = await import('@services/index');
    vi.mocked(StorageService.getItem).mockReturnValue(null);
  };

  /** Whether `el` or any ancestor up to `root` is display:none. */
  const isHiddenWithin = (el: Element, root: HTMLElement): boolean => {
    let node: HTMLElement | null = el as HTMLElement;
    while (node && node !== root) {
      if (node.style.display === 'none') return true;
      node = node.parentElement;
    }
    return false;
  };

  /** The span or p in `root` whose whole text is `text`. */
  const textEl = (root: HTMLElement, text: string): HTMLElement | undefined =>
    [...root.querySelectorAll<HTMLElement>('span, p')].find((el) => el.textContent === text);

  // ==========================================================================
  // BUG-021 / BUG-076 (2026-10-04 deep-dive): a language switch runs update(),
  // which re-ran renderContent only. The right panel came back with every
  // section hidden and the empty state up, and the previous left-panel
  // selector, panels and market board were never destroyed -- one more live
  // set per switch. No test fired the LanguageService subscriber.
  // ==========================================================================

  describe('a language switch keeps the comparison on screen', () => {
    beforeEach(resetStorageReads);

    /** Every captured subscriber, as the extractor test does: not only `calls[0]`. */
    const switchLanguage = async () => {
      const { LanguageService } = await import('@services/index');
      for (const [cb] of [...vi.mocked(LanguageService.subscribe).mock.calls]) {
        (cb as () => void)();
      }
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    };

    /** Mounted as the v4 shell mounts it: one element as both panels. */
    const mountV4 = (): { tool: ComparisonTool; panel: HTMLElement } => {
      const panel = document.createElement('div');
      container.appendChild(panel);
      const t = new ComparisonTool(container, {
        leftPanel: panel,
        rightPanel: panel,
        drawerContent: null,
      });
      t.init();
      return { tool: t, panel };
    };

    it('still shows the duel, the pair chips, Export and Share for three dyes', async () => {
      const mounted = mountV4();
      tool = mounted.tool;
      const { panel } = mounted;
      for (const dye of mockDyes.slice(0, 3)) tool.selectDye(dye);

      await switchLanguage();

      expect(isHiddenWithin(textEl(panel, 'comparison.selectAtLeastTwoDyes')!, panel)).toBe(true);
      const heading = textEl(panel, 'comparison.allPairs: 3');
      expect(heading).toBeDefined();
      expect(isHiddenWithin(heading!, panel)).toBe(false);
      const chips = [...panel.querySelectorAll('button')].filter((b) =>
        b.textContent?.includes(' × ')
      );
      expect(chips).toHaveLength(3);
      // Every pair reads 15 in the mocked ColorService: ΔE2000 15 is WIDE
      const verdict = textEl(panel, 'comparison.badgeWide');
      expect(verdict).toBeDefined();
      expect(isHiddenWithin(verdict!, panel)).toBe(false);
      const exportBtn = panel.querySelector('[data-testid="comparison-export"]')!;
      const share = panel.querySelector('v4-share-button') as unknown as HTMLElement & {
        disabled: boolean;
        shareParams: { dyes?: number[] };
      };
      expect(isHiddenWithin(exportBtn, panel)).toBe(false);
      expect(isHiddenWithin(share, panel)).toBe(false);
      expect(share.disabled).toBe(false);
      expect(share.shareParams.dyes).toEqual(mockDyes.slice(0, 3).map((d) => d.stainID));
    });

    it('destroys the previous selector, panels and market board on each rebuild', async () => {
      const selectorDestroy = vi.spyOn(DyeSelector.prototype, 'destroy');
      const boardDestroy = vi.spyOn(MarketBoard.prototype, 'destroy');
      const panelDestroy = vi.spyOn(CollapsiblePanel.prototype, 'destroy');
      tool = mountV4().tool;

      await switchLanguage();
      await switchLanguage();

      expect(selectorDestroy).toHaveBeenCalledTimes(2);
      expect(boardDestroy).toHaveBeenCalledTimes(2);
      // Dye selection, options and market board: three panels per rebuild
      expect(panelDestroy).toHaveBeenCalledTimes(6);
    });

    // Outside the v4 shell the rebuilt selector is on screen: an empty one
    // replaced the whole comparison with its first pick.
    it('hands the rebuilt dye selector the current selection', async () => {
      const selectorInit = vi.spyOn(DyeSelector.prototype, 'init');
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();
      tool.selectDye(mockDyes[0]);
      tool.selectDye(mockDyes[1]);

      await switchLanguage();

      const rebuilt = selectorInit.mock.contexts.at(-1) as unknown as DyeSelector;
      expect(selectorInit).toHaveBeenCalledTimes(2);
      expect(rebuilt.getSelectedDyes()).toEqual([mockDyes[0], mockDyes[1]]);
    });
  });

  // ==========================================================================
  // BUG-018 (2026-10-04 deep-dive): the ΔE2000 readout row classified its
  // value without tierFor's 0 -> 1 bump, so with the match line below the
  // first ΔE2000 cut (5) a pair between the two read CLOSE in the verdict and
  // SAME on the row beneath it.
  // ==========================================================================

  describe('the ΔE2000 readout row tiers as the verdict does', () => {
    beforeEach(resetStorageReads);

    afterEach(async () => {
      const { ColorService } = await import('@services/index');
      vi.mocked(ColorService.getDistanceForMethod).mockImplementation(() => 15);
    });

    /** ΔE2000 reads `de2000` for every pair; every other method reads 15. */
    const setDistances = async (de2000: number) => {
      const { ColorService } = await import('@services/index');
      vi.mocked(ColorService.getDistanceForMethod).mockImplementation((_a, _b, method) =>
        method === 'ciede2000' ? de2000 : 15
      );
    };

    const mountPair = (matchThreshold: number): ComparisonTool => {
      const t = new ComparisonTool(container, { leftPanel, rightPanel });
      t.init();
      t.setConfig({ matchThreshold });
      t.selectDye(mockDyes[0]);
      t.selectDye(mockDyes[1]);
      return t;
    };

    /**
     * One method's readout tile: tag, value, tier word. The tag comes from
     * metric-help, which reads the real LanguageService, so it is matched
     * through the same helper rather than a key.
     */
    const readoutRow = (method: 'ciede2000' | 'oklab'): HTMLButtonElement | undefined =>
      [...rightPanel.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(
        (b) => b.firstElementChild?.textContent === methodShort(method)
      );

    const rowTier = (method: 'ciede2000' | 'oklab') =>
      readoutRow(method)?.lastElementChild?.textContent;

    const BADGES = ['comparison.badgeSame', 'comparison.badgeClose', 'comparison.badgeWide'];
    const verdictBadge = () =>
      [...rightPanel.querySelectorAll('span')]
        .map((s) => s.textContent)
        .find((t) => BADGES.includes(t ?? ''));

    it('reads CLOSE beside a CLOSE verdict when the match line sits below 5', async () => {
      await setDistances(3);

      tool = mountPair(2);

      expect(verdictBadge()).toBe('comparison.badgeClose');
      expect(rowTier('ciede2000')).toBe('comparison.tierClose');
    });

    it('keeps the ΔE2000 row on the match line while another method is active', async () => {
      await setDistances(3);
      tool = mountPair(2);

      readoutRow('oklab')!.click();

      expect(readoutRow('oklab')!.getAttribute('aria-pressed')).toBe('true');
      expect(rowTier('ciede2000')).toBe('comparison.tierClose');
    });

    it('agrees on SAME below a match line raised past the first cut', async () => {
      await setDistances(6);

      tool = mountPair(8);

      expect(verdictBadge()).toBe('comparison.badgeSame');
      expect(rowTier('ciede2000')).toBe('comparison.tierSame');
    });
  });

  /** The two dyes the duel is showing, by id, left then right. */
  const duelDyeIds = (root: HTMLElement): number[] =>
    [...root.querySelectorAll('v4-result-card')]
      .filter((card) => !card.closest('.comparison-cards-container'))
      .map((card) => (card as unknown as { data: { dye: { id: number } } }).data.dye.id);

  // ==========================================================================
  // BUG-085 (2026-10-04 deep-dive): the duel held its pair as list indices.
  // Removing a dye shifts every later index, and a stored pair still in range
  // then named two different dyes — the one the user kept left the duel.
  // ==========================================================================

  describe('the duel keeps its dyes when the list shrinks', () => {
    beforeEach(resetStorageReads);

    afterEach(async () => {
      const { ColorService } = await import('@services/index');
      vi.mocked(ColorService.getDistanceForMethod).mockImplementation(() => 15);
    });

    const [A, B, C, D] = mockDyes;

    /**
     * B×D is the closest pair, so a pair that is reset (or read by stale
     * index) lands on it; B×C is closer than C×D, so C's nearest partner is B;
     * A×B is A's only close pair, so A's nearest partner is B.
     */
    const setDistances = async () => {
      const { ColorService } = await import('@services/index');
      const table: Record<string, number> = {
        [`${B.hex}|${D.hex}`]: 2,
        [`${A.hex}|${B.hex}`]: 8,
        [`${B.hex}|${C.hex}`]: 10,
        [`${C.hex}|${D.hex}`]: 12,
      };
      vi.mocked(ColorService.getDistanceForMethod).mockImplementation(
        (a: string, b: string) => table[`${a}|${b}`] ?? table[`${b}|${a}`] ?? 20
      );
    };

    const pairChip = (a: (typeof mockDyes)[number], b: (typeof mockDyes)[number]) =>
      [...rightPanel.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find((chip) =>
        chip.textContent?.includes(`Dye-${a.itemID} × Dye-${b.itemID}`)
      );

    /** Fires Remove on the duel card showing `dye`. */
    const removeFromDuel = (dye: (typeof mockDyes)[number]) => {
      const card = [...rightPanel.querySelectorAll('v4-result-card')].find(
        (el) =>
          !el.closest('.comparison-cards-container') &&
          (el as unknown as { data: { dye: { id: number } } }).data.dye.id === dye.id
      )!;
      card.dispatchEvent(new CustomEvent('card-select'));
    };

    /** The bench chip for `dye` (pair chips carry aria-pressed; bench chips do not). */
    const benchChip = (dye: (typeof mockDyes)[number]) =>
      rightPanel.querySelector<HTMLButtonElement>(
        `button[title="Dye-${dye.itemID}"]:not([aria-pressed])`
      );

    it('keeps the surviving member when the other is removed from its card', async () => {
      await setDistances();
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();
      for (const dye of [A, B, C, D]) tool.selectDye(dye);
      pairChip(A, C)!.click();
      expect(duelDyeIds(rightPanel)).toEqual([A.id, C.id]);

      removeFromDuel(A);

      // C moves to the left side, beside its closest remaining dye
      expect(duelDyeIds(rightPanel)).toEqual([C.id, B.id]);
    });

    it('keeps the left member on the left when the right one is removed', async () => {
      await setDistances();
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();
      for (const dye of [A, B, C, D]) tool.selectDye(dye);
      pairChip(A, C)!.click();
      expect(duelDyeIds(rightPanel)).toEqual([A.id, C.id]);

      removeFromDuel(C);

      // A stays left, beside its closest remaining dye — not the reset pair
      // (B×D) nor the stale-index read (A, D)
      expect(duelDyeIds(rightPanel)).toEqual([A.id, B.id]);
    });

    it('a bench swap after a re-pair replaces the auto-picked partner, not the kept dye', async () => {
      await setDistances();
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();
      for (const dye of [A, B, C, D]) tool.selectDye(dye);
      pairChip(A, C)!.click();
      removeFromDuel(A);
      expect(duelDyeIds(rightPanel)).toEqual([C.id, B.id]);

      // The bench chip replaces the pair's second member: B, the partner the
      // tool picked, goes back to the bench and C — the dye the user kept — stays
      benchChip(D)!.click();

      expect(duelDyeIds(rightPanel)).toEqual([C.id, D.id]);
    });

    it('keeps both members when a dye outside the pair leaves the list', async () => {
      await setDistances();
      const selectorInit = vi.spyOn(DyeSelector.prototype, 'init');
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();
      for (const dye of [A, B, C, D]) tool.selectDye(dye);
      pairChip(C, D)!.click();
      expect(duelDyeIds(rightPanel)).toEqual([C.id, D.id]);

      // The selector deselects A: the list becomes B, C, D
      const selector = selectorInit.mock.contexts[0] as unknown as {
        container: HTMLElement;
        selectedDyes: unknown[];
      };
      selector.selectedDyes = [B, C, D];
      selector.container.dispatchEvent(new Event('selection-changed'));

      expect(duelDyeIds(rightPanel)).toEqual([C.id, D.id]);
    });
  });

  // ==========================================================================
  // BUG-086 (2026-10-04 deep-dive): the cards drew the market row from the
  // tool's own Price option alone, but the service fetches nothing while the
  // global Market Board toggle is off (its default) — so the row read "—"
  // forever on a fresh profile.
  // ==========================================================================

  describe('the market row follows the Market Board toggle', () => {
    beforeEach(resetStorageReads);

    afterEach(async () => {
      const { MarketBoardService } = await import('@services/index');
      vi.mocked(MarketBoardService.getInstance().getShowPrices).mockReturnValue(false);
    });

    const cardsShowPrice = (root: HTMLElement): boolean[] =>
      [...root.querySelectorAll('v4-result-card')].map(
        (card) => (card as unknown as { showPrice: boolean }).showPrice
      );

    it('hides the row on the single-dye card while the toggle is off', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);

      expect(cardsShowPrice(rightPanel)).toEqual([false]);
    });

    it('hides the row on the duel cards, then shows it once the toggle is on', async () => {
      const { MarketBoardService } = await import('@services/index');
      const { setupMarketBoardListeners } = await import('@services/pricing-mixin');
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();
      tool.selectDye(mockDyes[0]);
      tool.selectDye(mockDyes[1]);
      const duelShowPrice = () =>
        [...rightPanel.querySelectorAll('v4-result-card')]
          .filter((card) => !card.closest('.comparison-cards-container'))
          .map((card) => (card as unknown as { showPrice: boolean }).showPrice);
      expect(duelShowPrice()).toEqual([false, false]);

      // The global toggle goes on: the market board relays it to the tool
      vi.mocked(MarketBoardService.getInstance().getShowPrices).mockReturnValue(true);
      const listeners = vi.mocked(setupMarketBoardListeners).mock.calls[0][3]!;
      listeners.onPricesToggled!();
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));

      expect(duelShowPrice()).toEqual([true, true]);
    });

    // The tool adds no ConfigController 'market' subscription of its own: a
    // toggle reaches it as the MarketBoard's bubbling showPricesChanged relay,
    // heard on the market content. In v4 the left and right panels are one
    // element, so renderRightPanel detaches that content — the listener must
    // still hear the relay there. Runs the real setupMarketBoardListeners;
    // the MarketBoard itself is still the stub, so the relay is dispatched by
    // hand from inside the board's container.
    it('hears the relayed toggle on the market content the shared v4 panel detached', async () => {
      const { MarketBoardService } = await import('@services/index');
      const { setupMarketBoardListeners } = await import('@services/pricing-mixin');
      const actual =
        await vi.importActual<typeof import('@services/pricing-mixin')>('@services/pricing-mixin');
      vi.mocked(setupMarketBoardListeners).mockImplementationOnce(actual.setupMarketBoardListeners);
      const boardInit = vi.spyOn(MarketBoard.prototype, 'init');

      const shared = leftPanel;
      tool = new ComparisonTool(container, { leftPanel: shared, rightPanel: shared });
      tool.init();
      tool.selectDye(mockDyes[0]);
      tool.selectDye(mockDyes[1]);
      const duelShowPrice = () =>
        [...shared.querySelectorAll('v4-result-card')]
          .filter((card) => !card.closest('.comparison-cards-container'))
          .map((card) => (card as unknown as { showPrice: boolean }).showPrice);
      expect(duelShowPrice()).toEqual([false, false]);

      // The board the left panel built, and the market content holding it,
      // are off the page once the right panel has cleared the shared element
      const marketContent = (boardInit.mock.contexts[0] as unknown as { container: HTMLElement })
        .container;
      expect(marketContent.isConnected).toBe(false);

      // The global toggle goes on; the board relays it as a bubbling event
      vi.mocked(MarketBoardService.getInstance().getShowPrices).mockReturnValue(true);
      marketContent
        .querySelector('.market-board')!
        .dispatchEvent(
          new CustomEvent('showPricesChanged', { bubbles: true, detail: { showPrices: true } })
        );
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));

      expect(duelShowPrice()).toEqual([true, true]);
    });
  });

  // ==========================================================================
  // BUG-087 (2026-10-04 deep-dive): Share was enabled for any selection, but
  // custom colours never enter a share link — an all-custom selection built
  // dyes: [] and the button failed validation with an error on click.
  // ==========================================================================

  describe('Share with custom colours', () => {
    beforeEach(resetStorageReads);

    const shareButton = () =>
      rightPanel.querySelector('v4-share-button') as unknown as {
        disabled: boolean;
        shareParams: Record<string, unknown>;
      };

    it('is disabled when every colour is custom', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectCustomColor('#123456');
      tool.selectCustomColor('#654321');

      expect(shareButton().disabled).toBe(true);
      expect(shareButton().shareParams).not.toHaveProperty('dyes');
    });

    it('shares only the dyes of a mixed selection', () => {
      tool = new ComparisonTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectCustomColor('#123456');
      tool.selectDye(mockDyes[0]);

      expect(shareButton().disabled).toBe(false);
      expect(shareButton().shareParams.dyes).toEqual([mockDyes[0].stainID]);
    });
  });
});
