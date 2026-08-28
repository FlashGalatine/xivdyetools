/**
 * XIV Dye Tools - V4AppHeader Unit Tests
 *
 * Covers the console bar's two tool switchers: the desktop icon-first rail
 * (3A — nine chips, the active one accent-filled and labelled, the others
 * icon-only until pointed at) and the mobile 2B title-menu it sits beside.
 * Which of the two is visible is a CSS media-query decision, so both are in
 * the DOM here; these tests assert structure, labels and events.
 *
 * @module components/__tests__/v4/v4-app-header.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    getCurrentLocale: () => 'en',
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@services/theme-service', () => ({
  ThemeService: {
    isDarkMode: () => true,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_GLOBE: '<svg></svg>',
  ICON_ABOUT: '<svg></svg>',
  ICON_THEME_SUN: '<svg></svg>',
  ICON_THEME_MOON: '<svg></svg>',
  ICON_SCROLL: '<svg></svg>',
  ICON_SETTINGS: '<svg></svg>',
}));

vi.mock('@shared/app-logo', () => ({
  LOGO_SPARKLES: '<svg></svg>',
}));

vi.mock('@shared/tool-icons', () => {
  const ids = [
    'harmony',
    'extractor',
    'accessibility',
    'comparison',
    'gradient',
    'mixer',
    'presets',
    'budget',
    'swatch',
  ];
  return {
    TOOL_ICONS: Object.fromEntries(ids.map((id) => [id, `<svg data-glyph="${id}"></svg>`])),
  };
});

const RAIL_ORDER = [
  'harmony',
  'extractor',
  'accessibility',
  'comparison',
  'gradient',
  'mixer',
  'presets',
  'budget',
  'swatch',
];

/** Translation-key prefix per tool (matcher/character are the 4.x key names). */
const KEY_PREFIX: Record<string, string> = {
  harmony: 'tools.harmony',
  extractor: 'tools.matcher',
  accessibility: 'tools.accessibility',
  comparison: 'tools.comparison',
  gradient: 'tools.gradient',
  mixer: 'tools.mixer',
  presets: 'tools.presets',
  budget: 'tools.budget',
  swatch: 'tools.character',
};

type HeaderEl = HTMLElement & { activeTool: string; updateComplete: Promise<unknown> };

describe('V4AppHeader', () => {
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

  async function mountHeader(activeTool = 'harmony'): Promise<HeaderEl> {
    await import('../../v4/v4-app-header');
    const el = document.createElement('v4-app-header') as HeaderEl;
    el.activeTool = activeTool;
    container.appendChild(el);
    await el.updateComplete;
    return el;
  }

  const railChips = (el: HeaderEl): HTMLButtonElement[] =>
    Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.tool-rail button.rail-chip'));

  describe('desktop rail (3A)', () => {
    it('renders the nine tools as chips in the confirmed order', async () => {
      const el = await mountHeader();
      const chips = railChips(el);
      expect(chips.map((c) => c.dataset.tool)).toEqual(RAIL_ORDER);
    });

    it('marks only the active chip, and names it with the short label', async () => {
      const el = await mountHeader('gradient');
      const chips = railChips(el);
      const active = chips.filter((c) => c.classList.contains('active'));
      expect(active).toHaveLength(1);
      expect(active[0].dataset.tool).toBe('gradient');
      expect(active[0].getAttribute('aria-current')).toBe('page');
      // Every chip carries its short label in the DOM (revealed by CSS on
      // hover/focus); the active one is the only one visible at rest.
      for (const chip of chips) {
        const label = chip.querySelector('.rail-label');
        expect(label?.textContent).toBe(`${KEY_PREFIX[chip.dataset.tool!]}.shortName`);
      }
      const inactive = chips.filter((c) => !c.classList.contains('active'));
      for (const chip of inactive) {
        expect(chip.hasAttribute('aria-current')).toBe(false);
      }
    });

    it('gives every chip its full tool name as the accessible name and tooltip', async () => {
      const el = await mountHeader();
      const chips = railChips(el);
      expect(chips).toHaveLength(9);
      for (const chip of chips) {
        const full = `${KEY_PREFIX[chip.dataset.tool!]}.title`;
        expect(chip.getAttribute('aria-label')).toBe(full);
        expect(chip.getAttribute('title')).toBe(full);
      }
    });

    it('draws each chip with the confirmed glyph', async () => {
      const el = await mountHeader();
      const chips = railChips(el);
      expect(chips).toHaveLength(9);
      for (const chip of chips) {
        const glyph = chip.querySelector('.glyph svg');
        expect(glyph?.getAttribute('data-glyph')).toBe(chip.dataset.tool);
      }
    });

    it('emits tool-select when an inactive chip is clicked', async () => {
      const el = await mountHeader('harmony');
      const handler = vi.fn();
      el.addEventListener('tool-select', handler);
      railChips(el)
        .find((c) => c.dataset.tool === 'mixer')!
        .click();
      expect(handler).toHaveBeenCalledTimes(1);
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ toolId: 'mixer' });
    });

    it('does not emit tool-select when the active chip is clicked', async () => {
      const el = await mountHeader('harmony');
      const handler = vi.fn();
      el.addEventListener('tool-select', handler);
      railChips(el)
        .find((c) => c.dataset.tool === 'harmony')!
        .click();
      expect(handler).not.toHaveBeenCalled();
    });

    it('follows the activeTool property when it changes', async () => {
      const el = await mountHeader('harmony');
      el.activeTool = 'swatch';
      await el.updateComplete;
      const active = railChips(el).filter((c) => c.classList.contains('active'));
      expect(active.map((c) => c.dataset.tool)).toEqual(['swatch']);
    });
  });

  describe('mobile title-menu (2B, unchanged)', () => {
    it('still renders the title-menu button naming the active tool', async () => {
      const el = await mountHeader('presets');
      const btn = el.shadowRoot!.querySelector('button.tool-menu-btn');
      expect(btn).not.toBeNull();
      expect(btn!.querySelector('.label')?.textContent).toBe('tools.presets.title');
      expect(btn!.getAttribute('aria-expanded')).toBe('false');
    });

    it('opens the nine-item menu and selects from it', async () => {
      const el = await mountHeader('harmony');
      const handler = vi.fn();
      el.addEventListener('tool-select', handler);

      const btn = el.shadowRoot!.querySelector<HTMLButtonElement>('button.tool-menu-btn')!;
      btn.click();
      await el.updateComplete;

      const items = el.shadowRoot!.querySelectorAll('.tool-menu button.tool-menu-item');
      expect(items).toHaveLength(9);
      (items[3] as HTMLButtonElement).click();
      await el.updateComplete;

      expect(handler).toHaveBeenCalledTimes(1);
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ toolId: 'comparison' });
      expect(el.shadowRoot!.querySelector('.tool-menu')).toBeNull();
    });

    it('closes the open menu on Escape', async () => {
      const el = await mountHeader('harmony');
      el.shadowRoot!.querySelector<HTMLButtonElement>('button.tool-menu-btn')!.click();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.tool-menu')).not.toBeNull();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.tool-menu')).toBeNull();
    });
  });

  describe('chrome cluster', () => {
    it('emits one event per chrome button, in bar order', async () => {
      const el = await mountHeader();
      const events = [
        'changelog-click',
        'about-click',
        'language-click',
        'theme-click',
        'advanced-click',
      ];
      const seen: string[] = [];
      for (const name of events) el.addEventListener(name, () => seen.push(name));

      const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>(
        'button.v4-header-nav-btn'
      );
      expect(buttons).toHaveLength(5);
      buttons.forEach((b) => b.click());
      expect(seen).toEqual(events);
    });
  });
});
