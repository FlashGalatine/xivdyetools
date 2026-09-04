/**
 * Advanced Options slide-over (the header gear surface).
 *
 * The panel is a build-once DOM tree handed to `ModalService.show` as
 * `content`, so every assertion here works by reaching into that captured
 * element and clicking the real rows — there is no shadow root and no Lit
 * lifecycle to await.
 *
 * The load-bearing test is `reads the toggle value at CLICK time, not at build
 * time` (BUG-079): the rows used to capture `checked` as a boolean when the
 * panel was built, so a reset or an import performed from the same open panel
 * made the next tap write the negation of a value the user was no longer
 * looking at. If `toggleRow` ever goes back to a captured boolean, that test
 * is the one that fails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockShow,
  mockShowConfirm,
  mockResetAllConfigs,
  mockExportAllConfigs,
  mockImportConfigs,
  mockGetConfig,
  mockSetConfig,
  mockClearFavorites,
  mockDeleteCollectionsByKind,
  mockResetAllCompletions,
  mockGetCurrentToolId,
  mockSubscribe,
  mockUnsubscribe,
} = vi.hoisted(() => ({
  mockShow: vi.fn().mockReturnValue('modal-adv-1'),
  mockShowConfirm: vi.fn().mockReturnValue('modal-confirm-1'),
  mockResetAllConfigs: vi.fn(),
  mockExportAllConfigs: vi.fn(),
  mockImportConfigs: vi.fn(),
  mockGetConfig: vi.fn(),
  mockSetConfig: vi.fn(),
  mockClearFavorites: vi.fn(),
  mockDeleteCollectionsByKind: vi.fn().mockReturnValue(0),
  mockResetAllCompletions: vi.fn(),
  mockGetCurrentToolId: vi.fn().mockReturnValue('harmony'),
  mockSubscribe: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

vi.mock('@services/modal-service', () => ({
  ModalService: { show: mockShow, showConfirm: mockShowConfirm, dismiss: vi.fn() },
}));
vi.mock('@services/language-service', () => ({
  LanguageService: { t: (k: string) => k },
}));
vi.mock('@services/tutorial-service', () => ({
  TutorialService: { resetAllCompletions: mockResetAllCompletions },
}));
vi.mock('@services/collection-service', () => ({
  CollectionService: {
    clearFavorites: mockClearFavorites,
    deleteCollectionsByKind: mockDeleteCollectionsByKind,
  },
}));
vi.mock('@services/config-controller', () => ({
  ConfigController: {
    getInstance: () => ({
      resetAllConfigs: mockResetAllConfigs,
      exportAllConfigs: mockExportAllConfigs,
      importConfigs: mockImportConfigs,
      getConfig: mockGetConfig,
      setConfig: mockSetConfig,
    }),
  },
}));
vi.mock('@services/router-service', () => ({
  RouterService: { getCurrentToolId: mockGetCurrentToolId, subscribe: mockSubscribe },
}));
// Registering the real <v4-config-sidebar> would drag in Lit and the whole
// config surface; the panel only ever sets two properties on it.
vi.mock('../v4/config-sidebar', () => ({}));

import { showAdvancedOptionsPanel } from '../advanced-options-panel';

// --- helpers ---------------------------------------------------------------

interface ShowArg {
  type: string;
  variant: string;
  panelWidth: number;
  title: string;
  eyebrow: string;
  content: HTMLElement;
  closable: boolean;
  closeOnBackdrop: boolean;
  closeOnEscape: boolean;
  onClose: () => void;
}

function lastShow(): ShowArg {
  return mockShow.mock.calls.at(-1)![0] as ShowArg;
}

function content(): HTMLElement {
  return lastShow().content;
}

/** The three collapsible section cards, in DOM order: Data, Backup, Behaviour. */
function sections(): { header: HTMLButtonElement; body: HTMLElement }[] {
  return [...content().querySelectorAll<HTMLElement>(':scope > div.rounded-xl')].map((card) => ({
    header: card.querySelector('button')!,
    body: card.querySelector<HTMLElement>('div.border-t')!,
  }));
}

/** Action/toggle rows inside a section body (the hidden file input is not a row). */
function rows(sectionIndex: number): HTMLButtonElement[] {
  return [...sections()[sectionIndex].body.querySelectorAll<HTMLButtonElement>(':scope > button')];
}

/** Run the confirm callback captured by the most recent showConfirm call. */
function confirmLast(): void {
  const cfg = mockShowConfirm.mock.calls.at(-1)![0] as { onConfirm: () => void };
  cfg.onConfirm();
}

function closePanel(): void {
  lastShow().onClose();
}

const advancedConfig = (
  over: Partial<{ performanceMode: boolean; analyticsEnabled: boolean }>
) => ({
  performanceMode: false,
  analyticsEnabled: false,
  ...over,
});

describe('showAdvancedOptionsPanel', () => {
  let host: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockShow.mockReturnValue('modal-adv-1');
    mockShowConfirm.mockReturnValue('modal-confirm-1');
    mockGetCurrentToolId.mockReturnValue('harmony');
    mockSubscribe.mockReturnValue(mockUnsubscribe);
    mockDeleteCollectionsByKind.mockReturnValue(0);
    mockGetConfig.mockReturnValue(advancedConfig({}));
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    // The module keeps a `panelModalId` singleton — release it or the next
    // test's show() is swallowed by the already-showing guard.
    if (mockShow.mock.calls.length > 0) closePanel();
    host.remove();
  });

  // --- modal wiring --------------------------------------------------------

  it('opens as a 392px right panel with the advanced-settings title', () => {
    showAdvancedOptionsPanel(host);

    const arg = lastShow();
    expect(arg.type).toBe('custom');
    expect(arg.variant).toBe('panel');
    expect(arg.panelWidth).toBe(392);
    expect(arg.title).toBe('config.advancedSettings');
    expect(arg.eyebrow).toBe('advanced.eyebrow');
    expect(arg.closable).toBe(true);
    expect(arg.closeOnBackdrop).toBe(true);
    expect(arg.closeOnEscape).toBe(true);
  });

  it('ignores a second call while the panel is already showing', () => {
    showAdvancedOptionsPanel(host);
    showAdvancedOptionsPanel(host);

    expect(mockShow).toHaveBeenCalledTimes(1);
  });

  it('reopens after close', () => {
    showAdvancedOptionsPanel(host);
    closePanel();

    showAdvancedOptionsPanel(host);
    expect(mockShow).toHaveBeenCalledTimes(2);
  });

  it('defaults the event host to document.body when no host is given', () => {
    const seen: string[] = [];
    const onReset = (): void => {
      seen.push('settings-reset');
    };
    document.body.addEventListener('settings-reset', onReset);

    showAdvancedOptionsPanel();
    rows(0)[0].click();
    confirmLast();

    document.body.removeEventListener('settings-reset', onReset);
    expect(seen).toEqual(['settings-reset']);
  });

  // --- section cards ------------------------------------------------------

  it('renders three sections with only Data open', () => {
    showAdvancedOptionsPanel(host);

    const s = sections();
    expect(s).toHaveLength(3);
    expect(s.map((x) => x.body.style.display)).toEqual(['flex', 'none', 'none']);
    expect(s.map((x) => x.header.getAttribute('aria-expanded'))).toEqual([
      'true',
      'false',
      'false',
    ]);
  });

  it('toggles a section body, its caret and its aria-expanded on header click', () => {
    showAdvancedOptionsPanel(host);
    const backup = sections()[1];
    const caret = backup.header.lastElementChild!;

    expect(caret.textContent).toBe('▸');

    backup.header.click();
    expect(backup.body.style.display).toBe('flex');
    expect(caret.textContent).toBe('▾');
    expect(backup.header.getAttribute('aria-expanded')).toBe('true');

    backup.header.click();
    expect(backup.body.style.display).toBe('none');
    expect(caret.textContent).toBe('▸');
    expect(backup.header.getAttribute('aria-expanded')).toBe('false');
  });

  // --- Data section: destructive resets ------------------------------------

  it.each([
    { idx: 0, confirmKey: 'config.resetSettingsConfirm', event: 'settings-reset' },
    { idx: 1, confirmKey: 'config.clearDyesConfirm', event: 'clear-all-dyes' },
    { idx: 2, confirmKey: 'config.clearFavoritesConfirm', event: 'favorites-cleared' },
    { idx: 3, confirmKey: 'config.clearPalettesConfirm', event: 'palettes-cleared' },
  ])(
    'row $idx asks for a destructive confirm before emitting $event',
    ({ idx, confirmKey, event }) => {
      showAdvancedOptionsPanel(host);
      const emitted = vi.fn();
      host.addEventListener(event, emitted);

      rows(0)[idx].click();

      // Nothing happens on the tap alone — the work is behind the confirm.
      expect(emitted).not.toHaveBeenCalled();
      const cfg = mockShowConfirm.mock.calls.at(-1)![0] as {
        destructive: boolean;
        confirmText: string;
        cancelText: string;
        content: HTMLElement;
      };
      expect(cfg.destructive).toBe(true);
      expect(cfg.confirmText).toBe('common.reset');
      expect(cfg.cancelText).toBe('common.cancel');
      expect(cfg.content.textContent).toBe(confirmKey);

      confirmLast();
      expect(emitted).toHaveBeenCalledTimes(1);
    }
  );

  it('routes each confirmed reset to its own service call', () => {
    showAdvancedOptionsPanel(host);

    rows(0)[0].click();
    confirmLast();
    expect(mockResetAllConfigs).toHaveBeenCalledTimes(1);

    rows(0)[2].click();
    confirmLast();
    expect(mockClearFavorites).toHaveBeenCalledTimes(1);

    rows(0)[3].click();
    confirmLast();
    expect(mockDeleteCollectionsByKind).toHaveBeenCalledWith('palette');
  });

  it('clears dyes through an event only — the panel owns no dye state', () => {
    showAdvancedOptionsPanel(host);

    rows(0)[1].click();
    confirmLast();

    expect(mockResetAllConfigs).not.toHaveBeenCalled();
    expect(mockClearFavorites).not.toHaveBeenCalled();
    expect(mockDeleteCollectionsByKind).not.toHaveBeenCalled();
  });

  it('resets the tutorial immediately, with no confirm step', () => {
    showAdvancedOptionsPanel(host);
    const emitted = vi.fn();
    host.addEventListener('tutorial-reset', emitted);

    rows(0)[4].click();

    expect(mockShowConfirm).not.toHaveBeenCalled();
    expect(mockResetAllCompletions).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('bubbles its events so a listener on an ancestor sees them', () => {
    showAdvancedOptionsPanel(host);
    const onBody = vi.fn();
    document.body.addEventListener('tutorial-reset', onBody);

    rows(0)[4].click();

    document.body.removeEventListener('tutorial-reset', onBody);
    expect(onBody).toHaveBeenCalledTimes(1);
  });

  // --- Backup section: export / import ------------------------------------

  describe('export', () => {
    let clickSpy: ReturnType<typeof vi.spyOn>;
    let createObjectURL: ReturnType<typeof vi.fn>;
    let revokeObjectURL: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // jsdom has no object-URL support and would try to navigate on click().
      createObjectURL = vi.fn().mockReturnValue('blob:settings');
      revokeObjectURL = vi.fn();
      Object.defineProperty(URL, 'createObjectURL', {
        writable: true,
        configurable: true,
        value: createObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        writable: true,
        configurable: true,
        value: revokeObjectURL,
      });
      clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });

    afterEach(() => {
      clickSpy.mockRestore();
    });

    it('downloads the exported configs as a dated JSON file', async () => {
      mockExportAllConfigs.mockReturnValue({ harmony: { count: 5 } });
      showAdvancedOptionsPanel(host);

      rows(1)[0].click();

      expect(mockExportAllConfigs).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
      expect(anchor.href).toBe('blob:settings');
      expect(anchor.download).toMatch(/^xivdyetools-settings-\d{4}-\d{2}-\d{2}\.json$/);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:settings');

      const blob = createObjectURL.mock.calls[0][0] as Blob;
      expect(blob.type).toBe('application/json');
      const parsed = JSON.parse(await blob.text()) as Record<string, unknown>;
      expect(parsed.type).toBe('xivdyetools-settings');
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.configs).toEqual({ harmony: { count: 5 } });
      expect(typeof parsed.exportedAt).toBe('string');
    });
  });

  describe('import', () => {
    function fileInput(): HTMLInputElement {
      return sections()[1].body.querySelector<HTMLInputElement>('input[type="file"]')!;
    }

    function attach(input: HTMLInputElement, file: File | null): void {
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: file ? [file] : [],
      });
    }

    /*
     * Not asserted here: the handler's `importInput.value = ''` reset (which
     * exists so re-picking the SAME file re-fires `change`). These tests attach
     * files with Object.defineProperty(input, 'files', …), which never
     * populates a jsdom file input's `value`, so `expect(input.value).toBe('')`
     * is true before the handler runs and stays true with the reset deleted —
     * it reads as coverage of that line while pinning nothing. Reaching it
     * needs a real file picker, i.e. E2E.
     */

    /** The change handler is async and fire-and-forget; drain the microtasks. */
    async function fireChange(input: HTMLInputElement): Promise<void> {
      input.dispatchEvent(new Event('change'));
      await vi.waitFor(() => {
        expect(mockImportConfigs.mock.calls.length + alertSpy.mock.calls.length).toBeGreaterThan(0);
      });
    }

    let alertSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      alertSpy = vi.fn();
      Object.defineProperty(window, 'alert', {
        writable: true,
        configurable: true,
        value: alertSpy,
      });
    });

    it('opens the hidden file picker when the import row is tapped', () => {
      showAdvancedOptionsPanel(host);
      const input = fileInput();
      const pick = vi.spyOn(input, 'click').mockImplementation(() => {});

      rows(1)[1].click();

      expect(pick).toHaveBeenCalledTimes(1);
      expect(input.hidden).toBe(true);
      expect(input.accept).toBe('.json');
    });

    it('applies a well-formed settings file and announces it', async () => {
      showAdvancedOptionsPanel(host);
      const emitted = vi.fn();
      host.addEventListener('settings-imported', emitted);
      const input = fileInput();
      attach(
        input,
        new File(
          [JSON.stringify({ type: 'xivdyetools-settings', configs: { mixer: { steps: 7 } } })],
          'settings.json',
          { type: 'application/json' }
        )
      );

      await fireChange(input);

      expect(mockImportConfigs).toHaveBeenCalledWith({ mixer: { steps: 7 } });
      expect(emitted).toHaveBeenCalledTimes(1);
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'a foreign export', body: '{"type":"something-else","configs":{}}' },
      { name: 'a settings file with no configs', body: '{"type":"xivdyetools-settings"}' },
      { name: 'unparseable JSON', body: 'not json at all' },
    ])('rejects $name without touching the config store', async ({ body }) => {
      showAdvancedOptionsPanel(host);
      const emitted = vi.fn();
      host.addEventListener('settings-imported', emitted);
      const input = fileInput();
      attach(input, new File([body], 'settings.json', { type: 'application/json' }));

      await fireChange(input);

      expect(mockImportConfigs).not.toHaveBeenCalled();
      expect(emitted).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('config.importError');
    });

    it('does nothing when the picker is dismissed with no file', () => {
      showAdvancedOptionsPanel(host);
      const input = fileInput();
      attach(input, null);

      input.dispatchEvent(new Event('change'));

      expect(mockImportConfigs).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  // --- Behaviour section: persisted toggles --------------------------------

  it('paints each toggle from the stored config', () => {
    mockGetConfig.mockReturnValue(advancedConfig({ performanceMode: true }));
    showAdvancedOptionsPanel(host);

    const [performance, analytics] = rows(2);
    expect(performance.getAttribute('role')).toBe('switch');
    expect(performance.getAttribute('aria-checked')).toBe('true');
    expect(analytics.getAttribute('aria-checked')).toBe('false');
    expect(performance.querySelector<HTMLElement>('span.absolute')!.style.left).toBe('19.5px');
    expect(analytics.querySelector<HTMLElement>('span.absolute')!.style.left).toBe('2.5px');
  });

  it.each([
    { idx: 0, field: 'performanceMode' },
    { idx: 1, field: 'analyticsEnabled' },
  ])('writes the negated $field on tap', ({ idx, field }) => {
    showAdvancedOptionsPanel(host);

    rows(2)[idx].click();

    expect(mockSetConfig).toHaveBeenCalledWith('advanced', { [field]: true });
  });

  it('reads the toggle value at CLICK time, not at build time (BUG-079)', () => {
    // Panel built while performanceMode is off...
    mockGetConfig.mockReturnValue(advancedConfig({ performanceMode: false }));
    showAdvancedOptionsPanel(host);
    const toggle = rows(2)[0];
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    // ...then an import/reset performed from this same open panel turns it on.
    mockGetConfig.mockReturnValue(advancedConfig({ performanceMode: true }));

    toggle.click();

    // A build-time capture would write `true` again (the negation of the stale
    // `false`); reading at click time correctly writes `false`.
    expect(mockSetConfig).toHaveBeenCalledWith('advanced', { performanceMode: false });
  });

  it('repaints the toggle from the store after the write lands', () => {
    const store = advancedConfig({ analyticsEnabled: false });
    mockGetConfig.mockReturnValue(store);
    mockSetConfig.mockImplementation((_key: string, patch: Record<string, boolean>) => {
      Object.assign(store, patch);
    });
    showAdvancedOptionsPanel(host);
    const toggle = rows(2)[1];

    toggle.click();

    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.querySelector<HTMLElement>('span.absolute')!.style.left).toBe('19.5px');
  });

  // --- the panel hosts settings ONLY, never the per-tool config surface ----

  /*
   * The panel used to embed a <v4-config-sidebar> on mobile. That component's
   * own `@media (max-width: 768px)` rule makes its :host
   * `position: fixed; left: 0; bottom: 0; z-index: 100`, so the embedded copy
   * escaped this modal and painted as a full-height layer underneath the
   * settings cards — Advanced Settings and the tool Options visibly stacked.
   * Per-tool config now lives in the shell behind its own bottom-left FAB.
   */
  describe('per-tool config surface', () => {
    function setViewport(mobile: boolean): void {
      vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
          ({
            matches: mobile && query === '(max-width: 768px)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as unknown as MediaQueryList
      );
    }

    it.each([
      ['mobile', true],
      ['desktop', false],
    ])('is never embedded on %s — three section cards, nothing else', (_label, mobile) => {
      setViewport(mobile);
      showAdvancedOptionsPanel(host);

      expect(content().querySelector('v4-config-sidebar')).toBeNull();
      expect(sections()).toHaveLength(3);
      expect(content().children).toHaveLength(3);
    });

    it('does not subscribe to route changes for a surface it no longer hosts', () => {
      setViewport(true);
      showAdvancedOptionsPanel(host);

      expect(mockSubscribe).not.toHaveBeenCalled();
    });
  });
});
