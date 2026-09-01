/**
 * XIV Dye Tools - AccessibilityTool Unit Tests
 *
 * Tests the accessibility tool component for colorblindness simulation.
 * Covers rendering, dye selection, simulation types, and WCAG contrast.
 *
 * @module components/__tests__/accessibility-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AccessibilityTool } from '../accessibility-tool';
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
  /**
   * The shared display-options merge helper (WEB-REF-003). Absent, setConfig
   * throws the moment a sidebar sends display options.
   */
  applyDisplayOptions: vi.fn(
    ({
      current,
      incoming,
    }: {
      current: Record<string, unknown>;
      incoming: Record<string, unknown>;
    }) => ({
      options: { ...current, ...incoming },
      hasChanges: Object.keys(incoming ?? {}).length > 0,
    })
  ),
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
    getCurrentToolId: vi.fn().mockReturnValue('accessibility'),
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

describe('AccessibilityTool', () => {
  let container: HTMLElement;
  let leftPanel: HTMLElement;
  let rightPanel: HTMLElement;
  let drawerContent: HTMLElement;
  let tool: AccessibilityTool | null;

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
    it('should render accessibility tool', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel, drawerContent });
      expect(() => tool!.init()).not.toThrow();
    });

    it('should render left panel content', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel).not.toBeNull();
    });

    it('should render right panel content', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(rightPanel).not.toBeNull();
    });

    it('should render drawer content when provided', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(drawerContent).not.toBeNull();
    });

    it('should work without drawer content', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      expect(() => tool!.init()).not.toThrow();
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should have setConfig method', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.setConfig).toBe('function');
    });

    it('should accept config via setConfig', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      expect(() => tool!.setConfig({ deuteranopia: true })).not.toThrow();
    });
  });

  // ============================================================================
  // Dye Selection Tests
  // ============================================================================

  describe('Dye Selection', () => {
    it('should have selectDye method', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.selectDye).toBe('function');
    });

    it('should have addDye method', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.addDye).toBe('function');
    });

    it('should have clearDyes method', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.clearDyes).toBe('function');
    });

    it('should accept dye selection', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      expect(() => tool!.selectDye(mockDyes[0])).not.toThrow();
    });

    it('should clear dyes', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);

      // Should not throw
      expect(() => tool!.clearDyes()).not.toThrow();
    });
  });

  // ============================================================================
  // Colorblindness Simulation Tests
  // ============================================================================

  describe('Colorblindness Simulation', () => {
    it('should render simulation controls', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      // Tool should render simulation-related content
      expect(rightPanel).not.toBeNull();
    });

    it('prints each lens prevalence through its locale key, not a literal', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // LanguageService.t is mocked to echo the key, so a keyed prevalence
      // shows up verbatim and a hardcoded '~6% males' would not.
      const text = leftPanel.textContent ?? '';
      expect(text).toContain('accessibility.prevalenceNormal');
      expect(text).toContain('accessibility.prevalenceDeuteranopia');
      expect(text).toContain('accessibility.prevalenceProtanopia');
      expect(text).toContain('accessibility.prevalenceTritanopia');
      expect(text).toContain('accessibility.prevalenceAchromatopsia');
      expect(text).not.toContain('~6% males');
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });

    it('should handle double destroy gracefully', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.destroy();

      // Second destroy should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });
  });

  // ==========================================================================
  // Interaction depth
  //
  // Everything above asserts the tool renders, or that a method exists. These
  // drive the five real entry points — the palette drawer's selectDye /
  // addDye / selectCustomColor / clearDyes, and the sidebar's setConfig —
  // and assert what each one does to the tool's state.
  // ==========================================================================

  const mount = (opts: { drawer?: boolean } = {}): AccessibilityTool => {
    const t = new AccessibilityTool(
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

  const SELECTED_KEY = 'v3_accessibility_selected_dyes';
  const VISION_KEY = 'v3_accessibility_vision_types';

  /** The ids most recently persisted under the selected-dyes key. */
  const persistedDyeIds = async (): Promise<number[] | undefined> => {
    const { StorageService } = await import('@services/index');
    const calls = vi.mocked(StorageService.setItem).mock.calls.filter((c) => c[0] === SELECTED_KEY);
    return calls.at(-1)?.[1] as number[] | undefined;
  };

  const dye = (id: number, name = `Dye ${id}`) =>
    ({ ...mockDyes[0], id, itemID: 5000 + id, name, hex: '#AABBCC' }) as never;

  describe('selectDye', () => {
    it('records the dye and persists its id', async () => {
      tool = mount();

      tool.selectDye(dye(1));

      expect(await persistedDyeIds()).toEqual([1]);
    });

    it('accumulates dyes in selection order', async () => {
      tool = mount();

      tool.selectDye(dye(1));
      tool.selectDye(dye(2));
      tool.selectDye(dye(3));

      expect(await persistedDyeIds()).toEqual([1, 2, 3]);
    });

    it('ignores a dye that is already selected', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.selectDye(dye(2));

      tool.selectDye(dye(1));

      // De-duplicated by id, not by hex — two dyes can share a colour
      expect(await persistedDyeIds()).toEqual([1, 2]);
    });

    it('caps at four dyes by dropping the oldest', async () => {
      tool = mount();
      for (const id of [1, 2, 3, 4]) tool.selectDye(dye(id));

      tool.selectDye(dye(5));

      // FIFO, so the newest pick always lands rather than being refused
      expect(await persistedDyeIds()).toEqual([2, 3, 4, 5]);
    });

    it('keeps dropping the oldest past the cap', async () => {
      tool = mount();
      for (const id of [1, 2, 3, 4, 5, 6]) tool.selectDye(dye(id));

      expect(await persistedDyeIds()).toEqual([3, 4, 5, 6]);
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('ignores %s rather than crashing the drawer', (_label, value) => {
      tool = mount();

      expect(() => tool!.selectDye(value as never)).not.toThrow();
    });
  });

  describe('addDye', () => {
    it('behaves as selectDye does', async () => {
      tool = mount();

      tool.addDye(dye(1));
      tool.addDye(dye(1));
      tool.addDye(dye(2));

      expect(await persistedDyeIds()).toEqual([1, 2]);
    });
  });

  describe('selectCustomColor', () => {
    it('adds a virtual dye carrying the uppercased hex', async () => {
      tool = mount();

      tool.selectCustomColor('#aabbcc');

      const ids = await persistedDyeIds();
      expect(ids).toHaveLength(1);
      // Virtual dyes take a negative id so they cannot collide with real ones
      expect(ids![0]).toBeLessThan(0);
    });

    it('ignores an empty colour', async () => {
      tool = mount();

      tool.selectCustomColor('');

      expect(await persistedDyeIds()).toBeUndefined();
    });

    it('counts toward the same four-dye cap', async () => {
      tool = mount();
      for (const id of [1, 2, 3, 4]) tool.selectDye(dye(id));

      tool.selectCustomColor('#123456');

      const ids = await persistedDyeIds();
      expect(ids).toHaveLength(4);
      expect(ids![0]).toBe(2); // the oldest real dye was dropped
    });
  });

  describe('clearDyes', () => {
    it('empties the selection and removes it from storage', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      tool.selectDye(dye(1));
      vi.mocked(StorageService.removeItem).mockClear();

      tool.clearDyes();

      expect(StorageService.removeItem).toHaveBeenCalledWith(SELECTED_KEY);
    });

    it('leaves the tool usable afterwards', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.clearDyes();

      tool.selectDye(dye(9));

      expect(await persistedDyeIds()).toEqual([9]);
    });

    it('is safe to call with nothing selected, twice', () => {
      tool = mount();

      expect(() => {
        tool!.clearDyes();
        tool!.clearDyes();
      }).not.toThrow();
    });
  });

  describe('setConfig — the vision lenses', () => {
    /** The vision set most recently persisted. */
    const persistedVisions = async (): Promise<string[] | undefined> => {
      const { StorageService } = await import('@services/index');
      const calls = vi.mocked(StorageService.setItem).mock.calls.filter((c) => c[0] === VISION_KEY);
      return calls.at(-1)?.[1] as string[] | undefined;
    };

    // Every lens ships enabled, so "turn it on" is only observable after
    // turning it off — otherwise the change-detection guard skips the write.
    it.each([
      ['deuteranopia', 'deuteranopia'],
      ['protanopia', 'protanopia'],
      ['tritanopia', 'tritanopia'],
      ['achromatopsia', 'achromatopsia'],
      ['normalVision', 'normal'],
    ])('re-enabling %s restores %s to the persisted set', async (configKey, visionId) => {
      tool = mount();
      tool.setConfig({ [configKey]: false } as never);
      await flush();
      expect(await persistedVisions()).not.toContain(visionId);

      tool.setConfig({ [configKey]: true } as never);
      await flush();

      expect(await persistedVisions()).toContain(visionId);
    });

    it('ships with every lens enabled', async () => {
      tool = mount();

      // Turning one off is what first writes the set, and it should still
      // contain the other four
      tool.setConfig({ deuteranopia: false } as never);
      await flush();

      expect(await persistedVisions()).toEqual(
        expect.arrayContaining(['normal', 'protanopia', 'tritanopia', 'achromatopsia'])
      );
    });

    it.each([
      ['deuteranopia', 'deuteranopia'],
      ['protanopia', 'protanopia'],
      ['tritanopia', 'tritanopia'],
      ['achromatopsia', 'achromatopsia'],
    ])('disabling %s removes %s from the persisted set', async (configKey, visionId) => {
      tool = mount();
      tool.setConfig({ [configKey]: true } as never);
      await flush();

      tool.setConfig({ [configKey]: false } as never);
      await flush();

      expect(await persistedVisions()).not.toContain(visionId);
    });

    it('ignores a toggle already in that state', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      tool.setConfig({ deuteranopia: true } as never);
      await flush();
      vi.mocked(StorageService.setItem).mockClear();

      // The guard is `configValue !== isEnabled`
      tool.setConfig({ deuteranopia: true } as never);
      await flush();

      expect(StorageService.setItem).not.toHaveBeenCalledWith(VISION_KEY, expect.anything());
    });

    it('applies several lenses in one call', async () => {
      tool = mount();

      tool.setConfig({ deuteranopia: false, tritanopia: false } as never);
      await flush();

      const visions = await persistedVisions();
      expect(visions).not.toContain('deuteranopia');
      expect(visions).not.toContain('tritanopia');
      // …and leaves the untouched ones alone
      expect(visions).toContain('protanopia');
    });

    it('accepts an empty config without writing anything', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      tool.setConfig({});
      await flush();

      expect(StorageService.setItem).not.toHaveBeenCalledWith(VISION_KEY, expect.anything());
    });

    it('merges displayOptions rather than replacing them', () => {
      tool = mount();

      tool.setConfig({ displayOptions: { showHex: true } as never });
      expect(() => tool!.setConfig({ displayOptions: { showRgb: true } as never })).not.toThrow();
    });
  });

  describe('lifecycle under interaction', () => {
    it('tears down cleanly after selection and configuration', async () => {
      tool = mount();
      tool.selectDye(dye(1));
      tool.setConfig({ deuteranopia: true } as never);
      await flush();

      expect(() => tool!.destroy()).not.toThrow();
    });

    it('ignores configuration arriving after destroy', () => {
      tool = mount();
      tool.destroy();

      // The sidebar can emit one last config-change during teardown
      expect(() => tool!.setConfig({ deuteranopia: true } as never)).not.toThrow();
    });

    it('works with no drawer panel supplied', async () => {
      tool = mount({ drawer: false });

      tool.selectDye(dye(1));

      expect(await persistedDyeIds()).toEqual([1]);
    });
  });
});
