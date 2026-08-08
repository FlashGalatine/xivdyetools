/**
 * /mixer — the confirmed 12F Ratio sweep (Turn 12), the command's first image.
 *
 * Five ratios instead of one: the interesting question is the one the code
 * never asked — blendColors was hardcoded to the midpoint, and the ratio
 * that actually lands on a buyable dye is rarely 50%. The sweep generates
 * the five rows itself (no ratio option on the command), the best row is
 * highlighted, and each row is the suite's five-slot row with the blend
 * (outlined — visibly unbuyable) butted against the nearest dye.
 *
 * @module mixer-card
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
  markFooter,
  measuredRow,
  swatch,
  type CardTheme,
  type MeasuredRowWidths,
} from './frame.js';
import { toolGlyph } from './icons/tool-icons.js';

// ============================================================================
// Types
// ============================================================================

export interface MixerCardRow {
  /** Share of dye B in the blend, 0–100 */
  pct: number;
  /** The blended (unbuyable) colour */
  blendHex: string;
  /** The nearest dye */
  dyeHex: string;
  /** Localized dye name */
  name: string;
  /** ΔE2000 blend → dye */
  deltaE: number;
  /** The sweep's best landing (highlighted) */
  best: boolean;
}

export interface MixerCardOptions {
  /** Blend-mode readout, e.g. "OKLAB" */
  modeLabel: string;
  dyeA: { hex: string; name: string };
  dyeB: { hex: string; name: string };
  rows: MixerCardRow[];
  /** "outline = blend · solid = nearest dye" ×6 */
  ratioKey: string;
  lang: string;
  theme?: 'dark' | 'light';
  commandLabel?: string;
  commandGlyph?: string | null;
}

// ============================================================================
// Generator
// ============================================================================

const PAD = 16;
const ROW_H = 42;

/** 12F slot widths (pct lead 34, blend→dye pair, name, bar 30, ΔE 32). */
const ROW_WIDTHS: MeasuredRowWidths = { lead: 34, pair: 52, name: 186, bar: 30, measure: 32 };

/**
 * Generate the /mixer card (12F). 400×330 at the five-ratio sweep.
 */
export function generateMixerCard(options: MixerCardOptions): string {
  const { modeLabel, dyeA, dyeB, ratioKey, lang, commandLabel = '/MIXER' } = options;
  const rows = options.rows.slice(0, ROW_CAP);
  const theme: CardTheme = cardTheme(options.theme);
  const commandGlyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : toolGlyph('mixer', 'compact', { size: 13, ink: theme.pillInk, accent: theme.glyphAccent });
  const parts: string[] = [];

  // --- Header: pill + mode readout
  const chip = commandChip(PAD, 15, commandLabel, theme, { glyph: commandGlyph });
  parts.push(chip.svg);
  parts.push(
    cardText(CARD_WIDTH - PAD, 15 + 15, modeLabel.toUpperCase(), {
      fill: theme.accentText,
      size: 12.5,
      font: 'mono',
      letterSpacing: 0.6,
      anchor: 'end',
    })
  );

  // --- The two inputs, facing each other
  const inY = 15 + 21 + 12;
  parts.push(swatch(PAD, inY, 30, 30, dyeA.hex, theme, 8));
  parts.push(swatch(CARD_WIDTH - PAD - 30, inY, 30, 30, dyeB.hex, theme, 8));
  const nameW = (CARD_WIDTH - PAD * 2 - 76) / 2;
  parts.push(
    cardText(PAD + 38, inY + 19, fitText(dyeA.name, nameW, 12.5, 'body'), {
      fill: theme.name,
      size: 12.5,
      font: 'body',
      weight: 600,
    })
  );
  parts.push(
    cardText(CARD_WIDTH - PAD - 38, inY + 19, fitText(dyeB.name, nameW, 12.5, 'body'), {
      fill: theme.name,
      size: 12.5,
      font: 'body',
      weight: 600,
      anchor: 'end',
    })
  );

  // --- The sweep rows (blend outlined; the best row's lead in the accent)
  const rowsTop = inY + 30 + 8;
  rows.forEach((r, i) => {
    const top = rowsTop + i * ROW_H;
    if (r.best) {
      // Lead % in the accent for the sweep's best landing
      parts.push(
        cardText(PAD, top + ROW_H / 2 + 4, `${r.pct}%`, {
          fill: theme.accentText,
          size: CARD_TYPE.value,
          font: 'mono',
          weight: 700,
        })
      );
    }
    parts.push(
      measuredRow(PAD, top, ROW_H, {
        lead: r.best ? '' : `${r.pct}%`,
        sourceHex: r.blendHex,
        dyeHex: r.dyeHex,
        name: r.name,
        deltaE: r.deltaE,
        lang,
        theme,
        widths: ROW_WIDTHS,
        nameSize: 13,
        sourceIdeal: true,
      })
    );
  });

  // --- Footer: legend + mark
  const height = Math.min(350, rowsTop + rows.length * ROW_H + 30);
  parts.push(
    cardText(PAD, height - 13, fitText(ratioKey, CARD_WIDTH - PAD * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(markFooter(CARD_WIDTH - PAD, height - 13, theme));

  return cardShell(height, theme, parts.join(''));
}
