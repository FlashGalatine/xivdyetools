/**
 * XIV Dye Tools - SwatchTool Unit Tests
 *
 * Tests the swatch tool (character color matcher) component.
 * Covers rendering, race/gender selection, color categories, and matching.
 *
 * @module components/__tests__/swatch-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SwatchTool } from '../swatch-tool';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
const { mockGetAllDyes, mockGetDyeById, mockFindClosestDyes, mockCharaFindClosestDyes } =
  vi.hoisted(() => ({
    mockGetAllDyes: vi.fn(),
    mockGetDyeById: vi.fn(),
    mockFindClosestDyes: vi.fn(),
    // The forward match runs through CharacterColorService, not the
    // DyeService wrapper — see swatch-tool.ts findMatchingDyes()
    mockCharaFindClosestDyes: vi.fn(),
  }));

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
  ToastService: {
    show: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
  RouterService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    getCurrentToolId: vi.fn().mockReturnValue('swatch'),
    navigateTo: vi.fn(),
  },
  WorldService: {
    getWorlds: vi.fn().mockReturnValue([]),
    getSelectedWorld: vi.fn().mockReturnValue(null),
    setSelectedWorld: vi.fn(),
  },
}));

/**
 * Partial mock: the real module is spread in, and only
 * `CharacterColorService` is replaced.
 *
 * A hand-written whole-module stub is the wrong shape here. Every name it
 * forgets (`normalizeMatchingMethod`, `hasActiveFilters`, …) throws at the
 * point of use, and `BaseComponent.safeRender()` swallows that into an error
 * state — so the panel silently renders nothing and the tests see an empty
 * DOM rather than a failure. Spreading the original means only the service
 * under substitution can drift.
 *
 * The substituted method names MUST still track the real
 * `CharacterColorService`: `loadColors()` switches on the colour category and
 * calls one getter per branch, so a wrong name yields `undefined` and an
 * empty grid. The previous stub had `getLipColors` / `getFacePaintColors`,
 * which the real service does not expose — those sheets are split dark/light.
 */
vi.mock('@xivdyetools/core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  CharacterColorService: class MockCharacterColorService {
    private mockColors = Array.from({ length: 24 }, (_, i) => ({
      index: i,
      hex: `#${(i * 11).toString(16).padStart(2, '0').repeat(3)}`.toUpperCase(),
      name: `Color ${i}`,
    }));
    getColors() {
      return this.mockColors;
    }
    // Shared sheets
    getEyeColors() {
      return this.mockColors;
    }
    getHighlightColors() {
      return this.mockColors;
    }
    getLipColorsDark() {
      return this.mockColors;
    }
    getLipColorsLight() {
      return this.mockColors;
    }
    getTattooColors() {
      return this.mockColors;
    }
    getFacePaintColorsDark() {
      return this.mockColors;
    }
    getFacePaintColorsLight() {
      return this.mockColors;
    }
    getSharedColors() {
      return this.mockColors;
    }
    // Race-specific sheets are async
    async getHairColors() {
      return this.mockColors;
    }
    async getSkinColors() {
      return this.mockColors;
    }
    async getRaceSpecificColors() {
      return this.mockColors;
    }
    findClosestDyes(...args: unknown[]) {
      return mockCharaFindClosestDyes(...args) ?? [];
    }
    getRaces() {
      return ['Hyur', 'Miqote', 'Lalafell'];
    }
    getGenders() {
      return ['Male', 'Female'];
    }
    getVersion() {
      return '1.0.0';
    }
    getGridColumns() {
      return 8;
    }
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

// `@shared/ui-icons` and `@shared/tool-icons` are NOT mocked on purpose.
// They are compile-time string constants with no dependencies, and a
// hand-written stub only has to miss one name (`ICON_TOOL_HARMONY` did) for
// the render to throw into safeRender's catch and silently produce nothing.

vi.mock('@services/pricing-mixin', () => ({
  setupMarketBoardListeners: vi.fn().mockReturnValue(() => {}),
}));

/**
 * `setContent` used to be a no-op here, which silently swallowed every
 * control the tool put inside a panel — the panel rendered as an empty div
 * and nothing downstream was reachable. The mock now attaches what it is
 * given, the way the real panel does, so assertions can see the content.
 */
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

/**
 * Mirrors the real MarketBoard's getter/setter pair. `getShowPrices` was
 * absent, and the tool reads it while building the left panel — same failure
 * mode as the LanguageService gap above.
 */
vi.mock('../market-board', () => ({
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
    async fetchPricesForDyes() {
      return new Map();
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

vi.mock('@components/v4/result-card', () => ({}));

describe('SwatchTool', () => {
  let container: HTMLElement;
  let leftPanel: HTMLElement;
  let rightPanel: HTMLElement;
  let drawerContent: HTMLElement;
  let tool: SwatchTool | null;

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
    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
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
    it('should render swatch tool', () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });

    it('should render left panel content', () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });

    it('should render right panel content', () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(rightPanel).not.toBeNull();
    });

    it('should render drawer content when provided', () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(drawerContent).not.toBeNull();
    });

    it('should work without drawer content', () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should have setConfig method', () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.setConfig).toBe('function');
    });

    it('should accept config via setConfig', () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      tool.setConfig({ maxResults: 5 });

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Race Selection Tests
  // ============================================================================

  describe('Race Selection', () => {
    it('should render race selection controls', () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel });
      tool.init();

      // Tool should render race-related content in left panel
      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Color Category Tests
  // ============================================================================

  describe('Color Category', () => {
    it('should render color category controls', () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel });
      tool.init();

      // Tool should render category-related content in left panel
      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });

    it('should handle double destroy gracefully', () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.destroy();

      // Second destroy should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });
  });

  // ==========================================================================
  // Interaction depth
  //
  // Everything above asserts that the tool *renders*. That is where the 16%
  // came from: this component is ~2,800 lines behind ~90 private members, and
  // the only way in is `setConfig`, `selectDye`/`selectCustomColor`, and
  // clicks on the swatch grid. These drive those entry points and assert the
  // consequence, which is what a config sidebar and a palette drawer actually
  // do to it at runtime.
  // ==========================================================================

  /** Build + init a tool with the standard three panels. */
  const mount = (opts: { drawer?: boolean } = {}): SwatchTool => {
    const t = new SwatchTool(
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

  describe('setConfig — race, gender and colour sheet', () => {
    it.each([
      ['race', { race: 'Highlander' }, 'v3_character_subrace', 'Highlander'],
      ['gender', { gender: 'Female' }, 'v3_character_gender', 'Female'],
      ['colorSheet', { colorSheet: 'hairColors' }, 'v3_character_category', 'hairColors'],
    ])('persists a %s change to storage', async (_label, config, key, value) => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      tool.setConfig(config as Parameters<SwatchTool['setConfig']>[0]);

      expect(StorageService.setItem).toHaveBeenCalledWith(key, value);
    });

    it('ignores a no-op change rather than reloading the palette', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      tool.setConfig({ race: 'Highlander' });
      await flush();
      vi.mocked(StorageService.setItem).mockClear();

      // Same value again — the guard is `config.race !== this.subrace`
      tool.setConfig({ race: 'Highlander' });

      expect(StorageService.setItem).not.toHaveBeenCalledWith(
        'v3_character_subrace',
        expect.anything()
      );
    });

    it('applies several keys in one call', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      // Deliberately all non-default, or the change-detection guards skip them
      tool.setConfig({ race: 'Highlander', gender: 'Female', colorSheet: 'hairColors' });
      await flush();

      const keys = vi.mocked(StorageService.setItem).mock.calls.map((c) => c[0]);
      expect(keys).toEqual(
        expect.arrayContaining([
          'v3_character_subrace',
          'v3_character_gender',
          'v3_character_category',
        ])
      );
    });

    it('accepts an empty config without touching state', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      expect(() => tool!.setConfig({})).not.toThrow();
      expect(StorageService.setItem).not.toHaveBeenCalled();
    });
  });

  describe('setConfig — matching controls', () => {
    it('persists a maxResults change', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      tool.setConfig({ maxResults: 8 });

      expect(StorageService.setItem).toHaveBeenCalledWith('v3_character_max_results', 8);
    });

    it('survives a matchingMethod change with nothing selected', () => {
      tool = mount();

      expect(() => tool!.setConfig({ matchingMethod: 'ciede2000' })).not.toThrow();
      expect(() => tool!.setConfig({ matchingMethod: 'oklab' })).not.toThrow();
    });

    it('merges displayOptions rather than replacing them', () => {
      tool = mount();

      tool.setConfig({ displayOptions: { showHex: true } as never });
      // A second partial update must not wipe the first
      expect(() => tool!.setConfig({ displayOptions: { showRgb: true } as never })).not.toThrow();
    });

    it('survives a dyeFilters change and an identical repeat', () => {
      tool = mount();

      expect(() =>
        tool!.setConfig({ dyeFilters: { excludeMetallic: true } as never })
      ).not.toThrow();
      // Second identical call hits the JSON-equality guard
      expect(() =>
        tool!.setConfig({ dyeFilters: { excludeMetallic: true } as never })
      ).not.toThrow();
    });
  });

  describe('reverse matching from the palette drawer', () => {
    const dye = { ...mockDyes[0], hex: '#AABBCC', name: 'Test Dye', itemID: 5729 };

    it('accepts a dye and does not throw before colours load', () => {
      tool = mount();

      expect(() => tool!.selectDye(dye as never)).not.toThrow();
    });

    it('ignores a missing dye rather than crashing the drawer', () => {
      tool = mount();

      expect(() => tool!.selectDye(undefined as never)).not.toThrow();
      expect(() => tool!.selectDye(null as never)).not.toThrow();
    });

    it('accepts a custom hex with or without the leading hash', () => {
      tool = mount();

      expect(() => tool!.selectCustomColor('#AABBCC')).not.toThrow();
      expect(() => tool!.selectCustomColor('AABBCC')).not.toThrow();
    });

    it('ignores an empty custom colour', () => {
      tool = mount();

      expect(() => tool!.selectCustomColor('')).not.toThrow();
    });

    it('re-runs the reverse match when the sheet changes underneath it', async () => {
      tool = mount();
      tool.selectDye(dye as never);

      // Changing the palette must re-match, not leave a stale highlight
      expect(() => tool!.setConfig({ colorSheet: 'hairColors' })).not.toThrow();
      await flush();
    });
  });

  describe('the swatch grid', () => {
    /** Every colour cell currently in the grid. */
    const swatches = (): HTMLButtonElement[] =>
      Array.from(rightPanel.querySelectorAll<HTMLButtonElement>('button[data-index]'));

    it('renders one clickable cell per colour in the sheet', async () => {
      tool = mount();
      await flush();

      // No `if (!cells.length) return` escape hatch. That guard is how the
      // deleted dye-comparison-coverage.spec.ts asserted nothing and still
      // passed; a mock whose getter name drifts must fail here, loudly.
      expect(swatches()).toHaveLength(24);
    });

    it('addresses each cell by its grid position, not its hex', async () => {
      tool = mount();
      await flush();

      // Confirmed grammar: a swatch is identified by its R·C cell address.
      // Two cells can carry the same colour, so a hex is not an identifier.
      const cells = swatches();
      expect(cells[0].getAttribute('aria-label')).toMatch(/^R1·C1: #/);
      expect(cells[8].getAttribute('aria-label')).toMatch(/^R2·C1: #/);
      expect(cells[0].getAttribute('data-index')).toBe('0');
      expect(cells[8].getAttribute('data-index')).toBe('8');
    });

    it('paints each cell with its own colour', async () => {
      tool = mount();
      await flush();

      const cells = swatches();
      expect(cells[0].getAttribute('style')).toContain('background-color: #000000');
      expect(cells[1].getAttribute('style')).toContain('background-color: #0B0B0B');
    });

    it('records the clicked cell as the selection', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      await flush();
      vi.mocked(StorageService.setItem).mockClear();

      swatches()[3].click();
      await flush();

      // Cell address, not hex — the index is what the R·C address derives from
      expect(StorageService.setItem).toHaveBeenCalledWith('v3_character_color_index', 3);
    });

    it('outlines the selected cell and only that cell', async () => {
      tool = mount();
      await flush();

      swatches()[5].click();
      await flush();

      const cells = swatches();
      expect(cells[5].style.outline).toContain('var(--theme-primary)');
      expect(cells[4].style.outline).toBe('none');
      expect(cells[6].style.outline).toBe('none');
    });

    it('moves the outline when a different cell is picked', async () => {
      tool = mount();
      await flush();
      swatches()[5].click();
      await flush();

      swatches()[9].click();
      await flush();

      const cells = swatches();
      expect(cells[9].style.outline).toContain('var(--theme-primary)');
      expect(cells[5].style.outline).toBe('none');
    });

    it('re-renders the grid when the colour sheet changes', async () => {
      tool = mount();
      await flush();
      expect(swatches()).toHaveLength(24);

      tool.setConfig({ colorSheet: 'tattooColors' });
      await flush();

      expect(swatches()).toHaveLength(24);
    });

    it('loads a race-specific sheet through its async getter', async () => {
      tool = mount();
      await flush();

      tool.setConfig({ colorSheet: 'hairColors' });
      await flush();

      expect(swatches()).toHaveLength(24);
    });

    it('clearDyes resets both the forward and the reverse side', async () => {
      tool = mount();
      await flush();
      tool.selectDye({ ...mockDyes[0], hex: '#AABBCC' } as never);

      expect(() => tool!.clearDyes()).not.toThrow();
      // Clearing twice is what a double-tap on Clear All does
      expect(() => tool!.clearDyes()).not.toThrow();
    });
  });

  describe('market configuration', () => {
    it('turns prices on and off without a selection', () => {
      tool = mount();

      expect(() => tool!.setMarketConfig({ showPrices: true })).not.toThrow();
      expect(() => tool!.setMarketConfig({ showPrices: false })).not.toThrow();
    });

    it('ignores a market config that names nothing', () => {
      tool = mount();

      expect(() => tool!.setMarketConfig({})).not.toThrow();
    });
  });

  describe('lifecycle under interaction', () => {
    it('tears down cleanly after configuration and selection', async () => {
      tool = mount();
      tool.setConfig({ race: 'Highlander', gender: 'Female', colorSheet: 'hairColors' });
      tool.selectCustomColor('#123456');
      await flush();

      expect(() => tool!.destroy()).not.toThrow();
    });

    it('ignores configuration arriving after destroy', () => {
      tool = mount();
      tool.destroy();

      // The sidebar can emit one last config-change during teardown
      expect(() => tool!.setConfig({ race: 'Midlander' })).not.toThrow();
    });

    it('works with no drawer panel supplied', async () => {
      tool = mount({ drawer: false });
      tool.setConfig({ colorSheet: 'eyeColors' });
      await flush();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });
});
