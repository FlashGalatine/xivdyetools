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
import type { PaletteSlot, PaletteSlotMode } from '../../palette-slots';
import { ToastService } from '@services/toast-service';

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

// BUG-107 (2026-10-04 deep-dive): the Metallic and Pastel chips matched the
// English dye name, so Metallic showed the 14 "Metallic ..." dyes and dropped
// Gunmetal Black and Pearl White, the two gloss dyes without the word in
// their name -- while "Exclude metallic" (core DyeFilter) removed all 16.
// Core derives `isMetallic` from the Stain sheet's gloss set and `isPastel`
// at initialize(); the chips must read those flags, not re-derive them.
describe('DyePaletteDrawer type chips (BUG-107)', () => {
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

  type Drawer = HTMLElement & {
    isOpen: boolean;
    updateComplete: Promise<boolean>;
    allDyes: Dye[];
  };

  // In the gloss set, but no "Metallic" in the name
  const gunmetal = makeDye({
    id: 8735,
    itemID: 8735,
    stainID: 92,
    name: 'Gunmetal Black',
    category: 'Neutral',
    isMetallic: true,
  });
  const metallicSilver = makeDye({
    id: 8736,
    itemID: 8736,
    stainID: 112,
    name: 'Metallic Silver',
    category: 'Neutral',
    isMetallic: true,
  });
  // Synthetic: the flag says pastel and the name does not. Every real pastel
  // dye's name starts with "Pastel", so only this pins the flag as the source.
  const softPink = makeDye({
    id: 8737,
    itemID: 8737,
    stainID: 103,
    name: 'Soft Pink',
    category: 'Reds',
    isPastel: true,
  });

  /** Mount on the fixture, click the chip labelled `labelKey`, return the shown swatches. */
  const shownAfter = async (labelKey: string): Promise<string[]> => {
    await import('../../v4/dye-palette-drawer');
    const drawer = document.createElement('dye-palette-drawer') as unknown as Drawer;
    drawer.isOpen = true;
    container.appendChild(drawer);
    await drawer.updateComplete;
    drawer.allDyes = [redDye, gunmetal, metallicSilver, softPink];

    const chip = [
      ...drawer.shadowRoot!.querySelectorAll<HTMLButtonElement>('.filter-bar .filter-chip'),
    ].find((button) => button.textContent?.trim() === labelKey);
    expect(chip).toBeDefined();
    chip!.click();
    await drawer.updateComplete;

    return [...drawer.shadowRoot!.querySelectorAll('.category-section .swatch')]
      .map((swatch) => swatch.getAttribute('title') ?? '')
      .sort();
  };

  it('Metallic shows every dye in the gloss set, named "Metallic" or not', async () => {
    expect(await shownAfter('colorPalette.metallic')).toEqual(
      [`Dye-${gunmetal.itemID}`, `Dye-${metallicSilver.itemID}`].sort()
    );
  });

  it('Pastel follows the isPastel flag, not the English name', async () => {
    expect(await shownAfter('colorPalette.pastel')).toEqual([`Dye-${softPink.itemID}`]);
  });
});

// Issue 422: the palette shows which dyes the active tool holds, and in
// multi-input tools carries a strip of the tool's slots and the target line.
describe('DyePaletteDrawer slot marks, strip and target line (issue 422)', () => {
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

  type Drawer = HTMLElement & {
    isOpen: boolean;
    updateComplete: Promise<boolean>;
    slots: PaletteSlot[];
    slotMode: PaletteSlotMode | null;
    slotTarget: number | null;
    favoriteDyes: Dye[];
    focusClose(): void;
  };

  const slot = (label: string, dye: Dye | null, disabled?: boolean): PaletteSlot => ({
    label,
    targetLabel: `Choosing dye ${label}`,
    dye,
    ...(disabled ? { disabled } : {}),
  });

  const mount = async (
    slots: PaletteSlot[],
    slotMode: PaletteSlotMode | null,
    slotTarget: number | null = null
  ): Promise<Drawer> => {
    await import('../../v4/dye-palette-drawer');
    const drawer = document.createElement('dye-palette-drawer') as unknown as Drawer;
    drawer.isOpen = true;
    drawer.slots = slots;
    drawer.slotMode = slotMode;
    drawer.slotTarget = slotTarget;
    container.appendChild(drawer);
    await drawer.updateComplete;
    return drawer;
  };

  const root = (drawer: Drawer) => drawer.shadowRoot!;
  /** Every rendered swatch of a dye, favorites row included. */
  const swatchesOf = (drawer: Drawer, dye: Dye) =>
    [...root(drawer).querySelectorAll<HTMLElement>('.swatch')].filter(
      (s) => s.getAttribute('title') === `Dye-${dye.id}`
    );
  const gridSwatch = (drawer: Drawer, dye: Dye) =>
    swatchesOf(drawer, dye).find((s) => s.closest('.category-section'))!;
  const pickOf = (swatch: Element) => swatch.querySelector<HTMLButtonElement>('.swatch-pick')!;
  const chips = (drawer: Drawer) => [
    ...root(drawer).querySelectorAll<HTMLButtonElement>('.slot-strip .slot-chip'),
  ];

  it('marks a held dye in both the favorites row and the main grid', async () => {
    const drawer = await mount([slot('1', redDye), slot('2', null)], 'multi');
    drawer.favoriteDyes = [redDye];
    await drawer.updateComplete;

    const reds = swatchesOf(drawer, redDye);
    expect(reds).toHaveLength(2);
    expect(reds.some((s) => s.closest('.favorites-content'))).toBe(true);
    for (const swatch of reds) {
      expect(swatch.classList.contains('in-use')).toBe(true);
      expect(swatch.querySelector('.swatch-mark')?.getAttribute('aria-hidden')).toBe('true');
    }

    const blue = gridSwatch(drawer, blueDye);
    expect(blue.classList.contains('in-use')).toBe(false);
    expect(blue.querySelector('.swatch-mark')).toBeNull();
  });

  it('gives the target slot’s dye the is-target class', async () => {
    const drawer = await mount([slot('1', redDye), slot('2', blueDye)], 'multi', 1);

    expect(gridSwatch(drawer, blueDye).classList.contains('is-target')).toBe(true);
    const red = gridSwatch(drawer, redDye);
    expect(red.classList.contains('in-use')).toBe(true);
    expect(red.classList.contains('is-target')).toBe(false);
  });

  it('labels a marked swatch with its slot and sets aria-pressed in multi mode', async () => {
    const drawer = await mount([slot('A', null), slot('B', redDye)], 'multi');

    const red = pickOf(gridSwatch(drawer, redDye));
    expect(red.getAttribute('aria-label')).toBe(
      'colorPalette.swatchInSlot:{"name":"Dye-1","slot":"B"}'
    );
    expect(red.getAttribute('aria-pressed')).toBe('true');

    const blue = pickOf(gridSwatch(drawer, blueDye));
    expect(blue.getAttribute('aria-label')).toBe('Dye-2');
    expect(blue.getAttribute('aria-pressed')).toBe('false');
  });

  it('labels a marked swatch as in use, without aria-pressed, in single mode', async () => {
    const drawer = await mount([slot('', redDye)], 'single');

    const swatch = gridSwatch(drawer, redDye);
    expect(swatch.classList.contains('in-use')).toBe(true);
    expect(pickOf(swatch).getAttribute('aria-label')).toBe(
      'colorPalette.swatchInUse:{"name":"Dye-1"}'
    );
    expect(pickOf(swatch).hasAttribute('aria-pressed')).toBe(false);
    expect(pickOf(gridSwatch(drawer, blueDye)).hasAttribute('aria-pressed')).toBe(false);
  });

  it('renders one chip per slot in multi mode and none in single mode', async () => {
    const multi = await mount(
      [slot('1', redDye), slot('2', null), slot('3', null), slot('4', null)],
      'multi'
    );
    const strip = root(multi).querySelector('.slot-strip')!;
    expect(strip.getAttribute('role')).toBe('group');
    expect(strip.getAttribute('aria-label')).toBe('colorPalette.slotStripLabel');
    // First thing in the scrolling content, above the search box
    expect(root(multi).querySelector('.drawer-content')!.firstElementChild).toBe(strip);

    const all = chips(multi);
    expect(all).toHaveLength(4);
    expect(all.map((c) => c.textContent?.trim())).toEqual(['1', '2', '3', '4']);
    expect(all.every((c) => c.type === 'button')).toBe(true);
    expect(all[0].getAttribute('aria-label')).toBe(
      'colorPalette.slotChipFilled:{"slot":"1","name":"Dye-1"}'
    );
    expect(all[1].getAttribute('aria-label')).toBe('colorPalette.slotChipEmpty:{"slot":"2"}');

    const single = await mount([slot('', redDye)], 'single');
    expect(root(single).querySelector('.slot-strip')).toBeNull();
  });

  it('emits slot-target-change with the index, and null when the target chip is clicked again', async () => {
    const drawer = await mount([slot('1', redDye), slot('2', null), slot('3', null)], 'multi');
    const indexes: Array<number | null> = [];
    drawer.addEventListener('slot-target-change', ((e: CustomEvent<{ index: number | null }>) => {
      expect(e.bubbles && e.composed).toBe(true);
      indexes.push(e.detail.index);
    }) as EventListener);

    chips(drawer)[2].click();
    drawer.slotTarget = 2;
    await drawer.updateComplete;
    expect(chips(drawer)[2].getAttribute('aria-pressed')).toBe('true');
    expect(chips(drawer)[2].classList.contains('is-target')).toBe(true);
    expect(chips(drawer)[0].getAttribute('aria-pressed')).toBe('false');
    chips(drawer)[2].click();

    expect(indexes).toEqual([2, null]);
  });

  it('disables a chip whose slot is disabled', async () => {
    const drawer = await mount([slot('FROM', null), slot('TO', null, true)], 'multi');

    expect(chips(drawer).map((c) => c.disabled)).toEqual([false, true]);
  });

  it('shows the target line only while a target is set', async () => {
    const drawer = await mount([slot('1', redDye), slot('2', null)], 'multi');
    // The live region is always there, so its first text is announced
    const line = root(drawer).querySelector('.drawer-header .drawer-target-line')!;
    expect(line.getAttribute('aria-live')).toBe('polite');
    expect(line.textContent).toBe('');

    drawer.slotTarget = 1;
    await drawer.updateComplete;
    expect(root(drawer).querySelector('.drawer-target-line')).toBe(line);
    expect(line.textContent).toBe('Choosing dye 2');

    // A target past the last slot names nothing
    drawer.slotTarget = 5;
    await drawer.updateComplete;
    expect(line.textContent).toBe('');

    drawer.slotTarget = null;
    await drawer.updateComplete;
    expect(line.textContent).toBe('');
  });

  it('keeps the empty target line rendered, never display: none', async () => {
    // Hiding the empty line would take the live region out of the
    // accessibility tree, so its first text would arrive with the region.
    const { DyePaletteDrawer } = await import('../../v4/dye-palette-drawer');
    const css = [DyePaletteDrawer.styles]
      .flat(Infinity as 1)
      .map((sheet) => (sheet as { cssText: string }).cssText)
      .join('\n')
      .replace(/\s+/g, ' ');

    expect(css).not.toContain('.drawer-target-line:empty');
    expect(css).not.toMatch(/\.drawer-target-line[^{]*\{[^}]*(display: none|visibility: hidden)/);

    const drawer = await mount([slot('1', redDye), slot('2', null)], 'multi');
    const line = root(drawer).querySelector('.drawer-header .drawer-target-line');
    expect(line).not.toBeNull();
    expect(line!.textContent).toBe('');
  });

  it('random dye never returns a held dye in multi mode', async () => {
    const drawer = await mount([slot('1', redDye), slot('2', null)], 'multi');
    const picked: Dye[] = [];
    drawer.addEventListener('dye-selected', ((e: CustomEvent<{ dye: Dye }>) => {
      picked.push(e.detail.dye);
    }) as EventListener);
    const random = vi.spyOn(Math, 'random');
    const roll = () => (drawer as unknown as { handleRandomDye(): void }).handleRandomDye();

    // 0 lands on red (index 0 of all dyes), 0.99 on blue: both must give blue
    random.mockReturnValue(0);
    roll();
    random.mockReturnValue(0.99);
    roll();
    expect(picked.map((d) => d.id)).toEqual([blueDye.id, blueDye.id]);

    // Every dye held: nothing to roll
    drawer.slots = [slot('1', redDye), slot('2', blueDye)];
    await drawer.updateComplete;
    roll();
    expect(picked).toHaveLength(2);
    expect(ToastService.warning).toHaveBeenCalledWith('colorPalette.noDyesAvailable');

    // Single-input tools roll among every dye, as before
    drawer.slotMode = 'single';
    drawer.slots = [slot('', redDye)];
    await drawer.updateComplete;
    random.mockReturnValue(0);
    roll();
    expect(picked[2].id).toBe(redDye.id);
  });

  it('does not mark a swatch for a custom dye held by the tool', async () => {
    // A custom color with the same hex as a palette dye
    const custom = makeDye({
      id: -1700000000001,
      itemID: -1700000000001,
      stainID: null,
      name: 'Custom (#FF0000)',
      hex: redDye.hex,
      category: '__custom__',
      acquisition: '__custom__',
    });
    const drawer = await mount([slot('1', custom), slot('2', null)], 'multi');

    expect(root(drawer).querySelectorAll('.swatch.in-use')).toHaveLength(0);
    expect(root(drawer).querySelectorAll('.swatch-mark')).toHaveLength(0);
  });

  it('pulses a picked swatch once, and the pulse survives the re-render that marks it', async () => {
    const drawer = await mount([slot('1', null), slot('2', null)], 'multi');
    pickOf(gridSwatch(drawer, redDye)).click();
    expect(gridSwatch(drawer, redDye).classList.contains('just-picked')).toBe(true);

    // The tool takes the dye and the shell rebinds the slots mid-animation
    drawer.slots = [slot('1', redDye), slot('2', null)];
    await drawer.updateComplete;
    const red = gridSwatch(drawer, redDye);
    expect(red.classList.contains('in-use')).toBe(true);
    expect(red.classList.contains('just-picked')).toBe(true);

    red.dispatchEvent(new Event('animationend'));
    expect(red.classList.contains('just-picked')).toBe(false);
  });

  it('drops the pulse when closing the palette cancels it, so reopening does not replay it', async () => {
    const drawer = await mount([slot('1', null), slot('2', null)], 'multi');
    const red = gridSwatch(drawer, redDye);
    pickOf(red).click();
    expect(red.classList.contains('just-picked')).toBe(true);

    // display: none on the closed host cancels the animation; animationend never comes
    red.dispatchEvent(new Event('animationcancel'));
    expect(red.classList.contains('just-picked')).toBe(false);

    // The next pick pulses again
    pickOf(red).click();
    expect(red.classList.contains('just-picked')).toBe(true);
  });

  it('adds no pulse under reduced motion, where nothing would ever end it', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
        }) as MediaQueryList
    );
    const drawer = await mount([slot('1', null), slot('2', null)], 'multi');
    const picked: Dye[] = [];
    drawer.addEventListener('dye-selected', ((e: CustomEvent<{ dye: Dye }>) => {
      picked.push(e.detail.dye);
    }) as EventListener);

    pickOf(gridSwatch(drawer, redDye)).click();

    expect(picked.map((d) => d.id)).toEqual([redDye.id]);
    expect(root(drawer).querySelectorAll('.just-picked')).toHaveLength(0);
  });

  it('plays the pulse only for users who have not asked for reduced motion', async () => {
    const { DyePaletteDrawer } = await import('../../v4/dye-palette-drawer');
    const css = [DyePaletteDrawer.styles]
      .flat(Infinity as 1)
      .map((sheet) => (sheet as { cssText: string }).cssText)
      .join('\n')
      .replace(/\s+/g, ' ');

    // The only just-picked rule and the keyframes sit in the motion query
    const media = css.indexOf('@media (prefers-reduced-motion: no-preference)');
    expect(media).toBeGreaterThan(-1);
    expect(css.split('just-picked')).toHaveLength(2);
    expect(css.indexOf('.swatch.just-picked')).toBeGreaterThan(media);
    expect(css.indexOf('@keyframes swatch-pulse')).toBeGreaterThan(media);
  });

  it('focusClose() moves focus to the close button', async () => {
    const drawer = await mount([], null);
    drawer.focusClose();

    expect(root(drawer).activeElement).toBe(root(drawer).querySelector('.close-btn'));
  });
});
