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
  type CharaImportIssue,
  type CharaSlotId,
  type ImportedCharaCharacter,
  type ImportedCharaSlot,
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
  hasValidGridCoordinate,
  matchTargetHex,
  monoChip,
  previewHex,
  slotLabel,
  slotProblemText,
  slotViewState,
  tSwatch,
} from '@components/chara-ui';

const TIER_RAMP_DARK = ['#5bbd68', '#8bc34a', '#ffc107', '#f4645a'] as const;
const TIER_RAMP_LIGHT = ['#137A33', '#1C7D3A', '#B45309', '#B91C1C'] as const;

/** Responsive slot grid — injected once per render (shadow-DOM scoped). */
const SHEET_CSS = `
.chara-slots-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
@media (max-width: 768px) {
  .chara-slots-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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

/** Why a slot with no color shows none: switched off in the file, or not stored in it. */
function absentReason(slot: ImportedCharaSlot): string {
  if (slot.interpretation !== 'inactive') return tSwatch('absentNotInFile');
  switch (slot.reason) {
    case 'highlightsDisabled':
      return tSwatch('absentHighlightsOff');
    case 'facePaintNone':
      return tSwatch('absentFacePaintOff');
    case 'noLip':
      return tSwatch('absentNoLips');
    case 'lipDisabled':
      return tSwatch('absentLipOff');
    case 'furPattern':
      return tSwatch('absentFurPattern');
    default:
      return tSwatch('absentNotInFile');
  }
}

/** The R·C address text, with the light range named where the slot is on it. */
function addressText(slot: ImportedCharaSlot): string {
  const address = slot.gridAddress ?? '';
  return slot.variant === 'light' ? `${address} · ${tSwatch('rangeLight')}` : address;
}

/**
 * Palette base a slot indexes into (for pins + the grid excerpt). Only a creator cell the slot
 * really resolved to: a switched-off slot or one missing its clan keeps a `sheetIndex` but has no
 * resolved entry, so it links nowhere (D3).
 */
function gridRefOf(slot: ImportedCharaSlot): CharaSlotGridRef | null {
  if (!hasValidGridCoordinate(slot) || slot.sheetIndex === null) return null;
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
  return { paletteBase: base, variant: slot.variant, sheetIndex: slot.sheetIndex };
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
 * colour it actually wears (the lip contributes its blend). Only confirmed
 * colours count: a slot whose control the file does not state is never saved.
 */
export function saveCharacterColors(session: CharaSession): void {
  const { resolved, fileName } = session;

  const stainIds: number[] = [];
  for (const slot of resolved.slots) {
    const hex = matchTargetHex(slot);
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
  // FINDING-001: the name can be the imported nickname or file name; counts only.
  logger.info(`[CharaSheet] Saved a character (${stainIds.length} colours)`);
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
  private renderSheet(resolved: ImportedCharaCharacter): HTMLElement {
    // Every slot with a color preview, unknown activation included (D6).
    const live = resolved.slots.filter((s) => previewHex(s) !== null);
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
      grid.appendChild(this.renderSlotCard(slot, resolved.issues));
    }
    section.appendChild(grid);
    return section;
  }

  private renderSlotCard(
    slot: ImportedCharaSlot,
    issues: readonly CharaImportIssue[]
  ): HTMLElement {
    const label = slotLabel(slot);
    const view = slotViewState(slot, issues);
    const tierRamp = ramp();

    if (view.kind === 'activityUnknown') return this.renderUnconfirmedCard(slot, label);

    // The colour the slot is matched, picked and saved as: set only for a confirmed colour.
    const effective = matchTargetHex(slot);
    if (
      view.kind === 'absent' ||
      view.kind === 'inactive' ||
      view.kind === 'unresolved' ||
      !effective
    ) {
      // Absent, switched off or unreadable — dashed, with the reason. A fact, not a failure.
      const isError = view.kind === 'unresolved';
      const card = el(
        'div',
        `border: 1px dashed ${isError ? 'rgba(244, 100, 90, 0.5)' : 'var(--theme-border)'}; border-radius: 11px; padding: 8px; display: flex; flex-direction: column; gap: 6px; min-height: 64px; box-sizing: border-box;`
      );
      card.dataset.slot = slot.slot;
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
          isError ? slotProblemText(slot, issues) : absentReason(slot)
        )
      );
      return card;
    }

    const offGrid = view.kind === 'offGrid';
    // The card's own swatch: the cell (or float) the file stores; a lip's blend has its own row.
    const hex = slot.displayHex ?? effective;
    const selected = this.selectedSlotKey === slot.slot;
    const card = el('button', slotCardStyle(selected));
    (card as HTMLButtonElement).type = 'button';
    card.dataset.slot = slot.slot;
    card.setAttribute('aria-pressed', String(selected));

    // Top row: 26px swatch + label over address.
    const head = el('span', 'display: flex; align-items: center; gap: 6px; min-width: 0;');
    head.appendChild(slotSwatch(slot, hex));
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
      const addrText = addressText(slot);
      const addr = el('span', `${addrStyle} color: var(--theme-text-muted);`, addrText);
      // The file stores a float its flag says is not applied, so the index is shown. An
      // all-zero block (`ambiguousZeroBlock`) is not a disagreement and gets no mark (D7).
      if (slot.reason === 'extendedInactive') {
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
    // blend, because that is the colour you are trying to hit (D1).
    const blend = blendRow(slot);
    if (blend) card.appendChild(blend);

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

  /**
   * A resolved colour whose control the file does not state (no `EnableHighlights`, `FacePaint`
   * or `Mouth`): the colour is evidence, so it is shown, with its address where it has one, but it
   * is not a button — no best dye, no pick, so nothing reaches matching, the share link or
   * SEND TO, and the save skips it (D4).
   */
  private renderUnconfirmedCard(slot: ImportedCharaSlot, label: string): HTMLElement {
    const card = el(
      'div',
      'display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 11px; box-sizing: border-box; width: 100%; background: var(--theme-card-background); border: 1px dashed var(--theme-border);'
    );
    card.dataset.slot = slot.slot;

    const head = el('span', 'display: flex; align-items: center; gap: 6px; min-width: 0;');
    head.appendChild(slotSwatch(slot, slot.displayHex ?? ''));
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
    if (hasValidGridCoordinate(slot)) {
      headText.appendChild(
        el(
          'span',
          `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.5px; color: var(--theme-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`,
          addressText(slot)
        )
      );
    }
    head.appendChild(headText);
    card.appendChild(head);

    const blend = blendRow(slot);
    if (blend) card.appendChild(blend);

    const chipRow = el('span', 'display: flex; min-width: 0;');
    chipRow.appendChild(
      monoChip(tSwatch('activityUnknownTag'), amber(), 'rgba(244, 191, 79, 0.18)')
    );
    card.appendChild(chipRow);
    card.appendChild(
      el(
        'span',
        'font-size: 10px; line-height: 1.4; color: var(--theme-text-muted);',
        tSwatch('activityUnknownNote')
      )
    );
    return card;
  }
}

/** The card's 26px swatch. A corrected eye says why its colour is the other eye's float. */
function slotSwatch(slot: ImportedCharaSlot, hex: string): HTMLElement {
  const swatch = el(
    'span',
    `width: 26px; height: 26px; border-radius: 7px; flex: 0 0 auto; background: ${hex}; ${INSET_RING}`
  );
  if (slot.correction === 'historicalEyePairSwap') swatch.title = tSwatch('eyeSwapNote');
  return swatch;
}

/** The lip's composite over the skin, with its opacity: null for every other slot. */
function blendRow(slot: ImportedCharaSlot): HTMLElement | null {
  const composite = slot.lipComposite;
  if (!composite) return null;
  const row = el(
    'span',
    'display: flex; align-items: center; gap: 5px; min-width: 0; width: 100%;'
  );
  row.appendChild(
    el(
      'span',
      `width: 13px; height: 13px; border-radius: 4px; flex: 0 0 auto; background: ${composite.hex}; ${INSET_RING}`
    )
  );
  row.appendChild(
    el(
      'span',
      `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.5px; color: var(--theme-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`,
      Number.isFinite(composite.alpha)
        ? LanguageService.tInterpolate('swatch.blendTag', { alpha: composite.alpha.toFixed(2) })
        : LanguageService.t('swatch.blendPlain')
    )
  );
  row.title = LanguageService.t('swatch.blendNote');
  return row;
}
