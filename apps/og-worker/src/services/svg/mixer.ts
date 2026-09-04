/**
 * Mixer OG image — the 15E band (5.0).
 *
 * Widths ARE the ratio — proportion says 60/40 without a slider nobody can
 * drag. The result band carries the one structural variant: the mix itself
 * is the 46px strip above (×0.66 on the shorter X field), the band under it
 * is the dye you can buy.
 *
 * @module services/svg/mixer
 */

import { ColorService, DEFAULT_MATCHING_METHOD } from '@xivdyetools/core';
import { blendColors, isValidBlendingMode, type BlendingMode } from '@xivdyetools/core/blending';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, xStrip, type BandEntry, type BandFrame } from './band';
import { algoTag, bandGlyph, fmtDelta, notFoundBand } from './band-shared';
import { ALL_DYES, getDyeByItemId, deltaForAlgorithm } from './dye-helpers';
import { role, getToolTag } from '../og-strings';
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
  /**
   * Which algorithm mixes the colours — the web mixer's `?mode=`.
   *
   * The card used to hardcode CIELAB, so a shared mix rendered in a DIFFERENT
   * algorithm than the page the sharer was looking at, silently, for five of
   * the six modes the web tool offers. Defaults to `ryb` because that is the
   * web mixer's own default (`mixer-tool.ts`), so a link that predates the
   * `?mode=` param still renders what its sharer saw.
   */
  mode?: BlendingMode;
  /** Matching algorithm — picks the Δ shown against the buyable dye, not the mix */
  algorithm?: MatchingAlgorithm;
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame */
  frame?: BandFrame;
}

/** The web mixer's default mixing mode — see `apps/web-app` `mixer-tool.ts`. */
const DEFAULT_MIX_MODE: BlendingMode = 'ryb';

/** The mix strip height (the drawn structural-variant size for mixer). */
const MIX_STRIP_H = 46;

function nearestDye(hex: string): { dye: Dye; delta: number } {
  let best: Dye | null = null;
  let bestDelta = Infinity;
  for (const candidate of ALL_DYES) {
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
  const { dyeAId, dyeBId, dyeCId, algorithm = DEFAULT_MATCHING_METHOD, locale = 'en', frame = 'discord' } = options;
  const ratio = Math.max(1, Math.min(99, options.ratio));

  const dyeA = getDyeByItemId(dyeAId);
  const dyeB = getDyeByItemId(dyeBId);
  const dyeC = dyeCId !== undefined ? getDyeByItemId(dyeCId) : undefined;
  if (!dyeA || !dyeB || (dyeCId !== undefined && !dyeC)) {
    return notFoundBand(getToolTag('mixer', locale), 'mixer', `#${dyeAId} + #${dyeBId}`, 'mixer', frame, locale);
  }

  // The mix: A at ratio% against B, the third dye folded in equally — both
  // steps in the mode the sharer chose, never a substituted one.
  const mode = isValidBlendingMode(options.mode ?? '') ? options.mode! : DEFAULT_MIX_MODE;
  let mixHex = blendColors(dyeA.hex, dyeB.hex, mode, 1 - ratio / 100).hex;
  if (dyeC) {
    mixHex = blendColors(mixHex, dyeC.hex, mode, 1 / 3).hex;
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
      role: role('buyable', locale),
      name: getLocalizedDyeName(hit.dye, locale),
      value: hit.dye.hex.toUpperCase(),
      tag: `Δ${fmtDelta(delta, algorithm)}`,
      grow: dyeC ? 3 : 100,
      nameSize: 17,
      src: { hex: mixHex, height: frame === 'x' ? xStrip(MIX_STRIP_H) : MIX_STRIP_H },
    },
  ];

  return generateBandCard({
    bands,
    toolTag: getToolTag('mixer', locale),
    toolGlyph: bandGlyph('mixer'),
    path: 'xivdyetools.app/mixer',
    // The ratio is structural and the buyable dye is the third band's own
    // name, so the deck names the answer and nothing has to move on X.
    deck: getLocalizedDyeName(hit.dye, locale),
    footRight: algoTag(algorithm),
    frame,
  });
}
