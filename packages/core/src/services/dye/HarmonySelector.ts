/**
 * Harmony slot selection — the one implementation every surface uses.
 *
 * ## Why this exists
 *
 * The web app and the Discord bot used to answer "which dyes make a triadic
 * harmony with this one?" through completely different code, and they
 * disagreed for **89–100 % of base dyes on every harmony type** (measured
 * 2026-09-03 over all 125 dyes):
 *
 * - the page walked `HARMONY_OFFSETS`, built each target by carrying the base
 *   dye's SATURATION AND VALUE onto the rotated hue, and ranked candidates by
 *   the user's configured ΔE method;
 * - the bot called a named `DyeService.find*Dyes()` per type, which rotates hue
 *   without preserving S/V — and `findComplementaryPair` did not rotate at all,
 *   it took an RGB `invert()`.
 *
 * For a desaturated base the difference is not subtle: `/harmony analogous` on
 * Snow White returned Neon Green and Kobold Brown, where the page shows Pure
 * White and Pearl White.
 *
 * This module is the page's algorithm, lifted verbatim so the page's output is
 * unchanged and every other surface now matches it. `HARMONY_OFFSETS` supplies
 * the geometry, so a harmony type is a row in a table rather than a method —
 * which is why `compound` and `shades` work here without any new code.
 *
 * @module services/dye/HarmonySelector
 */

import type { ColorWheelId, Dye } from '@xivdyetools/types';
import { HARMONY_OFFSETS } from '../../constants/index.js';
import type { MatchingMethod } from '../../types/index.js';
import { ColorService } from '../ColorService.js';
import { DEFAULT_COLOR_WHEEL, getColorWheel } from './wheels/ColorWheel.js';

/** How a caller wants harmony slots chosen. */
export interface HarmonySelectionConfig {
  /**
   * Rank by the configured ΔE against an S/V-preserving target (`true`), or by
   * plain angular hue distance (`false`). The web app's "strict matching"
   * toggle, on by default.
   */
  usePerceptualMatching: boolean;
  /** Which ΔE the ranking uses. Ignored when `usePerceptualMatching` is false. */
  matchingMethod: MatchingMethod;
  /** How many runner-up dyes to return per slot. Default 0. */
  companionCount?: number;
  /** Never show one dye in two slots. Default `false`. */
  preventDuplicates?: boolean;
  /**
   * Which colour wheel the offsets are measured on. Default `'rgb'`, which is
   * today's behaviour bit for bit. See `wheels/ColorWheel.ts`.
   */
  wheel?: ColorWheelId;
}

/** One position in a harmony: its ideal, the dye chosen for it, and runners-up. */
export interface HarmonySlot {
  /** Position in `HARMONY_OFFSETS[harmonyType]`. */
  index: number;
  /** The ideal hue offset in degrees, normalised to 0–359. */
  offset: number;
  /** The absolute ideal hue in degrees, 0–359. */
  targetHue: number;
  /**
   * The slot's angle on the SELECTED wheel's ring, 0–359 — where a node is
   * drawn. Equals `targetHue` on the RGB wheel and differs on every other.
   */
  wheelHue: number;
  /**
   * The ideal colour for this slot: the base's saturation and value on the
   * target hue. This is what a card outlines next to the dye it actually found.
   */
  targetHex: string;
  /** The dye chosen, or `null` when no candidate was available. */
  dye: Dye | null;
  /** Distance from `dye` to the ideal, in the config's units. */
  deviance: number;
  /** Runners-up, nearest first, excluding `dye`. */
  companions: Dye[];
}

/** A candidate and its distance from a slot's ideal. */
interface ScoredCandidate {
  dye: Dye;
  deviance: number;
}

/** Anything a caller can fix or exclude before selection runs. */
export interface HarmonySelectionOptions {
  /**
   * Dyes that must never be chosen — the base dye itself, normally. Given as
   * `itemID`s because that is the identity every surface already keys on.
   *
   * Honoured for slots and companions alike, independently of
   * {@link HarmonySelectionConfig.preventDuplicates}. A pinned dye still wins
   * its slot: an explicit hand-swap outranks this.
   */
  excludeItemIDs?: readonly number[];
  /**
   * Slot index → a dye the caller has fixed (a user's manual swap). A pinned
   * dye is honoured and still consumes its place in de-duplication.
   */
  pinned?: ReadonlyMap<number, Dye>;
}

/**
 * The single definition of "how far is this dye from the slot's target".
 *
 * BUG-064: everything that scores a harmony row goes through here, so a panel
 * can never mix ΔE units with degrees of hue — which is exactly what it used to
 * do when a filtered-out companion's replacement was scored differently from
 * its neighbours.
 */
function devianceFor(
  dye: Dye,
  targetHue: number,
  targetHex: string,
  config: HarmonySelectionConfig
): number {
  if (config.usePerceptualMatching) {
    return ColorService.getDistanceForMethod(targetHex, dye.hex, config.matchingMethod);
  }
  const dyeHue = ColorService.hexToHsv(dye.hex).h;
  const hueDiff = Math.abs(dyeHue - targetHue);
  return Math.min(hueDiff, 360 - hueDiff);
}

/** Every candidate scored against one slot's ideal, nearest first. */
function rankCandidates(
  candidates: readonly Dye[],
  targetHue: number,
  targetHex: string,
  config: HarmonySelectionConfig
): ScoredCandidate[] {
  const scored: ScoredCandidate[] = [];
  for (const dye of candidates) {
    // Facewear carries generic names ("Red", "Blue") and is not a dye since
    // schema v2; it must never surface as a harmony match.
    if (dye.category === 'Facewear') continue;
    scored.push({ dye, deviance: devianceFor(dye, targetHue, targetHex, config) });
  }
  scored.sort((a, b) => a.deviance - b.deviance);
  return scored;
}

/**
 * Whether `harmonyType` is one this module can build.
 *
 * Every key of `HARMONY_OFFSETS` works, which is the point: a type is a row in
 * that table, not a bespoke method, so the ten the page offers are the ten
 * every surface can offer.
 */
export function isKnownHarmonyType(harmonyType: string): boolean {
  return Object.hasOwn(HARMONY_OFFSETS, harmonyType);
}

/**
 * Choose a dye for every slot of a harmony.
 *
 * Callers filter `candidates` themselves — this function does not know about
 * anyone's dye-filter shape, and pre-filtering is what makes "the nearest
 * ALLOWED dye to the ideal" the answer, rather than "the nearest allowed dye to
 * a dye that was thrown away".
 *
 * @param baseHex     the colour the harmony is built around; supplies H, S and V
 * @param harmonyType a key of `HARMONY_OFFSETS`
 * @param candidates  the pool to choose from, already filtered
 * @param config      ranking and de-duplication behaviour
 * @param options     dyes to exclude, and any slots the caller has pinned
 * @returns one slot per offset; `dye` is `null` for a slot with no candidate
 */
export function generateHarmonySlots(
  baseHex: string,
  harmonyType: string,
  candidates: readonly Dye[],
  config: HarmonySelectionConfig,
  options?: HarmonySelectionOptions
): HarmonySlot[] {
  // Own-property check, not a truthiness one: `HARMONY_OFFSETS['toString']`
  // returns Object.prototype.toString, which is TRUTHY, so a `!offsets` guard
  // sails past it and the `.forEach` below throws. The web app reads this type
  // straight out of a share URL (`?harmony=`), so the key really can be
  // arbitrary.
  if (!isKnownHarmonyType(harmonyType)) return [];
  const offsets = HARMONY_OFFSETS[harmonyType];

  const wheel = getColorWheel(config.wheel ?? DEFAULT_COLOR_WHEEL);
  const baseWheelHue = wheel.hueOf(baseHex);
  const companionCount = config.companionCount ?? 0;
  const preventDuplicates = config.preventDuplicates ?? false;

  // Two different questions, and they were one set until 2026-09-03.
  //
  // `excluded` is "must never be chosen" — normally the base dye itself, which
  // is never a member of its own harmony. A custom colour has no dye to
  // exclude, which is why this is a list rather than a required base dye:
  // `/harmony color:#FF0000` has a hex and nothing else.
  //
  // `used` is "already on screen", and only matters when the caller asked for
  // no repeats.
  //
  // Seeding `used` with the exclusions conflated them, and `used` is read only
  // on the `preventDuplicates` branch — so with duplicates allowed the
  // exclusions did nothing at all, against this function's own documented
  // contract. bot-logic defaults `preventDuplicates` to false, so `/harmony
  // monochromatic` (a single `[0]` offset, whose ideal IS the base colour)
  // answered the base dye as its own harmony at deltaE 0, and `/harmony
  // analogous` on a near-grey answered the base twice.
  const excluded = new Set<number>(options?.excludeItemIDs ?? []);
  const used = new Set<number>();
  const slots: HarmonySlot[] = [];

  offsets.forEach((offset, index) => {
    const normalisedOffset = ((offset % 360) + 360) % 360;
    const wheelHue = (baseWheelHue + normalisedOffset) % 360;
    // The wheel builds the ideal. Warp wheels carry the BASE's saturation and
    // value onto the mapped hue — the whole reason a desaturated base finds
    // desaturated dyes; the constant-lightness wheel carries L and C instead.
    const { targetHex, targetHue } = wheel.target(baseHex, wheelHue);

    const ranked = rankCandidates(candidates, targetHue, targetHex, config);

    const pin = options?.pinned?.get(index);
    // Every branch below assigns, so no initialiser: an unread `= null` here
    // would be one more place for a future edit to leave a slot silently empty.
    let chosen: ScoredCandidate | null;

    if (pin) {
      // An explicit hand-swap wins its slot outright, exclusions included: the
      // user naming a dye outranks our guess about which dyes are eligible.
      chosen = { dye: pin, deviance: devianceFor(pin, targetHue, targetHex, config) };
    } else if (preventDuplicates) {
      // First eligible-and-unused, else the nearest eligible even if already
      // shown: a slot with a dye repeated beats a slot left blank. An excluded
      // dye is not a fallback in either case.
      chosen =
        ranked.find((c) => !excluded.has(c.dye.itemID) && !used.has(c.dye.itemID)) ??
        ranked.find((c) => !excluded.has(c.dye.itemID)) ??
        null;
    } else {
      chosen = ranked.find((c) => !excluded.has(c.dye.itemID)) ?? null;
    }

    if (chosen) used.add(chosen.dye.itemID);

    const companions: Dye[] = [];
    if (companionCount > 0) {
      for (const candidate of ranked) {
        if (companions.length >= companionCount) break;
        if (excluded.has(candidate.dye.itemID)) continue;
        if (chosen && candidate.dye.itemID === chosen.dye.itemID) continue;
        if (preventDuplicates && used.has(candidate.dye.itemID)) continue;
        companions.push(candidate.dye);
        if (preventDuplicates) used.add(candidate.dye.itemID);
      }
    }

    slots.push({
      index,
      offset: normalisedOffset,
      targetHue,
      wheelHue,
      targetHex,
      dye: chosen?.dye ?? null,
      deviance: chosen?.deviance ?? 0,
      companions,
    });
  });

  return slots;
}
