/**
 * /budget — the 13G Ledger (MODEL CONFIRMED, first drawn in doc 3).
 *
 * Tier groups carry the single price; rows underneath are priceless — a
 * consolidated dye has no listing of its own to print, so a per-dye price
 * inside a Spectrum group would be an invented number. The command chip sits
 * inline in the centre of the header row (Budget Chip Rework 1a, confirmed
 * 2026-08-07: zero height cost, it takes the name column's slack).
 *
 * Blanks, never inventions: a missing price prints an em dash — offline the
 * board figures dash out, vendor costs stay, and a ratio without a numerator
 * is an empty cell rather than a fabricated number.
 *
 * The ΔE column follows the chosen matching method (values, width, tier
 * tones); the GIL/ΔE ratio column is PINNED to ΔE2000 whatever the switch
 * says — the ratio changes magnitude with the unit and is comparable across
 * none of them. Tier classification happens upstream (the caller knows the
 * method); this module takes tier indices and pre-formatted strings.
 *
 * @module budget-ledger
 */

import {
  CARD_WIDTH,
  CARD_TYPE,
  cardShell,
  cardTheme,
  cardText,
  commandChip,
  fitText,
  hairline,
  markFooter,
  swatch,
  textWidth,
  type CardTheme,
} from './frame.js';
import { toolGlyph } from './icons/tool-icons.js';

// ============================================================================
// Types
// ============================================================================

export interface BudgetLedgerRow {
  hex: string;
  /** Localized dye name */
  name: string;
  /** Distance in the chosen method's display unit, pre-formatted */
  de: string;
  /** Band tier 0–3 for the tone (classified upstream — cuts are per method) */
  tier: number;
  /** Integer-method tie (DISTINGUISH %): the value goes amber */
  tie?: boolean;
  /** gil per ΔE2000 point, pre-formatted, or null → em dash */
  perDe: string | null;
}

export interface BudgetLedgerGroup {
  /** Verbatim EN Spectrum item name (A/B/C) or localized acquisition */
  tier: string;
  /** The group's single pre-formatted price, or null → em dash */
  price: string | null;
  /** Green flag pill (vendor undercuts the board), or absent */
  flag?: string | null;
  rows: BudgetLedgerRow[];
}

export interface BudgetLedgerLabels {
  /** TARGET */
  lTarget: string;
  /** CANDIDATE */
  lCandidate: string;
  /** ΔE column header — the method's short tag off-default */
  deLabel: string;
  /** GIL/ΔE — pinned, never varies with the method */
  perDeLabel: string;
  /** Generated footer key; a second line appears off-ΔE2000 */
  keyLines: string[];
}

export interface BudgetLedgerOptions {
  target: {
    hex: string;
    name: string;
    /** Pre-formatted price or null → em dash */
    price: string | null;
    /** board only / vendor / no price — names the price's source */
    subLabel: string;
  };
  groups: BudgetLedgerGroup[];
  labels: BudgetLedgerLabels;
  lang: string;
  theme?: 'dark' | 'light';
  commandLabel?: string;
  commandGlyph?: string | null;
  /** Widen the ΔE column 34 → 42 px for 3-digit methods (RGB DIST etc.) */
  wideDe?: boolean;
}

// ============================================================================
// Layout constants (shared with the calculator's row cap)
// ============================================================================

const PAD = 15;

/** Header block bottom edge (swatch row). */
export const LEDGER_HEADER_H = 43;
/** Column-header strip height under the header. */
export const LEDGER_COLHEAD_H = 27;
/** Group header band height. */
export const LEDGER_GROUP_H = 24;
/** Candidate row height. */
export const LEDGER_ROW_H = 40;
/** Footer height with one key line / with the off-default second line. */
export const LEDGER_FOOTER_H = 32;
export const LEDGER_FOOTER_2LINE_H = 47;

const DASH = '—';

// ============================================================================
// Generator
// ============================================================================

/** Generate the 13G budget ledger card. */
export function generateBudgetLedger(options: BudgetLedgerOptions): string {
  const theme: CardTheme = cardTheme(options.theme);
  const { labels, target } = options;
  const commandLabel = options.commandLabel ?? '/BUDGET';
  const glyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : toolGlyph('budget', 'compact', { size: 13, ink: theme.pillInk, accent: theme.glyphAccent });

  const deColW = options.wideDe ? 42 : 34;
  const perDeColW = 68;
  const rightX = CARD_WIDTH - PAD;
  const deRight = rightX - perDeColW - 10;
  const nameX = PAD + 40 + 10;

  const parts: string[] = [];

  // Header: swatch · TARGET/name · chip (inline, centred) · price column
  parts.push(swatch(PAD, 13, 30, 30, target.hex, theme, 8));
  const priceStr = target.price ?? DASH;
  const priceColW = Math.max(
    textWidth(priceStr, 13.5, 'mono'),
    textWidth(target.subLabel, CARD_TYPE.label, 'mono')
  );
  const chip = commandChip(0, 0, commandLabel, theme, { glyph });
  const chipX = rightX - priceColW - 10 - chip.width;
  parts.push(`<g transform="translate(${chipX},18)">${chip.svg}</g>`);
  const nameColX = PAD + 30 + 10;
  const nameMax = chipX - nameColX - 10;
  parts.push(
    cardText(nameColX, 23, labels.lTarget, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 0.8,
    })
  );
  parts.push(
    cardText(nameColX, 41, fitText(target.name, nameMax, 14, 'body'), {
      fill: theme.name,
      size: 14,
      font: 'body',
      weight: 600,
    })
  );
  parts.push(
    cardText(rightX, 25, priceStr, {
      fill: target.price ? theme.value : theme.label,
      size: 13.5,
      font: 'mono',
      anchor: 'end',
    })
  );
  parts.push(
    cardText(rightX, 41, target.subLabel, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      anchor: 'end',
    })
  );

  // Column header: spacer · CANDIDATE · ΔE · GIL/ΔE
  const colHeadBase = LEDGER_HEADER_H + 21;
  parts.push(
    cardText(nameX, colHeadBase, labels.lCandidate, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 0.8,
    })
  );
  parts.push(
    cardText(deRight, colHeadBase, labels.deLabel, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 0.8,
      anchor: 'end',
    })
  );
  parts.push(
    cardText(rightX, colHeadBase, labels.perDeLabel, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 0.8,
      anchor: 'end',
    })
  );

  // Groups
  const groupWash = theme.mode === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(23,24,27,0.035)';
  const flagInk = theme.mode === 'dark' ? '#5bbd68' : '#137A33';
  const flagBg = theme.mode === 'dark' ? 'rgba(91,189,104,0.14)' : 'rgba(19,122,51,0.10)';
  let y = LEDGER_HEADER_H + LEDGER_COLHEAD_H;

  for (const g of options.groups) {
    // Group header band: tier · flag pill · the single price
    parts.push(hairline(0, CARD_WIDTH, y, theme));
    parts.push(`<rect x="0" y="${y}" width="${CARD_WIDTH}" height="${LEDGER_GROUP_H}" fill="${groupWash}"/>`);
    const gPrice = g.price ?? DASH;
    const gPriceW = textWidth(gPrice, 12, 'mono');
    let tierMax = rightX - gPriceW - 10 - PAD;
    if (g.flag) {
      const flagW = textWidth(g.flag, CARD_TYPE.label, 'mono') + 10;
      const flagX = rightX - gPriceW - 8 - flagW;
      parts.push(
        `<rect x="${flagX.toFixed(1)}" y="${y + 4.5}" width="${flagW.toFixed(1)}" height="15" rx="4" fill="${flagBg}"/>`
      );
      parts.push(
        cardText(flagX + 5, y + 16, g.flag, { fill: flagInk, size: CARD_TYPE.label, font: 'mono' })
      );
      tierMax = flagX - PAD - 8;
    }
    parts.push(
      cardText(PAD, y + 16, fitText(g.tier, tierMax, 11.5, 'mono'), {
        fill: theme.value,
        size: 11.5,
        font: 'mono',
      })
    );
    parts.push(
      cardText(rightX, y + 16, gPrice, {
        fill: g.price ? theme.value : theme.label,
        size: 12,
        font: 'mono',
        anchor: 'end',
      })
    );
    y += LEDGER_GROUP_H;

    // Rows: swatch · name · ΔE in the tone · GIL/ΔE
    for (const r of g.rows) {
      parts.push(hairline(0, CARD_WIDTH, y, theme));
      const cy = y + LEDGER_ROW_H / 2;
      parts.push(swatch(PAD, cy - 14, 40, 28, r.hex, theme, 7));
      parts.push(
        cardText(nameX, cy + 4.5, fitText(r.name, deRight - deColW - 10 - nameX, 13, 'body'), {
          fill: theme.name,
          size: 13,
          font: 'body',
          weight: 600,
        })
      );
      const tone = r.tie ? theme.tiers[2] : theme.tiers[Math.min(Math.max(r.tier, 0), 3)];
      parts.push(
        cardText(deRight, cy + 4, r.de, { fill: tone, size: 12.5, font: 'mono', anchor: 'end' })
      );
      parts.push(
        cardText(rightX, cy + 4, r.perDe ?? DASH, {
          fill: r.perDe ? theme.value : theme.label,
          size: 12.5,
          font: 'mono',
          anchor: 'end',
        })
      );
      y += LEDGER_ROW_H;
    }
  }

  // Footer: generated key line(s), mark bottom-right (never centred). With a
  // second (method) line, the shorter formula shares its row with the mark and
  // the method note takes the full width below.
  const twoLines = labels.keyLines.length > 1;
  const height = Math.round(y + (twoLines ? LEDGER_FOOTER_2LINE_H : LEDGER_FOOTER_H));
  const markLineY = twoLines ? height - 28 : height - 13;
  parts.push(
    cardText(PAD, markLineY, fitText(labels.keyLines[0], CARD_WIDTH - PAD * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  if (twoLines) {
    parts.push(
      cardText(PAD, height - 13, fitText(labels.keyLines[1], CARD_WIDTH - PAD * 2, CARD_TYPE.label, 'mono'), {
        fill: theme.label,
        size: CARD_TYPE.label,
        font: 'mono',
      })
    );
  }
  parts.push(markFooter(rightX, markLineY, theme));

  return cardShell(height, theme, parts.join(''));
}
