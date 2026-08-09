/**
 * Budget OG image — the 15E band (5.0, net-new route; the first-drawn
 * exception test, and it half-fails BY DESIGN).
 *
 * Gil-per-ΔE has no proportional reading, so the ledger's ranked column
 * collapses into one headline naming a single winner (widening bands by
 * value-for-money makes the poorest candidates unreadably narrow —
 * rejected). Price rides on the tier label, never the dye: 85 dyes share
 * one Spectrum listing. A cached PNG carries no live board data, so the
 * only price printed is the vendor's 216 — the one number that cannot
 * move; everything else is Δ + tier, dashes never inventions.
 *
 * @module services/svg/budget
 */

import { ColorService } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, type BandEntry, type BandFrame } from './band';
import { bandGlyph, notFoundBand } from './band-shared';
import { dyeService, getDyeByItemId } from './dye-helpers';
import { deckLine, getToolTag } from '../og-strings';
import { getLocalizedDyeName } from '../translator';

export interface BudgetOGOptions {
  /** Target dye stainID */
  dyeId: number;
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame */
  frame?: BandFrame;
}

/** Pricing-path short labels (identifiers on the card). */
function tierLabel(dye: Dye): string {
  if (dye.consolidationType === 'A') return 'STD SPECTRUM';
  if (dye.consolidationType === 'B') return 'WIDE #1';
  if (dye.consolidationType === 'C') return 'WIDE #2';
  return dye.acquisition === 'Venture Coffers' ? 'COFFER' : 'BOARD';
}

/** The one static price: the Standard Spectrum vendor's 216 gil. */
function tierPrice(dye: Dye): string {
  return dye.consolidationType === 'A' ? '216 G' : '—';
}

/**
 * Generates the Budget OG image SVG (400-grid — raster ×3 downstream).
 */
export function generateBudgetOG(options: BudgetOGOptions): string {
  const { dyeId, locale = 'en', frame = 'discord' } = options;

  const target = getDyeByItemId(dyeId);
  if (!target) {
    return notFoundBand(getToolTag('budget', locale), 'budget', `#${dyeId}`, 'budget', frame);
  }

  // Nearest four from a CHEAPER pricing path than the target's own — for a
  // vendor-tier target there is nothing cheaper, so nearest-any stands in.
  const targetIsVendor = target.consolidationType === 'A';
  const candidates = dyeService
    .getAllDyes()
    .filter((d: Dye) => d.id !== target.id && (targetIsVendor || d.consolidationType === 'A'))
    .map((dye: Dye) => ({
      dye,
      delta: ColorService.getDistanceForMethod(target.hex, dye.hex, 'ciede2000'),
    }))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 4);

  const best = candidates[0];
  const bands: BandEntry[] = [
    {
      hex: target.hex,
      role: `TARGET · ${tierLabel(target)}`,
      name: getLocalizedDyeName(target, locale),
      value: target.hex.toUpperCase(),
      tag: `#${target.stainID ?? target.id}`,
      grow: 2,
      nameSize: 17,
    },
    // Budget is the only card that wanted two figures per band, and it cannot
    // have them on EITHER frame: five bands make each candidate ~67px wide
    // (~51px usable) regardless of height, and 'Δ5.2 · 216 G' measures 74+.
    // So one figure per row throughout — and 'STD SPECTRUM' does not fit that
    // row either, ellipsising to an identical 'STD S…' on every priced band.
    // The price goes there instead ('216 G' ≈ 34px), which is the fact the
    // tier name was standing in for anyway; the footer names the tier once.
    // The coffer keeps its label and no figure — no listing is its answer.
    ...candidates.map((c) => ({
      hex: c.dye.hex,
      role: tierPrice(c.dye) !== '—' ? tierPrice(c.dye) : tierLabel(c.dye),
      name: getLocalizedDyeName(c.dye, locale),
      value: c.dye.hex.toUpperCase(),
      tag: `Δ${c.delta.toFixed(1)}`,
      grow: 1,
    })),
  ];

  const bestName = getLocalizedDyeName((best ?? { dye: target }).dye, locale);

  return generateBandCard({
    bands,
    toolTag: getToolTag('budget', locale),
    toolGlyph: bandGlyph('budget'),
    path: 'xivdyetools.app/budget',
    // The ledger ranked four; the band recommends one. That verdict is the
    // deck on Discord and moves to the footer's right slot on X.
    deck: `${deckLine('budgetBest', locale)} ${bestName}`,
    footRight: frame === 'x' ? `BEST · ${bestName}` : 'VENDOR 216 G',
    footRightFont: frame === 'x' ? 'body' : 'mono',
    frame,
  });
}
