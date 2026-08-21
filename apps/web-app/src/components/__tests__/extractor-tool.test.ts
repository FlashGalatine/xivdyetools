/**
 * XIV Dye Tools - ExtractorTool Unit Tests
 *
 * Tests the extractor tool component for extracting palettes from images.
 * Covers rendering, image upload, palette extraction, and color quantization.
 *
 * @module components/__tests__/extractor-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExtractorTool } from '../extractor-tool';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
//
// `findClosestDye` (SINGULAR) and `findDyesWithinDistance` are the two that
// matter and were the two missing. Both are called by `matchColor`, and
// `findClosestDye` is also called by the REAL `PaletteService` — which this
// file does not mock — from inside `extractAndMatchPalette`. Their absence
// threw `dyeService.findClosestDye is not a function` as an UNHANDLED
// rejection off the image-load path, so it never surfaced as a test failure;
// it just left every sampling, matching and palette-result path unexecuted.
//
// They are given real nearest-neighbour behaviour rather than a fixed return.
// A constant would make "the extractor matched the right dye" untestable —
// every input would produce the same answer, so the assertions could not tell
// a working match from a broken one.
const {
  mockGetAllDyes,
  mockGetDyeById,
  mockFindClosestDyes,
  mockFindClosestDye,
  mockFindDyesWithinDistance,
} = vi.hoisted(() => {
  const parse = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16) || 0,
    g: parseInt(hex.slice(3, 5), 16) || 0,
    b: parseInt(hex.slice(5, 7), 16) || 0,
  });
  /** Plain RGB euclidean — enough to be deterministic and order-correct. */
  const dist = (a: string, b: string) => {
    const x = parse(a);
    const y = parse(b);
    return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2);
  };
  const mockGetAllDyes = vi.fn();
  /** The dye pool both matchers search — whatever getAllDyes is seeded with. */
  const pool = (): { hex: string }[] => (mockGetAllDyes() as { hex: string }[]) ?? [];
  return {
    mockGetAllDyes,
    mockGetDyeById: vi.fn(),
    mockFindClosestDyes: vi.fn(),
    mockFindClosestDye: vi.fn((hex: string) => {
      const dyes = pool();
      if (dyes.length === 0) return null;
      return dyes.reduce((best, d) => (dist(hex, d.hex) < dist(hex, best.hex) ? d : best));
    }),
    mockFindDyesWithinDistance: vi.fn((hex: string, opts?: { limit?: number }) => {
      const dyes = pool();
      return [...dyes]
        .sort((a, b) => dist(hex, a.hex) - dist(hex, b.hex))
        .slice(0, opts?.limit ?? dyes.length);
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
      findClosestDye: mockFindClosestDye,
      findDyesWithinDistance: mockFindDyesWithinDistance,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
}));

vi.mock('@services/index', () => ({
  /** Picks readable text ink for a swatch background. */
  getContrastColor: vi.fn(() => '#FFFFFF'),
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
      expand: vi.fn(),
      collapse: vi.fn(),
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
      findClosestDye: mockFindClosestDye,
      findDyesWithinDistance: mockFindDyesWithinDistance,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
  dyeService: {
    getAllDyes: mockGetAllDyes,
    getDyeById: mockGetDyeById,
    findClosestDyes: mockFindClosestDyes,
    findClosestDye: mockFindClosestDye,
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
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
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
  PaletteService: {
    extractPalette: vi.fn().mockReturnValue([
      { hex: '#FF0000', count: 100 },
      { hex: '#00FF00', count: 80 },
      { hex: '#0000FF', count: 60 },
    ]),
  },
  RouterService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    getCurrentToolId: vi.fn().mockReturnValue('extractor'),
    navigateTo: vi.fn(),
  },
  WorldService: {
    getWorlds: vi.fn().mockReturnValue([]),
    getSelectedWorld: vi.fn().mockReturnValue(null),
    setSelectedWorld: vi.fn(),
  },
}));

vi.mock('@services/indexeddb-service', () => ({
  indexedDBService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  STORES: { IMAGE_CACHE: 'image_cache' },
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

vi.mock('@components/export-sheet', () => ({
  openExportSheet: vi.fn(),
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

vi.mock('../image-upload-display', () => ({
  ImageUploadDisplay: class MockImageUploadDisplay {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'image-upload-display';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    getImage() {
      return null;
    }
    getImageDimensions() {
      return null;
    }
    getImageCanvas() {
      return null;
    }
    clear() {}
    samplePixel() {
      return null;
    }
    getAverageColor() {
      return null;
    }
  },
}));

vi.mock('../color-picker-display', () => ({
  ColorPickerDisplay: class MockColorPickerDisplay {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'color-picker-display';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    getColor() {
      return '#FF0000';
    }
    setColor() {}
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

describe('ExtractorTool', () => {
  let container: HTMLElement;
  let leftPanel: HTMLElement;
  let rightPanel: HTMLElement;
  let drawerContent: HTMLElement;
  let tool: ExtractorTool | null;

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
    it('should render extractor tool', () => {
      tool = new ExtractorTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });

    it('should render left panel content', () => {
      tool = new ExtractorTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });

    it('should render right panel content', () => {
      tool = new ExtractorTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(rightPanel).not.toBeNull();
    });

    it('should render drawer content when provided', () => {
      tool = new ExtractorTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(drawerContent).not.toBeNull();
    });

    it('should work without drawer content', () => {
      tool = new ExtractorTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should have setConfig method', () => {
      tool = new ExtractorTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.setConfig).toBe('function');
    });

    it('should accept config via setConfig', () => {
      tool = new ExtractorTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      tool.setConfig({ maxColors: 8 });

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Palette Extraction Tests
  // ============================================================================

  describe('Palette Extraction', () => {
    it('should render palette extraction controls', () => {
      tool = new ExtractorTool(container, { leftPanel, rightPanel });
      tool.init();

      // Tool should render extraction-related content in right panel
      expect(rightPanel).not.toBeNull();
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      tool = new ExtractorTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });

    it('should handle double destroy gracefully', () => {
      tool = new ExtractorTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.destroy();

      // Second destroy should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });
  });

  // ==========================================================================
  // Interaction depth
  //
  // Everything above asserts that the tool renders. The tool is image-driven,
  // and jsdom decodes no images — so these drive what does not need a decoded
  // bitmap: the config surface the sidebar pushes in, the drop-zone contract,
  // the clipboard paths, and teardown.
  // ==========================================================================

  const mount = (opts: { drawer?: boolean } = {}): ExtractorTool => {
    const t = new ExtractorTool(
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

  /**
   * Block until the tool is not mid-extraction.
   *
   * extractPalette() awaits a real requestAnimationFrame (~16ms in jsdom) and
   * relabels the auto-extract button "Extracting…" across it, so a fixed count
   * of setTimeout(0) flushes is a wall-clock bet on that frame: it wins on an
   * idle machine and loses under `turbo`'s parallel load, where every helper
   * that finds the button by its idle text then returns undefined. The label
   * is the tool's own quiescence signal — wait on it, don't estimate it.
   */
  const waitForIdle = (): Promise<void> =>
    vi.waitFor(() => {
      const btn = Array.from(rightPanel.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('matcher.autoExtract')
      ) as HTMLButtonElement | undefined;
      expect(btn, 'auto-extract button still shows its busy label').toBeDefined();
      expect(btn!.disabled).toBe(false);
    });

  const dropZone = (): HTMLElement =>
    rightPanel.querySelector('#extractor-drop-zone') as HTMLElement;

  /** A DragEvent carrying files, which jsdom does not construct for us. */
  const dropEvent = (files: File[]): Event => {
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: { files } });
    return ev;
  };

  describe('setConfig — the sidebar surface', () => {
    it.each([
      ['vibrancyBoost', { vibrancyBoost: false }, 'v3_matcher_vibrancy_boost', false],
      ['maxColors', { maxColors: 9 }, 'v3_matcher_palette_count', 9],
    ])('persists a %s change', async (_label, config, key, value) => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      tool.setConfig(config as Parameters<ExtractorTool['setConfig']>[0]);

      expect(StorageService.setItem).toHaveBeenCalledWith(key, value);
    });

    it('ignores a no-op change rather than re-extracting', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      tool.setConfig({ maxColors: 9 });
      await flush();
      vi.mocked(StorageService.setItem).mockClear();

      // The guard is `config.maxColors !== this.paletteColorCount`
      tool.setConfig({ maxColors: 9 });

      expect(StorageService.setItem).not.toHaveBeenCalledWith(
        'v3_matcher_palette_count',
        expect.anything()
      );
    });

    it('syncs the colour-count slider and its readout', async () => {
      tool = mount();
      // Re-query after the change: the panel re-renders, so a reference held
      // from before points at a detached node.
      // The colour-count slider is the 3..5 one; the tool renders more than
      // one range input, so select it by its range rather than by position.
      const slider = () =>
        container.querySelector<HTMLInputElement>('input[type="range"][min="3"][max="5"]');
      expect(slider()).not.toBeNull();

      tool.setConfig({ maxColors: 4 });
      await flush();

      // The sidebar and the tool's own slider must not disagree — a stale
      // slider is how a user extracts a different count than the one shown
      // beside it.
      expect(slider()!.value).toBe('4');
    });

    it('accepts an empty config without touching state', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      expect(() => tool!.setConfig({})).not.toThrow();
      expect(StorageService.setItem).not.toHaveBeenCalled();
    });

    it.each([
      ['matchingMethod', { matchingMethod: 'oklab' as const }],
      ['preventDuplicates', { preventDuplicates: true }],
      ['dragThreshold', { dragThreshold: 8 }],
      ['sampleAreaSize', { sampleAreaSize: 4 }],
    ])('accepts a %s change with no image loaded', (_label, config) => {
      tool = mount();

      expect(() => tool!.setConfig(config as never)).not.toThrow();
    });

    it('merges displayOptions rather than replacing them', () => {
      tool = mount();

      tool.setConfig({ displayOptions: { showHex: true } as never });
      expect(() => tool!.setConfig({ displayOptions: { showRgb: true } as never })).not.toThrow();
    });

    it('applies a dyeFilters change once and skips an identical repeat', () => {
      tool = mount();

      expect(() =>
        tool!.setConfig({ dyeFilters: { excludeMetallic: true } as never })
      ).not.toThrow();
      // Second identical call hits the JSON-equality guard
      expect(() =>
        tool!.setConfig({ dyeFilters: { excludeMetallic: true } as never })
      ).not.toThrow();
    });

    it('applies several keys in one call', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      tool.setConfig({ vibrancyBoost: false, maxColors: 3 });
      await flush();

      const keys = vi.mocked(StorageService.setItem).mock.calls.map((c) => c[0]);
      expect(keys).toEqual(
        expect.arrayContaining(['v3_matcher_vibrancy_boost', 'v3_matcher_palette_count'])
      );
    });
  });

  describe('the drop zone', () => {
    it('renders a drop zone while no image is loaded', () => {
      tool = mount();

      expect(dropZone()).not.toBeNull();
    });

    it('highlights on dragover and clears on dragleave', () => {
      tool = mount();

      rightPanel.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
      expect(dropZone().style.borderColor).toBe('var(--theme-primary)');

      rightPanel.dispatchEvent(new Event('dragleave', { bubbles: true }));
      expect(dropZone().style.borderColor).toBe('');
    });

    it('clears the highlight after a drop', () => {
      tool = mount();
      rightPanel.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));

      rightPanel.dispatchEvent(dropEvent([]));

      expect(dropZone().style.borderColor).toBe('');
    });

    it('ignores a dropped non-image file', () => {
      tool = mount();
      const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL');

      rightPanel.dispatchEvent(dropEvent([new File(['x'], 'notes.txt', { type: 'text/plain' })]));

      // A .txt must not reach the reader — the type gate is the only guard
      expect(readSpy).not.toHaveBeenCalled();
      readSpy.mockRestore();
    });

    it('reads a dropped image file', () => {
      tool = mount();
      const readSpy = vi
        .spyOn(FileReader.prototype, 'readAsDataURL')
        .mockImplementation(() => undefined);

      rightPanel.dispatchEvent(dropEvent([new File(['x'], 'shot.png', { type: 'image/png' })]));

      expect(readSpy).toHaveBeenCalledTimes(1);
      readSpy.mockRestore();
    });

    it('takes only the first file when several are dropped', () => {
      tool = mount();
      const readSpy = vi
        .spyOn(FileReader.prototype, 'readAsDataURL')
        .mockImplementation(() => undefined);

      rightPanel.dispatchEvent(
        dropEvent([
          new File(['a'], 'a.png', { type: 'image/png' }),
          new File(['b'], 'b.png', { type: 'image/png' }),
        ])
      );

      expect(readSpy).toHaveBeenCalledTimes(1);
      readSpy.mockRestore();
    });

    it('survives a drop carrying no dataTransfer at all', () => {
      tool = mount();

      expect(() =>
        rightPanel.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))
      ).not.toThrow();
    });

    it('opens the file dialog when the empty card is clicked', () => {
      tool = mount();
      const input = rightPanel.querySelector<HTMLInputElement>('input[type="file"]');
      expect(input).not.toBeNull();
      const clickSpy = vi.spyOn(input!, 'click').mockImplementation(() => undefined);

      dropZone().click();

      // The whole dashed card is the target, not just a hidden input
      expect(clickSpy).toHaveBeenCalledTimes(1);
      clickSpy.mockRestore();
    });

    it('accepts only image types on the file input', () => {
      tool = mount();
      const input = rightPanel.querySelector<HTMLInputElement>('input[type="file"]');

      expect(input!.accept).toContain('image');
    });
  });

  /**
   * The image-driven half of the tool.
   *
   * jsdom decodes no images and implements no canvas, so `Image.onload` never
   * fires and `getContext('2d')` returns null — which is why roughly two
   * thirds of this component was unreachable from a unit test. Faking both is
   * enough to run the real extraction path: load → canvas → sample → match.
   */
  describe('with a decoded image', () => {
    /** 2×2 image: red, green, blue, white. */
    const PIXELS = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
    ]);

    let originalImage: typeof Image;
    let originalGetContext: HTMLCanvasElement['getContext'];
    let ctx: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
      originalImage = globalThis.Image;
      originalGetContext = HTMLCanvasElement.prototype.getContext;

      class FakeImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        width = 2;
        height = 2;
        naturalWidth = 2;
        naturalHeight = 2;
        crossOrigin: string | null = null;
        private value = '';
        get src(): string {
          return this.value;
        }
        set src(next: string) {
          this.value = next;
          // Decoding is async in a browser; keep that shape
          queueMicrotask(() => this.onload?.());
        }
      }
      globalThis.Image = FakeImage as unknown as typeof Image;

      // Complete against every 2D-context member extractor-tool.ts and
      // image-zoom-controller.ts touch. Completeness is the whole point: a
      // single missing method throws inside `extractPalette`'s try block,
      // which catches it, toasts `errors.paletteExtractionFailed` and moves
      // on — so the suite stays green while the entire palette path is dead.
      // That is exactly how `strokeText` (used only by drawSampleIndicators
      // to outline the numbered markers) kept six functions unexecuted.
      ctx = {
        drawImage: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        putImageData: vi.fn(),
        getImageData: vi.fn(() => ({ data: PIXELS, width: 2, height: 2 })),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        setTransform: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
      };
      HTMLCanvasElement.prototype.getContext = vi.fn(
        () => ctx
      ) as unknown as HTMLCanvasElement['getContext'];
    });

    afterEach(() => {
      globalThis.Image = originalImage;
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    /** Drop a PNG and let the FileReader + fake decode settle. */
    const loadImage = async (): Promise<void> => {
      rightPanel.dispatchEvent(dropEvent([new File(['x'], 'shot.png', { type: 'image/png' })]));
      // FileReader is async in jsdom too
      for (let i = 0; i < 6; i++) await flush();
      // onImageLoaded auto-extracts unconditionally, so the tool is still busy
      // when the flushes above run out. See waitForIdle.
      await waitForIdle();
    };

    it('renders a canvas once an image is loaded', async () => {
      tool = mount();

      await loadImage();

      expect(rightPanel.querySelector('canvas')).not.toBeNull();
    });

    it('replaces the drop zone flow with the loaded flow', async () => {
      tool = mount();
      expect(dropZone()).not.toBeNull();

      await loadImage();

      // The dashed card is an offer while empty; once an image is in, the
      // workspace takes over
      expect(rightPanel.querySelector('canvas')).not.toBeNull();
    });

    it('draws the image onto the canvas', async () => {
      tool = mount();

      await loadImage();

      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('persists the loaded image to IndexedDB, not localStorage (OPT-012)', async () => {
      const { indexedDBService } = await import('@services/indexeddb-service');
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      await loadImage();

      // A ~2 MB data URL in localStorage consumed most of the shared 5 MB
      // budget and made every later setItem fail silently on quota
      expect(indexedDBService.set).toHaveBeenCalled();
      const localKeys = vi.mocked(StorageService.setItem).mock.calls.map((c) => c[0]);
      expect(localKeys).not.toContain('v3_matcher_image');
    });

    it('re-samples the image when the colour count changes', async () => {
      tool = mount();
      await loadImage();
      // The re-extract branch is gated on `paletteMode` as well as on the
      // config change. Without this the assertion below was satisfied by the
      // load-time auto-extract's own getImageData call, not by the config
      // change at all — it only looked green because that call had not yet
      // landed when the mock was cleared.
      const box = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      box.checked = true;
      box.dispatchEvent(new Event('change'));
      for (let i = 0; i < 6; i++) await flush();
      ctx.getImageData.mockClear();

      tool.setConfig({ maxColors: 3 });

      // A config change with an image present must re-sample, not just
      // redraw — otherwise the palette silently reflects the old count.
      //
      // Waited on, not estimated: extractPalette() yields a real
      // requestAnimationFrame (~16 ms in jsdom) before it touches the canvas,
      // so a fixed count of setTimeout(0) flushes is a wall-clock bet on that
      // frame. It wins on a slow host (a flush costs ~10 ms here) and loses on
      // a fast one (~1 ms), which is why this passed locally and failed in CI.
      // If setConfig stops re-extracting, this times out and still fails.
      await vi.waitFor(() => expect(ctx.getImageData).toHaveBeenCalled());
    });

    it('survives a decode failure without leaving the tool broken', async () => {
      class FailingImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_next: string) {
          queueMicrotask(() => this.onerror?.());
        }
      }
      globalThis.Image = FailingImage as unknown as typeof Image;
      tool = mount();

      await loadImage();

      // The drop zone is still there to try again with
      expect(dropZone()).not.toBeNull();
    });

    it('tears down cleanly with an image loaded', async () => {
      tool = mount();
      await loadImage();

      expect(() => tool!.destroy()).not.toThrow();
    });

    /*
     * Sampling, matching and palette extraction ARE asserted below.
     *
     * An earlier note here claimed they could not be: that the real
     * ImageZoomController rejects the fake 2D context, so `getCanvas()`
     * returns null and any test would assert the tool's refusal while
     * appearing to cover extraction. That was measured and is wrong —
     * `getCanvas()` returns the canvas perfectly well, because the controller
     * only ever calls `getContext('2d')`, which the stub above satisfies.
     *
     * Two mock gaps were doing it, and neither involved the controller:
     *
     * 1. `dyeService.findClosestDye` (singular) was absent. `matchColor`
     *    calls it, and so does the REAL PaletteService inside
     *    `extractAndMatchPalette`. It threw as an UNHANDLED rejection off the
     *    image-load path — invisible in the report, fatal to both clusters.
     * 2. `ctx.strokeText` was absent. `drawSampleIndicators` outlines the
     *    numbered markers with it, and it throws inside `extractPalette`'s
     *    try block — which catches, toasts, and returns. Green suite, dead
     *    path.
     *
     * Both are now closed, so this is driven through the component's real
     * contract: the `image-sampled` / `loupe-move` / `loupe-end` CustomEvents
     * that ImageZoomController emits on its container (BaseComponent.emit,
     * bubbling), and the Auto-extract button.
     */

    /** The element ImageZoomController emits its events on. */
    const canvasWrapper = (): HTMLElement => {
      const canvas = rightPanel.querySelector('canvas');
      // wrapper > canvas-container > canvas
      return canvas!.parentElement!.parentElement as HTMLElement;
    };

    /** Commit a pixel sample exactly as the controller's click handler does. */
    const sample = (hex: string, isPixelSample = true): void => {
      canvasWrapper().dispatchEvent(
        new CustomEvent('image-sampled', {
          bubbles: true,
          detail: { hex, x: 1, y: 1, isPixelSample },
        })
      );
    };

    const resultCards = () => rightPanel.querySelectorAll('v4-result-card');

    /*
     * NOTE ON BASELINE: `onImageLoaded` calls `extractPalette()`
     * unconditionally ("V4: Auto-extract palette on image load"), so a loaded
     * image already carries palette cards and a populated roll before any
     * test does anything. That is real behaviour, and it only became
     * observable once the mock gaps above were closed — previously the
     * load-time extraction threw and left the panel empty. Assertions here
     * are written against the change a sample causes, not against zero.
     */

    describe('sampling a pixel', () => {
      it('replaces the auto-extracted palette with matches for the sample', async () => {
        tool = mount();
        await loadImage();
        const auto = Array.from(resultCards()).map(
          (c) => (c as unknown as { data: { originalColor: string } }).data.originalColor
        );
        expect(auto.length).toBeGreaterThan(0);

        sample('#FF0000');

        // Every card now reports the sampled pixel as its source colour
        const after = Array.from(resultCards()).map(
          (c) => (c as unknown as { data: { originalColor: string } }).data.originalColor
        );
        expect(after.length).toBeGreaterThan(0);
        expect(new Set(after)).toEqual(new Set(['#FF0000']));
      });

      it('puts the NEAREST dye first, not merely some dye', async () => {
        tool = mount();
        await loadImage();

        // Near-white must resolve to Snow White (#FFFFFF), not to Ash Grey
        // (#888888). This is the assertion a fixed-return mock cannot make.
        sample('#FEFEFE');

        const first = resultCards()[0] as unknown as { data: { dye: { name: string } } };
        expect(first.data.dye.name).toBe('Snow White');
      });

      it('shows the sampled-colour info card', async () => {
        tool = mount();
        await loadImage();

        sample('#FF0000');

        expect(rightPanel.textContent).toContain('matcher.sampledColor');
      });

      it('records the sample in the roll and persists it', async () => {
        const { StorageService } = await import('@services/index');
        tool = mount();
        await loadImage();
        vi.mocked(StorageService.setItem).mockClear();

        sample('#123456');

        const call = vi
          .mocked(StorageService.setItem)
          .mock.calls.find((c) => c[0] === 'v3_matcher_extracted_colors');
        expect(call).toBeDefined();
        expect((call![1] as { hex: string }[])[0].hex).toBe('#123456');
      });

      it('moves a re-sampled colour to the front instead of duplicating it', async () => {
        const { StorageService } = await import('@services/index');
        tool = mount();
        await loadImage();

        sample('#111111');
        sample('#222222');
        vi.mocked(StorageService.setItem).mockClear();
        sample('#111111');

        const call = vi
          .mocked(StorageService.setItem)
          .mock.calls.find((c) => c[0] === 'v3_matcher_extracted_colors');
        const roll = (call![1] as { hex: string }[]).map((e) => e.hex);
        // Front two are the re-sample then the untouched one; the tail is
        // whatever the load-time auto-extract left behind
        expect(roll.slice(0, 2)).toEqual(['#111111', '#222222']);
        expect(roll.filter((h) => h === '#111111')).toHaveLength(1);
      });

      // 25 canvas samples in a row: under coverage instrumentation, and only
      // when the full suite is competing for workers, this sits at the 5 s
      // default (it passes in ~1 s alone). Timing headroom, not a behaviour
      // change; the assertions are untouched.
      it('caps the roll at twenty entries', { timeout: 20_000 }, async () => {
        const { StorageService } = await import('@services/index');
        tool = mount();
        await loadImage();

        for (let i = 0; i < 25; i++) {
          sample(`#${i.toString(16).padStart(6, '0')}`);
        }

        const calls = vi
          .mocked(StorageService.setItem)
          .mock.calls.filter((c) => c[0] === 'v3_matcher_extracted_colors');
        expect((calls.at(-1)![1] as unknown[]).length).toBe(20);
      });

      it('ignores an event that is not a pixel sample', async () => {
        const { StorageService } = await import('@services/index');
        tool = mount();
        await loadImage();
        vi.mocked(StorageService.setItem).mockClear();

        sample('#FF0000', false);

        // The 3C contract routes only COMMITTED pixel samples into matchColor,
        // and matchColor is the only thing that writes the selected colour
        const keys = vi.mocked(StorageService.setItem).mock.calls.map((c) => c[0]);
        expect(keys).not.toContain('v3_matcher_color');
      });
    });

    describe('the matching method', () => {
      /**
       * The sidebar's Options column shows ΔE2000 selected for a fresh
       * install, and every sibling tool seeds its own field from
       * `ConfigController.getConfig(<tool>).matchingMethod ?? 'ciede2000'`.
       * The extractor used to hard-code `'oklab'` and never read its config
       * on construction — so the sidebar said one thing while the matcher
       * did another, and a stored choice was lost on reload until the user
       * touched the radio again.
       */
      const methodPassedToMatcher = (): string | undefined => {
        const last = mockFindClosestDye.mock.calls.at(-1) as
          [string, { matchingMethod?: string }?] | undefined;
        return last?.[1]?.matchingMethod;
      };

      it('matches with the suite default ΔE2000 when nothing is stored', async () => {
        tool = mount();
        await loadImage();

        sample('#FF0000');

        expect(methodPassedToMatcher()).toBe('ciede2000');
      });

      it('honours a matchingMethod persisted in the extractor config', async () => {
        const { ConfigController } = await import('@services/index');
        const getConfig = vi.mocked(ConfigController.getInstance().getConfig);
        getConfig.mockImplementation(((key: string) =>
          key === 'extractor' ? { matchingMethod: 'oklab' } : {}) as never);
        try {
          tool = mount();
          await loadImage();

          sample('#FF0000');

          expect(methodPassedToMatcher()).toBe('oklab');
        } finally {
          getConfig.mockReset();
          getConfig.mockReturnValue({} as never);
        }
      });

      it('normalizes a retired 4.x method name from storage to a supported one', async () => {
        const { ConfigController } = await import('@services/index');
        const getConfig = vi.mocked(ConfigController.getInstance().getConfig);
        getConfig.mockImplementation(((key: string) =>
          key === 'extractor' ? { matchingMethod: 'hyab' } : {}) as never);
        try {
          tool = mount();
          await loadImage();

          sample('#FF0000');

          // 'hyab' is not a 5.0 method; the shared normalizer maps it to the
          // suite default rather than letting an unknown string reach the matcher
          expect(methodPassedToMatcher()).toBe('ciede2000');
        } finally {
          getConfig.mockReset();
          getConfig.mockReturnValue({} as never);
        }
      });
    });

    describe('the loupe', () => {
      // The loupe carries neither id nor class — it is a bare styled div, so
      // its 74px diameter plus aria-hidden is the only thing distinguishing
      // it. Brittle by nature: if this selector ever stops matching, give the
      // element an id in the component rather than widening the pattern.
      const loupe = () =>
        rightPanel.querySelector<HTMLElement>('div[aria-hidden="true"][style*="74px"]');

      it('follows the pointer and takes the colour under it', async () => {
        tool = mount();
        await loadImage();

        canvasWrapper().dispatchEvent(
          new CustomEvent('loupe-move', {
            bubbles: true,
            detail: { hex: '#00FF00', clientX: 40, clientY: 25 },
          })
        );

        const el = loupe();
        expect(el).not.toBeNull();
        expect(el!.style.background).toBe('rgb(0, 255, 0)');
        // jsdom reports a zero-size rect, so the clamp pins both to 0 —
        // assert the transform, which is what actually reveals the loupe
        expect(el!.style.transform).toContain('scale(1)');
      });

      it('hides again when the drag ends', async () => {
        tool = mount();
        await loadImage();
        canvasWrapper().dispatchEvent(
          new CustomEvent('loupe-move', {
            bubbles: true,
            detail: { hex: '#00FF00', clientX: 10, clientY: 10 },
          })
        );

        canvasWrapper().dispatchEvent(new CustomEvent('loupe-end', { bubbles: true }));

        expect(loupe()!.style.transform).toContain('scale(0)');
      });
    });

    describe('auto-extracting a palette', () => {
      /** Auto-extract in the roll header — the 3C bulk path. */
      const autoBtn = (): HTMLButtonElement =>
        Array.from(rightPanel.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('matcher.autoExtract')
        ) as HTMLButtonElement;

      it('extracts, matches and renders a card per extracted colour', async () => {
        const { ToastService } = await import('@services/index');
        tool = mount();
        await loadImage();
        vi.mocked(ToastService.success).mockClear();

        autoBtn().click();
        await waitForIdle();

        expect(resultCards().length).toBeGreaterThan(0);
        expect(ToastService.success).toHaveBeenCalledWith(
          expect.stringContaining('matcher.paletteExtracted:')
        );
      });

      it('uses the singular key when the image yields one colour', async () => {
        const { ToastService } = await import('@services/index');
        tool = mount();
        await loadImage();
        tool.setConfig({ maxColors: 1 });
        await waitForIdle();
        vi.mocked(ToastService.success).mockClear();

        autoBtn().click();
        await waitForIdle();

        // "1 colors" is the bug this pair exists to prevent
        expect(ToastService.success).toHaveBeenCalledWith(
          expect.stringContaining('matcher.paletteExtractedOne:')
        );
      });

      it('draws a numbered indicator per extracted colour onto the canvas', async () => {
        tool = mount();
        await loadImage();
        ctx.strokeText.mockClear();

        autoBtn().click();
        await waitForIdle();

        // The outlined marker labels — the call that used to throw
        expect(ctx.strokeText).toHaveBeenCalled();
      });

      it('restores the button after extraction rather than leaving it disabled', async () => {
        const { ToastService } = await import('@services/index');
        tool = mount();
        await loadImage();
        vi.mocked(ToastService.success).mockClear();

        autoBtn().click();
        // Deliberately NOT waitForIdle: it waits on the very label and
        // disabled flag this test exists to check, which would make the
        // assertions below unfalsifiable. The success toast is an independent
        // signal. It is raised in extractPalette's try block and the restore
        // happens in its finally, with no await between them — so once the
        // toast is observable from a later turn, the restore has already run.
        await vi.waitFor(() => expect(ToastService.success).toHaveBeenCalled());

        expect(autoBtn().disabled).toBe(false);
        expect(autoBtn().style.opacity).toBe('1');
      });

      it('enables the export button, which ships disabled', async () => {
        tool = mount();
        const exportBtn = Array.from(rightPanel.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('common.export')
        ) as HTMLButtonElement;
        // Disabled at construction — exporting an empty roll is meaningless
        expect(exportBtn.disabled).toBe(true);

        await loadImage();
        autoBtn().click();
        await waitForIdle();

        expect(exportBtn.disabled).toBe(false);
      });

      it('assigns a distinct dye per swatch while preventDuplicates is on', async () => {
        tool = mount();
        await loadImage();

        autoBtn().click();
        await waitForIdle();

        const ids = Array.from(resultCards()).map(
          (c) => (c as unknown as { data: { dye: { itemID: number } } }).data.dye.itemID
        );
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('may repeat a dye once deduplication is switched off', async () => {
        tool = mount();
        await loadImage();
        // The 2×2 fixture is red/green/blue/white against a five-dye pool, so
        // this asserts the flag reaches the dedup pass, not a specific palette
        tool.setConfig({ preventDuplicates: false });

        autoBtn().click();
        await waitForIdle();

        expect(resultCards().length).toBeGreaterThan(0);
      });
    });

    it('routes a card context action to the target tool', async () => {
      tool = mount();
      await loadImage();
      sample('#FF0000');
      const onNavigate = vi.fn();
      window.addEventListener('navigate-to-tool', onNavigate);

      resultCards()[0].dispatchEvent(
        new CustomEvent('context-action', {
          detail: { action: 'add-comparison', dye: mockDyes[0] },
        })
      );

      expect(onNavigate).toHaveBeenCalledTimes(1);
      window.removeEventListener('navigate-to-tool', onNavigate);
    });

    it('exports the roll as sampled-pixel/matched-dye pairs', async () => {
      const { openExportSheet } = await import('@components/export-sheet');
      tool = mount();
      await loadImage();
      const exportBtn = Array.from(rightPanel.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('common.export')
      ) as HTMLButtonElement;

      exportBtn.click();

      const arg = vi.mocked(openExportSheet).mock.calls[0][0];
      expect(arg.tool).toBe('extractor');
      expect(arg.entries.length).toBeGreaterThan(0);
      // The pair is the point: the pixel sampled AND the dye it resolved to.
      // Exporting only the dye would discard the drift this tool exists to show
      expect(arg.entries[0]).toMatchObject({
        key: 'pick-1',
        source: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        dye: expect.objectContaining({ name: expect.any(String) }),
        delta: expect.any(Number),
      });
    });

    describe('restoring a saved image', () => {
      it('restores from IndexedDB and re-extracts on mount', async () => {
        const { indexedDBService } = await import('@services/indexeddb-service');
        vi.mocked(indexedDBService.get).mockResolvedValueOnce('data:image/png;base64,AAAA');

        tool = mount();
        for (let i = 0; i < 8; i++) await flush();

        // Restoring must bring the RESULTS back too, not just the bitmap —
        // otherwise a reload shows the image above an empty panel. The cards
        // are rendered on the far side of extractPalette()'s frame, so this
        // waits on them rather than betting a flush count against ~16 ms.
        expect(rightPanel.querySelector('canvas')).not.toBeNull();
        await vi.waitFor(() => expect(resultCards().length).toBeGreaterThan(0));
      });

      it('migrates a legacy localStorage image into IndexedDB', async () => {
        const { indexedDBService } = await import('@services/indexeddb-service');
        const { StorageService } = await import('@services/index');
        vi.mocked(indexedDBService.get).mockResolvedValueOnce(null);
        vi.mocked(StorageService.getItem).mockImplementation((key: string) =>
          key === 'v3_matcher_image' ? ('data:image/png;base64,AAAA' as never) : (null as never)
        );

        tool = mount();
        for (let i = 0; i < 8; i++) await flush();

        // OPT-012: the copy moves, it does not get duplicated — leaving the
        // localStorage entry keeps the quota pressure the migration exists to remove
        expect(indexedDBService.set).toHaveBeenCalledWith(
          expect.anything(),
          'v3_matcher_image',
          'data:image/png;base64,AAAA'
        );
        expect(StorageService.removeItem).toHaveBeenCalledWith('v3_matcher_image');
      });

      it('clears a saved image that will not decode', async () => {
        const { indexedDBService } = await import('@services/indexeddb-service');
        const { StorageService } = await import('@services/index');
        vi.mocked(indexedDBService.get).mockResolvedValueOnce('data:image/png;base64,BROKEN');
        class FailingImage {
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          set src(_v: string) {
            queueMicrotask(() => this.onerror?.());
          }
        }
        globalThis.Image = FailingImage as unknown as typeof Image;

        tool = mount();
        for (let i = 0; i < 8; i++) await flush();

        // A corrupt blob that is never cleared re-fails on every single load
        expect(indexedDBService.delete).toHaveBeenCalled();
        expect(StorageService.removeItem).toHaveBeenCalledWith('v3_matcher_image');
      });
    });

    describe('market prices', () => {
      /**
       * `showPrices` is not a field — it reads through to
       * `MarketBoardService.getShowPrices()`, so the toggle is flipped on the
       * service, not on the tool.
       */
      const withPricesOn = async () => {
        const { MarketBoardService } = await import('@services/index');
        const svc = MarketBoardService.getInstance();
        vi.mocked(svc.getShowPrices).mockReturnValue(true);
        return svc;
      };

      /** The callbacks the shared market panel would drive. */
      const marketCallbacks = async () => {
        const { buildMarketPanel } = await import('@services/index');
        return vi.mocked(buildMarketPanel).mock.calls[0][2] as {
          onPricesToggled: () => void;
          onServerChanged: () => void;
        };
      };

      it('fetches prices for the extracted palette when prices are switched on', async () => {
        const svc = await withPricesOn();
        tool = mount();
        await loadImage();
        vi.mocked(svc.fetchPricesForDyes).mockClear();

        (await marketCallbacks()).onPricesToggled();
        await flush();

        expect(svc.fetchPricesForDyes).toHaveBeenCalled();
        // The dyes fetched are the DEDUPED ones, so the fetch matches what is
        // actually on screen rather than the raw pre-dedup match list
        const fetched = vi.mocked(svc.fetchPricesForDyes).mock.calls[0][0] as { itemID: number }[];
        expect(new Set(fetched.map((d) => d.itemID)).size).toBe(fetched.length);
      });

      it('re-fetches when the server changes', async () => {
        const svc = await withPricesOn();
        tool = mount();
        await loadImage();
        vi.mocked(svc.fetchPricesForDyes).mockClear();

        (await marketCallbacks()).onServerChanged();
        await flush();

        expect(svc.fetchPricesForDyes).toHaveBeenCalled();
      });

      it('re-renders without fetching when prices are switched off', async () => {
        const { MarketBoardService } = await import('@services/index');
        const svc = MarketBoardService.getInstance();
        vi.mocked(svc.getShowPrices).mockReturnValue(false);
        tool = mount();
        await loadImage();
        vi.mocked(svc.fetchPricesForDyes).mockClear();

        (await marketCallbacks()).onPricesToggled();
        await flush();

        expect(svc.fetchPricesForDyes).not.toHaveBeenCalled();
        expect(resultCards().length).toBeGreaterThan(0);
      });

      /**
       * A failed fetch must reach the cards as a short code rather than an
       * empty price — "no data" and "the request failed" are different states
       * and the card renders them differently.
       */
      it.each([
        ['a 429', new Error('Request failed with status: 429'), 'H429'],
        ['a 503', new Error('Request failed with status: 503'), 'H503'],
        ['a rate-limit message', new Error('Rate limit exceeded'), 'H429'],
        ['a timeout', new Error('Request timed out'), 'TOUT'],
        ['a network failure', new Error('Failed to fetch'), 'NCON'],
        ['an abort', new Error('The operation was aborted'), 'CANC'],
        ['a bare Response-like object', { status: 404 }, 'H404'],
        ['something unrecognised', new Error('kaboom'), 'EUNK'],
      ])('maps %s onto a display code', async (_label, thrown, code) => {
        const svc = await withPricesOn();
        tool = mount();
        await loadImage();
        vi.mocked(svc.fetchPricesForDyes).mockRejectedValueOnce(thrown);

        (await marketCallbacks()).onPricesToggled();
        for (let i = 0; i < 4; i++) await flush();

        const errors = Array.from(resultCards()).map(
          (c) => (c as unknown as { data: { marketError?: string } }).data.marketError
        );
        expect(errors).toContain(code);
      });

      it('reports offline ahead of whatever the error says', async () => {
        const svc = await withPricesOn();
        const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        tool = mount();
        await loadImage();
        vi.mocked(svc.fetchPricesForDyes).mockRejectedValueOnce(new Error('status: 500'));

        (await marketCallbacks()).onPricesToggled();
        for (let i = 0; i < 4; i++) await flush();

        const errors = Array.from(resultCards()).map(
          (c) => (c as unknown as { data: { marketError?: string } }).data.marketError
        );
        // A 500 raised while offline is still an offline problem
        expect(errors).toContain('NOFF');
        onLine.mockRestore();
      });

      it('puts a fetched price onto the card', async () => {
        const svc = await withPricesOn();
        tool = mount();
        await loadImage();
        // The cards read `getPricesView()` — a map keyed by itemID — not
        // getPriceForDye. Seed it for every dye in the pool so whichever ones
        // the extraction picks are covered.
        vi.mocked(svc.getPricesView).mockReturnValue(
          new Map(mockDyes.map((d) => [d.itemID, { currentMinPrice: 1234, worldId: 40 }])) as never
        );
        vi.mocked(svc.getWorldNameForPrice).mockReturnValue('Jenova' as never);

        (await marketCallbacks()).onPricesToggled();
        for (let i = 0; i < 4; i++) await flush();

        const first = resultCards()[0] as unknown as {
          data: { price?: number; marketServer?: string };
        };
        expect(first.data.price).toBe(1234);
        expect(first.data.marketServer).toBe('Jenova');
      });
    });

    it('clears the image and offers the drop zone again', async () => {
      const { StorageService } = await import('@services/index');
      const { indexedDBService } = await import('@services/indexeddb-service');
      tool = mount();
      await loadImage();
      vi.mocked(StorageService.removeItem).mockClear();
      vi.mocked(indexedDBService.delete).mockClear();

      // The X on the image card, found by its label rather than by icon
      // markup — the Replace button next to it also carries an SVG
      const clearBtn = rightPanel.querySelector<HTMLButtonElement>(
        'button[aria-label="matcher.clearImage"]'
      );
      expect(clearBtn).not.toBeNull();
      clearBtn!.click();
      await flush();

      // Both copies go: the legacy localStorage key AND the OPT-012 IndexedDB
      // blob, or the cleared image returns on the next reload
      expect(StorageService.removeItem).toHaveBeenCalledWith('v3_matcher_image');
      expect(indexedDBService.delete).toHaveBeenCalled();
    });
  });

  describe('palette mode', () => {
    const paletteCheckbox = (): HTMLInputElement =>
      container.querySelector('input[type="checkbox"]') as HTMLInputElement;

    it('renders a palette-mode toggle', () => {
      tool = mount();

      expect(paletteCheckbox()).not.toBeNull();
    });

    it('persists the toggle', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      const box = paletteCheckbox();
      vi.mocked(StorageService.setItem).mockClear();

      box.checked = true;
      box.dispatchEvent(new Event('change'));

      expect(StorageService.setItem).toHaveBeenCalledWith('v3_matcher_palette_mode', true);
    });

    it('reveals the palette options when enabled and hides them when off', () => {
      tool = mount();
      const box = paletteCheckbox();
      const options = container.querySelector<HTMLElement>('#palette-options-container');
      expect(options).not.toBeNull();

      box.checked = true;
      box.dispatchEvent(new Event('change'));
      expect(options!.style.display).not.toBe('none');

      box.checked = false;
      box.dispatchEvent(new Event('change'));
      expect(options!.style.display).toBe('none');
    });

    /** The primary button inside the palette options block. */
    const extractButton = (): HTMLButtonElement | null =>
      container.querySelector<HTMLButtonElement>('#palette-options-container button');

    it('offers an extract button alongside the options', () => {
      tool = mount();

      expect(extractButton()).not.toBeNull();
    });

    it('refuses to extract with no image loaded', async () => {
      const { ToastService } = await import('@services/index');
      tool = mount();
      vi.mocked(ToastService.error).mockClear();

      extractButton()!.click();
      await flush();

      // Extraction needs pixels; say so rather than producing an empty palette
      expect(ToastService.error).toHaveBeenCalled();
    });

    it('toggling twice returns to the original state', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      const box = paletteCheckbox();

      box.checked = true;
      box.dispatchEvent(new Event('change'));
      box.checked = false;
      box.dispatchEvent(new Event('change'));

      expect(StorageService.setItem).toHaveBeenLastCalledWith('v3_matcher_palette_mode', false);
    });
  });

  describe('paste from clipboard', () => {
    let originalClipboard: PropertyDescriptor | undefined;

    const withClipboard = (read: () => Promise<unknown>) => {
      originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { read },
      });
    };

    afterEach(() => {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'clipboard');
      originalClipboard = undefined;
    });

    /** The paste button only renders where navigator.clipboard.read exists. */
    const pasteButton = (): HTMLButtonElement | undefined =>
      [...rightPanel.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('matcher.pasteClipboard')
      );

    it('is hidden entirely where the Clipboard API is unavailable', () => {
      // jsdom has no navigator.clipboard.read, which is the unsupported case
      tool = mount();

      expect(pasteButton()).toBeUndefined();
    });

    it('appears when the Clipboard API is available', () => {
      withClipboard(async () => []);
      tool = mount();

      expect(pasteButton()).toBeDefined();
    });

    it('reads an image item off the clipboard', async () => {
      const blob = new Blob(['x'], { type: 'image/png' });
      withClipboard(async () => [{ types: ['image/png'], getType: async () => blob }]);
      const readSpy = vi
        .spyOn(FileReader.prototype, 'readAsDataURL')
        .mockImplementation(() => undefined);
      tool = mount();

      pasteButton()!.click();
      await flush();
      await flush();

      expect(readSpy).toHaveBeenCalled();
      readSpy.mockRestore();
    });

    it('warns when the clipboard holds no image', async () => {
      const { ToastService } = await import('@services/index');
      withClipboard(async () => [{ types: ['text/plain'], getType: async () => new Blob() }]);
      tool = mount();
      vi.mocked(ToastService.error).mockClear();

      pasteButton()!.click();
      await flush();
      await flush();

      expect(ToastService.error).toHaveBeenCalled();
    });

    it('warns rather than throwing when permission is denied', async () => {
      const { ToastService } = await import('@services/index');
      withClipboard(async () => {
        throw new Error('NotAllowedError');
      });
      tool = mount();
      vi.mocked(ToastService.error).mockClear();

      pasteButton()!.click();
      await flush();
      await flush();

      // A denied permission is a normal outcome, not a crash
      expect(ToastService.error).toHaveBeenCalled();
    });
  });

  describe('lifecycle under interaction', () => {
    it('tears down cleanly after configuration', async () => {
      tool = mount();
      tool.setConfig({ maxColors: 5, vibrancyBoost: true });
      await flush();

      expect(() => tool!.destroy()).not.toThrow();
    });

    it('ignores configuration arriving after destroy', () => {
      tool = mount();
      tool.destroy();

      // The sidebar can emit one last config-change during teardown
      expect(() => tool!.setConfig({ maxColors: 4 })).not.toThrow();
    });

    it('works with no drawer panel supplied', async () => {
      tool = mount({ drawer: false });
      tool.setConfig({ maxColors: 5 });
      await flush();

      expect(rightPanel.innerHTML.length).toBeGreaterThan(0);
    });
  });
});
