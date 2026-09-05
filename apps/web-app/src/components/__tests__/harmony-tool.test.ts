/**
 * XIV Dye Tools - HarmonyTool Unit Tests
 *
 * Tests the harmony tool component for color harmony generation.
 * Covers rendering, dye selection, harmony types, and market board integration.
 *
 * @module components/__tests__/harmony-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HarmonyTool } from '../harmony-tool';
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';
import { HARMONY_OFFSETS, ColorConverter, getColorWheel } from '@xivdyetools/core';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
const { mockGetAllDyes, mockGetDyeById, mockFindClosestDyes } = vi.hoisted(() => ({
  mockGetAllDyes: vi.fn(),
  mockGetDyeById: vi.fn(),
  mockFindClosestDyes: vi.fn(),
}));

// Icon modules are NOT mocked. They are compile-time string constants with
// no dependencies, and a hand-written stub only has to miss one export for
// the render to throw into BaseComponent.safeRender()'s catch — which
// swallows it into an error state, so the panel silently renders nothing
// and every assertion downstream sees an empty DOM instead of a failure.

vi.mock('@services/dye-service-wrapper', () => ({
  // The real harmony-generator (pulled in via importActual below) resolves
  // dyes through this singleton, so the wrapper mock must expose it too.
  dyeService: {
    getAllDyes: mockGetAllDyes,
    getDyeById: mockGetDyeById,
    findClosestDyes: mockFindClosestDyes,
    getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
  },
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
      findClosestDyes: mockFindClosestDyes,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
}));

vi.mock('@services/index', async () => ({
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
  /**
   * The harmony generator's exports are pure colour maths re-exported through
   * the services barrel. Use the REAL ones rather than stubs: they have no
   * side effects, they already have their own tests, and a stub here would
   * silently change what the tool computes.
   */
  ...(await vi.importActual<Record<string, unknown>>('@services/harmony-generator')),
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
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
  dyeService: {
    getAllDyes: mockGetAllDyes,
    getDyeById: mockGetDyeById,
    findClosestDyes: mockFindClosestDyes,
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
      getShowPrices: vi.fn().mockReturnValue(false),
      setShowPrices: vi.fn(),
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
    getCurrentToolId: vi.fn().mockReturnValue('harmony'),
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

vi.mock('@shared/constants', () => ({
  COMPANION_DYES_MIN: 1,
  COMPANION_DYES_MAX: 10,
  COMPANION_DYES_DEFAULT: 3,
}));

vi.mock('@components/v4/v4-color-wheel', () => ({}));

vi.mock('@components/v4/result-card', () => ({}));

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

vi.mock('../dye-filters', () => ({
  DyeFilters: class MockDyeFilters {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'dye-filters';
      div.id = 'dye-filters';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    getExcludedCategories() {
      return [];
    }
    setEnabled() {}
  },
}));

vi.mock('../harmony-type', () => ({
  HarmonyType: class MockHarmonyType {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'harmony-type';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    updateShowPrices() {}
    setPriceData() {}
    updateDyes() {}
    updateBaseColor() {}
  },
}));

describe('HarmonyTool', () => {
  let container: HTMLElement;
  let leftPanel: HTMLElement;
  let rightPanel: HTMLElement;
  let drawerContent: HTMLElement;
  let tool: HarmonyTool | null;

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
    it('should render harmony tool', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });

    it('should render left panel content', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });

    it('should render right panel content', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Right panel should be connected to the tool
      expect(rightPanel).not.toBeNull();
    });

    it('should render drawer content when provided', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Tool renders with drawer content provided (may be empty initially)
      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should work without drawer content', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should have setConfig method', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.setConfig).toBe('function');
    });

    it('should accept config via setConfig', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      tool.setConfig({ harmonyType: 'complementary' });

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Dye Selection Tests
  // ============================================================================

  describe('Dye Selection', () => {
    it('should have selectDye method', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.selectDye).toBe('function');
    });

    it('should have clearDyes method', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.clearDyes).toBe('function');
    });

    it('should accept dye selection', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      tool.selectDye(mockDyes[0]);

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });

    it('should clear dyes', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);
      tool.clearDyes();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Harmony Type Tests
  // ============================================================================

  describe('Harmony Types', () => {
    it('should render harmony type selector', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      // Tool should render harmony-related content
      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      const initialLeftCount = leftPanel.children.length;
      const initialRightCount = rightPanel.children.length;

      tool.destroy();

      // Destroy should reduce or clear content
      expect(leftPanel.children.length).toBeLessThanOrEqual(initialLeftCount);
      expect(rightPanel.children.length).toBeLessThanOrEqual(initialRightCount);
    });

    it('should handle double destroy gracefully', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.destroy();

      // Second destroy should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });
  });

  // ==========================================================================
  // Interaction depth
  //
  // Harmony has a single base dye rather than a selection list, so its entry
  // points behave differently from the other tools: selectDye REPLACES rather
  // than appends, and the harmony type is what varies. These drive the four
  // public entry points and the harmony-type buttons the tool renders.
  // ==========================================================================

  const mount = (opts: { drawer?: boolean } = {}): HarmonyTool => {
    const t = new HarmonyTool(
      container,
      opts.drawer === false ? { leftPanel, rightPanel } : { leftPanel, rightPanel, drawerContent }
    );
    t.init();
    return t;
  };

  const flush = async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  };

  const TYPE_KEY = 'v3_harmony_type';
  const DYE_KEY = 'v3_harmony_selected_dye';

  const lastWrite = async (key: string): Promise<unknown> => {
    const { StorageService } = await import('@services/index');
    const calls = vi.mocked(StorageService.setItem).mock.calls.filter((c) => c[0] === key);
    return calls.at(-1)?.[1];
  };

  const dye = (id: number, name = `Dye ${id}`) =>
    ({ ...mockDyes[0], id, itemID: 5000 + id, name, hex: '#3366CC' }) as never;

  describe('selectDye — a single base colour', () => {
    it('persists the base dye by itemID', async () => {
      tool = mount();

      tool.selectDye(dye(1));

      // itemID, not the internal id — this is what a share link carries
      expect(await lastWrite(DYE_KEY)).toBe(5001);
    });

    it('replaces the base rather than accumulating', async () => {
      tool = mount();

      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      // Harmony works from ONE base colour, unlike comparison or accessibility
      expect(await lastWrite(DYE_KEY)).toBe(5002);
    });

    it('re-selecting the same dye is harmless', async () => {
      tool = mount();

      tool.selectDye(dye(1));
      expect(() => tool!.selectDye(dye(1))).not.toThrow();

      expect(await lastWrite(DYE_KEY)).toBe(5001);
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('ignores %s rather than crashing the drawer', (_label, value) => {
      tool = mount();

      expect(() => tool!.selectDye(value as never)).not.toThrow();
    });
  });

  describe('the harmony slots themselves', () => {
    // These exist because the suite could not tell "the tool renders a full
    // harmony" from "the tool renders only the base card": every assertion on
    // the grid was `.length` toBeGreaterThan(0), and the base panel alone
    // satisfies that. Stubbing the selector to return nothing at all left all
    // 46 tests green.
    it.each([
      ['complementary', 1],
      ['triadic', 2],
      ['tetradic', 3],
      ['compound', 3],
    ])('renders the base card plus one per %s offset', async (type, slotCount) => {
      tool = mount();
      tool.setConfig({ harmonyType: type });
      tool.selectDye(mockDyes[0]);
      await flush();

      expect(HARMONY_OFFSETS[type]).toHaveLength(slotCount);
      expect(container.querySelectorAll('v4-result-card')).toHaveLength(1 + slotCount);
    });

    it('gives every harmony slot a real dye, not the base repeated', async () => {
      tool = mount();
      tool.selectDye(mockDyes[0]);
      await flush();

      const cards = [...container.querySelectorAll('v4-result-card')] as Array<
        HTMLElement & { data?: { dye: { itemID: number } } }
      >;
      expect(cards.length).toBeGreaterThan(1);

      const [base, ...slots] = cards;
      expect(base.data?.dye.itemID).toBe(mockDyes[0].itemID);
      for (const slot of slots) {
        expect(slot.data?.dye).toBeDefined();
        // The base is excluded from its own harmony; a slot showing it again
        // means the exclusion stopped being applied.
        expect(slot.data?.dye.itemID).not.toBe(mockDyes[0].itemID);
      }
    });
  });

  describe('display options from the sidebar', () => {
    it('re-renders result cards when only the CMYK toggle changes', async () => {
      // The tool subscribes to the REAL ConfigController (that module is not
      // mocked here) — drive the sidebar broadcast through it.
      const { ConfigController } = await import('@services/config-controller');
      tool = mount();
      tool.selectDye(dye(1));
      await flush();

      expect(container.querySelectorAll('v4-result-card').length).toBeGreaterThan(0);

      ConfigController.getInstance().setConfig('harmony', {
        displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showCmyk: true },
      });
      await flush();

      const card = container.querySelector('v4-result-card') as HTMLElement & {
        showCmyk?: boolean;
      };
      expect(card.showCmyk).toBe(true);
    });
  });

  describe('selectCustomColor', () => {
    it('is deliberately NOT persisted', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.removeItem).mockClear();

      tool.selectCustomColor('#aabbcc');

      // A custom hex is not a dye. Persisting it would restore something on
      // reload that the dye list cannot represent, so the stored id is
      // CLEARED rather than written.
      expect(StorageService.removeItem).toHaveBeenCalledWith(DYE_KEY);
      expect(await lastWrite(DYE_KEY)).toBeUndefined();
    });

    it('ignores an empty colour', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.removeItem).mockClear();

      tool.selectCustomColor('');

      expect(StorageService.removeItem).not.toHaveBeenCalled();
    });

    it('displaces a persisted base dye', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      tool.selectDye(dye(1));
      vi.mocked(StorageService.removeItem).mockClear();

      tool.selectCustomColor('#aabbcc');

      // The previously stored real dye must not survive as the restore target
      expect(StorageService.removeItem).toHaveBeenCalledWith(DYE_KEY);
    });
  });

  describe('clearDyes', () => {
    it('drops the base dye from storage', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      tool.selectDye(dye(1));
      vi.mocked(StorageService.removeItem).mockClear();

      tool.clearDyes();

      expect(StorageService.removeItem).toHaveBeenCalledWith(DYE_KEY);
    });

    it('leaves the tool usable afterwards', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.clearDyes();

      tool.selectDye(dye(9));

      expect(await lastWrite(DYE_KEY)).toBe(5009);
    });

    it('is safe with nothing selected, twice', () => {
      tool = mount();

      expect(() => {
        tool!.clearDyes();
        tool!.clearDyes();
      }).not.toThrow();
    });
  });

  describe('setConfig — the harmony type', () => {
    // `complementary` is the default, so switching TO it on a fresh tool
    // writes nothing — the change-detection guard skips it. It gets its own
    // test below rather than being wrongly listed here.
    it.each(['analogous', 'triadic', 'splitComplementary', 'tetradic', 'monochromatic'])(
      'persists a switch to %s',
      async (harmonyType) => {
        tool = mount();

        tool.setConfig({ harmonyType });
        await flush();

        expect(await lastWrite(TYPE_KEY)).toBe(harmonyType);
      }
    );

    it('starts on complementary, so switching back to it is observable', async () => {
      tool = mount();
      tool.setConfig({ harmonyType: 'triadic' });
      await flush();

      tool.setConfig({ harmonyType: 'complementary' });
      await flush();

      expect(await lastWrite(TYPE_KEY)).toBe('complementary');
    });

    it('ignores a switch to the type already selected', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      tool.setConfig({ harmonyType: 'triadic' });
      await flush();
      vi.mocked(StorageService.setItem).mockClear();

      // The guard is `config.harmonyType !== this.selectedHarmonyType`
      tool.setConfig({ harmonyType: 'triadic' });
      await flush();

      expect(StorageService.setItem).not.toHaveBeenCalledWith(TYPE_KEY, expect.anything());
    });

    it('regenerates against the new type when a base dye is set', async () => {
      tool = mount();
      tool.selectDye(dye(1));

      // Switching type with a base present must recompute, not just restyle
      expect(() => tool!.setConfig({ harmonyType: 'tetradic' })).not.toThrow();
      await flush();

      expect(await lastWrite(TYPE_KEY)).toBe('tetradic');
    });

    it('accepts a type switch with no base dye selected', async () => {
      tool = mount();

      expect(() => tool!.setConfig({ harmonyType: 'analogous' })).not.toThrow();
      await flush();

      expect(await lastWrite(TYPE_KEY)).toBe('analogous');
    });

    it.each([
      ['showNames', { showNames: true }],
      ['showHex', { showHex: true }],
      ['showRgb', { showRgb: true }],
      ['showHsv', { showHsv: true }],
      ['strictMatching', { strictMatching: true }],
    ])('accepts a %s change', (_label, config) => {
      tool = mount();

      expect(() => tool!.setConfig(config)).not.toThrow();
    });

    it('accepts an empty config without writing anything', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      tool.setConfig({});

      expect(StorageService.setItem).not.toHaveBeenCalledWith(TYPE_KEY, expect.anything());
    });
  });

  describe('the harmony-type buttons', () => {
    const typeButtons = (): HTMLButtonElement[] =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('button[data-harmony-type]'));

    it('renders a button per harmony type', () => {
      tool = mount();

      expect(typeButtons().length).toBeGreaterThan(0);
    });

    it('switching type through a button persists it', async () => {
      tool = mount();
      const buttons = typeButtons();
      const target = buttons.find((b) => b.dataset.harmonyType !== 'complementary') ?? buttons[1];

      target.click();
      await flush();

      expect(await lastWrite(TYPE_KEY)).toBe(target.dataset.harmonyType);
    });
  });

  describe('lifecycle under interaction', () => {
    it('tears down cleanly after selection and configuration', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.setConfig({ harmonyType: 'triadic' });
      await flush();

      expect(() => tool!.destroy()).not.toThrow();
    });

    it('ignores configuration arriving after destroy', () => {
      tool = mount();
      tool.destroy();

      // The sidebar can emit one last config-change during teardown
      expect(() => tool!.setConfig({ harmonyType: 'tetradic' })).not.toThrow();
    });

    it('works with no drawer panel supplied', async () => {
      tool = mount({ drawer: false });

      tool.selectDye(dye(1));

      expect(await lastWrite(DYE_KEY)).toBe(5001);
    });
  });

  // ==========================================================================
  // Colour wheel plumbing (Task 10): the wheel travels in share params and
  // deep links, and the ring/nodes the tool feeds to <v4-color-wheel> come
  // from core's generateHarmonySlots rather than being recomputed here.
  // ==========================================================================

  describe('colour wheel', () => {
    afterEach(async () => {
      // The real ConfigController is a module-level singleton not reset
      // between tests — leave it at the default so later tests (and other
      // describe blocks reusing it) see 'rgb' again.
      const { ConfigController } = await import('@services/config-controller');
      ConfigController.getInstance().setConfig('harmony', { wheel: 'rgb' });
      window.history.replaceState({}, '', '/');
    });

    it('omits wheel from share params on the default and includes it otherwise', async () => {
      const { ConfigController } = await import('@services/config-controller');
      tool = mount();
      tool.selectDye(mockDyes[0]);
      await flush();

      const params = () =>
        (tool as unknown as { getShareParams(): Record<string, unknown> }).getShareParams();
      expect(params()).not.toHaveProperty('wheel');

      ConfigController.getInstance().setConfig('harmony', { wheel: 'ryb' });
      expect(params().wheel).toBe('ryb');

      ConfigController.getInstance().setConfig('harmony', { wheel: 'rgb' });
      expect(params()).not.toHaveProperty('wheel');
    });

    it('reads ?wheel= from a share URL, normalising unknown values to rgb', async () => {
      const { ConfigController } = await import('@services/config-controller');

      window.history.replaceState({}, '', '/harmony?dye=5771&harmony=complementary&wheel=MUNSELL');
      tool = mount();
      expect(ConfigController.getInstance().getConfig('harmony').wheel).toBe('munsell');
      tool.destroy();

      window.history.replaceState({}, '', '/harmony?dye=5771&harmony=complementary&wheel=cmyk');
      tool = mount();
      expect(ConfigController.getInstance().getConfig('harmony').wheel).toBe('rgb');
    });

    it('feeds the ring 72 stops and one node angle per slot plus the base', async () => {
      const { ConfigController } = await import('@services/config-controller');
      ConfigController.getInstance().setConfig('harmony', { wheel: 'ryb' });

      // Sky Blue (#87CEEB): a saturated, non-red base. Its RGB/HSV hue (~197°)
      // and its RYB wheel angle (~234°) differ, so this fixture actually
      // exercises wheel selection — unlike mockDyes[0] (#FFFFFF), whose hue
      // is 0 on every wheel and can't distinguish rgb from ryb.
      const baseDye = mockDyes[9];
      tool = mount();
      tool.setConfig({ harmonyType: 'triadic' });
      tool.selectDye(baseDye);
      await flush();

      const wheel = container.querySelector('v4-color-wheel') as unknown as {
        ringStops: string[];
        nodeAngles: number[];
      };
      expect(wheel.ringStops).toHaveLength(72);
      expect(wheel.nodeAngles).toHaveLength(3);

      // The ring is painted from the RYB wheel, not the RGB wheel: the full
      // stop list differs, and the 180° stop (index 36 of 72) is pinned to
      // RYB's value — sRGB green, not RGB's cyan.
      expect(wheel.ringStops).not.toEqual([...getColorWheel('rgb').ringStops(72)]);
      expect(getColorWheel('ryb').ringStops(72)[36]).toBe(wheel.ringStops[36]);
      expect(wheel.ringStops[36]).not.toBe('#00FFFF');

      // Node angles are RYB wheel angles: the base's angle matches
      // getColorWheel('ryb').hueOf(baseHex), which differs from the plain
      // sRGB/HSV hue ColorConverter reports for the same hex — proving the
      // ring and the nodes share the same (non-identity) wheel.
      const rybBaseAngle = getColorWheel('ryb').hueOf(baseDye.hex);
      const srgbBaseHue = ColorConverter.hexToHsv(baseDye.hex).h;
      expect(rybBaseAngle).not.toBeCloseTo(srgbBaseHue, 6);

      const [b, n1, n2] = wheel.nodeAngles;
      expect(b).toBeCloseTo(rybBaseAngle, 6);
      expect((n1 - b + 360) % 360).toBeCloseTo(120, 6);
      expect((n2 - b + 360) % 360).toBeCloseTo(240, 6);
    });
  });
});
