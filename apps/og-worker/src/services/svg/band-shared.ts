/**
 * Shared bits for the 15E band adapters.
 *
 * @module services/svg/band-shared
 */

import { toolGlyph, type ToolGlyphName } from '@xivdyetools/svg';
import { generateBandCard, type BandFrame } from './band';
import { COMPACT_GLYPH } from './tokens';

/** Requested-algorithm display codes (identifiers — never localise). */
export const ALGO_TAG: Record<string, string> = {
  ciede2000: 'ΔE2000',
  oklab: 'ΔEOK',
  cie76: 'ΔE76',
  redmean: 'REDMEAN',
  rgb: 'RGB DIST',
  distinguish: 'DISTINGUISH %',
  euclidean: 'RGB DIST',
};

/** Per-method display precision (ΔEOK prints raw dp3; DISTINGUISH is an int). */
export function fmtDelta(value: number, algorithm: string): string {
  const dp = algorithm === 'oklab' ? 3 : algorithm === 'distinguish' ? 0 : 1;
  return value.toFixed(dp);
}

/** The strip glyph: compact set, 13px, strip inks. */
export function bandGlyph(name: ToolGlyphName): string {
  return toolGlyph(name, 'compact', COMPACT_GLYPH);
}

/**
 * The never-throws neutral state for an unresolvable input (route contract —
 * the glyph-tile default set replaces this in the defaults step).
 *
 * It fakes nothing: one neutral band, the input echoed back, and no method
 * tag in the footer-right slot — there is no measurement to name.
 */
export function notFoundBand(
  toolTag: string,
  glyphName: ToolGlyphName,
  label: string,
  urlPath: string,
  frame: BandFrame = 'discord'
): string {
  return generateBandCard({
    bands: [{ hex: '#17171A', role: 'NOT FOUND', name: label, nameSize: 17 }],
    toolTag,
    toolGlyph: bandGlyph(glyphName),
    path: `xivdyetools.app/${urlPath}`,
    deck: label,
    frame,
  });
}
