/**
 * The Glamour Reader's export sheet (design 2c): Copy list and Save .md
 * open a preview of the GPOSERS list you can edit before anything is copied
 * or saved.
 *
 * One field per piece: only the `Acquisition:` line is editable — slot, name
 * and dye lines come from the file and the twin pick, which keeps the output
 * in the template's exact shape. The line starts as api-worker's generated
 * GPOSERS line for the twin the list names; the player's edits are kept on
 * this device, keyed by the gear (`acquisition-edits`). A twin pick never
 * overwrites an edit: the row warns and offers the new source (spec G9).
 *
 * The Abridged toggle (remembered on this device) switches the whole sheet to
 * the shorter social-media form: the preview, the fields, Copy and Save. Each
 * Abridged line starts as the one source `glamour-abridged` picks from the full
 * line, and what is typed there is kept apart, word for word, so it never
 * touches the full form (`abridgedEditKey`).
 *
 * Mounted on document.body; Escape or Close dismisses it, and so does the
 * reader going away (GlamourBlock.destroy). It registers with ModalService
 * while it is up, so the global shortcuts stand down under it.
 *
 * @module components/glamour-sheet
 */

import { LanguageService, ModalService, StorageService, ToastService } from '@services/index';
import { MONO, SANS, amber, el, green, monoChip, tCount } from '@components/chara-ui';
import '@components/v4/toggle-switch-v4';
import { AcquisitionEdits, abridgedEditKey, type AcquisitionEdit } from '@shared/acquisition-edits';
import { copyRichTextToClipboard } from '@shared/clipboard';
import { STORAGE_PREFIX } from '@shared/constants';
import { downloadTextFile } from '@shared/download-file';
import { abridgeAcquisition } from '@shared/glamour-abridged';
import { logger } from '@shared/logger';
import {
  ACQUISITION_LABEL,
  GLAMOUR_ABRIDGED_FILENAME,
  GLAMOUR_MARKDOWN_FILENAME,
  OBTAINED_LABEL,
  buildGlamourHtml,
  buildGlamourMarkdown,
  buildGlamourPlainText,
  type GlamourListFormat,
  type GlamourMarkdownSlot,
} from '@shared/glamour-markdown';
import {
  glamourInputWithAcquisition,
  glamourSheetPieces,
  type GlamourListSource,
  type GlamourSheetPiece,
} from '@components/glamour-list-actions';

type RowState = 'filled' | 'edited' | 'blank';

const FORMAT_KEY = `${STORAGE_PREFIX}_glamour_list_format`;

/**
 * The format, when its storage write failed: it lives for the page only, as the
 * edits made in it do (`acquisition-edits`), and a write that works ends it.
 */
let pageOnlyFormat: GlamourListFormat | null = null;

let current: { root: HTMLElement; cleanup: () => void; opener: HTMLElement | null } | null = null;

/** Close the open sheet, if any, and give focus back to what opened it. */
export function closeGlamourSheet(): void {
  if (!current) return;
  const { root, cleanup, opener } = current;
  current = null;
  cleanup();
  root.remove();
  if (opener?.isConnected) opener.focus();
}

/**
 * The element that really has focus. Every tool renders inside the shell's
 * shadow root, so `document.activeElement` is the shell's host — and focusing
 * a host does nothing, which dropped focus to <body> on close.
 */
function deepActiveElement(): HTMLElement | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

function isPhone(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches;
}

/** The full form's line: the player's edit, else the generated line. */
function fullLine(piece: GlamourSheetPiece): string {
  const edit = AcquisitionEdits.get(piece.hash);
  return edit ? edit.text : (piece.generated ?? '');
}

/** The key this form's own edits are stored under. */
function ownKey(piece: GlamourSheetPiece, format: GlamourListFormat): string {
  return format === 'abridged' ? abridgedEditKey(piece.hash) : piece.hash;
}

/** The key of the edit that decides a row: Abridged's own when it has one, else the full one. */
function activeKey(piece: GlamourSheetPiece, format: GlamourListFormat): string {
  const key = ownKey(piece, format);
  return AcquisitionEdits.get(key) ? key : piece.hash;
}

function activeEdit(piece: GlamourSheetPiece, format: GlamourListFormat): AcquisitionEdit | null {
  return AcquisitionEdits.get(activeKey(piece, format));
}

/** The line a piece writes now. A blank edit is still an edit, in both forms. */
function lineOf(piece: GlamourSheetPiece, format: GlamourListFormat): string {
  if (format === 'full') return fullLine(piece);
  const edit = AcquisitionEdits.get(abridgedEditKey(piece.hash));
  return edit ? edit.text : abridgeAcquisition(fullLine(piece));
}

function stateOf(piece: GlamourSheetPiece, format: GlamourListFormat): RowState {
  if (activeEdit(piece, format)) return 'edited';
  return piece.generated ? 'filled' : 'blank';
}

/** The state chip's words. */
function stateLabel(state: RowState): string {
  return LanguageService.t(
    `glamour.sheet.state${state === 'filled' ? 'Filled' : state === 'edited' ? 'Edited' : 'Blank'}`
  );
}

/** Whether an edit was made against a different twin than the one the list names now. */
function editIsStale(edit: AcquisitionEdit | null, piece: GlamourSheetPiece): boolean {
  return edit !== null && piece.pickedItemId !== null && edit.baseItemId !== piece.pickedItemId;
}

function staleEdit(piece: GlamourSheetPiece, format: GlamourListFormat): boolean {
  return editIsStale(activeEdit(piece, format), piece);
}

/**
 * Off, and looking it, when there is nothing to write. A disabled button has
 * no other cue: the footer's buttons always say `cursor: pointer`.
 */
function setActionEnabled(button: HTMLButtonElement, enabled: boolean): void {
  button.disabled = !enabled;
  button.style.opacity = enabled ? '' : '0.5';
  button.style.cursor = enabled ? 'pointer' : 'not-allowed';
}

/** A plain button with its role, for the row warning and the footer. */
function roleButton(
  role: string,
  label: string,
  style: string,
  onClick: () => void
): HTMLButtonElement {
  const button = el('button', style, label) as HTMLButtonElement;
  button.type = 'button';
  button.dataset.role = role;
  button.addEventListener('click', onClick);
  return button;
}

/**
 * Open the sheet for the loaded glamour. `focus` names the action that opened
 * it; `opener` is what gets focus back on close — pass it, since a click does
 * not focus a button in every browser. Without it, whatever has focus now.
 */
export function openGlamourSheet(
  source: GlamourListSource,
  focus: 'copy' | 'save' = 'copy',
  opener?: HTMLElement | null
): void {
  closeGlamourSheet();
  // Read after closing: a sheet reopened over itself returns to ITS opener
  const returnTo = opener === undefined ? deepActiveElement() : opener;
  const pieces = glamourSheetPieces(source);
  const phone = isPhone();
  let format: GlamourListFormat =
    pageOnlyFormat ??
    (StorageService.getItem<string>(FORMAT_KEY) === 'abridged' ? 'abridged' : 'full');

  const root = el(
    'div',
    'position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.6); display: flex; align-items: flex-end; justify-content: center;'
  );
  root.dataset.role = 'glamour-sheet';
  root.addEventListener('click', (event) => {
    if (event.target === root) closeGlamourSheet();
  });

  const panel = el(
    'div',
    `display: flex; flex-direction: column; width: 100%; max-width: ${phone ? '100%' : '1040px'}; height: ${
      phone ? '100%' : 'calc(100% - 40px)'
    }; margin: 0 ${phone ? '0' : '16px'}; border-radius: ${phone ? '0' : '16px 16px 0 0'}; background: var(--theme-card-background); border: 1px solid var(--theme-border); box-shadow: 0 -20px 60px rgba(0,0,0,0.5); box-sizing: border-box; overflow: hidden;`
  );
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', LanguageService.t('glamour.sheet.title'));
  root.appendChild(panel);

  // Header: title, sub, counts, the Abridged toggle (its own strip on a phone), close
  const head = el(
    'div',
    'display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--theme-border);'
  );
  const titles = el(
    'span',
    'flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0;'
  );
  titles.appendChild(
    el(
      'span',
      `font-family: ${SANS}; font-size: 17px; font-weight: 700; color: var(--theme-text);`,
      LanguageService.t('glamour.sheet.title')
    )
  );
  titles.appendChild(
    el(
      'span',
      'font-size: 12px; color: var(--theme-text-muted);',
      tCount(pieces.length, 'glamour.sheet.sub_one', 'glamour.sheet.sub_other')
    )
  );
  head.appendChild(titles);
  const counts = el('span', 'display: flex; gap: 6px; flex-wrap: wrap;');
  counts.dataset.role = 'sheet-counts';
  head.appendChild(counts);
  // The toggle's own off-track fallback is nearly invisible on the Light card
  const toggle = el(
    'v4-toggle-switch',
    'flex-shrink: 0; --v4-toggle-bg: var(--theme-text-muted); --v4-toggle-bg-hover: color-mix(in srgb, var(--theme-text-muted) 80%, var(--theme-card-background));'
  ) as HTMLElementTagNameMap['v4-toggle-switch'];
  toggle.dataset.role = 'sheet-format';
  toggle.label = LanguageService.t('glamour.sheet.abridged');
  toggle.checked = format === 'abridged';
  if (!phone) head.appendChild(toggle);
  const close = el(
    'button',
    'flex-shrink: 0; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--theme-border); background: transparent; color: var(--theme-text); cursor: pointer; font-size: 16px;',
    '×'
  ) as HTMLButtonElement;
  close.type = 'button';
  close.setAttribute('aria-label', LanguageService.t('common.close'));
  close.addEventListener('click', () => closeGlamourSheet());
  head.appendChild(close);
  panel.appendChild(head);
  if (phone) {
    const strip = el(
      'div',
      'display: flex; justify-content: flex-end; padding: 8px 20px; border-bottom: 1px solid var(--theme-border);'
    );
    strip.appendChild(toggle);
    panel.appendChild(strip);
  }

  // Body: the rows, and (desktop) WHAT GETS COPIED beside them
  const body = el(
    'div',
    `flex: 1; min-height: 0; display: flex; ${phone ? 'flex-direction: column; overflow-y: auto;' : ''}`
  );
  const rows = el(
    'div',
    `flex: 1; min-width: 0; display: flex; flex-direction: column; ${phone ? '' : 'overflow-y: auto;'}`
  );
  const previewPane = el(
    'div',
    `${phone ? '' : 'width: 40%; flex-shrink: 0; border-left: 1px solid var(--theme-border); overflow-y: auto;'} padding: 14px 20px; display: flex; flex-direction: column; gap: 8px; background: var(--theme-background-secondary);`
  );
  previewPane.appendChild(
    el(
      'span',
      `font-family: ${MONO}; font-size: 9.5px; letter-spacing: 1.2px; color: var(--theme-text-muted);`,
      LanguageService.t('glamour.sheet.preview')
    )
  );
  const preview = el(
    'pre',
    `margin: 0; font-family: ${MONO}; font-size: 11px; line-height: 1.5; color: var(--theme-text); white-space: pre-wrap; overflow-wrap: anywhere;`
  );
  preview.dataset.role = 'sheet-preview';
  previewPane.appendChild(preview);
  body.appendChild(rows);
  body.appendChild(previewPane);
  panel.appendChild(body);

  const acquisition = (): Partial<Record<GlamourMarkdownSlot, string>> =>
    Object.fromEntries(pieces.map((p) => [p.slot, lineOf(p, format)]));
  const input = () => glamourInputWithAcquisition(source, acquisition());

  const refresh = (): void => {
    const text = buildGlamourPlainText(input(), format);
    preview.textContent = text;
    // Abridged has no header, so a list with no rows has nothing to copy or save
    setActionEnabled(save, text !== '');
    setActionEnabled(copy, text !== '');
    counts.replaceChildren();
    const tally = { filled: 0, edited: 0, blank: 0 };
    for (const piece of pieces) tally[stateOf(piece, format)]++;
    const chip = (n: number, key: string, fg: string): void => {
      if (n > 0)
        counts.appendChild(
          monoChip(
            LanguageService.tInterpolate(key, { n: String(n) }),
            fg,
            'var(--theme-background-secondary)'
          )
        );
    };
    chip(tally.filled, 'glamour.sheet.countFilled', green());
    chip(tally.edited, 'glamour.sheet.countEdited', 'var(--theme-primary)');
    chip(tally.blank, 'glamour.sheet.countBlank', 'var(--theme-text-muted)');
  };

  /**
   * Draw a row again after its warning's button was used. That button is gone
   * with the old row, so the new row takes focus: never <body> under an
   * aria-modal, and not the field, which would raise a phone's keyboard.
   */
  const redrawRow = (row: HTMLElement, piece: GlamourSheetPiece): void => {
    const next = renderRow(piece);
    next.tabIndex = -1;
    row.replaceWith(next);
    next.focus();
    refresh();
  };

  const renderRow = (piece: GlamourSheetPiece): HTMLElement => {
    const row = el(
      'div',
      'display: flex; flex-direction: column; gap: 6px; padding: 12px 20px; border-bottom: 1px solid var(--theme-border);'
    );
    row.dataset.role = 'sheet-row';
    row.dataset.slot = piece.slot;
    const top = el('div', 'display: flex; align-items: baseline; gap: 10px;');
    top.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 9px; letter-spacing: 0.8px; color: var(--theme-text-muted); text-transform: uppercase; white-space: nowrap;`,
        piece.label
      )
    );
    top.appendChild(
      el(
        'span',
        'flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--theme-text); overflow-wrap: anywhere;',
        piece.name ?? ''
      )
    );
    const state = stateOf(piece, format);
    const stateChip = monoChip(
      stateLabel(state),
      state === 'filled'
        ? green()
        : state === 'edited'
          ? 'var(--theme-primary)'
          : 'var(--theme-text-muted)',
      'transparent'
    );
    stateChip.dataset.role = 'sheet-state';
    top.appendChild(stateChip);
    row.appendChild(top);
    if (piece.dyes.length > 0) {
      row.appendChild(
        el('span', 'font-size: 10.5px; color: var(--theme-text-muted);', piece.dyes.join(' · '))
      );
    }

    const fieldRow = el('label', 'display: flex; align-items: flex-start; gap: 8px;');
    fieldRow.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 10.5px; color: var(--theme-text-muted); padding-top: 7px; white-space: nowrap;`,
        format === 'abridged' ? OBTAINED_LABEL : ACQUISITION_LABEL
      )
    );
    const field = document.createElement('textarea');
    field.rows = 1;
    field.value = lineOf(piece, format);
    field.placeholder = LanguageService.t('glamour.sheet.placeholder');
    field.style.cssText = `flex: 1; min-width: 0; resize: vertical; min-height: 32px; padding: 6px 9px; border-radius: 8px; font-family: ${SANS}; font-size: 12px; line-height: 1.4; color: var(--theme-text); background: var(--theme-background-secondary); border: 1px solid ${
      staleEdit(piece, format) ? amber() : 'var(--theme-border)'
    }; box-sizing: border-box;`;
    field.addEventListener('input', () => {
      const abridged = format === 'abridged';
      const key = ownKey(piece, format);
      const baseline = abridged ? abridgeAcquisition(fullLine(piece)) : (piece.generated ?? '');
      if (field.value === baseline) AcquisitionEdits.remove(key);
      else
        AcquisitionEdits.set(key, {
          text: field.value,
          baseItemId: piece.pickedItemId ?? 0,
        });
      stateChip.textContent = stateLabel(stateOf(piece, format));
      refresh();
    });
    fieldRow.appendChild(field);
    row.appendChild(fieldRow);

    if (staleEdit(piece, format)) {
      const warn = el(
        'div',
        `display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 7px 9px; border-radius: 8px; font-size: 11px; line-height: 1.4; color: var(--theme-text); background: color-mix(in srgb, ${amber()} 10%, transparent); border: 1px solid color-mix(in srgb, ${amber()} 35%, transparent);`
      );
      warn.dataset.role = 'sheet-warn';
      warn.appendChild(
        el(
          'span',
          'flex: 1; min-width: 180px;',
          LanguageService.tInterpolate('glamour.sheet.warn', { name: piece.pickedName ?? '' })
        )
      );
      const action = (role: string, key: string, onClick: () => void): HTMLButtonElement =>
        roleButton(
          role,
          LanguageService.t(key),
          `padding: 4px 9px; border-radius: 7px; font-family: ${SANS}; font-size: 11px; font-weight: 600; cursor: pointer; background: var(--theme-card-background); color: var(--theme-text); border: 1px solid var(--theme-border);`,
          onClick
        );
      warn.appendChild(
        action('sheet-keep', 'glamour.sheet.keep', () => {
          const key = activeKey(piece, format);
          const edit = AcquisitionEdits.get(key);
          if (edit) {
            AcquisitionEdits.set(key, { ...edit, baseItemId: piece.pickedItemId ?? 0 });
          }
          redrawRow(row, piece);
        })
      );
      warn.appendChild(
        action('sheet-use-new', 'glamour.sheet.useNew', () => {
          // This form's own key, not the active one: typing the baseline back removes
          // an Abridged edit and leaves the warning up, and that must not cost the full edit.
          AcquisitionEdits.remove(ownKey(piece, format));
          // A stale full edit under a removed Abridged one is not the new source
          // either; a fresh one is the line this row should fall back to.
          if (editIsStale(AcquisitionEdits.get(piece.hash), piece)) {
            AcquisitionEdits.remove(piece.hash);
          }
          redrawRow(row, piece);
        })
      );
      row.appendChild(warn);
    }
    return row;
  };
  for (const piece of pieces) rows.appendChild(renderRow(piece));

  const redrawRows = (): void => {
    rows.replaceChildren(...pieces.map(renderRow));
    refresh();
  };

  toggle.addEventListener('toggle-change', () => {
    format = toggle.checked ? 'abridged' : 'full';
    pageOnlyFormat = StorageService.setItem(FORMAT_KEY, format) ? null : format;
    redrawRows();
  });

  // Footer: what is kept, Reset all, Save .md, Copy list
  const foot = el(
    'div',
    'display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 20px; border-top: 1px solid var(--theme-border);'
  );
  foot.appendChild(
    el(
      'span',
      'flex: 1; min-width: 220px; font-size: 11px; line-height: 1.4; color: var(--theme-text-muted);',
      LanguageService.t('glamour.sheet.privacy')
    )
  );
  const button = (
    role: string,
    label: string,
    primary: boolean,
    onClick: () => void
  ): HTMLButtonElement =>
    roleButton(
      role,
      label,
      `min-height: 34px; padding: 0 14px; border-radius: 9px; font-family: ${SANS}; font-size: 12px; font-weight: 600; cursor: pointer; ${
        primary
          ? 'background: var(--theme-primary); color: #fff; border: 1px solid var(--theme-primary);'
          : 'background: var(--theme-card-background); color: var(--theme-text); border: 1px solid var(--theme-border);'
      }`,
      onClick
    );
  foot.appendChild(
    button('sheet-reset', LanguageService.t('glamour.sheet.reset'), false, () => {
      AcquisitionEdits.resetAll(pieces.flatMap((p) => [p.hash, abridgedEditKey(p.hash)]));
      redrawRows();
    })
  );
  const save = button('sheet-save', LanguageService.t('glamour.sheet.save'), false, () => {
    try {
      downloadTextFile(
        buildGlamourMarkdown(input(), format),
        format === 'abridged' ? GLAMOUR_ABRIDGED_FILENAME : GLAMOUR_MARKDOWN_FILENAME,
        'text/markdown'
      );
    } catch {
      // A fixed message: the error's text never reaches the log.
      logger.error('[GlamourSheet] Export failed');
      ToastService.error(LanguageService.t('swatch.listExportFailed'));
    }
  });
  foot.appendChild(save);
  // The clipboard write starts inside this click, with the content already
  // built — WebKit refuses a write once the click's activation has lapsed.
  const copy = button('sheet-copy', LanguageService.t('swatch.copyList'), true, () => {
    const current = input();
    void copyRichTextToClipboard({
      html: buildGlamourHtml(current, format),
      text: buildGlamourPlainText(current, format),
    })
      .then((ok) => {
        if (ok) ToastService.success(LanguageService.t('swatch.listCopied'));
        else ToastService.error(LanguageService.t('swatch.listCopyFailed'));
      })
      .catch(() => {
        logger.error('[GlamourSheet] Copy failed');
        ToastService.error(LanguageService.t('swatch.listCopyFailed'));
      });
  });
  foot.appendChild(copy);
  panel.appendChild(foot);

  refresh();
  document.body.appendChild(root);
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      closeGlamourSheet();
      return;
    }
    // aria-modal: Tab and Shift+Tab stay inside the sheet. The toggle's switch is
    // in its shadow root, out of this query's sight, so the host stands in for it:
    // document.activeElement retargets to the host, and wrapping focuses the switch.
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button, textarea, input, select, [href], v4-toggle-switch'
      )
    ).filter((node) => !node.hasAttribute('disabled'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const wrapTo = (node: HTMLElement): void => {
      event.preventDefault();
      (node.shadowRoot?.querySelector<HTMLElement>('[role="switch"]') ?? node).focus();
    };
    // A click on text in the sheet (the toggle's label, the title) leaves focus on
    // <body>, and the browser's next Tab could land behind the sheet: wrap from there too.
    const outside = !panel.contains(document.activeElement);
    if (event.shiftKey && (outside || document.activeElement === first)) wrapTo(last);
    else if (!event.shiftKey && (outside || document.activeElement === last)) wrapTo(first);
  };
  document.addEventListener('keydown', onKey);
  const releaseModal = ModalService.registerExternal();
  current = {
    root,
    cleanup: () => {
      document.removeEventListener('keydown', onKey);
      releaseModal();
    },
    opener: returnTo,
  };
  const opening = focus === 'save' ? save : copy;
  (opening.disabled ? close : opening).focus();
}
