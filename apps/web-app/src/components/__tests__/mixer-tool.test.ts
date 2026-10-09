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
import { ConfigController } from '@services/config-controller';
import { ThemeService } from '@services/theme-service';
import type { ResultCardData } from '@components/v4/result-card';
import {
  DEFAULT_DISPLAY_OPTIONS,
  DEFAULT_DYE_FILTERS,
  getDefaultConfig,
} from '@shared/tool-config-types';
import type { MixerConfig } from '@shared/tool-config-types';
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
   * The blending engine's exports (findMatchingDyes,
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
  // No ConfigController here: mixer-tool imports '@services/config-controller'
  // directly, so the REAL controller (and its real StorageService, writing
  // jsdom localStorage) is what every test in this file talks to. A barrel
  // entry returning {} sat here unused; without it, a change that routed the
  // tool through the barrel throws instead of silently reading {}.
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

    // webapp-tools-a-13: this asserted only `not.toThrow()`, so deleting the
    // whole `mixingMode` branch of setConfig kept it green -- the mode would
    // change, the blend would not, and the name of the test says otherwise.
    // A re-blend is observable: the engine resolves the new colour through
    // dyeService.findClosestDyes.
    it('recomputes the blend when the mode changes with two inputs set', () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      mockGetAllDyes.mockClear();

      tool.setConfig({ mixingMode: 'lab' } as never);

      // findMatchingDyes() walks dyeService.getAllDyes(), so a re-match is
      // exactly a fresh call to it.
      expect(mockGetAllDyes).toHaveBeenCalled();
    });

    it('does not re-blend when the mode is set to the value it already has', () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      mockGetAllDyes.mockClear();

      // 'ryb' is the default, so this is a no-op and must stay one.
      tool.setConfig({ mixingMode: 'ryb' } as never);

      expect(mockGetAllDyes).not.toHaveBeenCalled();
    });

    // BUG-077 (2026-10-04 deep-dive): this asserted only `not.toThrow()`, so
    // deleting the maxResults branch of setConfig kept it green. With a pair
    // mixed, a new count re-matches and the grid shows that many cards.
    it('re-matches to the new count when maxResults changes', () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      const cardCount = () => container.querySelectorAll('v4-result-card').length;
      expect(cardCount()).not.toBe(7);

      tool.setConfig({ maxResults: 7 } as never);

      expect(cardCount()).toBe(7);
    });

    // webapp-tools-a-13: `not.toThrow()` only, on a test whose name promises a
    // re-match. With a blend in place, changing the algorithm must run the
    // match again.
    it('re-matches when the matching method changes', () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      mockGetAllDyes.mockClear();

      tool.setConfig({ matchingMethod: 'oklab' } as never);

      expect(mockGetAllDyes).toHaveBeenCalled();
    });

    // BUG-077: both calls asserted only `not.toThrow()`, so the equality guard
    // could go and nothing failed. A display change rebuilds the cards (new
    // nodes); an identical repeat must leave the same nodes in place. No
    // re-match happens either way, so getAllDyes cannot tell the two apart.
    it('re-renders the cards on a displayOptions change, and not on an identical repeat', () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      const opts = { ...DEFAULT_DISPLAY_OPTIONS, showCmyk: true } as never;
      const firstCard = () => container.querySelector('v4-result-card');
      const before = firstCard();
      expect(before).not.toBeNull();

      tool.setConfig({ displayOptions: opts });
      const changed = firstCard();
      expect(changed).not.toBe(before);

      // Second identical call hits the field-by-field equality guard
      tool.setConfig({ displayOptions: opts });
      expect(firstCard()).toBe(changed);
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

  // OPT-007 follow-up (2026-10-04 deep-dive): a sidebar mode change ran
  // updateCraftingUI() -- which redraws the field -- and then the re-match
  // block redrew it again. A count change redrew it too, although every field
  // cell matches with maxResults 1 and the spread chip ignores the count.
  describe('setConfig redraws the mixing field at most once', () => {
    beforeEach(() => {
      localStorage.clear();
      ConfigController.resetInstance();
    });

    afterEach(() => {
      tool?.destroy();
      tool = null;
      ConfigController.resetInstance();
      localStorage.clear();
    });

    const mountWithPairAndSpies = () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      const internals = tool as unknown as {
        renderMixingField(): void;
        renderCraftingUI(): void;
      };
      return {
        field: vi.spyOn(internals, 'renderMixingField'),
        crafting: vi.spyOn(internals, 'renderCraftingUI'),
      };
    };

    it('redraws the field and the crafting slots once on a mode change', () => {
      const { field, crafting } = mountWithPairAndSpies();

      tool!.setConfig({ mixingMode: 'lab' } as never);

      expect(field).toHaveBeenCalledTimes(1);
      // The result slot shows the new blend, so the crafting row still repaints.
      expect(crafting).toHaveBeenCalledTimes(1);
    });

    it('does not redraw the field for a maxResults-only change', () => {
      const { field, crafting } = mountWithPairAndSpies();

      tool!.setConfig({ maxResults: 7 } as never);

      expect(container.querySelectorAll('v4-result-card')).toHaveLength(7);
      expect(field).not.toHaveBeenCalled();
      expect(crafting).not.toHaveBeenCalled();
    });

    it('redraws the field once on a matching-method change (control)', () => {
      const { field } = mountWithPairAndSpies();

      tool!.setConfig({ matchingMethod: 'oklab' } as never);

      expect(field).toHaveBeenCalledTimes(1);
    });

    it('redraws the field once on a filter change (control)', () => {
      const { field } = mountWithPairAndSpies();

      tool!.setConfig({ dyeFilters: { ...DEFAULT_DYE_FILTERS, excludeMetallic: true } } as never);

      expect(field).toHaveBeenCalledTimes(1);
    });

    it('redraws the field once when the mode and the count change together', () => {
      const { field } = mountWithPairAndSpies();

      tool!.setConfig({ mixingMode: 'hsl', maxResults: 6 } as never);

      expect(field).toHaveBeenCalledTimes(1);
    });
  });

  describe('setConfig — the market channel', () => {
    // vi.restoreAllMocks() leaves a vi.fn's return value alone, and a stale
    // `true` here would start price fetches in every later test.
    afterEach(async () => {
      const { MarketBoardService } = await import('@services/index');
      vi.mocked(MarketBoardService.getInstance().getShowPrices).mockReturnValue(false);
    });

    const firstCard = () => container.querySelector('v4-result-card');

    /** Mount with a pair mixed and its cards on screen; returns the service mock. */
    const mountMixed = async () => {
      const { MarketBoardService } = await import('@services/index');
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      await flush();
      expect(firstCard()).not.toBeNull();
      return MarketBoardService.getInstance();
    };

    // BUG-077 follow-up: this and the two server tests asserted only
    // `not.toThrow()`, so deleting the showPrices:false re-render or the
    // whole selectedServer branch of setConfig kept the suite green.
    it('routes a showPrices change through the _tool marker', async () => {
      const service = await mountMixed();

      // On: the cards need prices, so the change fetches them
      vi.mocked(service.getShowPrices).mockReturnValue(true);
      vi.mocked(service.fetchPricesForDyes).mockClear();
      tool!.setConfig({ _tool: 'market', showPrices: true } as never);
      expect(service.fetchPricesForDyes).toHaveBeenCalledTimes(1);
      await flush();

      // Off: the cards are rebuilt without the market row, and nothing is fetched
      vi.mocked(service.getShowPrices).mockReturnValue(false);
      vi.mocked(service.fetchPricesForDyes).mockClear();
      const before = firstCard();
      tool!.setConfig({ _tool: 'market', showPrices: false } as never);

      expect(firstCard()).not.toBe(before);
      expect((firstCard() as unknown as { showPrice: boolean }).showPrice).toBe(false);
      expect(service.fetchPricesForDyes).not.toHaveBeenCalled();
    });

    it('routes a server change', async () => {
      const service = await mountMixed();
      vi.mocked(service.fetchPricesForDyes).mockClear();
      const before = firstCard();

      // Prices off: the service dropped its cache, so the cards are rebuilt,
      // but there is nothing to fetch
      tool!.setConfig({ _tool: 'market', selectedServer: 'Gilgamesh' } as never);

      expect(firstCard()).not.toBe(before);
      expect(service.fetchPricesForDyes).not.toHaveBeenCalled();
    });

    // BUG-077: this asserted only `not.toThrow()`. Prices are on, so the one
    // thing between the field and a fetch is the `_tool: 'market'` marker.
    it('ignores market fields when the _tool marker is absent', async () => {
      const { MarketBoardService } = await import('@services/index');
      const service = MarketBoardService.getInstance();
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      await flush();
      vi.mocked(service.getShowPrices).mockReturnValue(true);
      vi.mocked(service.fetchPricesForDyes).mockClear();

      // Without the discriminator these are not market config at all
      tool.setConfig({ showPrices: true } as never);
      expect(service.fetchPricesForDyes).not.toHaveBeenCalled();

      // Control: the same field WITH the marker does fetch
      tool.setConfig({ _tool: 'market', showPrices: true } as never);
      expect(service.fetchPricesForDyes).toHaveBeenCalled();
      await flush();
    });

    it('handles a server change while results are on screen', async () => {
      const service = await mountMixed();
      vi.mocked(service.getShowPrices).mockReturnValue(true);
      vi.mocked(service.fetchPricesForDyes).mockClear();
      const before = firstCard();

      tool!.setConfig({ _tool: 'market', selectedServer: 'Balmung' } as never);

      // Rebuilt at once, before the new server's prices arrive...
      expect(firstCard()).not.toBe(before);
      // ...and those prices are fetched
      expect(service.fetchPricesForDyes).toHaveBeenCalledTimes(1);
      await flush();
    });
  });

  // BUG-086 sibling (2026-10-04 deep-dive): the cards drew the market row
  // from the tool's own Price option alone, but the service fetches nothing
  // while the global Market Board toggle is off (its default) -- so the row
  // read "—" forever on a fresh profile.
  describe('the market row follows the Market Board toggle', () => {
    afterEach(async () => {
      const { MarketBoardService } = await import('@services/index');
      vi.mocked(MarketBoardService.getInstance().getShowPrices).mockReturnValue(false);
    });

    const cardsShowPrice = (): boolean[] =>
      [...container.querySelectorAll('v4-result-card')].map(
        (card) => (card as unknown as { showPrice: boolean }).showPrice
      );

    it('hides the row while the toggle is off, then shows it once it is on', async () => {
      const { MarketBoardService } = await import('@services/index');
      tool = mount();
      tool.setConfig({ displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showPrice: true } } as never);
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      await flush();

      expect(cardsShowPrice().length).toBeGreaterThan(0);
      expect(new Set(cardsShowPrice())).toEqual(new Set([false]));

      // Control: the same display flag with the toggle on draws the row
      vi.mocked(MarketBoardService.getInstance().getShowPrices).mockReturnValue(true);
      tool.setConfig({ _tool: 'market', showPrices: true } as never);
      await flush();

      expect(new Set(cardsShowPrice())).toEqual(new Set([true]));
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

  // ==========================================================================
  // BUG-022 / BUG-011 (2026-10-04 deep-dive): mount against a NON-default
  // persisted config, through the REAL ConfigController. subscribe() never
  // replays, so the constructor's getConfig('mixer') is the only mount-time
  // source of the saved settings; nothing tested it, and the saved dye
  // filters were never read. The singleton and jsdom localStorage outlive a
  // test, so both are reset on the way in AND out.
  // ==========================================================================

  describe('mount seeds from the persisted mixer config', () => {
    const metallicDye = mockDyes.find((d) => d.isMetallic)!; // Dalamud Red, id 5737
    // Recoloured to the inputs' own hex. The matcher measures REAL distances
    // here (the engine does not reach the barrel's constant ColorService
    // stub), so a pair of #336699 inputs blends to #336699 in every model and
    // this is the nearest dye -- card #1 unless a filter removes it.
    const metallic = { ...metallicDye, hex: '#336699' };

    /** The dye on each result card, in grid order. */
    const cardDyeIds = () =>
      [...container.querySelectorAll('v4-result-card')].map(
        (c) => (c as unknown as { data: ResultCardData }).data.dye.id
      );

    const shareParams = () =>
      (
        container.querySelector('v4-share-button') as unknown as {
          shareParams: Record<string, unknown>;
        }
      ).shareParams;

    /**
     * Save a partial as the sidebar would, then drop the in-memory singleton
     * so the next mount reads it back from localStorage, as after a reload.
     */
    const persist = (partial: Partial<MixerConfig>) => {
      ConfigController.getInstance().setConfig('mixer', partial);
      ConfigController.resetInstance();
    };

    const mountWithPair = (): MixerTool => {
      const t = mount();
      t.selectDye(dye(1));
      t.selectDye(dye(2));
      return t;
    };

    /** The mixer-key writes a spied controller received. */
    const mixerWrites = (write: { mock: { calls: unknown[][] } }) =>
      write.mock.calls.filter(([key]) => key === 'mixer');

    beforeEach(() => {
      localStorage.clear();
      ConfigController.resetInstance();
      // First in the pool as well, so it leads even on a distance tie. (The
      // inputs, ids 1 and 2, are not in the pool.)
      mockGetAllDyes.mockReturnValue([metallic, ...mockDyes.filter((d) => d !== metallicDye)]);
    });

    afterEach(() => {
      tool?.destroy();
      tool = null;
      window.history.replaceState({}, '', '/');
      ConfigController.resetInstance();
      localStorage.clear();
    });

    it('shows the metallic dye first with nothing persisted (control)', () => {
      tool = mountWithPair();

      expect(cardDyeIds()[0]).toBe(metallic.id);
      expect(cardDyeIds()).toHaveLength(getDefaultConfig('mixer').maxResults);
    });

    it('applies persisted dye filters at mount (BUG-022)', () => {
      persist({ dyeFilters: { ...DEFAULT_DYE_FILTERS, excludeMetallic: true } });

      tool = mountWithPair();

      expect(cardDyeIds().length).toBeGreaterThan(0);
      expect(cardDyeIds()).not.toContain(metallic.id);
    });

    it('applies a persisted maxResults at mount', () => {
      persist({ maxResults: 6 });

      tool = mountWithPair();

      expect(cardDyeIds()).toHaveLength(6);
    });

    it('applies persisted display options at mount', () => {
      persist({ displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showCmyk: true } });

      tool = mountWithPair();

      const card = container.querySelector('v4-result-card') as HTMLElement & {
        showCmyk?: boolean;
      };
      expect(card.showCmyk).toBe(true);
    });

    // An imported settings file is type-checked only, so the controller can
    // hold a count or a blend model the Mixer has no use for.
    it('clamps a saved count and ignores an unknown blend model at mount', () => {
      persist({ maxResults: 50, mixingMode: 'cmyk' as never });
      tool = mountWithPair();
      expect(cardDyeIds()).toHaveLength(8);
      expect(shareParams().mode).toBe(getDefaultConfig('mixer').mixingMode);
    });

    it('ignores a count or a blend model it cannot use when one arrives later', () => {
      tool = mountWithPair();
      tool.setConfig({ maxResults: Number.NaN, mixingMode: 'cmyk' as never });
      expect(cardDyeIds()).toHaveLength(getDefaultConfig('mixer').maxResults);
      expect(shareParams().mode).toBe(getDefaultConfig('mixer').mixingMode);
    });

    it('falls back to the controller defaults for fields a config lacks', () => {
      // The constructor is the first getConfig reader after the reset above
      vi.spyOn(ConfigController.getInstance(), 'getConfig').mockImplementationOnce(
        () => ({}) as never
      );

      tool = mountWithPair();

      const defaults = getDefaultConfig('mixer');
      expect(cardDyeIds()).toHaveLength(defaults.maxResults);
      expect(shareParams()).toMatchObject({
        mode: defaults.mixingMode,
        algo: defaults.matchingMethod,
      });
    });

    // A field-cell pick set the mode locally only, so the next full-config
    // broadcast (a display toggle, a filter, another tab) put the persisted
    // mode back: the blend silently returned to RYB at the picked ratio.
    it('keeps a mixing-field pick through the next controller broadcast', () => {
      tool = mountWithPair();
      const cell = container.querySelector<HTMLButtonElement>('button[title^="LAB · 70/30"]');
      expect(cell).not.toBeNull();

      cell!.click();
      expect(shareParams()).toMatchObject({ mode: 'lab', ratio: 70 });

      // A real change, so the controller broadcasts the WHOLE mixer config
      ConfigController.getInstance().setConfig('mixer', { maxResults: 5 });

      expect(shareParams()).toMatchObject({ mode: 'lab', ratio: 70 });
      expect(ConfigController.getInstance().getConfig('mixer').mixingMode).toBe('lab');
    });

    it('ignores a malformed algo in a share link instead of overwriting the saved method', () => {
      persist({ matchingMethod: 'oklab' });
      const write = vi.spyOn(ConfigController.getInstance(), 'setConfig');
      window.history.replaceState({}, '', '/mixer/?dyeA=1&dyeB=2&algo=bogus&v=1');

      tool = mount();

      expect(ConfigController.getInstance().getConfig('mixer').matchingMethod).toBe('oklab');
      expect(shareParams()).toMatchObject({ algo: 'oklab' });
      expect(mixerWrites(write)).toEqual([]);
    });

    it("writes a share link's settings to the controller once, together", () => {
      const write = vi.spyOn(ConfigController.getInstance(), 'setConfig');
      window.history.replaceState({}, '', '/mixer/?dyeA=1&dyeB=2&mode=lab&algo=oklab&v=1');

      tool = mount();

      expect(mixerWrites(write)).toEqual([
        ['mixer', { mixingMode: 'lab', matchingMethod: 'oklab' }],
      ]);
      expect(shareParams()).toMatchObject({ mode: 'lab', algo: 'oklab' });
    });

    it('still accepts a retired algo from an old link, migrated', () => {
      window.history.replaceState({}, '', '/mixer/?dyeA=1&dyeB=2&algo=euclidean&v=1');

      tool = mount();

      expect(ConfigController.getInstance().getConfig('mixer').matchingMethod).toBe('rgb');
      expect(shareParams()).toMatchObject({ algo: 'rgb' });
    });
  });

  // ==========================================================================
  // BUG-021 / BUG-076 (2026-10-04 deep-dive): a language switch runs update(),
  // which rebuilds the right panel with the results section hidden and its
  // grid empty. Nothing regenerated the matches, so a mixed pair lost Matching
  // Dyes, Export and Share until the next slot change -- and no test ever fired
  // the LanguageService subscriber. Mounted as the v4 shell mounts it: one
  // element as both panels. Uses the real ConfigController, so the singleton
  // and jsdom localStorage are reset on the way in and out.
  // ==========================================================================

  describe('a language switch keeps the mix on screen', () => {
    let panel: HTMLElement;

    beforeEach(() => {
      localStorage.clear();
      ConfigController.resetInstance();
      panel = document.createElement('div');
      container.appendChild(panel);
    });

    afterEach(() => {
      tool?.destroy();
      tool = null;
      ConfigController.resetInstance();
      localStorage.clear();
    });

    const mountV4 = (): MixerTool => {
      const t = new MixerTool(container, {
        leftPanel: panel,
        rightPanel: panel,
        drawerContent: null,
      });
      t.init();
      return t;
    };

    /** Every captured subscriber, as the extractor test does: not only `calls[0]`. */
    const switchLanguage = async () => {
      const { LanguageService } = await import('@services/index');
      for (const [cb] of [...vi.mocked(LanguageService.subscribe).mock.calls]) {
        (cb as () => void)();
      }
      await flush();
    };

    /** Whether `el` or any ancestor up to the panel is display:none. */
    const isHidden = (el: Element): boolean => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node && node !== panel) {
        if (node.style.display === 'none') return true;
        node = node.parentElement;
      }
      return false;
    };

    const shareButton = () =>
      panel.querySelector('v4-share-button') as unknown as HTMLElement & { disabled: boolean };

    it('still shows the matching dyes, Export and Share for a mixed pair', async () => {
      tool = mountV4();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      const shown = getDefaultConfig('mixer').maxResults;
      expect(panel.querySelectorAll('v4-result-card')).toHaveLength(shown);

      await switchLanguage();

      const cards = [...panel.querySelectorAll('v4-result-card')];
      expect(cards).toHaveLength(shown);
      expect(isHidden(cards[0])).toBe(false);
      expect(isHidden(panel.querySelector('[data-testid="mixer-export"]')!)).toBe(false);
      expect(isHidden(shareButton())).toBe(false);
      expect(shareButton().disabled).toBe(false);
    });

    it('leaves a single-dye mixer without a results section', async () => {
      tool = mountV4();
      tool.selectDye(dye(1));

      await switchLanguage();

      expect(panel.querySelectorAll('v4-result-card')).toHaveLength(0);
      expect(isHidden(panel.querySelector('[data-testid="mixer-export"]')!)).toBe(true);
      expect(shareButton().disabled).toBe(true);
    });
  });

  // ==========================================================================
  // The 5C mixing field: six models x five ratios, each cell a real blend
  // with its nearest dye's ΔE. A cell click writes the mode to the REAL
  // ConfigController, so the singleton and jsdom localStorage are reset on
  // the way in and out.
  // ==========================================================================

  describe('the mixing field', () => {
    /** Every field cell: its title is `MODEL · A/B · #HEX`. */
    const fieldCells = () =>
      [...container.querySelectorAll<HTMLButtonElement>('button[title]')].filter((b) =>
        / · \d+\/\d+ · #/.test(b.title)
      );

    /** A cell's ΔE badge text. */
    const badges = () => fieldCells().map((c) => c.textContent);

    const isPicked = (cell: Element) =>
      (cell.getAttribute('style') ?? '').includes('var(--theme-primary)');

    const mountWithPair = (): MixerTool => {
      const t = mount();
      t.selectDye(dye(1));
      t.selectDye(dye(2));
      return t;
    };

    // setup.ts starts the file on standard-light; resetToDefault() would leave
    // every later test on standard-dark, so put back whatever was there.
    let startTheme: ReturnType<typeof ThemeService.getCurrentTheme>;

    beforeEach(() => {
      startTheme = ThemeService.getCurrentTheme();
      localStorage.clear();
      ConfigController.resetInstance();
    });

    afterEach(() => {
      tool?.destroy();
      tool = null;
      ThemeService.setTheme(startTheme);
      ConfigController.resetInstance();
      localStorage.clear();
    });

    // OPT-007 (2026-10-04 deep-dive): the click handler ran updateCraftingUI(),
    // which already redraws the field, then redrew it again -- thirty blends
    // and thirty full-pool scans, twice per click. One scan re-matches the
    // results grid; the rest is one per field cell, once.
    it('redraws the field once per cell click', () => {
      tool = mountWithPair();
      const cellCount = fieldCells().length;
      expect(cellCount).toBe(30);
      mockGetAllDyes.mockClear();

      container.querySelector<HTMLButtonElement>('button[title^="LAB · 70/30"]')!.click();

      expect(mockGetAllDyes).toHaveBeenCalledTimes(1 + cellCount);
      // ...and that one redraw marks the picked cell
      expect(isPicked(container.querySelector('button[title^="LAB · 70/30"]')!)).toBe(true);
    });

    // BUG-099 (2026-10-04 deep-dive): `?.distance ?? 0` turned an empty pool
    // (the sidebar filters can exclude every dye) into 0.0 in all thirty
    // cells -- an exact match, by the look of it, beside an empty grid.
    it('prints a dash, not 0.0, in a cell with no eligible dye', () => {
      mockGetAllDyes.mockReturnValue([]);

      tool = mountWithPair();

      expect(badges()).toHaveLength(30);
      expect(new Set(badges())).toEqual(new Set(['—']));
    });

    it('prints the nearest ΔE when there is an eligible dye (control)', () => {
      tool = mountWithPair();

      expect(badges()).toHaveLength(30);
      for (const badge of badges()) expect(badge).toMatch(/^\d+\.\d+$/);
    });

    // BUG-080 (2026-10-04 deep-dive): the spread chip's tone is read from
    // ThemeService.isDarkMode() at render and nothing re-rendered the field
    // on a switch, so a dark-ramp colour sat on the light theme's cards.
    it('re-tones the spread chip when the theme switches', () => {
      const chipColor = () =>
        (container.querySelector('span[title="mixer.spreadDesc"]') as HTMLElement).style.color;

      // Control: what a fresh render under Light gives this pair
      ThemeService.setTheme('standard-light');
      tool = mountWithPair();
      const light = chipColor();
      tool.destroy();
      tool = null;

      ThemeService.setTheme('standard-dark');
      tool = mountWithPair();
      expect(chipColor()).not.toBe(light);

      ThemeService.setTheme('standard-light');

      expect(chipColor()).toBe(light);
    });

    // BUG-080 follow-up: the listener redrew the whole field to recolour one
    // chip, so a keyboard user on a cell who pressed Shift+T lost focus to
    // <body> (and every switch re-ran thirty blends). Only the chip changes.
    it('re-tones the chip in place, keeping a focused field cell', () => {
      const chip = () => container.querySelector('span[title="mixer.spreadDesc"]') as HTMLElement;
      ThemeService.setTheme('standard-light');
      tool = mountWithPair();
      const chipBefore = chip();
      const lightColor = chipBefore.style.color;
      const cell = container.querySelector<HTMLButtonElement>('button[title^="LAB · 70/30"]')!;
      cell.focus();
      expect(document.activeElement).toBe(cell);

      ThemeService.setTheme('standard-dark');

      expect(cell.isConnected).toBe(true);
      expect(document.activeElement).toBe(cell);
      expect(chip()).toBe(chipBefore);
      expect(chipBefore.style.color).not.toBe(lightColor);
    });

    it('does not run thirty blends on a theme switch', () => {
      tool = mountWithPair();
      mockGetAllDyes.mockClear();

      ThemeService.setTheme('standard-dark');

      expect(mockGetAllDyes).not.toHaveBeenCalled();
    });

    it('stops listening to the theme once destroyed', () => {
      tool = mountWithPair();
      const mounted = tool;
      mounted.destroy();
      tool = null;
      const internals = mounted as unknown as {
        retoneSpreadChip(): void;
        renderMixingField(): void;
      };
      const retone = vi.spyOn(internals, 'retoneSpreadChip');
      const redraw = vi.spyOn(internals, 'renderMixingField');

      ThemeService.setTheme('standard-dark');

      expect(retone).not.toHaveBeenCalled();
      expect(redraw).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // BUG-098 (2026-10-04 deep-dive): the third input slot was cut on
  // 2026-08-08, but a build from before then stored three ids under the same
  // key. Restoring the third turned the pair into an equal-weight three-way
  // blend that ignored the ratio and hid the field -- and a share link, which
  // sets only A and B, kept the recipient's stale third dye under it.
  // ==========================================================================

  describe('a legacy third slot in storage', () => {
    const stored = async (value: unknown) => {
      const { StorageService } = await import('@services/index');
      vi.mocked(StorageService.getItem).mockImplementation(((key: string) =>
        key === DYES_KEY ? value : null) as never);
    };

    const fieldCells = () =>
      [...container.querySelectorAll<HTMLButtonElement>('button[title]')].filter((b) =>
        / · \d+\/\d+ · #/.test(b.title)
      );

    beforeEach(() => {
      localStorage.clear();
      ConfigController.resetInstance();
    });

    // vi.restoreAllMocks() leaves a vi.fn's implementation in place.
    afterEach(async () => {
      const { StorageService } = await import('@services/index');
      vi.mocked(StorageService.getItem).mockReturnValue(null);
      tool?.destroy();
      tool = null;
      window.history.replaceState({}, '', '/');
      ConfigController.resetInstance();
      localStorage.clear();
    });

    it('restores the pair only, shows the field, and saves the pair back', async () => {
      await stored([mockDyes[0].id, mockDyes[1].id, mockDyes[2].id]);

      tool = mount();

      expect(fieldCells()).toHaveLength(30);
      expect(await slots()).toEqual([mockDyes[0].id, mockDyes[1].id, null]);
    });

    it('does not rewrite a stored pair that has no third slot (control)', async () => {
      await stored([mockDyes[0].id, mockDyes[1].id, null]);

      tool = mount();

      expect(fieldCells()).toHaveLength(30);
      expect(await slots()).toBeUndefined();
    });

    it("blends a shared pair at the link's ratio over a stale third slot", async () => {
      await stored([mockDyes[0].id, mockDyes[1].id, mockDyes[2].id]);
      window.history.replaceState({}, '', '/mixer/?dyeA=1&dyeB=2&ratio=70&v=1');

      tool = mount();

      const picked = fieldCells().filter((c) =>
        (c.getAttribute('style') ?? '').includes('var(--theme-primary)')
      );
      expect(picked).toHaveLength(1);
      expect(picked[0].title).toContain(' · 70/30 · ');
      expect(await slots()).toEqual([mockDyes[0].id, mockDyes[1].id, null]);
    });
  });
});
