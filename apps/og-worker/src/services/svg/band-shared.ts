/**
 * Shared bits for the 15E band adapters.
 *
 * @module services/svg/band-shared
 */

import { toolGlyph, type ToolGlyphName } from '@xivdyetools/svg';
import { MATCHING_METHOD_TAGS, normalizeMatchingMethod } from '@xivdyetools/core';
import { generateBandCard, type BandFrame } from './band';
import { COMPACT_GLYPH } from './tokens';
import { role } from '../og-strings';
import type { LocaleCode } from '@xivdyetools/types';

/**
 * The display code for the method a card ACTUALLY measured with (identifiers
 * — never localise).
 *
 * BUG-024 (deep dive 2026-09-02): this was a private table missing rows for
 * `hyab` and `oklch-weighted`, the two legacy spellings `VALID_ALGORITHMS`
 * still accepts from pre-5.0 shared links. The lookup missed, the fallback
 * upper-cased the raw param, and the footer read `HYAB` over numbers that
 * `deltaForAlgorithm` had computed as ΔE2000 — because `normalizeMatchingMethod`
 * folds both into the default. Normalising FIRST closes the whole class: a
 * legacy spelling can never reach the table, so the table can never lack a row
 * for one. The table itself is core's, shared with `@xivdyetools/svg`.
 */
export function algoTag(algorithm: string): string {
  return MATCHING_METHOD_TAGS[normalizeMatchingMethod(algorithm)];
}

/**
 * Per-method display precision (ΔEOK prints raw dp3; DISTINGUISH is an int).
 * Normalised for the same reason as `algoTag`: the precision must belong to
 * the method that ran, not to the spelling the URL used.
 */
export function fmtDelta(value: number, algorithm: string): string {
  const method = normalizeMatchingMethod(algorithm);
  const dp = method === 'oklab' ? 3 : method === 'distinguish' ? 0 : 1;
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
  frame: BandFrame = 'discord',
  locale: LocaleCode = 'en'
): string {
  // FINDING-005 (2026-08-21 audit): the label is caller input echoed back.
  // Clip it before it reaches the wrap/fit helpers so an attacker-length URL
  // segment cannot turn a "not found" card into a CPU sink.
  const shown = clipLabel(label);
  return generateBandCard({
    bands: [{ hex: '#17171A', role: role('notFound', locale), name: shown, nameSize: 17 }],
    toolTag,
    toolGlyph: bandGlyph(glyphName),
    path: `xivdyetools.app/${urlPath}`,
    deck: shown,
    frame,
  });
}

/** Longest echoed input the not-found card will show (code points). */
export const NOT_FOUND_LABEL_MAX = 32;

/** Clip a user-supplied label to NOT_FOUND_LABEL_MAX code points + ellipsis. */
export function clipLabel(label: string): string {
  const chars = [...label];
  return chars.length <= NOT_FOUND_LABEL_MAX
    ? label
    : `${chars.slice(0, NOT_FOUND_LABEL_MAX).join('')}…`;
}
