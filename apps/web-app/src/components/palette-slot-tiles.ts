/**
 * The slot taps of the two dense-list tools (Dye Comparison, Accessibility
 * Checker): four "Add Dye" placeholders while the tool holds no dye, and one
 * "Add dye" tile after the cards while it holds some but not all. One copy
 * here instead of one per tool chunk.
 *
 * @module components/palette-slot-tiles
 */

import type { Dye } from '@xivdyetools/types';
import { LanguageService } from '@services/index';
import { clearContainer } from '@shared/utils';
import { SLOT_TARGET_BORDER, requestPalette, type PaletteSlot } from './palette-slots';

/** The "+" of the placeholders and the tile (static markup, decorative). */
const ADD_DYE_PLUS_SVG = `<svg viewBox="0 0 24 24" fill="var(--theme-text-muted)" aria-hidden="true" style="width: 24px; height: 24px; opacity: 0.4;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>`;

// Declarations both taps repeat. Inline styles ship as written, so they are kept once.
const BUTTON_RESET =
  'font: inherit; color: inherit; appearance: none; -webkit-appearance: none; cursor: pointer;';
const DASHED_BORDER = 'border: 2px dashed var(--theme-border);';
const CENTERED_FLEX = 'display: flex; align-items: center; justify-content: center;';
const MUTED_TEXT = 'font-size: 0.85rem; color: var(--theme-text-muted);';

function styled<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.setAttribute('style', style);
  return el;
}

/** The plus in a dashed circle of `size` px. */
function plusCircle(tag: 'div' | 'span', size: number, extra: string): HTMLElement {
  const circle = styled(
    tag,
    `${extra} width: ${size}px; height: ${size}px; ${CENTERED_FLEX} ${DASHED_BORDER} border-radius: 50%;`
  );
  circle.innerHTML = ADD_DYE_PLUS_SVG;
  return circle;
}

/**
 * Owns a dense-list tool's placeholders and tile. The tool hands it the two
 * containers it renders and calls sync() whenever its dyes or the palette's
 * target change.
 */
export class DenseSlotTaps {
  /** Filled with the placeholders only while no dye is held. */
  placeholders: HTMLElement | null = null;
  /** Holds the tile only while 1 to max-1 dyes are held. */
  tileRow: HTMLElement | null = null;

  constructor(
    /** Locale key of the "Add Dye" text, which is also each button's accessible name. */
    private readonly labelKey: string,
    private readonly max: number,
    /** How many dyes the tool holds now. */
    private readonly count: () => number,
    private readonly tileClass = ''
  ) {}

  /** Always `max` slots, the held dyes first. */
  slots(dyes: readonly Dye[]): PaletteSlot[] {
    return Array.from({ length: this.max }, (_, i) => ({
      label: String(i + 1),
      targetLabel: LanguageService.tInterpolate('colorPalette.choosingDyeOf', {
        // Digits, not words: the key already says "dye {current} of {total}"
        current: String(i + 1),
        total: String(this.max),
      }),
      dye: dyes[i] ?? null,
    }));
  }

  /**
   * Redraw both for the current count. The placeholders and the tile are
   * absent rather than hidden when not wanted: the shell returns focus to the
   * first [data-palette-slot] it finds, and the narrow-pane e2e counts the
   * "Add Dye" texts. In a dense list any target past the last dye means "the
   * next free slot", which both stand for, so such a target marks them.
   */
  sync(target: number | null): void {
    const count = this.count();
    const border = target !== null && target >= count ? SLOT_TARGET_BORDER : 'var(--theme-border)';

    const host = this.placeholders;
    if (host) {
      const wanted = count === 0;
      if (wanted !== host.childElementCount > 0) {
        clearContainer(host);
        if (wanted) {
          for (let i = 0; i < this.max; i++) host.appendChild(this.createPlaceholder());
        }
      }
      for (const slot of Array.from(host.children)) {
        (slot as HTMLElement).style.borderColor = border;
      }
    }

    const row = this.tileRow;
    if (!row) return;
    const shown = count >= 1 && count < this.max;
    row.style.display = shown ? 'flex' : 'none';
    if (!shown) {
      clearContainer(row);
      return;
    }
    let tile = row.firstElementChild as HTMLElement | null;
    if (!tile) {
      tile = this.createTile();
      row.appendChild(tile);
    }
    tile.setAttribute('data-palette-slot', String(count));
    tile.style.borderColor = border;
  }

  /** One placeholder: a slot tap aimed at the first dye, as every empty slot is in a dense list. */
  private createPlaceholder(): HTMLElement {
    const slot = styled(
      'button',
      `padding: 0; ${BUTTON_RESET} width: 200px; height: 280px; ${DASHED_BORDER} border-radius: 12px; ${CENTERED_FLEX} flex-direction: column; background: transparent; transition: all 0.2s ease;`
    );
    slot.type = 'button';
    slot.setAttribute('data-palette-slot', '0');

    // Hover tints the background only; the border carries the target state
    slot.addEventListener('mouseenter', () => {
      slot.style.background = 'var(--theme-card-hover)';
    });
    slot.addEventListener('mouseleave', () => {
      slot.style.background = 'transparent';
    });

    const text = styled('span', `${MUTED_TEXT} opacity: 0.6;`);
    text.textContent = LanguageService.t(this.labelKey);
    slot.append(plusCircle('div', 48, 'margin-bottom: 12px;'), text);
    slot.addEventListener('click', () => requestPalette(slot, 0));
    return slot;
  }

  /**
   * The "Add dye" tile: the placeholder's dashed look as one compact row, a
   * result card wide, so it fits a phone without pushing the pane sideways.
   */
  private createTile(): HTMLElement {
    const tile = styled(
      'button',
      `box-sizing: border-box; width: 280px; max-width: 100%; min-height: 72px; ${CENTERED_FLEX} gap: 12px; padding: 12px 16px; margin: 0; ${BUTTON_RESET} ${DASHED_BORDER} border-radius: 12px; background: transparent; transition: border-color 0.2s ease;`
    );
    tile.type = 'button';
    if (this.tileClass) tile.className = this.tileClass;

    const text = styled('span', MUTED_TEXT);
    text.textContent = LanguageService.t(this.labelKey);
    tile.append(plusCircle('span', 36, 'flex-shrink: 0;'), text);

    // Read the count at tap time: the tile always means "the next free slot"
    tile.addEventListener('click', () => requestPalette(tile, this.count()));
    return tile;
  }
}
