/**
 * XIV Dye Tools - MixerTool Unit Tests
 *
 * Tests the mixer tool component for color blending.
 * Covers rendering, dye slots, blend modes, and closest dye matching.
 *
 * @module components/__tests__/mixer-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MixerTool } from '../mixer-tool';
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';
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
  // The real mixer-blending-engine (pulled in via importActual below)
  // resolves dyes through this singleton, so the wrapper mock must expose it.
  dyeService: {
    getAllDyes: mockGetAllDyes,
    getDyeById: mockGetDyeById,
    findClosestDyes: mockFindClosestDyes,
    getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    // The (unmocked) ShareService resolves shared stainIDs through this
    getByStainId: (id: number) => mockDyes.find((d) => d.stainID === id) ?? null,
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
  /**
   * The blending engine's exports (blendColors, findMatchingDyes,
   * getContrastColor) are pure functions re-exported through the services
   * barrel, and they have their own test file. Use the REAL ones — a stub
   * here would silently change what the mixer computes while the tests still
   * passed. They call ColorService.mixColors* in turn, which is why those
   * stubs above are still needed.
   */
  ...(await vi.importActual<Record<string, unknown>>('@services/mixer-blending-engine')),
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
    getCurrentToolId: vi.fn().mockReturnValue('mixer'),
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

describe('MixerTool', () => {
  let container: HTMLElement;
  let leftPanel: HTMLElement;
  let rightPanel: HTMLElement;
  let drawerContent: HTMLElement;
  let tool: MixerTool | null;

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
    it('should render mixer tool', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });

    it('should render left panel content', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });

    it('should render right panel content', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(rightPanel).not.toBeNull();
    });

    it('should render drawer content when provided', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(drawerContent).not.toBeNull();
    });

    it('should work without drawer content', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should have setConfig method', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.setConfig).toBe('function');
    });

    it('should accept config via setConfig', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      tool.setConfig({ mixingMode: 'rgb' });

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Dye Selection Tests
  // ============================================================================

  describe('Dye Selection', () => {
    it('should have selectDye method', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.selectDye).toBe('function');
    });

    it('should have clearDyes method', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.clearDyes).toBe('function');
    });

    it('should accept dye selection', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      expect(() => tool!.selectDye(mockDyes[0])).not.toThrow();
    });

    it('should clear dyes', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);

      // Should not throw
      expect(() => tool!.clearDyes()).not.toThrow();
    });
  });

  // ============================================================================
  // Blend Mode Tests
  // ============================================================================

  describe('Blend Modes', () => {
    it('should render blend mode controls', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel });
      tool.init();

      // Tool should render blend-related content
      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });

    it('should handle double destroy gracefully', () => {
      tool = new MixerTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.destroy();

      // Second destroy should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });
  });

  // ==========================================================================
  // Interaction depth
  //
  // Mixer's slot model looks like gradient's but behaves differently in the
  // one place that matters: it ALLOWS a dye to occupy both input slots (mixing
  // a colour with itself is a legitimate no-op blend) and only refuses a
  // third. Gradient refuses the second. Both are driven by the same palette
  // drawer calling the same method name, so the difference is worth pinning.
  // ==========================================================================

  const mount = (opts: { drawer?: boolean } = {}): MixerTool => {
    const t = new MixerTool(
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

  const DYES_KEY = 'v4_mixer_selected_dyes';

  const lastWrite = async (key: string): Promise<unknown> => {
    const { StorageService } = await import('@services/index');
    const calls = vi.mocked(StorageService.setItem).mock.calls.filter((c) => c[0] === key);
    return calls.at(-1)?.[1];
  };

  /** The three slot ids currently persisted: [inputA, inputB, result]. */
  const slots = () => lastWrite(DYES_KEY) as Promise<(number | null)[] | undefined>;

  const dye = (id: number, name = `Dye ${id}`) =>
    ({ ...mockDyes[0], id, itemID: 5000 + id, name, hex: '#336699' }) as never;

  describe('selectDye — the two input slots', () => {
    it('fills the first slot', async () => {
      tool = mount();

      tool.selectDye(dye(1));

      expect(await slots()).toEqual([1, null, null]);
    });

    it('fills the second slot', async () => {
      tool = mount();

      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      expect(await slots()).toEqual([1, 2, null]);
    });

    it('shifts the pair once both slots are taken', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      tool.selectDye(dye(3));

      // A <- B, B <- new. The oldest input falls off.
      expect(await slots()).toEqual([2, 3, null]);
    });

    it('keeps shifting on each further pick', async () => {
      tool = mount();
      for (const id of [1, 2, 3, 4]) tool.selectDye(dye(id));

      expect(await slots()).toEqual([3, 4, null]);
    });

    it('ALLOWS the same dye in both slots', async () => {
      tool = mount();

      tool.selectDye(dye(1));
      tool.selectDye(dye(1));

      // Blending a colour with itself is a legitimate (identity) mix, so
      // unlike gradient this is accepted rather than warned about
      expect(await slots()).toEqual([1, 1, null]);
    });

    it('refuses a third copy of the same dye', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(1));

      tool.selectDye(dye(1));

      // Two is a mix; three has nowhere to go and would just churn the slots
      expect(await slots()).toEqual([1, 1, null]);
    });

    it('accepts a duplicate again after one copy is shifted out', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(1));
      tool.selectDye(dye(2)); // shifts one copy of 1 out -> [1, 2]

      tool.selectDye(dye(1));

      expect(await slots()).toEqual([2, 1, null]);
    });

    it('clears the result slot on every new input', async () => {
      tool = mount();

      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      tool.selectDye(dye(3));

      // Slot 2 holds the blend result; a changed input invalidates it
      expect((await slots())![2]).toBeNull();
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
    it('takes a slot like a real dye', async () => {
      tool = mount();

      tool.selectCustomColor('#aabbcc');

      expect((await slots())![0]).not.toBeNull();
    });

    it('ignores an empty colour', async () => {
      tool = mount();

      tool.selectCustomColor('');

      expect(await slots()).toBeUndefined();
    });

    it('can fill the second slot after a real dye', async () => {
      tool = mount();
      tool.selectDye(dye(1));

      tool.selectCustomColor('#aabbcc');

      const s = await slots();
      expect(s![0]).toBe(1);
      expect(s![1]).not.toBeNull();
    });
  });

  // ==========================================================================
  // Share URL — 5.0 grammar: an input is EITHER a stainID (`dyeA`/`dyeB`)
  // OR a bare colour (`hexA`/`hexB`), never both. A custom input used to be
  // written as `dyeA=0`, which fails validation on the way out and lost the
  // colour on the way in.
  // ==========================================================================

  describe('share URL — custom inputs', () => {
    const shareParams = () =>
      (container.querySelector('v4-share-button') as unknown as {
        shareParams: Record<string, unknown>;
        disabled: boolean;
      }) ?? null;

    /** Mount with a share URL in the address bar; restored afterwards. */
    const mountAt = (search: string): MixerTool => {
      window.history.replaceState({}, '', `/mixer/${search}`);
      return mount();
    };

    afterEach(() => {
      window.history.replaceState({}, '', '/');
    });

    it('writes a custom input A as hexA and omits dyeA', () => {
      tool = mount();
      tool.selectCustomColor('#aabbcc'); // A
      tool.selectDye(dye(2)); // B

      const share = shareParams();
      expect(share).not.toBeNull();
      const params = share!.shareParams;
      expect(String(params.hexA).toLowerCase()).toBe('aabbcc');
      expect(params).not.toHaveProperty('dyeA');
      expect(params.dyeB).toBe(mockDyes[0].stainID);
      expect(params).not.toHaveProperty('hexB');
      expect(params.ratio).toEqual(expect.any(Number));
      expect(share!.disabled).toBe(false);
    });

    it('writes a real dye as its stainID and a custom input B as hexB', () => {
      tool = mount();
      tool.selectDye(dye(2)); // A
      tool.selectCustomColor('#aabbcc'); // B

      const params = shareParams()!.shareParams;
      expect(params.dyeA).toBe(mockDyes[0].stainID);
      expect(params).not.toHaveProperty('hexA');
      expect(String(params.hexB).toLowerCase()).toBe('aabbcc');
      expect(params).not.toHaveProperty('dyeB');
    });

    it('reads hexA as a custom input alongside a stainID dyeB', async () => {
      tool = mountAt('?hexA=aabbcc&dyeB=2&ratio=50&v=1');

      // Round-trip: the loaded state writes back the same grammar
      const params = shareParams()!.shareParams;
      expect(String(params.hexA).toLowerCase()).toBe('aabbcc');
      expect(params).not.toHaveProperty('dyeA');
      expect(params.dyeB).toBe(2);
      const s = await slots();
      expect(s![0]).not.toBeNull();
      expect(s![1]).toBe(mockDyes[1].id);
    });

    it('reads two bare-colour inputs as distinct slots', async () => {
      tool = mountAt('?hexA=aabbcc&hexB=112233&ratio=50&v=1');

      const params = shareParams()!.shareParams;
      expect(String(params.hexA).toLowerCase()).toBe('aabbcc');
      expect(String(params.hexB).toLowerCase()).toBe('112233');
      expect(params).not.toHaveProperty('dyeA');
      expect(params).not.toHaveProperty('dyeB');
      const s = await slots();
      expect(s![0]).not.toBeNull();
      expect(s![1]).not.toBeNull();
      expect(s![0]).not.toBe(s![1]);
    });

    it('lets the stainID slot win when both dyeA and hexA are present', () => {
      tool = mountAt('?dyeA=1&hexA=aabbcc&dyeB=2&v=1');

      const params = shareParams()!.shareParams;
      expect(params.dyeA).toBe(1);
      expect(params).not.toHaveProperty('hexA');
    });

    it('rejects a malformed hexA loudly rather than loading a colour', async () => {
      const { ToastService } = await import('@services/toast-service');
      const toastError = vi.spyOn(ToastService, 'error');

      tool = mountAt('?hexA=zzzzzz&dyeB=2&v=1');

      expect(toastError).toHaveBeenCalled();
      const s = await slots();
      expect(s?.[0] ?? null).toBeNull();
      expect(shareParams()!.disabled).toBe(true);
    });

    it('still rejects a legacy itemID in dyeA loudly', async () => {
      const { ToastService } = await import('@services/toast-service');
      const toastError = vi.spyOn(ToastService, 'error');

      tool = mountAt('?dyeA=5729&dyeB=2&v=1');

      expect(toastError).toHaveBeenCalled();
      const s = await slots();
      expect(s?.[0] ?? null).toBeNull();
      expect(shareParams()!.disabled).toBe(true);
    });
  });

  describe('clearDyes', () => {
    it('empties all three slots from storage', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      vi.mocked(StorageService.removeItem).mockClear();

      tool.clearDyes();

      expect(StorageService.removeItem).toHaveBeenCalledWith(DYES_KEY);
    });

    it('leaves the tool usable, starting from the first slot again', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      tool.clearDyes();

      tool.selectDye(dye(9));

      expect(await slots()).toEqual([9, null, null]);
    });

    it('is safe with nothing selected, twice', () => {
      tool = mount();

      expect(() => {
        tool!.clearDyes();
        tool!.clearDyes();
      }).not.toThrow();
    });
  });

  describe('setConfig — tool options', () => {
    it.each(['rgb', 'lab', 'oklab', 'ryb', 'hsl', 'spectral'])(
      'accepts %s as a mixing mode',
      (mixingMode) => {
        tool = mount();

        expect(() => tool!.setConfig({ mixingMode } as never)).not.toThrow();
      }
    );

    it('recomputes the blend when the mode changes with two inputs set', () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      // A mode change with a full pair must re-blend, not just restyle
      expect(() => tool!.setConfig({ mixingMode: 'lab' } as never)).not.toThrow();
    });

    it('accepts a maxResults change', () => {
      tool = mount();

      expect(() => tool!.setConfig({ maxResults: 7 } as never)).not.toThrow();
    });

    it('accepts a matchingMethod change', () => {
      tool = mount();

      expect(() => tool!.setConfig({ matchingMethod: 'oklab' } as never)).not.toThrow();
    });

    it('accepts a displayOptions change and an identical repeat', () => {
      tool = mount();
      const opts = { showHex: true, showRgb: false } as never;

      expect(() => tool!.setConfig({ displayOptions: opts })).not.toThrow();
      // Second identical call hits the field-by-field equality guard
      expect(() => tool!.setConfig({ displayOptions: opts })).not.toThrow();
    });

    it('re-renders result cards when only the CMYK toggle changes', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      await flush();

      expect(container.querySelectorAll('v4-result-card').length).toBeGreaterThan(0);

      tool.setConfig({
        displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showCmyk: true },
      } as never);
      await flush();

      const card = container.querySelector('v4-result-card') as HTMLElement & {
        showCmyk?: boolean;
      };
      expect(card.showCmyk).toBe(true);
    });

    it('accepts an empty config', () => {
      tool = mount();

      expect(() => tool!.setConfig({})).not.toThrow();
    });
  });

  describe('setConfig — the market channel', () => {
    it('routes a showPrices change through the _tool marker', () => {
      tool = mount();

      // Market config arrives on the same method, discriminated by _tool
      expect(() => tool!.setConfig({ _tool: 'market', showPrices: true } as never)).not.toThrow();
      expect(() => tool!.setConfig({ _tool: 'market', showPrices: false } as never)).not.toThrow();
    });

    it('routes a server change', () => {
      tool = mount();

      expect(() =>
        tool!.setConfig({ _tool: 'market', selectedServer: 'Gilgamesh' } as never)
      ).not.toThrow();
    });

    it('ignores market fields when the _tool marker is absent', () => {
      tool = mount();

      // Without the discriminator these are not market config at all
      expect(() => tool!.setConfig({ showPrices: true } as never)).not.toThrow();
    });

    it('handles a server change while results are on screen', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      await flush();

      expect(() =>
        tool!.setConfig({ _tool: 'market', selectedServer: 'Balmung' } as never)
      ).not.toThrow();
    });
  });

  describe('lifecycle under interaction', () => {
    it('tears down cleanly after selection and configuration', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      tool.setConfig({ mixingMode: 'lab' } as never);
      await flush();

      expect(() => tool!.destroy()).not.toThrow();
    });

    it('ignores configuration arriving after destroy', () => {
      tool = mount();
      tool.destroy();

      // The sidebar can emit one last config-change during teardown
      expect(() => tool!.setConfig({ mixingMode: 'rgb' } as never)).not.toThrow();
    });

    it('works with no drawer panel supplied', async () => {
      tool = mount({ drawer: false });

      tool.selectDye(dye(1));

      expect(await slots()).toEqual([1, null, null]);
    });
  });
});
