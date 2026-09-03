/**
 * Language picker modal.
 *
 * The tiles apply on tap (like the theme picker) rather than on a confirm, so
 * the two behaviours worth pinning are: tapping a *different* locale awaits
 * `LanguageService.setLocale` before closing, and tapping the locale already
 * active writes nothing at all.
 *
 * `updateSelectedLanguage` reaches for `.language-modal-content` through
 * `document`, not through the element it built — so it only moves the check
 * mark once the real ModalService has attached the content. Tests that
 * exercise it attach the content by hand; one test covers the un-attached
 * early return, which is what happens if a language change lands after the
 * modal is torn down.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LOCALE_DISPLAY_INFO } from '@shared/constants';
import type { LocaleCode } from '@shared/i18n-types';

const { mockShow, mockDismiss, mockGetCurrentLocale, mockSetLocale, mockSubscribe, mockT } =
  vi.hoisted(() => ({
    mockShow: vi.fn().mockReturnValue('modal-lang-1'),
    mockDismiss: vi.fn(),
    mockGetCurrentLocale: vi.fn().mockReturnValue('en'),
    mockSetLocale: vi.fn().mockResolvedValue(undefined),
    mockSubscribe: vi.fn(),
    mockT: vi.fn((key: string) => key),
  }));

vi.mock('@services/modal-service', () => ({
  ModalService: { show: mockShow, dismiss: mockDismiss },
}));
vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: mockT,
    getCurrentLocale: mockGetCurrentLocale,
    setLocale: mockSetLocale,
    subscribe: mockSubscribe,
  },
}));

import { showLanguageModal } from '../../v4/language-modal';

// --- helpers ---------------------------------------------------------------

interface ShowArg {
  type: string;
  title: string;
  content: HTMLElement;
  closable: boolean;
  closeOnBackdrop: boolean;
  closeOnEscape: boolean;
  confirmText: string;
  onClose: () => void;
}

function lastShow(): ShowArg {
  return mockShow.mock.calls.at(-1)![0] as ShowArg;
}

function content(): HTMLElement {
  return lastShow().content;
}

function tiles(): HTMLButtonElement[] {
  return [...content().querySelectorAll<HTMLButtonElement>('[data-locale]')];
}

function tile(code: LocaleCode): HTMLButtonElement {
  return content().querySelector<HTMLButtonElement>(`[data-locale="${code}"]`)!;
}

function checkMark(code: LocaleCode): HTMLElement {
  return tile(code).querySelector<HTMLElement>('.check-mark')!;
}

/** The last listener handed to LanguageService.subscribe. */
function localeListener(): (locale: LocaleCode) => void {
  return mockSubscribe.mock.calls.at(-1)![0] as (locale: LocaleCode) => void;
}

/** Put the built content where `document.querySelector` can find it. */
function attachContent(): void {
  document.body.appendChild(content());
}

let unsubscribe: ReturnType<typeof vi.fn>;

describe('showLanguageModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribe = vi.fn();
    mockShow.mockReturnValue('modal-lang-1');
    mockGetCurrentLocale.mockReturnValue('en');
    mockSetLocale.mockResolvedValue(undefined);
    mockSubscribe.mockReturnValue(unsubscribe);
    mockT.mockImplementation((key: string) => key);
  });

  afterEach(() => {
    // The module keeps a singleton LanguageModal; release its modalId or the
    // next show() is swallowed by the already-showing guard.
    lastShow()?.onClose();
    document.querySelectorAll('.language-modal-content').forEach((el) => el.remove());
  });

  // --- modal wiring --------------------------------------------------------

  it('opens a custom modal whose footer says Done, not Confirm', () => {
    showLanguageModal();

    const arg = lastShow();
    expect(arg.type).toBe('custom');
    expect(arg.title).toBe('header.languageSelector');
    expect(arg.confirmText).toBe('common.done');
    expect(arg.closable).toBe(true);
    expect(arg.closeOnBackdrop).toBe(true);
    expect(arg.closeOnEscape).toBe(true);
  });

  it('ignores a second call while the modal is already showing', () => {
    showLanguageModal();
    showLanguageModal();

    expect(mockShow).toHaveBeenCalledTimes(1);
  });

  it('reopens after close, reusing the same singleton', () => {
    showLanguageModal();
    lastShow().onClose();

    showLanguageModal();

    expect(mockShow).toHaveBeenCalledTimes(2);
  });

  it('drops the language subscription when the modal closes', () => {
    showLanguageModal();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    lastShow().onClose();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes only once across a close and a reopen', () => {
    showLanguageModal();
    lastShow().onClose();
    lastShow().onClose(); // a stray second close must not re-fire cleanup

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  // --- grid contents -------------------------------------------------------

  it('renders one option per supported locale, as a labelled listbox', () => {
    showLanguageModal();

    const grid = content().querySelector('[role="listbox"]')!;
    expect(grid.getAttribute('aria-label')).toBe('header.languageOptions');
    expect(tiles().map((b) => b.getAttribute('data-locale'))).toEqual(
      LOCALE_DISPLAY_INFO.map((l) => l.code)
    );
    expect(tiles().every((b) => b.getAttribute('role') === 'option')).toBe(true);
  });

  it('prints each locale flag and native name', () => {
    showLanguageModal();

    for (const locale of LOCALE_DISPLAY_INFO) {
      const btn = tile(locale.code);
      expect(btn.querySelector('.text-2xl')!.textContent).toBe(locale.flag);
      expect(btn.querySelector('.text-sm')!.textContent).toBe(locale.name);
    }
  });

  it('marks only the current locale as selected', () => {
    mockGetCurrentLocale.mockReturnValue('ja');
    showLanguageModal();

    expect(tile('ja').getAttribute('aria-selected')).toBe('true');
    expect(checkMark('ja').style.display).toBe('flex');
    expect(tile('ja').style.boxShadow).toBe('0 0 0 2px var(--theme-primary)');
    expect(tile('ja').style.borderColor).toBe('var(--theme-primary)');

    for (const code of ['en', 'de', 'fr', 'ko', 'zh'] as LocaleCode[]) {
      expect(tile(code).getAttribute('aria-selected')).toBe('false');
      expect(checkMark(code).style.display).toBe('none');
      expect(tile(code).style.boxShadow).toBe('none');
      expect(tile(code).style.borderColor).toBe('var(--theme-border)');
    }
  });

  it('adds an exonym line under the native name', () => {
    mockT.mockImplementation((key: string) => (key === 'languages.de' ? 'German' : key));
    showLanguageModal();

    expect(tile('de').querySelector('.items-start .text-xs')!.textContent).toBe('German');
  });

  it('suppresses the exonym when it would just repeat the native name', () => {
    // Under `de`, `languages.de` translates to "Deutsch" — the same string the
    // tile already prints as its native name.
    mockT.mockImplementation((key: string) => (key === 'languages.de' ? 'Deutsch' : key));
    showLanguageModal();

    expect(tile('de').querySelector('.items-start .text-xs')).toBeNull();
    // Its neighbours, whose exonyms still differ, keep theirs.
    expect(tile('fr').querySelector('.items-start .text-xs')).not.toBeNull();
  });

  // --- applying a language -------------------------------------------------

  it('applies a different locale and then closes', async () => {
    mockGetCurrentLocale.mockReturnValue('en');
    showLanguageModal();

    tile('fr').click();

    await vi.waitFor(() => expect(mockDismiss).toHaveBeenCalled());
    expect(mockSetLocale).toHaveBeenCalledWith('fr');
    expect(mockDismiss).toHaveBeenCalledWith('modal-lang-1');
  });

  it('closes without writing when the current locale is re-tapped', async () => {
    mockGetCurrentLocale.mockReturnValue('ko');
    showLanguageModal();

    tile('ko').click();

    await vi.waitFor(() => expect(mockDismiss).toHaveBeenCalled());
    expect(mockSetLocale).not.toHaveBeenCalled();
  });

  it('closes on the Close button without writing a locale', () => {
    showLanguageModal();
    const closeBtn = content().querySelector<HTMLButtonElement>('.justify-center button')!;
    expect(closeBtn.textContent).toBe('common.close');

    closeBtn.click();

    expect(mockDismiss).toHaveBeenCalledWith('modal-lang-1');
    expect(mockSetLocale).not.toHaveBeenCalled();
  });

  it('dismisses at most once — a second close is a no-op', () => {
    showLanguageModal();
    const closeBtn = content().querySelector<HTMLButtonElement>('.justify-center button')!;

    closeBtn.click();
    closeBtn.click();

    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  // --- reacting to a language change ---------------------------------------

  it('moves the selection when the language changes underneath it', () => {
    mockGetCurrentLocale.mockReturnValue('en');
    showLanguageModal();
    attachContent();

    localeListener()('zh');

    expect(tile('zh').getAttribute('aria-selected')).toBe('true');
    expect(checkMark('zh').style.display).toBe('flex');
    expect(tile('zh').style.boxShadow).toBe('0 0 0 2px var(--theme-primary)');

    expect(tile('en').getAttribute('aria-selected')).toBe('false');
    expect(checkMark('en').style.display).toBe('none');
    expect(tile('en').style.boxShadow).toBe('none');
    expect(tile('en').style.borderColor).toBe('var(--theme-border)');
  });

  it('survives a language change arriving after the content is gone', () => {
    showLanguageModal();
    // Content was never attached (or the modal host has already torn it down).

    expect(() => localeListener()('de')).not.toThrow();
  });

  // --- hover affordances ---------------------------------------------------

  it('swaps the tile background on hover and back on leave', () => {
    showLanguageModal();
    const btn = tile('en');

    btn.dispatchEvent(new MouseEvent('mouseenter'));
    expect(btn.style.backgroundColor).toBe('var(--theme-card-hover)');

    btn.dispatchEvent(new MouseEvent('mouseleave'));
    expect(btn.style.backgroundColor).toBe('var(--theme-card-background)');
  });

  it('brightens the Close button on hover and clears the filter on leave', () => {
    showLanguageModal();
    const closeBtn = content().querySelector<HTMLButtonElement>('.justify-center button')!;

    closeBtn.dispatchEvent(new MouseEvent('mouseenter'));
    expect(closeBtn.style.filter).toBe('brightness(1.1)');

    closeBtn.dispatchEvent(new MouseEvent('mouseleave'));
    expect(closeBtn.style.filter).toBe('');
  });
});
