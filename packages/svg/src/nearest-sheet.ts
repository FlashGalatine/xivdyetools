/**
 * /extractor color — the confirmed 14J·2 Colour sheet (Turn 14), 400×350.
 *
 * The same five dyes in the suite's five-slot row: rank in the lead column,
 * the target butted against each candidate, tier bar, ΔE — each row a
 * self-contained "asked for → can buy" pair, which is the Result Card's own
 * reading. Ranking is ΔE2000 (the shipped raw-RGB order could differ, so
 * this frame changes the answer, not just the picture). The chip names the
 * SUBCOMMAND — one generator now has two confirmed cards, and only the
 * string tells a saved PNG which subcommand made it.
 *
 * @module nearest-sheet
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
  swatch,
  type CardTheme,
  type MeasuredRowWidths,
} from './frame.js';
import { toolGlyph } from './icons/tool-icons.js';
import { MATCHING_METHOD_TAGS, type MatchingMethod } from '@xivdyetools/core';

// ============================================================================
// Types
// ============================================================================

export interface NearestSheetRow {
  /** 1-based rank by ΔE2000 */
  rank: number;
  /** The candidate dye (right half of the butted pair) */
  hex: string;
  /** Localized dye name */
  name: string;
  /** ΔE2000 target → candidate */
  deltaE: number;
}

export interface NearestSheetLabels {
  /** TARGET / ZIEL / 目標色 … */
  target: string;
  /** RANK / RANG / 順位 … */
  rank: string;
  /** NEAREST DYE / NÄCHSTER FARBSTOFF / … */
  nearest: string;
  /** "nearest by ΔE2000" ×6 */
  matchKey: string;
}

export interface NearestSheetOptions {
  targetHex: string;
  /**
   * What the target is called — the resolved dye's localized name when the
   * input was a dye, otherwise the hex string itself.
   */
  targetText: string;
  rows: NearestSheetRow[];
  labels: NearestSheetLabels;
  lang: string;
  theme?: 'dark' | 'light';
  commandLabel?: string;
  /**
   * The matching method the ranking ran under. Drives the ΔE column header tag,
   * every row's tier bar and measure formatting (default `ciede2000`).
   */
  method?: MatchingMethod;
  commandGlyph?: string | null;
}

// ============================================================================
// Generator
// ============================================================================

const PAD = 16;
const ROW_H = 45;

/** 14J·2 slot widths — the binding case at 25 px spare on the longest DE name. */
const ROW_WIDTHS: MeasuredRowWidths = { lead: 40, pair: 54, name: 176, bar: 26, measure: 34 };

/**
 * Generate the /extractor color card (14J·2). Height grows with the row
 * count and reaches 350 at five rows.
 */
export function generateNearestSheet(options: NearestSheetOptions): string {
  const { targetHex, targetText, labels, lang, commandLabel = '/EXTRACTOR COLOR', method = 'ciede2000' } = options;
  const rows = options.rows.slice(0, ROW_CAP);
  const theme: CardTheme = cardTheme(options.theme);
  const commandGlyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : toolGlyph('extractor', 'compact', { size: 13, ink: theme.pillInk, accent: theme.glyphAccent });
  const parts: string[] = [];

  // --- Header: target block + subcommand chip
  const chip = commandChip(0, 13, commandLabel, theme, { glyph: commandGlyph });
  parts.push(`<g transform="translate(${CARD_WIDTH - PAD - chip.width},0)">${chip.svg}</g>`);
  parts.push(
    cardText(PAD, 13 + 11, labels.target, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1.1,
    })
  );
  const blockY = 13 + 16;
  parts.push(swatch(PAD, blockY, 40, 40, targetHex, theme, 9));
  parts.push(
    cardText(PAD + 40 + 11, blockY + 17, fitText(targetText, CARD_WIDTH - PAD * 2 - chip.width - 60, 16, 'display'), {
      fill: theme.name,
      size: 16,
      font: 'display',
      weight: 600,
    })
  );
  parts.push(
    cardText(PAD + 40 + 11, blockY + 34, targetHex.toUpperCase(), {
      fill: theme.subValue,
      size: 12,
      font: 'mono',
    })
  );

  // --- Column labels
  const headY = blockY + 40 + 12 + 11;
  const nameX = PAD + ROW_WIDTHS.lead + 10 + ROW_WIDTHS.pair + 10;
  parts.push(
    cardText(PAD, headY, labels.rank, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 1 })
  );
  parts.push(
    cardText(nameX, headY, labels.nearest, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 1 })
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

  // --- Rows: the target repeats down the column — a constant reference rail
  const rowsTop = headY + 5;
  rows.forEach((r, i) => {
    const top = rowsTop + i * ROW_H;
    parts.push(hairline(PAD, CARD_WIDTH - PAD, top, theme));
    parts.push(
      measuredRow(PAD, top, ROW_H, {
        lead: String(r.rank),
        sourceHex: targetHex,
        dyeHex: r.hex,
        name: r.name,
        deltaE: r.deltaE,
        method,
        lang,
        theme,
        widths: ROW_WIDTHS,
        nameSize: 13,
      })
    );
  });

  // --- Footer: legend + mark
  const height = Math.min(350, rowsTop + rows.length * ROW_H + 30);
  parts.push(
    cardText(PAD, height - 13, fitText(labels.matchKey, CARD_WIDTH - PAD * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(markFooter(CARD_WIDTH - PAD, height - 13, theme));

  return cardShell(height, theme, parts.join(''));
}
