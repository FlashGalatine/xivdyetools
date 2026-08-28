/**
 * /dye random — the confirmed 11B Sheet table (Turn 11).
 *
 * A real table with a header row, so the stain column reads as a column.
 * Rows are 52 px; five rows plus a header is exactly what 350 px buys, and
 * the frame grows with the count under that — a three-dye run is a shorter
 * image (the 350 ceiling is a wall, not a size). No instruction text is ever
 * baked into the PNG.
 *
 * @module random-dyes-grid
 */

import {
  CARD_WIDTH,
  CARD_TYPE,
  ROW_CAP,
  cardShell,
  cardTheme,
  cardText,
  commandChip,
  hairline,
  fitText,
  markFooter,
  swatch,
  type CardTheme,
} from './frame.js';
import { panelGlyph } from './icons/tool-icons.js';

// ============================================================================
// Types
// ============================================================================

export interface RandomDyeRow {
  hex: string;
  localizedName: string;
  localizedCategory: string;
  /** Stain ID — the handle share URLs key on (null only for Facewear) */
  stainID: number | null;
}

export interface RandomGridLabels {
  /** DYE / FARBSTOFF / カララント … */
  name: string;
  /** CATEGORY / KATEGORIE / カテゴリ … */
  cat: string;
  /** STAIN / FARBNR. / 番号 … */
  stain: string;
}

export interface RandomDyesGridOptions {
  dyes: RandomDyeRow[];
  /** Localized card title (carries the unique-categories variant) */
  title: string;
  labels: RandomGridLabels;
  theme?: 'dark' | 'light';
  /** The command label in the pill (default "/DYE RANDOM") */
  commandLabel?: string;
  /** Rendered 13 px glyph for the pill (the bare chip; null = text-only) */
  commandGlyph?: string | null;
}

// ============================================================================
// Generator
// ============================================================================

const PAD = 16;
const ROW_H = 52;
const CAT_W = 68;
const STAIN_W = 62;

/**
 * Generate the /dye random table (11B). Height grows with the count and
 * caps at five rows (R1) — callers clamp the count.
 */
export function generateRandomDyesGrid(options: RandomDyesGridOptions): string {
  const { title, labels, commandLabel = '/DYE RANDOM' } = options;
  const rows = options.dyes.slice(0, ROW_CAP);
  const theme: CardTheme = cardTheme(options.theme);
  // /dye is not one of the nine tools — the bare chip, with the accent slot
  const commandGlyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : panelGlyph('dye', { size: 13, ink: theme.pillInk, accent: theme.glyphAccent });
  const parts: string[] = [];

  // --- Title + pill
  const chipLabelW = 120;
  parts.push(
    cardText(PAD, 13 + 18, fitText(title, CARD_WIDTH - PAD * 2 - chipLabelW, 18, 'display'), {
      fill: theme.name,
      size: 18,
      font: 'display',
      weight: 600,
    })
  );
  // right-align the pill (measure once, then translate into place)
  const chip = commandChip(0, 13, commandLabel, theme, { glyph: commandGlyph });
  parts.push(`<g transform="translate(${CARD_WIDTH - PAD - chip.width},0)">${chip.svg}</g>`);

  // --- Header row
  const headY = 13 + 26 + 9 + 12;
  const nameX = PAD + 46 + 10;
  const catX = CARD_WIDTH - PAD - STAIN_W - 10 - CAT_W;
  parts.push(
    cardText(nameX, headY, labels.name, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 1 })
  );
  parts.push(
    cardText(catX, headY, labels.cat, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 1 })
  );
  parts.push(
    cardText(CARD_WIDTH - PAD, headY, labels.stain, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1,
      anchor: 'end',
    })
  );

  // --- Rows
  const rowsTop = headY + 5;
  rows.forEach((r, i) => {
    const top = rowsTop + i * ROW_H;
    parts.push(hairline(0, CARD_WIDTH, top, theme));
    const cy = top + ROW_H / 2;
    parts.push(swatch(PAD, cy - 19, 46, 38, r.hex, theme, 9));
    const nameW = catX - nameX - 10;
    parts.push(
      cardText(nameX, cy - 3, fitText(r.localizedName, nameW, 14.5, 'body'), {
        fill: theme.name,
        size: 14.5,
        font: 'body',
        weight: 600,
      })
    );
    parts.push(
      cardText(nameX, cy + 13, r.hex.toUpperCase(), { fill: theme.label, size: 11.5, font: 'mono' })
    );
    parts.push(
      cardText(catX, cy + 4, fitText(r.localizedCategory, CAT_W, 11.5, 'mono'), {
        fill: theme.subValue,
        size: 11.5,
        font: 'mono',
      })
    );
    parts.push(
      cardText(CARD_WIDTH - PAD, cy + 4, r.stainID != null ? String(r.stainID) : '—', {
        fill: theme.value,
        size: CARD_TYPE.value,
        font: 'mono',
        anchor: 'end',
      })
    );
  });

  // --- Height + mark
  const height = Math.min(350, rowsTop + rows.length * ROW_H + 33);
  parts.push(markFooter(CARD_WIDTH - PAD, height - 10, theme));

  return cardShell(height, theme, parts.join(''));
}
