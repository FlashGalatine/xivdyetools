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
  formatCharaModelLabel,
  type ResolvedCharaCharacter,
  type ResolvedCharaSlot,
  type ResolvedGearDye,
  type CharaGearSlotId,
  type CharaSlotErrorCode,
} from '@xivdyetools/core';
import {
  ColorService,
  CollectionService,
  dyeService,
  LanguageService,
  StorageService,
  ToastService,
} from '@services/index';
import { ThemeService } from '@services/theme-service';
import {
  resolveCharaEquipment,
  itemNameFor,
  charaIconUrl,
  type CharaResolveResult,
  type CharaResolvedItem,
} from '@services/chara-resolve-service';
import { ICON_TOOL_PRESETS } from '@shared/tool-icons';
import { STORAGE_PREFIX } from '@shared/constants';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import { SUBRACE_TO_CLAN_KEY } from '@shared/subrace-clan';
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

/** The twelve dyeable slots — the footnote's "N slots are empty" denominator. */
const GEAR_SLOT_COUNT = 12;

/**
 * Core slot-failure code → locale key. Spelled out (not `` `swatch.slotError.${code}` ``)
 * so every key is a literal the orphan scanner can see, and so an unmapped
 * code degrades to `swatch.slotError.unknown` instead of printing a raw path.
 */
const SLOT_ERROR_KEY: Record<CharaSlotErrorCode, string> = {
  midRangeIndex: 'swatch.slotError.midRangeIndex',
  indexOutOfRange: 'swatch.slotError.indexOutOfRange',
  noTribe: 'swatch.slotError.noTribe',
};

/**
 * DYES ON THIS GLAMOUR lens (Turn 11, confirmed): Pieces (11a, default) puts
 * the item under the dyes' feet; Dyes (11c) flips the unit to the dye with
 * carriers as icons. Persists per user.
 */
type GlamourView = 'pieces' | 'dyes';
const GLAMOUR_VIEW_KEY = `${STORAGE_PREFIX}_swatch_glamour_view`;

function readGlamourView(): GlamourView {
  return StorageService.getItem<string>(GLAMOUR_VIEW_KEY) === 'dyes' ? 'dyes' : 'pieces';
}

/**
 * Responsive grids for the sheet — injected once per render (shadow-DOM scoped).
 * The equip grid is 2-up (Turn 11: rows grew 40 → 48 px and the JA/DE item
 * names are the width budget — they wrap, never ellipsise).
 */
const CHARA_RESPONSIVE_CSS = `
.chara-slots-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
.chara-equip-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
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
  /** Equipment identity from api-worker — null until the round-trip lands */
  private equipment: CharaResolveResult | null = null;
  private resolveState: 'idle' | 'resolving' | 'ready' | 'unavailable' = 'idle';
  private resolveAbort: AbortController | null = null;
  /** Pieces (11a, default) or Dyes (11c) — persists per user */
  private glamourView: GlamourView;
  /** The mounted DYES ON THIS GLAMOUR block, re-rendered in place when names land */
  private glamourBox: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    callbacks: CharaImportCallbacks,
    options?: CharaImportOptions
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.glamourContainer = options?.glamourContainer ?? null;
    this.glamourView = readGlamourView();
  }

  init(): void {
    this.render();
  }

  destroy(): void {
    this.resolveAbort?.abort();
    this.resolveAbort = null;
    clearContainer(this.container);
    if (this.glamourContainer) clearContainer(this.glamourContainer);
    this.resolved = null;
    this.equipment = null;
    this.glamourBox = null;
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
      // Loud failure naming the field and value — core's messages do that,
      // and they ride in as {reason} inside the localized sentence.
      ToastService.error(
        LanguageService.tInterpolate('swatch.parseFailed', {
          reason: error instanceof Error ? error.message : String(error),
        })
      );
      return;
    }
    // Dyes never wait: the round-trip is started first so the block renders
    // in its RESOLVING state (skeleton where the name lands) with the file's
    // stains already on it; the names re-render the block in place.
    this.startResolve();
    this.render();
  }

  // ==========================================================================
  // Equipment identity (Turn 11) — the resolve round-trip
  // ==========================================================================

  /**
   * One POST per file — model keys only, nothing else from the file. A
   * failure costs labels, not data: the rows fall back to exactly the shipped
   * row (slot tag + dye names) plus one quiet line under the list.
   */
  private startResolve(): void {
    this.resolveAbort?.abort();
    this.resolveAbort = null;
    this.equipment = null;
    const resolved = this.resolved;
    if (!resolved) {
      this.resolveState = 'idle';
      return;
    }
    if (resolved.gearModels.length === 0 && resolved.glassesId === null) {
      this.resolveState = 'ready';
      this.equipment = { items: {}, glasses: null, version: null };
      return;
    }
    const controller = new AbortController();
    this.resolveAbort = controller;
    this.resolveState = 'resolving';
    void resolveCharaEquipment(resolved.gearModels, resolved.glassesId, controller.signal).then(
      (result) => {
        if (controller.signal.aborted || this.resolved !== resolved) return;
        this.equipment = result;
        this.resolveState = 'ready';
        this.rerenderGlamour();
      },
      (error: unknown) => {
        if (controller.signal.aborted || this.resolved !== resolved) return;
        logger.warn('[CharaImport] Equipment names unavailable:', error);
        this.resolveState = 'unavailable';
        this.rerenderGlamour();
      }
    );
  }

  /**
   * What api-worker said about a slot: an item, `null` for "no Item row"
   * (NPC / prop model), or `undefined` when nothing has been said yet — not
   * resolved, unavailable, or a dye on a slot the file wears nothing in.
   */
  private itemFor(slot: CharaGearSlotId): CharaResolvedItem | null | undefined {
    return this.equipment?.items[slot];
  }

  /** Swap the mounted block for a fresh render — the sheet above is untouched. */
  private rerenderGlamour(): void {
    const old = this.glamourBox;
    if (!old || !old.isConnected) return;
    const fresh = this.renderGlamour();
    if (fresh) old.replaceWith(fresh);
    else old.remove();
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private t(key: string): string {
    return LanguageService.t(`swatch.${key}`);
  }

  /**
   * Localized text for a core slot-failure code.
   *
   * Core's `error.message` is an EN engineering sentence naming the field and
   * the index ("LipsToneFurPattern index 100 falls in the 96-127 gap…") — good
   * for a log, not for a card. The `code` is the stable part, so the keys are
   * spelled out literally here (one `Record` entry each) rather than built
   * with a template: `scripts/analyze-unused-keys.js` only sees literals and a
   * literal prefix, and a spelled-out map also survives a code being added
   * upstream — anything unrecognised falls back to `slotError.unknown`.
   */
  private slotErrorText(code: CharaSlotErrorCode | undefined): string {
    const key = code ? SLOT_ERROR_KEY[code] : undefined;
    return LanguageService.t(key ?? 'swatch.slotError.unknown');
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
          text: `${label} · ${this.slotErrorText(slot.error.code)}`,
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
    const tribeLabel = resolved.tribe
      ? LanguageService.getClan(SUBRACE_TO_CLAN_KEY[resolved.tribe])
      : '—';
    const meta = [
      `${tribeLabel} ${genderSym}`.trim(),
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
      this.resolveAbort?.abort();
      this.resolveAbort = null;
      this.resolved = null;
      this.equipment = null;
      this.resolveState = 'idle';
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
          isError ? this.slotErrorText(slot.error?.code) : this.absentReason(slot)
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

  /**
   * Turn 11 (confirmed): 11a Named rows is the default lens — each dyed piece
   * gains the item it sits on (icon, slot overline, name, dyes, chips at the
   * row's end); 11c Dye-led is the second lens — one row per unique dye with
   * its carriers as icons. Both sit behind the Pieces/Dyes toggle in the
   * block head. Only DYED pieces are rows; the footnote splits worn-undyed
   * pieces from empty slots. Five states ride either lens: RESOLVING
   * (skeleton where the name lands), NAMES UNAVAILABLE (shipped row + one
   * quiet line), SAME MODEL ×N (badge + tooltip), NO ITEM ROW (the packed
   * key), ICON MISSING (a blank tile, never a broken row).
   */
  private renderGlamour(): HTMLElement | null {
    const resolved = this.resolved!;
    if (resolved.gearDyes.length === 0) {
      this.glamourBox = null;
      return null;
    }

    const box = this.el(
      'div',
      'padding: 11px 12px; border-radius: 14px; margin-bottom: 12px; background: var(--theme-background-secondary); border: 1px solid var(--theme-border); display: flex; flex-direction: column; gap: 9px; width: 100%; box-sizing: border-box;'
    );
    box.dataset.role = 'glamour-block';
    this.glamourBox = box;

    // Header: equipHead + counts left; Pieces/Dyes toggle + Make-a-palette right.
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

    const headerRight = this.el(
      'span',
      'display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex-shrink: 0;'
    );
    headerRight.appendChild(this.renderViewToggle());

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
    headerRight.appendChild(paletteBtn);
    header.appendChild(headerRight);
    box.appendChild(header);

    const bySlot = this.dyesBySlot();
    box.appendChild(
      this.glamourView === 'dyes' ? this.renderDyeRows() : this.renderPieceRows(bySlot)
    );
    box.appendChild(this.renderGlamourFoot(bySlot));

    if (this.paletteOpen) {
      box.appendChild(this.renderPalettePanel());
    }

    return box;
  }

  /** Dyed channels grouped by slot, in file slot order. */
  private dyesBySlot(): Map<CharaGearSlotId, ResolvedGearDye[]> {
    const bySlot = new Map<CharaGearSlotId, ResolvedGearDye[]>();
    for (const gear of this.resolved!.gearDyes) {
      const list = bySlot.get(gear.slot) ?? [];
      list.push(gear);
      bySlot.set(gear.slot, list);
    }
    return bySlot;
  }

  /** Localised slot label (the design's GEAR_LABELS) — the mono overline uppercases it. */
  private gearSlotLabel(slot: CharaGearSlotId): string {
    return this.t(`gearSlot.${slot}`);
  }

  /** Pieces | Dyes — two-position pill, accent on the live lens. */
  private renderViewToggle(): HTMLElement {
    const wrap = this.el(
      'span',
      'display: inline-flex; gap: 2px; padding: 2px; border-radius: 8px; background: var(--theme-card-background); border: 1px solid var(--theme-border);'
    );
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', this.t('equipHead'));
    for (const view of ['pieces', 'dyes'] as const) {
      const active = this.glamourView === view;
      const btn = this.el(
        'button',
        `min-height: 26px; padding: 0 10px; border-radius: 6px; cursor: pointer; font-family: ${SANS}; font-weight: 600; font-size: 11px; border: none; ${
          active
            ? 'background: var(--theme-primary); color: #fff;'
            : 'background: transparent; color: var(--theme-text-muted);'
        }`,
        this.t(view === 'pieces' ? 'glamourViewPieces' : 'glamourViewDyes')
      );
      (btn as HTMLButtonElement).type = 'button';
      btn.setAttribute('aria-pressed', String(active));
      btn.dataset.glamourView = view;
      btn.addEventListener('click', () => {
        if (this.glamourView === view) return;
        this.glamourView = view;
        StorageService.setItem(GLAMOUR_VIEW_KEY, view);
        this.rerenderGlamour();
      });
      wrap.appendChild(btn);
    }
    return wrap;
  }

  /** 20×26 dye chip — the suite's swatch vocabulary; dashed when the stain is unknown. */
  private dyeChip(gear: ResolvedGearDye): HTMLElement {
    const chip = this.el(
      'span',
      `display: block; width: 20px; height: 26px; border-radius: 5px; background: ${
        gear.dye?.hex ?? 'transparent'
      }; ${gear.dye ? INSET_RING : 'border: 1px dashed var(--theme-border); box-sizing: border-box;'}`
    );
    chip.title = gear.dye ? `${this.dyeName(gear.dye)} · ${gear.stainId}` : `#${gear.stainId}`;
    return chip;
  }

  /** 11a — one 48px row per DYED piece: icon · slot overline (+N) · name · dyes · chips. */
  private renderPieceRows(bySlot: Map<CharaGearSlotId, ResolvedGearDye[]>): HTMLElement {
    const grid = this.el('div', '');
    grid.className = 'chara-equip-grid';
    grid.dataset.role = 'piece-rows';
    const lang = LanguageService.getCurrentLocale();
    for (const [slot, dyes] of bySlot) {
      grid.appendChild(this.renderPieceRow(slot, dyes, lang));
    }
    return grid;
  }

  private renderPieceRow(
    slot: CharaGearSlotId,
    dyes: ResolvedGearDye[],
    lang: string
  ): HTMLElement {
    const item = this.itemFor(slot);
    const model = this.resolved!.gearModels.find((m) => m.slot === slot) ?? null;

    const row = this.el(
      'div',
      'display: flex; align-items: center; gap: 9px; min-height: 48px; padding: 6px 8px; border-radius: 9px; background: var(--theme-card-background); border: 1px solid var(--theme-border); box-sizing: border-box; min-width: 0;'
    );
    row.dataset.slot = slot;

    // 28px icon tile. A failed asset leaves the tile blank — ICON MISSING
    // costs the tile, not the row (background-image errors are silent).
    const tile = this.el(
      'span',
      'display: block; width: 28px; height: 28px; flex-shrink: 0; border-radius: 6px; background-color: var(--theme-background-secondary); background-size: cover; background-position: center;'
    );
    tile.setAttribute('aria-hidden', 'true');
    tile.dataset.role = 'item-icon';
    if (item?.iconId) tile.style.backgroundImage = `url("${charaIconUrl(item.iconId)}")`;
    row.appendChild(tile);

    const text = this.el(
      'span',
      'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;'
    );

    // Overline: localised slot tag (mono, uppercased) + SAME MODEL badge.
    const overline = this.el(
      'span',
      'display: flex; align-items: baseline; gap: 6px; min-width: 0;'
    );
    overline.appendChild(
      this.el(
        'span',
        `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.7px; color: var(--theme-text-muted); text-transform: uppercase; white-space: nowrap;`,
        this.gearSlotLabel(slot)
      )
    );
    if (item && item.familySize > 1) {
      // A third of all keys are families of visually identical items. The
      // name never pretends to be unique: +N counts the rest, the tooltip
      // lists them, prefixes are never stripped.
      const badge = this.el(
        'span',
        `font-family: ${MONO}; font-size: 8.5px; color: var(--theme-primary); background: color-mix(in srgb, var(--theme-primary) 12%, transparent); border-radius: 4px; padding: 1px 5px; cursor: help; white-space: nowrap;`,
        `+${item.familySize - 1}`
      );
      // `Intl.ListFormat` rather than `join(', ')`: a comma is not the list
      // separator in every language (ja/zh use 、, and ko/de/fr add a
      // conjunction), and the tooltip is prose, not data.
      const alternates = new Intl.ListFormat(lang, { style: 'short', type: 'unit' }).format(
        item.alternates.map((a) => itemNameFor(a.names, lang))
      );
      const truncated = item.familySize - 1 > item.alternates.length ? ' …' : '';
      badge.title = `${LanguageService.tInterpolate('swatch.sameModelList', {
        list: alternates,
      })}${truncated}`;
      badge.dataset.role = 'same-model';
      overline.appendChild(badge);
    }
    text.appendChild(overline);

    if (item) {
      // The item name is the label here: it wraps with lang + hyphens,
      // never an ellipsis.
      const name = this.el(
        'span',
        'font-size: 11.5px; line-height: 1.3; font-weight: 600; color: var(--theme-text); overflow-wrap: anywhere; hyphens: auto;',
        itemNameFor(item.names, lang)
      );
      name.lang = lang;
      name.dataset.role = 'item-name';
      text.appendChild(name);
    } else if (this.resolveState === 'resolving') {
      // RESOLVING — a skeleton where the name will land, never a spinner
      // over the chips.
      const skeleton = this.el(
        'span',
        'display: block; width: 128px; max-width: 100%; height: 9px; margin: 3px 0; border-radius: 4px; background: color-mix(in srgb, var(--theme-text) 12%, transparent);'
      );
      skeleton.setAttribute('aria-hidden', 'true');
      skeleton.dataset.role = 'name-skeleton';
      text.appendChild(skeleton);
    } else if (item === null && model) {
      // NO ITEM ROW — NPC and prop models have none. The packed key is the
      // honest label: never an error, never a guess.
      const key = this.el(
        'span',
        `font-family: ${MONO}; font-size: 10px; letter-spacing: 0.5px; color: var(--theme-text-muted);`,
        LanguageService.tInterpolate('swatch.modelKeyTag', {
          key: formatCharaModelLabel(model),
        })
      );
      key.dataset.role = 'model-key';
      text.appendChild(key);
    }
    // NAMES UNAVAILABLE (or a dye on a slot wearing nothing): exactly the
    // shipped row — slot tag and dye names — with no name line at all.

    text.appendChild(
      this.el(
        'span',
        'font-size: 10px; line-height: 1.3; color: var(--theme-text-muted); overflow-wrap: anywhere;',
        dyes.map((g) => (g.dye ? this.dyeName(g.dye) : `#${g.stainId}`)).join(' + ')
      )
    );
    row.appendChild(text);

    const chips = this.el('span', 'display: flex; gap: 3px; flex-shrink: 0;');
    for (const gear of dyes) chips.appendChild(this.dyeChip(gear));
    row.appendChild(chips);

    if (item) row.title = itemNameFor(item.names, lang);
    return row;
  }

  /** 11c — one 44px row per unique dye: chip · name + ID · carriers as icons · ×N. */
  private renderDyeRows(): HTMLElement {
    const grid = this.el('div', '');
    grid.className = 'chara-equip-grid';
    grid.dataset.role = 'dye-rows';
    const lang = LanguageService.getCurrentLocale();

    // Unique dyes in wear order, each with its channel count and carriers.
    const order: number[] = [];
    const info = new Map<
      number,
      { dye: Dye | null; channels: number; carriers: CharaGearSlotId[] }
    >();
    for (const gear of this.resolved!.gearDyes) {
      let entry = info.get(gear.stainId);
      if (!entry) {
        entry = { dye: gear.dye, channels: 0, carriers: [] };
        info.set(gear.stainId, entry);
        order.push(gear.stainId);
      }
      entry.channels++;
      if (!entry.carriers.includes(gear.slot)) entry.carriers.push(gear.slot);
    }

    for (const stainId of order) {
      const entry = info.get(stainId)!;
      const row = this.el(
        'div',
        'display: flex; align-items: center; gap: 9px; min-height: 44px; padding: 6px 8px; border-radius: 9px; background: var(--theme-card-background); border: 1px solid var(--theme-border); box-sizing: border-box; min-width: 0;'
      );
      row.dataset.stainId = String(stainId);

      row.appendChild(
        this.el(
          'span',
          `display: block; width: 22px; height: 28px; flex-shrink: 0; border-radius: 5px; background: ${
            entry.dye?.hex ?? 'transparent'
          }; ${entry.dye ? INSET_RING : 'border: 1px dashed var(--theme-border); box-sizing: border-box;'}`
        )
      );

      const text = this.el(
        'span',
        'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;'
      );
      text.appendChild(
        this.el(
          'span',
          'font-size: 11.5px; line-height: 1.3; font-weight: 600; color: var(--theme-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
          entry.dye ? this.dyeName(entry.dye) : `#${stainId}`
        )
      );
      // Stain ID is an identifier by decision (2026-08-20 i18n audit) — mono,
      // never localised.
      text.appendChild(
        this.el(
          'span',
          `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.7px; color: var(--theme-text-muted);`,
          `ID ${stainId}`
        )
      );
      row.appendChild(text);

      // Carriers: one 20px icon tile per piece wearing the dye; the slot
      // retreats into the tooltip (the accepted cost of this lens).
      const right = this.el(
        'span',
        'display: flex; align-items: center; gap: 4px; flex-shrink: 0;'
      );
      for (const slot of entry.carriers) {
        const item = this.itemFor(slot);
        const tile = this.el(
          'span',
          'display: block; width: 20px; height: 20px; border-radius: 5px; background-color: var(--theme-background-secondary); background-size: cover; background-position: center; cursor: help;'
        );
        tile.dataset.role = 'carrier';
        tile.dataset.slot = slot;
        if (item?.iconId) tile.style.backgroundImage = `url("${charaIconUrl(item.iconId)}")`;
        const slotLabel = this.gearSlotLabel(slot).toUpperCase();
        tile.title = item ? `${slotLabel} — ${itemNameFor(item.names, lang)}` : slotLabel;
        right.appendChild(tile);
      }
      right.appendChild(
        this.el(
          'span',
          `font-family: ${MONO}; font-size: 8.5px; color: var(--theme-text-muted); min-width: 16px; text-align: right;`,
          entry.channels > 1 ? `×${entry.channels}` : ''
        )
      );
      row.appendChild(right);
      grid.appendChild(row);
    }
    return grid;
  }

  /**
   * Footnote: worn-undyed pieces vs empty slots — the two things the shipped
   * `12 − dyed` line conflated. Plus, when the resolve failed, one quiet line
   * saying names are off and dyes are not. DyeId 0 is undyed, not black
   * (`gearHint`, on hover).
   */
  private renderGlamourFoot(bySlot: Map<CharaGearSlotId, ResolvedGearDye[]>): HTMLElement {
    const resolved = this.resolved!;
    const worn = resolved.gearModels.length;
    const undyedWorn = resolved.gearModels.filter((m) => !bySlot.has(m.slot)).length;
    const empty = Math.max(0, GEAR_SLOT_COUNT - worn);

    const foot = this.el('div', 'display: flex; flex-direction: column; gap: 3px;');
    const split = this.el(
      'div',
      'font-size: 10px; line-height: 1.5; color: var(--theme-text-muted); overflow-wrap: anywhere;',
      LanguageService.tInterpolate('swatch.footSplit', {
        undyed:
          undyedWorn === 1
            ? LanguageService.t('swatch.footWornUndyedOne')
            : LanguageService.tInterpolate('swatch.footWornUndyedMany', { n: undyedWorn }),
        empty:
          empty === 1
            ? LanguageService.t('swatch.footEmptyOne')
            : LanguageService.tInterpolate('swatch.footEmptyMany', { n: empty }),
      })
    );
    split.title = this.t('gearHint');
    split.dataset.role = 'glamour-foot';
    foot.appendChild(split);

    if (this.resolveState === 'unavailable') {
      const note = this.el(
        'div',
        'font-size: 10px; line-height: 1.45; color: var(--theme-text-muted); overflow-wrap: anywhere;',
        this.t('namesUnavailable')
      );
      note.dataset.role = 'names-unavailable';
      foot.appendChild(note);
    }
    return foot;
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
