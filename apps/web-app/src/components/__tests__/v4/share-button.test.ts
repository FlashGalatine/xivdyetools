/**
 * Share button — behaviour, not shape.
 *
 * Every assertion here mounts the element, awaits `updateComplete` and reaches
 * into the shadow root, because the @click binding lives on the inner
 * <button>: a click dispatched on the HOST never reaches it. That is also why
 * the component exposes a public `share()` for the Shift+S shortcut, and the
 * two paths are asserted to behave identically (including the `disabled`
 * guard, which a caller reaching past the pointer path could otherwise skip).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockValidate, mockShareAndCopy, mockSubscribe, mockUnsubscribe, mockT } = vi.hoisted(
  () => ({
    mockValidate: vi.fn().mockReturnValue([]),
    mockShareAndCopy: vi.fn(),
    mockSubscribe: vi.fn(),
    mockUnsubscribe: vi.fn(),
    mockT: vi.fn((key: string) => key),
  })
);

vi.mock('@services/share-service', () => ({
  ShareService: { validateShareParams: mockValidate, shareAndCopy: mockShareAndCopy },
}));
vi.mock('@services/index', () => ({
  LanguageService: { t: mockT, subscribe: mockSubscribe },
}));

// Value-imported only for its side effect (`@customElement` registration) —
// a bare `import type` would be elided and the element would never upgrade.
import type { ShareButton } from '../../v4/share-button';
import { logger } from '@shared/logger';

const RESULT = {
  url: 'https://xivdyetools.app/harmony?dye=48227',
  title: 'Harmony',
  tool: 'harmony',
};

describe('ShareButton', () => {
  let el: ShareButton;

  async function mount(props: Partial<ShareButton> = {}): Promise<ShareButton> {
    await import('../../v4/share-button');
    el = document.createElement('v4-share-button') as ShareButton;
    Object.assign(el, props);
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  function button(): HTMLButtonElement {
    return el.shadowRoot!.querySelector('button')!;
  }

  function labelText(): string | null {
    return el.shadowRoot!.querySelector('.label')?.textContent ?? null;
  }

  /** CHECK_ICON is the only icon with a <polyline>; SHARE_ICON has circles. */
  function showsCheckIcon(): boolean {
    return el.shadowRoot!.querySelector('svg polyline') !== null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue([]);
    mockShareAndCopy.mockResolvedValue(RESULT);
    mockSubscribe.mockReturnValue(mockUnsubscribe);
    mockT.mockImplementation((key: string) => key);
  });

  afterEach(() => {
    el?.remove();
    vi.useRealTimers();
  });

  // --- rendering -----------------------------------------------------------

  it('renders the share icon and the localized label', async () => {
    await mount();

    expect(showsCheckIcon()).toBe(false);
    expect(el.shadowRoot!.querySelectorAll('svg circle')).toHaveLength(3);
    expect(labelText()).toBe('share.button');
    expect(button().title).toBe('share.button');
  });

  it('prefers a caller-supplied label over the default', async () => {
    await mount({ label: 'Copy link' });

    expect(labelText()).toBe('Copy link');
    expect(button().title).toBe('Copy link');
  });

  it('drops the text and names the button for screen readers in compact mode', async () => {
    await mount({ compact: true });

    expect(labelText()).toBeNull();
    expect(button().getAttribute('aria-label')).toBe('share.button');
  });

  it('leaves aria-label off when the text is already visible', async () => {
    await mount();

    expect(button().hasAttribute('aria-label')).toBe(false);
  });

  it('reflects compact and disabled onto the host so CSS can hook them', async () => {
    await mount({ compact: true, disabled: true });

    expect(el.hasAttribute('compact')).toBe(true);
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(button().disabled).toBe(true);
  });

  // --- the happy path ------------------------------------------------------

  it('validates, copies, and flips to the copied state on click', async () => {
    await mount({ tool: 'harmony', shareParams: { dye: 48227 } });

    button().click();
    await vi.waitFor(() => expect(mockShareAndCopy).toHaveBeenCalled());
    await el.updateComplete;

    expect(mockValidate).toHaveBeenCalledWith({ tool: 'harmony', params: { dye: 48227 } });
    expect(mockShareAndCopy).toHaveBeenCalledWith({ tool: 'harmony', params: { dye: 48227 } });
    expect(button().classList.contains('copied')).toBe(true);
    expect(showsCheckIcon()).toBe(true);
    expect(labelText()).toBe('share.copied');
  });

  it('emits share with the generated url, title and tool', async () => {
    await mount();
    const events: CustomEvent[] = [];
    el.addEventListener('share', (e) => events.push(e as CustomEvent));

    button().click();
    await vi.waitFor(() => expect(events).toHaveLength(1));

    expect(events[0].detail).toEqual(RESULT);
    // composed:true is what lets a listener outside the shadow tree hear it.
    expect(events[0].composed).toBe(true);
    expect(events[0].bubbles).toBe(true);
  });

  it('returns to the share icon 2s later', async () => {
    vi.useFakeTimers();
    await mount();

    button().click();
    await vi.waitFor(() => expect(mockShareAndCopy).toHaveBeenCalled());
    await el.updateComplete;
    expect(button().classList.contains('copied')).toBe(true);

    vi.advanceTimersByTime(2000);
    await el.updateComplete;

    expect(button().classList.contains('copied')).toBe(false);
    expect(labelText()).toBe('share.button');
  });

  it('restarts the 2s window on a second successful share', async () => {
    vi.useFakeTimers();
    await mount();

    button().click();
    await vi.waitFor(() => expect(mockShareAndCopy).toHaveBeenCalledTimes(1));
    vi.advanceTimersByTime(1500);

    button().click();
    await vi.waitFor(() => expect(mockShareAndCopy).toHaveBeenCalledTimes(2));
    // 1500 + 1000 = 2500ms since the FIRST share; the restarted timer has not fired.
    vi.advanceTimersByTime(1000);
    await el.updateComplete;

    expect(button().classList.contains('copied')).toBe(true);
  });

  // --- refusals ------------------------------------------------------------

  it('does nothing at all when disabled', async () => {
    await mount({ disabled: true });

    // `HTMLElement.click()` returns early for a disabled form control in jsdom,
    // so it would prove nothing about the guard — the event has to be
    // dispatched, which DOES reach a listener on a disabled element. Removing
    // `this.disabled ||` from handleShare's guard reds this test.
    button().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await el.updateComplete;

    expect(mockValidate).not.toHaveBeenCalled();
    expect(mockShareAndCopy).not.toHaveBeenCalled();
  });

  it('stops before copying when the params do not validate', async () => {
    mockValidate.mockReturnValue(['dye is required', 'harmony is required']);
    await mount();
    const onShare = vi.fn();
    el.addEventListener('share', onShare);

    button().click();
    await vi.waitFor(() => expect(mockValidate).toHaveBeenCalled());
    await el.updateComplete;

    expect(mockShareAndCopy).not.toHaveBeenCalled();
    expect(onShare).not.toHaveBeenCalled();
    expect(button().classList.contains('copied')).toBe(false);
    // isLoading must be released, or the button stays inert forever.
    expect(button().classList.contains('loading')).toBe(false);
  });

  it('stays quiet when the copy silently fails (null result)', async () => {
    mockShareAndCopy.mockResolvedValue(null);
    await mount();
    const onShare = vi.fn();
    el.addEventListener('share', onShare);

    button().click();
    await vi.waitFor(() => expect(mockShareAndCopy).toHaveBeenCalled());
    await el.updateComplete;

    expect(onShare).not.toHaveBeenCalled();
    expect(button().classList.contains('copied')).toBe(false);
    expect(button().classList.contains('loading')).toBe(false);
  });

  it('records the error and releases the loading state when sharing throws', async () => {
    mockShareAndCopy.mockRejectedValue(new Error('clipboard exploded'));
    await mount();

    button().click();
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());
    await el.updateComplete;

    expect(button().classList.contains('loading')).toBe(false);
    expect(button().classList.contains('copied')).toBe(false);
  });

  it('ignores a second click while the first share is still in flight', async () => {
    let release: (v: typeof RESULT) => void = () => {};
    mockShareAndCopy.mockReturnValue(
      new Promise<typeof RESULT>((resolve) => {
        release = resolve;
      })
    );
    await mount();

    button().click();
    await el.updateComplete;
    button().click();
    button().click();

    expect(mockShareAndCopy).toHaveBeenCalledTimes(1);
    release(RESULT);
    await vi.waitFor(() => expect(button().classList.contains('copied')).toBe(true));
  });

  // --- the Shift+S entry point ---------------------------------------------

  it('shares through the public share() method, as the shortcut does', async () => {
    await mount({ tool: 'mixer', shareParams: { dyeA: 1, dyeB: 2 } });

    el.share();
    await vi.waitFor(() => expect(mockShareAndCopy).toHaveBeenCalled());

    expect(mockShareAndCopy).toHaveBeenCalledWith({
      tool: 'mixer',
      params: { dyeA: 1, dyeB: 2 },
    });
  });

  it('honours disabled through share() too, not just the pointer path', async () => {
    await mount({ disabled: true });

    el.share();
    await el.updateComplete;

    expect(mockShareAndCopy).not.toHaveBeenCalled();
  });

  it('cannot be triggered by clicking the host — the binding is shadow-side', async () => {
    await mount();

    el.click();
    await el.updateComplete;

    expect(mockShareAndCopy).not.toHaveBeenCalled();
  });

  // --- lifecycle -----------------------------------------------------------

  it('re-renders its label when the language changes', async () => {
    await mount();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    const notify = mockSubscribe.mock.calls[0][0] as () => void;

    mockT.mockImplementation((key: string) => `ja:${key}`);
    notify();
    await el.updateComplete;

    expect(labelText()).toBe('ja:share.button');
  });

  it('drops the language subscription on unmount', async () => {
    await mount();

    el.remove();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending copied-state timer on unmount', async () => {
    vi.useFakeTimers();
    const setSpy = vi.spyOn(globalThis, 'setTimeout');
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    await mount();
    button().click();
    await vi.waitFor(() => expect(mockShareAndCopy).toHaveBeenCalled());

    // The copied-state timer is the 2000ms one; grab the id the component got.
    const timerId = setSpy.mock.results.at(-1)!.value as unknown;

    // Everything above also calls clearTimeout — vi.waitFor tears down its own
    // interval under fake timers — so the spy has to be reset here or the
    // assertion passes with the component's guard deleted.
    clear.mockClear();
    el.remove();

    expect(clear).toHaveBeenCalledWith(timerId);
    clear.mockRestore();
    setSpy.mockRestore();
  });

  it('survives an unmount with no share ever attempted', async () => {
    await mount();

    expect(() => el.remove()).not.toThrow();
  });
});
