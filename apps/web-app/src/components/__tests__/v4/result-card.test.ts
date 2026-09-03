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

vi.mock('@services/index', () => ({
  LanguageService: languageServiceMock,
  StorageService: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  RouterService: { navigateTo: vi.fn() },
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
});
