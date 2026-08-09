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
 * @module services/svg/extractor
 */

import { ColorService } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, xStrip, BAND_CAP, type BandEntry, type BandFrame } from './band';
import { bandGlyph, notFoundBand } from './band-shared';
import { dyeService } from './dye-helpers';
import { deckLine, getToolTag } from '../og-strings';
import { getLocalizedDyeName } from '../translator';

export interface ExtractorOGOptions {
  /** Extracted colours with their share of the image (percent) */
  entries: Array<{ hex: string; share: number }>;
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

  // Dominance order FIRST, then the cap — slicing before sorting would drop
  // the dominant colours whenever the caller sent them unsorted
  const entries = options.entries
    .filter((e) => /^#?[0-9A-Fa-f]{6}$/.test(e.hex) && e.share > 0)
    .map((e) => ({ hex: e.hex.startsWith('#') ? e.hex : `#${e.hex}`, share: e.share }))
    .sort((a, b) => b.share - a.share)
    .slice(0, BAND_CAP);
  if (entries.length === 0) {
    return notFoundBand(getToolTag('extractor', locale), 'extractor', '—', 'extractor', frame);
  }

  const stripH = frame === 'x' ? xStrip(EXTRACT_STRIP_H) : EXTRACT_STRIP_H;

  const bands: BandEntry[] = entries.map((entry) => {
    let best: Dye | null = null;
    let bestDelta = Infinity;
    for (const candidate of dyeService.getAllDyes()) {
      const delta = ColorService.getDistanceForMethod(entry.hex, candidate.hex, 'ciede2000');
      if (delta < bestDelta) {
        bestDelta = delta;
        best = candidate;
      }
    }
    return {
      hex: best!.hex,
      role: `${Math.round(entry.share)}%`,
      // The one card where the name yields — see the module note
      name: frame === 'x' ? undefined : getLocalizedDyeName(best!, locale),
      value: frame === 'x' ? undefined : best!.hex.toUpperCase(),
      tag: `Δ${bestDelta.toFixed(1)}`,
      grow: entry.share,
      src: { hex: entry.hex.toUpperCase(), height: stripH },
    };
  });

  return generateBandCard({
    bands,
    toolTag: getToolTag('extractor', locale),
    toolGlyph: bandGlyph('extractor'),
    path: 'xivdyetools.app/extractor',
    deck: deckLine('extractorCount', locale, { n: entries.length }),
    footRight: 'ΔE2000',
    frame,
  });
}
