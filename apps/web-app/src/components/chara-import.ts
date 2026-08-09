/**
 * XIV Dye Tools 5.0 — .chara import (10A Sheet).
 *
 * The front door turns from a picker into a reader: drop a .chara file and
 * every colour on the character arrives at once — one card per slot with its
 * best dye already on it — plus the dyes the glamour is wearing. Absent
 * slots stay as dashed placeholders with the reason, so a sparse file reads
 * as a fact about the character, not a loading failure.
 *
 * Parsing is core's Phase-0 parser (parseCharaFile → resolveCharaColors);
 * everything here is presentation, plus two deliberate wires: the 3–6
 * floor/cap enforced at the Make-a-palette action buttons, and Save-to-this-
 * device creating a `kind: 'palette'` CollectionService record.
 *
 * Renders inside the v4 shell's shadow DOM — inline styles + one injected
 * <style> block for the responsive grids. Privacy is on the card: parsed on
 * this device, nothing uploaded, Base64Image never read.
 *
 * Spec: docs/research/monorepo-2.0/10a-sheet-port-spec.md (10A "Sheet")
 *
 * @module components/chara-import
 */

import {
  parseCharaFile,
  resolveCharaColors,
  CharacterColorService,
  classifyBandTier,
  roundToBandDisplay,
  type ResolvedCharaCharacter,
  type ResolvedCharaSlot,
} from '@xivdyetools/core';
import {
  ColorService,
  CollectionService,
  dyeService,
  LanguageService,
  ToastService,
} from '@services/index';
import { ThemeService } from '@services/theme-service';
import { ICON_TOOL_PRESETS } from '@shared/tool-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye, SubRace, Gender } from '@xivdyetools/types';

const MONO = "'Fragment Mono', monospace";
/** Matches globals.css h1–h6 — Space Grotesk with the system fallback. */
const SANS = "'Space Grotesk', system-ui, sans-serif";
const TIER_RAMP_DARK = ['#5bbd68', '#8bc34a', '#ffc107', '#f4645a'] as const;
const TIER_RAMP_LIGHT = ['#137A33', '#1C7D3A', '#B45309', '#B91C1C'] as const;
const OFF_GRID_AMBER = '#F4BF4F';
const OFF_GRID_AMBER_LIGHT = '#B45309';
const LOCAL_ONLY_GREEN = '#61C554';
const LOCAL_ONLY_GREEN_LIGHT = '#137A33';
/** The suite's swatch inset ring — load-bearing on extreme colours. */
const INSET_RING = 'box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.28);';

/** Glamour export floor/cap (confirmed: floor 3 — Turn 10; hard cap 6 — Review). */
const PALETTE_FLOOR = 3;
const PALETTE_CAP = 6;

/** Responsive grids for the sheet — injected once per render (shadow-DOM scoped). */
const CHARA_RESPONSIVE_CSS = `
.chara-slots-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
.chara-equip-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
@media (max-width: 768px) {
  .chara-slots-grid { grid-template-columns: repeat(2, 1fr); }
  .chara-equip-grid { grid-template-columns: 1fr; }
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

export interface CharaImportCallbacks {
  /** A slot card was picked — hand its winning colour to the workspace */
  onSlotPick: (hex: string, label: string, gridRef: CharaSlotGridRef | null) => void;
  /** The file supplied tribe + gender — the selectors become a readout */
  onTribeGender?: (tribe: SubRace, gender: Gender) => void;
  /** Make-a-palette submit: kept worn dyes + the panel's name draft */
  onSubmitPalette?: (dyes: Dye[], name?: string) => void;
  /** Fired on load (resolved) and on clear (null) — drives pins + readout lock */
  onResolved?: (resolved: ResolvedCharaCharacter | null) => void;
}

export interface CharaImportOptions {
  /**
   * Where DYES ON THIS GLAMOUR renders. The 10A flow puts it after the
   * match results, which live in the tool — the tool passes a container
   * from its results column. Falls back to the main container.
   */
  glamourContainer?: HTMLElement | null;
}

/**
 * The 10A file card + THIS CHARACTER sheet + DYES ON THIS GLAMOUR block.
 * Mounted above the workspace; the workspace keeps working without it.
 */
export class CharaImport {
  private container: HTMLElement;
  private callbacks: CharaImportCallbacks;
  private glamourContainer: HTMLElement | null;
  private characterColors = new CharacterColorService();
  private resolved: ResolvedCharaCharacter | null = null;
  private fileName: string | null = null;
  /** Deduped worn dyes; entries toggled off before palette actions */
  private droppedStainIds = new Set<number>();
  /** Slot card carrying the accent selection ring */
  private selectedSlotKey: string | null = null;
  /** Make-a-palette panel expansion state (survives re-renders) */
  private paletteOpen = false;
  /** Name field draft; null = default to the character's nickname */
  private paletteNameDraft: string | null = null;

  constructor(
    container: HTMLElement,
    callbacks: CharaImportCallbacks,
    options?: CharaImportOptions
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.glamourContainer = options?.glamourContainer ?? null;
  }

  init(): void {
    this.render();
  }

  destroy(): void {
    clearContainer(this.container);
    if (this.glamourContainer) clearContainer(this.glamourContainer);
    this.resolved = null;
  }

  // ==========================================================================
  // Parsing
  // ==========================================================================

  private async loadFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      const parsed = parseCharaFile(text);
      this.resolved = await resolveCharaColors(parsed, this.characterColors, {
        getByStainId: (stainId: number) => dyeService.getByStainId(stainId),
      });
      this.fileName = file.name;
      this.droppedStainIds.clear();
      this.selectedSlotKey = null;
      this.paletteOpen = false;
      this.paletteNameDraft = null;
      if (this.resolved.tribe && this.resolved.gender && this.callbacks.onTribeGender) {
        this.callbacks.onTribeGender(this.resolved.tribe, this.resolved.gender);
      }
      this.callbacks.onResolved?.(this.resolved);
      logger.info(
        `[CharaImport] Parsed ${file.name} (${this.resolved.producer ?? 'unknown producer'})`
      );
    } catch (error) {
      logger.error('[CharaImport] Parse failed:', error);
      // Loud failure naming the field and value — core's messages do that.
      // TODO(i18n): parse failures surface core's EN message verbatim.
      ToastService.error(error instanceof Error ? error.message : String(error));
      return;
    }
    this.render();
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private t(key: string): string {
    return LanguageService.t(`swatch.${key}`);
  }

  private ramp(): readonly string[] {
    return ThemeService.isDarkMode() ? TIER_RAMP_DARK : TIER_RAMP_LIGHT;
  }

  private amber(): string {
    return ThemeService.isDarkMode() ? OFF_GRID_AMBER : OFF_GRID_AMBER_LIGHT;
  }

  private green(): string {
    return ThemeService.isDarkMode() ? LOCAL_ONLY_GREEN : LOCAL_ONLY_GREEN_LIGHT;
  }

  private el(tag: string, style: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    node.setAttribute('style', style);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** Mono chip label (8.5px, letter-spaced) — the drawn card vocabulary. */
  private monoChip(text: string, fg: string, bg: string): HTMLElement {
    return this.el(
      'span',
      `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; padding: 3px 7px; border-radius: 5px; background: ${bg}; color: ${fg}; white-space: nowrap;`,
      text
    );
  }

  private slotLabel(slot: ResolvedCharaSlot): string {
    switch (slot.slot) {
      case 'leftEye':
        return this.t('slotLeftEye');
      case 'rightEye':
        return this.t('slotRightEye');
      case 'hair':
        return this.t('slotHair');
      case 'highlights':
        return this.t('slotHighlights');
      case 'skin':
        return this.t('slotSkin');
      case 'limbal':
        return slot.kind === 'tattoo' ? this.t('slotTattoo') : this.t('slotLimbal');
      case 'lip':
        return this.t('slotLips');
      case 'facePaint':
        return this.t('slotFacePaint');
      default:
        return slot.slot;
    }
  }

  private absentReason(slot: ResolvedCharaSlot): string {
    switch (slot.inertReason) {
      case 'highlightsDisabled':
        return this.t('absentHighlightsOff');
      case 'facePaintNone':
        return this.t('absentFacePaintOff');
      case 'noLip':
        return this.t('absentNoLips');
      case 'furPattern':
        return this.t('absentFurPattern');
      default:
        return this.t('absentNotInFile');
    }
  }

  /** Palette base a slot indexes into (for pins + the grid excerpt). */
  private gridRefOf(slot: ResolvedCharaSlot): CharaSlotGridRef | null {
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

  /** The colour the slot is wearing: float wins off-grid, index otherwise. */
  private winningHex(slot: ResolvedCharaSlot): string | null {
    if (slot.verdict === 'offGrid' || slot.verdict === 'floatOnly') return slot.floatHex;
    if (slot.verdict === 'index') return slot.indexHex;
    return null;
  }

  private bestDye(hex: string): { dye: Dye; deltaE: number } | null {
    let best: { dye: Dye; deltaE: number } | null = null;
    for (const dye of dyeService.getAllDyes()) {
      if (dye.itemID <= 0) continue;
      const deltaE = ColorService.getDistanceForMethod(hex, dye.hex, 'ciede2000');
      if (!best || deltaE < best.deltaE) best = { dye, deltaE };
    }
    return best;
  }

  private dyeName(dye: Dye): string {
    return LanguageService.getDyeName(dye.itemID) || dye.name;
  }

  /** Worn dyes deduped by stain ID, in wear order. */
  private wornDyes(): Array<{ stainId: number; dye: Dye | null }> {
    if (!this.resolved) return [];
    const seen = new Map<number, Dye | null>();
    for (const gear of this.resolved.gearDyes) {
      if (!seen.has(gear.stainId)) seen.set(gear.stainId, gear.dye);
    }
    return Array.from(seen.entries()).map(([stainId, dye]) => ({ stainId, dye }));
  }

  /**
   * Parse warnings for the amber card: loud slot failures (96–127 gap,
   * out-of-range index, missing tribe) and extended-appearance drift
   * (OFF GRID — the file wears a colour no cell can express).
   */
  private warnings(): Array<{ tag: string; text: string; severe: boolean }> {
    if (!this.resolved) return [];
    const out: Array<{ tag: string; text: string; severe: boolean }> = [];
    for (const slot of this.resolved.slots) {
      const label = this.slotLabel(slot);
      if (slot.verdict === 'error' && slot.error) {
        out.push({
          tag: LanguageService.t('swatch.warnErrorTag'),
          text: `${label} · ${slot.error.message}`,
          severe: true,
        });
      } else if (slot.verdict === 'offGrid' || slot.verdict === 'floatOnly') {
        out.push({
          tag: this.t('offGrid'),
          text: `${label} · ${this.t('offGridNote')}`,
          severe: false,
        });
      }
    }
    return out;
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  private render(): void {
    clearContainer(this.container);
    if (this.glamourContainer) clearContainer(this.glamourContainer);

    const style = document.createElement('style');
    style.textContent = CHARA_RESPONSIVE_CSS;
    this.container.appendChild(style);

    if (this.resolved) {
      this.container.appendChild(this.renderFileCard());
      const warnings = this.warnings();
      if (warnings.length > 0) this.container.appendChild(this.renderWarningsCard(warnings));
      // The privacy promise stays visible under the card (Extractor wording).
      this.container.appendChild(
        this.el(
          'div',
          'font-size: 10px; line-height: 1.45; color: var(--theme-text-muted); margin-bottom: 11px;',
          this.t('charaHint')
        )
      );
      this.container.appendChild(this.renderSheet());
      const glamour = this.renderGlamour();
      if (glamour) (this.glamourContainer ?? this.container).appendChild(glamour);
    } else {
      this.container.appendChild(this.renderDropZone());
    }
  }

  /** The offer above the workspace — nothing below it is disabled. */
  private renderDropZone(): HTMLElement {
    const zone = this.el(
      'div',
      'border: 1px dashed var(--theme-border); border-radius: 14px; padding: 22px 20px; text-align: center; cursor: pointer; background: var(--theme-card-background); margin-bottom: 11px;'
    );

    zone.appendChild(
      this.el(
        'div',
        `font-family: ${SANS}; font-size: 15px; font-weight: 600; color: var(--theme-text); margin-bottom: 4px;`,
        this.t('dropTitle')
      )
    );
    zone.appendChild(
      this.el(
        'div',
        'font-size: 12.5px; line-height: 1.55; color: var(--theme-text-muted); max-width: 560px; margin: 0 auto 12px;',
        this.t('dropBody')
      )
    );

    // Accent Choose-file button, 44px — the one solid-accent element here.
    const chooseBtn = this.el(
      'button',
      'height: 44px; padding: 0 18px; font-size: 13px; font-weight: 600; border-radius: 10px; border: none; background: var(--theme-primary); color: #fff; cursor: pointer; font-family: inherit;',
      this.t('chooseFile')
    );
    (chooseBtn as HTMLButtonElement).type = 'button';
    zone.appendChild(chooseBtn);

    zone.appendChild(
      this.el(
        'div',
        `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); margin-top: 12px;`,
        this.t('orGrid')
      )
    );
    zone.appendChild(
      this.el(
        'div',
        'font-size: 10px; line-height: 1.45; color: var(--theme-text-muted); margin-top: 8px;',
        this.t('charaHint')
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
   * mono meta | 44px SWAP chip. The strip is the character's own thumbnail —
   * Base64Image is never read.
   */
  private renderFileCard(): HTMLElement {
    const resolved = this.resolved!;
    const live = resolved.slots.filter((s) => this.winningHex(s) !== null);

    const card = this.el(
      'div',
      'display: flex; align-items: stretch; gap: 10px; padding: 9px; border-radius: 14px; margin-bottom: 11px; background: var(--theme-card-background); border: 1px solid var(--theme-border);'
    );

    // 46px vertical strip of the character's key colours.
    const strip = this.el(
      'span',
      `display: flex; width: 46px; flex-shrink: 0; flex-direction: column; border-radius: 9px; overflow: hidden; ${INSET_RING}`
    );
    const stripColors = live.slice(0, 5);
    if (stripColors.length === 0) {
      strip.appendChild(this.el('span', 'flex: 1; background: var(--theme-background-secondary);'));
    }
    for (const slot of stripColors) {
      strip.appendChild(this.el('span', `flex: 1; background: ${this.winningHex(slot)!};`));
    }
    card.appendChild(strip);

    // Middle column: chips, name, meta.
    const mid = this.el(
      'span',
      'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; justify-content: center;'
    );
    const chips = this.el('span', 'display: flex; gap: 6px; flex-wrap: wrap;');
    if (resolved.producer) {
      // Producer is shown so a missing slot is attributable — never used for parsing.
      chips.appendChild(
        this.monoChip(
          resolved.producer.toUpperCase().replace(' CHARACTER FILE', ''),
          'var(--theme-text-muted)',
          'var(--theme-background-secondary)'
        )
      );
    }
    const localChip = this.monoChip(this.t('localOnly'), this.green(), 'rgba(97, 197, 84, 0.16)');
    localChip.title = this.t('charaHint');
    chips.appendChild(localChip);
    mid.appendChild(chips);

    mid.appendChild(
      this.el(
        'span',
        `font-family: ${SANS}; font-weight: 600; font-size: 16px; color: var(--theme-text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`,
        resolved.nickname ?? this.fileName ?? LanguageService.t('swatch.unnamedCharacter')
      )
    );

    const genderSym = resolved.gender === 'Female' ? '♀' : resolved.gender === 'Male' ? '♂' : '';
    const meta = [
      `${resolved.tribe ?? '—'} ${genderSym}`.trim(),
      `${live.length}/${resolved.slots.length}`,
      this.fileName ?? '',
    ]
      .filter(Boolean)
      .join(' · ');
    mid.appendChild(
      this.el(
        'span',
        `font-family: ${MONO}; font-size: 10px; color: var(--theme-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`,
        meta
      )
    );
    card.appendChild(mid);

    // 44px SWAP chip — replace the file without losing the workspace.
    const swapBtn = this.el(
      'button',
      `width: 44px; flex-shrink: 0; font-family: ${MONO}; font-size: 9px; letter-spacing: 0.5px; border-radius: 9px; border: 1px solid var(--theme-border); background: var(--theme-background-secondary); color: var(--theme-text); cursor: pointer;`,
      LanguageService.t('swatch.swap')
    );
    (swapBtn as HTMLButtonElement).type = 'button';
    swapBtn.title = this.t('replaceFile');
    swapBtn.addEventListener('click', () => {
      this.resolved = null;
      this.fileName = null;
      this.selectedSlotKey = null;
      this.paletteOpen = false;
      this.paletteNameDraft = null;
      this.callbacks.onResolved?.(null);
      this.render();
    });
    card.appendChild(swapBtn);

    // Save the character's own colours (not the glamour's) as the store's
    // `kind: 'character'` record — the second half of the export flow.
    const saveBtn = this.el(
      'button',
      `flex-shrink: 0; padding: 6px 10px; font-size: 11px; font-weight: 600; border-radius: 9px; border: 1px solid var(--theme-border); background: var(--theme-background-secondary); color: var(--theme-text); cursor: pointer; font-family: inherit;`,
      LanguageService.t('swatch.saveCharacter')
    );
    (saveBtn as HTMLButtonElement).type = 'button';
    saveBtn.addEventListener('click', () => this.saveCharacterRecord());
    card.appendChild(saveBtn);

    return card;
  }

  /**
   * Save the character's resolved slot colours as a `kind: 'character'`
   * CollectionService record — each slot contributes the dye closest to the
   * colour it actually wears (the lip contributes its blend).
   */
  private saveCharacterRecord(): void {
    const resolved = this.resolved;
    if (!resolved) return;

    const stainIds: number[] = [];
    for (const slot of resolved.slots) {
      const hex = slot.blendHex ?? this.winningHex(slot);
      if (!hex) continue;
      const best = this.bestDye(hex);
      if (best?.dye.stainID != null && !stainIds.includes(best.dye.stainID)) {
        stainIds.push(best.dye.stainID);
      }
    }
    if (stainIds.length === 0) {
      ToastService.error(LanguageService.t('errors.saveChangesFailed'));
      return;
    }

    const name = (
      resolved.nickname ??
      this.fileName ??
      LanguageService.t('swatch.characterDefaultName')
    ).slice(0, 50);
    const record = CollectionService.createCollection(name, undefined, { kind: 'character' });
    if (!record) {
      ToastService.error(LanguageService.t('errors.saveChangesFailed'));
      return;
    }
    for (const stainId of stainIds) {
      CollectionService.addDyeToCollection(record.id, stainId);
    }
    logger.info(`[CharaImport] Saved character "${name}" (${stainIds.length} colours)`);
    ToastService.success(
      stainIds.length === 1
        ? LanguageService.t('swatch.characterSavedOne')
        : LanguageService.tInterpolate('swatch.characterSavedMany', { n: stainIds.length })
    );
  }

  /** Amber warnings card: one row per parse warning — TAG chip + 11px text. */
  private renderWarningsCard(
    warnings: Array<{ tag: string; text: string; severe: boolean }>
  ): HTMLElement {
    const card = this.el(
      'div',
      'display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-radius: 14px; margin-bottom: 11px; background: rgba(244, 191, 79, 0.07); border: 1px solid rgba(244, 191, 79, 0.3);'
    );
    for (const warning of warnings) {
      const row = this.el('div', 'display: flex; align-items: flex-start; gap: 7px; min-width: 0;');
      const severeRed = ThemeService.isDarkMode() ? '#f4645a' : '#B91C1C';
      row.appendChild(
        this.monoChip(
          warning.tag,
          warning.severe ? severeRed : this.amber(),
          warning.severe ? 'rgba(244, 100, 90, 0.18)' : 'rgba(244, 191, 79, 0.18)'
        )
      );
      row.appendChild(
        this.el(
          'span',
          'font-size: 11px; line-height: 1.45; color: var(--theme-text); min-width: 0;',
          warning.text
        )
      );
      card.appendChild(row);
    }
    return card;
  }

  /** THIS CHARACTER — one card per slot, best dye already on it. */
  private renderSheet(): HTMLElement {
    const resolved = this.resolved!;
    const live = resolved.slots.filter((s) => this.winningHex(s) !== null);
    const section = this.el('div', '');

    const header = this.el(
      'div',
      'display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px;'
    );
    header.appendChild(
      this.el(
        'span',
        `font-family: ${MONO}; font-size: 9.5px; letter-spacing: 1.2px; color: var(--theme-text-muted); text-transform: uppercase;`,
        this.t('slotsHead')
      )
    );
    header.appendChild(
      this.el(
        'span',
        `font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.5px; color: var(--theme-text-muted);`,
        `${live.length} / ${resolved.slots.length}`
      )
    );
    section.appendChild(header);

    const grid = this.el('div', 'margin-bottom: 13px;');
    grid.className = 'chara-slots-grid';
    for (const slot of resolved.slots) {
      grid.appendChild(this.renderSlotCard(slot));
    }
    section.appendChild(grid);
    return section;
  }

  private renderSlotCard(slot: ResolvedCharaSlot): HTMLElement {
    const label = this.slotLabel(slot);
    const hex = this.winningHex(slot);
    const ramp = this.ramp();

    if (!hex) {
      // Absent, inert or error — dashed, with the reason. A fact, not a failure.
      const isError = slot.verdict === 'error';
      const card = this.el(
        'div',
        `border: 1px dashed ${isError ? 'rgba(244, 100, 90, 0.5)' : 'var(--theme-border)'}; border-radius: 11px; padding: 8px; display: flex; flex-direction: column; gap: 6px; min-height: 64px; box-sizing: border-box;`
      );
      const head = this.el('div', 'display: flex; align-items: center; gap: 6px; min-width: 0;');
      // Hatched chip — visibly not a colour.
      head.appendChild(
        this.el(
          'span',
          'width: 26px; height: 26px; border-radius: 7px; flex: 0 0 auto; background: repeating-linear-gradient(45deg, transparent, transparent 3px, var(--theme-border) 3px, var(--theme-border) 4px);'
        )
      );
      head.appendChild(
        this.el(
          'span',
          'font-size: 11.5px; font-weight: 600; color: var(--theme-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          label
        )
      );
      card.appendChild(head);
      card.appendChild(
        this.el(
          'span',
          `font-size: 10px; line-height: 1.4; color: ${isError ? (ThemeService.isDarkMode() ? '#f4645a' : '#B91C1C') : 'var(--theme-text-muted)'};`,
          isError ? (slot.error?.message ?? '') : this.absentReason(slot)
        )
      );
      return card;
    }

    const offGrid = slot.verdict === 'offGrid' || slot.verdict === 'floatOnly';
    const selected = this.selectedSlotKey === slot.slot;
    const card = this.el(
      'button',
      `display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 11px; cursor: pointer; text-align: left; font-family: inherit; box-sizing: border-box; width: 100%; background: ${
        selected
          ? 'color-mix(in srgb, var(--theme-primary) 12%, transparent)'
          : 'var(--theme-card-background)'
      }; border: 1px solid ${selected ? 'var(--theme-primary)' : 'var(--theme-border)'}; box-shadow: ${
        selected ? '0 0 0 1px var(--theme-primary)' : 'none'
      };`
    );
    (card as HTMLButtonElement).type = 'button';

    // Top row: 26px swatch + label over address.
    const head = this.el('span', 'display: flex; align-items: center; gap: 6px; min-width: 0;');
    head.appendChild(
      this.el(
        'span',
        `width: 26px; height: 26px; border-radius: 7px; flex: 0 0 auto; background: ${hex}; ${INSET_RING}`
      )
    );
    const headText = this.el(
      'span',
      'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;'
    );
    headText.appendChild(
      this.el(
        'span',
        'font-size: 11.5px; font-weight: 600; color: var(--theme-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
        label
      )
    );
    // Address line: R·C in the creator, or amber OFF GRID — never a fake one.
    const addrStyle = `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
    if (offGrid) {
      const addr = this.el('span', `${addrStyle} color: ${this.amber()};`, this.t('offGrid'));
      addr.title = this.t('offGridNote');
      headText.appendChild(addr);
    } else {
      const addrText =
        slot.sheetVariant === 'light'
          ? `${slot.gridAddress ?? ''} · ${this.t('rangeLight')}`
          : (slot.gridAddress ?? '');
      const addr = this.el('span', `${addrStyle} color: var(--theme-text-muted);`, addrText);
      if (slot.indexWinNote) {
        addr.title = this.t('indexWinsNote');
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
      const blendRow = this.el(
        'span',
        'display: flex; align-items: center; gap: 5px; min-width: 0; width: 100%;'
      );
      blendRow.appendChild(
        this.el(
          'span',
          `width: 13px; height: 13px; border-radius: 4px; flex: 0 0 auto; background: ${blend}; ${INSET_RING}`
        )
      );
      blendRow.appendChild(
        this.el(
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
    const best = this.bestDye(effective);
    if (best) {
      const tier = classifyBandTier(
        roundToBandDisplay(best.deltaE, 'ciede2000'),
        'ciede2000',
        'match'
      );
      const row = this.el(
        'span',
        'display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; width: 100%;'
      );
      const left = this.el('span', 'display: flex; align-items: center; gap: 5px; min-width: 0;');
      left.appendChild(
        this.el(
          'span',
          `width: 13px; height: 13px; border-radius: 4px; flex: 0 0 auto; background: ${best.dye.hex}; ${INSET_RING}`
        )
      );
      left.appendChild(
        this.el(
          'span',
          'font-size: 10px; color: var(--theme-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          this.dyeName(best.dye)
        )
      );
      row.appendChild(left);
      row.appendChild(
        this.el(
          'span',
          `font-family: ${MONO}; font-size: 11px; color: ${ramp[tier]}; flex: 0 0 auto;`,
          roundToBandDisplay(best.deltaE, 'ciede2000').toFixed(1)
        )
      );
      card.appendChild(row);
      card.title = `${label} · ${effective.toUpperCase()} → ${this.dyeName(best.dye)}`;
    }

    card.addEventListener('click', () => {
      this.selectedSlotKey = slot.slot;
      this.render();
      this.callbacks.onSlotPick(effective, label, offGrid ? null : this.gridRefOf(slot));
    });

    return card;
  }

  // ==========================================================================
  // DYES ON THIS GLAMOUR + Make a palette
  // ==========================================================================

  private renderGlamour(): HTMLElement | null {
    const resolved = this.resolved!;
    if (resolved.gearDyes.length === 0) return null;

    const box = this.el(
      'div',
      'padding: 11px 12px; border-radius: 14px; margin-bottom: 12px; background: var(--theme-background-secondary); border: 1px solid var(--theme-border); display: flex; flex-direction: column; gap: 9px; width: 100%; box-sizing: border-box;'
    );

    // Header: equipHead + counts left, Make-a-palette button right.
    const uniq = this.wornDyes();
    const channelCount = resolved.gearDyes.length;

    const header = this.el(
      'div',
      'display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;'
    );
    const headerLeft = this.el(
      'span',
      'display: flex; align-items: baseline; gap: 8px; min-width: 0; flex-wrap: wrap;'
    );
    headerLeft.appendChild(
      this.el(
        'span',
        `font-family: ${MONO}; font-size: 9.5px; letter-spacing: 1.2px; color: var(--theme-text-muted); text-transform: uppercase;`,
        this.t('equipHead')
      )
    );
    headerLeft.appendChild(
      this.el(
        'span',
        `font-family: ${MONO}; font-size: 9px; letter-spacing: 0.5px; color: var(--theme-text-muted);`,
        LanguageService.tInterpolate('swatch.equipCount', {
          channels: channelCount,
          dyes: uniq.length,
        })
      )
    );
    header.appendChild(headerLeft);

    const paletteBtn = this.el(
      'button',
      `display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 11px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600; ${
        this.paletteOpen
          ? 'background: var(--theme-primary); color: #fff; border: 1px solid var(--theme-primary);'
          : 'background: var(--theme-card-background); color: var(--theme-text); border: 1px solid var(--theme-border);'
      }`
    );
    (paletteBtn as HTMLButtonElement).type = 'button';
    const glyph = this.el(
      'span',
      'display: block; width: 14px; height: 14px; flex-shrink: 0; color: currentColor;'
    );
    glyph.innerHTML = ICON_TOOL_PRESETS || '';
    paletteBtn.appendChild(glyph);
    paletteBtn.appendChild(this.el('span', '', this.t('makePalette')));
    paletteBtn.addEventListener('click', () => {
      this.paletteOpen = !this.paletteOpen;
      this.render();
    });
    header.appendChild(paletteBtn);
    box.appendChild(header);

    // Equip rows — one 40px row per gear slot, both channels as 20×26 chips.
    const bySlot = new Map<string, typeof resolved.gearDyes>();
    for (const gear of resolved.gearDyes) {
      const list = bySlot.get(gear.slot) ?? [];
      list.push(gear);
      bySlot.set(gear.slot, list);
    }

    const equipGrid = this.el('div', '');
    equipGrid.className = 'chara-equip-grid';
    for (const [slotId, dyes] of bySlot) {
      const row = this.el(
        'div',
        'display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 5px 7px; border-radius: 9px; background: var(--theme-card-background); border: 1px solid var(--theme-border); box-sizing: border-box; min-width: 0;'
      );
      const chips = this.el('span', 'display: flex; gap: 3px; flex-shrink: 0;');
      for (const gear of dyes) {
        const chip = this.el(
          'span',
          `width: 20px; height: 26px; border-radius: 5px; background: ${
            gear.dye?.hex ?? 'transparent'
          }; ${gear.dye ? INSET_RING : 'border: 1px dashed var(--theme-border); box-sizing: border-box;'}`
        );
        chip.title = gear.dye ? `${this.dyeName(gear.dye)} · ${gear.stainId}` : `#${gear.stainId}`;
        chips.appendChild(chip);
      }
      row.appendChild(chips);

      const text = this.el(
        'span',
        'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px;'
      );
      // Gear slot tags are identifiers — mono, never localised.
      text.appendChild(
        this.el(
          'span',
          `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.5px; color: var(--theme-text-muted); text-transform: uppercase;`,
          slotId
        )
      );
      text.appendChild(
        this.el(
          'span',
          'font-size: 10.5px; color: var(--theme-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          dyes.map((g) => (g.dye ? this.dyeName(g.dye) : `#${g.stainId}`)).join(' + ')
        )
      );
      row.appendChild(text);
      equipGrid.appendChild(row);
    }
    box.appendChild(equipGrid);

    // Hint + undyed note. DyeId 0 is undyed, not black.
    const undyedCount = 12 - bySlot.size;
    box.appendChild(
      this.el(
        'div',
        'font-size: 10px; line-height: 1.5; color: var(--theme-text-muted);',
        undyedCount > 0
          ? `${this.t('gearHint')} ${undyedCount === 1 ? LanguageService.t('swatch.undyedNoteOne') : LanguageService.tInterpolate('swatch.undyedNoteMany', { n: undyedCount })}`
          : this.t('gearHint')
      )
    );

    if (this.paletteOpen) {
      box.appendChild(this.renderPalettePanel());
    }

    return box;
  }

  /**
   * Make-a-palette panel. Floor 3 / hard cap 6 are ENFORCED at the action
   * buttons (disabled + inert outside the window), not just recoloured.
   */
  private renderPalettePanel(): HTMLElement {
    const resolved = this.resolved!;
    const worn = this.wornDyes().filter((w) => w.dye !== null) as Array<{
      stainId: number;
      dye: Dye;
    }>;
    const kept = worn.filter((w) => !this.droppedStainIds.has(w.stainId));
    const tooFew = kept.length < PALETTE_FLOOR;
    const overCap = kept.length > PALETTE_CAP;
    const valid = !tooFew && !overCap;

    const panel = this.el(
      'div',
      'border-top: 1px solid var(--theme-border); padding-top: 9px; display: flex; flex-direction: column; gap: 8px;'
    );

    // Title + 3–6 counter (colour = validity).
    const titleRow = this.el(
      'div',
      'display: flex; align-items: baseline; justify-content: space-between; gap: 8px;'
    );
    titleRow.appendChild(
      this.el(
        'span',
        'font-size: 12.5px; font-weight: 600; color: var(--theme-text);',
        this.t('paletteTitle')
      )
    );
    titleRow.appendChild(
      this.el(
        'span',
        `font-family: ${MONO}; font-size: 10.5px; color: ${valid ? this.green() : this.amber()};`,
        `${kept.length} / ${PALETTE_CAP}`
      )
    );
    panel.appendChild(titleRow);

    // Name input — defaults to the character's nickname.
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = this.paletteNameDraft ?? resolved.nickname ?? '';
    nameInput.placeholder = this.t('paletteNamePlaceholder');
    nameInput.maxLength = 50;
    nameInput.setAttribute(
      'style',
      'height: 36px; box-sizing: border-box; width: 100%; padding: 0 10px; border-radius: 9px; font-family: inherit; font-size: 12.5px; background: var(--theme-input-background); border: 1px solid var(--theme-border); color: var(--theme-text);'
    );
    nameInput.addEventListener('input', () => {
      this.paletteNameDraft = nameInput.value;
    });
    panel.appendChild(nameInput);
    panel.appendChild(
      this.el(
        'div',
        'font-size: 10px; line-height: 1.5; color: var(--theme-text-muted);',
        this.t('paletteNameHint')
      )
    );

    // Dye toggle chips — 18px swatch + name + mono stainID; dimmed when dropped.
    const chipRow = this.el(
      'div',
      'display: flex; align-items: center; gap: 6px; flex-wrap: wrap;'
    );
    for (const entry of worn) {
      const dropped = this.droppedStainIds.has(entry.stainId);
      const chip = this.el(
        'button',
        `display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 999px; cursor: pointer; font-family: inherit; border: 1px solid var(--theme-border); background: ${
          dropped ? 'transparent' : 'var(--theme-card-background)'
        }; color: var(--theme-text); opacity: ${dropped ? '0.5' : '1'};`
      );
      (chip as HTMLButtonElement).type = 'button';
      chip.appendChild(
        this.el(
          'span',
          `width: 18px; height: 18px; border-radius: 5px; flex: 0 0 auto; background: ${entry.dye.hex}; ${INSET_RING}`
        )
      );
      chip.appendChild(this.el('span', 'font-size: 11px;', this.dyeName(entry.dye)));
      chip.appendChild(
        this.el(
          'span',
          `font-family: ${MONO}; font-size: 8.5px; color: var(--theme-text-muted);`,
          String(entry.stainId)
        )
      );
      chip.title = `${this.dyeName(entry.dye)} · ${entry.stainId}`;
      chip.addEventListener('click', () => {
        if (dropped) this.droppedStainIds.delete(entry.stainId);
        else this.droppedStainIds.add(entry.stainId);
        this.render();
      });
      chipRow.appendChild(chip);
    }
    panel.appendChild(chipRow);

    // 24px strip preview of the kept dyes.
    if (kept.length > 0) {
      const strip = this.el(
        'div',
        `display: flex; height: 24px; border-radius: 6px; overflow: hidden; ${INSET_RING}`
      );
      for (const entry of kept) {
        strip.appendChild(this.el('span', `flex: 1; background: ${entry.dye.hex};`));
      }
      panel.appendChild(strip);
    }

    // Amber card saying why the actions are locked, in both directions.
    if (!valid) {
      const warn = this.el(
        'div',
        'display: flex; align-items: flex-start; gap: 7px; padding: 7px 9px; border-radius: 9px; background: rgba(244, 191, 79, 0.07); border: 1px solid rgba(244, 191, 79, 0.3);'
      );
      warn.appendChild(
        this.monoChip(
          tooFew ? LanguageService.t('swatch.tooFewTag') : `${PALETTE_FLOOR}–${PALETTE_CAP}`,
          this.amber(),
          'rgba(244, 191, 79, 0.18)'
        )
      );
      warn.appendChild(
        this.el(
          'span',
          'font-size: 11px; line-height: 1.45; color: var(--theme-text);',
          tooFew
            ? LanguageService.t('swatch.tooFewBody')
            : LanguageService.tInterpolate('swatch.overCapBody', { n: kept.length })
        )
      );
      panel.appendChild(warn);
    }

    // Actions: Save to this device (outlined chip) · Submit to Community
    // (accent solid). Both 40px; both dead outside 3–6.
    const actions = this.el('div', 'display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px;');
    const actionState = valid
      ? 'cursor: pointer; opacity: 1;'
      : 'cursor: not-allowed; opacity: 0.45;';

    const saveBtn = this.el(
      'button',
      `height: 40px; padding: 0 14px; border-radius: 10px; font-family: inherit; font-size: 12.5px; font-weight: 600; background: var(--theme-card-background); border: 1px solid var(--theme-border); color: var(--theme-text); ${actionState}`,
      this.t('saveLocal')
    );
    (saveBtn as HTMLButtonElement).type = 'button';
    (saveBtn as HTMLButtonElement).disabled = !valid;
    if (valid) {
      saveBtn.addEventListener('click', () => this.saveLocalPalette(kept));
    }
    actions.appendChild(saveBtn);

    if (this.callbacks.onSubmitPalette) {
      const submitBtn = this.el(
        'button',
        `height: 40px; padding: 0 14px; border-radius: 10px; font-family: inherit; font-size: 12.5px; font-weight: 600; background: var(--theme-primary); border: none; color: #fff; ${actionState}`,
        this.t('submitCommunity')
      );
      (submitBtn as HTMLButtonElement).type = 'button';
      (submitBtn as HTMLButtonElement).disabled = !valid;
      if (valid) {
        submitBtn.addEventListener('click', () => {
          this.callbacks.onSubmitPalette?.(
            kept.map((w) => w.dye),
            this.paletteName()
          );
        });
      }
      actions.appendChild(submitBtn);
    }
    panel.appendChild(actions);

    return panel;
  }

  private paletteName(): string {
    const draft = (this.paletteNameDraft ?? this.resolved?.nickname ?? '').trim();
    return (
      draft ||
      this.fileName?.replace(/\.chara$/i, '') ||
      LanguageService.t('swatch.paletteDefaultName')
    ).slice(0, 50);
  }

  /**
   * Save to this device — a `kind: 'palette'` record in the one
   * CollectionService store (the 10A glamour export's sibling record).
   */
  private saveLocalPalette(kept: Array<{ stainId: number; dye: Dye }>): void {
    const base = this.paletteName();
    let name = base;
    let suffix = 1;
    while (CollectionService.getCollectionByName(name)) {
      // Trim the base, never the suffix — a 50-char base would otherwise
      // truncate back to itself and never terminate.
      const tag = ` (${suffix++})`;
      name = `${base.slice(0, 50 - tag.length)}${tag}`;
    }
    const record = CollectionService.createCollection(name, undefined, { kind: 'palette' });
    if (!record) {
      ToastService.error(LanguageService.t('errors.saveChangesFailed'));
      return;
    }
    for (const entry of kept) {
      CollectionService.addDyeToCollection(record.id, entry.stainId);
    }
    logger.info(`[CharaImport] Saved glamour palette "${name}" (${kept.length} dyes)`);
    ToastService.success(LanguageService.t('palette.saveSuccess'));
  }
}
