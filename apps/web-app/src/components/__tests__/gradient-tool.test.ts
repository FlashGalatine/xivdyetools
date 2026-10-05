/**
 * XIV Dye Tools - GradientTool Unit Tests
 *
 * Tests the gradient tool component for creating color gradients.
 * Covers rendering, gradient stops, interpolation modes, and step count.
 *
 * @module components/__tests__/gradient-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GradientTool } from '../gradient-tool';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';
// The barrel is mocked below; the tool reads ConfigController through it
import { ConfigController, dyeService, StorageService } from '@services/index';
// The module itself is NOT mocked — this is the real controller, backed by
// the real StorageService and jsdom localStorage
import { ConfigController as RealConfigController } from '@services/config-controller';
import { DEFAULT_DISPLAY_OPTIONS, DEFAULT_DYE_FILTERS } from '@shared/tool-config-types';
import type { Dye } from '@xivdyetools/types';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
const { mockGetAllDyes, mockGetDyeById, mockFindClosestDyes, fakeConfigController } = vi.hoisted(
  () => ({
    mockGetAllDyes: vi.fn(),
    mockGetDyeById: vi.fn(),
    mockFindClosestDyes: vi.fn(),
    /**
     * The barrel's ConfigController. setConfig must exist: the tool writes
     * in-tool picks and validated share settings through it (BUG-019).
     */
    fakeConfigController: {
      getConfig: vi.fn((): Record<string, unknown> => ({})),
      setConfig: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    },
  })
);

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
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
  // The (unmocked) ShareService resolves shared stainIDs through this
  // singleton — without it, a `start=`/`end=` share param throws on load.
  dyeService: {
    getByStainId: (id: number) => mockDyes.find((d) => d.stainID === id) ?? null,
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
  ToastService: {
    show: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
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
    findClosestDye: vi.fn().mockReturnValue(null),
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
    getInstance: vi.fn(() => fakeConfigController),
  },
  CollectionService: {
    getFavorites: vi.fn().mockReturnValue([]),
    subscribeFavorites: vi.fn().mockReturnValue(() => {}),
    isFavorite: vi.fn().mockReturnValue(false),
  },
  RouterService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    getCurrentToolId: vi.fn().mockReturnValue('gradient'),
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

describe('GradientTool', () => {
  let container: HTMLElement;
  let leftPanel: HTMLElement;
  let rightPanel: HTMLElement;
  let drawerContent: HTMLElement;
  let tool: GradientTool | null;

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
    // vi.clearAllMocks() keeps implementations, and restoreAllMocks() does not
    // reset vi.fn ones in Vitest 5, so a per-test override is undone here
    vi.mocked(ConfigController.getInstance).mockImplementation(() => fakeConfigController as never);
    fakeConfigController.getConfig.mockImplementation(() => ({}));
    vi.mocked(dyeService.findClosestDye).mockReset().mockReturnValue(null);
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
    it('should render gradient tool', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });

    it('should render left panel content', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });

    it('should render right panel content', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(rightPanel).not.toBeNull();
    });

    it('should render drawer content when provided', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(drawerContent).not.toBeNull();
    });

    it('should work without drawer content', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should have setConfig method', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.setConfig).toBe('function');
    });

    it('should accept config via setConfig', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      tool.setConfig({ stepCount: 10 });

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Dye Selection Tests
  // ============================================================================

  describe('Dye Selection', () => {
    it('should have selectDye method', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.selectDye).toBe('function');
    });

    it('should have clearDyes method', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.clearDyes).toBe('function');
    });

    it('should accept dye selection', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      expect(() => tool!.selectDye(mockDyes[0])).not.toThrow();
    });

    it('should clear dyes', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);

      // Should not throw
      expect(() => tool!.clearDyes()).not.toThrow();
    });

    it('should support two dyes for gradient', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw when adding two dyes
      expect(() => {
        tool!.selectDye(mockDyes[0]);
        tool!.selectDye(mockDyes[1]);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Interpolation Tests
  // ============================================================================

  describe('Interpolation', () => {
    it('should render interpolation controls', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel });
      tool.init();

      // Tool should render gradient-related content
      expect(rightPanel).not.toBeNull();
    });
  });

  // ============================================================================
  // Interpolated summary strings (HC-SYS-009)
  // ============================================================================

  describe('drift summary and pin badge — one key, not label + number', () => {
    it('prints the average drift through gradient.avgDriftValue', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      await flush();

      // The number lives inside the key's value, so a language that puts the
      // unit first can still order it: "avg ΔE 4.1" vs "ΔE moyen 4,1".
      expect(container.textContent).toContain('gradient.avgDriftValue:');
      expect(container.textContent).not.toContain('gradient.avgDrift:');
    });

    it('prints the worst step through gradient.maxDriftValue', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      await flush();

      expect(container.textContent).toContain('gradient.maxDriftValue:');
      expect(container.textContent).not.toContain('gradient.maxDrift:');
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });

    it('should handle double destroy gracefully', () => {
      tool = new GradientTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.destroy();

      // Second destroy should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });
  });

  // ==========================================================================
  // Interaction depth
  //
  // Gradient has exactly TWO endpoints, and `selectDye` implements a shift
  // model on top of them: fill start, then end, then push new picks in at the
  // start and shove the old start along to the end. Picking a dye that is
  // already an endpoint does something different again. None of that was
  // covered, and it is the behaviour a user drives every time they touch the
  // palette drawer.
  // ==========================================================================

  const mount = (opts: { drawer?: boolean } = {}): GradientTool => {
    const t = new GradientTool(
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

  const DYES_KEY = 'v3_mixer_selected_dyes';
  // The tool's own settings mirrors, retired by BUG-019: ConfigController owns
  // the step count and colour space now
  const RETIRED_SETTINGS_KEYS = ['v3_mixer_steps', 'v3_mixer_color_space'];

  const lastWrite = async (key: string): Promise<unknown> => {
    const { StorageService } = await import('@services/index');
    const calls = vi.mocked(StorageService.setItem).mock.calls.filter((c) => c[0] === key);
    return calls.at(-1)?.[1];
  };

  /** The [start, end] dye ids currently persisted. */
  const endpoints = () => lastWrite(DYES_KEY) as Promise<number[] | undefined>;

  const dye = (id: number, name = `Dye ${id}`) =>
    ({ ...mockDyes[0], id, itemID: 5000 + id, name, hex: '#123456' }) as never;

  const shareParams = () =>
    (container.querySelector('v4-share-button') as unknown as {
      shareParams: Record<string, unknown>;
      disabled: boolean;
    }) ?? null;

  /** The settings the tool is running with, as its share button reports them. */
  const settingsInEffect = () => {
    const { steps, interpolation, algo } = shareParams()!.shareParams;
    return { steps, interpolation, algo };
  };

  /** Mount with a share URL in the address bar; each describe restores it. */
  const mountAt = (search: string): GradientTool => {
    window.history.replaceState({}, '', `/gradient/${search}`);
    return mount();
  };

  type StepCard = HTMLElement & {
    data: { dye: Dye; matchingMethod: string };
    showHex: boolean;
    showRgb: boolean;
    showCmyk: boolean;
  };

  /** The rendered ramp, in step order: one card per step that matched a dye. */
  const stepCards = () =>
    [...container.querySelectorAll('v4-result-card[data-gradient-step]')] as StepCard[];

  /** The dyes matched between the two endpoints (every step here matches one). */
  const middleIds = () =>
    stepCards()
      .slice(1, -1)
      .map((card) => card.data.dye.id);

  /** Two endpoints and a dye for every middle step, so the whole ramp renders. */
  const mountWithRamp = async (): Promise<GradientTool> => {
    vi.mocked(dyeService.findClosestDye).mockReturnValue(mockDyes[0]);
    const t = mount();
    t.selectDye(dye(1));
    t.selectDye(dye(2));
    await flush();
    return t;
  };

  const pinsOf = (t: GradientTool) =>
    (t as unknown as { pinnedSteps: Map<number, Dye> }).pinnedSteps;

  /** A matcher that honours excludeIds, so the dedupe fallback can find another dye. */
  const matchFirstNotExcluded = () =>
    vi
      .mocked(dyeService.findClosestDye)
      .mockImplementation(
        (_hex: string, options?: { excludeIds?: number[] }) =>
          mockDyes.find((d) => !options?.excludeIds?.includes(d.id)) ?? null
      );

  describe('selectDye — the two endpoints', () => {
    it('fills the start endpoint first', async () => {
      tool = mount();

      tool.selectDye(dye(1));

      expect(await endpoints()).toEqual([1]);
    });

    it('fills the end endpoint second', async () => {
      tool = mount();

      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      expect(await endpoints()).toEqual([1, 2]);
    });

    it('shifts once both endpoints are taken: new pick becomes start', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      tool.selectDye(dye(3));

      // new -> start, old start -> end. The oldest endpoint falls off.
      expect(await endpoints()).toEqual([3, 1]);
    });

    it('keeps shifting on each further pick', async () => {
      tool = mount();
      for (const id of [1, 2, 3, 4]) tool.selectDye(dye(id));

      expect(await endpoints()).toEqual([4, 3]);
    });

    it('ignores re-picking the current start', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      tool.selectDye(dye(1));

      // Would otherwise shift start into end and leave the same dye twice
      expect(await endpoints()).toEqual([1, 2]);
    });

    it('swaps the ends when the current end is picked', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      tool.selectDye(dye(2));

      // A gradient from B to A is a different gradient, so this is a swap
      // rather than a no-op
      expect(await endpoints()).toEqual([2, 1]);
    });

    it('refuses to set the same dye at both ends', async () => {
      const { ToastService } = await import('@services/index');
      tool = mount();
      tool.selectDye(dye(1));

      tool.selectDye(dye(1));

      // A zero-length gradient is not a gradient — warn, do not accept
      expect(ToastService.warning).toHaveBeenCalled();
      expect(await endpoints()).toEqual([1]);
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('ignores %s rather than crashing the drawer', (_label, value) => {
      tool = mount();

      expect(() => tool!.selectDye(value as never)).not.toThrow();
    });
  });

  describe('selectCustomColor', () => {
    it('takes an endpoint like a real dye', async () => {
      tool = mount();

      tool.selectCustomColor('#aabbcc');

      expect(await endpoints()).toHaveLength(1);
    });

    it('ignores an empty colour', async () => {
      tool = mount();

      tool.selectCustomColor('');

      expect(await endpoints()).toBeUndefined();
    });

    it('can fill the second endpoint after a real dye', async () => {
      tool = mount();
      tool.selectDye(dye(1));

      tool.selectCustomColor('#aabbcc');

      expect(await endpoints()).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Share URL — 5.0 grammar: an endpoint is EITHER a stainID (`start`/`end`)
  // OR a bare colour (`hexStart`/`hexEnd`), never both. A custom endpoint
  // used to be written as `start=0`, which fails validation on the way out
  // and lost the colour on the way in.
  // ==========================================================================

  describe('share URL — custom endpoints', () => {
    afterEach(() => {
      window.history.replaceState({}, '', '/');
    });

    it('writes a custom start as hexStart and omits start', () => {
      tool = mount();
      tool.selectCustomColor('#aabbcc'); // start
      tool.selectDye(dye(2)); // end

      const share = shareParams();
      expect(share).not.toBeNull();
      const params = share!.shareParams;
      // The custom colour travels as its hex slot; its dye slot is absent
      // (mutually exclusive) — the pre-fix `start: 0` must be gone
      expect(String(params.hexStart).toLowerCase()).toBe('aabbcc');
      expect(params).not.toHaveProperty('start');
      expect(params.end).toBe(mockDyes[0].stainID);
      expect(params).not.toHaveProperty('hexEnd');
      expect(share!.disabled).toBe(false);
    });

    it('writes a real dye as its stainID and a custom end as hexEnd', () => {
      tool = mount();
      tool.selectDye(dye(2)); // start
      tool.selectCustomColor('#aabbcc'); // end

      const params = shareParams()!.shareParams;
      expect(params.start).toBe(mockDyes[0].stainID);
      expect(params).not.toHaveProperty('hexStart');
      expect(String(params.hexEnd).toLowerCase()).toBe('aabbcc');
      expect(params).not.toHaveProperty('end');
      // The pre-fix encoding must be gone
      expect(params.end).not.toBe(0);
    });

    it('reads hexStart as a custom start endpoint alongside a stainID end', async () => {
      tool = mountAt('?hexStart=aabbcc&end=2&v=1');

      // Round-trip: the loaded state writes back the same grammar
      const params = shareParams()!.shareParams;
      expect(String(params.hexStart).toLowerCase()).toBe('aabbcc');
      expect(params).not.toHaveProperty('start');
      expect(params.end).toBe(2);
      // and both endpoints are live in the tool
      expect(await endpoints()).toHaveLength(2);
    });

    it('reads two bare-colour endpoints', async () => {
      tool = mountAt('?hexStart=aabbcc&hexEnd=112233&v=1');

      const params = shareParams()!.shareParams;
      expect(String(params.hexStart).toLowerCase()).toBe('aabbcc');
      expect(String(params.hexEnd).toLowerCase()).toBe('112233');
      expect(params).not.toHaveProperty('start');
      expect(params).not.toHaveProperty('end');
      const ids = (await endpoints()) as number[];
      expect(ids).toHaveLength(2);
      // Two customs from one link must stay distinct endpoints
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('lets the stainID slot win when both start and hexStart are present', () => {
      tool = mountAt('?start=1&hexStart=aabbcc&end=2&v=1');

      const params = shareParams()!.shareParams;
      expect(params.start).toBe(1);
      expect(params).not.toHaveProperty('hexStart');
    });

    it('rejects a malformed hexStart loudly rather than loading a colour', async () => {
      const { ToastService } = await import('@services/toast-service');
      const toastError = vi.spyOn(ToastService, 'error');

      tool = mountAt('?hexStart=zzzzzz&end=2&v=1');

      expect(toastError).toHaveBeenCalled();

      const ids = (await endpoints()) as number[] | undefined;
      // Only the end endpoint loaded — the tool is not shareable yet
      expect(ids ?? []).toHaveLength(1);
      expect(shareParams()!.disabled).toBe(true);
    });

    it('still rejects a legacy itemID in start loudly', async () => {
      const { ToastService } = await import('@services/toast-service');
      const toastError = vi.spyOn(ToastService, 'error');

      tool = mountAt('?start=5729&end=2&v=1');

      const ids = (await endpoints()) as number[] | undefined;
      expect(ids ?? []).toHaveLength(1);
      expect(shareParams()!.disabled).toBe(true);
      expect(toastError).toHaveBeenCalled();
    });
  });

  describe('clearDyes', () => {
    it('drops both endpoints from storage', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      vi.mocked(StorageService.removeItem).mockClear();

      tool.clearDyes();

      expect(StorageService.removeItem).toHaveBeenCalledWith(DYES_KEY);
    });

    it('leaves the tool usable, starting again from the start endpoint', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      tool.clearDyes();

      tool.selectDye(dye(9));

      expect(await endpoints()).toEqual([9]);
    });

    it('is safe with nothing selected, twice', () => {
      tool = mount();

      expect(() => {
        tool!.clearDyes();
        tool!.clearDyes();
      }).not.toThrow();
    });
  });

  // setConfig is the ConfigController subscriber (and the v4-layout forward's
  // target), so it applies and never persists. BUG-011 (2026-10-04
  // deep-dive): these used to assert v3 storage writes or not.toThrow(); each
  // now asserts what the ramp does with the value.
  describe('setConfig', () => {
    it('applies a step-count change to the ramp', async () => {
      tool = await mountWithRamp();
      expect(stepCards()).toHaveLength(8);

      tool.setConfig({ stepCount: 5 });
      await flush();

      expect(stepCards()).toHaveLength(5);
      expect(settingsInEffect().steps).toBe(5);
    });

    it('clears the pins on a real step change and keeps them on a repeat', async () => {
      tool = await mountWithRamp();
      pinsOf(tool).set(3, mockDyes[1]);

      // 8 is the count in effect; the v4-layout forward re-delivers every
      // sidebar change, so a repeat must not cost the user their pins
      tool.setConfig({ stepCount: 8 });
      expect(pinsOf(tool).size).toBe(1);

      tool.setConfig({ stepCount: 12 });
      expect(pinsOf(tool).size).toBe(0);
    });

    it.each([
      [50, 12],
      [1, 3],
      [4.6, 5],
    ])('clamps a step count of %s to %s', async (sent, applied) => {
      tool = await mountWithRamp();

      // An imported config is type-checked only, so 50 can arrive here
      tool.setConfig({ stepCount: sent });
      await flush();

      expect(settingsInEffect().steps).toBe(applied);
      expect(stepCards()).toHaveLength(applied);
    });

    // -Infinity rather than Infinity: an unguarded +Infinity loops the ramp
    // builder until the worker dies, which reports nothing useful
    it.each([NaN, -Infinity, '12'])('ignores a step count of %s', async (sent) => {
      tool = await mountWithRamp();

      tool.setConfig({ stepCount: sent } as never);
      await flush();

      expect(settingsInEffect().steps).toBe(8);
    });

    it.each(['rgb', 'lab', 'oklch', 'lch'] as const)(
      'applies %s as the interpolation space',
      async (space) => {
        tool = await mountWithRamp();

        tool.setConfig({ interpolation: space });
        await flush();

        // The sidebar calls it `interpolation`; the tool calls it colorSpace
        expect(settingsInEffect().interpolation).toBe(space);
      }
    );

    it.each(['oklab', 'hsl', 'OKLCH', 42])(
      'ignores %s, which is not one of the five interpolation modes',
      async (space) => {
        tool = await mountWithRamp();

        tool.setConfig({ interpolation: space } as never);
        await flush();

        // An unknown mode fell through interpolateInSpace to a flat grey ramp
        expect(settingsInEffect().interpolation).toBe('hsv');
      }
    );

    it('re-matches only when the colour space actually changes', async () => {
      tool = await mountWithRamp();
      const rematch = vi.spyOn(
        tool as unknown as { updateInterpolation: () => void },
        'updateInterpolation'
      );

      // hsv is the default
      tool.setConfig({ interpolation: 'hsv' });
      expect(rematch).not.toHaveBeenCalled();

      tool.setConfig({ interpolation: 'lab' });
      expect(rematch).toHaveBeenCalledTimes(1);
    });

    it('dedupes consecutive steps only while preventDuplicates is on', async () => {
      matchFirstNotExcluded();
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      await flush();
      // On (the default): each middle step falls back to a dye not used yet
      expect(new Set(middleIds()).size).toBe(6);

      tool.setConfig({ preventDuplicates: false });
      await flush();

      expect(new Set(middleIds()).size).toBe(1);
    });

    // BUG-020 (2026-10-04 deep-dive): only the endpoints were spoken for
    // before the loop, and a pin joined them when the loop reached it — so a
    // free step BEFORE a pin could match the pinned dye. Re-anchoring makes
    // that the likely case: the step before a pin interpolates toward it.
    it('keeps a pinned dye out of every free step, before the pin as well as after', async () => {
      matchFirstNotExcluded();
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      // Dedupe off, so every middle step matches the same dye and the pins
      // below both hold it
      tool.setConfig({ preventDuplicates: false });
      await flush();
      const pinned = mockDyes[0].id;
      expect(middleIds()).toEqual(Array(6).fill(pinned));
      // Re-queried after each click: a pin re-renders the rail
      const pinButtons = () => [...container.querySelectorAll<HTMLButtonElement>('.v5-grad-pin')];
      pinButtons()[1].click(); // step 2
      pinButtons()[4].click(); // step 5

      tool.setConfig({ preventDuplicates: true });
      await flush();

      const middle = middleIds();
      // A pinned row is an explicit choice: never deduped, even against another pin
      expect([middle[1], middle[4]]).toEqual([pinned, pinned]);
      const free = [middle[0], middle[2], middle[3], middle[5]];
      expect(free).not.toContain(pinned);
      expect(new Set(free).size).toBe(4);
    });

    it('re-matches with a new matching method', async () => {
      tool = await mountWithRamp();

      tool.setConfig({ matchingMethod: 'oklab' });
      await flush();

      expect(settingsInEffect().algo).toBe('oklab');
      expect(stepCards().map((card) => card.data.matchingMethod)).toEqual(Array(8).fill('oklab'));
    });

    it('merges partial display options rather than replacing them', async () => {
      tool = await mountWithRamp();

      tool.setConfig({ displayOptions: { showHex: false } } as never);
      tool.setConfig({ displayOptions: { showCmyk: true } } as never);

      const card = stepCards()[0];
      expect(card.showHex).toBe(false);
      expect(card.showCmyk).toBe(true);
      // Untouched by either update
      expect(card.showRgb).toBe(true);
    });

    it('keeps an excluded dye out of the middle steps once a filter arrives', async () => {
      // Every middle step's nearest dye is Dalamud Red, the one metallic mock
      vi.mocked(dyeService.findClosestDye).mockReturnValue(mockDyes[8]);
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      await flush();
      expect(middleIds()).toContain(mockDyes[8].id);

      tool.setConfig({ dyeFilters: { ...DEFAULT_DYE_FILTERS, excludeMetallic: true } });
      await flush();

      expect(middleIds().length).toBeGreaterThan(0);
      expect(middleIds()).not.toContain(mockDyes[8].id);
    });

    it('applies without writing back to the controller it subscribes to', async () => {
      tool = await mountWithRamp();

      tool.setConfig({
        stepCount: 5,
        interpolation: 'lab',
        matchingMethod: 'oklab',
        preventDuplicates: false,
        displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showHex: false },
        dyeFilters: { ...DEFAULT_DYE_FILTERS, excludeMetallic: true },
      });
      await flush();

      expect(settingsInEffect()).toEqual({ steps: 5, interpolation: 'lab', algo: 'oklab' });
      expect(fakeConfigController.setConfig).not.toHaveBeenCalled();
    });

    it('does nothing with an empty config', async () => {
      tool = await mountWithRamp();
      const rematch = vi.spyOn(
        tool as unknown as { updateInterpolation: () => void },
        'updateInterpolation'
      );

      tool.setConfig({});

      expect(rematch).not.toHaveBeenCalled();
      expect(settingsInEffect()).toEqual({ steps: 8, interpolation: 'hsv', algo: 'ciede2000' });
    });
  });

  // ==========================================================================
  // BUG-019 (2026-10-04 deep-dive): ConfigController owns the step count and
  // colour space. The tool's v3 mirrors made a second owner the sidebar never
  // saw, so they are dropped at construction and never read or written.
  // ==========================================================================

  describe('retired settings keys', () => {
    const retiredCalls = (fn: (key: string, ...rest: never[]) => unknown) =>
      vi.mocked(fn).mock.calls.filter((call) => RETIRED_SETTINGS_KEYS.includes(call[0]));

    afterEach(() => {
      window.history.replaceState({}, '', '/');
    });

    it('drops both keys at construction and never reads them', () => {
      tool = mount();

      for (const key of RETIRED_SETTINGS_KEYS) {
        expect(StorageService.removeItem).toHaveBeenCalledWith(key);
      }
      expect(retiredCalls(StorageService.getItem)).toEqual([]);
    });

    it('never writes them — not from setConfig, the in-tool controls or a share link', async () => {
      tool = mountAt('?start=1&end=2&steps=12&interpolation=oklch&v=1');
      tool.setConfig({ stepCount: 5, interpolation: 'lab' });
      const pick = (
        el: HTMLInputElement | HTMLSelectElement | null,
        value: string,
        type: string
      ) => {
        el!.value = value;
        el!.dispatchEvent(new Event(type));
      };
      pick(leftPanel.querySelector('[data-testid="gradient-step-slider"]'), '6', 'input');
      pick(leftPanel.querySelector('[data-testid="gradient-colorspace-select"]'), 'rgb', 'change');
      pick(drawerContent.querySelector('input[type="range"]'), '10', 'input');
      pick(
        drawerContent.querySelector('[data-testid="gradient-mobile-colorspace-select"]'),
        'lch',
        'change'
      );
      await flush();

      expect(retiredCalls(StorageService.setItem)).toEqual([]);
    });
  });

  // ==========================================================================
  // The left-panel and drawer controls are unreachable in V4 (v4-layout hands
  // the tool one panel and no drawer; REFACTOR-005 / BUG-093 own them). Until
  // they go, a pick there applies locally, then writes ConfigController, the
  // same as a sidebar pick — never the tool's own storage.
  // ==========================================================================

  describe('in-tool settings controls', () => {
    it('the steps slider applies the count, then writes it to the controller', async () => {
      tool = await mountWithRamp();
      const slider = leftPanel.querySelector<HTMLInputElement>(
        '[data-testid="gradient-step-slider"]'
      )!;

      slider.value = '6';
      slider.dispatchEvent(new Event('input'));
      await flush();

      expect(stepCards()).toHaveLength(6);
      expect(fakeConfigController.setConfig).toHaveBeenCalledExactlyOnceWith('gradient', {
        stepCount: 6,
      });
    });

    it('the colour-space select applies the space, then writes it to the controller', async () => {
      tool = await mountWithRamp();
      const select = leftPanel.querySelector<HTMLSelectElement>(
        '[data-testid="gradient-colorspace-select"]'
      )!;

      select.value = 'oklch';
      select.dispatchEvent(new Event('change'));
      await flush();

      expect(settingsInEffect().interpolation).toBe('oklch');
      expect(fakeConfigController.setConfig).toHaveBeenCalledExactlyOnceWith('gradient', {
        interpolation: 'oklch',
      });
    });

    it('the drawer steps slider writes the controller too', async () => {
      tool = await mountWithRamp();
      const slider = drawerContent.querySelector<HTMLInputElement>('input[type="range"]')!;

      slider.value = '10';
      slider.dispatchEvent(new Event('input'));
      await flush();

      expect(settingsInEffect().steps).toBe(10);
      expect(fakeConfigController.setConfig).toHaveBeenCalledExactlyOnceWith('gradient', {
        stepCount: 10,
      });
    });

    it('the drawer colour-space select writes the controller too', async () => {
      tool = await mountWithRamp();
      const select = drawerContent.querySelector<HTMLSelectElement>(
        '[data-testid="gradient-mobile-colorspace-select"]'
      )!;

      select.value = 'lch';
      select.dispatchEvent(new Event('change'));
      await flush();

      expect(settingsInEffect().interpolation).toBe('lch');
      expect(fakeConfigController.setConfig).toHaveBeenCalledExactlyOnceWith('gradient', {
        interpolation: 'lch',
      });
    });
  });

  // ==========================================================================
  // BUG-019 / BUG-022 / BUG-011 (2026-10-04 deep-dive) against the REAL
  // ConfigController: the barrel's getInstance is pointed at it, so the
  // seed at construction, the share-link write and the subscriber broadcast
  // all run end to end. subscribe() never replays, so the constructor's seed
  // is the only mount-time source of a saved setting.
  // ==========================================================================

  describe('settings are owned by ConfigController', () => {
    const controller = () => RealConfigController.getInstance();

    beforeEach(() => {
      localStorage.clear();
      RealConfigController.resetInstance();
      vi.mocked(ConfigController.getInstance).mockImplementation(
        () => RealConfigController.getInstance() as never
      );
    });

    afterEach(() => {
      vi.mocked(ConfigController.getInstance).mockImplementation(
        () => fakeConfigController as never
      );
      RealConfigController.resetInstance();
      localStorage.clear();
      window.history.replaceState({}, '', '/');
    });

    it('a dye filter saved before mount keeps that dye out of the middle steps', async () => {
      controller().setConfig('gradient', {
        dyeFilters: { ...DEFAULT_DYE_FILTERS, excludeMetallic: true },
      });
      // Every middle step's nearest dye is Dalamud Red, the one metallic mock
      vi.mocked(dyeService.findClosestDye).mockReturnValue(mockDyes[8]);

      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      await flush();

      expect(middleIds().length).toBeGreaterThan(0);
      expect(middleIds()).not.toContain(mockDyes[8].id);
    });

    it('seeds every saved setting at mount', async () => {
      controller().setConfig('gradient', {
        stepCount: 5,
        interpolation: 'lab',
        matchingMethod: 'oklab',
        preventDuplicates: false,
        displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showHex: false },
      });
      matchFirstNotExcluded();

      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      await flush();

      expect(settingsInEffect()).toEqual({ steps: 5, interpolation: 'lab', algo: 'oklab' });
      expect(stepCards()).toHaveLength(5);
      // preventDuplicates off: every middle step keeps the same nearest dye
      expect(new Set(middleIds()).size).toBe(1);
      expect(stepCards()[0].showHex).toBe(false);
    });

    it.each([
      [50, 12],
      [1, 3],
      [4.6, 5],
    ])(
      'clamps a saved step count of %s to %s, and ignores an unknown space',
      async (saved, seeded) => {
        // importConfigs checks types only, so either can be in storage
        controller().setConfig('gradient', { stepCount: saved, interpolation: 'oklab' as never });

        tool = await mountWithRamp();

        expect(settingsInEffect()).toMatchObject({ steps: seeded, interpolation: 'hsv' });
      }
    );

    it('share-link settings survive a later sidebar change (the BUG-019 repro)', async () => {
      vi.mocked(dyeService.findClosestDye).mockReturnValue(mockDyes[0]);
      tool = mountAt('?start=1&end=2&steps=12&interpolation=oklch&algo=oklab&v=1');
      await flush();
      expect(controller().getConfig('gradient')).toMatchObject({
        stepCount: 12,
        interpolation: 'oklch',
        matchingMethod: 'oklab',
      });
      pinsOf(tool).set(3, mockDyes[1]);

      // A sidebar display toggle: the controller broadcasts the FULL config,
      // which used to carry 8 / hsv / ΔE2000 back over the link's values
      controller().setConfig('gradient', {
        displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showHex: false },
      });
      await flush();

      expect(settingsInEffect()).toEqual({ steps: 12, interpolation: 'oklch', algo: 'oklab' });
      expect(pinsOf(tool).size).toBe(1);
      expect(stepCards()).toHaveLength(12);
      expect(stepCards()[0].showHex).toBe(false);
    });

    it('a share link writes its validated settings once, with no echo into the tool', () => {
      const write = vi.spyOn(RealConfigController.prototype, 'setConfig');
      const apply = vi.spyOn(GradientTool.prototype, 'setConfig');

      tool = mountAt('?start=1&end=2&steps=12&interpolation=oklch&algo=oklab&v=1');

      expect(write.mock.calls.filter(([key]) => key === 'gradient')).toEqual([
        ['gradient', { stepCount: 12, interpolation: 'oklch', matchingMethod: 'oklab' }],
      ]);
      // The load runs before the subscription, and the tool already holds the
      // values, so nothing comes back through setConfig
      expect(apply).not.toHaveBeenCalled();
    });

    it('a retired algo name in a link is migrated before it is saved', () => {
      // Pre-5.0 links wrote `euclidean` for RGB distance
      tool = mountAt('?start=1&end=2&algo=euclidean&v=1');

      expect(controller().getConfig('gradient').matchingMethod).toBe('rgb');
      expect(settingsInEffect().algo).toBe('rgb');
    });

    it.each([
      [
        'a fractional step count, a mis-cased space and an unknown algo',
        '?start=1&end=2&steps=4.5&interpolation=OKLCH&algo=bogus&v=1',
      ],
      [
        'an out-of-range step count, a non-mode space and a prototype key',
        '?start=1&end=2&steps=50&interpolation=hsl&algo=constructor&v=1',
      ],
    ])('a link with %s changes no saved or applied setting', (_label, search) => {
      controller().setConfig('gradient', { matchingMethod: 'oklab' });
      const write = vi.spyOn(RealConfigController.prototype, 'setConfig');

      tool = mountAt(search);

      expect(write).not.toHaveBeenCalled();
      expect(controller().getConfig('gradient')).toMatchObject({
        stepCount: 8,
        interpolation: 'hsv',
        matchingMethod: 'oklab',
      });
      expect(settingsInEffect()).toEqual({ steps: 8, interpolation: 'hsv', algo: 'oklab' });
    });

    it('a link with one good setting saves only that one', () => {
      controller().setConfig('gradient', { matchingMethod: 'oklab' });

      tool = mountAt('?start=1&end=2&steps=12&interpolation=nope&algo=bogus&v=1');

      expect(controller().getConfig('gradient')).toMatchObject({
        stepCount: 12,
        interpolation: 'hsv',
        matchingMethod: 'oklab',
      });
      expect(settingsInEffect()).toEqual({ steps: 12, interpolation: 'hsv', algo: 'oklab' });
    });

    it('an in-tool pick reaches the controller without re-running through the echo', async () => {
      tool = await mountWithRamp();
      const rematch = vi.spyOn(
        tool as unknown as { updateInterpolation: () => void },
        'updateInterpolation'
      );
      const slider = leftPanel.querySelector<HTMLInputElement>(
        '[data-testid="gradient-step-slider"]'
      )!;

      slider.value = '6';
      slider.dispatchEvent(new Event('input'));

      expect(controller().getConfig('gradient').stepCount).toBe(6);
      // Applied locally first, so the synchronous broadcast found nothing new
      expect(rematch).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle under interaction', () => {
    it('tears down cleanly after selection and configuration', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      tool.setConfig({ stepCount: 6 });
      await flush();

      expect(() => tool!.destroy()).not.toThrow();
    });

    it('ignores configuration arriving after destroy', () => {
      tool = mount();
      tool.destroy();

      // The sidebar can emit one last config-change during teardown
      expect(() => tool!.setConfig({ stepCount: 4 })).not.toThrow();
    });

    it('works with no drawer panel supplied', async () => {
      tool = mount({ drawer: false });

      tool.selectDye(dye(1));

      expect(await endpoints()).toEqual([1]);
    });
  });

  // ==========================================================================
  // BUG-040: RouterService must be imported through the @services/index
  // barrel this suite mocks (line 44), or the mock above is inert and this
  // assertion would pass vacuously against the REAL RouterService.
  // ==========================================================================

  describe('context actions — hand off to another tool', () => {
    const contextAction = (action: string): void =>
      (
        tool as unknown as {
          handleContextAction: (action: string, dye: unknown) => void;
        }
      ).handleContextAction(action, dye(1));

    it('inspect-accessibility navigates via the barrel-mocked RouterService', async () => {
      tool = mount();
      const { RouterService } = await import('@services/index');

      contextAction('inspect-accessibility');

      expect(RouterService.navigateTo).toHaveBeenCalledWith('accessibility');
    });

    // BUG-013 (2026-10-04 deep-dive): the result card hands the dye to Budget
    // itself, by stainID, and then emits the action. The tool repeating it
    // toasted twice and navigated again without the dye.
    it('leaves inspect-budget to the result card', async () => {
      tool = mount();
      const { RouterService, StorageService } = await import('@services/index');

      contextAction('inspect-budget');

      expect(RouterService.navigateTo).not.toHaveBeenCalled();
      expect(StorageService.setItem).not.toHaveBeenCalledWith(
        'v3_budget_target',
        expect.anything()
      );
    });
  });
});
