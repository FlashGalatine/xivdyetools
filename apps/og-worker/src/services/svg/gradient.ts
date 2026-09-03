/**
 * Gradient OG image — the 15E band (5.0).
 *
 * A gradient is already a band — the shape needs no argument. The one
 * decision: the bands are the MATCHED DYES, not the interpolation, because
 * the interpolation is not something anyone can buy. Endpoints are the dyes
 * themselves (START/END + stain tag); each middle band is the nearest real
 * dye to its interpolated step, tagged with the Δ to that step.
 *
 * @module services/svg/gradient
 */

import { ColorService, DEFAULT_MATCHING_METHOD } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, BAND_CAP, type BandEntry, type BandFrame } from './band';
import { algoTag, bandGlyph, fmtDelta, notFoundBand } from './band-shared';
import { ALL_DYES, getDyeByItemId, deltaForAlgorithm } from './dye-helpers';
import { role, getToolTag } from '../og-strings';
import { getLocalizedDyeName } from '../translator';
import type { MatchingAlgorithm } from '../../types';

export interface GradientOGOptions {
  /** Start dye stainID (param name kept for call-site stability) */
  startDyeId: number;
  /** End dye stainID */
  endDyeId: number;
  /** Number of steps (including start and end) */
  steps: number;
  /** Matching algorithm */
  algorithm?: MatchingAlgorithm;
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame */
  frame?: BandFrame;
}

/** Interpolate in the space the requested algorithm implies. */
function interpolate(startHex: string, endHex: string, t: number, algorithm: MatchingAlgorithm): string {
  if (algorithm === 'oklab') return ColorService.mixColorsOklab(startHex, endHex, t);
  if (algorithm === 'rgb' || algorithm === 'distinguish' || algorithm === 'redmean') {
    return ColorService.mixColorsRgb(startHex, endHex, t);
  }
  return ColorService.mixColorsLab(startHex, endHex, t);
}

/**
 * Generates the Gradient OG image SVG (400-grid — raster ×3 downstream).
 */
export function generateGradientOG(options: GradientOGOptions): string {
  const { startDyeId, endDyeId, algorithm = DEFAULT_MATCHING_METHOD, locale = 'en', frame = 'discord' } = options;

  const startDye = getDyeByItemId(startDyeId);
  const endDye = getDyeByItemId(endDyeId);
  if (!startDye || !endDye) {
    return notFoundBand(
      getToolTag('gradient', locale),
      'gradient',
      `#${startDyeId} → #${endDyeId}`,
      'gradient',
      frame,
      locale
    );
  }

  // Band cap on a second surface: the card shows at most five steps
  const steps = Math.max(2, Math.min(BAND_CAP, options.steps));
  const taken = new Set<number>([startDye.id, endDye.id]);
  const bands: BandEntry[] = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    if (i === 0 || i === steps - 1) {
      const dye = i === 0 ? startDye : endDye;
      bands.push({
        hex: dye.hex,
        role: i === 0 ? role('start', locale) : role('end', locale),
        name: getLocalizedDyeName(dye, locale),
        value: dye.hex.toUpperCase(),
        tag: `#${dye.stainID ?? dye.id}`,
      });
      continue;
    }
    const stepHex = interpolate(startDye.hex, endDye.hex, t, algorithm);
    let best: Dye | null = null;
    let bestDelta = Infinity;
    for (const candidate of ALL_DYES) {
      if (taken.has(candidate.id)) continue;
      const delta = ColorService.getDistanceForMethod(stepHex, candidate.hex, 'ciede2000');
      if (delta < bestDelta) {
        bestDelta = delta;
        best = candidate;
      }
    }
    if (best) {
      taken.add(best.id);
      bands.push({
        hex: best.hex,
        role: String(i + 1),
        name: getLocalizedDyeName(best, locale),
        value: best.hex.toUpperCase(),
        tag: `Δ${fmtDelta(deltaForAlgorithm(stepHex, best.hex, algorithm), algorithm)}`,
      });
    }
  }

  const startName = getLocalizedDyeName(startDye, locale);
  const endName = getLocalizedDyeName(endDye, locale);

  return generateBandCard({
    bands,
    toolTag: getToolTag('gradient', locale),
    toolGlyph: bandGlyph('gradient'),
    path: 'xivdyetools.app/gradient',
    // The cleanest degrade of the nine: the headline is the endpoints, and
    // START and END keep them named in-band, so nothing moves on X.
    deck: `${startName} → ${endName}`,
    footRight: algoTag(algorithm),
    frame,
  });
}
