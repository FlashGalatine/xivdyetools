/**
 * Harmony OG image — the 15E band (5.0).
 *
 * Base at double width, matches beside it; the Δ measures **match → computed
 * ideal** via core's LCh rotation — the shipped base→match delta painted a
 * correct tetrad four-reds, because a complement is far from its base by
 * definition. The deck names the base and its harmony; the footer carries the
 * path and the requested method.
 *
 * @module services/svg/harmony
 */

import { ColorService, DEFAULT_MATCHING_METHOD, HARMONY_OFFSETS } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, type BandEntry, type BandFrame } from './band';
import { algoTag, bandGlyph, fmtDelta, notFoundBand } from './band-shared';
import { ALL_DYES, findClosestDyesWithDistance, getDyeByItemId, deltaForAlgorithm } from './dye-helpers';
import { role, getToolTag } from '../og-strings';
import { getLocalizedDyeName, getLocalizedHarmonyName } from '../translator';
import type { HarmonyType, MatchingAlgorithm } from '../../types';

export interface HarmonyOGOptions {
  /** Dye stainID (route param name kept for call-site stability) */
  dyeId: number;
  /** Harmony type */
  harmonyType: HarmonyType;
  /** Matching algorithm */
  algorithm?: MatchingAlgorithm;
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame — Discord 400×350 (default) or X 400×210 */
  frame?: BandFrame;
}

/**
 * BUG-022 (deep dive 2026-09-02): this WAS a private copy of the bot's 3.1
 * table, and it diverged from the page's in three rows — `analogous` had an
 * extra 180° complement band, `compound` was `[30,150,210]` against the page's
 * `[30,180,330]`, and `shades` was absent, so it fell silently to the
 * nearest-dye branch below. A card is the unfurl of a page URL, so zero of
 * `compound`'s three bands matched the page the reader then opened. One table
 * now, in `@xivdyetools/core`.
 *
 * `monochromatic`'s single `[0]` offset is a no-op rotation, so it still takes
 * the nearest-dye path — that is what the page's own [0] row resolves to, and
 * it fills four bands instead of one.
 */
const NEAREST_DYE_HARMONIES: ReadonlySet<HarmonyType> = new Set(['monochromatic']);

function idealOffsets(harmonyType: HarmonyType): number[] | undefined {
  if (NEAREST_DYE_HARMONIES.has(harmonyType)) return undefined;
  return HARMONY_OFFSETS[harmonyType];
}

interface HarmonyMatch {
  dye: Dye;
  /** Signed offset that produced the ideal (for the role tag) */
  offset: number | null;
  /** match → computed ideal, in the requested algorithm */
  delta: number;
}

/** Find the harmony matches: ideal via LCh rotation, nearest real dye each. */
function getHarmonyMatches(
  dye: Dye,
  harmonyType: HarmonyType,
  algorithm: MatchingAlgorithm = DEFAULT_MATCHING_METHOD
): HarmonyMatch[] {
  const offsets = idealOffsets(harmonyType);
  if (!offsets) {
    // Monochromatic: similar dyes, delta measured to the base itself
    return findClosestDyesWithDistance(dye.hex, {
      limit: 4,
      excludeIds: [dye.id],
      algorithm,
    }).map((match) => ({ dye: match.dye, offset: null, delta: match.distance }));
  }

  const matches: HarmonyMatch[] = [];
  for (const offset of offsets) {
    const idealHex = ColorService.rotateHueLch(dye.hex, offset);
    let best: Dye | null = null;
    let bestDelta = Infinity;
    for (const candidate of ALL_DYES) {
      if (candidate.id === dye.id) continue;
      if (matches.some((m) => m.dye.id === candidate.id)) continue;
      const delta = ColorService.getDistanceForMethod(idealHex, candidate.hex, 'ciede2000');
      if (delta < bestDelta) {
        bestDelta = delta;
        best = candidate;
      }
    }
    if (best) {
      // The displayed Δ is match → ideal, in the requested algorithm
      matches.push({ dye: best, offset, delta: deltaForAlgorithm(idealHex, best.hex, algorithm) });
    }
  }
  return matches.slice(0, 4);
}

/**
 * Generates the Harmony OG image SVG (400-grid — raster ×3 downstream).
 */
export function generateHarmonyOG(options: HarmonyOGOptions): string {
  const { dyeId, harmonyType, algorithm = DEFAULT_MATCHING_METHOD, locale = 'en', frame = 'discord' } = options;

  const dye = getDyeByItemId(dyeId);
  if (!dye) {
    // The generator never throws (route contract) — an unknown ID renders the
    // shared neutral single-band state naming the miss.
    return notFoundBand(getToolTag('harmony', locale), 'harmony', `#${dyeId}`, 'harmony', frame, locale);
  }

  const matches = getHarmonyMatches(dye, harmonyType, algorithm);
  const baseName = getLocalizedDyeName(dye, locale);
  const harmonyName = getLocalizedHarmonyName(harmonyType, locale);
  const stainTag = `#${dye.stainID ?? dye.id}`;

  const bands: BandEntry[] = [
    {
      hex: dye.hex,
      role: role('base', locale),
      name: baseName,
      value: dye.hex.toUpperCase(),
      tag: stainTag,
      grow: 2,
      nameSize: 17,
    },
    ...matches.map((m) => ({
      hex: m.dye.hex,
      role: m.offset === null ? '≈' : `${m.offset > 0 ? '+' : ''}${m.offset}°`,
      name: getLocalizedDyeName(m.dye, locale),
      value: m.dye.hex.toUpperCase(),
      tag: `Δ${fmtDelta(m.delta, algorithm)}`,
      grow: 1,
      nameSize: 12,
    })),
  ];

  return generateBandCard({
    bands,
    toolTag: getToolTag('harmony', locale),
    toolGlyph: bandGlyph('harmony'),
    path: 'xivdyetools.app/harmony',
    // Harmony's headline is pure data — the base and the harmony it anchors.
    deck: `${baseName} · ${harmonyName}`,
    footRight: algoTag(algorithm),
    frame,
  });
}
