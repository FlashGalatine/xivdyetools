/**
 * XIV Dye Tools - DyePaletteDrawer Unit Tests
 *
 * Regression coverage for HC-SYS-001 / TERM-002: the drawer used to group
 * dyes by an old (pre-schema-v2) category vocabulary (`White`/`Grey`/`Black`/…)
 * and translate headings through a local map keyed on those same stale
 * values. Runtime `Dye.category` values are the schema v2 set
 * (`Neutral`/`Reds`/`Browns`/`Yellows`/`Greens`/`Blues`/`Purples`/`Special`),
 * so `LanguageService.t('Blues')` never matched anything and fell through to
 * the raw key in every locale. The fix routes headings through
 * `LanguageService.getCategory()` (-> core `LocalizationService`), the same
 * path already used by `dye-grid.ts` and `dye-search-box.ts`.
 *
 * @module components/__tests__/v4/dye-palette-drawer.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Dye } from '@xivdyetools/types';

const { warnSpy, getCategorySpy, tSpy } = vi.hoisted(() => ({
  warnSpy: vi.fn(),
  getCategorySpy: vi.fn((category: string) => `L:${category}`),
  tSpy: vi.fn(),
}));

// Namespaces the drawer actually calls `t()` with (see the render methods in
// dye-palette-drawer.ts). A bare category name like 'Reds' or 'Blues' is
// never one of these -- if the drawer ever calls t() with a raw category
// again (the HC-SYS-001 bug) this mock warns exactly like the real
// LanguageService.t() fallback does for an unknown key.
const KNOWN_KEY_PREFIXES = ['colorPalette.', 'aria.', 'collections.'];

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => {
      tSpy(key);
      if (!KNOWN_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        warnSpy(`Translation not found: ${key}`);
      }
      return key;
    },
    tInterpolate: (key: string, params: Record<string, string>) =>
      `${key}:${JSON.stringify(params)}`,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
    getCategory: getCategorySpy,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: warnSpy,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_DICE: '<svg></svg>',
  ICON_BROOM: '<svg></svg>',
  ICON_CLOSE: '<svg></svg>',
}));

vi.mock('@services/collection-service', () => ({
  CollectionService: {
    getFavorites: vi.fn(() => []),
    subscribeFavorites: vi.fn(() => () => {}),
    toggleFavorite: vi.fn(() => true),
    getMaxFavorites: vi.fn(() => 20),
  },
}));

vi.mock('@services/toast-service', () => ({
  ToastService: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Two dyes carrying real schema v2 runtime category values -- the exact
// vocabulary the old local map never matched.
function makeDye(overrides: Partial<Dye>): Dye {
  return {
    id: 1,
    itemID: 5729,
    stainID: 1,
    name: 'Test Dye',
    hex: '#FF0000' as Dye['hex'],
    rgb: { r: 255, g: 0, b: 0 } as Dye['rgb'],
    hsv: { h: 0, s: 100, v: 100 } as Dye['hsv'],
    category: 'Reds',
    acquisition: 'Dye Vendor',
    cost: 216,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
    isIshgardian: false,
    consolidationType: null,
    ...overrides,
  } as Dye;
}

const redDye = makeDye({ id: 1, itemID: 5729, stainID: 1, name: 'Blood Red', category: 'Reds' });
const blueDye = makeDye({ id: 2, itemID: 5730, stainID: 2, name: 'Sky Blue', category: 'Blues' });

vi.mock('@services/dye-service-wrapper', () => ({
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: vi.fn(() => [redDye, blueDye]),
      getByStainId: vi.fn(() => null),
    }),
  },
}));

describe('DyePaletteDrawer category headings (HC-SYS-001 / TERM-002)', () => {
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

  it('renders category headings via LanguageService.getCategory(), not a raw t() lookup', async () => {
    await import('../../v4/dye-palette-drawer');
    const el = document.createElement('dye-palette-drawer') as HTMLElement & {
      isOpen: boolean;
      updateComplete: Promise<boolean>;
    };
    el.isOpen = true;
    container.appendChild(el);
    await el.updateComplete;

    const labels = Array.from(el.shadowRoot!.querySelectorAll('.category-label')).map((node) =>
      node.textContent?.trim()
    );

    expect(labels).toContain(getCategorySpy('Reds'));
    expect(labels).toContain(getCategorySpy('Blues'));
    expect(getCategorySpy).toHaveBeenCalledWith('Reds');
    expect(getCategorySpy).toHaveBeenCalledWith('Blues');

    // The regression: t() must never be called with a bare runtime category
    // name -- that's what produced "Translation not found: Blues" in every
    // locale before the fix.
    expect(tSpy).not.toHaveBeenCalledWith('Reds');
    expect(tSpy).not.toHaveBeenCalledWith('Blues');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Translation not found'));
  });
});
