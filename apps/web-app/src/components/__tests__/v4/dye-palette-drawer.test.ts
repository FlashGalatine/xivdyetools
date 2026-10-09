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

  it('marks the random-dye emit so the layout can skip telemetry for it', async () => {
    await import('../../v4/dye-palette-drawer');
    const drawer = document.createElement('dye-palette-drawer') as unknown as HTMLElement & {
      isOpen: boolean;
      updateComplete: Promise<boolean>;
      allDyes: Dye[];
    };
    drawer.isOpen = true;
    container.appendChild(drawer);
    await drawer.updateComplete;

    const detail: Array<{ dye: Dye; random?: boolean }> = [];
    drawer.addEventListener('dye-selected', ((e: CustomEvent) => {
      detail.push(e.detail);
    }) as EventListener);
    (drawer as unknown as { handleDyeClick(d: Dye): void }).handleDyeClick(drawer.allDyes[0]);
    (drawer as unknown as { handleRandomDye(): void }).handleRandomDye();

    expect(detail[0].random).toBeUndefined();
    expect(detail[1].random).toBe(true);
  });
});

// BUG-028 (2026-10-04 deep-dive): each swatch was a click-only <div>, so Tab
// skipped every dye and landed only on the invisible star buttons, and both
// section headers were click-only <div>s too. The palette drawer is the app's
// only dye picker in the v4 shell, so a keyboard user could not pick a dye.
describe('DyePaletteDrawer keyboard access (BUG-028)', () => {
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

  type Drawer = HTMLElement & { isOpen: boolean; updateComplete: Promise<boolean> };

  const mountDrawer = async (): Promise<Drawer> => {
    await import('../../v4/dye-palette-drawer');
    const drawer = document.createElement('dye-palette-drawer') as Drawer;
    drawer.isOpen = true;
    container.appendChild(drawer);
    await drawer.updateComplete;
    return drawer;
  };

  const picks = (drawer: Drawer): Dye[] => {
    const picked: Dye[] = [];
    drawer.addEventListener('dye-selected', ((e: CustomEvent<{ dye: Dye }>) => {
      picked.push(e.detail.dye);
    }) as EventListener);
    return picked;
  };

  /** A swatch's own pick control: any button in it that is not the star. */
  const pickButton = (swatch: Element) =>
    swatch.querySelector<HTMLButtonElement>('button:not(.swatch-favorite-btn)');

  it('picks each dye from a native button named for it', async () => {
    const drawer = await mountDrawer();
    const picked = picks(drawer);
    const swatches = [...drawer.shadowRoot!.querySelectorAll('.swatch-grid .swatch')];
    expect(swatches).toHaveLength(2);

    for (const swatch of swatches) {
      const pick = pickButton(swatch);
      // A native <button> is in the tab order and fires click on Enter and Space
      expect(pick?.type).toBe('button');
      expect(pick!.getAttribute('aria-label')).toBe(swatch.getAttribute('title'));
      pick!.click();
    }

    expect(picked.map((dye) => dye.id).sort()).toEqual([redDye.id, blueDye.id]);
  });

  it('keeps the star a sibling of the pick button, and starring picks nothing', async () => {
    const drawer = await mountDrawer();
    const picked = picks(drawer);
    const swatch = drawer.shadowRoot!.querySelector('.swatch-grid .swatch')!;
    const star = swatch.querySelector<HTMLButtonElement>('.swatch-favorite-btn')!;

    // A button inside a button is invalid HTML: the parser splits them apart
    expect(pickButton(swatch)?.contains(star)).toBe(false);
    star.click();

    expect(picked).toEqual([]);
  });

  it('makes both section headers disclosure buttons', async () => {
    const drawer = await mountDrawer();
    // Custom colour (shown for the default tool, harmony) and Favorites
    const headers = [...drawer.shadowRoot!.querySelectorAll<HTMLElement>('.section-header')];
    expect(headers).toHaveLength(2);

    for (const header of headers) {
      expect((header as HTMLButtonElement).type).toBe('button');
      expect(header.getAttribute('aria-expanded')).toBe('true');
      header.click();
      await drawer.updateComplete;
      expect(header.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('shows the star to keyboard focus and on devices with no hover', async () => {
    const { DyePaletteDrawer } = await import('../../v4/dye-palette-drawer');
    const css = [DyePaletteDrawer.styles]
      .flat(Infinity as 1)
      .map((sheet) => (sheet as { cssText: string }).cssText)
      .join('\n')
      .replace(/\s+/g, ' ');
    const shown = 'opacity: 1; transform: scale(1);';

    // Focus on the swatch's pick button shows its star, and so does the
    // star's own focus (it was opacity 0 then: a focus ring on nothing)
    const starOnFocus = [...css.matchAll(/([^{}]*:focus-(?:visible|within)[^{}]*)\{([^}]*)\}/g)]
      .filter(([, selector]) => selector.includes('.swatch-favorite-btn'))
      .map(([, , body]) => body);
    expect(starOnFocus.length).toBeGreaterThan(0);
    expect(starOnFocus.every((body) => body.includes(shown))).toBe(true);
    // Touch screens never hover, so the star was unreachable there
    expect(css).toContain(`@media (hover: none) { .swatch-favorite-btn { ${shown} } }`);
  });
});
