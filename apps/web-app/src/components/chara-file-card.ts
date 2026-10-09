/**
 * XIV Dye Tools 5.0 — the `.chara` file card (10A Sheet).
 *
 * The front door turns from a picker into a reader: a drop zone until a file
 * is loaded, then the file card (colour strip, producer and LOCAL ONLY chips,
 * name, tribe/gender meta, SWAP), the amber warnings card and the privacy
 * line. It loads files into CharaSessionService and draws whatever is loaded
 * there, so every view of the character follows the same file.
 *
 * Privacy is on the card: parsed on this device, nothing uploaded, Base64Image
 * never read. Renders inside the v4 shell's shadow DOM with inline styles.
 *
 * Spec: docs/research/monorepo-2.0/10a-sheet-port-spec.md (10A "Sheet")
 *
 * @module components/chara-file-card
 */

import type { ResolvedCharaCharacter } from '@xivdyetools/core';
import { LanguageService, ToastService } from '@services/index';
import { ThemeService } from '@services/theme-service';
import { CharaSessionService, type CharaSession } from '@services/chara-session-service';
import { loadCharaFile } from '@services/chara-file-loader';
import { clearContainer } from '@shared/utils';
import { SUBRACE_TO_CLAN_KEY } from '@shared/subrace-clan';
import {
  INSET_RING,
  MONO,
  SANS,
  amber,
  el,
  green,
  joinSentences,
  monoChip,
  slotErrorText,
  slotLabel,
  tSwatch,
  winningHex,
} from '@components/chara-ui';

export interface CharaFileCardOptions {
  /**
   * Offer "Save character colors" beside SWAP. The Swatch Matcher passes it;
   * the card itself knows nothing about collection records.
   */
  onSaveCharacter?: (session: CharaSession) => void;
  /**
   * One file, two tools: a link to the other tool that reads the same session
   * (Glamour Reader ↔ Swatch Matcher). The file stays loaded; the host opens
   * the other tool.
   */
  crossLink?: { label: string; onOpen: () => void };
  /**
   * A clause the host adds to the privacy line. The Glamour Reader keeps the
   * player's edited acquisition notes on the device, so it says so (spec G8).
   */
  privacyNote?: string;
  /**
   * The host sends the file's gear model numbers and the facewear id to the
   * API (the Glamour Reader's `/v1/chara/resolve` call). The file is still
   * parsed locally, but "Nothing is uploaded" would be false, so the card
   * swaps every privacy surface to `swatch.charaHintGlamour` and drops the
   * LOCAL ONLY chip. The Swatch Matcher never calls resolve and leaves this off.
   */
  sendsGearIds?: boolean;
  /**
   * The drop zone's body line, from a host that is not the Swatch Matcher.
   * Without it the zone pitches the Swatch Matcher: every color on the
   * character, the clan and gender for hair and skin, and "or pick a swatch
   * from the grid below". A host with its own line has no swatch grid, so the
   * grid line goes too. The Glamour Reader passes `glamour.dropBody`.
   */
  dropBody?: string;
}

interface CharaWarning {
  tag: string;
  text: string;
  severe: boolean;
}

/**
 * Parse warnings for the amber card: loud slot failures (96–127 gap,
 * out-of-range index, missing tribe) and extended-appearance drift
 * (OFF GRID — the file wears a colour no cell can express).
 */
function charaWarnings(resolved: ResolvedCharaCharacter): CharaWarning[] {
  const out: CharaWarning[] = [];
  for (const slot of resolved.slots) {
    const label = slotLabel(slot);
    if (slot.verdict === 'error' && slot.error) {
      out.push({
        tag: LanguageService.t('swatch.warnErrorTag'),
        text: `${label} · ${slotErrorText(slot.error.code)}`,
        severe: true,
      });
    } else if (slot.verdict === 'offGrid' || slot.verdict === 'floatOnly') {
      out.push({
        tag: tSwatch('offGrid'),
        text: `${label} · ${tSwatch('offGridNote')}`,
        severe: false,
      });
    }
  }
  return out;
}

/**
 * The drop zone, or the loaded file's card. Mounted above the workspace; the
 * workspace keeps working without a file.
 */
export class CharaFileCard {
  private container: HTMLElement;
  private options: CharaFileCardOptions;
  private unsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, options: CharaFileCardOptions = {}) {
    this.container = container;
    this.options = options;
  }

  /** The privacy sentence for this host: gear ids are sent, or nothing is. */
  private privacyHint(): string {
    return tSwatch(this.options.sendsGearIds ? 'charaHintGlamour' : 'charaHint');
  }

  init(): void {
    this.unsubscribe = CharaSessionService.subscribe(() => this.render());
    this.render();
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    clearContainer(this.container);
  }

  /** The drop and Choose-file handlers' only job; failures become one toast. */
  private async loadFile(file: File): Promise<void> {
    const result = await loadCharaFile(file);
    // Superseded: a newer drop replaced this one, so its outcome is moot.
    if (result.ok || result.error === 'superseded') return;
    ToastService.error(
      result.error === 'tooLarge'
        ? LanguageService.t('errors.fileTooLarge')
        : // Loud failure naming the field and value — core's messages do that,
          // and they ride in as {reason} inside the localized sentence.
          LanguageService.tInterpolate('swatch.parseFailed', { reason: result.reason })
    );
  }

  private render(): void {
    clearContainer(this.container);
    const session = CharaSessionService.getSession();
    if (!session) {
      this.container.appendChild(this.renderDropZone());
      return;
    }
    this.container.appendChild(this.renderFileCard(session));
    const warnings = charaWarnings(session.resolved);
    if (warnings.length > 0) this.container.appendChild(this.renderWarningsCard(warnings));
    // The privacy promise stays visible under the card (Extractor wording).
    const note = this.options.privacyNote;
    this.container.appendChild(
      el(
        'div',
        'font-size: 10px; line-height: 1.45; color: var(--theme-text-muted); margin-bottom: 11px;',
        note ? joinSentences(this.privacyHint(), note) : this.privacyHint()
      )
    );
  }

  /** The offer above the workspace — nothing below it is disabled. */
  private renderDropZone(): HTMLElement {
    // The host's own pitch, or the Swatch Matcher's with its grid line.
    const hostBody = this.options.dropBody;
    const zone = el(
      'div',
      'border: 1px dashed var(--theme-border); border-radius: 14px; padding: 22px 20px; text-align: center; cursor: pointer; background: var(--theme-card-background); margin-bottom: 11px;'
    );

    zone.appendChild(
      el(
        'div',
        `font-family: ${SANS}; font-size: 15px; font-weight: 600; color: var(--theme-text); margin-bottom: 4px;`,
        tSwatch('dropTitle')
      )
    );
    zone.appendChild(
      el(
        'div',
        'font-size: 12.5px; line-height: 1.55; color: var(--theme-text-muted); max-width: 560px; margin: 0 auto 12px;',
        hostBody ?? tSwatch('dropBody')
      )
    );

    // Accent Choose-file button, 44px — the one solid-accent element here.
    const chooseBtn = el(
      'button',
      'height: 44px; padding: 0 18px; font-size: 13px; font-weight: 600; border-radius: 10px; border: none; background: var(--theme-primary); color: #fff; cursor: pointer; font-family: inherit;',
      tSwatch('chooseFile')
    );
    (chooseBtn as HTMLButtonElement).type = 'button';
    zone.appendChild(chooseBtn);

    if (hostBody === undefined) {
      zone.appendChild(
        el(
          'div',
          `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); margin-top: 12px;`,
          tSwatch('orGrid')
        )
      );
    }
    // Without the grid line, the privacy line keeps that line's 12px from the button.
    zone.appendChild(
      el(
        'div',
        `font-size: 10px; line-height: 1.45; color: var(--theme-text-muted); margin-top: ${hostBody === undefined ? 8 : 12}px;`,
        this.privacyHint()
      )
    );

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.chara,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) void this.loadFile(file);
    });
    zone.appendChild(input);

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.style.borderColor = 'var(--theme-primary)';
    });
    zone.addEventListener('dragleave', () => {
      zone.style.borderColor = 'var(--theme-border)';
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.style.borderColor = 'var(--theme-border)';
      const file = e.dataTransfer?.files?.[0];
      if (file) void this.loadFile(file);
    });

    return zone;
  }

  /**
   * File loaded: 46px colour strip | producer + LOCAL ONLY chips, name,
   * mono meta | the cross-link, 44px SWAP chip and Save. The strip is the
   * character's own thumbnail — Base64Image is never read. The buttons wrap
   * as one group under the name before the name drops below 140px, so a
   * phone never loses it.
   */
  private renderFileCard(session: CharaSession): HTMLElement {
    const { resolved, fileName } = session;
    const live = resolved.slots.filter((s) => winningHex(s) !== null);

    const card = el(
      'div',
      'display: flex; flex-wrap: wrap; align-items: stretch; gap: 10px; padding: 9px; border-radius: 14px; margin-bottom: 11px; background: var(--theme-card-background); border: 1px solid var(--theme-border);'
    );

    // 46px vertical strip of the character's key colours.
    const strip = el(
      'span',
      `display: flex; width: 46px; flex-shrink: 0; flex-direction: column; border-radius: 9px; overflow: hidden; ${INSET_RING}`
    );
    const stripColors = live.slice(0, 5);
    if (stripColors.length === 0) {
      strip.appendChild(el('span', 'flex: 1; background: var(--theme-background-secondary);'));
    }
    for (const slot of stripColors) {
      strip.appendChild(el('span', `flex: 1; background: ${winningHex(slot)!};`));
    }
    card.appendChild(strip);

    // Middle column: chips, name, meta.
    const mid = el(
      'span',
      'flex: 1 1 140px; min-width: 0; display: flex; flex-direction: column; gap: 3px; justify-content: center;'
    );
    const chips = el('span', 'display: flex; gap: 6px; flex-wrap: wrap;');
    if (resolved.producer) {
      // Producer is shown so a missing slot is attributable — never used for parsing.
      chips.appendChild(
        monoChip(
          resolved.producer.toUpperCase().replace(' CHARACTER FILE', ''),
          'var(--theme-text-muted)',
          'var(--theme-background-secondary)'
        )
      );
    }
    // LOCAL ONLY is only true when nothing leaves the device.
    if (!this.options.sendsGearIds) {
      const localChip = monoChip(tSwatch('localOnly'), green(), 'rgba(97, 197, 84, 0.16)');
      localChip.title = this.privacyHint();
      chips.appendChild(localChip);
    }
    mid.appendChild(chips);

    mid.appendChild(
      el(
        'span',
        `font-family: ${SANS}; font-weight: 600; font-size: 16px; color: var(--theme-text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`,
        resolved.nickname?.trim() || fileName || LanguageService.t('swatch.unnamedCharacter')
      )
    );

    const genderSym = resolved.gender === 'Female' ? '♀' : resolved.gender === 'Male' ? '♂' : '';
    const tribeLabel = resolved.tribe
      ? LanguageService.getClan(SUBRACE_TO_CLAN_KEY[resolved.tribe])
      : '—';
    const meta = [
      `${tribeLabel} ${genderSym}`.trim(),
      `${live.length}/${resolved.slots.length}`,
      fileName,
    ]
      .filter(Boolean)
      .join(' · ');
    mid.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 10px; color: var(--theme-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`,
        meta
      )
    );
    card.appendChild(mid);

    const actions = el('span', 'display: flex; gap: 10px; flex-shrink: 0; margin-left: auto;');
    const crossLink = this.options.crossLink;
    if (crossLink) {
      const link = el(
        'button',
        `flex-shrink: 0; align-self: center; padding: 6px 10px; font-size: 11px; font-weight: 600; border-radius: 9px; border: 1px solid var(--theme-border); background: var(--theme-background-secondary); color: var(--theme-text); cursor: pointer; font-family: inherit; white-space: nowrap;`,
        `${crossLink.label} →`
      );
      (link as HTMLButtonElement).type = 'button';
      link.dataset.role = 'cross-link';
      link.addEventListener('click', () => crossLink.onOpen());
      actions.appendChild(link);
    }

    // 44px SWAP chip — replace the file without losing the workspace.
    const swapBtn = el(
      'button',
      `width: 44px; flex-shrink: 0; font-family: ${MONO}; font-size: 9px; letter-spacing: 0.5px; border-radius: 9px; border: 1px solid var(--theme-border); background: var(--theme-background-secondary); color: var(--theme-text); cursor: pointer;`,
      LanguageService.t('swatch.swap')
    );
    (swapBtn as HTMLButtonElement).type = 'button';
    swapBtn.title = tSwatch('replaceFile');
    swapBtn.addEventListener('click', () => CharaSessionService.setSession(null));
    actions.appendChild(swapBtn);

    const onSaveCharacter = this.options.onSaveCharacter;
    if (onSaveCharacter) {
      // Save the character's own colours (not the glamour's) as the store's
      // `kind: 'character'` record — the second half of the export flow.
      const saveBtn = el(
        'button',
        `flex-shrink: 0; padding: 6px 10px; font-size: 11px; font-weight: 600; border-radius: 9px; border: 1px solid var(--theme-border); background: var(--theme-background-secondary); color: var(--theme-text); cursor: pointer; font-family: inherit;`,
        LanguageService.t('swatch.saveCharacter')
      );
      (saveBtn as HTMLButtonElement).type = 'button';
      saveBtn.addEventListener('click', () => onSaveCharacter(session));
      actions.appendChild(saveBtn);
    }
    card.appendChild(actions);

    return card;
  }

  /** Amber warnings card: one row per parse warning — TAG chip + 11px text. */
  private renderWarningsCard(warnings: CharaWarning[]): HTMLElement {
    const card = el(
      'div',
      'display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-radius: 14px; margin-bottom: 11px; background: rgba(244, 191, 79, 0.07); border: 1px solid rgba(244, 191, 79, 0.3);'
    );
    for (const warning of warnings) {
      const row = el('div', 'display: flex; align-items: flex-start; gap: 7px; min-width: 0;');
      const severeRed = ThemeService.isDarkMode() ? '#f4645a' : '#B91C1C';
      row.appendChild(
        monoChip(
          warning.tag,
          warning.severe ? severeRed : amber(),
          warning.severe ? 'rgba(244, 100, 90, 0.18)' : 'rgba(244, 191, 79, 0.18)'
        )
      );
      row.appendChild(
        el(
          'span',
          'font-size: 11px; line-height: 1.45; color: var(--theme-text); min-width: 0;',
          warning.text
        )
      );
      card.appendChild(row);
    }
    return card;
  }
}
