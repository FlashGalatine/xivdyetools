/**
 * Export sheet — the shared 16A surface for "give me this palette as text".
 *
 * Opened by Extractor, Gradient, Comparison and Mixer. Copy is the primary
 * action, not Download: a palette snippet is nearly always on its way into a
 * stylesheet that is already open, and the old download-only export made you
 * detour through the filesystem to get there.
 *
 * Deliberately a plain function rather than a BaseComponent — it owns no
 * persistent state and lives exactly as long as the modal does. All formatting
 * is in `@shared/palette-export`, which is pure and unit-tested.
 *
 * @module components/export-sheet
 */

import { LanguageService } from '@services/language-service';
import { ModalService } from '@services/modal-service';
import { ToastService } from '@services/toast-service';
import { logger } from '@shared/logger';
import { localizedDyeName } from '@shared/dye-name';
import {
  EXPORT_FORMATS,
  EXPORT_FORMAT_LABELS,
  exportFilename,
  exportMimeType,
  generateExport,
  type ExportFormat,
  type ExportLabels,
  type ExportPayload,
} from '@shared/palette-export';

/**
 * App-locale strings for the generated text. Built here rather than in
 * `@shared/palette-export` so that module stays pure and service-free.
 */
function exportLabels(): ExportLabels {
  return {
    generatedLine: (date, count) =>
      count === 1
        ? LanguageService.tInterpolate('export.generatedLineOne', { date, n: String(count) })
        : LanguageService.tInterpolate('export.generatedLine', { date, n: String(count) }),
    sourceHeader: LanguageService.t('export.hexSourceHeader'),
    dyesHeader: LanguageService.t('export.hexDyesHeader'),
  };
}

const CHIP_BASE = [
  'min-height: 30px; padding: 0 12px; border-radius: 8px; cursor: pointer;',
  'font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.6px;',
].join(' ');

function chipStyle(active: boolean): string {
  return active
    ? `${CHIP_BASE} background: var(--theme-primary); color: #ffffff; border: 1px solid var(--theme-primary);`
    : `${CHIP_BASE} background: var(--theme-card-background); color: var(--theme-text-muted); border: 1px solid var(--theme-border);`;
}

function downloadText(payload: ExportPayload, format: ExportFormat, text: string): void {
  const blob = new Blob([text], { type: exportMimeType(format) });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFilename(payload, format);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ToastService.success(LanguageService.t('export.copied'));
  } catch (error) {
    // Clipboard API needs a secure context and can be policy-blocked; the
    // textarea path still works in both cases.
    logger.warn('[ExportSheet] Clipboard API unavailable, using fallback', error);
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      ToastService.success(LanguageService.t('export.copied'));
    } catch (fallbackError) {
      logger.error('[ExportSheet] Copy failed', fallbackError);
      ToastService.error(LanguageService.t('export.copyFailed'));
    }
    document.body.removeChild(textarea);
  }
}

/**
 * Open the export sheet for a payload. No-ops with a toast when the tool has
 * nothing to export yet, so every caller can wire the action unconditionally.
 */
export function openExportSheet(input: ExportPayload): void {
  if (input.entries.length === 0) {
    ToastService.error(LanguageService.t('export.nothing'));
    return;
  }

  // The generators are pure and service-free, so the locale-aware name lookup
  // and the header/column strings are injected here — the one place an export
  // meets the running app. Every caller gets localized dye names and headers in
  // the commented formats for free; the JSON format keeps the canonical English
  // name (and no prose) regardless.
  const payload: ExportPayload = {
    ...input,
    nameOf: input.nameOf ?? localizedDyeName,
    labels: input.labels ?? exportLabels(),
  };

  // Mutable across the sheet's life: the footer's Copy handler runs long after
  // show(), and must read the format the user has since switched to.
  let format: ExportFormat = 'css';

  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

  const switcher = document.createElement('div');
  switcher.style.cssText = 'display: flex; align-items: center; gap: 6px; flex-wrap: wrap;';

  const preview = document.createElement('pre');
  preview.setAttribute('aria-live', 'polite');
  preview.style.cssText = [
    'margin: 0; padding: 12px; border-radius: 10px; max-height: 320px;',
    'overflow: auto; white-space: pre; tab-size: 2;',
    'font-family: var(--font-mono); font-size: 11.5px; line-height: 1.55;',
    'background: var(--theme-background-secondary, var(--theme-card-background));',
    'border: 1px solid var(--theme-border); color: var(--theme-text);',
  ].join(' ');

  const chips = new Map<ExportFormat, HTMLButtonElement>();
  const paint = (): void => {
    preview.textContent = generateExport(payload, format);
    for (const [key, chip] of chips) {
      chip.setAttribute('style', chipStyle(key === format));
      chip.setAttribute('aria-pressed', String(key === format));
    }
  };

  for (const key of EXPORT_FORMATS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = EXPORT_FORMAT_LABELS[key];
    chip.setAttribute('style', chipStyle(key === format));
    chip.addEventListener('click', () => {
      format = key;
      paint();
    });
    chips.set(key, chip);
    switcher.appendChild(chip);
  }

  const spacer = document.createElement('div');
  spacer.style.cssText = 'flex: 1;';
  switcher.appendChild(spacer);

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.textContent = LanguageService.t('export.download');
  downloadBtn.setAttribute(
    'style',
    [
      'background: none; border: none; cursor: pointer; padding: 0;',
      'color: var(--theme-primary); font-size: 12px; font-weight: 600;',
      'text-transform: uppercase; letter-spacing: 0.5px; font-family: inherit;',
    ].join(' ')
  );
  downloadBtn.addEventListener('click', () => {
    downloadText(payload, format, generateExport(payload, format));
  });
  switcher.appendChild(downloadBtn);

  content.appendChild(switcher);
  content.appendChild(preview);
  paint();

  ModalService.show({
    type: 'custom',
    title: LanguageService.t('export.title'),
    subtitle: LanguageService.t('export.subtitle'),
    eyebrow: payload.title,
    content,
    variant: 'sheet',
    sheetHeight: 'tall',
    closable: true,
    closeOnBackdrop: true,
    closeOnEscape: true,
    cancelText: LanguageService.t('common.close'),
    confirmText: LanguageService.t('export.copy'),
    onConfirm: () => {
      void copyText(generateExport(payload, format));
    },
  });
}
