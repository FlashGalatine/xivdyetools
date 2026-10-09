/**
 * Extractor OG image — the 15E band (5.0, net-new route).
 *
 * The one card where proportion is genuine: band width is each colour's
 * share of the image, so the palette is ordered by dominance rather than by
 * rank. The 54px strip above each band is the extracted pixel (×0.66 on X);
 * the body is the dye nearest to it.
 *
 * It is also the ONE card whose names yield: at 11% share the narrowest band
 * is ~44px on the X field and cannot hold a name at the 11px floor, so on X
 * the share-% and Δ stay and the name goes. The dye is the colour itself, and
 * the link target names it.
 *
 * Shares are optional: the web app's share URL carries the palette but not
 * the dominance (`?colors=RRGGBB,…`). Without shares the bands are EQUAL and
 * the role is the rank, never a percentage — proportion is only claimed
 * where it is measured.
 *
 * Each band names the dye nearest its color by the REQUESTED method, and the
 * footer names that method (BUG-060, deep dive 2026-10-04) — the page the link
 * opens ranks by that method too. It does not pick each color on its own,
 * though: `restoreFromShareLink` (extractor-tool.ts) drops an exact repeated
 * entry, and with Prevent-duplicates on (its default) `rebuildRoll` keeps a
 * used set that `resolveDye` skips, so a later color takes the nearest dye no
 * earlier one holds and repeats one only when no other eligible dye is left.
 * The card picks every band independently, so two colors sharing a nearest
 * dye show it twice here where the page moves the second to another, and a
 * repeated entry draws a second band. The page also drops repeats before its
 * five-color cap, so a repeated entry costs the card a later color as well
 * (A,A,B,C,D,E shows A-E there; this card draws A,A,B,C,D). Known, and left
 * as a recorded follow-up.
 *
 * @module services/svg/extractor
 */

import { normalizeMatchingMethod } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, xStrip, BAND_CAP, type BandEntry, type BandFrame } from './band';
import { algoTag, bandGlyph, fmtDelta, notFoundBand } from './band-shared';
import { dyeService, deltaForAlgorithm } from './dye-helpers';
import { deckLine, getToolTag } from '../og-strings';
import { getLocalizedDyeName } from '../translator';
import type { MatchingAlgorithm } from '../../types';

export interface ExtractorOGOptions {
  /**
   * Extracted colours, optionally with their share of the image (percent).
   * Either every entry carries a share (proportional bands, dominance order)
   * or none does (equal bands, given order, ranked roles).
   */
  entries: Array<{ hex: string; share?: number }>;
  /**
   * Matching method each band's dye is chosen by; legacy spellings normalize,
   * absent is the suite default (`ciede2000`).
   */
  algorithm?: MatchingAlgorithm;
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame */
  frame?: BandFrame;
}

/** The extracted-pixel strip height (the drawn structural-variant size). */
const EXTRACT_STRIP_H = 54;

/**
 * Generates the Extractor OG image SVG (400-grid — raster ×3 downstream).
 */
export function generateExtractorOG(options: ExtractorOGOptions): string {
  const { locale = 'en', frame = 'discord' } = options;
  // Normalized once, at the top, so the ranking, the printed Δ and the footer
  // tag provably name one method. The dye-helpers normalize for themselves as
  // well; harmony's BUG-062 was a raw legacy spelling that reached core
  // through a path that did not, and this keeps that class out of this card.
  const algorithm = normalizeMatchingMethod(options.algorithm);

  const valid = options.entries
    .filter((e) => /^#?[0-9A-Fa-f]{6}$/.test(e.hex) && (e.share === undefined || e.share > 0))
    .map((e) => ({ hex: e.hex.startsWith('#') ? e.hex : `#${e.hex}`, share: e.share }));
  // Proportional only when EVERY entry measured its share
  const proportional = valid.length > 0 && valid.every((e) => e.share !== undefined);
  // Dominance order FIRST, then the cap — slicing before sorting would drop
  // the dominant colours whenever the caller sent them unsorted. Without
  // shares the given order stands (nothing to sort by).
  const entries = (proportional ? [...valid].sort((a, b) => (b.share ?? 0) - (a.share ?? 0)) : valid).slice(
    0,
    BAND_CAP
  );
  if (entries.length === 0) {
    return notFoundBand(getToolTag('extractor', locale), 'extractor', '—', 'extractor', frame, locale);
  }

  const stripH = frame === 'x' ? xStrip(EXTRACT_STRIP_H) : EXTRACT_STRIP_H;

  const bands: BandEntry[] = entries.map((entry, i) => {
    // BUG-060 (deep dive 2026-10-04): this ranked by a hard-coded `'ciede2000'`
    // and printed `ΔE2000`, while the page the link opens resolves each color
    // by the shared method — so an `?algo=oklab` share could unfurl naming
    // dyes its page never shows. The pick is the page's own call: core's
    // `findClosestDye` on the shared DyeService, with the page's default of no
    // dye filters (`resolveDye` in extractor-tool.ts). It also settles exact
    // ties the way the page does (a k-d tree under rgb) and ranks
    // `distinguish` unrounded. The printed Δ stays `deltaForAlgorithm`.
    const best: Dye | null = dyeService.findClosestDye(entry.hex, { matchingMethod: algorithm });
    const bestDelta = deltaForAlgorithm(entry.hex, best!.hex, algorithm);
    return {
      hex: best!.hex,
      role: proportional ? `${Math.round(entry.share ?? 0)}%` : String(i + 1),
      // The one card where the name yields — see the module note
      name: frame === 'x' ? undefined : getLocalizedDyeName(best!, locale),
      value: frame === 'x' ? undefined : best!.hex.toUpperCase(),
      tag: `Δ${fmtDelta(bestDelta, algorithm)}`,
      grow: proportional ? entry.share : 1,
      src: { hex: entry.hex.toUpperCase(), height: stripH },
    };
  });

  return generateBandCard({
    bands,
    toolTag: getToolTag('extractor', locale),
    toolGlyph: bandGlyph('extractor'),
    path: 'xivdyetools.app/extractor',
    deck: deckLine('extractorCount', locale, { n: entries.length }),
    footRight: algoTag(algorithm),
    frame,
  });
}
