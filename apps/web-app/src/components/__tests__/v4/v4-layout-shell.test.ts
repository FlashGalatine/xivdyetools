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
   * The desktop Simple-Settings column's × emits `sidebar-collapse`. Nothing
   * used to handle it — the click was a no-op — and the console-bar gear
   * (the one settings affordance in the app bar) only ever opened the
   * Advanced Options slide-over. The 2B/3A console design has the gear toggle
   * the settings surface: × hides the column, the gear brings it back.
   */
  describe('Simple-Settings column (desktop)', () => {
    const column = (el: ShellEl) => el.shadowRoot!.querySelector('v4-config-sidebar');
    const header = (el: ShellEl) => el.shadowRoot!.querySelector('v4-app-header')!;

    it('is visible on mount', async () => {
      stubViewport(false);
      const el = await mountShell();

      expect(column(el)).not.toBeNull();
      expect(column(el)!.hasAttribute('collapsed')).toBe(false);
    });

    it('the × (sidebar-collapse) hides the column', async () => {
      stubViewport(false);
      const el = await mountShell();

      column(el)!.dispatchEvent(
        new CustomEvent('sidebar-collapse', { bubbles: true, composed: true })
      );
      await el.updateComplete;

      expect(column(el)!.hasAttribute('collapsed')).toBe(true);
    });

    it('the console-bar gear brings a collapsed column back instead of opening the slide-over', async () => {
      stubViewport(false);
      const el = await mountShell();
      const advancedClicks = vi.fn();
      el.addEventListener('advanced-click', advancedClicks);

      column(el)!.dispatchEvent(
        new CustomEvent('sidebar-collapse', { bubbles: true, composed: true })
      );
      await el.updateComplete;
      expect(column(el)!.hasAttribute('collapsed')).toBe(true);

      header(el).dispatchEvent(new CustomEvent('advanced-click'));
      await el.updateComplete;

      expect(column(el)!.hasAttribute('collapsed')).toBe(false);
      // Restoring the column IS the gear's action here — the Advanced Options
      // slide-over must not pop up on top of it as well.
      expect(advancedClicks).not.toHaveBeenCalled();
    });

    it('the gear still opens the Advanced Options slide-over while the column is visible', async () => {
      stubViewport(false);
      const el = await mountShell();
      const advancedClicks = vi.fn();
      el.addEventListener('advanced-click', advancedClicks);

      header(el).dispatchEvent(new CustomEvent('advanced-click'));
      await el.updateComplete;

      expect(column(el)!.hasAttribute('collapsed')).toBe(false);
      expect(advancedClicks).toHaveBeenCalledTimes(1);
    });

    it('on mobile the gear always reaches the slide-over (there is no column)', async () => {
      stubViewport(true);
      const el = await mountShell();
      const advancedClicks = vi.fn();
      el.addEventListener('advanced-click', advancedClicks);

      expect(column(el)).toBeNull();
      header(el).dispatchEvent(new CustomEvent('advanced-click'));
      await el.updateComplete;

      expect(advancedClicks).toHaveBeenCalledTimes(1);
    });
  });
});
