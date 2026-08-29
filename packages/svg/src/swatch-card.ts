/**
 * /swatch — the character sheet frame (confirmed 2026-08-07, 1a + 1b).
 *
 * One card, two orders behind the `order:` option: `slots` (file order, so
 * two reposts of the same character agree) and `hardest` (worst-first). The
 * chip stays /SWATCH for both — order is an option on the same frame, not a
 * subcommand rendering a different card.
 *
 * measuredRow consumer #5, and the abstraction holds: lead = the slot label
 * (a shaped label — slot short over grid address, OFF GRID in amber), butted
 * character→dye pair, name, tier bar, measure. Rows are LIVE slots only —
 * an inert slot is not a row; the footer counts what parsed. Past five live
 * slots the safest match drops (/contrast's tail rule), whatever the order —
 * the caller orders and caps; this module draws.
 *
 * @module swatch-card
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
  measuredRow,
  textWidth,
  type CardTheme,
  type MeasuredRowWidths,
} from './frame.js';
import { escapeXml } from './base.js';
import { toolGlyph } from './icons/tool-icons.js';

// ============================================================================
// Types
// ============================================================================

export interface SwatchCardRow {
  /** Localized slot short (SKIN / HAUT / 肌 …) */
  slotLabel: string;
  /** Grid address ("R6·C3", "R4·C7·LR") or the OFF-GRID short */
  addr: string;
  /** OFF GRID — the address line goes amber */
  addrWarn?: boolean;
  /** The character's winning colour (float when off grid, blend for the lip) */
  sourceHex: string;
  /** The matched dye */
  dyeHex: string;
  /** Localized dye name */
  name: string;
  /** ΔE2000 character colour → dye */
  deltaE: number;
}

export interface SwatchCardLabels {
  /** SLOT / EMPL. / 部位 … */
  lSlot: string;
  /** NEAREST DYE / NÄCHSTE FARBE / … */
  lNearest: string;
  /** Generated: "nearest by ΔE2000 · {s} of {n} slots" ×6 */
  footKey: string;
}

export interface SwatchCardOptions {
  /** Live slot colours in file order — the header strip */
  stripHexes: string[];
  /** Tribe EN + gender symbol + producer — NOT localized (identifier line) */
  charSub: string;
  /** Neutral card title (localized "Character swatch") — NEVER the character's name or the attachment filename; players may use their real name. */
  title: string;
  /** Ordered + capped by the caller */
  rows: SwatchCardRow[];
  labels: SwatchCardLabels;
  lang: string;
  theme?: 'dark' | 'light';
  commandLabel?: string;
  commandGlyph?: string | null;
}

// ============================================================================
// Generator
// ============================================================================

const PAD = 15;
const ROW_H = 46;
const WIDTHS: MeasuredRowWidths = { lead: 56, pair: 54, name: 158, bar: 26, measure: 36 };

/** Generate the /swatch character sheet card. */
export function generateSwatchCard(options: SwatchCardOptions): string {
  const theme: CardTheme = cardTheme(options.theme);
  const { labels } = options;
  const commandLabel = options.commandLabel ?? '/SWATCH';
  const glyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : toolGlyph('swatch', 'compact', { size: 13, ink: theme.pillInk, accent: theme.glyphAccent });

  const rightX = CARD_WIDTH - PAD;
  const parts: string[] = [];

  // Header: live-slot strip · charSub over title · /SWATCH chip
  const stripW = 66;
  const stripes = options.stripHexes.length > 0 ? options.stripHexes : ['#000000'];
  const stripeW = stripW / stripes.length;
  parts.push(`<clipPath id="swstrip"><rect x="${PAD}" y="13" width="${stripW}" height="30" rx="7"/></clipPath>`);
  parts.push(`<g clip-path="url(#swstrip)">`);
  stripes.forEach((hex, i) => {
    parts.push(
      `<rect x="${(PAD + i * stripeW).toFixed(2)}" y="13" width="${(stripeW + 0.5).toFixed(2)}" height="30" fill="${escapeXml(hex)}"/>`
    );
  });
  parts.push(`</g>`);
  parts.push(
    `<rect x="${PAD + 0.5}" y="13.5" width="${stripW - 1}" height="29" rx="6.5" fill="none" stroke="${theme.swatchRing}" stroke-width="1"/>`
  );

  const chip = commandChip(0, 0, commandLabel, theme, { glyph });
  const chipX = rightX - chip.width;
  parts.push(`<g transform="translate(${chipX},18)">${chip.svg}</g>`);

  const textX = PAD + stripW + 10;
  const textMax = chipX - textX - 10;
  parts.push(
    cardText(textX, 23, fitText(options.charSub, textMax, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 0.8,
    })
  );
  parts.push(
    cardText(textX, 41, fitText(options.title, textMax, 14, 'body'), {
      fill: theme.name,
      size: 14,
      font: 'body',
      weight: 600,
    })
  );

  // Column header: SLOT · NEAREST DYE · ΔE
  const colHeadBase = 64;
  parts.push(
    cardText(PAD, colHeadBase, labels.lSlot, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 0.8,
    })
  );
  parts.push(
    cardText(PAD + WIDTHS.lead + 10, colHeadBase, fitText(labels.lNearest, 200, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 0.8,
    })
  );
  parts.push(
    cardText(rightX, colHeadBase, 'ΔE', {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 0.8,
      anchor: 'end',
    })
  );

  // Rows — live slots only, ordered and capped upstream
  let y = colHeadBase + 6;
  for (const r of options.rows) {
    parts.push(hairline(PAD, rightX, y, theme));
    parts.push(
      measuredRow(PAD, y, ROW_H, {
        lead: { text: r.slotLabel, sub: r.addr, ...(r.addrWarn ? { subTone: 'warn' as const } : {}) },
        sourceHex: r.sourceHex,
        dyeHex: r.dyeHex,
        name: r.name,
        deltaE: r.deltaE,
        lang: options.lang,
        theme,
        widths: WIDTHS,
        nameSize: 13,
      })
    );
    y += ROW_H;
  }
  parts.push(hairline(PAD, rightX, y, theme));

  // Footer: the generated count key + the mark
  const height = Math.round(y + 33);
  const markW = 18 + 7 + textWidth('xivdyetools.app', CARD_TYPE.label, 'mono');
  parts.push(
    cardText(PAD, height - 13, fitText(labels.footKey, CARD_WIDTH - PAD * 2 - markW - 10, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(markFooter(rightX, height - 13, theme));

  return cardShell(height, theme, parts.join(''));
}
