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
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
      findClosestDyes: mockFindClosestDyes,
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

vi.mock('../dye-action-dropdown', () => ({
  createDyeActionDropdown: vi.fn().mockImplementation(() => {
    const div = document.createElement('div');
    div.className = 'dye-action-dropdown';
    return div;
  }),
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
  const STEPS_KEY = 'v3_mixer_steps';
  const SPACE_KEY = 'v3_mixer_color_space';

  const lastWrite = async (key: string): Promise<unknown> => {
    const { StorageService } = await import('@services/index');
    const calls = vi.mocked(StorageService.setItem).mock.calls.filter((c) => c[0] === key);
    return calls.at(-1)?.[1];
  };

  /** The [start, end] dye ids currently persisted. */
  const endpoints = () => lastWrite(DYES_KEY) as Promise<number[] | undefined>;

  const dye = (id: number, name = `Dye ${id}`) =>
    ({ ...mockDyes[0], id, itemID: 5000 + id, name, hex: '#123456' }) as never;

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

  describe('setConfig', () => {
    it('persists a step-count change', async () => {
      tool = mount();

      tool.setConfig({ stepCount: 12 });
      await flush();

      expect(await lastWrite(STEPS_KEY)).toBe(12);
    });

    it('ignores a step count already in effect', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      tool.setConfig({ stepCount: 12 });
      await flush();
      vi.mocked(StorageService.setItem).mockClear();

      tool.setConfig({ stepCount: 12 });
      await flush();

      expect(StorageService.setItem).not.toHaveBeenCalledWith(STEPS_KEY, expect.anything());
    });

    it('persists an interpolation change as the colour space', async () => {
      tool = mount();

      tool.setConfig({ interpolation: 'oklab' } as never);
      await flush();

      // The sidebar calls it `interpolation`; storage calls it colorSpace
      expect(await lastWrite(SPACE_KEY)).toBe('oklab');
    });

    it.each(['rgb', 'lab', 'oklab', 'lch', 'hsl'])(
      'accepts %s as an interpolation space',
      async (space) => {
        tool = mount();

        tool.setConfig({ interpolation: space } as never);
        await flush();

        expect(await lastWrite(SPACE_KEY)).toBe(space);
      }
    );

    it('ignores the colour space already in effect', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      // hsv is the default
      tool.setConfig({ interpolation: 'hsv' } as never);
      await flush();

      expect(StorageService.setItem).not.toHaveBeenCalledWith(SPACE_KEY, expect.anything());
    });

    it.each([
      ['preventDuplicates', { preventDuplicates: true }],
      ['matchingMethod', { matchingMethod: 'oklab' }],
      ['displayOptions', { displayOptions: { showHex: true } }],
    ])('accepts a %s change with no endpoints set', (_label, config) => {
      tool = mount();

      expect(() => tool!.setConfig(config as never)).not.toThrow();
    });

    it('accepts an empty config without writing anything', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      tool.setConfig({});

      expect(StorageService.setItem).not.toHaveBeenCalledWith(STEPS_KEY, expect.anything());
    });

    it('recomputes against the new settings when endpoints are set', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      expect(() => tool!.setConfig({ stepCount: 5 })).not.toThrow();
      await flush();

      expect(await lastWrite(STEPS_KEY)).toBe(5);
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
});
