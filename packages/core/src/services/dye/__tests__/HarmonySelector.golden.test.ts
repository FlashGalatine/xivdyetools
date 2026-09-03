/**
 * A frozen record of what `generateHarmonySlots` answers, for every dye and
 * every harmony type.
 *
 * ## Why a golden and not a parity test
 *
 * This function was lifted out of the web app on 2026-09-03, and while the lift
 * was in progress a parity test in `apps/web-app` drove the page's own
 * `findClosestDyesToHue` and this function side by side over the same 5,000
 * cases and required identical dyes. That test did its job — it is what says
 * the algorithm was *moved* rather than rewritten — and then it had to go: once
 * the page called core, the only thing keeping its old implementation alive was
 * the test comparing against it, and a second copy of an algorithm maintained
 * solely to be diffed is the exact hazard this whole change was undoing.
 *
 * The digest below is that parity run's output, captured while the two
 * implementations were still both present and still agreed. So it is not a
 * self-referential snapshot of "whatever core did the day someone ran it": it
 * is the web app's pre-move behaviour, and the page has rendered the same dyes
 * since 4.x.
 *
 * ## When this goes red
 *
 * A changed digest means the dyes some harmony returns have moved. That is
 * sometimes correct — a dye added to the database, a deliberate change to
 * `HARMONY_OFFSETS` or to a ΔE implementation — and sometimes an accident. It
 * is never a thing to re-baseline without knowing which. The named sample below
 * fails first and prints actual dye names, so the diff says *what* moved before
 * the digest says *that* something did.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Dye } from '@xivdyetools/types';
import { HARMONY_OFFSETS } from '../../../constants/index.js';
import dyeDatabase from '../../../data/dyes.json' with { type: 'json' };
import { DyeService } from '../../DyeService.js';
import { generateHarmonySlots, type HarmonySelectionConfig } from '../HarmonySelector.js';

const svc = new DyeService(dyeDatabase);
const ALL: Dye[] = svc.getAllDyes();
const TYPES = Object.keys(HARMONY_OFFSETS).sort();

/**
 * The four settings combinations the page can be in. `hue-only` is the
 * "strict matching off" path, which ranks by angular hue distance instead of
 * ΔE — a different code path, not a different parameter.
 */
const CONFIGS: Array<[string, HarmonySelectionConfig]> = [
  [
    'page-defaults',
    {
      usePerceptualMatching: true,
      matchingMethod: 'ciede2000',
      preventDuplicates: true,
      companionCount: 3,
    },
  ],
  [
    'no-dedup',
    {
      usePerceptualMatching: true,
      matchingMethod: 'ciede2000',
      preventDuplicates: false,
      companionCount: 2,
    },
  ],
  [
    'hue-only',
    {
      usePerceptualMatching: false,
      matchingMethod: 'ciede2000',
      preventDuplicates: true,
      companionCount: 1,
    },
  ],
  [
    'oklab',
    {
      usePerceptualMatching: true,
      matchingMethod: 'oklab',
      preventDuplicates: true,
      companionCount: 3,
    },
  ],
];

/** Captured 2026-09-03, while the web app's own implementation still existed. */
const GOLDEN_DIGEST = '711bfcace2c074f562d87208c517d54e9ac00345822f6d234049c99d4460d686';
const GOLDEN_ROWS = 5000;

/**
 * Three bases picked to span the failure mode that motivated the move: a
 * near-grey (where carrying the base's saturation onto the rotated hue is the
 * whole difference — the bot used to answer Neon Green here), a saturated
 * primary, and a dark neutral.
 */
const SAMPLE: Record<string, Record<string, Array<string | null>>> = {
  'Snow White': {
    analogous: ['Pure White', 'Pearl White'],
    complementary: ['Ice Blue'],
    compound: ['Pure White', 'Ice Blue', 'Pearl White'],
    'inverted-tetradic': ['Pure White', 'Ice Blue', 'Pastel Pink'],
    monochromatic: ['Pure White'],
    shades: ['Pure White', 'Pearl White'],
    'split-complementary': ['Ice Blue', 'Pastel Purple'],
    square: ['Pastel Green', 'Ice Blue', 'Lotus Pink'],
    tetradic: ['Pastel Green', 'Ice Blue', 'Pastel Purple'],
    triadic: ['Pure White', 'Pastel Purple'],
  },
  'Dalamud Red': {
    analogous: ['Orchard Brown', 'Regal Purple'],
    complementary: ['Metallic Cobalt Green'],
    compound: ['Orchard Brown', 'Metallic Cobalt Green', 'Regal Purple'],
    'inverted-tetradic': ['Cactuar Green', 'Metallic Cobalt Green', 'Regal Purple'],
    monochromatic: ['Rust Red'],
    shades: ['Chocolate Brown', 'Rolanberry Red'],
    'split-complementary': ['Ochu Green', 'Storm Blue'],
    square: ['Cactuar Green', 'Metallic Cobalt Green', 'Dragoon Blue'],
    tetradic: ['Moss Green', 'Metallic Cobalt Green', 'Dragoon Blue'],
    triadic: ['Cactuar Green', 'Dragoon Blue'],
  },
  'Soot Black': {
    analogous: ['Deepwood Green', 'Dark Brown'],
    complementary: ['Ink Blue'],
    compound: ['Deepwood Green', 'Ink Blue', 'Dark Brown'],
    'inverted-tetradic': ['Deepwood Green', 'Ink Blue', 'Dark Purple'],
    monochromatic: ['Dark Brown'],
    shades: ['Dark Brown', 'Jet Black'],
    'split-complementary': ['Jet Black', 'Dark Purple'],
    square: ['Deepwood Green', 'Ink Blue', 'Dark Purple'],
    tetradic: ['Deepwood Green', 'Ink Blue', 'Dark Purple'],
    triadic: ['Deepwood Green', 'Dark Purple'],
  },
};

describe('generateHarmonySlots golden output', () => {
  // Ordered before the digest so a failure names dyes rather than hex.
  it.each(Object.keys(SAMPLE))('answers unchanged for %s', (name) => {
    const base = ALL.find((d) => d.name === name);
    expect(base, `${name} is no longer in the dye database`).toBeDefined();

    const actual: Record<string, Array<string | null>> = {};
    for (const type of TYPES) {
      actual[type] = generateHarmonySlots(
        base!.hex,
        type,
        ALL,
        { usePerceptualMatching: true, matchingMethod: 'ciede2000', preventDuplicates: true },
        { excludeItemIDs: [base!.itemID] }
      ).map((s) => s.dye?.name ?? null);
    }

    expect(actual).toEqual(SAMPLE[name]);
  });

  it(
    'answers unchanged across every dye, type and settings combination',
    () => {
      const lines: string[] = [];

      for (const [label, config] of CONFIGS) {
        for (const type of TYPES) {
          // Sorted so the digest does not depend on the database's own order.
          for (const base of [...ALL].sort((a, b) => a.itemID - b.itemID)) {
            const encoded = generateHarmonySlots(base.hex, type, ALL, config, {
              excludeItemIDs: [base.itemID],
            })
              .map(
                (s) =>
                  `${s.offset}:${s.dye ? s.dye.itemID : '-'}` +
                  `[${s.companions.map((d) => d.itemID).join(',')}]`
              )
              .join('|');
            lines.push(`${label}/${type}/${base.itemID}=${encoded}`);
          }
        }
      }

      // A changed row count means the dye database or the offsets table moved,
      // which is a different thing from the algorithm moving — worth telling
      // apart before anyone reads the digest.
      expect(lines).toHaveLength(GOLDEN_ROWS);
      expect(createHash('sha256').update(lines.join('\n')).digest('hex')).toBe(GOLDEN_DIGEST);
    },
    60_000
  );
});
