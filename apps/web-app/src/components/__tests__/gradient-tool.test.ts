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
import { ConfigController, dyeService, MarketBoardService, StorageService } from '@services/index';
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
      // Read for every displayed dye before a fetch; absent, the fetch throws
      // inside a voided promise and the rejection fails the whole file.
      shouldFetchPrice: vi.fn().mockReturnValue(false),
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

describe('GradientTool', () => {
  let container: HTMLElement;
  /**
   * The one panel v4-layout hands every tool, as both its left and right
   * panel, with no drawer (v4-layout.ts loadToolContent). mount() uses the
   * same shape, so the suite runs the tool the way production does.
   */
  let panel: HTMLElement;
  let tool: GradientTool | null;

  beforeEach(() => {
    container = createTestContainer();
    panel = document.createElement('div');
    panel.className = 'v4-tool-main';
    container.appendChild(panel);
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
    it('renders the 4C workspace into the one panel v4-layout hands it', () => {
      tool = mount();

      for (const testId of [
        'gradient-endpoints-row',
        'gradient-pin-rail',
        'gradient-results-section',
        'gradient-empty-state',
        'gradient-matches-container',
      ]) {
        expect(panel.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
      }
      // Nothing to share until both endpoints are set
      expect(shareParams()!.disabled).toBe(true);
    });

    // REFACTOR-005: the v3 left panel (dye selector, settings, market board)
    // and the mobile drawer are gone. v4-layout passes the workspace panel as
    // the left panel and no drawer, so neither was ever seen.
    it('draws only into the right panel: no left panel, no drawer', () => {
      const leftPanel = document.createElement('div');
      const rightPanel = document.createElement('div');
      const drawerContent = document.createElement('div');
      container.append(leftPanel, rightPanel, drawerContent);

      tool = new GradientTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.childElementCount).toBe(0);
      expect(drawerContent.childElementCount).toBe(0);
      expect(rightPanel.querySelector('[data-testid="gradient-endpoints-row"]')).not.toBeNull();
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should have setConfig method', () => {
      tool = mount();

      expect(typeof tool.setConfig).toBe('function');
    });

    it('should accept config via setConfig', () => {
      tool = mount();

      expect(() => tool!.setConfig({ stepCount: 10 })).not.toThrow();
      expect(panel.querySelector('[data-testid="gradient-endpoints-row"]')).not.toBeNull();
    });
  });

  // ============================================================================
  // Dye Selection Tests
  // ============================================================================

  describe('Dye Selection', () => {
    it('should have selectDye method', () => {
      tool = mount();

      expect(typeof tool.selectDye).toBe('function');
    });

    it('should have clearDyes method', () => {
      tool = mount();

      expect(typeof tool.clearDyes).toBe('function');
    });

    it('should accept dye selection', () => {
      tool = mount();

      // Should not throw
      expect(() => tool!.selectDye(mockDyes[0])).not.toThrow();
    });

    it('should clear dyes', () => {
      tool = mount();

      tool.selectDye(mockDyes[0]);

      // Should not throw
      expect(() => tool!.clearDyes()).not.toThrow();
    });

    it('should support two dyes for gradient', () => {
      tool = mount();

      // Should not throw when adding two dyes
      expect(() => {
        tool!.selectDye(mockDyes[0]);
        tool!.selectDye(mockDyes[1]);
      }).not.toThrow();
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
      tool = mount();

      // Should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });

    it('should handle double destroy gracefully', () => {
      tool = mount();

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

  /** Construct and init the tool the way v4-layout does: one panel, no drawer. */
  const mount = (): GradientTool => {
    const t = new GradientTool(container, {
      leftPanel: panel,
      rightPanel: panel,
      drawerContent: null,
    });
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
    data: { dye: Dye; matchingMethod: string; marketServer?: string };
    showHex: boolean;
    showRgb: boolean;
    showCmyk: boolean;
    showPrice: boolean;
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

    // BUG-086 sibling (2026-10-04 Sprint 22 review): the tool's own Price
    // option alone drew the market row, but the service fetches nothing while
    // the global Market Board toggle is off (its default), so the step cards
    // read "Market —" forever on a fresh profile.
    describe('the price row needs the Market Board toggle too', () => {
      const serviceShowPrices = () => vi.mocked(MarketBoardService.getInstance().getShowPrices);
      const serviceServer = () => vi.mocked(MarketBoardService.getInstance().getSelectedServer);

      afterEach(() => {
        // One shared mock object, and restoreAllMocks keeps vi.fn implementations.
        serviceShowPrices().mockReturnValue(false);
        serviceServer().mockReturnValue(null as never);
      });

      it('draws no price row while the Market Board toggle is off', async () => {
        serviceShowPrices().mockReturnValue(false);
        tool = await mountWithRamp();

        tool.setConfig({ displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showPrice: true } });

        expect(stepCards().length).toBeGreaterThan(0);
        expect(stepCards().map((card) => card.showPrice)).toEqual(stepCards().map(() => false));
      });

      it('draws it with both the option and the toggle on', async () => {
        serviceShowPrices().mockReturnValue(true);
        tool = await mountWithRamp();

        tool.setConfig({ displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showPrice: true } });

        expect(stepCards().length).toBeGreaterThan(0);
        expect(stepCards().map((card) => card.showPrice)).toEqual(stepCards().map(() => true));
      });

      // REFACTOR-005: a card whose price names no world shows the selected
      // server. It came through the removed left-panel MarketBoard, which only
      // delegated to the service, and only while prices were on.
      it('names the selected server on each card while prices are on', async () => {
        serviceShowPrices().mockReturnValue(true);
        serviceServer().mockReturnValue('Crystal');

        tool = await mountWithRamp();

        expect(stepCards().length).toBeGreaterThan(0);
        expect(stepCards().map((card) => card.data.marketServer)).toEqual(
          stepCards().map(() => 'Crystal')
        );
      });

      it('names no server while prices are off', async () => {
        serviceServer().mockReturnValue('Crystal');

        tool = await mountWithRamp();

        expect(stepCards().length).toBeGreaterThan(0);
        expect(stepCards().map((card) => card.data.marketServer)).toEqual(
          stepCards().map(() => undefined)
        );
      });
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

    it('never writes them — not from setConfig or a share link', async () => {
      tool = mountAt('?start=1&end=2&steps=12&interpolation=oklch&v=1');
      tool.setConfig({ stepCount: 5, interpolation: 'lab' });
      await flush();

      expect(retiredCalls(StorageService.setItem)).toEqual([]);
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

    // REFACTOR-005: the in-tool steps sliders are gone, so the sidebar's
    // broadcast is the one way a step count arrives — and it clears the pins.
    // (The drawer's slider never did; that drift went with it.) Index 3 is
    // still inside a 6-step ramp, so only that clear() empties the pins here.
    it('a sidebar step change re-counts the ramp and clears its pins', async () => {
      tool = await mountWithRamp();
      pinsOf(tool).set(3, mockDyes[1]);

      controller().setConfig('gradient', { stepCount: 6 });
      await flush();

      expect(stepCards()).toHaveLength(6);
      expect(settingsInEffect().steps).toBe(6);
      expect(pinsOf(tool).size).toBe(0);
    });

    // REFACTOR-005: a server or prices-toggle change reaches the tool through
    // its 'market' subscription alone. The removed left-panel MarketBoard also
    // relayed MarketBoardService's events back in — a duplicate, since the
    // service emits them only from its own 'market' subscription.
    describe("a market change, through the controller's 'market' broadcast", () => {
      const service = () => MarketBoardService.getInstance();

      beforeEach(() => {
        // The service applies a change before the tool hears it (it subscribed first)
        controller().setConfig('market', { showPrices: true });
        vi.mocked(service().getShowPrices).mockReturnValue(true);
        vi.mocked(service().shouldFetchPrice).mockReturnValue(true);
      });

      afterEach(() => {
        // One shared mock object, and restoreAllMocks keeps vi.fn implementations.
        vi.mocked(service().getShowPrices).mockReturnValue(false);
        vi.mocked(service().shouldFetchPrice).mockReturnValue(false);
      });

      it("refetches the ramp's prices on a server change while prices are on", async () => {
        tool = await mountWithRamp();
        vi.mocked(service().fetchPricesForDyes).mockClear();

        controller().setConfig('market', { selectedServer: 'Aether' });
        await flush();

        expect(service().fetchPricesForDyes).toHaveBeenCalled();
        const fetched = vi.mocked(service().fetchPricesForDyes).mock.calls.at(-1)![0];
        expect(fetched.map((d) => d.id)).toEqual(expect.arrayContaining([1, 2]));
        expect(stepCards()).toHaveLength(8);
      });

      it('redraws the step cards without a fetch when prices go off', async () => {
        tool = await mountWithRamp();
        const redraw = vi.spyOn(
          tool as unknown as { renderIntermediateMatches: () => void },
          'renderIntermediateMatches'
        );
        vi.mocked(service().fetchPricesForDyes).mockClear();
        vi.mocked(service().getShowPrices).mockReturnValue(false);

        controller().setConfig('market', { showPrices: false });
        await flush();

        expect(redraw).toHaveBeenCalled();
        expect(service().fetchPricesForDyes).not.toHaveBeenCalled();
      });

      // The 'market' subscription is the tool's one way in for a market
      // change, so destroy() must release it (this.subs) or a navigated-away
      // Gradient keeps hearing every server and prices change.
      it('stops hearing the broadcast once destroyed', async () => {
        tool = await mountWithRamp();
        const apply = vi.spyOn(tool, 'setConfig');
        const redraw = vi.spyOn(
          tool as unknown as { renderIntermediateMatches: () => void },
          'renderIntermediateMatches'
        );
        tool.destroy();
        vi.mocked(service().fetchPricesForDyes).mockClear();

        // A different server than the one held, so the controller broadcasts
        const { selectedServer } = controller().getConfig('market');
        controller().setConfig('market', {
          selectedServer: selectedServer === 'Crystal' ? 'Primal' : 'Crystal',
          showPrices: true,
        });
        await flush();

        // destroy() also empties the ramp, so a leaked subscriber would find
        // nothing to fetch either: the setConfig spy is what tells them apart
        expect(apply).not.toHaveBeenCalled();
        expect(service().fetchPricesForDyes).not.toHaveBeenCalled();
        expect(redraw).not.toHaveBeenCalled();
      });
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
  });

  // ==========================================================================
  // Every action the result card performs itself is a no-op in the tool.
  // DEAD-003 removed the legacy actions the tool handled, and with them its
  // only RouterService call; BUG-040's lint rule keeps any future import on
  // the @services/index barrel this suite mocks, so the not-called
  // assertions below cannot pass against the REAL RouterService.
  // ==========================================================================

  describe('context actions — hand off to another tool', () => {
    const contextAction = (action: string): void =>
      (
        tool as unknown as {
          handleContextAction: (action: string, dye: unknown) => void;
        }
      ).handleContextAction(action, dye(1));

    // The 2026-10-04 Sprint 5 review: the result card performs each of these
    // before it emits the action, so the tool repeating it navigated twice and
    // toasted twice — and with Comparison already holding four dyes, the card
    // opened its slot-selection modal while the tool added the dye anyway and
    // navigated away under it.
    it.each([
      'inspect-harmony',
      'inspect-accessibility',
      'inspect-comparison',
      'transform-gradient',
      'transform-mixer',
    ])('leaves %s to the result card', async (action) => {
      tool = mount();
      const { RouterService, StorageService, ToastService } = await import('@services/index');
      vi.mocked(RouterService.navigateTo).mockClear();
      vi.mocked(StorageService.setItem).mockClear();

      contextAction(action);

      expect(RouterService.navigateTo).not.toHaveBeenCalled();
      expect(StorageService.setItem).not.toHaveBeenCalled();
      expect(ToastService.success).not.toHaveBeenCalled();
      expect(ToastService.info).not.toHaveBeenCalled();
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

  // ==========================================================================
  // BUG-092 (2026-10-04 deep-dive): a Custom Color endpoint was stored by its
  // synthetic id, which resolves to nothing on the next load — and the
  // missing slot was filtered out, so the End dye slid into Start.
  // ==========================================================================

  describe('stored endpoints survive a reload', () => {
    beforeEach(() => {
      // The real lookup misses with null, not the suite mock's undefined
      mockGetDyeById.mockImplementation((id: number) => mockDyes.find((d) => d.id === id) ?? null);
    });

    afterEach(() => {
      // restoreAllMocks keeps vi.fn implementations in Vitest 5
      vi.mocked(StorageService.getItem).mockReset().mockReturnValue(null);
    });

    /** The tool's [start, end], as it holds them. */
    const endpointsOf = (t: GradientTool): Dye[] =>
      (t as unknown as { selectedDyes: Dye[] }).selectedDyes;

    /** Hand the endpoints key `saved` on the next mount. */
    const storeEndpoints = (saved: unknown): void => {
      vi.mocked(StorageService.getItem).mockImplementation(((key: string) =>
        key === DYES_KEY ? saved : null) as never);
    };

    /** Remount with whatever the current tool last persisted. */
    const reload = async (): Promise<GradientTool> => {
      const saved = await lastWrite(DYES_KEY);
      tool!.destroy();
      storeEndpoints(saved);
      return mount();
    };

    it('keeps a custom-colour start and a dye end in their own slots', async () => {
      tool = mount();
      tool.selectCustomColor('#ff0000');
      tool.selectDye(mockDyes[1]);

      tool = await reload();

      const [start, end] = endpointsOf(tool);
      expect(start?.hex).toBe('#FF0000');
      expect(end?.id).toBe(mockDyes[1].id);
    });

    it('keeps a dye start and a custom-colour end in their own slots', async () => {
      tool = mount();
      tool.selectDye(mockDyes[1]);
      tool.selectCustomColor('#00ff00');

      tool = await reload();

      const [start, end] = endpointsOf(tool);
      expect(start?.id).toBe(mockDyes[1].id);
      expect(end?.hex).toBe('#00FF00');
    });

    it('never promotes the end dye into a start it cannot restore', () => {
      // What the pre-fix code stored for a custom start: its synthetic id
      storeEndpoints([-1700000000001, mockDyes[1].id]);

      tool = mount();

      expect(endpointsOf(tool)).toEqual([]);
    });
  });

  // ==========================================================================
  // update() — every language switch — rebuilds the workspace. BUG-093's
  // child teardown went with the left panel and drawer (REFACTOR-005): the
  // workspace builds no child components, so the rebuild has nothing to
  // destroy, and onUpdate() redraws it from the state the tool holds.
  // ==========================================================================

  describe('update() rebuilds the workspace from the current state', () => {
    it('keeps one workspace, the same endpoints and the pins', async () => {
      tool = await mountWithRamp();
      pinsOf(tool).set(3, mockDyes[1]);

      tool.update();
      await flush();

      expect(panel.querySelectorAll('[data-testid="gradient-endpoints-row"]')).toHaveLength(1);
      expect(panel.querySelectorAll('v4-share-button')).toHaveLength(1);
      expect(stepCards()).toHaveLength(8);
      expect(stepCards()[0].data.dye.id).toBe(1);
      expect(stepCards().at(-1)!.data.dye.id).toBe(2);
      expect(pinsOf(tool).size).toBe(1);
    });
  });

  // ==========================================================================
  // BUG-094 (2026-10-04 deep-dive): the result card's Start/End slot picker
  // wrote the slot directly, so the start row's own card set as End gave a
  // flat start-to-start gradient.
  // ==========================================================================

  describe('result-card slot picker — the endpoint rules', () => {
    const pickSlot = (card: StepCard, action: 'add-mixer-slot-1' | 'add-mixer-slot-2'): void => {
      card.dispatchEvent(
        new CustomEvent('context-action', { detail: { action, dye: card.data.dye } })
      );
    };

    it("swaps the ends when the start row's dye is set as End", async () => {
      tool = await mountWithRamp();
      const startCard = stepCards()[0];
      expect(startCard.data.dye.id).toBe(1);

      pickSlot(startCard, 'add-mixer-slot-2');

      expect(await endpoints()).toEqual([2, 1]);
    });

    it("swaps the ends when the end row's dye is set as Start", async () => {
      tool = await mountWithRamp();
      const endCard = stepCards().at(-1)!;
      expect(endCard.data.dye.id).toBe(2);

      pickSlot(endCard, 'add-mixer-slot-1');

      expect(await endpoints()).toEqual([2, 1]);
    });

    it("leaves the ends alone when a row's dye is set into its own slot", async () => {
      tool = await mountWithRamp();
      const startCard = stepCards()[0];
      vi.mocked(StorageService.setItem).mockClear();

      pickSlot(startCard, 'add-mixer-slot-1');

      expect(await endpoints()).toBeUndefined();
    });

    it("puts a middle step's dye into the chosen slot", async () => {
      tool = await mountWithRamp();
      const middleCard = stepCards()[1];

      pickSlot(middleCard, 'add-mixer-slot-2');

      expect(await endpoints()).toEqual([1, middleCard.data.dye.id]);
    });
  });
});
