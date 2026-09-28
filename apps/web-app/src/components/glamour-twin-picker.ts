/**
 * The Glamour Reader's twin picker (design 1a popover, 1b bottom sheet).
 *
 * "SAME LOOK · N ITEMS — the game draws these identically. Pick the one your
 * list names." One radio row per twin: its name, item number, facts (best
 * fit, dye channels against the file, the tribe lock, Dated, Grand Company,
 * glamour flag) and, for a twin that fails the check, why. A pick lives with
 * the session; Copy list and Export .md write it.
 *
 * Mounted on document.body (it must escape the block's overflow), one at a
 * time; Escape, a click outside, or a pick closes it.
 *
 * @module components/glamour-twin-picker
 */

import { charaTwinFacts, type CharaTwin, type CharaTwinFact } from '@xivdyetools/core';
import { LanguageService } from '@services/index';
import { itemNameFor, type CharaItemNames } from '@services/chara-resolve-service';
import { MONO, SANS, amber, el, green } from '@components/chara-ui';

export interface TwinPickerOptions {
  /** The +N chip the picker opens from */
  anchor: HTMLElement;
  /** The piece's slot, for the sheet's heading */
  slotLabel: string;
  twins: ReadonlyArray<CharaTwin<CharaItemNames>>;
  /** The twin the list names now */
  pickedId: number;
  /** The twin the default rule names ("BEST FIT") */
  best: CharaTwin<CharaItemNames>;
  lang: string;
  onPick: (itemId: number) => void;
}

let current: { root: HTMLElement; cleanup: () => void } | null = null;

/** Close the open picker, if any. */
export function closeTwinPicker(): void {
  if (!current) return;
  const { root, cleanup } = current;
  current = null;
  cleanup();
  root.remove();
}

function isPhone(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches;
}

const PROBLEM_KEYS = {
  noItem: 'glamour.row.blockedNoItem',
  dye: 'glamour.row.blockedDye',
  glamour: 'glamour.row.blockedGlamour',
  wear: 'glamour.row.blockedWear',
} as const;

function factText(fact: CharaTwinFact): string {
  switch (fact.key) {
    case 'dye':
      return LanguageService.tInterpolate('glamour.fact.dye', { n: String(fact.n) });
    default:
      return LanguageService.t(`glamour.fact.${fact.key}`);
  }
}

function factChip(fact: CharaTwinFact): HTMLElement {
  const ink =
    fact.kind === 'acc'
      ? 'var(--theme-primary)'
      : fact.kind === 'ok'
        ? green()
        : fact.kind === 'warn'
          ? amber()
          : 'var(--theme-text-muted)';
  const chip = el(
    'span',
    `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.6px; padding: 2px 6px; border-radius: 4px; color: ${ink}; background: color-mix(in srgb, ${ink} 12%, transparent); white-space: nowrap;`,
    factText(fact)
  );
  chip.dataset.fact = fact.key;
  return chip;
}

/** Open the picker for one piece, closing any other. */
export function showTwinPicker(options: TwinPickerOptions): void {
  closeTwinPicker();
  const { anchor, twins, pickedId, best, lang, onPick } = options;
  const sheet = isPhone();

  const root = el(
    'div',
    sheet
      ? 'position: fixed; left: 0; right: 0; bottom: 0; z-index: 1000; max-height: 80vh; overflow-y: auto; padding: 14px 16px 20px; border-radius: 16px 16px 0 0; background: var(--theme-card-background); border: 1px solid var(--theme-border); box-shadow: 0 -12px 40px rgba(0,0,0,0.45); display: flex; flex-direction: column; gap: 10px; box-sizing: border-box;'
      : 'position: fixed; z-index: 1000; width: 360px; max-width: calc(100vw - 32px); max-height: 70vh; overflow-y: auto; padding: 12px; border-radius: 12px; background: var(--theme-card-background); border: 1px solid var(--theme-border); box-shadow: 0 12px 36px rgba(0,0,0,0.45); display: flex; flex-direction: column; gap: 9px; box-sizing: border-box;'
  );
  root.dataset.role = 'twin-picker';
  root.dataset.variant = sheet ? 'sheet' : 'popover';
  root.setAttribute('role', 'dialog');
  const heading = LanguageService.tInterpolate('glamour.picker.head', { n: String(twins.length) });
  root.setAttribute('aria-label', heading);

  root.appendChild(
    el(
      'span',
      `font-family: ${MONO}; font-size: 9.5px; letter-spacing: 1.2px; color: var(--theme-text-muted); text-transform: uppercase;`,
      sheet ? `${options.slotLabel.toUpperCase()} · ${heading}` : heading
    )
  );
  root.appendChild(
    el(
      'span',
      'font-size: 12px; line-height: 1.4; color: var(--theme-text);',
      LanguageService.t('glamour.picker.sub')
    )
  );

  const list = el('div', 'display: flex; flex-direction: column; gap: 6px;');
  list.setAttribute('role', 'radiogroup');
  for (const twin of twins) {
    const on = twin.itemId === pickedId;
    const option = el(
      'button',
      `display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 9px 10px; border-radius: 10px; cursor: pointer; font-family: ${SANS}; background: ${
        on ? 'color-mix(in srgb, var(--theme-primary) 8%, transparent)' : 'transparent'
      }; border: 1px solid ${on ? 'var(--theme-primary)' : 'var(--theme-border)'}; color: var(--theme-text);`
    ) as HTMLButtonElement;
    option.type = 'button';
    option.dataset.role = 'twin-option';
    option.dataset.itemId = String(twin.itemId);
    option.setAttribute('role', 'radio');
    option.setAttribute('aria-checked', on ? 'true' : 'false');

    const dot = el(
      'span',
      `flex-shrink: 0; width: 14px; height: 14px; margin-top: 1px; border-radius: 50%; box-sizing: border-box; border: ${
        on ? '4px solid var(--theme-primary)' : '1.5px solid var(--theme-text-muted)'
      };`
    );
    dot.setAttribute('aria-hidden', 'true');
    option.appendChild(dot);

    const body = el('span', 'display: flex; flex-direction: column; gap: 4px; min-width: 0;');
    const title = el('span', 'display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;');
    const name = el(
      'span',
      'font-size: 12.5px; font-weight: 600; overflow-wrap: anywhere;',
      itemNameFor(twin.names, lang)
    );
    name.lang = lang;
    title.appendChild(name);
    title.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 9px; color: var(--theme-text-muted);`,
        LanguageService.tInterpolate('glamour.picker.itemId', { id: String(twin.itemId) })
      )
    );
    body.appendChild(title);
    const facts = el('span', 'display: flex; gap: 4px; flex-wrap: wrap;');
    for (const fact of charaTwinFacts(twin, best)) facts.appendChild(factChip(fact));
    body.appendChild(facts);
    if (twin.problems.length > 0) {
      const why = el(
        'span',
        'font-size: 10.5px; line-height: 1.35; color: var(--theme-text-muted);',
        LanguageService.t(PROBLEM_KEYS[twin.problems[0]])
      );
      why.dataset.role = 'twin-why';
      body.appendChild(why);
    }
    option.appendChild(body);
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      closeTwinPicker();
      if (!on) onPick(twin.itemId);
    });
    list.appendChild(option);
  }
  root.appendChild(list);
  root.appendChild(
    el(
      'span',
      'font-size: 10.5px; line-height: 1.35; color: var(--theme-text-muted);',
      LanguageService.t('glamour.picker.foot')
    )
  );

  document.body.appendChild(root);
  if (!sheet) {
    const rect = anchor.getBoundingClientRect();
    const width = root.offsetWidth || 360;
    root.style.top = `${Math.round(rect.bottom + 6)}px`;
    root.style.left = `${Math.max(16, Math.min(Math.round(rect.left), window.innerWidth - width - 16))}px`;
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') closeTwinPicker();
  };
  const onOutside = (event: MouseEvent): void => {
    const target = event.target as Node | null;
    if (target && (root.contains(target) || anchor.contains(target))) return;
    closeTwinPicker();
  };
  document.addEventListener('keydown', onKey);
  // Registered after this click has finished bubbling, so it cannot close
  // the picker it just opened.
  const timer = window.setTimeout(() => document.addEventListener('click', onOutside), 0);
  current = {
    root,
    cleanup: () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onOutside);
    },
  };
  root.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
}
