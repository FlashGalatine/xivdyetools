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

import { ColorService } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, type BandEntry, type BandFrame } from './band';
import { ALGO_TAG, bandGlyph, notFoundBand } from './band-shared';
import { dyeService, deltaForAlgorithm } from './dye-helpers';
import { getLocalizedDyeName } from '../translator';
import type { MatchingAlgorithm, ColorSheetCategory, CharacterGender } from '../../types';

export interface SwatchOGOptions {
  /** Input color hex (without #) */
  color: string;
  /** Number of matches to show (capped at 4 — the band's comfort line) */
  limit?: number;
  /** Matching algorithm */
  algorithm?: MatchingAlgorithm;
  /** Which color sheet this color is from (context only in 15E) */
  sheet?: ColorSheetCategory;
  /** Subrace for race-specific sheets */
  race?: string;
  /** Gender for race-specific sheets */
  gender?: CharacterGender;
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame */
  frame?: BandFrame;
}

/** The drawn decision: four matches, not five. */
const MATCH_CAP = 4;

/**
 * Generates the Swatch OG image SVG (400-grid — raster ×3 downstream).
 * Async signature kept for call-site stability.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- signature kept for call-site stability
export async function generateSwatchOG(options: SwatchOGOptions): Promise<string> {
  const { algorithm = 'oklab', locale = 'en', frame = 'discord' } = options;

  const clean = options.color.replace('#', '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(clean)) {
    return notFoundBand('SWATCH', 'swatch', `#${clean}`, 'swatch', frame);
  }
  const targetHex = `#${clean}`;

  const limit = Math.max(1, Math.min(MATCH_CAP, options.limit ?? MATCH_CAP));
  const matches = dyeService
    .getAllDyes()
    .map((dye: Dye) => ({
      dye,
      delta: ColorService.getDistanceForMethod(targetHex, dye.hex, 'ciede2000'),
    }))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, limit);

  const bands: BandEntry[] = [
    {
      hex: targetHex,
      role: 'TARGET',
      name: targetHex,
      tag: 'NO STAIN ID',
      grow: 2,
      nameSize: 17,
    },
    ...matches.map((m, i) => ({
      hex: m.dye.hex,
      role: String(i + 1),
      name: getLocalizedDyeName(m.dye, locale),
      value: m.dye.hex.toUpperCase(),
      tag: `Δ${deltaForAlgorithm(targetHex, m.dye.hex, algorithm).toFixed(1)}`,
      grow: 1,
    })),
  ];

  return generateBandCard({
    bands,
    toolTag: 'SWATCH',
    toolGlyph: bandGlyph('swatch'),
    subLine: `${ALGO_TAG[algorithm] ?? algorithm.toUpperCase()}`,
    bandLine: `${targetHex} → ${matches.length}`,
    urlLine: `xivdyetools.app/swatch · ${ALGO_TAG[algorithm] ?? algorithm.toUpperCase()}`,
    frame,
  });
}
