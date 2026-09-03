/**
 * Swatch OG image — the 15E band (5.0).
 *
 * An arbitrary colour is a TARGET, never a result: the double-width first
 * band has no dye name and no stain ID — the card must not invent one, so
 * its name is the hex itself and its tag says so. Four matches, not five —
 * the fifth band falls under the 11px name floor (the drawn decision).
 *
 * @module services/svg/swatch
 */

import { DEFAULT_MATCHING_METHOD } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, type BandEntry, type BandFrame } from './band';
import { algoTag, bandGlyph, fmtDelta, notFoundBand } from './band-shared';
import { ALL_DYES, deltaForAlgorithm } from './dye-helpers';
import { role, deckLine, getToolTag } from '../og-strings';
import { getLocalizedDyeName } from '../translator';
import type { MatchingAlgorithm } from '../../types';

export interface SwatchOGOptions {
  /** Input color hex (without #) */
  color: string;
  /** Number of matches to show (capped at 4 — the band's comfort line) */
  limit?: number;
  /** Matching algorithm */
  algorithm?: MatchingAlgorithm;
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame */
  frame?: BandFrame;
}

/** The drawn decision: four matches, not five. */
const MATCH_CAP = 4;

/**
 * Generates the Swatch OG image SVG (400-grid — raster ×3 downstream).
 */
export function generateSwatchOG(options: SwatchOGOptions): string {
  const { algorithm = DEFAULT_MATCHING_METHOD, locale = 'en', frame = 'discord' } = options;

  const clean = options.color.replace('#', '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(clean)) {
    return notFoundBand(getToolTag('swatch', locale), 'swatch', `#${clean}`, 'swatch', frame, locale);
  }
  const targetHex = `#${clean}`;

  const limit = Math.max(1, Math.min(MATCH_CAP, options.limit ?? MATCH_CAP));
  // BUG-023: rank with the SAME method the tags and the footer name. This used
  // to rank by a hardcoded ciede2000 and then print `deltaForAlgorithm(…,
  // algorithm)` under an `ALGO_TAG[algorithm]` footer — so `?algo=oklab` gave
  // the four nearest by ΔE2000, tagged with ΔEOK figures that need not be in
  // ascending order (the two metrics disagree on order over 125 dyes), and a
  // different set from the one the page shows, which ranks by the requested
  // method. One distance call now, reused for the tag.
  const matches = ALL_DYES.map((dye: Dye) => ({
      dye,
      delta: deltaForAlgorithm(targetHex, dye.hex, algorithm),
    }))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, limit);

  const bands: BandEntry[] = [
    {
      hex: targetHex,
      role: role('target', locale),
      name: targetHex,
      tag: role('noStainId', locale),
      grow: 2,
      nameSize: 17,
    },
    ...matches.map((m, i) => ({
      hex: m.dye.hex,
      role: String(i + 1),
      name: getLocalizedDyeName(m.dye, locale),
      value: m.dye.hex.toUpperCase(),
      tag: `Δ${fmtDelta(m.delta, algorithm)}`,
      grow: 1,
    })),
  ];

  return generateBandCard({
    bands,
    toolTag: getToolTag('swatch', locale),
    toolGlyph: bandGlyph('swatch'),
    path: 'xivdyetools.app/swatch',
    deck: deckLine('swatchNearest', locale, { n: matches.length, hex: targetHex }),
    footRight: algoTag(algorithm),
    frame,
  });
}
