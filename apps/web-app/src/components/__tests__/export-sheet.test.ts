/**
 * Export sheet — the shared "give me this palette as text" surface.
 *
 * `@shared/palette-export` is left UNMOCKED on purpose: it is pure and already
 * unit-tested, so letting it run makes the preview text and the copied text
 * real strings rather than a stand-in, and the format-switch assertions
 * compare against what the generator actually produces.
 *
 * The load-bearing test is `copies the format the user switched to, not the
 * one the sheet opened on`. The footer's Copy handler runs long after
 * `ModalService.show`, so `format` has to stay mutable and be re-read inside
 * `onConfirm`; capturing it at show() time is the regression this catches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EXPORT_FORMATS,
  EXPORT_FORMAT_LABELS,
  exportFilename,
  exportMimeType,
  generateExport,
  type ExportFormat,
  type ExportPayload,
} from '@shared/palette-export';
import type { Dye } from '@xivdyetools/types';

const { mockShow, mockSuccess, mockError, mockT, mockTInterpolate, mockLocalizedDyeName } =
  vi.hoisted(() => ({
    mockShow: vi.fn().mockReturnValue('modal-export-1'),
    mockSuccess: vi.fn(),
    mockError: vi.fn(),
    mockT: vi.fn((key: string) => key),
    mockTInterpolate: vi.fn(
      (key: string, params: Record<string, string>) => `${key}|${params.date}|${params.n}`
    ),
    mockLocalizedDyeName: vi.fn(() => 'LOCALIZED'),
  }));

vi.mock('@services/modal-service', () => ({ ModalService: { show: mockShow, dismiss: vi.fn() } }));
vi.mock('@services/language-service', () => ({
  LanguageService: { t: mockT, tInterpolate: mockTInterpolate },
}));
vi.mock('@services/toast-service', () => ({
  ToastService: { success: mockSuccess, error: mockError },
}));
vi.mock('@shared/dye-name', () => ({ localizedDyeName: mockLocalizedDyeName }));

import { openExportSheet } from '../export-sheet';
import { logger } from '@shared/logger';

// --- fixtures --------------------------------------------------------------

const dye = (name: string, hex: string, itemID: number): Dye =>
  ({ name, hex, itemID, stainID: itemID }) as unknown as Dye;

function payloadOf(entryCount = 2): ExportPayload {
  return {
    tool: 'gradient',
    title: 'Gradient Builder',
    entries: Array.from({ length: entryCount }, (_, i) => ({
      key: `step-${i + 1}`,
      source: i === 0 ? '#112233' : '#445566',
      dye: dye(`Dye ${i + 1}`, i === 0 ? '#113322' : '#446655', 100 + i),
      delta: 1.5,
    })),
  };
}

// --- helpers ---------------------------------------------------------------

interface ShowArg {
  type: string;
  title: string;
  subtitle: string;
  eyebrow: string;
  content: HTMLElement;
  variant: string;
  sheetHeight: string;
  closable: boolean;
  closeOnBackdrop: boolean;
  closeOnEscape: boolean;
  cancelText: string;
  confirmText: string;
  onConfirm: () => void;
}

function lastShow(): ShowArg {
  return mockShow.mock.calls.at(-1)![0] as ShowArg;
}

function chips(): HTMLButtonElement[] {
  return [...lastShow().content.querySelectorAll<HTMLButtonElement>('button')].filter(
    (b) => b.textContent !== 'export.download'
  );
}

function chip(label: string): HTMLButtonElement {
  return chips().find((c) => c.textContent === label)!;
}

function downloadButton(): HTMLButtonElement {
  return [...lastShow().content.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent === 'export.download'
  )!;
}

function preview(): HTMLPreElement {
  return lastShow().content.querySelector('pre')!;
}

/**
 * The payload the sheet actually handed the generators, i.e. the caller's plus
 * the two injections `openExportSheet` makes: the locale-aware `nameOf` and the
 * app-locale `labels`. Mirrored here (rather than reaching into the module) so
 * an expected string can be generated independently and compared.
 */
function effectivePayload(entryCount = 2): ExportPayload {
  return {
    ...payloadOf(entryCount),
    nameOf: mockLocalizedDyeName,
    labels: {
      generatedLine: (date: string, count: number) =>
        mockTInterpolate(count === 1 ? 'export.generatedLineOne' : 'export.generatedLine', {
          date,
          n: String(count),
        }),
      sourceHeader: mockT('export.hexSourceHeader'),
      dyesHeader: mockT('export.hexDyesHeader'),
    },
  } as ExportPayload;
}

describe('openExportSheet', () => {
  let writeText: ReturnType<typeof vi.fn>;
  let execCommand: ReturnType<typeof vi.fn>;
  let anchorClick: ReturnType<typeof vi.spyOn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockShow.mockReturnValue('modal-export-1');
    mockT.mockImplementation((key: string) => key);
    mockTInterpolate.mockImplementation(
      (key: string, params: Record<string, string>) => `${key}|${params.date}|${params.n}`
    );
    mockLocalizedDyeName.mockImplementation(() => 'LOCALIZED');

    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: { writeText },
    });

    execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: execCommand,
    });

    createObjectURL = vi.fn().mockReturnValue('blob:export');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });

    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    anchorClick.mockRestore();
  });

  // --- guard ---------------------------------------------------------------

  it('refuses to open with nothing to export, and says so', () => {
    openExportSheet({ tool: 'mixer', title: 'Dye Mixer', entries: [] });

    expect(mockShow).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalledWith('export.nothing');
  });

  // --- modal wiring --------------------------------------------------------

  it('opens as a tall sheet with Copy as the primary action', () => {
    openExportSheet(payloadOf());

    const arg = lastShow();
    expect(arg.type).toBe('custom');
    expect(arg.variant).toBe('sheet');
    expect(arg.sheetHeight).toBe('tall');
    expect(arg.title).toBe('export.title');
    expect(arg.subtitle).toBe('export.subtitle');
    expect(arg.eyebrow).toBe('Gradient Builder');
    expect(arg.confirmText).toBe('export.copy');
    expect(arg.cancelText).toBe('common.close');
    expect(arg.closable).toBe(true);
    expect(arg.closeOnBackdrop).toBe(true);
    expect(arg.closeOnEscape).toBe(true);
  });

  it('announces preview changes to assistive tech', () => {
    openExportSheet(payloadOf());

    expect(preview().getAttribute('aria-live')).toBe('polite');
  });

  // --- format switcher -----------------------------------------------------

  it('renders one chip per format, in the declared order', () => {
    openExportSheet(payloadOf());

    expect(chips().map((c) => c.textContent)).toEqual(
      EXPORT_FORMATS.map((f) => EXPORT_FORMAT_LABELS[f])
    );
    expect(chips().every((c) => c.type === 'button')).toBe(true);
  });

  it('opens on CSS with only that chip pressed', () => {
    openExportSheet(payloadOf());

    expect(chip('CSS').getAttribute('aria-pressed')).toBe('true');
    for (const label of ['SCSS', 'JSON', 'HEX', 'Tailwind']) {
      expect(chip(label).getAttribute('aria-pressed')).toBe('false');
    }
    expect(preview().textContent).toBe(generateExport(effectivePayload(), 'css'));
  });

  it.each(EXPORT_FORMATS)('repaints the preview when %s is chosen', (format: ExportFormat) => {
    openExportSheet(payloadOf());

    chip(EXPORT_FORMAT_LABELS[format]).click();

    expect(preview().textContent).toBe(generateExport(effectivePayload(), format));
    expect(chip(EXPORT_FORMAT_LABELS[format]).getAttribute('aria-pressed')).toBe('true');
  });

  it('moves the pressed state off the previous chip', () => {
    openExportSheet(payloadOf());

    chip('JSON').click();

    expect(chip('JSON').getAttribute('aria-pressed')).toBe('true');
    expect(chip('CSS').getAttribute('aria-pressed')).toBe('false');
    expect(chips().filter((c) => c.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });

  it('gives the active chip the accent fill and the rest the card fill', () => {
    openExportSheet(payloadOf());

    expect(chip('CSS').getAttribute('style')).toContain('background: var(--theme-primary)');
    expect(chip('HEX').getAttribute('style')).toContain('background: var(--theme-card-background)');
  });

  // --- copy ----------------------------------------------------------------

  it('copies the CSS export through the clipboard API and confirms it', async () => {
    openExportSheet(payloadOf());

    lastShow().onConfirm();

    await vi.waitFor(() => expect(mockSuccess).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(generateExport(effectivePayload(), 'css'));
    expect(mockSuccess).toHaveBeenCalledWith('export.copied');
    expect(mockError).not.toHaveBeenCalled();
  });

  it('copies the format the user switched to, not the one the sheet opened on', async () => {
    openExportSheet(payloadOf());

    chip('Tailwind').click();
    lastShow().onConfirm();

    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toBe(generateExport(effectivePayload(), 'tailwind'));
    expect(copied).not.toBe(generateExport(effectivePayload(), 'css'));
  });

  it('falls back to a hidden textarea when the clipboard API rejects', async () => {
    writeText.mockRejectedValue(new Error('blocked by policy'));
    openExportSheet(payloadOf());

    lastShow().onConfirm();

    await vi.waitFor(() => expect(mockSuccess).toHaveBeenCalled());
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(mockSuccess).toHaveBeenCalledWith('export.copied');
    expect(logger.warn).toHaveBeenCalled();
    // The scratch textarea does not survive the copy.
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('reports a failure when the textarea fallback also fails', async () => {
    writeText.mockRejectedValue(new Error('no clipboard'));
    execCommand.mockImplementation(() => {
      throw new Error('execCommand disabled');
    });
    openExportSheet(payloadOf());

    lastShow().onConfirm();

    await vi.waitFor(() => expect(mockError).toHaveBeenCalled());
    expect(mockError).toHaveBeenCalledWith('export.copyFailed');
    expect(mockSuccess).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
    expect(document.querySelector('textarea')).toBeNull();
  });

  // --- download ------------------------------------------------------------

  it('downloads the current format with the right filename and MIME type', async () => {
    const p = payloadOf();
    openExportSheet(p);

    chip('HEX').click();
    downloadButton().click();

    expect(anchorClick).toHaveBeenCalledTimes(1);
    const anchor = anchorClick.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe(exportFilename(p, 'hex'));
    expect(anchor.href).toBe('blob:export');

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe(exportMimeType('hex'));
    expect(await blob.text()).toBe(generateExport(effectivePayload(), 'hex'));

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
    // The anchor is a throwaway — it must not be left in the document.
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('does not copy anything when Download is used', () => {
    openExportSheet(payloadOf());

    downloadButton().click();

    expect(writeText).not.toHaveBeenCalled();
  });

  // --- injected locale bits -------------------------------------------------

  it('resolves dye names through the app locale by default', () => {
    openExportSheet(payloadOf());

    expect(preview().textContent).toContain('LOCALIZED');
    expect(mockLocalizedDyeName).toHaveBeenCalled();
  });

  it("lets a caller's own nameOf win over the locale resolver", () => {
    openExportSheet({ ...payloadOf(), nameOf: () => 'CALLER-NAME' });

    expect(preview().textContent).toContain('CALLER-NAME');
    expect(preview().textContent).not.toContain('LOCALIZED');
    expect(mockLocalizedDyeName).not.toHaveBeenCalled();
  });

  it('picks the plural generated-line key for a multi-entry palette', () => {
    openExportSheet(payloadOf(2));

    expect(preview().textContent).toContain('export.generatedLine|');
    expect(mockTInterpolate).toHaveBeenCalledWith(
      'export.generatedLine',
      expect.objectContaining({ n: '2' })
    );
  });

  it('picks the singular generated-line key for a one-entry palette', () => {
    openExportSheet(payloadOf(1));

    expect(preview().textContent).toContain('export.generatedLineOne|');
    expect(mockTInterpolate).toHaveBeenCalledWith(
      'export.generatedLineOne',
      expect.objectContaining({ n: '1' })
    );
  });

  it('uses the injected column headers in the HEX format', () => {
    openExportSheet(payloadOf());

    chip('HEX').click();

    expect(preview().textContent).toContain('export.hexSourceHeader');
    expect(preview().textContent).toContain('export.hexDyesHeader');
  });

  it("lets a caller's own labels win over the app-locale ones", () => {
    openExportSheet({
      ...payloadOf(),
      labels: {
        generatedLine: () => 'CALLER-LINE',
        sourceHeader: 'CALLER-SRC',
        dyesHeader: 'CALLER-DYES',
      },
    });

    expect(preview().textContent).toContain('CALLER-LINE');
    expect(mockTInterpolate).not.toHaveBeenCalled();
  });
});
