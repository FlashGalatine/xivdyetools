/**
 * XIV Dye Tools - ResultCard Unit Tests
 *
 * Tests the V4 result card Lit component for displaying dye matches.
 * Covers rendering, data display, events, and context menu.
 *
 * @module components/__tests__/v4/result-card.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
  /** No database entry for a synthetic negative id — the card falls back to `dye.name`. */
  getDyeName: () => undefined,
  getAcquisition: (acquisition: string) => `ACQ:${acquisition}`,
  getCategory: (category: string) => `CAT:${category}`,
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
  classifyBandTier: vi.fn(() => 'A'),
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
});
