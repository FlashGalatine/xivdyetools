/**
 * Comparison OG image — the 15E band (5.0, a qualified acceptance).
 *
 * Four dyes are four bands — but six pair numbers are not four of anything.
 * The closest pair is widened (grow 3) and set ADJACENT so the comparison
 * is visible before it is read; the full pair-Δ run survives only in the
 * strip's sub-line and the embed (the accepted narrowing — 15A stays in the
 * design file as the ledger record).
 *
 * @module services/svg/comparison
 */

import { ColorService } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, type BandEntry, type BandFrame } from './band';
import { bandGlyph, notFoundBand } from './band-shared';
import { getDyeByItemId } from './dye-helpers';
import { role, getToolTag } from '../og-strings';
import { getLocalizedDyeName } from '../translator';

export interface ComparisonOGOptions {
  /** Array of dye stainIDs (1-4; param name kept for call-site stability) */
  dyeIds: number[];
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame */
  frame?: BandFrame;
}

/**
 * The card draws at most this many bands — extra `dyeIds` beyond this are
 * silently ignored by the render below. Exported so callers that BUILD a
 * `/og/comparison/...` URL (`og-data-generator.ts`) can emit only as many
 * ids as the card actually uses instead of guessing a number that could
 * drift from this one (2026-08-29 FINDING-024, OG-4, ruling S7-R17).
 */
export const COMPARISON_MAX_DYES = 4;

/**
 * Generates the Comparison OG image SVG (400-grid — raster ×3 downstream).
 */
export function generateComparisonOG(options: ComparisonOGOptions): string {
  const { locale = 'en', frame = 'discord' } = options;

  // og-8 (deep dive 2026-09-02): dedupe BEFORE slicing. `/og/comparison/1,1`
  // is canonical, so the S7-R12 grammar accepts it; `getDyeByItemId(1)` then
  // returned the SAME object twice, `dyes.length === 2` cleared the guard
  // below, and the card compared Snow White with itself — two identical
  // CLOSEST PAIR bands over the deck `Snow White ↔ Snow White · Δ0.0`.
  // Deduping first also means `1,1,2,3,4,5` still draws four distinct dyes
  // rather than three. The slice stays ahead of the resolve, so S7-R17's
  // "as many ids as the card draws" contract is unchanged.
  const dyes = [...new Set(options.dyeIds)]
    .slice(0, COMPARISON_MAX_DYES)
    .map((id) => getDyeByItemId(id))
    .filter((d): d is Dye => d !== undefined);
  if (dyes.length < 2) {
    return notFoundBand(
      getToolTag('comparison', locale),
      'comparison',
      options.dyeIds.join(' · '),
      'comparison',
      frame,
      locale
    );
  }

  // Every pair, closest first
  const pairs: Array<{ a: Dye; b: Dye; delta: number }> = [];
  for (let i = 0; i < dyes.length; i++) {
    for (let j = i + 1; j < dyes.length; j++) {
      pairs.push({
        a: dyes[i],
        b: dyes[j],
        delta: ColorService.getDistanceForMethod(dyes[i].hex, dyes[j].hex, 'ciede2000'),
      });
    }
  }
  pairs.sort((a, b) => a.delta - b.delta);
  const closest = pairs[0];

  // The closest pair leads, adjacent and widened; the rest follow
  // og-8: compare by id, not by object identity — the dedupe above makes the
  // two equivalent today, but identity is the wrong contract to rest on.
  const ordered: Dye[] = [
    closest.a,
    closest.b,
    ...dyes.filter((d) => d.id !== closest.a.id && d.id !== closest.b.id),
  ];
  const bands: BandEntry[] = ordered.map((dye, i) => ({
    hex: dye.hex,
    role: i < 2 ? role('closestPair', locale) : '',
    name: getLocalizedDyeName(dye, locale),
    value: dye.hex.toUpperCase(),
    tag: `#${dye.stainID ?? dye.id}`,
    grow: i < 2 ? 3 : 2,
  }));

  const closestLine = `${getLocalizedDyeName(closest.a, locale)} ↔ ${getLocalizedDyeName(closest.b, locale)}`;

  return generateBandCard({
    bands,
    toolTag: getToolTag('comparison', locale),
    toolGlyph: bandGlyph('comparison'),
    path: 'xivdyetools.app/comparison',
    // Six pair numbers are not four of anything, so only the closest survives:
    // the deck on Discord, the footer's right slot on X.
    deck: `${closestLine} · Δ${closest.delta.toFixed(1)}`,
    footRight: frame === 'x' ? `${role('closest', locale)} Δ${closest.delta.toFixed(1)}` : 'ΔE2000',
    frame,
  });
}
