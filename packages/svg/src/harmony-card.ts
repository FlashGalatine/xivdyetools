/**
 * /harmony — the confirmed 11A Card (Turn 11).
 *
 * One row per slot, and the swatch pair carries the whole argument: the
 * outlined square is the hue the maths asked for, the solid square is what
 * exists. The wheel is gone entirely — it was 160,000 pixels saying less
 * than these rows do. Rows are a 55 px rhythm, the frame grows with the
 * harmony, and R1 caps the rows at three (monochromatic's five slots become
 * three rows plus a tail strip — capping, not compressing).
 *
 * Bands are harmony-calibrated (≤6 exact · ≤12 close · ≤20 loose), not
 * match-calibrated.
 *
 * @module harmony-card
 */

import { classifyBandTier } from '@xivdyetools/core';
import { num } from './base.js';
import { toolGlyph } from './icons/tool-icons.js';
import {
  CARD_WIDTH,
  CARD_TYPE,
  HARMONY_ROW_CAP,
  cardShell,
  cardTheme,
  cardText,
  commandChip,
  dashedRule,
  fitText,
  idealSwatch,
  markFooter,
  swatch,
  type CardTheme,
} from './frame.js';

// ============================================================================
// Types
// ============================================================================

export interface HarmonyCardSlot {
  /** The hue the maths asked for (outlined swatch); null renders no ideal */
  idealHex: string | null;
  /** The dye that exists (solid swatch) */
  hex: string;
  localizedName: string;
  /** Sub line, e.g. "#658241 · STAIN 51" */
  subText: string;
  /** ΔE2000 ideal → found (harmony-calibrated bands); null hides the verdict */
  deltaE: number | null;
}

export interface HarmonyCardLabels {
  /** BASE / BASIS / ベース … */
  base: string;
  /** The footer legend: "outline = ideal · solid = found" ×6 */
  idealKey: string;
}

export interface HarmonyCardOptions {
  /** Localized harmony-type label (rendered uppercase, accent) */
  typeLabel: string;
  baseHex: string;
  baseName: string;
  /** Base sub line, e.g. "#781A1A · STAIN 10" */
  baseSubText: string;
  slots: HarmonyCardSlot[];
  labels: HarmonyCardLabels;
  /** Harmony tier words ×4 (EXACT/CLOSE/LOOSE/UNREACHABLE, localized) */
  tierWords: readonly [string, string, string, string];
  lang: string;
  theme?: 'dark' | 'light';
  commandLabel?: string;
  /** Rendered 13 px glyph for the pill (the harmony tool glyph) */
  commandGlyph?: string | null;
}

// ============================================================================
// Generator
// ============================================================================

const PAD_X = 16;
const ROW_H = 55;

/**
 * Generate the /harmony card (11A). Height grows with the slots and stops
 * well under the 350 ceiling; slots past three become a tail swatch strip.
 */
export function generateHarmonyCard(options: HarmonyCardOptions): string {
  const {
    typeLabel,
    baseHex,
    baseName,
    baseSubText,
    labels,
    tierWords,
    lang,
    commandLabel = '/HARMONY',
  } = options;
  const theme: CardTheme = cardTheme(options.theme);
  // 2A: the tool glyph rides inside the pill, accent chip in the accent slot
  const commandGlyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : toolGlyph('harmony', 'compact', { size: 13, ink: theme.pillInk, accent: theme.glyphAccent });
  const rows = options.slots.slice(0, HARMONY_ROW_CAP);
  const tail = options.slots.slice(HARMONY_ROW_CAP);
  const parts: string[] = [];

  // --- Header: pill + harmony type
  const chip = commandChip(PAD_X, 15, commandLabel, theme, { glyph: commandGlyph });
  parts.push(chip.svg);
  parts.push(
    cardText(CARD_WIDTH - PAD_X, 15 + 15, typeLabel.toUpperCase(), {
      fill: theme.accentText,
      size: CARD_TYPE.value,
      font: 'mono',
      letterSpacing: 0.6,
      anchor: 'end',
    })
  );

  // --- Base block
  const baseTop = 15 + 21 + 13;
  parts.push(swatch(PAD_X, baseTop, 62, 62, baseHex, theme, 11));
  const bx = PAD_X + 62 + 12;
  parts.push(
    cardText(bx, baseTop + 13, labels.base, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1.1,
    })
  );
  parts.push(
    cardText(bx, baseTop + 36, fitText(baseName, CARD_WIDTH - bx - PAD_X, 20, 'display'), {
      fill: theme.name,
      size: 20,
      font: 'display',
      weight: 600,
    })
  );
  parts.push(cardText(bx, baseTop + 54, baseSubText, { fill: theme.subValue, size: 12, font: 'mono' }));

  // --- Divider
  const divY = baseTop + 62 + 13;
  parts.push(dashedRule(PAD_X, CARD_WIDTH - PAD_X, divY, theme));

  // --- Slot rows (55 px rhythm)
  rows.forEach((s, i) => {
    const top = divY + 13 + i * ROW_H;
    const cy = top + 21; // centre of the 42 px found swatch
    let x = PAD_X;
    if (s.idealHex) {
      parts.push(idealSwatch(x, cy - 17, 34, 34, s.idealHex, 9));
      x += 34 + 5;
      parts.push(
        cardText(x, cy + 4, '→', { fill: theme.label, size: 12, font: 'body' })
      );
      x += 14;
    }
    parts.push(swatch(x, cy - 21, 42, 42, s.hex, theme, 10));
    x += 42 + 11;

    // Right column: ΔE + tier word
    let rightW = 0;
    if (s.deltaE != null) {
      const tier = classifyBandTier(s.deltaE, 'ciede2000', 'harmony');
      const tone = theme.tiers[Math.min(tier, 3)];
      const deText = num(s.deltaE, lang, 1);
      const word = tierWords[Math.min(tier, 3)];
      parts.push(
        cardText(CARD_WIDTH - PAD_X, cy - 2, deText, {
          fill: tone,
          size: 19,
          font: 'display',
          weight: 700,
          anchor: 'end',
        })
      );
      parts.push(
        cardText(CARD_WIDTH - PAD_X, cy + 13, word, {
          fill: tone,
          size: CARD_TYPE.label,
          font: 'mono',
          letterSpacing: 0.6,
          anchor: 'end',
        })
      );
      rightW = 86;
    }

    const nameW = CARD_WIDTH - PAD_X - x - rightW;
    parts.push(
      cardText(x, cy - 1, fitText(s.localizedName, nameW, 15, 'body'), {
        fill: theme.name,
        size: 15,
        font: 'body',
        weight: 600,
      })
    );
    parts.push(
      cardText(x, cy + 15, fitText(s.subText, nameW, 11.5, 'mono'), {
        fill: theme.label,
        size: 11.5,
        font: 'mono',
      })
    );
  });

  // --- Tail strip (R1: capping, not compressing)
  let tailH = 0;
  if (tail.length > 0) {
    const tailTop = divY + 13 + rows.length * ROW_H + 4;
    let x = PAD_X;
    for (const s of tail) {
      parts.push(swatch(x, tailTop, 26, 26, s.hex, theme, 7));
      x += 26 + 6;
    }
    parts.push(
      cardText(x + 4, tailTop + 17, `+${tail.length}`, {
        fill: theme.label,
        size: CARD_TYPE.value,
        font: 'mono',
      })
    );
    tailH = 26 + 10;
  }

  // --- Footer: legend + mark
  const footY = divY + 13 + rows.length * ROW_H + tailH + 12 + 11;
  const height = Math.min(350, footY + 13);
  parts.push(
    cardText(PAD_X, height - 13, fitText(labels.idealKey, CARD_WIDTH - PAD_X * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(markFooter(CARD_WIDTH - PAD_X, height - 13, theme));

  return cardShell(height, theme, parts.join(''));
}
