/**
 * /harmony — 11A Card, re-cut to the Turn-13 geometry.
 *
 * One row per slot, and the swatch pair carries the whole argument: the
 * outlined square is the hue the maths asked for, the solid square is what
 * exists. The wheel is gone entirely — it was 160,000 pixels saying less
 * than these rows do.
 *
 * Turn 11 drew this at 400 × 390 with 55 px rows capped at three, which
 * predates the 350 px ceiling and breaks it. Turn 13 re-measured the frame
 * against a square harmony (base + three slots) and corrected it:
 *
 * - rows are **39 px**, and the frame still holds 44.9 px of spare height —
 *   so base plus **four** slots renders at 350 with about 6 px spare, and
 *   six colours do not fit. `HARMONY_ROW_CAP` is 4.
 * - the base row **loses its hex line**, which the swatch pair already
 *   implies; that line is what pays for the verdict block.
 * - the verdict compresses to `↓ 270° · name · value` — a glyph rather than
 *   a label, because "weakest slot" overran the row in German.
 * - the swatch pair shrinks to 24 / 32 px.
 * - each slot leads with the **angle** the maths asked for.
 *
 * Bands are harmony-calibrated (≤6 exact · ≤12 close · ≤20 loose) and that
 * calibration is ΔE2000's. The other five methods scale it, so a tier is a
 * property of the *method*, never of the pair — which is why the method is
 * printed wherever a tier or a verdict appears, and why a tier is never
 * compared across methods.
 *
 * @module harmony-card
 */

import { classifyBandTier, MATCHING_METHOD_TAGS, type MatchingMethod } from '@xivdyetools/core';
import { num } from './base.js';
import { toolGlyph } from './icons/tool-icons.js';
import {
  CARD_WIDTH,
  CARD_MAX_HEIGHT,
  CARD_TYPE,
  HARMONY_ROW_CAP,
  cardShell,
  cardTheme,
  cardText,
  commandChip,
  dashedRule,
  fitText,
  hairline,
  idealSwatch,
  markFooter,
  swatch,
  textWidth,
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
  /** ΔE ideal → found in the chosen method; null hides the verdict */
  deltaE: number | null;
  /**
   * The angle the maths asked for, e.g. "90°" — the row's lead. Omitted for
   * harmonies with no angular offset (monochromatic).
   */
  angleLabel?: string;
}

export interface HarmonyCardLabels {
  /** BASE / BASIS / ベース … */
  base: string;
  /** IDEAL HUE / IDEALFARBTON / 理想の色相 … (column header, left half) */
  ideal: string;
  /** NEAREST DYE / NÄCHSTER / 最も近い色 … (column header, right half) */
  found: string;
  /** The footer legend: "bands: ≤6 / ≤12 / ≤20" ×6 */
  bandKey: string;
  /**
   * Second footer line, present only off-default: "ΔE2000-derived" ×6. The
   * derivation is not tier-preserving, so the card says which case it is.
   */
  derivedNote?: string | null;
}

export interface HarmonyCardOptions {
  /** Localized harmony-type label (rendered uppercase, accent) */
  typeLabel: string;
  baseHex: string;
  baseName: string;
  /**
   * The base's own angle, e.g. "0°". Turn 13 dropped the base hex line, so
   * this rides on the BASE label rather than taking a line of its own.
   */
  baseAngle?: string;
  slots: HarmonyCardSlot[];
  labels: HarmonyCardLabels;
  /** Harmony tier words ×4 (EXACT/CLOSE/LOOSE/UNREACHABLE, localized) */
  tierWords: readonly [string, string, string, string];
  /**
   * The weakest slot, pre-composed by the caller as `270° · name · value`.
   * The card draws the ↓ badge; the words are the caller's because every
   * piece of them is already localized. Null renders no verdict block.
   */
  verdict?: string | null;
  /**
   * The matching method the search ran under. Drives the ΔE column header,
   * the band derivation and the printed tag. Defaults to ΔE2000.
   */
  method?: MatchingMethod;
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

/** Turn 13's measured slot row — 55 px was Turn 11's, and broke the ceiling. */
const ROW_H = 39;

/** The pair shrank to 24 / 32 to pay for the verdict block. */
const IDEAL_W = 24;
const FOUND_W = 32;

/**
 * Generate the /harmony card (11A at Turn-13 geometry). Height grows with
 * the slots and stops at the 350 ceiling; slots past four become a tail
 * swatch strip (capping, not compressing).
 */
export function generateHarmonyCard(options: HarmonyCardOptions): string {
  const {
    typeLabel,
    baseHex,
    baseName,
    baseAngle = '0°',
    labels,
    tierWords,
    lang,
    method = 'ciede2000',
    verdict = null,
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
  const offDefault = method !== 'ciede2000';
  const parts: string[] = [];

  // --- Header: pill + harmony type
  const chip = commandChip(PAD_X, 14, commandLabel, theme, { glyph: commandGlyph });
  parts.push(chip.svg);
  parts.push(
    cardText(CARD_WIDTH - PAD_X, 14 + 15, typeLabel.toUpperCase(), {
      fill: theme.accentText,
      size: CARD_TYPE.value,
      font: 'mono',
      letterSpacing: 0.6,
      anchor: 'end',
    })
  );

  // --- Base block (no hex line — the swatch pair already implies it)
  const baseTop = 46;
  const baseSize = 46;
  parts.push(swatch(PAD_X, baseTop, baseSize, baseSize, baseHex, theme, 10));
  const bx = PAD_X + baseSize + 12;
  parts.push(
    cardText(bx, baseTop + 14, `${labels.base} · ${baseAngle}`, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1.1,
    })
  );
  parts.push(
    cardText(bx, baseTop + 38, fitText(baseName, CARD_WIDTH - bx - PAD_X, 19, 'display'), {
      fill: theme.name,
      size: 19,
      font: 'display',
      weight: 600,
    })
  );

  // --- Divider
  const divY = baseTop + baseSize + 11;
  parts.push(dashedRule(PAD_X, CARD_WIDTH - PAD_X, divY, theme));

  // --- Column header: IDEAL HUE → NEAREST DYE, with the method's ΔE tag
  const headY = divY + 13 + 8;
  const deTag = offDefault ? MATCHING_METHOD_TAGS[method] : 'ΔE';
  parts.push(
    cardText(PAD_X, headY, `${labels.ideal} → ${labels.found}`, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1,
    })
  );
  parts.push(
    cardText(CARD_WIDTH - PAD_X, headY, deTag, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1,
      anchor: 'end',
    })
  );

  // --- Slot rows (39 px rhythm)
  const rowsTop = headY + 7;
  // A wide tag (REDMEAN, DISTINGUISH %) needs its column, or the name runs under it
  const rightW = Math.max(78, Math.ceil(textWidth(deTag, CARD_TYPE.value, 'mono')) + 46);
  rows.forEach((s, i) => {
    const top = rowsTop + i * ROW_H;
    const cy = top + ROW_H / 2;
    let x = PAD_X;

    // Lead: the angle the maths asked for
    if (s.angleLabel) {
      parts.push(
        cardText(x, cy + 4, s.angleLabel, {
          fill: theme.subValue,
          size: CARD_TYPE.label,
          font: 'mono',
          letterSpacing: 0.6,
        })
      );
      x += 32;
    }

    // The pair: outlined ideal → solid found
    if (s.idealHex) {
      parts.push(idealSwatch(x, cy - 12, IDEAL_W, 24, s.idealHex, 6));
      x += IDEAL_W + 4;
      parts.push(cardText(x, cy + 4, '→', { fill: theme.label, size: 11, font: 'body' }));
      x += 12;
    }
    parts.push(swatch(x, cy - 16, FOUND_W, 32, s.hex, theme, 7));
    x += FOUND_W + 10;

    // Right column: ΔE + tier word
    let usedRight = 0;
    if (s.deltaE != null) {
      const tier = classifyBandTier(s.deltaE, method, 'harmony');
      const tone = theme.tiers[Math.min(tier, 3)];
      parts.push(
        cardText(CARD_WIDTH - PAD_X, cy, num(s.deltaE, lang, 1), {
          fill: tone,
          size: 16,
          font: 'display',
          weight: 700,
          anchor: 'end',
        })
      );
      parts.push(
        cardText(CARD_WIDTH - PAD_X, cy + 13, tierWords[Math.min(tier, 3)], {
          fill: tone,
          size: CARD_TYPE.label,
          font: 'mono',
          letterSpacing: 0.6,
          anchor: 'end',
        })
      );
      usedRight = rightW;
    }

    const nameW = CARD_WIDTH - PAD_X - x - usedRight;
    parts.push(
      cardText(x, cy - 1, fitText(s.localizedName, nameW, 14, 'body'), {
        fill: theme.name,
        size: 14,
        font: 'body',
        weight: 600,
      })
    );
    parts.push(
      cardText(x, cy + 13, fitText(s.subText, nameW, CARD_TYPE.label, 'mono'), {
        fill: theme.label,
        size: CARD_TYPE.label,
        font: 'mono',
      })
    );
  });

  // --- Tail strip (R1: capping, not compressing)
  let cursor = rowsTop + rows.length * ROW_H;
  if (tail.length > 0) {
    const tailTop = cursor + 3;
    let x = PAD_X;
    for (const s of tail) {
      parts.push(swatch(x, tailTop, 22, 22, s.hex, theme, 6));
      x += 22 + 5;
    }
    parts.push(
      cardText(x + 4, tailTop + 15, `+${tail.length}`, {
        fill: theme.label,
        size: CARD_TYPE.value,
        font: 'mono',
      })
    );
    cursor = tailTop + 22 + 4;
  }

  // --- Footer budget, in the order the design trades things away.
  //
  // The derived note goes first: the method TAG in the ΔE column header is
  // the load-bearing half (it is what stops two players comparing tiers that
  // were never comparable), while the line explaining the derivation is the
  // gloss. The verdict goes only if that was not enough.
  const footerLines = [labels.bandKey];
  if (offDefault && labels.derivedNote) footerLines.push(labels.derivedNote);
  const VERDICT_H = 27;
  const footerBlock = (lines: number): number => 10 + lines * 14 + 6;
  const measure = (withVerdict: boolean): number =>
    Math.round(cursor + (withVerdict ? VERDICT_H : 0) + footerBlock(footerLines.length));

  let showVerdict = Boolean(verdict);
  let height = measure(showVerdict);
  if (height > CARD_MAX_HEIGHT && footerLines.length > 1) {
    footerLines.pop();
    height = measure(showVerdict);
  }
  if (height > CARD_MAX_HEIGHT && showVerdict) {
    showVerdict = false;
    height = measure(false);
  }
  height = Math.min(height, CARD_MAX_HEIGHT);

  // --- Verdict: ↓ badge + the caller's pre-composed "270° · name · value"
  if (showVerdict && verdict) {
    const vTop = cursor + 4;
    parts.push(hairline(PAD_X, CARD_WIDTH - PAD_X, vTop, theme));
    parts.push(
      cardText(PAD_X, vTop + 17, '↓', {
        fill: theme.tiers[3],
        size: CARD_TYPE.value,
        font: 'mono',
        weight: 700,
      })
    );
    parts.push(
      cardText(PAD_X + 14, vTop + 17, fitText(verdict, CARD_WIDTH - PAD_X * 2 - 14, 12.5, 'body'), {
        fill: theme.value,
        size: 12.5,
        font: 'body',
        weight: 600,
      })
    );
  }

  // --- Footer: legend (wraps to a second line, never ellipsises) + mark
  const legendW = CARD_WIDTH - PAD_X * 2 - 130;
  footerLines.forEach((line, i) => {
    parts.push(
      cardText(PAD_X, height - 8 - (footerLines.length - 1 - i) * 14, fitText(line, legendW, CARD_TYPE.label, 'mono'), {
        fill: theme.label,
        size: CARD_TYPE.label,
        font: 'mono',
      })
    );
  });
  parts.push(markFooter(CARD_WIDTH - PAD_X, height - 8, theme));

  return cardShell(height, theme, parts.join(''));
}
