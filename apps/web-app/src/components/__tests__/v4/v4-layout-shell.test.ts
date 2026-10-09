/**
 * XIV Dye Tools - V4LayoutShell Unit Tests
 *
 * Covers the palette drawer's viewport-dependent default and the first-run
 * mobile hint that points at the palette FAB:
 *   - desktop: drawer open on mount, no hint
 *   - mobile: drawer closed on mount, hint shown once until the user opens
 *     the drawer (FAB or a tool's open-palette-drawer request) or dismisses it
 *   - the "seen" flag persists through StorageService so the hint never
 *     returns for that user
 *
 * The three child elements (app header, config sidebar, palette drawer) are
 * mocked away — they are separate components with their own suites, and the
 * shell only binds attributes/events on them.
 *
 * @module components/__tests__/v4/v4-layout-shell.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const storage = new Map<string, unknown>();

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    getCurrentLocale: () => 'en',
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  StorageService: {
    getItem: vi.fn((key: string, defaultValue?: unknown) =>
      storage.has(key) ? storage.get(key) : (defaultValue ?? null)
    ),
    setItem: vi.fn((key: string, value: unknown) => {
      storage.set(key, value);
      return true;
    }),
    removeItem: vi.fn((key: string) => storage.delete(key)),
  },
}));

// Child components: registration side-effects only, not under test here.
vi.mock('../../v4/v4-app-header', () => ({}));
vi.mock('../../v4/config-sidebar', () => ({}));
vi.mock('../../v4/dye-palette-drawer', () => ({}));

import { STORAGE_KEYS } from '@shared/constants';

type ShellEl = HTMLElement & { activeTool: string; updateComplete: Promise<unknown> };
type MqlListener = (e: { matches: boolean }) => void;

/** Install a matchMedia stub that reports `mobile` and lets tests fire changes. */
function stubViewport(mobile: boolean): { fireChange: (matches: boolean) => void } {
  const listeners = new Set<MqlListener>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mobile,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_type: string, cb: MqlListener) => listeners.add(cb),
    removeEventListener: (_type: string, cb: MqlListener) => listeners.delete(cb),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  return {
    fireChange: (matches: boolean) => listeners.forEach((cb) => cb({ matches })),
  };
}

describe('V4LayoutShell — palette drawer default + first-run hint', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    storage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
  });

  async function mountShell(activeTool = 'harmony'): Promise<ShellEl> {
    await import('../../v4/v4-layout-shell');
    const el = document.createElement('v4-layout-shell') as ShellEl;
    el.activeTool = activeTool;
    container.appendChild(el);
    await el.updateComplete;
    return el;
  }

  const drawer = (el: ShellEl) => el.shadowRoot!.querySelector('dye-palette-drawer');
  const fab = (el: ShellEl) =>
    el.shadowRoot!.querySelector<HTMLButtonElement>('.v4-palette-toggle')!;
  const hint = (el: ShellEl) => el.shadowRoot!.querySelector('.v4-palette-hint');

  describe('desktop', () => {
    it('opens the drawer by default and shows no hint', async () => {
      stubViewport(false);
      const el = await mountShell();

      expect(drawer(el)?.hasAttribute('is-open')).toBe(true);
      expect(fab(el).getAttribute('aria-expanded')).toBe('true');
      expect(hint(el)).toBeNull();
      expect(fab(el).classList.contains('hinting')).toBe(false);
    });

    it('closes the drawer when the viewport crosses into mobile', async () => {
      const vp = stubViewport(false);
      const el = await mountShell();
      expect(drawer(el)?.hasAttribute('is-open')).toBe(true);

      vp.fireChange(true);
      await el.updateComplete;

      expect(drawer(el)?.hasAttribute('is-open')).toBe(false);
      expect(hint(el)).not.toBeNull();
    });
  });

  describe('mobile', () => {
    it('starts with the drawer closed and the first-run hint pointing at the FAB', async () => {
      stubViewport(true);
      const el = await mountShell();

      expect(drawer(el)?.hasAttribute('is-open')).toBe(false);
      expect(fab(el).getAttribute('aria-expanded')).toBe('false');
      expect(fab(el).classList.contains('hinting')).toBe(true);

      const h = hint(el);
      expect(h).not.toBeNull();
      expect(h!.getAttribute('role')).toBe('status');
      expect(h!.textContent).toContain('colorPalette.mobileHint');
      expect(h!.querySelector('.v4-palette-hint-dismiss')?.getAttribute('aria-label')).toBe(
        'aria.dismissHint'
      );
    });

    it('does not show the hint once it has been marked seen in storage', async () => {
      stubViewport(true);
      storage.set(STORAGE_KEYS.PALETTE_HINT_SEEN, true);
      const el = await mountShell();

      expect(drawer(el)?.hasAttribute('is-open')).toBe(false);
      expect(hint(el)).toBeNull();
      expect(fab(el).classList.contains('hinting')).toBe(false);
    });

    it('tapping the FAB opens the drawer, hides the hint and persists the seen flag', async () => {
      stubViewport(true);
      const el = await mountShell();
      const { StorageService } = await import('@services/index');

      fab(el).click();
      await el.updateComplete;

      expect(drawer(el)?.hasAttribute('is-open')).toBe(true);
      expect(hint(el)).toBeNull();
      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.PALETTE_HINT_SEEN, true);

      // Closing again must not bring the hint back — it has been seen.
      fab(el).click();
      await el.updateComplete;
      expect(drawer(el)?.hasAttribute('is-open')).toBe(false);
      expect(hint(el)).toBeNull();
      expect(fab(el).classList.contains('hinting')).toBe(false);
    });

    it('the dismiss button hides the hint without opening the drawer', async () => {
      stubViewport(true);
      const el = await mountShell();
      const { StorageService } = await import('@services/index');

      hint(el)!.querySelector<HTMLButtonElement>('.v4-palette-hint-dismiss')!.click();
      await el.updateComplete;

      expect(hint(el)).toBeNull();
      expect(drawer(el)?.hasAttribute('is-open')).toBe(false);
      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.PALETTE_HINT_SEEN, true);
    });

    it("a tool's open-palette-drawer request opens the drawer and retires the hint", async () => {
      stubViewport(true);
      const el = await mountShell();

      const slotHost = el.shadowRoot!.querySelector('.v4-layout-content-scroll') ?? el;
      slotHost.dispatchEvent(
        new CustomEvent('open-palette-drawer', { bubbles: true, composed: true })
      );
      await el.updateComplete;

      expect(drawer(el)?.hasAttribute('is-open')).toBe(true);
      expect(hint(el)).toBeNull();
      expect(storage.get(STORAGE_KEYS.PALETTE_HINT_SEEN)).toBe(true);
    });

    it('the Glamour Reader has no palette, no Options panel and no Options FAB (design 1a: no sidebar)', async () => {
      stubViewport(false);
      const el = await mountShell('glamour');

      expect(drawer(el)).toBeNull();
      expect(fab(el).classList.contains('no-palette')).toBe(true);
      expect(el.shadowRoot!.querySelector('v4-config-sidebar')).toBeNull();
      expect(el.shadowRoot!.querySelector('.v4-options-toggle')).toBeNull();
    });

    it('shows no hint (and no FAB) on tools without a palette', async () => {
      stubViewport(true);
      const el = await mountShell('presets');

      expect(hint(el)).toBeNull();
      expect(drawer(el)).toBeNull();
      expect(fab(el).classList.contains('no-palette')).toBe(true);
    });

    it('closes the drawer again after a tool is selected from the app bar', async () => {
      stubViewport(true);
      const el = await mountShell();
      fab(el).click();
      await el.updateComplete;
      expect(drawer(el)?.hasAttribute('is-open')).toBe(true);

      el.shadowRoot!.querySelector('v4-app-header')!.dispatchEvent(
        new CustomEvent('tool-select', { detail: { toolId: 'gradient' } })
      );
      await el.updateComplete;

      expect(drawer(el)?.hasAttribute('is-open')).toBe(false);
      // Hint stays retired — the user has already found the palette.
      expect(hint(el)).toBeNull();
    });
  });

  /*
   * The tool-Options panel and the Advanced Options slide-over are two
   * separate surfaces reached by two separate controls.
   *
   * The gear used to do double duty: with the desktop column collapsed it
   * restored the column instead of opening the slide-over, and on mobile the
   * slide-over embedded a copy of the column. Because config-sidebar's own
   * mobile rule makes its :host `position: fixed; left: 0; z-index: 100`,
   * that embedded copy escaped the modal and painted underneath the settings
   * cards — the reported overlap.
   *
   * Now: the gear ONLY emits `advanced-click`, on both breakpoints, and the
   * Options panel is toggled by its own bottom-left FAB.
   */
  describe('tool-Options panel and the gear', () => {
    const column = (el: ShellEl) => el.shadowRoot!.querySelector('v4-config-sidebar');
    const header = (el: ShellEl) => el.shadowRoot!.querySelector('v4-app-header')!;
    const optionsFab = (el: ShellEl) =>
      el.shadowRoot!.querySelector<HTMLButtonElement>('.v4-options-toggle')!;

    it('renders the panel on desktop, open on mount', async () => {
      stubViewport(false);
      const el = await mountShell();

      expect(column(el)).not.toBeNull();
      expect(column(el)!.hasAttribute('collapsed')).toBe(false);
    });

    it('renders the panel on mobile too, collapsed on mount', async () => {
      stubViewport(true);
      const el = await mountShell();

      // It exists on mobile now (it used to be omitted entirely, which is why
      // the gear had to embed a copy), but starts off-screen.
      expect(column(el)).not.toBeNull();
      expect(column(el)!.hasAttribute('collapsed')).toBe(true);
    });

    it('the × (sidebar-collapse) hides the panel', async () => {
      stubViewport(false);
      const el = await mountShell();

      column(el)!.dispatchEvent(
        new CustomEvent('sidebar-collapse', { bubbles: true, composed: true })
      );
      await el.updateComplete;

      expect(column(el)!.hasAttribute('collapsed')).toBe(true);
    });

    it.each([
      ['desktop', false],
      ['mobile', true],
    ])('the bottom-left Options FAB toggles the panel on %s', async (_label, mobile) => {
      stubViewport(mobile as boolean);
      const el = await mountShell();
      const startsCollapsed = column(el)!.hasAttribute('collapsed');

      optionsFab(el).click();
      await el.updateComplete;
      expect(column(el)!.hasAttribute('collapsed')).toBe(!startsCollapsed);

      optionsFab(el).click();
      await el.updateComplete;
      expect(column(el)!.hasAttribute('collapsed')).toBe(startsCollapsed);
    });

    it('the Options FAB hides itself while the panel is open', async () => {
      stubViewport(true);
      const el = await mountShell();

      expect(optionsFab(el).classList.contains('panel-open')).toBe(false);

      optionsFab(el).click();
      await el.updateComplete;

      expect(optionsFab(el).classList.contains('panel-open')).toBe(true);
    });

    it.each([
      ['desktop', false],
      ['mobile', true],
    ])('the gear opens ONLY the slide-over on %s, panel untouched', async (_label, mobile) => {
      stubViewport(mobile as boolean);
      const el = await mountShell();
      const advancedClicks = vi.fn();
      el.addEventListener('advanced-click', advancedClicks);
      const before = column(el)!.hasAttribute('collapsed');

      header(el).dispatchEvent(new CustomEvent('advanced-click'));
      await el.updateComplete;

      expect(advancedClicks).toHaveBeenCalledTimes(1);
      expect(column(el)!.hasAttribute('collapsed')).toBe(before);
    });

    it('the gear still reaches the slide-over with the panel collapsed on desktop', async () => {
      stubViewport(false);
      const el = await mountShell();
      const advancedClicks = vi.fn();
      el.addEventListener('advanced-click', advancedClicks);

      column(el)!.dispatchEvent(
        new CustomEvent('sidebar-collapse', { bubbles: true, composed: true })
      );
      await el.updateComplete;
      expect(column(el)!.hasAttribute('collapsed')).toBe(true);

      // This is the regression: the gear used to swallow the click here and
      // restore the column instead of opening the slide-over.
      header(el).dispatchEvent(new CustomEvent('advanced-click'));
      await el.updateComplete;

      expect(advancedClicks).toHaveBeenCalledTimes(1);
      expect(column(el)!.hasAttribute('collapsed')).toBe(true);
    });

    it('crossing into the mobile layout collapses an open panel', async () => {
      const { fireChange } = stubViewport(false);
      const el = await mountShell();
      expect(column(el)!.hasAttribute('collapsed')).toBe(false);

      fireChange(true);
      await el.updateComplete;

      expect(column(el)!.hasAttribute('collapsed')).toBe(true);
    });

    it('the mobile scrim closes the panel', async () => {
      stubViewport(true);
      const el = await mountShell();

      optionsFab(el).click();
      await el.updateComplete;
      expect(column(el)!.hasAttribute('collapsed')).toBe(false);

      const scrim = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.v4-drawer-overlay')].find(
        (n) => n.classList.contains('visible')
      )!;
      scrim.click();
      await el.updateComplete;

      expect(column(el)!.hasAttribute('collapsed')).toBe(true);
    });

    it('leaves no scrim over a tool without an Options panel when the route changes under an open one', async () => {
      stubViewport(true);
      const el = await mountShell('swatch');
      optionsFab(el).click();
      await el.updateComplete;
      const visibleScrims = () =>
        el.shadowRoot!.querySelectorAll('.v4-drawer-overlay.visible').length;
      expect(visibleScrims()).toBe(1);

      // Back/Forward (or any navigateTo) reaches the shell as this attribute,
      // not as the app bar's tool-select, so nothing closes the panel first
      el.setAttribute('active-tool', 'glamour');
      await el.updateComplete;

      expect(column(el)).toBeNull();
      expect(visibleScrims()).toBe(0);
    });
  });

  /*
   * BUG-113 (2026-10-04 deep-dive): every child event the shell re-emits is
   * fired by emit(), which is bubbles + composed. Re-emitting without
   * stopping the original let BOTH events reach v4-layout's listeners on the
   * host, so each handler ran twice. The earlier tests dispatched plain,
   * non-bubbling events, which is why the double fire never showed.
   */
  describe('re-emitted child events reach the host exactly once (BUG-113)', () => {
    const fromChild = (el: ShellEl, selector: string, name: string, detail?: unknown): void => {
      el.shadowRoot!.querySelector(selector)!.dispatchEvent(
        new CustomEvent(name, { detail, bubbles: true, composed: true })
      );
    };

    it.each([
      ['v4-app-header', 'changelog-click'],
      ['v4-app-header', 'theme-click'],
      ['v4-app-header', 'about-click'],
      ['v4-app-header', 'language-click'],
      ['v4-app-header', 'advanced-click'],
      ['v4-config-sidebar', 'clear-all-dyes'],
      ['dye-palette-drawer', 'clear-all-dyes'],
    ])('%s %s', async (selector, name) => {
      stubViewport(false);
      const el = await mountShell();
      const heard = vi.fn();
      el.addEventListener(name, heard);

      fromChild(el, selector, name);

      expect(heard).toHaveBeenCalledTimes(1);
    });

    it('v4-config-sidebar config-change, detail intact', async () => {
      stubViewport(false);
      const el = await mountShell();
      const heard = vi.fn();
      el.addEventListener('config-change', heard);
      const detail = { tool: 'harmony', key: 'showHex', value: true };

      fromChild(el, 'v4-config-sidebar', 'config-change', detail);

      expect(heard).toHaveBeenCalledTimes(1);
      expect((heard.mock.calls[0][0] as CustomEvent).detail).toEqual(detail);
    });
  });

  /*
   * BUG-112 (2026-10-04 deep-dive): the shell had no print rules, so Ctrl+P
   * gave one clipped sheet — the 100vh, overflow-hidden host and the
   * content scroller cut the tool off, with the app bar, FABs and Options
   * column printed over it. styles/v4-layout.css can only reach the host;
   * the chrome lives in the shadow root, so the rules have to be here.
   */
  describe('print styles (BUG-112)', () => {
    async function printRules(): Promise<CSSStyleRule[]> {
      const { V4LayoutShell } = await import('../../v4/v4-layout-shell');
      const styles = V4LayoutShell.styles as unknown as Array<{ cssText: string }>;
      // Parsed through a throwaway <style> (jsdom gives a detached document's
      // sheet no CSSOM); its :host rules match nothing in the light DOM.
      const style = document.createElement('style');
      style.textContent = styles.map((s) => s.cssText).join('\n');
      document.head.appendChild(style);
      const media = [...style.sheet!.cssRules].filter((r) => 'media' in r) as CSSMediaRule[];
      style.remove();
      const print = media.find((r) => r.media.mediaText.trim() === 'print');
      expect(print, 'an @media print block in the shell styles').toBeDefined();
      return [...print!.cssRules] as CSSStyleRule[];
    }

    const selectorsOf = (rule: CSSStyleRule): string[] =>
      rule.selectorText.split(',').map((s) => s.trim());

    it('hides every piece of chrome', async () => {
      const rules = await printRules();
      const hidden = rules
        .filter((r) => r.style.getPropertyValue('display') === 'none')
        .flatMap(selectorsOf);

      for (const chrome of [
        'v4-app-header',
        'v4-config-sidebar',
        'dye-palette-drawer',
        '.v4-drawer-overlay',
        '.v4-palette-hint',
        '.v4-options-toggle',
        '.v4-palette-toggle',
      ]) {
        expect(hidden, chrome).toContain(chrome);
      }
      // The mobile block sets display:flex on the FAB and hint, and a print
      // page is narrower than its 768px breakpoint — so the hide must win.
      for (const r of rules.filter((x) => x.style.getPropertyValue('display') === 'none')) {
        expect(r.style.getPropertyPriority('display')).toBe('important');
      }
    });

    it('lets the host and every scroller grow with the content', async () => {
      const rules = await printRules();
      const flowing = rules.filter(
        (r) =>
          r.style.getPropertyValue('height') === 'auto' &&
          r.style.getPropertyValue('overflow') === 'visible'
      );
      const selectors = flowing.flatMap(selectorsOf);

      for (const box of [
        ':host',
        '.v4-layout-main',
        '.v4-layout-content',
        '.v4-layout-content-scroll',
        // v4-layout.ts gives the tool's main panel an INLINE overflow-y:auto,
        // which only an !important rule can override
        '.v4-tool-main',
      ]) {
        expect(selectors, box).toContain(box);
      }
      for (const r of flowing) {
        expect(r.style.getPropertyPriority('overflow')).toBe('important');
      }
    });

    /*
     * The two tests above check the CSS against a list typed out here, so a
     * class renamed in the shell's template or in v4-layout.ts would leave
     * them green while print clipped again. This one ties every print
     * selector to a node the shell really renders.
     */
    it('names only boxes and chrome the shell really renders', async () => {
      // Mobile, first run, a tool with both panels: every piece of chrome is up
      stubViewport(true);
      const el = await mountShell('harmony');
      const root = el.shadowRoot!;

      // The tool's panels as v4-layout.ts builds them: they replace the
      // scroller's children inside this shadow root, not the slotted light DOM
      const toolContainer = document.createElement('div');
      toolContainer.className = 'v4-tool-container';
      const mainPanel = document.createElement('div');
      mainPanel.className = 'v4-tool-main';
      toolContainer.appendChild(mainPanel);
      root.querySelector('.v4-layout-content-scroll')!.replaceChildren(toolContainer);

      const selectors = (await printRules()).flatMap(selectorsOf);
      expect(selectors.length).toBeGreaterThan(0);
      for (const selector of selectors) {
        // :host is the shell element itself, which a query of its own shadow
        // root can never return
        const matched = selector === ':host' ? [root.host] : [...root.querySelectorAll(selector)];
        expect(matched.length, `${selector} matches nothing in the shadow root`).toBeGreaterThan(0);
      }
    });
  });
});
