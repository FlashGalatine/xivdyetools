/**
 * XIV Dye Tools - SwatchTool Unit Tests
 *
 * Tests the swatch tool (character color matcher) component.
 * Covers rendering, race/gender selection, color categories, and matching.
 *
 * @module components/__tests__/swatch-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RACE_SUBRACES } from '@xivdyetools/types';
import type { Dye } from '@xivdyetools/types';
import {
  CharacterColorService,
  type ResolvedCharaCharacter,
  type ResolvedCharaSlot,
} from '@xivdyetools/core';
import { SwatchTool, RACE_GROUPS } from '../swatch-tool';
import { CharaSessionService, type CharaSession } from '@services/chara-session-service';
import { ConfigController, StorageService } from '@services/index';
import {
  DEFAULT_DISPLAY_OPTIONS,
  DEFAULT_DYE_FILTERS,
  getDefaultConfig,
  type SwatchConfig,
} from '@shared/tool-config-types';
import { METHOD_TAGS } from '@shared/method-tags';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

/** Where jsdom starts; the share-link tests move it and put it back. */
const INITIAL_URL = window.location.href;

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
  /**
   * This browser has already moved its v3 swatch keys into the controller, so
   * the one-time migration stays out of every test here: it is a module-level
   * once-per-page step, and left on it would fire in whichever test mounted
   * first. swatch-tool.config.test.ts covers it against real storage.
   */
  StorageService: {
    getItem: vi.fn((key: string) => (key === 'xivdyetools_swatch_v3_migrated' ? true : null)),
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
      setConfig: vi.fn(),
    }),
  },
  CollectionService: {
    getFavorites: vi.fn().mockReturnValue([]),
    subscribeFavorites: vi.fn().mockReturnValue(() => {}),
    isFavorite: vi.fn().mockReturnValue(false),
  },
  ToastService: {
    warning: vi.fn(),
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

vi.mock('@components/v4/result-card', () => ({}));

// DYES ON THIS GLAMOUR asks api-worker for item names: never reach the network.
vi.mock('@services/chara-resolve-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@services/chara-resolve-service')>()),
  resolveCharaEquipment: vi.fn(() => new Promise(() => {})),
}));

/** A loaded character as core resolves it: both eyes on eye-sheet cell 3. */
function charaSession(overrides: Partial<ResolvedCharaCharacter> = {}): CharaSession {
  const eye = (slot: 'leftEye' | 'rightEye'): ResolvedCharaSlot => ({
    slot,
    kind: slot,
    verdict: 'index',
    index: 3,
    sheetIndex: 3,
    sheetVariant: null,
    gridAddress: 'R1·C4',
    indexHex: '#AA3344',
    floatHex: null,
    deltaE: null,
    alpha: null,
    blendHex: null,
  });
  return {
    fileName: 'test.chara',
    resolved: {
      producer: 'Anamnesis Character File',
      race: null,
      tribe: 'Highlander',
      gender: 'Female',
      nickname: 'Test Subject',
      extendedValid: false,
      extendedDeclared: false,
      slots: [eye('leftEye'), eye('rightEye')],
      eyesShareIndex: true,
      gearDyes: [],
      gearModels: [],
      glassesId: null,
      ...overrides,
    },
  };
}

// BUG-003: the preset-submission-form chunk is loaded on demand from
// onSubmitPalette. Rejecting the factory makes `import(...)` reject too, so
// every test in this file sees a chunk-load failure — nothing else in this
// suite reaches the real module.
vi.mock('@components/preset-submission-form', () => {
  throw new Error('preset-submission-form chunk failed to load');
});

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
    // The loaded .chara is app-wide: never let one test's file reach the next.
    CharaSessionService.setSession(null);
    cleanupTestContainer(container);
    vi.restoreAllMocks();
    // Vitest 5's restoreAllMocks leaves vi.fn implementations in place, so the
    // matcher's canned result and a seeded controller config are reset by hand.
    mockCharaFindClosestDyes.mockReset();
    vi.mocked(ConfigController.getInstance().getConfig).mockImplementation(() => ({}) as never);
    window.history.replaceState(null, '', INITIAL_URL);
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

    // BUG-011: this only asserted that the left panel had children, which no
    // change to maxResults could ever break.
    it('applies a maxResults change to the live reverse match', async () => {
      tool = new SwatchTool(container, { leftPanel, rightPanel });
      tool.init();
      await Promise.resolve();
      tool.selectDye({ ...mockDyes[0], hex: '#AABBCC' } as never);
      const reverse = () =>
        (tool as unknown as { reverseMatchedSwatches: unknown[] }).reverseMatchedSwatches;
      expect(reverse()).toHaveLength(3);

      tool.setConfig({ maxResults: 5 });

      expect(reverse()).toHaveLength(5);
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

  /** The one stable object the mocked ConfigController.getInstance() returns. */
  const controller = () => ConfigController.getInstance();
  /** Make the mocked controller hold `config` for 'swatch' (reset in afterEach). */
  const seedController = (config: Partial<SwatchConfig>) =>
    vi
      .mocked(controller().getConfig)
      .mockImplementation(((key: string) => (key === 'swatch' ? config : {})) as never);
  /** The tool's 'swatch' subscriber, as the controller would call it. */
  const swatchListener = (): ((config: SwatchConfig) => void) => {
    const calls = vi.mocked(controller().subscribe).mock.calls.filter(([key]) => key === 'swatch');
    return calls[calls.length - 1][1] as (config: SwatchConfig) => void;
  };

  /**
   * The five retired v3 settings keys. Matched exactly: the collapsible
   * panels' v3_character_*_panel / _market keys share the prefix and stay.
   */
  const RETIRED_KEYS = [
    'v3_character_subrace',
    'v3_character_gender',
    'v3_character_category',
    'v3_character_color_index',
    'v3_character_max_results',
  ];
  const retiredWrites = () =>
    vi
      .mocked(StorageService.setItem)
      .mock.calls.filter(([key]) => RETIRED_KEYS.includes(key as string));

  /** Every colour cell currently in the grid. */
  const cells = (): HTMLButtonElement[] =>
    Array.from(rightPanel.querySelectorAll<HTMLButtonElement>('button[data-index]'));
  const outlined = () => cells().filter((c) => c.style.outline.includes('var(--theme-primary)'));
  const gridTitle = () => rightPanel.querySelector('.section-title')?.textContent ?? '';
  type Card = HTMLElement & {
    data?: { dye: Dye };
    showCmyk?: boolean;
    showHex?: boolean;
    showRgb?: boolean;
  };
  const cards = (): Card[] => Array.from(rightPanel.querySelectorAll<Card>('v4-result-card'));
  const share = () =>
    rightPanel.querySelector('v4-share-button') as HTMLElement & {
      disabled: boolean;
      shareParams: Record<string, unknown>;
    };
  /** The SEND TO chips. */
  const handoffChips = (): HTMLButtonElement[] =>
    Array.from(
      (tool as unknown as { handoffContainer: HTMLElement }).handoffContainer.querySelectorAll(
        'button'
      )
    );
  const railChip = (labelKey: string): HTMLButtonElement =>
    Array.from(rightPanel.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent === labelKey
    )!;
  /** The matcher's request for the last match: (colour, dyeService, { count, matchingMethod }). */
  const lastMatchRequest = () =>
    mockCharaFindClosestDyes.mock.calls[mockCharaFindClosestDyes.mock.calls.length - 1][2] as {
      count: number;
      matchingMethod: string;
    };
  const metallicDye = mockDyes.find((d) => d.isMetallic)!;
  /**
   * Core's matcher, as far as these tests need it: the first `count` dyes of
   * the pool it is handed (nearest first), and never more — core keeps only
   * the top k.
   */
  const rankPoolInOrder = () =>
    mockCharaFindClosestDyes.mockImplementation(
      (_color: unknown, pool: { getAllDyes: () => Dye[] }, options: { count: number }) =>
        pool
          .getAllDyes()
          .slice(0, options.count)
          .map((dye, rank) => ({ dye, distance: rank + 1 }))
    );

  describe('setConfig — race, gender and colour sheet', () => {
    it.each([
      ['race', { race: 'Highlander' }, ['Highlander', 'Male']],
      ['gender', { gender: 'Female' }, ['Midlander', 'Female']],
    ] as const)(
      'reloads the hair sheet for a %s change and keeps no copy of its own',
      async (_label, config, args) => {
        const getHairColors = vi.spyOn(CharacterColorService.prototype, 'getHairColors');
        tool = mount();
        tool.setConfig({ colorSheet: 'hairColors' });
        await flush();
        vi.mocked(StorageService.setItem).mockClear();

        tool.setConfig(config);
        await flush();

        expect(getHairColors).toHaveBeenLastCalledWith(...args);
        // The controller is the one owner: no v3_character_* mirror.
        expect(retiredWrites()).toEqual([]);
      }
    );

    it('switches the grid for a colour sheet change and keeps no copy of its own', async () => {
      tool = mount();
      await flush();
      vi.mocked(StorageService.setItem).mockClear();

      tool.setConfig({ colorSheet: 'hairColors' });
      await flush();

      expect(gridTitle()).toContain('tools.character.hairColors');
      expect(retiredWrites()).toEqual([]);
    });

    it('ignores a no-op change rather than reloading the palette', async () => {
      const getHairColors = vi.spyOn(CharacterColorService.prototype, 'getHairColors');
      tool = mount();
      tool.setConfig({ colorSheet: 'hairColors', race: 'Highlander' });
      await flush();
      getHairColors.mockClear();

      // Same values again: the v4-layout forward delivers each change twice
      tool.setConfig({ race: 'Highlander' });
      tool.setConfig({ colorSheet: 'hairColors' });
      await flush();

      expect(getHairColors).not.toHaveBeenCalled();
    });

    it('applies several keys in one call', async () => {
      const getHairColors = vi.spyOn(CharacterColorService.prototype, 'getHairColors');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      // Deliberately all non-default, or the change-detection guards skip them
      tool.setConfig({ race: 'Highlander', gender: 'Female', colorSheet: 'hairColors' });
      await flush();

      expect(gridTitle()).toContain('tools.character.hairColors');
      expect(getHairColors).toHaveBeenLastCalledWith('Highlander', 'Female');
      expect(retiredWrites()).toEqual([]);
    });

    it('accepts an empty config without touching state', () => {
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      expect(() => tool!.setConfig({})).not.toThrow();
      expect(StorageService.setItem).not.toHaveBeenCalled();
    });

    // BUG-001 (2026-10-04 deep-dive): a .chara load pins race and gender and
    // the controller broadcasts the whole config. On a sheet with no tribe
    // that must not reload, nor clear the cell being looked at.
    it('keeps the selection through a tribe change on a sheet that has no tribe', async () => {
      const getHairColors = vi.spyOn(CharacterColorService.prototype, 'getHairColors');
      tool = mount();
      await flush();
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);
      cells()[4].click();

      tool.setConfig({ race: 'Raen', gender: 'Female' });
      await flush();

      expect(getHairColors).not.toHaveBeenCalled();
      expect(outlined().map((c) => c.dataset.index)).toEqual(['4']);
      expect(cards()).toHaveLength(1);
      // ...and the hair sheet, when it is opened, is the new tribe's
      tool.setConfig({ colorSheet: 'hairColors' });
      await flush();
      expect(getHairColors).toHaveBeenLastCalledWith('Raen', 'Female');
    });
  });

  describe('setConfig — matching controls', () => {
    it("re-matches the selected cell with a new count, clamped to the sidebar's 1–6", async () => {
      tool = mount();
      await flush();
      cells()[2].click();
      vi.mocked(StorageService.setItem).mockClear();

      tool.setConfig({ maxResults: 5 });
      expect(lastMatchRequest().count).toBe(5);

      tool.setConfig({ maxResults: 8 });
      expect(lastMatchRequest().count).toBe(6);
      expect(retiredWrites()).toEqual([]);
    });

    // BUG-011: this asserted only that two setConfig calls did not throw.
    it('carries a matchingMethod change made with nothing selected into the next match', async () => {
      tool = mount();
      await flush();

      tool.setConfig({ matchingMethod: 'oklab' });
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);
      cells()[0].click();

      expect(lastMatchRequest().matchingMethod).toBe('oklab');
      expect((tool as unknown as { unitTagEl: HTMLElement }).unitTagEl.textContent).toBe(
        METHOD_TAGS.oklab
      );
    });

    // BUG-011: this asserted only that the second partial update did not throw.
    it('merges displayOptions rather than replacing them', async () => {
      tool = mount();
      await flush();
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);
      cells()[0].click();

      tool.setConfig({ displayOptions: { showCmyk: true } as never });
      // A second partial update must not wipe the first
      tool.setConfig({ displayOptions: { showHex: false } as never });

      const [card] = cards();
      expect(card.showCmyk).toBe(true);
      expect(card.showHex).toBe(false);
      expect(card.showRgb).toBe(DEFAULT_DISPLAY_OPTIONS.showRgb);
    });

    // A full controller broadcast carries displayOptions every time; the echo
    // of an unchanged value must not rebuild the cards.
    it('does not redraw the cards for display options equal to its own', async () => {
      tool = mount();
      await flush();
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);
      cells()[0].click();
      const [before] = cards();

      tool.setConfig({ displayOptions: { ...DEFAULT_DISPLAY_OPTIONS } });

      expect(cards()[0]).toBe(before);
    });

    // BUG-011: this asserted only that two setConfig calls did not throw.
    it('drops an excluded dye from the cards, and skips an identical repeat', async () => {
      tool = mount();
      await flush();
      mockCharaFindClosestDyes.mockReturnValue([
        { dye: metallicDye, distance: 1 },
        { dye: mockDyes[0], distance: 2 },
      ]);
      cells()[0].click();
      expect(cards().map((c) => c.data?.dye.id)).toEqual([metallicDye.id, mockDyes[0].id]);

      tool.setConfig({ dyeFilters: { excludeMetallic: true } as never });

      expect(cards().map((c) => c.data?.dye.id)).toEqual([mockDyes[0].id]);
      // Second identical call hits the JSON-equality guard: no new match
      mockCharaFindClosestDyes.mockClear();
      tool.setConfig({ dyeFilters: { excludeMetallic: true } as never });
      expect(mockCharaFindClosestDyes).not.toHaveBeenCalled();
    });

    // BUG-025 (2026-10-04 deep-dive): the filter ran after a top-(maxResults×3)
    // request, so when the nearest dyes were mostly excluded fewer than
    // maxResults survived — 85 of the 125 dyes are Dye Vendor dyes.
    it('fills every card from the allowed dyes, however many excluded dyes rank nearer', async () => {
      const nearerExcluded = Array.from({ length: 9 }, (_, i) => ({
        ...metallicDye,
        id: 9100 + i,
        itemID: 9100 + i,
        stainID: 200 + i,
      }));
      const allowed = mockDyes.filter((d) => !d.isMetallic).slice(0, 3);
      mockGetAllDyes.mockReturnValue([...nearerExcluded, ...allowed]);
      rankPoolInOrder();
      tool = mount();
      await flush();
      tool.setConfig({ dyeFilters: { excludeMetallic: true } as never });

      cells()[0].click();

      // maxResults is 3 (the default)
      expect(cards().map((c) => c.data?.dye.id)).toEqual(allowed.map((d) => d.id));
    });
  });

  // ==========================================================================
  // BUG-001 / BUG-022 (2026-10-04 deep-dive): ConfigController owns the
  // settings. The tool reads them at construction (subscribe() never
  // replays), writes its own picks through, and applies the controller's full
  // broadcasts without being flipped by them.
  // ==========================================================================

  describe('mount — the controller owns the settings', () => {
    const persisted = (): SwatchConfig => ({
      colorSheet: 'tattooColors',
      race: 'Raen',
      gender: 'Female',
      maxResults: 5,
      matchingMethod: 'oklab',
      displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showCmyk: true },
      dyeFilters: { ...DEFAULT_DYE_FILTERS, excludeMetallic: true },
    });

    it('opens on the persisted sheet, tribe, count, method, filters and display options', async () => {
      const getTattooColors = vi.spyOn(CharacterColorService.prototype, 'getTattooColors');
      const getHairColors = vi.spyOn(CharacterColorService.prototype, 'getHairColors');
      seedController(persisted());
      // The matcher's top hit is metallic; the persisted filter must drop it.
      mockCharaFindClosestDyes.mockReturnValue([
        { dye: metallicDye, distance: 1 },
        { dye: mockDyes[0], distance: 2 },
        { dye: mockDyes[1], distance: 3 },
      ]);
      tool = mount();
      await flush();

      expect(gridTitle()).toContain('tools.character.tattooColors');
      expect(getTattooColors).toHaveBeenCalled();

      cells()[0].click();
      // The whole pool, because a filter is active (BUG-025), then trimmed to 5
      expect(lastMatchRequest()).toEqual({ count: mockDyes.length, matchingMethod: 'oklab' });
      expect(cards().map((c) => c.data?.dye.id)).toEqual([mockDyes[0].id, mockDyes[1].id]);
      expect(cards().every((c) => c.showCmyk === true)).toBe(true);

      tool.setConfig({ colorSheet: 'hairColors' });
      await flush();
      expect(getHairColors).toHaveBeenLastCalledWith('Raen', 'Female');
    });

    it("copies the nested objects rather than holding the controller's own", () => {
      const config = persisted();
      seedController(config);
      tool = mount();

      const internal = tool as unknown as { displayOptions: object; dyeFiltersConfig: object };
      expect(internal.displayOptions).toEqual(config.displayOptions);
      expect(internal.displayOptions).not.toBe(config.displayOptions);
      expect(internal.dyeFiltersConfig).toEqual(config.dyeFilters);
      expect(internal.dyeFiltersConfig).not.toBe(config.dyeFilters);
    });

    it('takes the valid persisted values and falls back for the ones it does not recognise', async () => {
      const getHairColors = vi.spyOn(CharacterColorService.prototype, 'getHairColors');
      seedController({
        colorSheet: 'tattooColors',
        race: 'Nope',
        gender: 'Other',
        maxResults: -2,
        matchingMethod: 'hyab' as never,
      });
      tool = mount();
      await flush();

      expect(gridTitle()).toContain('tools.character.tattooColors');
      cells()[0].click();
      // 'hyab' is a retired method: it migrates to the suite default
      expect(lastMatchRequest()).toEqual({ count: 3, matchingMethod: 'ciede2000' });
      tool.setConfig({ colorSheet: 'hairColors' });
      await flush();
      expect(getHairColors).toHaveBeenLastCalledWith('Midlander', 'Male');

      // An unrecognised sheet falls back to the tool's own default
      tool.destroy();
      seedController({ colorSheet: 'bogusColors' });
      tool = mount();
      expect(gridTitle()).toContain('tools.character.eyeColors');
    });

    it('a rail pick writes the controller, and the next full broadcast keeps it', async () => {
      tool = mount();
      await flush();
      vi.mocked(controller().setConfig).mockClear();

      railChip('swatch.palTattoo').click();

      expect(controller().setConfig).toHaveBeenCalledWith('swatch', { colorSheet: 'tattooColors' });
      await flush();
      expect(gridTitle()).toContain('tools.character.tattooColors');
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);
      cells()[5].click();

      // The sidebar moves the count: the controller broadcasts the WHOLE
      // swatch config, here with a loaded file's tribe pinned into it.
      swatchListener()({
        ...getDefaultConfig('swatch'),
        colorSheet: 'tattooColors',
        race: 'Raen',
        gender: 'Female',
        maxResults: 5,
      });
      await flush();

      expect(gridTitle()).toContain('tools.character.tattooColors');
      expect(outlined().map((c) => c.dataset.index)).toEqual(['5']);
      expect(lastMatchRequest().count).toBe(5);
      expect(cards()).toHaveLength(1);
    });

    it('the range toggle writes the controller too', async () => {
      tool = mount();
      tool.setConfig({ colorSheet: 'lipColorsDark' });
      await flush();
      vi.mocked(controller().setConfig).mockClear();

      railChip('swatch.rangeLight').click();

      expect(controller().setConfig).toHaveBeenCalledWith('swatch', {
        colorSheet: 'lipColorsLight',
      });
    });
  });

  // ==========================================================================
  // BUG-023 (2026-10-04 deep-dive): a reload used to null only selectedColor,
  // leaving the cards, the share link and SEND TO on the previous cell.
  // ==========================================================================

  describe('a sheet change clears the forward selection', () => {
    it('drops the cards, the outline, the share link and SEND TO in the same call', async () => {
      tool = mount();
      await flush();
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);
      cells()[3].click();
      expect(cards()).toHaveLength(1);
      expect(share().disabled).toBe(false);
      expect(handoffChips().some((c) => !c.disabled)).toBe(true);

      tool.setConfig({ colorSheet: 'tattooColors' });

      // Synchronously: no flush, so nothing stale shows while a sheet loads
      expect(cards()).toHaveLength(0);
      expect(outlined()).toHaveLength(0);
      expect(share().disabled).toBe(true);
      expect(share().shareParams).toEqual({});
      expect(handoffChips().every((c) => c.disabled)).toBe(true);
    });

    // BUG-011: this asserted only that setConfig did not throw.
    it('re-runs the reverse match when the sheet changes underneath it', async () => {
      const hair = Array.from({ length: 8 }, (_, i) => ({
        index: i,
        hex: `#1${i}1${i}1${i}`,
        name: `Hair ${i}`,
      }));
      vi.spyOn(CharacterColorService.prototype, 'getHairColors').mockResolvedValue(hair as never);
      tool = mount();
      await flush();
      tool.selectDye({ ...mockDyes[0], hex: '#AABBCC' } as never);
      const reverseHexes = () =>
        (
          tool as unknown as { reverseMatchedSwatches: Array<{ color: { hex: string } }> }
        ).reverseMatchedSwatches.map((m) => m.color.hex);
      expect(reverseHexes()).not.toEqual(hair.slice(0, 3).map((c) => c.hex));

      tool.setConfig({ colorSheet: 'hairColors' });
      await flush();

      expect(reverseHexes()).toEqual(hair.slice(0, 3).map((c) => c.hex));
    });

    // The previous sheet's cells stay on screen while the hair or skin sheet
    // loads. A cell clicked there is not on the new sheet, so the pick is
    // dropped rather than outlined on whichever new cell shares its index.
    it('drops a cell picked from the old sheet while the new one loads', async () => {
      const hair = Array.from({ length: 8 }, (_, i) => ({
        index: i,
        hex: `#1${i}1${i}1${i}`,
        name: `Hair ${i}`,
      }));
      let land!: (colors: unknown) => void;
      vi.spyOn(CharacterColorService.prototype, 'getHairColors').mockReturnValue(
        new Promise((resolve) => {
          land = resolve;
        }) as never
      );
      tool = mount();
      await flush();
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);

      railChip('swatch.palHair').click();
      cells()[5].click(); // still the eye sheet's cell
      expect(cards()).toHaveLength(1);

      land(hair);
      await flush();

      expect(outlined()).toEqual([]);
      expect(cards()).toHaveLength(0);
      expect(share().shareParams).toEqual({});
    });
  });

  // ==========================================================================
  // BUG-019 (2026-10-04 deep-dive): a share link's settings reached only the
  // tool, so the next controller broadcast reverted them.
  // ==========================================================================

  describe('share links', () => {
    const openLink = (query: string) =>
      window.history.replaceState(null, '', `/swatch/?${query}&v=1`);

    it("applies a link's settings and writes them to the controller once", async () => {
      openLink('slot=tattooColors&algo=euclidean&limit=9&i=2');
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);
      tool = mount();
      await flush();

      // limit is clamped to the sidebar's 1–6; 'euclidean' is the legacy RGB
      expect(vi.mocked(controller().setConfig).mock.calls).toEqual([
        ['swatch', { colorSheet: 'tattooColors', matchingMethod: 'rgb', maxResults: 6 }],
      ]);
      expect(gridTitle()).toContain('tools.character.tattooColors');
      expect(outlined().map((c) => c.dataset.index)).toEqual(['2']);
      expect(lastMatchRequest()).toEqual({ count: 6, matchingMethod: 'rgb' });
    });

    it('writes the tribe of a hair link when no file is loaded', async () => {
      const getHairColors = vi.spyOn(CharacterColorService.prototype, 'getHairColors');
      openLink('slot=hairColors&race=Raen&gender=Female&i=2');
      tool = mount();
      await flush();

      expect(controller().setConfig).toHaveBeenCalledWith('swatch', {
        colorSheet: 'hairColors',
        race: 'Raen',
        gender: 'Female',
      });
      expect(getHairColors).toHaveBeenLastCalledWith('Raen', 'Female');
    });

    it('ignores what a malformed link carries rather than overwrite the saved settings', async () => {
      seedController({ ...getDefaultConfig('swatch'), maxResults: 4, matchingMethod: 'oklab' });
      openLink('slot=bogusColors&algo=bogus&limit=0&race=Nope&gender=X&i=2');
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);
      tool = mount();
      await flush();

      expect(controller().setConfig).not.toHaveBeenCalled();
      expect(gridTitle()).toContain('tools.character.eyeColors');
      // The cell still opens, under the saved count and method
      expect(share().shareParams).toMatchObject({ slot: 'eyeColors', i: 2 });
      expect(lastMatchRequest()).toEqual({ count: 4, matchingMethod: 'oklab' });
    });

    // The link's cell was selected synchronously at mount, then the
    // constructor's own palette load rebuilt the grid without its outline.
    it('keeps the shared cell outlined when the link is for the sheet it opens on', async () => {
      openLink('slot=eyeColors&i=2');
      tool = mount();
      await flush();

      expect(outlined().map((c) => c.dataset.index)).toEqual(['2']);
    });

    it('leaves tribe and gender to a loaded .chara file', async () => {
      const getHairColors = vi.spyOn(CharacterColorService.prototype, 'getHairColors');
      CharaSessionService.setSession(charaSession()); // Highlander, Female
      openLink('slot=hairColors&race=Raen&gender=Male&i=2');
      tool = mount();
      await flush();

      expect(vi.mocked(controller().setConfig).mock.calls).toEqual([
        ['swatch', { colorSheet: 'hairColors' }],
      ]);
      expect(getHairColors).toHaveBeenLastCalledWith('Highlander', 'Female');
    });
  });

  // The left-panel and drawer selects are unreachable in V4 (renderRightPanel
  // clears the shared panel; the drawer is never passed), but they exist under
  // these unit-test panels until REFACTOR-005 deletes them.
  describe('the v3 selects', () => {
    it.each([
      ['subraceSelect', 'Raen', { race: 'Raen' }],
      ['genderSelect', 'Female', { gender: 'Female' }],
      ['categorySelect', 'tattooColors', { colorSheet: 'tattooColors' }],
      ['mobileSubraceSelect', 'Raen', { race: 'Raen' }],
      ['mobileGenderSelect', 'Female', { gender: 'Female' }],
      ['mobileCategorySelect', 'tattooColors', { colorSheet: 'tattooColors' }],
    ])('%s writes the controller, not a storage key of its own', (field, value, partial) => {
      tool = mount();
      const select = (tool as unknown as Record<string, HTMLSelectElement>)[field];
      vi.mocked(StorageService.setItem).mockClear();
      vi.mocked(controller().setConfig).mockClear();

      select.value = value;
      select.dispatchEvent(new Event('change'));

      expect(controller().setConfig).toHaveBeenCalledWith('swatch', partial);
      expect(retiredWrites()).toEqual([]);
    });
  });

  describe('reverse matching from the palette drawer', () => {
    const dye = { ...mockDyes[0], hex: '#AABBCC', name: 'Test Dye', itemID: 5729 };

    it('accepts a dye and does not throw before colours load', () => {
      tool = mount();

      expect(() => tool!.selectDye(dye as never)).not.toThrow();
    });

    it('selects the dye by its own hex/name, not a swapped pair, and populates the match list (BUG-038)', async () => {
      tool = mount();
      await flush(); // let the default eyeColors sheet load into this.colors

      tool!.selectDye(dye as never);
      await flush();

      // The source card must read the SELECTED dye's own hex and localized
      // name -- a swapped hex/name bug would show the hex where the name
      // belongs (or vice versa) instead of both correct values together.
      expect(rightPanel.textContent).toContain('Dye-5729'); // LanguageService.getDyeName(itemID)
      expect(rightPanel.textContent).toContain('#AABBCC');

      // The reverse match ranked the top `maxResults` (3) swatches from the
      // loaded palette. The mocked distance function returns a constant, so
      // ties preserve original palette order -- a wrong-palette or
      // mis-scored match would not land on indices [0, 1, 2] in rank order.
      const internal = tool as unknown as {
        reverseMatchedSwatches: Array<{ color: { index: number; hex: string }; rank: number }>;
      };
      expect(internal.reverseMatchedSwatches).toHaveLength(3);
      expect(internal.reverseMatchedSwatches.map((m) => m.color.index)).toEqual([0, 1, 2]);
      expect(internal.reverseMatchedSwatches.map((m) => m.rank)).toEqual([1, 2, 3]);
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
  });

  describe('the loaded .chara file', () => {
    const selection = () =>
      (tool as unknown as { selectionContext: { source: string } | null }).selectionContext;

    it('is still on the file card after the tool is left and entered again', () => {
      tool = mount();
      CharaSessionService.setSession(charaSession());
      expect(rightPanel.textContent).toContain('Test Subject');

      tool.destroy();
      tool = mount();

      expect(rightPanel.textContent).toContain('Test Subject');
      expect(rightPanel.querySelector('input[type="file"]')).toBeNull();
    });

    it('survives a re-render, which is what a language switch does', () => {
      tool = mount();
      CharaSessionService.setSession(charaSession());

      tool.update();

      expect(rightPanel.textContent).toContain('Test Subject');
      expect(rightPanel.querySelector('.chara-slots-grid')).not.toBeNull();
    });

    // PR #206 review: the file's tribe reached the tool only through a session
    // change while it was open, so a file that finished loading after the
    // player left (or that another tool loaded) opened on the old tribe's
    // hair and skin sheets. The config side is config-controller.test.ts.
    it('opens on the tribe and gender of a file loaded while it was closed', async () => {
      const { CharacterColorService } = await import('@xivdyetools/core');
      const getHairColors = vi.spyOn(CharacterColorService.prototype, 'getHairColors');
      CharaSessionService.setSession(charaSession());

      tool = mount();
      tool.setConfig({ colorSheet: 'hairColors' });
      await flush();

      expect(getHairColors).toHaveBeenLastCalledWith('Highlander', 'Female');
    });

    it('pins both eyes on their shared cell as one merged badge', async () => {
      CharaSessionService.setSession(charaSession());
      tool = mount();
      await flush();

      const cells = Array.from(rightPanel.querySelectorAll<HTMLElement>('button[data-index]'));
      expect(cells[3]?.textContent).toBe('1·2');
    });

    it('retires a slot pick when the file is cleared', () => {
      CharaSessionService.setSession(charaSession());
      tool = mount();
      rightPanel.querySelector<HTMLButtonElement>('.chara-slots-grid > button')!.click();
      expect(selection()?.source).toBe('slot');

      CharaSessionService.setSession(null);

      expect(selection()).toBeNull();
      expect(rightPanel.querySelector('input[type="file"]')).not.toBeNull();
    });

    it('keeps the picked slot ringed through a re-render', () => {
      CharaSessionService.setSession(charaSession());
      tool = mount();
      rightPanel.querySelector<HTMLButtonElement>('.chara-slots-grid > button')!.click();

      tool.update();

      const ringed = Array.from(
        rightPanel.querySelectorAll<HTMLElement>('.chara-slots-grid > button')
      ).filter((b) => b.getAttribute('style')?.includes('0 0 0 1px var(--theme-primary)'));
      expect(ringed).toHaveLength(1);
    });

    // PR #206 review: the card kept the label translated at pick time, so after
    // a language switch it still named the slot in the old language.
    it('names a picked slot in the current language after a language switch', async () => {
      const { LanguageService } = await import('@services/index');
      const card = () =>
        (tool as unknown as { selectionCardContainer: HTMLElement }).selectionCardContainer;
      CharaSessionService.setSession(charaSession());
      tool = mount();
      rightPanel.querySelector<HTMLButtonElement>('.chara-slots-grid > button')!.click();
      expect(card().textContent).toContain('SWATCH.SLOTLEFTEYE');

      vi.spyOn(LanguageService, 't').mockImplementation((key: string) => `fr:${key}`);
      tool.update();

      expect(card().textContent).toContain('FR:SWATCH.SLOTLEFTEYE');
      expect(card().textContent).toContain('fr:swatch.slotLeftEye');
    });

    // BUG-024 (2026-10-04 deep-dive): the slot pick replaced the selection
    // card but left the grid cell's matches, share link and SEND TO behind.
    it('a slot pick clears the grid pick before it, and SEND TO carries the slot', async () => {
      CharaSessionService.setSession(charaSession());
      tool = mount();
      await flush();
      // Every distance is 15 in this suite, so the slot's closest dye is the
      // pool's first; the grid cell matches a different one.
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[3], distance: 2 }]);
      cells()[5].click();
      expect(cards()).toHaveLength(1);
      const handoffTargets = vi.spyOn(
        tool as unknown as { handoffTargets: (ids: number[]) => unknown },
        'handoffTargets'
      );

      // The left eye sits on cell 3 of the same (eye) palette
      rightPanel.querySelector<HTMLButtonElement>('.chara-slots-grid > button')!.click();

      expect(cards()).toHaveLength(0);
      expect(outlined()).toHaveLength(0);
      expect(share().disabled).toBe(true);
      expect(handoffTargets).toHaveBeenLastCalledWith([mockDyes[0].stainID]);
      expect(selection()?.source).toBe('slot');
    });

    // BUG-025 (2026-10-04 deep-dive): a slot's closest dye came from the whole
    // pool, so the verdict sentence and SEND TO could name a dye the user had
    // filtered out.
    it("names the slot's closest dye from the dyes the filters allow", async () => {
      const allowed = mockDyes.filter((d) => !d.isMetallic);
      // Every distance is 15 in this suite, so the first dye the filter
      // allows wins — and the metallic one sits ahead of it
      mockGetAllDyes.mockReturnValue([metallicDye, ...allowed]);
      CharaSessionService.setSession(charaSession());
      tool = mount();
      tool.setConfig({ dyeFilters: { excludeMetallic: true } as never });
      await flush();
      const handoffTargets = vi.spyOn(
        tool as unknown as { handoffTargets: (ids: number[]) => unknown },
        'handoffTargets'
      );

      rightPanel.querySelector<HTMLButtonElement>('.chara-slots-grid > button')!.click();

      expect(handoffTargets).toHaveBeenLastCalledWith([allowed[0].stainID]);
      const sentence = (tool as unknown as { selectionCardContainer: HTMLElement })
        .selectionCardContainer.textContent;
      expect(sentence).toContain(`Dye-${allowed[0].itemID}`);
      expect(sentence).not.toContain(`Dye-${metallicDye.itemID}`);
    });

    it('a slot on another palette commits that palette and survives its reload', async () => {
      CharaSessionService.setSession(charaSession());
      tool = mount();
      tool.setConfig({ colorSheet: 'tattooColors' });
      await flush();
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[3], distance: 2 }]);
      cells()[5].click();
      vi.mocked(controller().setConfig).mockClear();

      rightPanel.querySelector<HTMLButtonElement>('.chara-slots-grid > button')!.click();

      expect(cards()).toHaveLength(0);
      expect(controller().setConfig).toHaveBeenCalledWith('swatch', { colorSheet: 'eyeColors' });
      await flush();
      expect(gridTitle()).toContain('tools.character.eyeColors');
      expect(selection()).toMatchObject({ source: 'slot', slotKey: 'leftEye' });
      expect(
        (tool as unknown as { selectionCardContainer: HTMLElement }).selectionCardContainer
          .textContent
      ).toContain('SWATCH.SLOTLEFTEYE');
    });

    it('no longer draws DYES ON THIS GLAMOUR: it moved to the Glamour Reader', async () => {
      tool = mount();
      CharaSessionService.setSession(
        charaSession({
          gearModels: [{ slot: 'Body', base: 200, variant: 1 }],
          gearDyes: [{ slot: 'Body', channel: 1, stainId: 1, dye: null }],
        })
      );
      await flush();

      expect(rightPanel.querySelector('[data-role="glamour-block"]')).toBeNull();
    });

    it('links the loaded file to the Glamour Reader', async () => {
      const { RouterService } = await import('@services/index');
      tool = mount();
      CharaSessionService.setSession(charaSession());
      await flush();

      rightPanel.querySelector<HTMLButtonElement>('[data-role="cross-link"]')!.click();

      expect(RouterService.navigateTo).toHaveBeenCalledWith('glamour');
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

    it('titles the grid through swatch.gridTitle rather than name + "(n)"', async () => {
      tool = mount();
      await flush();

      // One key holds both halves, so ja can write "{name}（{count}）"
      const title = rightPanel.querySelector('.section-title');
      expect(title?.textContent).toContain('swatch.gridTitle:');
      expect(title?.textContent).toContain('/24');
    });

    it('feeds the selection sentence the palette and the address as separate params', async () => {
      tool = mount();
      await flush();

      swatches()[3].click();
      await flush();

      // {palette} and {addr} arrive apart, so a language may reorder them
      expect(rightPanel.textContent).toContain('swatch.selSentenceCell:');
      expect(rightPanel.textContent).toContain('/R1·C4/');
    });

    it('paints each cell with its own colour', async () => {
      tool = mount();
      await flush();

      const cells = swatches();
      expect(cells[0].getAttribute('style')).toContain('background-color: #000000');
      expect(cells[1].getAttribute('style')).toContain('background-color: #0B0B0B');
    });

    it('records the clicked cell as the selection', async () => {
      tool = mount();
      await flush();
      vi.mocked(StorageService.setItem).mockClear();

      swatches()[3].click();
      await flush();

      // Cell address, not hex — the index is what the R·C address derives from
      expect(share().shareParams).toMatchObject({ slot: 'eyeColors', i: 3 });
      // v3_character_color_index was written here and never read: retired
      expect(retiredWrites()).toEqual([]);
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

    it('mirrors the CMYK display option onto the result cards', async () => {
      tool = mount();
      await flush();
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 3 }]);
      tool.setConfig({ displayOptions: { showCmyk: true } as never });
      await flush();

      swatches()[0].click();
      await flush();

      const card = container.querySelector('v4-result-card') as HTMLElement & {
        showCmyk?: boolean;
      };
      expect(card).toBeTruthy();
      expect(card.showCmyk).toBe(true);
    });

    it('clearDyes resets both the forward and the reverse side', async () => {
      tool = mount();
      await flush();
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);
      swatches()[5].click();
      tool.selectDye({ ...mockDyes[0], hex: '#AABBCC' } as never);

      tool.clearDyes();

      expect(cards()).toHaveLength(0);
      // The outline went with the selection (it used to stay on the old cell)
      expect(outlined()).toHaveLength(0);
      expect(share().disabled).toBe(true);
      expect(
        (tool as unknown as { reverseMatchedSwatches: unknown[] }).reverseMatchedSwatches
      ).toEqual([]);
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

    it('ignores configuration arriving after destroy', async () => {
      const getHairColors = vi.spyOn(CharacterColorService.prototype, 'getHairColors');
      tool = mount();
      tool.destroy();

      // The sidebar can emit one last config-change during teardown
      expect(() => tool!.setConfig({ colorSheet: 'hairColors' })).not.toThrow();
      await flush();

      expect(getHairColors).not.toHaveBeenCalled();
    });

    it('works with no drawer panel supplied', async () => {
      tool = mount({ drawer: false });
      tool.setConfig({ colorSheet: 'eyeColors' });
      await flush();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });
});

describe('RACE_GROUPS (DEAD-024 adoption)', () => {
  it('has one group per race in the shared RACE_SUBRACES table, in the same order', () => {
    expect(RACE_GROUPS.map((g) => g.subraces)).toEqual(
      Object.values(RACE_SUBRACES).map((subraces) => [...subraces])
    );
  });

  it('preserves the pre-adoption localization keys', () => {
    expect(RACE_GROUPS.map((g) => g.raceKey)).toEqual([
      'hyur',
      'elezen',
      'lalafell',
      'miqote',
      'roegadyn',
      'auRa',
      'hrothgar',
      'viera',
    ]);
  });
});
