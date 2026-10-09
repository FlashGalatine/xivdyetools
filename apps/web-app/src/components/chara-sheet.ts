/**
 * XIV Dye Tools 5.0 — THIS CHARACTER, the `.chara` sheet (10A Sheet).
 *
 * Every colour on the loaded character at once: one card per slot with its
 * best dye already on it, and absent slots left as dashed placeholders with
 * the reason, so a sparse file reads as a fact about the character rather
 * than a loading failure. Picking a card hands its colour to the Swatch
 * Matcher's workspace, which centres its grid excerpt on the slot's cell.
 *
 * Reads the loaded character from CharaSessionService; renders inside the v4
 * shell's shadow DOM with inline styles plus one injected <style> block for
 * the responsive grid.
 *
 * Spec: docs/research/monorepo-2.0/10a-sheet-port-spec.md (10A "Sheet")
 *
 * @module components/chara-sheet
 */

import {
  classifyBandTier,
  roundToBandDisplay,
  type CharaSlotId,
  type ResolvedCharaCharacter,
  type ResolvedCharaSlot,
} from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import {
  CollectionService,
  ColorService,
  dyeService,
  LanguageService,
  ToastService,
} from '@services/index';
import { ThemeService } from '@services/theme-service';
import { CharaSessionService, type CharaSession } from '@services/chara-session-service';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import {
  INSET_RING,
  MONO,
  amber,
  dyeName,
  el,
  slotErrorText,
  slotLabel,
  tSwatch,
  winningHex,
} from '@components/chara-ui';

const TIER_RAMP_DARK = ['#5bbd68', '#8bc34a', '#ffc107', '#f4645a'] as const;
const TIER_RAMP_LIGHT = ['#137A33', '#1C7D3A', '#B45309', '#B91C1C'] as const;

/** Responsive slot grid — injected once per render (shadow-DOM scoped). */
const SHEET_CSS = `
.chara-slots-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
@media (max-width: 768px) {
  .chara-slots-grid { grid-template-columns: repeat(2, 1fr); }
}
`;

/** Where a picked slot lives in the creator, for pins and the grid excerpt. */
export interface CharaSlotGridRef {
  /** Palette base the slot indexes into (matches ColorCategory bases) */
  paletteBase:
    | 'eyeColors'
    | 'hairColors'
    | 'highlightColors'
    | 'skinColors'
    | 'tattooColors'
    | 'lipColors'
    | 'facePaintColors';
  variant: 'dark' | 'light' | null;
  sheetIndex: number;
}

export interface CharaSheetOptions {
  /** A slot card was picked — hand its winning colour to the workspace */
  onSlotPick: (
    hex: string,
    label: string,
    gridRef: CharaSlotGridRef | null,
    slot: CharaSlotId
  ) => void;
  /** Slot to draw selected on the first render, so a host re-render keeps the pick */
  selectedSlot?: CharaSlotId | null;
}

function ramp(): readonly string[] {
  return ThemeService.isDarkMode() ? TIER_RAMP_DARK : TIER_RAMP_LIGHT;
}

/** A live slot card's frame — accent tint and ring when it is the picked slot. */
function slotCardStyle(selected: boolean): string {
  return `display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 11px; cursor: pointer; text-align: left; font-family: inherit; box-sizing: border-box; width: 100%; background: ${
    selected
      ? 'color-mix(in srgb, var(--theme-primary) 12%, transparent)'
      : 'var(--theme-card-background)'
  }; border: 1px solid ${selected ? 'var(--theme-primary)' : 'var(--theme-border)'}; box-shadow: ${
    selected ? '0 0 0 1px var(--theme-primary)' : 'none'
  };`;
}

function absentReason(slot: ResolvedCharaSlot): string {
  switch (slot.inertReason) {
    case 'highlightsDisabled':
      return tSwatch('absentHighlightsOff');
    case 'facePaintNone':
      return tSwatch('absentFacePaintOff');
    case 'noLip':
      return tSwatch('absentNoLips');
    case 'furPattern':
      return tSwatch('absentFurPattern');
    default:
      return tSwatch('absentNotInFile');
  }
}

/** Palette base a slot indexes into (for pins + the grid excerpt). */
function gridRefOf(slot: ResolvedCharaSlot): CharaSlotGridRef | null {
  if (slot.sheetIndex === null) return null;
  const base: CharaSlotGridRef['paletteBase'] | null =
    slot.slot === 'leftEye' || slot.slot === 'rightEye'
      ? 'eyeColors'
      : slot.slot === 'hair'
        ? 'hairColors'
        : slot.slot === 'highlights'
          ? 'highlightColors'
          : slot.slot === 'skin'
            ? 'skinColors'
            : slot.slot === 'limbal'
              ? 'tattooColors'
              : slot.slot === 'lip'
                ? 'lipColors'
                : slot.slot === 'facePaint'
                  ? 'facePaintColors'
                  : null;
  if (!base) return null;
  return { paletteBase: base, variant: slot.sheetVariant, sheetIndex: slot.sheetIndex };
}

function bestDye(hex: string): { dye: Dye; deltaE: number } | null {
  let best: { dye: Dye; deltaE: number } | null = null;
  for (const dye of dyeService.getAllDyes()) {
    if (dye.itemID <= 0) continue;
    const deltaE = ColorService.getDistanceForMethod(hex, dye.hex, 'ciede2000');
    if (!best || deltaE < best.deltaE) best = { dye, deltaE };
  }
  return best;
}

/**
 * `base`, or `base (1)`, `base (2)`… — the first name no record holds yet.
 * Trims the base, never the suffix: a 50-character base would otherwise
 * truncate back to itself and never terminate.
 */
function uniqueCollectionName(base: string): string {
  let name = base;
  let suffix = 1;
  while (CollectionService.getCollectionByName(name)) {
    const tag = ` (${suffix++})`;
    name = `${base.slice(0, 50 - tag.length)}${tag}`;
  }
  return name;
}

/**
 * Save the character's resolved slot colours as a `kind: 'character'`
 * CollectionService record — each slot contributes the dye closest to the
 * colour it actually wears (the lip contributes its blend).
 */
export function saveCharacterColors(session: CharaSession): void {
  const { resolved, fileName } = session;

  const stainIds: number[] = [];
  for (const slot of resolved.slots) {
    const hex = slot.blendHex ?? winningHex(slot);
    if (!hex) continue;
    const best = bestDye(hex);
    if (best?.dye.stainID != null && !stainIds.includes(best.dye.stainID)) {
      stainIds.push(best.dye.stainID);
    }
  }
  if (stainIds.length === 0) {
    ToastService.error(LanguageService.t('errors.saveChangesFailed'));
    return;
  }

  // BUG-082 (2026-10-04 deep-dive): `??` kept an empty or whitespace Nickname,
  // which createCollection then rejected as blank on every save.
  const base = (
    resolved.nickname?.trim() ||
    fileName ||
    LanguageService.t('swatch.characterDefaultName')
  ).slice(0, 50);
  // BUG-016 (2026-10-04 deep-dive): a full store and a taken name both made
  // createCollection return null, shown as the generic save failure. Say which
  // one it is, and number a taken name the way the glamour palette save does.
  if (!CollectionService.canCreateCollection()) {
    ToastService.warning(LanguageService.t('collections.collectionsLimitReached'));
    return;
  }
  const name = uniqueCollectionName(base);
  const record = CollectionService.createCollection(name, undefined, { kind: 'character' });
  if (!record) {
    ToastService.error(LanguageService.t('errors.saveChangesFailed'));
    return;
  }
  for (const stainId of stainIds) {
    CollectionService.addDyeToCollection(record.id, stainId);
  }
  logger.info(`[CharaSheet] Saved character "${name}" (${stainIds.length} colours)`);
  ToastService.success(
    stainIds.length === 1
      ? LanguageService.t('swatch.characterSavedOne')
      : LanguageService.tInterpolate('swatch.characterSavedMany', { n: stainIds.length })
  );
}

/** THIS CHARACTER — empty until a file is loaded. */
export class CharaSheet {
  private container: HTMLElement;
  private options: CharaSheetOptions;
  /** Slot card carrying the accent selection ring */
  private selectedSlotKey: CharaSlotId | null;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeTheme: (() => void) | null = null;

  constructor(container: HTMLElement, options: CharaSheetOptions) {
    this.container = container;
    this.options = options;
    this.selectedSlotKey = options.selectedSlot ?? null;
  }

  init(): void {
    this.unsubscribe = CharaSessionService.subscribe(() => {
      // A different character (or none): its predecessor's pick means nothing.
      this.selectedSlotKey = null;
      this.render();
    });
    // BUG-083 follow-up (2026-10-04 Sprint 22 review): the ΔE tier colours,
    // OFF GRID's amber and the error red are hexes read from the theme at
    // render. Every slot click used to re-render the sheet and so repainted
    // them; with the pick moved in place, nothing did after a theme switch.
    this.unsubscribeTheme = ThemeService.subscribe(() => this.repaint());
    this.render();
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeTheme?.();
    this.unsubscribeTheme = null;
    clearContainer(this.container);
  }

  /**
   * Ring the named slot card (null: none) in place. The host calls this when
   * its workspace stops showing the slot it picked — a grid cell, a palette
   * chip, Clear — so the ring and aria-pressed never announce a stale pick.
   *
   * BUG-083 (2026-10-04 deep-dive): in place, not render(). A full render
   * detached the card being pressed, so keyboard focus fell to <body> and the
   * next Tab restarted at the top of the page.
   */
  setSelectedSlot(key: CharaSlotId | null): void {
    this.selectedSlotKey = key;
    for (const card of this.container.querySelectorAll<HTMLElement>('button[data-slot]')) {
      const selected = card.dataset.slot === key;
      card.setAttribute('style', slotCardStyle(selected));
      card.setAttribute('aria-pressed', String(selected));
    }
  }

  /**
   * A full render that keeps keyboard focus on the slot card that had it —
   * a theme switch (Shift+T) can arrive while a card is focused.
   */
  private repaint(): void {
    const root = this.container.getRootNode() as Document | ShadowRoot;
    const active = root.activeElement;
    const focusedSlot =
      active instanceof HTMLElement && this.container.contains(active)
        ? active.dataset.slot
        : undefined;
    this.render();
    if (focusedSlot) {
      for (const card of this.container.querySelectorAll<HTMLElement>('button[data-slot]')) {
        if (card.dataset.slot === focusedSlot) card.focus();
      }
    }
  }

  private render(): void {
    clearContainer(this.container);
    const session = CharaSessionService.getSession();
    if (!session) return;
    const style = document.createElement('style');
    style.textContent = SHEET_CSS;
    this.container.appendChild(style);
    this.container.appendChild(this.renderSheet(session.resolved));
  }

  /** THIS CHARACTER — one card per slot, best dye already on it. */
  private renderSheet(resolved: ResolvedCharaCharacter): HTMLElement {
    const live = resolved.slots.filter((s) => winningHex(s) !== null);
    const section = el('div', '');

    const header = el(
      'div',
      'display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px;'
    );
    header.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 9.5px; letter-spacing: 1.2px; color: var(--theme-text-muted); text-transform: uppercase;`,
        tSwatch('slotsHead')
      )
    );
    header.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.5px; color: var(--theme-text-muted);`,
        `${live.length} / ${resolved.slots.length}`
      )
    );
    section.appendChild(header);

    const grid = el('div', 'margin-bottom: 13px;');
    grid.className = 'chara-slots-grid';
    for (const slot of resolved.slots) {
      grid.appendChild(this.renderSlotCard(slot));
    }
    section.appendChild(grid);
    return section;
  }

  private renderSlotCard(slot: ResolvedCharaSlot): HTMLElement {
    const label = slotLabel(slot);
    const hex = winningHex(slot);
    const tierRamp = ramp();

    if (!hex) {
      // Absent, inert or error — dashed, with the reason. A fact, not a failure.
      const isError = slot.verdict === 'error';
      const card = el(
        'div',
        `border: 1px dashed ${isError ? 'rgba(244, 100, 90, 0.5)' : 'var(--theme-border)'}; border-radius: 11px; padding: 8px; display: flex; flex-direction: column; gap: 6px; min-height: 64px; box-sizing: border-box;`
      );
      const head = el('div', 'display: flex; align-items: center; gap: 6px; min-width: 0;');
      // Hatched chip — visibly not a colour.
      head.appendChild(
        el(
          'span',
          'width: 26px; height: 26px; border-radius: 7px; flex: 0 0 auto; background: repeating-linear-gradient(45deg, transparent, transparent 3px, var(--theme-border) 3px, var(--theme-border) 4px);'
        )
      );
      head.appendChild(
        el(
          'span',
          'font-size: 11.5px; font-weight: 600; color: var(--theme-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          label
        )
      );
      card.appendChild(head);
      card.appendChild(
        el(
          'span',
          `font-size: 10px; line-height: 1.4; color: ${isError ? (ThemeService.isDarkMode() ? '#f4645a' : '#B91C1C') : 'var(--theme-text-muted)'};`,
          isError ? slotErrorText(slot.error?.code) : absentReason(slot)
        )
      );
      return card;
    }

    const offGrid = slot.verdict === 'offGrid' || slot.verdict === 'floatOnly';
    const selected = this.selectedSlotKey === slot.slot;
    const card = el('button', slotCardStyle(selected));
    (card as HTMLButtonElement).type = 'button';
    card.dataset.slot = slot.slot;
    card.setAttribute('aria-pressed', String(selected));

    // Top row: 26px swatch + label over address.
    const head = el('span', 'display: flex; align-items: center; gap: 6px; min-width: 0;');
    head.appendChild(
      el(
        'span',
        `width: 26px; height: 26px; border-radius: 7px; flex: 0 0 auto; background: ${hex}; ${INSET_RING}`
      )
    );
    const headText = el(
      'span',
      'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;'
    );
    headText.appendChild(
      el(
        'span',
        'font-size: 11.5px; font-weight: 600; color: var(--theme-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
        label
      )
    );
    // Address line: R·C in the creator, or amber OFF GRID — never a fake one.
    const addrStyle = `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
    if (offGrid) {
      const addr = el('span', `${addrStyle} color: ${amber()};`, tSwatch('offGrid'));
      addr.title = tSwatch('offGridNote');
      headText.appendChild(addr);
    } else {
      const addrText =
        slot.sheetVariant === 'light'
          ? `${slot.gridAddress ?? ''} · ${tSwatch('rangeLight')}`
          : (slot.gridAddress ?? '');
      const addr = el('span', `${addrStyle} color: var(--theme-text-muted);`, addrText);
      if (slot.indexWinNote) {
        addr.title = tSwatch('indexWinsNote');
        addr.textContent = `${addrText} *`;
      }
      headText.appendChild(addr);
    }
    head.appendChild(headText);
    card.appendChild(head);

    // Lip only: the raw cell overstates a 0.25-alpha lip, so the card shows
    // both — the cell the R·C address points at (above) and the colour the
    // character actually wears, composited over skin. Matching follows the
    // blend, because that is the colour you are trying to hit.
    const blend = slot.blendHex;
    const effective = blend ?? hex;
    if (blend) {
      const blendRow = el(
        'span',
        'display: flex; align-items: center; gap: 5px; min-width: 0; width: 100%;'
      );
      blendRow.appendChild(
        el(
          'span',
          `width: 13px; height: 13px; border-radius: 4px; flex: 0 0 auto; background: ${blend}; ${INSET_RING}`
        )
      );
      blendRow.appendChild(
        el(
          'span',
          `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.5px; color: var(--theme-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`,
          slot.alpha !== null
            ? LanguageService.tInterpolate('swatch.blendTag', { alpha: slot.alpha.toFixed(2) })
            : LanguageService.t('swatch.blendPlain')
        )
      );
      blendRow.title = LanguageService.t('swatch.blendNote');
      card.appendChild(blendRow);
    }

    // Bottom row: best dye already on the card — the sheet answers first.
    const best = bestDye(effective);
    if (best) {
      const tier = classifyBandTier(
        roundToBandDisplay(best.deltaE, 'ciede2000'),
        'ciede2000',
        'match'
      );
      const row = el(
        'span',
        'display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; width: 100%;'
      );
      const left = el('span', 'display: flex; align-items: center; gap: 5px; min-width: 0;');
      left.appendChild(
        el(
          'span',
          `width: 13px; height: 13px; border-radius: 4px; flex: 0 0 auto; background: ${best.dye.hex}; ${INSET_RING}`
        )
      );
      left.appendChild(
        el(
          'span',
          'font-size: 10px; color: var(--theme-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          dyeName(best.dye)
        )
      );
      row.appendChild(left);
      row.appendChild(
        el(
          'span',
          `font-family: ${MONO}; font-size: 11px; color: ${tierRamp[tier]}; flex: 0 0 auto;`,
          roundToBandDisplay(best.deltaE, 'ciede2000').toFixed(1)
        )
      );
      card.appendChild(row);
      card.title = `${label} · ${effective.toUpperCase()} → ${dyeName(best.dye)}`;
    }

    card.addEventListener('click', () => {
      this.setSelectedSlot(slot.slot);
      this.options.onSlotPick(effective, label, offGrid ? null : gridRefOf(slot), slot.slot);
    });

    return card;
  }
}
