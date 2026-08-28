/**
 * The two constraints the whole redesign rests on, asserted across every
 * 5.0 card at once.
 *
 * These are not style preferences and a per-generator test does not catch
 * them, because the failure mode is a *new* card quietly opting out:
 *
 * 1. **400 × ≤350.** The canvas width IS the display width. Past 350 px the
 *    Discord client contracts the box horizontally, so a taller image is
 *    served *narrower* than 400 and every type size in it shrinks again —
 *    which is the original defect, arriving through the back door.
 * 2. **Nothing below 11 px.** The v4 cards drew 8–9 px labels into a 0.5×
 *    reduction and arrived at 4–5 px on screen. 11/13/16 is the floor.
 *
 * Each case is measured in the *binding* locale — German for length, so the
 * ellipsis and wrap paths run rather than the happy path.
 */

import { describe, it, expect } from 'vitest';
import { CARD_WIDTH, CARD_MAX_HEIGHT, CARD_TYPE, CARD_DARK, CARD_LIGHT } from './frame.js';
import { generateHarmonyCard } from './harmony-card.js';
import { generateGradientCard } from './gradient.js';
import { generateMixerCard } from './mixer-card.js';
import { generatePaletteGrid } from './palette-grid.js';
import { generateNearestSheet } from './nearest-sheet.js';
import { generateRandomDyesGrid } from './random-dyes-grid.js';
import { generateContrastCard } from './contrast-card.js';
import { generateComparisonCard } from './comparison-card.js';

// German runs long; the real names come from core's locale data rather than
// being hand-written (an invented one eventually gets reasoned from).
const LONG_NAME = 'Johannisbeerenvioletter';
const LONG_NAME_2 = 'Metallic kobaltgrüner';
const HEXES = ['#781A1A', '#658241', '#000B9D', '#28847F', '#E4DFD0', '#2B2923'];

const cards: Array<{ name: string; svg: () => string }> = [
  {
    name: '/harmony · 4 slots · off-default method',
    svg: () =>
      generateHarmonyCard({
        typeLabel: 'Tetradisch',
        baseHex: HEXES[0],
        baseName: 'Dalamudroter',
        baseAngle: '0°',
        slots: [0, 1, 2, 3].map((i) => ({
          idealHex: HEXES[i],
          hex: HEXES[i + 1],
          localizedName: LONG_NAME,
          subText: `${HEXES[i]} · FARBNR. 12${i}`,
          deltaE: 12.3 + i,
          angleLabel: `${(i + 1) * 90}°`,
        })),
        labels: {
          base: 'BASIS',
          ideal: 'IDEALFARBTON',
          found: 'NÄCHSTER FARBSTOFF',
          bandKey: 'Bänder: ≤6 / ≤12 / ≤20',
          derivedNote: 'ΔE2000-Ableitung',
        },
        tierWords: ['EXAKT', 'NAH', 'LOSE', 'UNERREICHBAR'],
        verdict: `270° · ${LONG_NAME_2} · 18,4`,
        method: 'redmean',
        lang: 'de',
      }),
  },
  {
    name: '/gradient · 5 rows + verdict',
    svg: () =>
      generateGradientCard({
        headerText: 'OKLCH · 12',
        strip: Array.from({ length: 12 }, (_, i) => ({
          idealHex: HEXES[i % HEXES.length],
          dyeHex: HEXES[(i + 1) % HEXES.length],
        })),
        rows: [0, 1, 2, 3, 4].map((i) => ({
          stepText: `${i + 2}–${i + 3}`,
          idealHex: HEXES[i],
          dyeHex: HEXES[i + 1],
          name: LONG_NAME,
          deltaE: 10.1 + i,
        })),
        verdict: '12 Schritte ergeben 2 Farbstoffe. Dazwischen gibt es im Spiel nichts.',
        legend: 'Streifen = alle 12 Schritte · Zeilen = die 5 größten Lücken',
        lang: 'de',
      }),
  },
  {
    name: '/mixer · 5 ratios',
    svg: () =>
      generateMixerCard({
        modeLabel: 'OKLAB',
        dyeA: { hex: HEXES[0], name: LONG_NAME },
        dyeB: { hex: HEXES[2], name: LONG_NAME_2 },
        rows: [15, 35, 50, 65, 85].map((pct, i) => ({
          pct,
          blendHex: HEXES[i],
          dyeHex: HEXES[i + 1],
          name: LONG_NAME,
          deltaE: 2.6 + i,
          best: pct === 65,
        })),
        ratioKey: 'Kontur = Mischung · Fläche = nächster Farbstoff',
        lang: 'de',
      }),
  },
  {
    name: '/extractor image · 10-colour band, 5 rows',
    svg: () =>
      generatePaletteGrid({
        title: 'Palette aus dem Bild',
        band: Array.from({ length: 10 }, (_, i) => ({
          hex: HEXES[i % HEXES.length],
          share: i === 0 ? 42 : 2,
        })),
        rows: [0, 1, 2, 3, 4].map((i) => ({
          share: 42 - i * 8,
          extractedHex: HEXES[i],
          matchedHex: HEXES[i + 1],
          matchedName: LONG_NAME,
          deltaE: 3.2 + i,
        })),
        labels: {
          share: 'ANTEIL',
          matched: 'PASSENDER FARBSTOFF',
          rampKey: 'Bandbreite = Bildanteil',
        },
        lang: 'de',
      }),
  },
  {
    name: '/extractor color · 5 ranks',
    svg: () =>
      generateNearestSheet({
        targetHex: HEXES[0],
        targetText: '#781A1A',
        rows: [0, 1, 2, 3, 4].map((i) => ({
          rank: i + 1,
          hex: HEXES[i + 1],
          name: LONG_NAME,
          deltaE: 1.4 + i,
        })),
        labels: {
          target: 'ZIEL',
          rank: 'RANG',
          nearest: 'NÄCHSTE FARBSTOFFE',
          matchKey: 'nächste per ΔE2000',
        },
        lang: 'de',
      }),
  },
  {
    name: '/dye random · 5 rows',
    svg: () =>
      generateRandomDyesGrid({
        title: 'Zufällige Farbstoffe',
        dyes: [0, 1, 2, 3, 4].map((i) => ({
          hex: HEXES[i],
          localizedName: LONG_NAME,
          localizedCategory: 'Staatliche Gesellschaften',
          stainID: 100 + i,
        })),
        labels: { name: 'FARBSTOFF', cat: 'KATEGORIE', stain: 'FARBNR.' },
      }),
  },
  {
    name: '/contrast · 6 pairs (13C·1 plot)',
    svg: () =>
      generateContrastCard({
        pairs: [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 4],
          [4, 5],
          [0, 5],
        ].map(([a, b], i) => ({
          hexA: HEXES[a],
          hexB: HEXES[b],
          nameA: LONG_NAME,
          nameB: LONG_NAME_2,
          abbrA: 'JOH',
          abbrB: 'MET',
          ratio: 1.36 + i * 1.9,
        })),
        labels: {
          title: 'Kontrast — 4 Farbstoffe',
          pairCol: 'PAAR',
          ratioCol: 'VERHÄLTNIS',
          ratioShort: 'VERH.',
          worstPair: 'SCHWÄCHSTES PAAR',
          rest: 'REST',
          bands: ['UNTER 3:1', '≥ 3:1', '≥ 4,5:1', '≥ 7:1'],
          floorKey: 'Nicht-Text: 3:1 · WCAG 1.4.11',
          plotKey: 'Position = Verhältnis, log.',
        },
        lang: 'de',
      }),
  },
  {
    name: '/compare · 2 dyes (14A duel, seven readouts)',
    svg: () =>
      generateComparisonCard({
        dyes: [0, 1].map((i) => ({
          hex: HEXES[i],
          name: LONG_NAME,
          abbr: 'JOH',
          metaText: `${HEXES[i]} · FARBNR. 10${i}`,
        })),
        deltaE: () => 44.5,
        // The seven-readout strip is the densest row in the suite: seven
        // columns across 368 px, and REDMEAN is the widest label in it.
        readouts: [
          { short: 'ΔE2000', value: '44,5' },
          { short: 'ΔEOK', value: '0,182' },
          { short: 'ΔE76', value: '52,1' },
          { short: 'REDMEAN', value: '188' },
          { short: 'RGB', value: '204' },
          { short: 'DIST%', value: '46%' },
          { short: 'RATIO', value: '4,33:1' },
        ],
        labels: {
          title: 'Vergleich — 2 Farbstoffe',
          tags: ['GLEICH', 'NAH', 'ÄHNLICH', 'FERN'],
          cmpKey: 'grün = nah · Bänder 5 / 10 / 20',
          ratioKey: 'Verhältnis misst Helligkeit',
          triKey: 'oberes Dreieck · jedes Paar einmal',
        },
        lang: 'de',
      }),
  },
  {
    name: '/compare · 3 dyes (14C·2 triangle, full names)',
    svg: () =>
      generateComparisonCard({
        dyes: [0, 1, 2].map((i) => ({
          hex: HEXES[i],
          name: LONG_NAME,
          abbr: 'JOH',
          metaText: `${HEXES[i]} · FARBNR. 10${i}`,
        })),
        deltaE: (i, j) => 4.2 + i + j,
        labels: {
          title: 'Vergleich — 3 Farbstoffe',
          tags: ['GLEICH', 'NAH', 'ÄHNLICH', 'FERN'],
          cmpKey: 'grün = nah · Bänder 5 / 10 / 20',
          ratioKey: 'Verhältnis misst Helligkeit',
          triKey: 'oberes Dreieck · jedes Paar einmal',
        },
        lang: 'de',
      }),
  },
  {
    name: '/compare · 4 dyes (14C triangle)',
    svg: () =>
      generateComparisonCard({
        dyes: [0, 1, 2, 3].map((i) => ({
          hex: HEXES[i],
          name: LONG_NAME,
          abbr: 'JOH',
          metaText: `${HEXES[i]} · FARBNR. 10${i}`,
        })),
        deltaE: (i, j) => 4.2 + i + j,
        labels: {
          title: 'Vergleich — 4 Farbstoffe',
          tags: ['GLEICH', 'NAH', 'ÄHNLICH', 'FERN'],
          cmpKey: 'grün = nah · Bänder 5 / 10 / 20',
          ratioKey: 'Verhältnis misst Helligkeit',
          triKey: 'oberes Dreieck · jedes Paar einmal',
        },
        lang: 'de',
      }),
  },
];

/** Every `font-size="N"` in the document. */
function fontSizes(svg: string): number[] {
  return [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
}

function dimensions(svg: string): { width: number; height: number } {
  const w = /<svg[^>]*\bwidth="(\d+)"/.exec(svg);
  const h = /<svg[^>]*\bheight="(\d+)"/.exec(svg);
  return { width: Number(w?.[1]), height: Number(h?.[1]) };
}

describe('frame budget — every 5.0 card, in the binding locale', () => {
  it.each(cards)('$name draws 400 wide and never exceeds 350', ({ svg }) => {
    const { width, height } = dimensions(svg());
    expect(width).toBe(CARD_WIDTH);
    expect(height).toBeGreaterThan(0);
    expect(height).toBeLessThanOrEqual(CARD_MAX_HEIGHT);
  });

  it.each(cards)('$name never draws below the 11 px type floor', ({ svg }) => {
    const sizes = fontSizes(svg());
    expect(sizes.length).toBeGreaterThan(0);
    const below = sizes.filter((s) => s < CARD_TYPE.label);
    expect(below, `sizes below ${CARD_TYPE.label}px: ${below.join(', ')}`).toEqual([]);
  });

  it('the constants themselves have not drifted', () => {
    // A card that "fits" because someone raised the ceiling is the original
    // defect wearing a different hat.
    expect(CARD_WIDTH).toBe(400);
    expect(CARD_MAX_HEIGHT).toBe(350);
    expect(CARD_TYPE).toEqual({ label: 11, value: 13, name: 16 });
  });

  it('carries the Turn 13/14 tier ramp, not the Swatch doc revision', () => {
    // Settled 2026-08-09. The design set disagreed with itself; Turns 13/14
    // win because that ramp is also the shipped ramp in eight web-app
    // components, so it is what a player has learned to read.
    expect(CARD_DARK.tiers).toEqual(['#5bbd68', '#8bc34a', '#ffc107', '#f4645a']);
    expect(CARD_LIGHT.tiers).toEqual(['#137A33', '#1C7D3A', '#B45309', '#B91C1C']);

    // #F4BF4F is the separate STATE amber (OFF GRID, vendor flag, destructive
    // confirm). A tier answers "how close is this?"; a state answers
    // "something here needs your attention". They must not share a token.
    expect(CARD_DARK.tiers).not.toContain('#F4BF4F');
    expect(CARD_DARK.tiers).not.toContain('#9ecf5e');
  });
});
