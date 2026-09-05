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

/**
 * Captured 2026-09-03, while the web app's own implementation still existed.
 *
 * Regenerated the same day, once, when `excludeItemIDs` stopped being conflated
 * with `preventDuplicates`. That regeneration was not taken on trust: digesting
 * each config separately, before and after, showed **only `no-dedup` moved** —
 *
 *   page-defaults  9bd6a0b9…  ->  9bd6a0b9…   unchanged
 *   no-dedup       0ba40a51…  ->  49c1782f…   CHANGED
 *   hue-only       e198b9d6…  ->  e198b9d6…   unchanged
 *   oklab          0e62e2aa…  ->  0e62e2aa…   unchanged
 *
 * — which is exactly the config whose behaviour the fix targets, and the page's
 * own defaults are among the three that did not budge. Over the same 5,000 rows
 * the base dye appeared inside its own harmony **675 times before and 0 after**.
 * The named `SAMPLE` assertions below never moved at all.
 */
/**
 * Regenerated 2026-09-04 for the exact-CIE-constants change (5.1.0), and again
 * not taken on trust. Per-config digests, before -> after:
 *
 *   page-defaults  9bd6a0b9…  ->  c1c7e3c9…   CHANGED
 *   no-dedup       49c1782f…  ->  df28b34a…   CHANGED
 *   hue-only       e198b9d6…  ->  e198b9d6…   unchanged
 *   oklab          0e62e2aa…  ->  0e62e2aa…   unchanged
 *
 * Exactly the two ΔE2000-ranked configs moved, which is the expected shape:
 * `hue-only` ranks by angular hue distance and `oklab` ranks in OKLAB, so
 * neither reads CIELAB at all.
 *
 * Row-level diff: **4 rows of 5,000 (0.08%)**, all on one base dye (Lime
 * Green, 5773) for `triadic` and `tetradic`. **No chosen dye changed** — every
 * `offset:dyeID` is identical before and after. What moved is the order of two
 * COMPANIONS: Metallic Purple (13723) and Cherry Pink (30117) against the 240°
 * target `#B054AB` measure ΔE00 14.166463869861 and 14.166455222891 — 8.6e-6
 * apart. Core's old `round(lab, 4)` collapsed that gap to a tie, which then
 * broke on database order; without the rounding the marginally closer dye
 * sorts first, which is the intended behaviour.
 *
 * The named `SAMPLE` assertions below did not move.
 *
 * Regenerated AGAIN in the same release for delta-EOK2 (Sprint 3.5), and the
 * shape is completely different — deliberately so:
 *
 *   page-defaults  c1c7e3c9…  ->  c1c7e3c9…   unchanged
 *   no-dedup       df28b34a…  ->  df28b34a…   unchanged
 *   hue-only       e198b9d6…  ->  e198b9d6…   unchanged
 *   oklab          0e62e2aa…  ->  274ee31e…   CHANGED
 *
 * **1,237 of 5,000 rows (24.7%)** moved, and every single one is in the
 * `oklab` config — 705 of them a different chosen dye, 532 a companion
 * reorder. That is 99% of that config's 1,250 rows, which is what a metric
 * change should look like: `getDeltaE_Oklab` became delta-EOK2 (CSS Color 4
 * §20.4, `a` and `b` scaled by 2), so every oklab ranking is recomputed and
 * nothing that does not read OKLAB is touched.
 *
 * This is a user-visible change for anyone who has selected the `oklab`
 * matching method. It is not the default (`ciede2000` is), and the
 * justification is measured: against CIEDE2000 as the perceptual reference
 * over 2,000 random sRGB queries, plain delta-EOK picks a different winning
 * dye 30.4% of the time and delta-EOK2 24.4%.
 */
const GOLDEN_DIGEST = '740c740a88809814774a7d37d3cb1de4d8b19c1644e95794bb6108ee958f214a';
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

/**
 * One config per non-RGB wheel, page defaults otherwise. A change to a wheel
 * table is a deliberate re-baseline with the reason in the commit; the named
 * samples print dye names first so the diff says WHAT moved.
 */
const WHEEL_CONFIGS: Array<[string, HarmonySelectionConfig]> = (
  ['ryb', 'munsell', 'oklch-hue', 'oklch-lightness'] as const
).map((wheel) => [
  wheel,
  { usePerceptualMatching: true, matchingMethod: 'ciede2000', preventDuplicates: true, companionCount: 3, wheel },
]);

/**
 * Captured on first run (Task 7 step 6); see the commit that added each.
 *
 * `oklch-hue` re-baselined 2026-09-05 (fix wave 2, item 8) and, like every
 * re-baseline above, not taken on trust:
 *
 *   ryb              d3f511e8…  ->  d3f511e8…   unchanged
 *   munsell          437788cb…  ->  437788cb…   unchanged
 *   oklch-hue        c927b9fb…  ->  d3e36ef2…   CHANGED
 *   oklch-lightness  d749fe5c…  ->  d749fe5c…   unchanged
 *
 * The generator used to pair the OKLab hue of `hsvToHex(h, 100, 100)` with the
 * loop's nominal `h`, but `hsvToHex` rounds to 8 bits, so the colour actually
 * measured sits at `hexToHsv(hex).h`. Pairing each OKLab hue with the HSV hue
 * of the SAME sample moves the table's second column by at most **0.12°**.
 *
 * Row-level diff: **60 of 1,250 rows (4.8%)**, of which only **16** change a
 * chosen dye — and every one of those 16 is a swap between the winner and its
 * own first companion (e.g. complementary/Dalamud-family 5734: 5796 ↔ 13716),
 * i.e. two dyes that were already within a hair of each other on ΔE. Nothing
 * else moved: the RGB `GOLDEN_DIGEST` and the three other wheels are byte
 * identical, and `WHEEL_SAMPLE['oklch-hue']` — Turquoise Green, Ochu Green,
 * Dragoon Blue — did not move either, so it is NOT re-baselined here.
 */
const WHEEL_DIGESTS: Record<string, string> = {
  ryb: 'd3f511e8d6b34cab5921e9ae5ed73d640f4a8565e4a728681e8707507f6e6232',
  munsell: '437788cb69868970750c58bd4e63b89b96a167b383eb228f5561c20e8d5587d6',
  'oklch-hue': 'd3e36ef2c85d397b2f8b6b0043d58435b440a11542ae6dda711cfb94557809f4',
  'oklch-lightness': 'd749fe5c16a14bdf1ab0ba689fcd558f06ef28ae4238db985a455f6119111625',
};

/**
 * Dalamud Red's complementary and triadic partners per wheel — the sample that
 * names dyes. Sanity-checked at capture time (Task 7 step 6): the RYB
 * complementary is a green-family dye (Ochu Green, #406339), not RGB's
 * Metallic Cobalt Green (#28847f); the oklch-lightness complementary (Morbol
 * Green, #1f4646, perceived luminance ≈23%) sits much closer to Dalamud Red's
 * own darkness (#781a1a, ≈21%) than RGB's pick (Metallic Cobalt Green, ≈41%).
 */
const WHEEL_SAMPLE: Record<string, { complementary: Array<string | null>; triadic: Array<string | null> }> = {
  ryb: { complementary: ['Ochu Green'], triadic: ['Moss Green', 'Othard Blue'] },
  munsell: { complementary: ['Metallic Cobalt Green'], triadic: ['Cactuar Green', 'Othard Blue'] },
  'oklch-hue': { complementary: ['Turquoise Green'], triadic: ['Ochu Green', 'Dragoon Blue'] },
  'oklch-lightness': { complementary: ['Morbol Green'], triadic: ['Hunter Green', 'Storm Blue'] },
};

describe('generateHarmonySlots golden output per colour wheel', () => {
  const red = ALL.find((d) => d.name === 'Dalamud Red')!;

  it.each(WHEEL_CONFIGS)('names the same dyes for Dalamud Red on %s', (wheel, config) => {
    const actual = {
      complementary: generateHarmonySlots(red.hex, 'complementary', ALL, config, { excludeItemIDs: [red.itemID] }).map(
        (s) => s.dye?.name ?? null
      ),
      triadic: generateHarmonySlots(red.hex, 'triadic', ALL, config, { excludeItemIDs: [red.itemID] }).map(
        (s) => s.dye?.name ?? null
      ),
    };
    expect(actual).toEqual(WHEEL_SAMPLE[wheel]);
  });

  it.each(WHEEL_CONFIGS)('answers unchanged across every dye and type on %s', (wheel, config) => {
    const lines: string[] = [];
    for (const type of TYPES) {
      for (const base of [...ALL].sort((a, b) => a.itemID - b.itemID)) {
        const encoded = generateHarmonySlots(base.hex, type, ALL, config, { excludeItemIDs: [base.itemID] })
          .map((s) => `${s.offset}:${s.dye ? s.dye.itemID : '-'}[${s.companions.map((d) => d.itemID).join(',')}]`)
          .join('|');
        lines.push(`${type}|${base.itemID}|${encoded}`);
      }
    }
    const digest = createHash('sha256').update(lines.join('\n')).digest('hex');
    expect(digest).toBe(WHEEL_DIGESTS[wheel]);
  });

  it('RGB and RYB disagree on the complement for most saturated dyes (the feature is not cosmetic)', () => {
    const rgbCfg = { ...WHEEL_CONFIGS[0][1], wheel: 'rgb' as const };
    const rybCfg = WHEEL_CONFIGS[0][1];
    let changed = 0;
    for (const base of ALL) {
      const a = generateHarmonySlots(base.hex, 'complementary', ALL, rgbCfg, { excludeItemIDs: [base.itemID] })[0]?.dye?.itemID;
      const b = generateHarmonySlots(base.hex, 'complementary', ALL, rybCfg, { excludeItemIDs: [base.itemID] })[0]?.dye?.itemID;
      if (a !== b) changed++;
    }
    // research 05 §6 measured 63/125 with a 124-dye pool; allow for pool and companion differences
    expect(changed / ALL.length).toBeGreaterThan(0.3);
  });
});

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
