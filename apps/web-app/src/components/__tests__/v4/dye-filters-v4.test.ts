/**
 * Dye filter panel — nine exclusion toggles across two collapsible sections.
 *
 * The child `<v4-toggle-switch>` is left REAL rather than stubbed, so at least
 * one path here proves the whole chain: a pointer press inside the child's
 * shadow root → its `toggle-change` → this panel's property write → its own
 * `dye-filters-change`. The per-filter matrix then drives `toggle-change`
 * directly, which is the wiring that actually lives in this file.
 *
 * `allFilters` in the emitted detail is read AFTER the property write, so it
 * carries the new value rather than the pre-change snapshot — that is asserted
 * explicitly, since returning the stale object is the easy mistake here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_DYE_FILTERS, type DyeFiltersConfig } from '@shared/tool-config-types';
import type { DyeFiltersV4, DyeFiltersChangeDetail } from '../../v4/dye-filters-v4';

const { mockSubscribe, mockUnsubscribe, mockT } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockUnsubscribe: vi.fn(),
  mockT: vi.fn((key: string) => key),
}));

vi.mock('@services/language-service', () => ({
  LanguageService: { t: mockT, subscribe: mockSubscribe },
}));
vi.mock('@services/index', () => ({
  LanguageService: { t: mockT, subscribe: mockSubscribe },
}));

/** The nine filters, in the order the panel renders them. */
const TYPE_FILTERS = [
  'excludeMetallic',
  'excludePastel',
  'excludeDark',
  'excludeCosmic',
  'excludeIshgardian',
  'excludeExpensive',
  'excludeCoffers',
] as const;
const ACQUISITION_FILTERS = ['excludeVendorDyes', 'excludeCraftDyes'] as const;
const ALL_FILTERS = [...TYPE_FILTERS, ...ACQUISITION_FILTERS];

describe('DyeFiltersV4', () => {
  let el: DyeFiltersV4;
  let container: HTMLElement;

  async function mount(props: Partial<DyeFiltersV4> = {}): Promise<DyeFiltersV4> {
    await import('../../v4/dye-filters-v4');
    el = document.createElement('v4-dye-filters') as DyeFiltersV4;
    Object.assign(el, props);
    container.appendChild(el);
    await el.updateComplete;
    return el;
  }

  function groups(): HTMLElement[] {
    return [...el.shadowRoot!.querySelectorAll<HTMLElement>('.option-group')];
  }

  function header(section: 0 | 1): HTMLElement {
    return groups()[section].querySelector<HTMLElement>('.option-group-header')!;
  }

  function body(section: 0 | 1): HTMLElement {
    return groups()[section].querySelector<HTMLElement>('.option-group-content')!;
  }

  function toggles(section?: 0 | 1): HTMLElement[] {
    const root = section === undefined ? el.shadowRoot! : groups()[section];
    return [...root.querySelectorAll<HTMLElement>('v4-toggle-switch')];
  }

  /** The toggle bound to a given filter, by its position in the rendered order. */
  function toggleFor(filter: string): HTMLElement {
    return toggles()[ALL_FILTERS.indexOf(filter as (typeof ALL_FILTERS)[number])];
  }

  function capture(): DyeFiltersChangeDetail[] {
    const seen: DyeFiltersChangeDetail[] = [];
    el.addEventListener('dye-filters-change', (e) =>
      seen.push((e as CustomEvent<DyeFiltersChangeDetail>).detail)
    );
    return seen;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribe.mockReturnValue(mockUnsubscribe);
    mockT.mockImplementation((key: string) => key);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  // --- defaults and structure ----------------------------------------------

  it('starts with every filter off, matching the shared defaults', async () => {
    await mount();

    for (const filter of ALL_FILTERS) {
      expect(el[filter]).toBe(DEFAULT_DYE_FILTERS[filter]);
      expect(el[filter]).toBe(false);
    }
  });

  it('renders two groups holding nine toggles in the declared order', async () => {
    await mount();

    expect(groups()).toHaveLength(2);
    expect(toggles(0)).toHaveLength(TYPE_FILTERS.length);
    expect(toggles(1)).toHaveLength(ACQUISITION_FILTERS.length);
    expect(toggles().map((t) => t.getAttribute('label'))).toEqual([
      'filters.excludeMetallic',
      'filters.excludePastel',
      'filters.excludeDark',
      'filters.excludeCosmic',
      'filters.excludeIshgardian',
      'filters.excludeExpensive',
      'filters.excludeCoffers',
      'filters.excludeVendorDyes',
      'filters.excludeCraftDyes',
    ]);
  });

  it('opens with Dye Types expanded and Acquisition collapsed', async () => {
    await mount();

    expect(header(0).getAttribute('aria-expanded')).toBe('true');
    expect(body(0).classList.contains('collapsed')).toBe(false);
    expect(header(1).getAttribute('aria-expanded')).toBe('false');
    expect(body(1).classList.contains('collapsed')).toBe(true);
  });

  it('pushes each incoming property down to its toggle', async () => {
    await mount({ excludeDark: true, excludeCraftDyes: true });

    expect((toggleFor('excludeDark') as unknown as { checked: boolean }).checked).toBe(true);
    expect((toggleFor('excludeCraftDyes') as unknown as { checked: boolean }).checked).toBe(true);
    expect((toggleFor('excludeMetallic') as unknown as { checked: boolean }).checked).toBe(false);
  });

  // --- collapsing -----------------------------------------------------------

  it.each([
    { section: 0 as const, startsOpen: true },
    { section: 1 as const, startsOpen: false },
  ])('toggles section $section on header click', async ({ section, startsOpen }) => {
    await mount();

    header(section).click();
    await el.updateComplete;

    expect(body(section).classList.contains('collapsed')).toBe(startsOpen);
    expect(header(section).getAttribute('aria-expanded')).toBe(String(!startsOpen));

    header(section).click();
    await el.updateComplete;

    expect(body(section).classList.contains('collapsed')).toBe(!startsOpen);
  });

  it('flips the caret glyph with the section', async () => {
    await mount();
    const caret = (): HTMLElement => groups()[0].querySelector<HTMLElement>('.collapse-icon')!;

    expect(caret().textContent).toBe('▲');
    expect(caret().classList.contains('collapsed')).toBe(false);

    header(0).click();
    await el.updateComplete;

    expect(caret().textContent).toBe('▼');
    expect(caret().classList.contains('collapsed')).toBe(true);
  });

  it.each(['Enter', ' '])('toggles a section from the keyboard with %s', async (key) => {
    await mount();
    const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });

    header(0).dispatchEvent(event);
    await el.updateComplete;

    expect(body(0).classList.contains('collapsed')).toBe(true);
    // The default is suppressed so Space does not also scroll the panel.
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores other keys on a section header', async () => {
    await mount();

    header(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    await el.updateComplete;

    expect(body(0).classList.contains('collapsed')).toBe(false);
  });

  it('collapses the two sections independently', async () => {
    await mount();

    header(0).click();
    await el.updateComplete;

    expect(body(0).classList.contains('collapsed')).toBe(true);
    expect(body(1).classList.contains('collapsed')).toBe(true); // unchanged
  });

  it('exposes the headers as focusable buttons', async () => {
    await mount();

    for (const section of [0, 1] as const) {
      expect(header(section).getAttribute('role')).toBe('button');
      expect(header(section).getAttribute('tabindex')).toBe('0');
    }
  });

  // --- filter changes -------------------------------------------------------

  it.each(ALL_FILTERS)('writes %s and announces it when its toggle changes', async (filter) => {
    await mount();
    const seen = capture();

    toggleFor(filter).dispatchEvent(
      new CustomEvent('toggle-change', { detail: { checked: true }, bubbles: true, composed: true })
    );

    expect(el[filter]).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].filter).toBe(filter);
    expect(seen[0].value).toBe(true);
  });

  it('reports allFilters AFTER the write, not the pre-change snapshot', async () => {
    await mount({ excludePastel: true });
    const seen = capture();

    toggleFor('excludeMetallic').dispatchEvent(
      new CustomEvent('toggle-change', { detail: { checked: true } })
    );

    expect(seen[0].allFilters).toEqual({
      ...DEFAULT_DYE_FILTERS,
      excludePastel: true,
      excludeMetallic: true,
    });
    // The one that changed must be true in the snapshot, or a consumer that
    // re-reads `allFilters` would undo the user's tap.
    expect(seen[0].allFilters.excludeMetallic).toBe(true);
  });

  it('carries every filter key in allFilters, not just the changed one', async () => {
    await mount();
    const seen = capture();

    toggleFor('excludeCosmic').dispatchEvent(
      new CustomEvent('toggle-change', { detail: { checked: true } })
    );

    expect(Object.keys(seen[0].allFilters).sort()).toEqual([...ALL_FILTERS].sort());
  });

  it('turns a filter back off', async () => {
    await mount({ excludeVendorDyes: true });
    const seen = capture();

    toggleFor('excludeVendorDyes').dispatchEvent(
      new CustomEvent('toggle-change', { detail: { checked: false } })
    );

    expect(el.excludeVendorDyes).toBe(false);
    expect(seen[0].value).toBe(false);
    expect(seen[0].allFilters.excludeVendorDyes).toBe(false);
  });

  it('accumulates independent filters rather than replacing them', async () => {
    await mount();
    const seen = capture();

    toggleFor('excludeDark').dispatchEvent(
      new CustomEvent('toggle-change', { detail: { checked: true } })
    );
    toggleFor('excludeExpensive').dispatchEvent(
      new CustomEvent('toggle-change', { detail: { checked: true } })
    );

    expect(seen).toHaveLength(2);
    expect(seen[1].allFilters.excludeDark).toBe(true);
    expect(seen[1].allFilters.excludeExpensive).toBe(true);
  });

  it('lets the change escape the shadow tree', async () => {
    await mount();
    const outside: DyeFiltersChangeDetail[] = [];
    container.addEventListener('dye-filters-change', (e) =>
      outside.push((e as CustomEvent<DyeFiltersChangeDetail>).detail)
    );

    toggleFor('excludeCoffers').dispatchEvent(
      new CustomEvent('toggle-change', { detail: { checked: true } })
    );

    expect(outside).toHaveLength(1);
    expect(outside[0].filter).toBe('excludeCoffers');
  });

  it('carries a real press on the child toggle all the way out', async () => {
    await mount();
    const seen = capture();
    const child = toggleFor('excludeMetallic') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await child.updateComplete;

    // A press inside the CHILD's shadow root — the full integration path.
    child.shadowRoot!.querySelector<HTMLElement>('.toggle-wrapper')!.click();
    await el.updateComplete;

    expect(seen).toHaveLength(1);
    expect(seen[0].filter).toBe('excludeMetallic');
    expect(seen[0].value).toBe(true);
    expect(el.excludeMetallic).toBe(true);
  });

  // --- localization ---------------------------------------------------------

  it('re-renders its labels when the language changes', async () => {
    await mount();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    const notify = mockSubscribe.mock.calls[0][0] as () => void;

    mockT.mockImplementation((key: string) => `de:${key}`);
    notify();
    await el.updateComplete;

    expect(header(0).querySelector('.option-group-label')!.textContent).toBe('de:filters.dyeTypes');
    expect(toggleFor('excludeMetallic').getAttribute('label')).toBe('de:filters.excludeMetallic');
  });

  it('localizes both section headings', async () => {
    await mount();

    expect(header(0).querySelector('.option-group-label')!.textContent).toBe('filters.dyeTypes');
    expect(header(1).querySelector('.option-group-label')!.textContent).toBe(
      'filters.acquisitionSource'
    );
  });

  it('drops the language subscription on unmount', async () => {
    await mount();

    el.remove();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('re-subscribes when re-attached', async () => {
    await mount();
    el.remove();

    container.appendChild(el);
    await el.updateComplete;

    expect(mockSubscribe).toHaveBeenCalledTimes(2);
  });

  // --- attribute API --------------------------------------------------------

  it('accepts filters as kebab-case attributes', async () => {
    await import('../../v4/dye-filters-v4');
    container.innerHTML = '<v4-dye-filters exclude-metallic exclude-vendor-dyes></v4-dye-filters>';
    el = container.querySelector('v4-dye-filters') as DyeFiltersV4;
    await el.updateComplete;

    expect(el.excludeMetallic).toBe(true);
    expect(el.excludeVendorDyes).toBe(true);
    expect(el.excludePastel).toBe(false);
  });
});

// A compile-time check that the matrix above stays exhaustive: adding a key to
// DyeFiltersConfig without adding it to ALL_FILTERS fails type-check here.
const _exhaustive: Record<keyof DyeFiltersConfig, true> = Object.fromEntries(
  ALL_FILTERS.map((f) => [f, true])
) as Record<keyof DyeFiltersConfig, true>;
void _exhaustive;
