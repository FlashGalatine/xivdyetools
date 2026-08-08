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
 * everything here is presentation. Renders inside the v4 shell's shadow DOM —
 * inline styles only. Privacy is on the card: parsed on this device, nothing
 * uploaded, Base64Image never read.
 *
 * Spec: docs/research/monorepo-2.0/10a-sheet-port-spec.md
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
import { ColorService, dyeService, LanguageService, ToastService } from '@services/index';
import { ThemeService } from '@services/theme-service';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye, SubRace, Gender } from '@xivdyetools/types';

const MONO = "'Fragment Mono', monospace";
const TIER_RAMP_DARK = ['#5bbd68', '#8bc34a', '#ffc107', '#f4645a'] as const;
const TIER_RAMP_LIGHT = ['#137A33', '#1C7D3A', '#B45309', '#B91C1C'] as const;
const OFF_GRID_AMBER = '#F4BF4F';

export interface CharaImportCallbacks {
  /** A slot card was picked — hand its winning colour to the workspace */
  onSlotPick: (hex: string, label: string) => void;
  /** The file supplied tribe + gender — the selectors become a readout */
  onTribeGender?: (tribe: SubRace, gender: Gender) => void;
  /** Make-a-palette: deduped worn dyes, ready for the submission form */
  onSubmitPalette?: (dyes: Dye[]) => void;
}

/**
 * The 10A file card + THIS CHARACTER sheet + DYES ON THIS GLAMOUR block.
 * Mounted above the workspace; the workspace keeps working without it.
 */
export class CharaImport {
  private container: HTMLElement;
  private callbacks: CharaImportCallbacks;
  private characterColors = new CharacterColorService();
  private resolved: ResolvedCharaCharacter | null = null;
  private fileName: string | null = null;
  /** Deduped worn dyes; entries toggled off before palette actions */
  private droppedStainIds = new Set<number>();

  constructor(container: HTMLElement, callbacks: CharaImportCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  init(): void {
    this.render();
  }

  destroy(): void {
    clearContainer(this.container);
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
      if (this.resolved.tribe && this.resolved.gender && this.callbacks.onTribeGender) {
        this.callbacks.onTribeGender(this.resolved.tribe, this.resolved.gender);
      }
      logger.info(
        `[CharaImport] Parsed ${file.name} (${this.resolved.producer ?? 'unknown producer'})`
      );
    } catch (error) {
      logger.error('[CharaImport] Parse failed:', error);
      ToastService.error(LanguageService.t('swatch.hexInvalid'));
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

  private el(tag: string, style: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    node.setAttribute('style', style);
    if (text !== undefined) node.textContent = text;
    return node;
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

  // ==========================================================================
  // Render
  // ==========================================================================

  private render(): void {
    clearContainer(this.container);
    const wrapper = this.el(
      'div',
      'display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;'
    );
    if (this.resolved) {
      wrapper.appendChild(this.renderFileCard());
      wrapper.appendChild(this.renderSheet());
      const glamour = this.renderGlamour();
      if (glamour) wrapper.appendChild(glamour);
    } else {
      wrapper.appendChild(this.renderDropZone());
    }
    this.container.appendChild(wrapper);
  }

  /** The offer above the workspace — nothing below it is disabled. */
  private renderDropZone(): HTMLElement {
    const zone = this.el(
      'div',
      'border: 2px dashed var(--theme-border); border-radius: 12px; padding: 22px 20px; text-align: center; cursor: pointer; background: var(--theme-card-background);'
    );

    zone.appendChild(
      this.el(
        'div',
        'font-size: 15px; font-weight: 650; color: var(--theme-text); margin-bottom: 4px;',
        this.t('dropTitle')
      )
    );
    zone.appendChild(
      this.el(
        'div',
        'font-size: 12.5px; line-height: 1.55; color: var(--theme-text-muted); max-width: 560px; margin: 0 auto 10px;',
        this.t('dropBody')
      )
    );

    const chooseBtn = this.el(
      'button',
      'font-size: 12.5px; font-weight: 600; padding: 7px 16px; border-radius: 8px; border: 1px solid var(--theme-border); background: transparent; color: var(--theme-text); cursor: pointer;',
      this.t('chooseFile')
    );
    zone.appendChild(chooseBtn);

    zone.appendChild(
      this.el(
        'div',
        `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); margin-top: 10px;`,
        this.t('orGrid')
      )
    );
    zone.appendChild(
      this.el(
        'div',
        'font-size: 11px; line-height: 1.5; color: var(--theme-text-muted); margin-top: 8px;',
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

  private renderFileCard(): HTMLElement {
    const resolved = this.resolved!;
    const card = this.el(
      'div',
      'border: 1px solid var(--theme-border); border-radius: 12px; padding: 12px 14px; background: var(--theme-card-background); display: flex; flex-direction: column; gap: 8px;'
    );

    const topRow = this.el(
      'div',
      'display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0;'
    );
    topRow.appendChild(
      this.el(
        'span',
        `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); flex: 0 0 auto;`,
        this.t('charaFile')
      )
    );
    topRow.appendChild(
      this.el(
        'span',
        'font-size: 13.5px; font-weight: 650; color: var(--theme-text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
        this.fileName ?? '—'
      )
    );
    // Producer is shown so a missing slot is attributable — never used for parsing.
    const meta: string[] = [];
    if (resolved.producer) meta.push(resolved.producer);
    if (resolved.nickname) meta.push(resolved.nickname);
    if (meta.length) {
      topRow.appendChild(
        this.el(
          'span',
          'font-size: 11.5px; color: var(--theme-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          meta.join(' · ')
        )
      );
    }
    const spacer = this.el('span', 'flex: 1 1 auto;');
    topRow.appendChild(spacer);
    topRow.appendChild(
      this.el(
        'span',
        `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; padding: 3px 7px; border-radius: 5px; background: rgba(97, 197, 84, 0.16); color: #61C554; flex: 0 0 auto;`,
        this.t('localOnly')
      )
    );
    card.appendChild(topRow);

    // Tribe + gender become a readout — only hair and skin needed them.
    const whoRow = this.el(
      'div',
      'display: flex; align-items: center; gap: 10px; flex-wrap: wrap;'
    );
    whoRow.appendChild(
      this.el(
        'span',
        `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted);`,
        this.t('whoHead')
      )
    );
    whoRow.appendChild(
      this.el(
        'span',
        'font-size: 12.5px; color: var(--theme-text);',
        `${resolved.tribe ?? '—'} ${resolved.gender === 'Female' ? '♀' : resolved.gender === 'Male' ? '♂' : ''}`
      )
    );
    card.appendChild(whoRow);

    const bottomRow = this.el(
      'div',
      'display: flex; align-items: center; gap: 12px; flex-wrap: wrap;'
    );
    const replaceBtn = this.el(
      'button',
      'font-size: 11.5px; font-weight: 600; padding: 5px 11px; border-radius: 7px; border: 1px solid var(--theme-border); background: transparent; color: var(--theme-text); cursor: pointer;',
      this.t('replaceFile')
    );
    replaceBtn.addEventListener('click', () => {
      this.resolved = null;
      this.fileName = null;
      this.render();
    });
    bottomRow.appendChild(replaceBtn);
    bottomRow.appendChild(
      this.el(
        'span',
        'font-size: 11px; line-height: 1.5; color: var(--theme-text-muted); flex: 1 1 260px;',
        this.t('charaHint')
      )
    );
    card.appendChild(bottomRow);

    return card;
  }

  /** THIS CHARACTER — one card per slot, best dye already on it. */
  private renderSheet(): HTMLElement {
    const resolved = this.resolved!;
    const section = this.el('div', '');
    section.appendChild(
      this.el(
        'div',
        `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); margin-bottom: 8px;`,
        this.t('slotsHead')
      )
    );

    const grid = this.el(
      'div',
      'display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;'
    );

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
        `border: 2px dashed ${isError ? 'rgba(244, 100, 90, 0.5)' : 'var(--theme-border)'}; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; min-height: 74px;`
      );
      card.appendChild(
        this.el(
          'span',
          'font-size: 12.5px; font-weight: 650; color: var(--theme-text-muted);',
          label
        )
      );
      card.appendChild(
        this.el(
          'span',
          `font-size: 10.5px; line-height: 1.45; color: ${isError ? '#f4645a' : 'var(--theme-text-muted)'};`,
          isError ? (slot.error?.message ?? '') : this.absentReason(slot)
        )
      );
      return card;
    }

    const offGrid = slot.verdict === 'offGrid' || slot.verdict === 'floatOnly';
    const card = this.el(
      'div',
      'border: 1px solid var(--theme-border); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; background: var(--theme-card-background);'
    );
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const head = this.el('div', 'display: flex; align-items: center; gap: 8px; min-width: 0;');
    head.appendChild(
      this.el(
        'span',
        `width: 22px; height: 22px; border-radius: 6px; flex: 0 0 auto; background: ${hex}; border: 1px solid var(--theme-border);`
      )
    );
    head.appendChild(
      this.el(
        'span',
        'font-size: 12.5px; font-weight: 650; color: var(--theme-text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
        label
      )
    );
    card.appendChild(head);

    // Address line: R·C in the creator, or OFF GRID — never a fake address.
    const addr = this.el('div', 'display: flex; align-items: center; gap: 6px;');
    if (offGrid) {
      const badge = this.el(
        'span',
        `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; padding: 2px 6px; border-radius: 4px; background: rgba(244, 191, 79, 0.16); color: ${OFF_GRID_AMBER};`,
        this.t('offGrid')
      );
      badge.title = this.t('offGridNote');
      addr.appendChild(badge);
    } else if (slot.gridAddress) {
      const addrText = this.el(
        'span',
        `font-family: ${MONO}; font-size: 10px; letter-spacing: 0.5px; color: var(--theme-text-muted);`,
        slot.sheetVariant === 'light'
          ? `${slot.gridAddress} · ${this.t('rangeLight')}`
          : slot.gridAddress
      );
      if (slot.indexWinNote) {
        addrText.title = this.t('indexWinsNote');
        addrText.textContent += ' *';
      }
      addr.appendChild(addrText);
    }
    card.appendChild(addr);

    // Best dye already on the card — the sheet answers before you click.
    const best = this.bestDye(hex);
    if (best) {
      const tier = classifyBandTier(
        roundToBandDisplay(best.deltaE, 'ciede2000'),
        'ciede2000',
        'match'
      );
      const row = this.el('div', 'display: flex; align-items: center; gap: 6px; min-width: 0;');
      row.appendChild(
        this.el(
          'span',
          `width: 12px; height: 12px; border-radius: 4px; flex: 0 0 auto; background: ${best.dye.hex}; border: 1px solid var(--theme-border);`
        )
      );
      row.appendChild(
        this.el(
          'span',
          'font-size: 11px; color: var(--theme-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          this.dyeName(best.dye)
        )
      );
      row.appendChild(
        this.el(
          'span',
          `font-family: ${MONO}; font-size: 10.5px; color: ${ramp[tier]}; flex: 0 0 auto;`,
          roundToBandDisplay(best.deltaE, 'ciede2000').toFixed(1)
        )
      );
      card.appendChild(row);
    }

    const pick = () => this.callbacks.onSlotPick(hex, label);
    card.addEventListener('click', pick);
    card.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        pick();
      }
    });

    return card;
  }

  /** DYES ON THIS GLAMOUR — per-slot rows, both channels, plus palette actions. */
  private renderGlamour(): HTMLElement | null {
    const resolved = this.resolved!;
    if (resolved.gearDyes.length === 0) return null;

    const section = this.el('div', '');
    section.appendChild(
      this.el(
        'div',
        `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); margin-bottom: 8px;`,
        this.t('equipHead')
      )
    );

    const box = this.el(
      'div',
      'border: 1px solid var(--theme-border); border-radius: 10px; padding: 10px 12px; background: var(--theme-card-background);'
    );

    // Group both channels under one row per gear slot.
    const bySlot = new Map<string, typeof resolved.gearDyes>();
    for (const gear of resolved.gearDyes) {
      const list = bySlot.get(gear.slot) ?? [];
      list.push(gear);
      bySlot.set(gear.slot, list);
    }

    for (const [slotId, dyes] of bySlot) {
      const row = this.el(
        'div',
        'display: flex; align-items: center; gap: 10px; padding: 4px 0; min-width: 0;'
      );
      // Gear slot tags are identifiers — mono, never localised.
      row.appendChild(
        this.el(
          'span',
          `font-family: ${MONO}; font-size: 9px; letter-spacing: 1px; color: var(--theme-text-muted); width: 76px; flex: 0 0 auto; text-transform: uppercase;`,
          slotId
        )
      );
      for (const gear of dyes) {
        const chip = this.el(
          'span',
          'display: inline-flex; align-items: center; gap: 5px; min-width: 0;'
        );
        chip.appendChild(
          this.el(
            'span',
            `width: 12px; height: 12px; border-radius: 4px; flex: 0 0 auto; background: ${gear.dye?.hex ?? 'transparent'}; border: 1px solid var(--theme-border);`
          )
        );
        chip.appendChild(
          this.el(
            'span',
            'font-size: 11.5px; color: var(--theme-text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
            gear.dye ? this.dyeName(gear.dye) : `#${gear.stainId}`
          )
        );
        row.appendChild(chip);
      }
      box.appendChild(row);
    }

    box.appendChild(
      this.el(
        'div',
        'font-size: 10.5px; line-height: 1.5; color: var(--theme-text-muted); margin-top: 6px;',
        this.t('gearHint')
      )
    );

    // Make a palette: deduped, individually droppable, then submit.
    const worn = this.wornDyes().filter((w) => w.dye !== null);
    if (worn.length >= 2 && this.callbacks.onSubmitPalette) {
      const paletteRow = this.el(
        'div',
        'display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px;'
      );
      for (const entry of worn) {
        const dropped = this.droppedStainIds.has(entry.stainId);
        const chip = this.el(
          'button',
          `display: inline-flex; align-items: center; gap: 5px; font-size: 11px; padding: 3px 8px; border-radius: 999px; cursor: pointer; border: 1px solid var(--theme-border); background: ${
            dropped ? 'transparent' : 'var(--theme-background-secondary)'
          }; color: var(--theme-text); opacity: ${dropped ? '0.45' : '1'};`
        );
        chip.appendChild(
          this.el(
            'span',
            `width: 10px; height: 10px; border-radius: 3px; background: ${entry.dye!.hex}; border: 1px solid var(--theme-border);`
          )
        );
        chip.appendChild(this.el('span', '', this.dyeName(entry.dye!)));
        chip.title = this.dyeName(entry.dye!);
        chip.addEventListener('click', () => {
          if (dropped) this.droppedStainIds.delete(entry.stainId);
          else this.droppedStainIds.add(entry.stainId);
          this.render();
        });
        paletteRow.appendChild(chip);
      }
      box.appendChild(paletteRow);

      const kept = worn.filter((w) => !this.droppedStainIds.has(w.stainId));
      const actionRow = this.el(
        'div',
        'display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap;'
      );
      const submitBtn = this.el(
        'button',
        'font-size: 11.5px; font-weight: 600; padding: 6px 12px; border-radius: 7px; border: 1px solid var(--theme-border); background: var(--theme-card-background); color: var(--theme-text); cursor: pointer;',
        this.t('makePalette')
      );
      submitBtn.addEventListener('click', () => {
        // A glamour is usually too big to be a palette — 3–6 after drops.
        this.callbacks.onSubmitPalette?.(kept.map((w) => w.dye!));
      });
      actionRow.appendChild(submitBtn);
      actionRow.appendChild(
        this.el(
          'span',
          `font-family: ${MONO}; font-size: 10px; color: ${kept.length >= 3 && kept.length <= 6 ? 'var(--theme-text-muted)' : OFF_GRID_AMBER};`,
          `${kept.length} / 6`
        )
      );
      box.appendChild(actionRow);
    }

    section.appendChild(box);
    return section;
  }
}
