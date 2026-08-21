/**
 * /extractor image — the confirmed 14K Ramp (Turn 14), 400×350.
 *
 * The five-row cap only binds the list: the band carries ALL colours at
 * their real share of the image — the one thing an extractor should show
 * and a row cannot, because a row gives a 42% colour and a 2% colour
 * identical height. The rows carry the butted extracted→dye pair, because
 * the band answers "how much" and only the pair answers "which became
 * which". Nothing is deferred: the list is explicitly a top five, so the
 * count in the embed is a description, not an apology.
 *
 * @module palette-grid
 */

import {
  CARD_WIDTH,
  CARD_TYPE,
  ROW_CAP,
  cardShell,
  cardTheme,
  cardText,
  commandChip,
  fitText,
  hairline,
  markFooter,
  measuredRow,
  type CardTheme,
  type MeasuredRowWidths,
} from './frame.js';
import { num } from './base.js';
import { toolGlyph } from './icons/tool-icons.js';
import { MATCHING_METHOD_TAGS, type MatchingMethod } from '@xivdyetools/core';

// ============================================================================
// Types
// ============================================================================

/** One colour in the proportional band (every extracted colour rides here). */
export interface PaletteBandEntry {
  hex: string;
  /** Share of the image, 0–100 */
  share: number;
}

/** One list row (top five by share). */
export interface PaletteRowEntry {
  /** Share of the image, 0–100 */
  share: number;
  /** The extracted cluster colour (left half of the butted pair) */
  extractedHex: string;
  /** The matched dye (right half) */
  matchedHex: string;
  /** Localized matched dye name */
  matchedName: string;
  /** ΔE2000 extracted → matched */
  deltaE: number;
}

export interface PaletteGridLabels {
  /** SHARE / ANTEIL / 割合 … */
  share: string;
  /** MATCHED DYE / PASSENDER FARBSTOFF / 該当カララント … */
  matched: string;
  /** "band width = share of image" ×6 */
  rampKey: string;
}

export interface PaletteGridOptions {
  /** Localized card title ("Palette from image" ×6) */
  title: string;
  /** Every extracted colour, in extraction order */
  band: PaletteBandEntry[];
  /** Top five rows */
  rows: PaletteRowEntry[];
  labels: PaletteGridLabels;
  lang: string;
  theme?: 'dark' | 'light';
  /**
   * The matching method each row's dye was picked and measured with. Drives
   * the ΔE column header tag, tier bars and measure formatting (default
   * `ciede2000`).
   */
  method?: MatchingMethod;
  /** The chip names the SUBCOMMAND — a glyph cannot */
  commandLabel?: string;
  commandGlyph?: string | null;
}

// ============================================================================
// Generator
// ============================================================================

const PAD = 16;
const BAND_H = 30;
const ROW_H = 45;

/** 14K slot widths (name at 12.5 px, 35 px spare on the longest DE name). */
const ROW_WIDTHS: MeasuredRowWidths = { lead: 38, pair: 52, name: 180, bar: 26, measure: 34 };

/** A 2% band is 7 px and needs a floor, or the tenth colour disappears. */
const MIN_SLICE = 7;

/**
 * Proportional band slices with a minimum visible width; the remainder comes
 * off the largest band so the strip never silently drops a colour.
 */
export function bandSlices(entries: PaletteBandEntry[], totalWidth: number): number[] {
  const totalShare = entries.reduce((a, e) => a + e.share, 0) || 1;
  const widths = entries.map((e) => (e.share / totalShare) * totalWidth);
  let debt = 0;
  for (let i = 0; i < widths.length; i++) {
    if (widths[i] < MIN_SLICE) {
      debt += MIN_SLICE - widths[i];
      widths[i] = MIN_SLICE;
    }
  }
  while (debt > 0.01) {
    const largest = widths.indexOf(Math.max(...widths));
    const give = Math.min(debt, widths[largest] - MIN_SLICE);
    if (give <= 0) break;
    widths[largest] -= give;
    debt -= give;
  }
  return widths;
}

/**
 * Generate the /extractor image card (14K). Height grows with the row count
 * and reaches 350 at five rows.
 */
export function generatePaletteGrid(options: PaletteGridOptions): string {
  const { title, band, labels, lang, commandLabel = '/EXTRACTOR IMAGE', method = 'ciede2000' } = options;
  const rows = options.rows.slice(0, ROW_CAP);
  const theme: CardTheme = cardTheme(options.theme);
  const commandGlyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : toolGlyph('extractor', 'compact', { size: 13, ink: theme.pillInk, accent: theme.glyphAccent });
  const parts: string[] = [];

  // --- Title + subcommand chip
  const chip = commandChip(0, 13, commandLabel, theme, { glyph: commandGlyph });
  parts.push(`<g transform="translate(${CARD_WIDTH - PAD - chip.width},0)">${chip.svg}</g>`);
  parts.push(
    cardText(PAD, 13 + 18, fitText(title, CARD_WIDTH - PAD * 2 - chip.width - 10, 18, 'display'), {
      fill: theme.name,
      size: 18,
      font: 'display',
      weight: 600,
    })
  );

  // --- The band: all colours, real shares, floored slices
  const bandY = 13 + 22 + 9;
  const innerW = CARD_WIDTH - PAD * 2;
  const slices = bandSlices(band, innerW);
  let bx = PAD;
  const bandRects: string[] = [];
  slices.forEach((w, i) => {
    bandRects.push(`<rect x="${bx}" y="${bandY}" width="${w}" height="${BAND_H}" fill="${band[i].hex}"/>`);
    bx += w;
  });
  parts.push(
    `<defs><clipPath id="pgband"><rect x="${PAD}" y="${bandY}" width="${innerW}" height="${BAND_H}" rx="8"/></clipPath></defs>` +
      `<g clip-path="url(#pgband)">${bandRects.join('')}</g>` +
      `<rect x="${PAD + 0.5}" y="${bandY + 0.5}" width="${innerW - 1}" height="${BAND_H - 1}" rx="7.5" fill="none" stroke="${theme.swatchRing}" stroke-width="1"/>`
  );

  // --- Column labels
  const headY = bandY + BAND_H + 9 + 11;
  const nameX = PAD + ROW_WIDTHS.lead + 10 + ROW_WIDTHS.pair + 10;
  parts.push(
    cardText(PAD, headY, labels.share, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 1 })
  );
  parts.push(
    cardText(nameX, headY, labels.matched, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 1 })
  );
  parts.push(
    cardText(CARD_WIDTH - PAD, headY, method === 'ciede2000' ? 'ΔE' : MATCHING_METHOD_TAGS[method], {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1,
      anchor: 'end',
    })
  );

  // --- Rows: the suite's five-slot row (lead = share)
  const rowsTop = headY + 5;
  rows.forEach((r, i) => {
    const top = rowsTop + i * ROW_H;
    parts.push(hairline(PAD, CARD_WIDTH - PAD, top, theme));
    parts.push(
      measuredRow(PAD, top, ROW_H, {
        lead: `${num(r.share, lang, 0)}%`,
        sourceHex: r.extractedHex,
        dyeHex: r.matchedHex,
        name: r.matchedName,
        deltaE: r.deltaE,
        method,
        lang,
        theme,
        widths: ROW_WIDTHS,
        nameSize: 12.5,
      })
    );
  });

  // --- Footer: legend + mark
  const height = Math.min(350, rowsTop + rows.length * ROW_H + 30);
  parts.push(
    cardText(PAD, height - 13, fitText(labels.rampKey, CARD_WIDTH - PAD * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(markFooter(CARD_WIDTH - PAD, height - 13, theme));

  return cardShell(height, theme, parts.join(''));
}
