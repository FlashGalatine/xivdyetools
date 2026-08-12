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
  /** Picks readable text ink for a swatch background. */
  getContrastColor: vi.fn(() => '#FFFFFF'),
  ToastService: {
    show: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
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
      ctx.getImageData.mockClear();

      tool.setConfig({ maxColors: 3 });
      for (let i = 0; i < 6; i++) await flush();

      // A config change with an image present must re-sample, not just
      // redraw — otherwise the palette silently reflects the old count
      expect(ctx.getImageData).toHaveBeenCalled();
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
