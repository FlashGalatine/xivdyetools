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
    return notFoundBand('BUDGET', 'budget', `#${dyeId}`, 'budget', frame);
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
    ...candidates.map((c) => ({
      hex: c.dye.hex,
      role: tierLabel(c.dye),
      name: getLocalizedDyeName(c.dye, locale),
      value: c.dye.hex.toUpperCase(),
      tag: `Δ${c.delta.toFixed(1)} · ${tierPrice(c.dye)}`,
      grow: 1,
    })),
  ];

  return generateBandCard({
    bands,
    toolTag: 'BUDGET',
    toolGlyph: bandGlyph('budget'),
    subLine: 'VENDOR 216 G',
    bandLine: best ? getLocalizedDyeName(best.dye, locale) : getLocalizedDyeName(target, locale),
    urlLine: `xivdyetools.app/budget?dye=${target.stainID ?? target.id} · ΔE2000`,
    frame,
  });
}
