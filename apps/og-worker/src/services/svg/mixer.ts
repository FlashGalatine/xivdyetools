/**
 * Mixer OG image — the 15E band (5.0).
 *
 * Widths ARE the ratio — proportion says 60/40 without a slider nobody can
 * drag. The result band carries the one structural variant: the mix itself
 * is the 46px strip above, the band under it is the dye you can buy.
 *
 * @module services/svg/mixer
 */

import { ColorService } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, type BandEntry, type BandFrame } from './band';
import { ALGO_TAG, bandGlyph, notFoundBand } from './band-shared';
import { dyeService, getDyeByItemId, deltaForAlgorithm } from './dye-helpers';
import { getLocalizedDyeName } from '../translator';
import type { MatchingAlgorithm } from '../../types';

export interface MixerOGOptions {
  /** First dye stainID (param name kept for call-site stability) */
  dyeAId: number;
  /** Second dye stainID */
  dyeBId: number;
  /** Third dye stainID (optional) */
  dyeCId?: number;
  /** Mix ratio (0-100, percentage of dyeA) */
  ratio: number;
  /** Matching algorithm */
  algorithm?: MatchingAlgorithm;
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame */
  frame?: BandFrame;
}

/** The mix strip height (the drawn structural-variant size for mixer). */
const MIX_STRIP_H = 46;

function nearestDye(hex: string): { dye: Dye; delta: number } {
  let best: Dye | null = null;
  let bestDelta = Infinity;
  for (const candidate of dyeService.getAllDyes()) {
    const delta = ColorService.getDistanceForMethod(hex, candidate.hex, 'ciede2000');
    if (delta < bestDelta) {
      bestDelta = delta;
      best = candidate;
    }
  }
  return { dye: best!, delta: bestDelta };
}

/**
 * Generates the Mixer OG image SVG (400-grid — raster ×3 downstream).
 */
export function generateMixerOG(options: MixerOGOptions): string {
  const { dyeAId, dyeBId, dyeCId, algorithm = 'oklab', locale = 'en', frame = 'discord' } = options;
  const ratio = Math.max(1, Math.min(99, options.ratio));

  const dyeA = getDyeByItemId(dyeAId);
  const dyeB = getDyeByItemId(dyeBId);
  const dyeC = dyeCId !== undefined ? getDyeByItemId(dyeCId) : undefined;
  if (!dyeA || !dyeB || (dyeCId !== undefined && !dyeC)) {
    return notFoundBand('MIXER', 'mixer', `#${dyeAId} + #${dyeBId}`, 'mixer', frame);
  }

  // The mix: A at ratio% against B (LAB), the third dye folded in equally
  let mixHex = ColorService.mixColorsLab(dyeA.hex, dyeB.hex, 1 - ratio / 100);
  if (dyeC) {
    mixHex = ColorService.mixColorsLab(mixHex, dyeC.hex, 1 / 3);
  }
  const hit = nearestDye(mixHex);
  const delta = deltaForAlgorithm(mixHex, hit.dye.hex, algorithm);

  const inputBand = (dye: Dye, role: string, grow: number): BandEntry => ({
    hex: dye.hex,
    role,
    name: getLocalizedDyeName(dye, locale),
    value: dye.hex.toUpperCase(),
    tag: `#${dye.stainID ?? dye.id}`,
    grow,
  });

  const inputs: BandEntry[] = dyeC
    ? [inputBand(dyeA, 'A', 1), inputBand(dyeB, 'B', 1), inputBand(dyeC, 'C', 1)]
    : [inputBand(dyeA, `A · ${ratio}%`, ratio), inputBand(dyeB, `B · ${100 - ratio}%`, 100 - ratio)];

  const bands: BandEntry[] = [
    ...inputs,
    {
      hex: hit.dye.hex,
      role: 'BUYABLE',
      name: getLocalizedDyeName(hit.dye, locale),
      value: hit.dye.hex.toUpperCase(),
      tag: `Δ${delta.toFixed(1)}`,
      grow: dyeC ? 3 : 100,
      nameSize: 17,
      src: { hex: mixHex, height: MIX_STRIP_H },
    },
  ];

  return generateBandCard({
    bands,
    toolTag: 'MIXER',
    toolGlyph: bandGlyph('mixer'),
    subLine: `${ratio}/${100 - ratio} · ${ALGO_TAG[algorithm] ?? algorithm.toUpperCase()}`,
    bandLine: getLocalizedDyeName(hit.dye, locale),
    urlLine: `xivdyetools.app/mixer · ${ALGO_TAG[algorithm] ?? algorithm.toUpperCase()}`,
    frame,
  });
}
