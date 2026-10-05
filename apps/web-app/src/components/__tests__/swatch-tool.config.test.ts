/**
 * XIV Dye Tools - SwatchTool against the REAL ConfigController and storage
 *
 * swatch-tool.test.ts mocks the controller, whose subscribe never fires; that
 * is how BUG-001 (2026-10-04 deep-dive) passed the whole suite. Here the
 * controller, its persistence and StorageService are the real ones over jsdom
 * localStorage, so a test can persist a config the way the sidebar does,
 * mount the tool, and watch the controller's full broadcasts reach it. It
 * also covers the one-time move of the v3_character_* keys into the
 * controller, which only real storage can show.
 *
 * Every test re-imports the tool's module graph (vi.resetModules) for a fresh
 * once-per-page migration flag and a fresh controller singleton, so the
 * classes are always taken from `load()`, never from a static import.
 *
 * @module components/__tests__/swatch-tool.config.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Dye } from '@xivdyetools/types';
import { DEFAULT_DISPLAY_OPTIONS, DEFAULT_DYE_FILTERS } from '@shared/tool-config-types';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

const { mockCharaFindClosestDyes } = vi.hoisted(() => ({ mockCharaFindClosestDyes: vi.fn() }));

/**
 * The barrel, with the real ConfigController and StorageService. Everything
 * else is the minimum the tool's render reaches; a missing method throws
 * inside renderContent, which safeRender() swallows into an empty panel.
 */
vi.mock('@services/index', async () => {
  const { ConfigController } = await vi.importActual<typeof import('@services/config-controller')>(
    '@services/config-controller'
  );
  const { StorageService } = await vi.importActual<typeof import('@services/storage-service')>(
    '@services/storage-service'
  );
  const { mockDyes: dyes } = await vi.importActual<typeof import('../../__tests__/mocks/services')>(
    '../../__tests__/mocks/services'
  );
  const dyeService = {
    getAllDyes: () => dyes,
    getDyeById: (id: number) => dyes.find((d) => d.id === id),
    findClosestDyes: () => [],
    getCategories: () => ['Base', 'Craft'],
  };
  return {
    ConfigController,
    StorageService,
    dyeService,
    DyeService: { getInstance: () => dyeService },
    LanguageService: {
      t: (key: string) => key,
      tInterpolate: (key: string, params: Record<string, string>) =>
        `${key}: ${Object.values(params).join('/')}`,
      getDyeName: (itemId: number) => `Dye-${itemId}`,
      getRace: (key: string) => `race:${key}`,
      getClan: (key: string) => `clan:${key}`,
      getAcquisition: (key: string) => `acq:${key}`,
      getCurrency: (key: string) => `cur:${key}`,
      getCurrentLocale: () => 'en',
      subscribe: () => () => {},
    },
    ColorService: {
      getDistanceForMethod: () => 15,
      hexToRgb: () => ({ r: 0, g: 0, b: 0 }),
      rgbToHsv: () => ({ h: 0, s: 0, v: 0 }),
      hexToHsv: () => ({ h: 0, s: 0, v: 0 }),
      hexToLab: () => ({ l: 50, a: 0, b: 0 }),
      getDeltaE: () => 15,
    },
    MarketBoardService: {
      getInstance: () => ({
        getWorldNameForPrice: () => null,
        getShowPrices: () => false,
        subscribe: () => () => {},
      }),
    },
    CollectionService: {
      getFavorites: () => [],
      subscribeFavorites: () => () => {},
      isFavorite: () => false,
    },
    RouterService: { navigateTo: vi.fn(), subscribe: () => () => {} },
    ToastService: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), show: vi.fn() },
  };
});

/** Real core, with only the colour sheets and the forward matcher stubbed. */
vi.mock('@xivdyetools/core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  CharacterColorService: class MockCharacterColorService {
    private colors = Array.from({ length: 24 }, (_, i) => ({
      index: i,
      hex: `#${(i * 11).toString(16).padStart(2, '0').repeat(3)}`.toUpperCase(),
      name: `Color ${i}`,
    }));
    getEyeColors() {
      return this.colors;
    }
    getHighlightColors() {
      return this.colors;
    }
    getLipColorsDark() {
      return this.colors;
    }
    getLipColorsLight() {
      return this.colors;
    }
    getTattooColors() {
      return this.colors;
    }
    getFacePaintColorsDark() {
      return this.colors;
    }
    getFacePaintColorsLight() {
      return this.colors;
    }
    async getHairColors() {
      return this.colors;
    }
    async getSkinColors() {
      return this.colors;
    }
    findClosestDyes(...args: unknown[]) {
      return mockCharaFindClosestDyes(...args) ?? [];
    }
  },
}));

vi.mock('@shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@services/pricing-mixin', () => ({
  setupMarketBoardListeners: vi.fn().mockReturnValue(() => {}),
}));
vi.mock('@services/chara-resolve-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@services/chara-resolve-service')>()),
  resolveCharaEquipment: vi.fn(() => new Promise(() => {})),
}));
// Both register a custom element on import, and a re-import after
// vi.resetModules() would define the same tag twice and throw.
vi.mock('@components/v4/result-card', () => ({}));
vi.mock('@components/v4/share-button', () => ({}));
vi.mock('../collapsible-panel', () => ({
  CollapsiblePanel: class {
    private body: HTMLElement | null = null;
    constructor(private container: HTMLElement) {}
    init() {
      this.body = document.createElement('div');
      this.container.appendChild(this.body);
    }
    setContent(content: HTMLElement) {
      if (!this.body) this.init();
      this.body!.appendChild(content);
    }
    destroy() {
      this.container.replaceChildren();
    }
  },
}));
vi.mock('../market-board', () => ({
  MarketBoard: class {
    init() {}
    destroy() {}
    getShowPrices() {
      return false;
    }
    setShowPrices() {}
    setSelectedServer() {}
    async fetchPricesForDyes() {
      return new Map();
    }
  },
}));

const MIGRATED_KEY = 'xivdyetools_swatch_v3_migrated';
const CONFIG_KEY = 'xivdyetools_v4_config_swatch';
const V3_KEYS = {
  subrace: 'v3_character_subrace',
  gender: 'v3_character_gender',
  category: 'v3_character_category',
  colorIndex: 'v3_character_color_index',
  maxResults: 'v3_character_max_results',
};

/** A fresh tool module graph: new migration flag, new controller singleton. */
async function load() {
  vi.resetModules();
  const { SwatchTool } = await import('../swatch-tool');
  const { ConfigController } = await import('@services/index');
  return { SwatchTool, ConfigController };
}
type Loaded = Awaited<ReturnType<typeof load>>;

const flush = async () => {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

describe('SwatchTool with the real ConfigController', () => {
  let container: HTMLElement;
  let panel: HTMLElement;
  let loaded: Loaded | null;
  let tool: InstanceType<Loaded['SwatchTool']> | null;

  beforeEach(() => {
    localStorage.clear();
    container = createTestContainer();
    panel = document.createElement('div');
    container.appendChild(panel);
    loaded = null;
    tool = null;
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    tool?.destroy();
    loaded?.ConfigController.resetInstance();
    cleanupTestContainer(container);
    localStorage.clear();
    mockCharaFindClosestDyes.mockReset();
    vi.restoreAllMocks();
  });

  /** Load the graph and mount in the V4 shape: one panel is both left and right. */
  const mount = async () => {
    loaded ??= await load();
    tool = new loaded.SwatchTool(container, { leftPanel: panel, rightPanel: panel });
    tool.init();
    await flush();
    return loaded;
  };

  const gridTitle = () => panel.querySelector('.section-title')?.textContent ?? '';
  const cells = () => Array.from(panel.querySelectorAll<HTMLButtonElement>('button[data-index]'));
  const outlined = () => cells().filter((c) => c.style.outline.includes('var(--theme-primary)'));
  type Card = HTMLElement & { data?: { dye: Dye }; showCmyk?: boolean };
  const cards = () => Array.from(panel.querySelectorAll<Card>('v4-result-card'));
  const railChip = (labelKey: string) =>
    Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent === labelKey
    )!;
  const lastMatchRequest = () =>
    mockCharaFindClosestDyes.mock.calls[mockCharaFindClosestDyes.mock.calls.length - 1][2] as {
      count: number;
      matchingMethod: string;
    };
  const metallicDye = mockDyes.find((d) => d.isMetallic)!;
  /** What a browser that already ran the v3 migration has. */
  const markMigrated = () => localStorage.setItem(MIGRATED_KEY, 'true');

  // ==========================================================================
  // BUG-011 / BUG-022 (2026-10-04 deep-dive): mount against a non-default
  // persisted config.
  // ==========================================================================

  it('opens on a persisted config: sheet, count, method, filters, display options', async () => {
    markMigrated();
    loaded = await load();
    // What the sidebar leaves behind: partial writes merged into the config
    loaded.ConfigController.getInstance().setConfig('swatch', {
      colorSheet: 'tattooColors',
      maxResults: 5,
      matchingMethod: 'oklab',
      displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showCmyk: true },
      dyeFilters: { ...DEFAULT_DYE_FILTERS, excludeMetallic: true },
    });
    mockCharaFindClosestDyes.mockReturnValue([
      { dye: metallicDye, distance: 1 },
      { dye: mockDyes[0], distance: 2 },
    ]);
    await mount();

    expect(gridTitle()).toContain('tools.character.tattooColors');
    cells()[0].click();
    // The whole pool, because a filter is active (BUG-025), then trimmed to 5
    expect(lastMatchRequest()).toEqual({ count: mockDyes.length, matchingMethod: 'oklab' });
    expect(cards().map((c) => c.data?.dye.id)).toEqual([mockDyes[0].id]);
    expect(cards()[0].showCmyk).toBe(true);
  });

  // ==========================================================================
  // BUG-001 (2026-10-04 deep-dive), end to end through the real controller.
  // ==========================================================================

  it('a rail pick survives the full broadcasts that follow it', async () => {
    markMigrated();
    const { ConfigController } = await mount();
    const controller = ConfigController.getInstance();
    expect(gridTitle()).toContain('tools.character.eyeColors');

    railChip('swatch.palTattoo').click();
    await flush();
    expect(controller.getConfig('swatch').colorSheet).toBe('tattooColors');
    mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);
    cells()[5].click();

    // The sidebar's count slider, then a display-option fan-out
    controller.setConfig('swatch', { maxResults: 5 });
    controller.setConfig('swatch', {
      displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showCmyk: true },
    });
    await flush();

    expect(gridTitle()).toContain('tools.character.tattooColors');
    expect(tool).toMatchObject({ subrace: 'Midlander', gender: 'Male' });
    expect(outlined().map((c) => c.dataset.index)).toEqual(['5']);
    expect(lastMatchRequest().count).toBe(5);
    expect(cards()[0].showCmyk).toBe(true);
    // ...and the pick is still there on the next visit
    tool!.destroy();
    tool = null;
    await mount();
    expect(gridTitle()).toContain('tools.character.tattooColors');
  });

  // ==========================================================================
  // BUG-019 (2026-10-04 deep-dive): a share link's settings reach the
  // controller, so its next broadcast keeps them.
  // ==========================================================================

  describe('a share link', () => {
    const initialUrl = window.location.href;
    afterEach(() => window.history.replaceState(null, '', initialUrl));

    it('persists its validated settings, which the next broadcast keeps', async () => {
      markMigrated();
      window.history.replaceState(
        null,
        '',
        '/swatch/?slot=tattooColors&algo=oklab&limit=9&i=2&v=1'
      );
      mockCharaFindClosestDyes.mockReturnValue([{ dye: mockDyes[0], distance: 2 }]);
      const { ConfigController } = await mount();
      const controller = ConfigController.getInstance();

      expect(controller.getConfig('swatch')).toMatchObject({
        colorSheet: 'tattooColors',
        matchingMethod: 'oklab',
        maxResults: 6,
      });

      controller.setConfig('swatch', {
        displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showCmyk: true },
      });
      await flush();

      expect(gridTitle()).toContain('tools.character.tattooColors');
      expect(outlined().map((c) => c.dataset.index)).toEqual(['2']);
      expect(lastMatchRequest()).toEqual({ count: 6, matchingMethod: 'oklab' });
    });
  });

  // ==========================================================================
  // The one-time move of the v3_character_* keys into the controller.
  // ==========================================================================

  describe('the v3 settings migration', () => {
    it('moves the v3 values into the controller, then removes the keys and marks it done', async () => {
      // How StorageService wrote them: strings raw, numbers as JSON
      localStorage.setItem(V3_KEYS.subrace, 'Helion'); // pre-5.0 spelling
      localStorage.setItem(V3_KEYS.gender, 'Female');
      localStorage.setItem(V3_KEYS.category, 'hairColors');
      localStorage.setItem(V3_KEYS.maxResults, '9'); // a share link allowed up to 20
      localStorage.setItem(V3_KEYS.colorIndex, '4'); // written, never read
      const { ConfigController } = await mount();

      expect(ConfigController.getInstance().getConfig('swatch')).toMatchObject({
        colorSheet: 'hairColors',
        race: 'Helions',
        gender: 'Female',
        maxResults: 6,
      });
      expect(JSON.parse(localStorage.getItem(CONFIG_KEY)!)).toMatchObject({
        colorSheet: 'hairColors',
        race: 'Helions',
      });
      for (const key of Object.values(V3_KEYS)) {
        expect(localStorage.getItem(key)).toBeNull();
      }
      expect(localStorage.getItem(MIGRATED_KEY)).toBe('true');
      expect(gridTitle()).toContain('tools.character.hairColors');
    });

    // The sidebar's display-option and dye-filter fan-outs persisted a full
    // swatch config carrying the controller's old defaults for many users who
    // never chose them; the tool showed its own defaults instead.
    it("writes the tool's old defaults over a stale persisted config when no v3 key exists", async () => {
      localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify({
          colorSheet: 'hairColors',
          race: 'SeekerOfTheSun',
          gender: 'Female',
          maxResults: 3,
          matchingMethod: 'oklab',
        })
      );
      const { ConfigController } = await mount();

      expect(ConfigController.getInstance().getConfig('swatch')).toMatchObject({
        colorSheet: 'eyeColors',
        race: 'Midlander',
        gender: 'Male',
        maxResults: 3,
        // Not one of the four mirrored fields: left as the user set it
        matchingMethod: 'oklab',
      });
      expect(gridTitle()).toContain('tools.character.eyeColors');
    });

    // A config that was never stored reads as the defaults of whichever build
    // reads it, and builds before 5.14.1 default to hairColors / SeekerOfTheSun
    // / Female. An older tab left open across the deploy would broadcast those
    // back the next time it fanned out a display option.
    it('stores the values it migrates, even when they equal the new defaults', async () => {
      await mount();

      expect(JSON.parse(localStorage.getItem(CONFIG_KEY)!)).toMatchObject({
        colorSheet: 'eyeColors',
        race: 'Midlander',
        gender: 'Male',
        maxResults: 3,
      });
    });

    it('validates each v3 value before it is persisted', async () => {
      localStorage.setItem(V3_KEYS.subrace, 'Nope');
      localStorage.setItem(V3_KEYS.gender, 'Other');
      localStorage.setItem(V3_KEYS.category, 'bogusColors');
      localStorage.setItem(V3_KEYS.maxResults, 'abc');
      const { ConfigController } = await mount();

      expect(ConfigController.getInstance().getConfig('swatch')).toMatchObject({
        colorSheet: 'eyeColors',
        race: 'Midlander',
        gender: 'Male',
        maxResults: 3,
      });
      expect(localStorage.getItem(V3_KEYS.maxResults)).toBeNull();
    });

    it('runs once: not again on a remount, nor in a later page load', async () => {
      localStorage.setItem(V3_KEYS.category, 'hairColors');
      const { ConfigController } = await mount();
      expect(localStorage.getItem(MIGRATED_KEY)).toBe('true');

      // The user moves on, then something leaves a v3 key behind again
      ConfigController.getInstance().setConfig('swatch', { colorSheet: 'tattooColors' });
      localStorage.setItem(V3_KEYS.category, 'skinColors');
      tool!.destroy();
      tool = null;
      // Same page, even with the marker gone (a private window whose storage
      // writes are dropped): the module-level guard holds
      localStorage.removeItem(MIGRATED_KEY);
      await mount();
      expect(ConfigController.getInstance().getConfig('swatch').colorSheet).toBe('tattooColors');

      // A later page load (fresh module graph): the marker holds
      tool!.destroy();
      tool = null;
      ConfigController.resetInstance();
      localStorage.setItem(MIGRATED_KEY, 'true');
      loaded = await load();
      await mount();
      expect(loaded.ConfigController.getInstance().getConfig('swatch').colorSheet).toBe(
        'tattooColors'
      );
      expect(localStorage.getItem(V3_KEYS.category)).toBe('skinColors');
    });
  });
});
