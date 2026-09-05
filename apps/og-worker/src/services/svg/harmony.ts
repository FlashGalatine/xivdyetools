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

import {
  COLOR_WHEEL_TAGS,
  DEFAULT_COLOR_WHEEL,
  DEFAULT_MATCHING_METHOD,
  HARMONY_OFFSETS,
  generateHarmonySlots,
  type ColorWheelId,
} from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, type BandEntry, type BandFrame } from './band';
import { algoTag, bandGlyph, fmtDelta, notFoundBand } from './band-shared';
import { ALL_DYES, findClosestDyesWithDistance, getDyeByItemId, deltaForAlgorithm } from './dye-helpers';
import { role, getToolTag } from '../og-strings';
import { getLocalizedColorWheelName, getLocalizedDyeName, getLocalizedHarmonyName } from '../translator';
import type { HarmonyType, MatchingAlgorithm } from '../../types';

export interface HarmonyOGOptions {
  /** Dye stainID (route param name kept for call-site stability) */
  dyeId: number;
  /** Harmony type */
  harmonyType: HarmonyType;
  /** Matching algorithm */
  algorithm?: MatchingAlgorithm;
  /** Colour wheel the offsets are measured on; default rgb */
  wheel?: ColorWheelId;
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
  algorithm: MatchingAlgorithm = DEFAULT_MATCHING_METHOD,
  wheel: ColorWheelId = DEFAULT_COLOR_WHEEL
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

  // The card's whole job is to preview the page, so it must choose dyes the way
  // the page does. It did not: this walked the same offsets but rotated hue in
  // LCh (`rotateHueLch`) and the page rotates in HSV while preserving the base's
  // saturation and value — a third algorithm alongside the page's and the
  // bot's, which is how an unfurled share link could still show dyes the page it
  // opens never shows. BUG-022 unified the offsets TABLE; this unifies the
  // selection.
  void offsets;
  return generateHarmonySlots(
    dye.hex,
    harmonyType,
    ALL_DYES,
    {
      // Pinned, and the one place the card can still differ from the page.
      // The Harmony Explorer puts BOTH `algo` and `perceptual` in every share
      // URL, but `perceptual` is not in `OG_ALLOWED_QUERY_KEYS` — that
      // allowlist bounds the cache-key space by a deliberate security ruling
      // (S7-R7 / S7-R10), and admitting a second boolean doubles it. So the
      // card follows the page's DEFAULT here; a link that turned perceptual
      // off is the remaining divergence, written down rather than silent.
      usePerceptualMatching: true,
      // Was hardcoded `'ciede2000'` while `?algo=` fed only the printed delta,
      // so `?algo=oklab` drew the ΔE2000 dyes under ΔEOK figures — a different
      // set from the page the link opens, which ranks by the requested method.
      matchingMethod: algorithm,
      preventDuplicates: true,
      wheel,
    },
    { excludeItemIDs: [dye.itemID] }
  )
    .filter((slot) => slot.dye !== null)
    .slice(0, 4)
    .map((slot) => ({
      dye: slot.dye as Dye,
      offset: slot.offset,
      // The displayed Δ is match → ideal, in the REQUESTED algorithm — the
      // same algorithm and the same wheel the ranking above used, so the
      // figure and the dye it labels come from one calculation.
      delta: deltaForAlgorithm(slot.targetHex, (slot.dye as Dye).hex, algorithm),
    }));
}

/**
 * Generates the Harmony OG image SVG (400-grid — raster ×3 downstream).
 */
export function generateHarmonyOG(options: HarmonyOGOptions): string {
  const {
    dyeId,
    harmonyType,
    algorithm = DEFAULT_MATCHING_METHOD,
    wheel = DEFAULT_COLOR_WHEEL,
    locale = 'en',
    frame = 'discord',
  } = options;

  const dye = getDyeByItemId(dyeId);
  if (!dye) {
    // The generator never throws (route contract) — an unknown ID renders the
    // shared neutral single-band state naming the miss.
    return notFoundBand(getToolTag('harmony', locale), 'harmony', `#${dyeId}`, 'harmony', frame, locale);
  }

  const matches = getHarmonyMatches(dye, harmonyType, algorithm, wheel);
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
    // Harmony's headline is pure data — the base and the harmony it anchors;
    // a non-default wheel is a third fact the deck must not silently drop.
    deck:
      wheel === DEFAULT_COLOR_WHEEL
        ? `${baseName} · ${harmonyName}`
        : `${baseName} · ${harmonyName} · ${getLocalizedColorWheelName(wheel, locale)}`,
    // The deck carries the localised wheel name, but the X frame DROPS the
    // deck — so a shared Twitter card said nothing about which wheel chose its
    // dyes. The footer-right slot names it in both frames, as a non-localised
    // identifier beside the algorithm tag (`ΔE2000 · RYB`), never a translated
    // word: the two cards have to be comparable across locales.
    footRight:
      wheel === DEFAULT_COLOR_WHEEL
        ? algoTag(algorithm)
        : `${algoTag(algorithm)} · ${COLOR_WHEEL_TAGS[wheel]}`,
    frame,
  });
}
