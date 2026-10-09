/**
 * XIV Dye Tools - ResultCard Unit Tests
 *
 * Tests the V4 result card Lit component for displaying dye matches.
 * Covers rendering, data display, events, and context menu.
 *
 * @module components/__tests__/v4/result-card.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** The one dye the stubbed locale database knows a translated name for. */
const LOCALIZED_ITEM_ID = 52254;
const LOCALIZED_DYE_NAME = 'ダラガブレッド';

/**
 * `t()` returns the key so a locale-routed string is provable by its key
 * (`common.custom`); `tInterpolate` echoes the interpolated custom-colour
 * name so we can tell "the placeholder was filled" from "the key leaked".
 */
const languageServiceMock = {
  t: (key: string) => key,
  tInterpolate: (key: string, params: Record<string, string | number>) =>
    key === 'common.customColorName' ? `Custom (${params.hex})` : key,
  getCurrentLocale: () => 'en',
  /*
   * Argument-sensitive on purpose. A constant `() => undefined` ignores the one
   * thing that can be wrong here — WHICH id the card looks the name up by — so
   * changing `getDyeName(dye.id)` to `getDyeName(dye.stainID)` (the tempting
   * edit under stainID-first) left all 46 tests green while rendering English
   * names in every non-English locale. Returns `string | null`, matching
   * LocalizationService; an unknown id (a synthetic custom-dye one) is null and
   * the card falls back to `dye.name`.
   */
  getDyeName: (itemID: number): string | null =>
    itemID === LOCALIZED_ITEM_ID ? LOCALIZED_DYE_NAME : null,
  getAcquisition: (acquisition: string) => `ACQ:${acquisition}`,
  getCategory: (category: string) => `CAT:${category}`,
  /** Reached through `@shared/format`'s formatGil/formatNumber. */
  getCurrency: (currency: string) => `CUR:${currency}`,
  subscribe: vi.fn().mockReturnValue(() => {}),
};

/**
 * The real title-key table (`ROUTES` in `router-service.ts`), so `toolLabel`
 * is exercised against the same `extractor`→`tools.matcher.*` /
 * `swatch`→`tools.character.*` remap production code carries — a hand-picked
 * fake here could hide `toolLabel` reading the wrong key for those two tools.
 */
const ROUTE_TITLE_KEYS: Record<string, string> = {
  harmony: 'tools.harmony.title',
  extractor: 'tools.matcher.title',
  accessibility: 'tools.accessibility.title',
  comparison: 'tools.comparison.title',
  gradient: 'tools.gradient.title',
  presets: 'tools.presets.title',
  budget: 'tools.budget.title',
  swatch: 'tools.character.title',
  mixer: 'tools.mixer.title',
};

vi.mock('@services/index', () => ({
  LanguageService: languageServiceMock,
  StorageService: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  RouterService: {
    navigateTo: vi.fn(),
    getRouteForTool: (id: string) =>
      ROUTE_TITLE_KEYS[id] ? { id, titleKey: ROUTE_TITLE_KEYS[id] } : undefined,
  },
  ThemeService: { isDarkMode: vi.fn(() => false) },
}));

// `@shared/custom-dye` reaches LanguageService through its own module path.
vi.mock('@services/language-service', () => ({
  LanguageService: languageServiceMock,
}));

vi.mock('@xivdyetools/core', () => ({
  ColorService: {
    hexToRgb: vi.fn(() => ({ r: 255, g: 0, b: 0 })),
    rgbToHex: vi.fn(() => '#FF0000'),
    rgbToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    hexToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    hexToLab: vi.fn(() => ({ L: 50, a: 0, b: 0 })),
    hexToCmyk: vi.fn(() => ({ c: 0, m: 100, y: 100, k: 0 })),
    getDistanceForMethod: vi.fn(() => 0),
    isLightColor: vi.fn(() => false),
  },
  // The real `classifyBandTier` returns a numeric tier INDEX, which
  // `getTierColor` uses to pick a ramp entry. It was stubbed as the string
  // 'A' here, so `ramp[Math.min('A', 3)]` was `ramp[NaN]` — every verdict
  // colour came out `undefined` and no test could see it.
  classifyBandTier: vi.fn(() => 0),
  getConsolidatedDyeName: vi.fn(() => 'General-purpose Dye'),
  getMarketItemID: vi.fn((dye: { itemID: number }) => dye.itemID),
  // Same accepted shapes as core's: #RGB or #RRGGBB.
  isValidHexColor: (hex: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex),
  BAND_METHOD_DP: 2,
  DyeService: class MockDyeService {
    getAllDyes() {
      return [];
    }
    getDyeById() {
      return null;
    }
    getCategories() {
      return [];
    }
  },
  dyeDatabase: [],
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_CONTEXT_MENU: '<svg></svg>',
}));

describe('ResultCard', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should be a custom element', async () => {
      // Result card should be definable as custom element
      const { ResultCard } = await import('../../v4/result-card');
      expect(ResultCard).toBeDefined();
    });

    it('should have correct tag name', async () => {
      const { ResultCard } = await import('../../v4/result-card');
      // Custom element name
      expect(ResultCard.name).toBe('ResultCard');
    });
  });

  // ============================================================================
  // Data Interface Tests
  // ============================================================================

  describe('Data Interface', () => {
    it('should export ResultCardData type', async () => {
      const module = await import('../../v4/result-card');
      // Module should export types
      expect(module).toBeDefined();
    });

    it('should export ContextAction type', async () => {
      const module = await import('../../v4/result-card');
      // Module should export types
      expect(module).toBeDefined();
    });
  });

  // ============================================================================
  // Component Structure Tests
  // ============================================================================

  describe('Component Structure', () => {
    it('should extend BaseLitComponent', async () => {
      const { ResultCard } = await import('../../v4/result-card');
      const { BaseLitComponent } = await import('../../v4/base-lit-component');
      expect(ResultCard.prototype instanceof BaseLitComponent).toBe(true);
    });
  });

  // ============================================================================
  // Custom colours (HC-SYS-002)
  //
  // A colour picked from the Custom Color drawer is wrapped by
  // `makeCustomDye()`; its `category`/`acquisition` hold a sentinel, not a
  // real database value. The card must print the localized "Custom" label
  // for the ACQ row — running the sentinel through `getAcquisition()` would
  // leak `__custom__` — and must show the interpolated custom-colour name.
  // ============================================================================

  describe('custom dye rendering', () => {
    /** Mount a card over a custom colour with the ACQ zone switched on. */
    const mountCustomCard = async (hex: string) => {
      await import('../../v4/result-card');
      const { makeCustomDye } = await import('@shared/custom-dye');
      const dye = makeCustomDye(hex);

      const card = document.createElement('v4-result-card') as HTMLElement & {
        data?: unknown;
        showAcquisition?: boolean;
        showActions?: boolean;
        updateComplete?: Promise<unknown>;
      };
      card.data = { dye, originalColor: hex, matchedColor: hex };
      card.showAcquisition = true;
      card.showActions = false;
      container.appendChild(card);
      await card.updateComplete;
      return { card, dye };
    };

    it('prints the localized "Custom" label instead of the acquisition sentinel', async () => {
      const { card } = await mountCustomCard('#aabbcc');

      const text = card.shadowRoot?.textContent ?? '';
      expect(text).toContain('common.custom');
      // The sentinel must never reach the user, raw or through getAcquisition()
      expect(text).not.toContain('__custom__');
      expect(text).not.toContain('ACQ:');
    });

    it('shows the interpolated custom-colour name', async () => {
      const { card, dye } = await mountCustomCard('#aabbcc');

      expect(dye.name).toBe('Custom (#AABBCC)');
      expect(card.shadowRoot?.textContent ?? '').toContain('Custom (#AABBCC)');
      // The raw key must not leak when the placeholder is filled
      expect(card.shadowRoot?.textContent ?? '').not.toContain('common.customColorName');
    });

    it('still routes a real dye through getAcquisition()', async () => {
      await import('../../v4/result-card');

      const card = document.createElement('v4-result-card') as HTMLElement & {
        data?: unknown;
        showAcquisition?: boolean;
        showActions?: boolean;
        updateComplete?: Promise<unknown>;
      };
      card.data = {
        dye: {
          // BUG-016: `id` is the itemID, not the stainID — see Dye.id in
          // @xivdyetools/types and __tests__/mocks/services.test.ts.
          id: 5729,
          itemID: 5729,
          stainID: 1,
          name: 'Snow White',
          hex: '#E4E4E4',
          rgb: { r: 228, g: 228, b: 228 },
          hsv: { h: 0, s: 0, v: 89 },
          category: 'White',
          acquisition: 'Vendor',
          cost: 216,
          currency: 'Gil',
          isMetallic: false,
          isPastel: false,
          isDark: false,
          isCosmic: false,
          isIshgardian: false,
          consolidationType: null,
        },
        originalColor: '#E4E4E4',
        matchedColor: '#E4E4E4',
      };
      card.showAcquisition = true;
      card.showActions = false;
      container.appendChild(card);
      await card.updateComplete;

      const text = card.shadowRoot?.textContent ?? '';
      expect(text).toContain('ACQ:Vendor');
      expect(text).not.toContain('common.custom');
    });
  });

  // ==========================================================================
  // Tool hand-offs (BUG-012)
  // ==========================================================================

  describe('inspect hand-offs', () => {
    /**
     * The receiver resolves the dye param through
     * `ShareService.resolveSharedDye`, whose loud-failure contract rejects
     * every id at or above this floor as a pre-5.0 link. All 125 dyes have an
     * itemID in 5729-48227, so emitting `dye.itemID` here failed for every one
     * of them. Asserting the emitted value is the stainID *and* below the floor
     * encodes the receiver's guard without importing it.
     *
     * 2026-09-03: the key is `dye`, not `dyeId`. Both resolve — harmony-tool
     * reads `params.get('dye') ?? params.get('dyeId')` — but `dyeId` is the
     * spelling it labels "legacy deep links", and this hand-off now goes
     * through the shared `handoffTo`, which emits the canonical grammar.
     */
    const LEGACY_ITEM_ID_FLOOR = 5729;

    it('sends Harmony the stainID, which is the grammar the receiver accepts', async () => {
      const { RouterService } = await import('@services/index');
      vi.mocked(RouterService.navigateTo).mockClear();
      await import('../../v4/result-card');

      const card = document.createElement('v4-result-card') as HTMLElement & { data?: unknown };
      card.data = {
        dye: {
          id: 5729,
          itemID: 5729,
          stainID: 1,
          name: 'Snow White',
          hex: '#E4E4E4',
          rgb: { r: 228, g: 228, b: 228 },
          hsv: { h: 0, s: 0, v: 89 },
          category: 'White',
          acquisition: 'Vendor',
          cost: 216,
          currency: 'Gil',
          isMetallic: false,
          isPastel: false,
          isDark: false,
          isCosmic: false,
          isIshgardian: false,
          consolidationType: null,
        },
        originalColor: '#E4E4E4',
        matchedColor: '#E4E4E4',
      };
      container.appendChild(card);

      (card as unknown as { handleMenuAction: (a: string) => void }).handleMenuAction(
        'inspect-harmony'
      );

      expect(RouterService.navigateTo).toHaveBeenCalledWith('harmony', { dye: '1' });

      const emitted = vi.mocked(RouterService.navigateTo).mock.calls[0]?.[1] as { dye: string };
      expect(Number(emitted.dye)).toBeLessThan(LEGACY_ITEM_ID_FLOOR);
    });

    /**
     * BUG-013 (2026-10-04 deep-dive): "Set as budget target" navigated with no
     * params, so the `dye=` RouterService preserves across every navigation
     * (from a share link or an earlier hand-off) reached Budget instead, and
     * Budget's deep-link handler replaced the dye just sent. Named explicitly,
     * the hand-off's `dye` replaces the preserved one.
     */
    const menuAction = (card: HTMLElement, action: string): void =>
      (card as unknown as { handleMenuAction: (a: string) => void }).handleMenuAction(action);

    const mountCard = (dye: Record<string, unknown>): HTMLElement => {
      const card = document.createElement('v4-result-card') as HTMLElement & { data?: unknown };
      card.data = { dye, originalColor: dye.hex, matchedColor: dye.hex };
      container.appendChild(card);
      return card;
    };

    const DALAMUD_RED = {
      id: 30116,
      itemID: 30116,
      stainID: 45,
      name: 'Dalamud Red',
      hex: '#781A1A',
      rgb: { r: 120, g: 26, b: 26 },
      hsv: { h: 0, s: 78, v: 47 },
      category: 'Red',
      acquisition: 'Vendor',
      cost: 216,
      currency: 'Gil',
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: false,
      isIshgardian: false,
      consolidationType: 'A',
    };

    /** The card imports ToastService from its own module, not the barrel. */
    const spyOnToast = async () => {
      const { ToastService } = await import('@services/toast-service');
      return vi.spyOn(ToastService, 'success').mockImplementation(() => '');
    };

    it('sends Budget the dye as an explicit stainID, so a preserved ?dye= cannot win (BUG-013)', async () => {
      const { RouterService, StorageService } = await import('@services/index');
      const toast = await spyOnToast();
      await import('../../v4/result-card');

      menuAction(mountCard(DALAMUD_RED), 'inspect-budget');

      expect(RouterService.navigateTo).toHaveBeenCalledTimes(1);
      expect(RouterService.navigateTo).toHaveBeenCalledWith('budget', { dye: '45' });
      // Budget's constructor reads the stored target before its deep link is
      // handled, so the first paint already shows the dye just sent.
      expect(StorageService.setItem).toHaveBeenCalledWith('v3_budget_target', 30116);
      expect(toast).toHaveBeenCalledWith('resultCard.sentToBudget');
    });

    it('does not send a custom colour to Budget, as no hand-off does', async () => {
      const { RouterService, StorageService } = await import('@services/index');
      const toast = await spyOnToast();
      await import('../../v4/result-card');

      menuAction(
        mountCard({ ...DALAMUD_RED, id: -1, itemID: -1, stainID: null }),
        'inspect-budget'
      );

      expect(RouterService.navigateTo).not.toHaveBeenCalled();
      expect(StorageService.setItem).not.toHaveBeenCalled();
      expect(toast).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // "Send to tool" menu names (TERM-002)
  //
  // Each entry used to render a private `resultCard.tools.<id>` key that
  // drifted from the tool's real name in 5 of 9 tools. The menu must now
  // print exactly the string the tool's own route renders as its title —
  // `toolLabel()` reads `RouterService.getRouteForTool(id).titleKey` through
  // `LanguageService.t`, and `t` is stubbed to echo its key, so the rendered
  // text below IS the key that was looked up.
  // ==========================================================================

  describe('"send to tool" menu names', () => {
    it('renders each entry with its OWN tool route title key, not a private copy', async () => {
      await import('../../v4/result-card');
      const card = document.createElement('v4-result-card') as HTMLElement & {
        data?: unknown;
        showActions?: boolean;
        updateComplete?: Promise<unknown>;
      };
      card.data = {
        dye: {
          id: 5729,
          itemID: 5729,
          stainID: 1,
          name: 'Snow White',
          hex: '#E4E4E4',
          rgb: { r: 228, g: 228, b: 228 },
          hsv: { h: 0, s: 0, v: 89 },
          category: 'White',
          acquisition: 'Vendor',
          cost: 216,
          currency: 'Gil',
          isMetallic: false,
          isPastel: false,
          isDark: false,
          isCosmic: false,
          isIshgardian: false,
          consolidationType: null,
        },
        originalColor: '#E4E4E4',
        matchedColor: '#E4E4E4',
      };
      card.showActions = true;
      container.appendChild(card);
      await card.updateComplete;

      // DOM order: "Inspect Dye in..." (harmony, budget, accessibility,
      // comparison, swatch) then "Transform Dye in..." (gradient, mixer).
      // `swatch` is deliberately `tools.character.title`, not
      // `tools.swatch.title` — that key does not exist — mirroring
      // `extractor` → `tools.matcher.title` at the route table.
      const EXPECTED_KEYS = [
        'tools.harmony.title',
        'tools.budget.title',
        'tools.accessibility.title',
        'tools.comparison.title',
        'tools.character.title', // swatch
        'tools.gradient.title',
        'tools.mixer.title',
      ];

      // Scoped to the first two submenus (Inspect / Transform) — the third,
      // "Open in browser...", intentionally hardcodes brand names, not a
      // locale key, and would otherwise pollute this comparison.
      const submenus = card.shadowRoot!.querySelectorAll('.submenu');
      const labels = [
        ...submenus[0].querySelectorAll('.menu-item'),
        ...submenus[1].querySelectorAll('.menu-item'),
      ].map((el) => el.textContent!.trim());

      expect(labels).toEqual(EXPECTED_KEYS);
    });
  });

  // ==========================================================================
  // Context menu for a custom colour (2026-10-09 merge-day review)
  //
  // `handoffTo` drops a dye with no stainID, and the stored-id receivers
  // (Accessibility, Comparison, Swatch, Mixer) cannot resolve a custom
  // colour's per-session negative id, nor can an external site open one. Their
  // items rendered anyway and did nothing, or navigated to an empty tool. Only
  // Gradient (which stores the hex) can carry a custom colour.
  // ==========================================================================

  describe('context menu for a custom colour', () => {
    const SNOW_WHITE = {
      id: 5729,
      itemID: 5729,
      stainID: 1,
      name: 'Snow White',
      hex: '#E4E4E4',
      rgb: { r: 228, g: 228, b: 228 },
      hsv: { h: 0, s: 0, v: 89 },
      category: 'White',
      acquisition: 'Vendor',
      cost: 216,
      currency: 'Gil',
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: false,
      isIshgardian: false,
      consolidationType: null,
    };

    const menuLabels = async (dye: unknown): Promise<{ submenus: number; items: string[] }> => {
      await import('../../v4/result-card');
      const card = document.createElement('v4-result-card') as HTMLElement & {
        data?: unknown;
        showActions?: boolean;
        updateComplete?: Promise<unknown>;
      };
      card.data = { dye, originalColor: '#E4E4E4', matchedColor: '#E4E4E4' };
      card.showActions = true;
      container.appendChild(card);
      await card.updateComplete;
      const root = card.shadowRoot!;
      return {
        submenus: root.querySelectorAll('.context-menu .has-submenu').length,
        items: [...root.querySelectorAll('.context-menu .submenu .menu-item')].map((el) =>
          el.textContent!.trim()
        ),
      };
    };

    it('offers only the items that can carry a custom colour', async () => {
      const { makeCustomDye } = await import('@shared/custom-dye');
      const { submenus, items } = await menuLabels(makeCustomDye('#aabbcc'));

      // Gradient stores the hex; every other item is dead for a custom colour.
      expect(items).toEqual(['tools.gradient.title']);
      // The Inspect and Open-in-browser submenus would be empty: not rendered.
      expect(submenus).toBe(1);
    });

    it('still shows every item for a dye with a stainID', async () => {
      const { submenus, items } = await menuLabels(SNOW_WHITE);

      expect(submenus).toBe(3);
      expect(items).toEqual([
        'tools.harmony.title',
        'tools.budget.title',
        'tools.accessibility.title',
        'tools.comparison.title',
        'tools.character.title',
        'tools.gradient.title',
        'tools.mixer.title',
        'Universalis',
        'GarlandTools',
        'TeamCraft',
        'Saddlebag Exchange',
      ]);
    });
  });

  // ============================================================================
  // Display options, formatters and card interaction
  // ============================================================================

  /**
   * A dye rich enough to drive every readout. `rgb`/`hsv`/`stainID` are read
   * straight off the dye by `render()`, so they are real values here rather
   * than stubs on ColorService.
   */
  const DYE = {
    // `Dye.id` is the FFXIV item ID, not a sequential index — packages/types
    // documents it as "an FFXIV item ID such as 5729 or 13115". It must equal
    // `itemID`, and the earlier `id: 5` broke that invariant silently.
    id: LOCALIZED_ITEM_ID,
    stainID: 42,
    itemID: LOCALIZED_ITEM_ID,
    name: 'Dalamud Red',
    hex: '#8b1a1a',
    category: 'red',
    acquisition: 'vendor',
    currency: 'Gil',
    consolidationType: 'A',
    rgb: { r: 139, g: 26, b: 26 },
    hsv: { h: 0.4, s: 81.3, v: 54.5 },
  };

  /**
   * Every display option OFF. All eleven default to `true` except `showCmyk`,
   * so a test that wants to prove one row in isolation has to start from here
   * — otherwise the assertion passes on rows it never asked for.
   */
  const ALL_OFF = {
    showHex: false,
    showRgb: false,
    showHsv: false,
    showLab: false,
    showCmyk: false,
    showDeltaE: false,
    showHue: false,
    showStain: false,
    showPrice: false,
    showAcquisition: false,
    showConsolidation: false,
    showActions: false,
  };

  type CardEl = HTMLElement & {
    data?: unknown;
    updateComplete: Promise<unknown>;
    [key: string]: unknown;
  };

  async function mountCard(props: Record<string, unknown> = {}): Promise<CardEl> {
    await import('../../v4/result-card');
    const card = document.createElement('v4-result-card') as unknown as CardEl;
    card.data = { dye: DYE, originalColor: '#ff0000', matchedColor: '#8b1a1a' };
    Object.assign(card, ALL_OFF, props);
    container.appendChild(card);
    await card.updateComplete;
    return card;
  }

  const sr = (card: CardEl): ShadowRoot => card.shadowRoot!;

  /** Label -> value for every cell of the numeric matrix. */
  function matrix(card: CardEl): Record<string, string> {
    const out: Record<string, string> = {};
    for (const cell of sr(card).querySelectorAll('.matrix .cell')) {
      out[cell.querySelector('.cell-label')!.textContent!.trim()] = cell
        .querySelector('.cell-val')!
        .textContent!.trim();
    }
    return out;
  }

  /** [label, value] for every row of the text zone. */
  function zone(card: CardEl): string[][] {
    return [...sr(card).querySelectorAll('.zone .zrow')].map((row) => [
      row.querySelector('.zlabel')!.textContent!.trim(),
      row.querySelector('.zval')!.textContent!.trim(),
    ]);
  }

  /** Only the rendered article's text — the adopted <style> text is not it. */
  const bodyText = (card: CardEl): string => sr(card).querySelector('article')?.textContent ?? '';

  describe('display options and formatters', () => {
    beforeEach(async () => {
      // `vi.clearAllMocks()` drops recorded calls but keeps implementations, so
      // a `mockReturnValue` set inside one test below would otherwise leak into
      // the next. Restore the module defaults each time.
      const core = await import('@xivdyetools/core');
      const { ThemeService } = await import('@services/index');
      vi.mocked(core.classifyBandTier).mockReturnValue(0 as unknown as never);
      vi.mocked(core.ColorService.getDistanceForMethod).mockReturnValue(0);
      vi.mocked(ThemeService.isDarkMode).mockReturnValue(false);
    });

    describe('no data', () => {
      it('renders a placeholder instead of an empty ticket', async () => {
        await import('../../v4/result-card');
        const card = document.createElement('v4-result-card') as unknown as CardEl;
        container.appendChild(card);
        await card.updateComplete;

        expect(sr(card).textContent).toContain('resultCard.noData');
        expect(sr(card).querySelector('.matrix')).toBeNull();
        expect(sr(card).querySelector('article')).toBeNull();
      });
    });

    describe('the localized dye name', () => {
      it('looks the name up by itemID, and prints it over the English one', async () => {
        const card = await mountCard();

        // Switching result-card to `getDyeName(dye.stainID)` reds this: 42 is
        // not in the stub database, so the card would fall back to 'Dalamud Red'.
        expect(bodyText(card)).toContain(LOCALIZED_DYE_NAME);
        expect(bodyText(card)).not.toContain('Dalamud Red');
      });

      it('falls back to the English name when the locale has no entry', async () => {
        const card = await mountCard({
          data: {
            dye: { ...DYE, id: 999999, itemID: 999999 },
            originalColor: '#ff0000',
            matchedColor: '#8b1a1a',
          },
        });

        expect(bodyText(card)).toContain('Dalamud Red');
      });
    });

    describe('numeric matrix', () => {
      it('is absent entirely when every numeric option is off', async () => {
        const card = await mountCard();

        expect(sr(card).querySelector('.matrix')).toBeNull();
      });

      it('shows the matched hex, upper-cased', async () => {
        const card = await mountCard({ showHex: true });

        expect(matrix(card)).toEqual({ HEX: '#8B1A1A' });
      });

      it('reads RGB off the dye, not off the matched colour string', async () => {
        const card = await mountCard({ showRgb: true });

        expect(matrix(card)).toEqual({ RGB: '139, 26, 26' });
      });

      it('rounds HSV to whole degrees and percents', async () => {
        const card = await mountCard({ showHsv: true });

        expect(matrix(card)).toEqual({ HSV: '0°, 81%, 55%' });
      });

      it('rounds LAB to integers', async () => {
        const card = await mountCard({ showLab: true });

        // ColorService.hexToLab is stubbed to { L: 50, a: 0, b: 0 }
        expect(matrix(card)).toEqual({ LAB: '50, 0, 0' });
      });

      it('rounds CMYK to integer percentages', async () => {
        const card = await mountCard({ showCmyk: true });

        expect(matrix(card)).toEqual({ CMYK: '0, 100, 100, 0' });
      });

      it('keeps the cells in their declared order when several are on', async () => {
        const card = await mountCard({
          showHex: true,
          showRgb: true,
          showHsv: true,
          showLab: true,
          showCmyk: true,
        });

        expect(Object.keys(matrix(card))).toEqual(['HEX', 'RGB', 'HSV', 'LAB', 'CMYK']);
      });

      it('shows HEX, RGB, HSV and LAB — but not CMYK — with no options set', async () => {
        await import('../../v4/result-card');
        const card = document.createElement('v4-result-card') as unknown as CardEl;
        card.data = { dye: DYE, originalColor: '#ff0000', matchedColor: '#8b1a1a' };
        container.appendChild(card);
        await card.updateComplete;

        expect(Object.keys(matrix(card))).toEqual(['HEX', 'RGB', 'HSV', 'LAB']);
      });
    });

    describe('text zone', () => {
      it('is absent when spectrum, source and market are all off', async () => {
        const card = await mountCard();

        expect(sr(card).querySelector('.zone')).toBeNull();
        expect(sr(card).querySelector('.zone-rule')).toBeNull();
      });

      it('names the consolidated spectrum', async () => {
        const card = await mountCard({ showConsolidation: true });

        expect(zone(card)).toEqual([['resultCard.spectrumShort', 'General-purpose Dye']]);
      });

      it('dashes the spectrum for a dye that is not consolidated', async () => {
        const card = await mountCard({
          showConsolidation: true,
          data: {
            dye: { ...DYE, consolidationType: undefined },
            originalColor: '#ff0000',
            matchedColor: '#8b1a1a',
          },
        });

        expect(zone(card)[0][1]).toBe('—');
      });

      it('routes the acquisition through the locale and prints the vendor cost', async () => {
        const card = await mountCard({
          showAcquisition: true,
          data: {
            dye: DYE,
            originalColor: '#ff0000',
            matchedColor: '#8b1a1a',
            vendorCost: 216,
          },
        });

        expect(zone(card)).toEqual([
          ['resultCard.acquisitionShort', 'ACQ:vendor'],
          ['common.cost', '216 CUR:Gil'],
        ]);
      });

      it('dashes the cost when no vendor cost was supplied', async () => {
        const card = await mountCard({ showAcquisition: true });

        expect(zone(card)[1]).toEqual(['common.cost', '—']);
      });

      it('dashes the cost when the dye trades in no currency', async () => {
        const card = await mountCard({
          showAcquisition: true,
          data: {
            dye: { ...DYE, currency: null },
            originalColor: '#ff0000',
            matchedColor: '#8b1a1a',
            vendorCost: 216,
          },
        });

        expect(zone(card)[1]).toEqual(['common.cost', '—']);
      });

      it('dashes the source for a dye with no acquisition', async () => {
        const card = await mountCard({
          showAcquisition: true,
          data: {
            dye: { ...DYE, acquisition: undefined },
            originalColor: '#ff0000',
            matchedColor: '#8b1a1a',
          },
        });

        expect(zone(card)[0][1]).toBe('—');
      });

      it('names the server alongside the market label', async () => {
        const card = await mountCard({
          showPrice: true,
          data: {
            dye: DYE,
            originalColor: '#ff0000',
            matchedColor: '#8b1a1a',
            marketServer: 'Behemoth',
            price: 1200,
          },
        });

        expect(zone(card)[0][0]).toBe('common.market · Behemoth');
      });

      it('falls back to the bare market label with no server', async () => {
        const card = await mountCard({
          showPrice: true,
          data: { dye: DYE, originalColor: '#ff0000', matchedColor: '#8b1a1a', price: 1200 },
        });

        expect(zone(card)[0][0]).toBe('common.market');
      });

      it('dashes the price when none was fetched', async () => {
        const card = await mountCard({ showPrice: true });

        expect(zone(card)[0][1]).toBe('—');
        expect(sr(card).querySelector('.market-error')).toBeNull();
      });

      it('shows the error code in place of the price, and flags it', async () => {
        const card = await mountCard({
          showPrice: true,
          data: {
            dye: DYE,
            originalColor: '#ff0000',
            matchedColor: '#8b1a1a',
            price: 1200,
            marketError: 'H429',
          },
        });

        // The error wins over a price still sitting in the payload.
        expect(zone(card)[0][1]).toBe('H429');
        expect(sr(card).querySelector('.market-error')).not.toBeNull();
      });
    });

    describe('verdict', () => {
      it('prints ΔE2000 to two decimals', async () => {
        const card = await mountCard({
          showDeltaE: true,
          data: { dye: DYE, originalColor: '#ff0000', matchedColor: '#8b1a1a', deltaE: 3.14159 },
        });

        expect(sr(card).querySelector('.de-num')!.textContent!.trim()).toBe('3.14');
      });

      it('re-derives ΔE2000 when the tool measured with another algorithm', async () => {
        const { ColorService } = await import('@xivdyetools/core');
        vi.mocked(ColorService.getDistanceForMethod).mockReturnValue(9.5);

        const card = await mountCard({
          showDeltaE: true,
          data: {
            dye: DYE,
            originalColor: '#ff0000',
            matchedColor: '#8b1a1a',
            deltaE: 3.14159,
            matchingMethod: 'oklab',
          },
        });

        // The card's verdict is always ΔE2000, never the tool's own metric.
        expect(sr(card).querySelector('.de-num')!.textContent!.trim()).toBe('9.50');
        expect(ColorService.getDistanceForMethod).toHaveBeenCalledWith(
          '#ff0000',
          '#8b1a1a',
          'ciede2000'
        );
      });

      it.each([
        { mode: 'light', dark: false, color: 'rgb(19, 122, 51)' },
        { mode: 'dark', dark: true, color: 'rgb(91, 189, 104)' },
      ])('tints the verdict from the $mode ramp', async ({ dark, color }) => {
        const { ThemeService } = await import('@services/index');
        vi.mocked(ThemeService.isDarkMode).mockReturnValue(dark);

        const card = await mountCard({
          showDeltaE: true,
          data: { dye: DYE, originalColor: '#ff0000', matchedColor: '#8b1a1a', deltaE: 1 },
        });

        expect(sr(card).querySelector<HTMLElement>('.de-num')!.style.color).toBe(color);
      });

      it('clamps a tier past the end of the ramp to its last entry', async () => {
        const core = await import('@xivdyetools/core');
        vi.mocked(core.classifyBandTier).mockReturnValue(99 as unknown as never);

        const card = await mountCard({
          showDeltaE: true,
          data: { dye: DYE, originalColor: '#ff0000', matchedColor: '#8b1a1a', deltaE: 40 },
        });

        // The light ramp's last entry, not `undefined`.
        expect(sr(card).querySelector<HTMLElement>('.de-num')!.style.color).toBe(
          'rgb(185, 28, 28)'
        );
      });

      it('hides the ΔE readout when the display option is off', async () => {
        // `showDeltaE` used to be declared and never read: the verdict gated on
        // `deltaE2000 !== undefined` alone. config-sidebar binds this property
        // in nine places as the user's "Show ΔE" switch, and accessibility,
        // budget and comparison each set it false expecting the row to go —
        // all of which silently did nothing. Deleting `this.showDeltaE &&`
        // from result-card's render reds this test and nothing else.
        const card = await mountCard({
          showDeltaE: false,
          data: { dye: DYE, originalColor: '#ff0000', matchedColor: '#8b1a1a', deltaE: 3.14 },
        });

        expect(sr(card).querySelector('.de-num')).toBeNull();
        expect(bodyText(card)).not.toContain('ΔE2000');
      });

      it('drops the whole verdict strip when ΔE and stainID are both off', async () => {
        const card = await mountCard({
          showDeltaE: false,
          showStain: false,
          data: { dye: DYE, originalColor: '#ff0000', matchedColor: '#8b1a1a', deltaE: 3.14 },
        });

        expect(sr(card).querySelector('.verdict')).toBeNull();
      });

      it('keeps the verdict strip for the stainID alone', async () => {
        const card = await mountCard({
          showDeltaE: false,
          showStain: true,
          data: { dye: DYE, originalColor: '#ff0000', matchedColor: '#8b1a1a', deltaE: 3.14 },
        });

        expect(sr(card).querySelector('.verdict')).not.toBeNull();
        expect(sr(card).querySelector('.de-num')).toBeNull();
        expect(bodyText(card)).toContain('42');
      });

      it('shows the hue deviance to one decimal, in degrees', async () => {
        const card = await mountCard({
          showDeltaE: true,
          showHue: true,
          data: {
            dye: DYE,
            originalColor: '#ff0000',
            matchedColor: '#8b1a1a',
            deltaE: 1,
            hueDeviance: 12.34,
          },
        });

        expect(bodyText(card)).toContain('12.3°');
        expect(bodyText(card)).toContain('resultCard.hueOff');
      });

      it('shows the stainID when asked', async () => {
        const card = await mountCard({ showStain: true });

        expect(bodyText(card)).toContain('42');
        expect(bodyText(card)).toContain('resultCard.stainShort');
      });

      it('hides the stainID when the option is off', async () => {
        const card = await mountCard({ showStain: false });

        expect(bodyText(card)).not.toContain('resultCard.stainShort');
      });
    });

    describe('swatches', () => {
      it('shows both swatches when the match is not exact', async () => {
        const card = await mountCard();

        expect(sr(card).querySelectorAll('.swatch')).toHaveLength(2);
      });

      it('shows one swatch when the input already is the dye colour', async () => {
        const card = await mountCard({
          data: { dye: DYE, originalColor: '#8B1A1A', matchedColor: '#8b1a1a' },
        });

        // Case-insensitive: the same colour written differently is still one swatch.
        expect(sr(card).querySelectorAll('.swatch')).toHaveLength(1);
      });
    });

    describe('alternates', () => {
      const ALT = { ...DYE, id: 6, stainID: 43, name: 'Wine Red', hex: '#5c1010' };

      it('renders nothing when the slot has no runners-up', async () => {
        const card = await mountCard();

        expect(sr(card).querySelector('.card-alternates')).toBeNull();
      });

      it('renders one dot per alternate', async () => {
        const card = await mountCard({
          data: {
            dye: DYE,
            originalColor: '#ff0000',
            matchedColor: '#8b1a1a',
            alternates: [ALT, { ...ALT, id: 7, name: 'Rust Red' }],
          },
        });

        expect(sr(card).querySelectorAll('.alt-dot')).toHaveLength(2);
        expect(bodyText(card)).toContain('common.alternates');
      });

      it('emits alternate-select with the tapped dye', async () => {
        const card = await mountCard({
          data: {
            dye: DYE,
            originalColor: '#ff0000',
            matchedColor: '#8b1a1a',
            alternates: [ALT],
          },
        });
        const seen: { dye: { name: string } }[] = [];
        card.addEventListener('alternate-select', (e) =>
          seen.push((e as CustomEvent<{ dye: { name: string } }>).detail)
        );

        sr(card).querySelector<HTMLButtonElement>('.alt-dot')!.click();

        expect(seen).toHaveLength(1);
        expect(seen[0].dye.name).toBe('Wine Red');
      });
    });
  });

  // ==========================================================================
  // Menu click-away (BUG-111)
  //
  // Each card closes its menus from a document click listener. The menu and
  // primary buttons called stopPropagation, so their click never reached
  // document: opening card B's menu left card A's open beside it. Removing the
  // stop alone is not enough either — the card's own listener would then see
  // the click that opened its menu and close it again, so the first two tests
  // below guard the toggles themselves.
  // ==========================================================================

  describe('menu click-away (BUG-111)', () => {
    const contextMenuOpen = (card: CardEl): boolean =>
      sr(card).querySelector('.context-menu')!.classList.contains('open');
    const slotMenuOpen = (card: CardEl): boolean =>
      sr(card).querySelector('.slot-picker-menu')!.classList.contains('open');

    /** Click a button in `card`, then let every mounted card re-render. */
    async function clickIn(card: CardEl, selector: string, cards: CardEl[]): Promise<void> {
      sr(card).querySelector<HTMLButtonElement>(selector)!.click();
      await Promise.all(cards.map((c) => c.updateComplete));
    }

    it("opens the card's own menu, and a second click closes it", async () => {
      const card = await mountCard({ showActions: true });

      await clickIn(card, '.menu-btn', [card]);
      expect(contextMenuOpen(card)).toBe(true);
      expect(sr(card).querySelector('.menu-btn')!.getAttribute('aria-expanded')).toBe('true');

      await clickIn(card, '.menu-btn', [card]);
      expect(contextMenuOpen(card)).toBe(false);
    });

    it("opens the card's own slot picker from the primary button", async () => {
      const card = await mountCard({ showActions: true, showSlotPicker: true });

      await clickIn(card, '.primary-action-btn', [card]);

      expect(slotMenuOpen(card)).toBe(true);
    });

    it("closes card A's menu when card B's menu button is clicked", async () => {
      const a = await mountCard({ showActions: true });
      const b = await mountCard({ showActions: true });

      await clickIn(a, '.menu-btn', [a, b]);
      await clickIn(b, '.menu-btn', [a, b]);

      expect(contextMenuOpen(a)).toBe(false);
      expect(contextMenuOpen(b)).toBe(true);
    });

    it("closes card A's slot picker when card B's slot picker opens", async () => {
      const a = await mountCard({ showActions: true, showSlotPicker: true });
      const b = await mountCard({ showActions: true, showSlotPicker: true });

      await clickIn(a, '.primary-action-btn', [a, b]);
      await clickIn(b, '.primary-action-btn', [a, b]);

      expect(slotMenuOpen(a)).toBe(false);
      expect(slotMenuOpen(b)).toBe(true);
    });

    it("closes card A's menu when card B's primary button selects its dye", async () => {
      const a = await mountCard({ showActions: true });
      const b = await mountCard({ showActions: true });
      const selected: unknown[] = [];
      b.addEventListener('card-select', (e) => selected.push((e as CustomEvent).detail));

      await clickIn(a, '.menu-btn', [a, b]);
      await clickIn(b, '.primary-action-btn', [a, b]);

      expect(selected).toHaveLength(1);
      expect(contextMenuOpen(a)).toBe(false);
    });

    it('still closes an open menu on a click anywhere else', async () => {
      const card = await mountCard({ showActions: true });

      await clickIn(card, '.menu-btn', [card]);
      document.body.click();
      await card.updateComplete;

      expect(contextMenuOpen(card)).toBe(false);
    });

    /*
     * The skip is for this card's toggles and menus only, not the whole card:
     * a click on the card's own swatch is "outside the menu" and closes it.
     * Widening the guard to `path.includes(this)` would pass every test above
     * (they click a toggle, another card, or document.body) — this one pins it.
     */
    it("closes the card's own menu on a click elsewhere in the same card", async () => {
      const card = await mountCard({ showActions: true });

      await clickIn(card, '.menu-btn', [card]);
      expect(contextMenuOpen(card)).toBe(true);

      sr(card).querySelector<HTMLElement>('.swatch')!.click();
      await card.updateComplete;

      expect(contextMenuOpen(card)).toBe(false);
    });

    it("closes the card's own slot picker when its menu button opens the context menu", async () => {
      const card = await mountCard({ showActions: true, showSlotPicker: true });

      await clickIn(card, '.primary-action-btn', [card]);
      expect(slotMenuOpen(card)).toBe(true);

      await clickIn(card, '.menu-btn', [card]);

      expect(contextMenuOpen(card)).toBe(true);
      expect(slotMenuOpen(card)).toBe(false);
    });

    /*
     * Touch: tapping a submenu parent row focuses it (`:focus-within` shows
     * its submenu) and the click then reaches document. Closing the whole
     * menu there left the submenu clickable but invisible.
     */
    it('keeps the menu open when a submenu parent row inside it is tapped', async () => {
      const card = await mountCard({ showActions: true });

      await clickIn(card, '.menu-btn', [card]);
      await clickIn(card, '.context-menu .menu-item.has-submenu', [card]);

      expect(contextMenuOpen(card)).toBe(true);
    });

    it('keeps the slot picker open when a click lands on the picker itself', async () => {
      const card = await mountCard({ showActions: true, showSlotPicker: true });

      await clickIn(card, '.primary-action-btn', [card]);
      await clickIn(card, '.slot-picker-menu', [card]);

      expect(slotMenuOpen(card)).toBe(true);
    });

    it('still closes the menu once one of its actions is chosen', async () => {
      const card = await mountCard({ showActions: true });

      await clickIn(card, '.menu-btn', [card]);
      await clickIn(card, '.context-menu .submenu button.menu-item', [card]);

      expect(contextMenuOpen(card)).toBe(false);
    });

    it("still closes another card's menu when a click lands inside this card's menu", async () => {
      const a = await mountCard({ showActions: true });
      const b = await mountCard({ showActions: true });

      await clickIn(a, '.menu-btn', [a, b]);
      await clickIn(b, '.menu-btn', [a, b]);
      await clickIn(b, '.context-menu .menu-item.has-submenu', [a, b]);

      expect(contextMenuOpen(a)).toBe(false);
      expect(contextMenuOpen(b)).toBe(true);
    });
  });

  // ==========================================================================
  // Escape claims the key when it closes a menu
  //
  // The toast container dismisses a dismissible toast on an Escape nothing
  // else handled. The card closed its menus on that same Escape without
  // saying so, so one key press closed both the menu and the toast.
  // ==========================================================================

  describe('Escape', () => {
    const escape = (): KeyboardEvent => {
      const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.dispatchEvent(e);
      return e;
    };

    it('closes an open context menu and marks the key handled', async () => {
      const card = await mountCard({ showActions: true });
      sr(card).querySelector<HTMLButtonElement>('.menu-btn')!.click();
      await card.updateComplete;

      const e = escape();
      await card.updateComplete;

      expect(sr(card).querySelector('.context-menu')!.classList.contains('open')).toBe(false);
      expect(e.defaultPrevented).toBe(true);
    });

    it('closes an open slot picker and marks the key handled', async () => {
      const card = await mountCard({ showActions: true, showSlotPicker: true });
      sr(card).querySelector<HTMLButtonElement>('.primary-action-btn')!.click();
      await card.updateComplete;

      const e = escape();
      await card.updateComplete;

      expect(sr(card).querySelector('.slot-picker-menu')!.classList.contains('open')).toBe(false);
      expect(e.defaultPrevented).toBe(true);
    });

    it('leaves the key alone when no menu is open', async () => {
      await mountCard({ showActions: true, showSlotPicker: true });

      expect(escape().defaultPrevented).toBe(false);
    });
  });

  // ==========================================================================
  // Gradient hand-off of a Custom Color (BUG-092 sibling)
  //
  // The Gradient Builder stores a Custom Color endpoint by its hex, because
  // makeCustomDye mints a new synthetic id every session. The card writes the
  // same key ('v3_mixer_selected_dyes'), so it must store the same form —
  // otherwise "Transform → Gradient" leaves an id that resolves to nothing.
  // ==========================================================================

  describe('gradient hand-off of a custom colour (BUG-092)', () => {
    const GRADIENT_KEY = 'v3_mixer_selected_dyes';

    async function mountCustom(hex: string): Promise<CardEl> {
      const { makeCustomDye } = await import('@shared/custom-dye');
      const dye = makeCustomDye(hex);
      return mountCard({ data: { dye, originalColor: hex, matchedColor: hex } });
    }

    const toGradient = (card: CardEl): void =>
      (card as unknown as { handleMenuAction: (a: string) => void }).handleMenuAction(
        'transform-gradient'
      );

    async function storedGradient(list: Array<number | string> | null): Promise<void> {
      const { StorageService } = await import('@services/index');
      vi.mocked(StorageService.getItem).mockReturnValueOnce(list);
    }

    async function toasts() {
      const { ToastService } = await import('@services/toast-service');
      return {
        success: vi.spyOn(ToastService, 'success').mockImplementation(() => ''),
        info: vi.spyOn(ToastService, 'info').mockImplementation(() => ''),
      };
    }

    it('stores a custom colour by its hex, after the entries already there', async () => {
      const { StorageService, RouterService } = await import('@services/index');
      await toasts();
      const card = await mountCustom('#12ab34');
      await storedGradient([LOCALIZED_ITEM_ID]);

      toGradient(card);

      expect(StorageService.setItem).toHaveBeenCalledWith(GRADIENT_KEY, [
        LOCALIZED_ITEM_ID,
        '#12AB34',
      ]);
      expect(RouterService.navigateTo).toHaveBeenCalledWith('gradient');
    });

    it('still stores a real dye by its id beside a stored hex', async () => {
      const { StorageService } = await import('@services/index');
      await toasts();
      const card = await mountCard();
      await storedGradient(['#12AB34']);

      toGradient(card);

      expect(StorageService.setItem).toHaveBeenCalledWith(GRADIENT_KEY, [
        '#12AB34',
        LOCALIZED_ITEM_ID,
      ]);
    });

    it('recognises a custom colour already in the gradient by its hex', async () => {
      const { StorageService } = await import('@services/index');
      const toast = await toasts();
      const card = await mountCustom('#12AB34');
      await storedGradient(['#12AB34']);

      toGradient(card);

      expect(toast.info).toHaveBeenCalledWith('resultCard.dyeAlreadyIn');
      expect(StorageService.setItem).not.toHaveBeenCalled();
    });

    it('shows a stored hex in the slot-full modal and replaces a slot with the hex', async () => {
      const { StorageService } = await import('@services/index');
      const { ModalService } = await import('@services/modal-service');
      const { DyeService } = await import('@services/dye-service-wrapper');
      await toasts();
      let content: HTMLElement | null = null;
      vi.spyOn(ModalService, 'show').mockImplementation((config) => {
        content = config.content as HTMLElement;
        return 'modal-1' as ReturnType<typeof ModalService.show>;
      });
      vi.spyOn(ModalService, 'dismiss').mockImplementation(() => {});
      vi.spyOn(DyeService.getInstance(), 'getDyeById').mockImplementation(
        (id: number) => (id === LOCALIZED_ITEM_ID ? DYE : null) as never
      );

      const card = await mountCustom('#00FF00');
      await storedGradient(['#FF0000', LOCALIZED_ITEM_ID]);

      toGradient(card);

      expect(content).not.toBeNull();
      const slots = [...content!.querySelectorAll<HTMLButtonElement>('button')];
      expect(slots).toHaveLength(2);
      const [start, end] = slots;
      // The hex entry: its own colour and the custom-colour name, not 'Unknown'.
      expect(start.querySelectorAll('p')[1].textContent).toBe('Custom (#FF0000)');
      expect((start.firstElementChild as HTMLElement).style.background).toBe('rgb(255, 0, 0)');
      // The id entry still resolves through the dye database.
      expect(end.querySelectorAll('p')[1].textContent).toBe(LOCALIZED_DYE_NAME);

      end.click();

      expect(StorageService.setItem).toHaveBeenCalledWith(GRADIENT_KEY, ['#FF0000', '#00FF00']);
    });

    it('still shows a stored string that is not a colour as unknown', async () => {
      const { ModalService } = await import('@services/modal-service');
      await toasts();
      let content: HTMLElement | null = null;
      vi.spyOn(ModalService, 'show').mockImplementation((config) => {
        content = config.content as HTMLElement;
        return 'modal-1' as ReturnType<typeof ModalService.show>;
      });

      const card = await mountCustom('#00FF00');
      await storedGradient(['not-a-colour', '#FF0000']);

      toGradient(card);

      const start = content!.querySelector<HTMLButtonElement>('button')!;
      expect(start.querySelectorAll('p')[1].textContent).toBe('common.unknown');
      expect((start.firstElementChild as HTMLElement).style.background).toBe('rgb(136, 136, 136)');
    });
  });
});
