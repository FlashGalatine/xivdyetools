/**
 * Shared bits for the 15E band adapters.
 *
 * @module services/svg/band-shared
 */

import { toolGlyph, type ToolGlyphName } from '@xivdyetools/svg';
import { generateBandCard, type BandFrame } from './band';

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

/** The strip glyph: compact set, 13px, strip inks. */
export function bandGlyph(name: ToolGlyphName): string {
  return toolGlyph(name, 'compact', { size: 13, ink: '#ECECEE', accent: '#FF6257' });
}

/**
 * The never-throws neutral state for an unresolvable input (route contract —
 * the glyph-tile default set replaces this in the defaults step).
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
    bandLine: label,
    urlLine: `xivdyetools.app/${urlPath}`,
    frame,
  });
}
