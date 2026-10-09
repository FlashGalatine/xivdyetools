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
import {
  CARD_WIDTH,
  CARD_MAX_HEIGHT,
  CARD_TYPE,
  CARD_DARK,
  CARD_LIGHT,
  textWidth,
} from './frame.js';
import { generateHarmonyCard } from './harmony-card.js';
import { generateGradientCard } from './gradient.js';
import { generateMixerCard } from './mixer-card.js';
import { generatePaletteGrid } from './palette-grid.js';
import { generateNearestSheet } from './nearest-sheet.js';
import { generateRandomDyesGrid } from './random-dyes-grid.js';
import { generateContrastCard } from './contrast-card.js';
import { generateComparisonCard } from './comparison-card.js';
import { generateGlamourCard } from './glamour-card.js';
import { generateSwatchCard } from './swatch-card.js';
import { generateA11yCard, type A11yCardLabels, type A11yLensRow } from './a11y-card.js';
import { generateDyeInfoCard } from './dye-info-card.js';
import { generateBudgetLedger } from './budget-ledger.js';
import { createMockDye } from '@xivdyetools/test-utils/factories';

// German runs long; the real names come from core's locale data rather than
// being hand-written (an invented one eventually gets reasoned from).
const LONG_NAME = 'Johannisbeerenvioletter';
const LONG_NAME_2 = 'Metallic kobaltgrüner';
const HEXES = ['#781A1A', '#658241', '#000B9D', '#28847F', '#E4DFD0', '#2B2923'];

/** bot-logic's de `card.*` a11y labels, verbatim. */
const A11Y_LABELS_DE: A11yCardLabels = {
  designed: 'WIE ENTWORFEN',
  perceived: 'WIE GESEHEN',
  separation: 'ABSTAND',
  normalShort: 'NORM',
  lens: 'SEHFILTER',
  shift: 'VERSCHIEBUNG',
  sepBandKey: 'Bänder: ≥30 / ≥15 / ≥8 — größer ist sicherer',
  soloKey: 'Balken = relative Verschiebung · kein Urteil',
  worstNote: '',
};

/** Normal + the four lenses, named from core's short de `visions` block. */
const A11Y_LENSES_DE: A11yLensRow[] = [
  ['Normales Sehen', 'NORM'],
  ['Protanopie', 'PROT'],
  ['Deuteranopie', 'DEUT'],
  ['Tritanopie', 'TRIT'],
  ['Achromatopsie', 'ACHR'],
].map(([label, short], i) => ({
  label,
  short,
  deltaE: 41.7 - i * 9.3,
  isNormal: i === 0,
  hexA: HEXES[i],
  hexB: HEXES[i + 1],
}));

/**
 * Each card's own outer margin. Most of the suite sets 16; glamour, swatch,
 * dye-info and the budget ledger were drawn at 15, and the right-anchored
 * gate holds each card to the margin it draws its own header and mark to.
 */
const cards: Array<{ name: string; pad?: number; svg: () => string }> = [
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
  {
    // Five rows and a three-clause count key with two-digit counts: the footer
    // has to wrap here, and at five rows it has no height left for a third line.
    name: '/glamour · 5 pieces, three-clause count key',
    pad: 15,
    svg: () =>
      generateGlamourCard({
        stripHexes: HEXES,
        charSub: 'WALDLÄUFER ♀ · ANAMNESIS',
        title: '12 gefärbte Teile',
        titleExtra: '7 Farbstoffe',
        rows: [
          ['HAUPTHAND', '+12 OPTIKEN', 12, 'fix', 'ZWILLING'],
          ['FINGER (RECHTS)', '+3 OPTIKEN', 3, 'choice', 'OK'],
          ['HANDGELENKE', 'EINZIG', 0, 'block', 'FARBSTOFFE'],
          ['NEBENHAND', '+1 OPTIK', 1, 'block', 'KEINE PROJ'],
          ['KOPF', '+2 OPTIKEN', 2, 'block', 'GESPERRT'],
        ].map(([slotLabel, lookLabel, twins, tone, status], i) => ({
          slotLabel: slotLabel as string,
          lookLabel: lookLabel as string,
          twins: twins as number,
          tone: tone as 'fix' | 'block' | 'choice',
          name: 'Augmentierte Schattenhandschuhe des Schlagens',
          dyes: [
            { hex: HEXES[i], name: LONG_NAME },
            { hex: HEXES[i + 1], name: LONG_NAME_2 },
          ],
          status: status as string,
        })),
        footKey: '5 von 12 gefärbten Teilen · 10 durch Zwilling benannt · 2 ohne Lösung',
        lang: 'de',
      }),
  },
  {
    name: '/swatch · 5 slots, one off grid',
    pad: 15,
    svg: () =>
      generateSwatchCard({
        stripHexes: HEXES,
        charSub: 'MIDLANDER ♀ · ANAMNESIS',
        title: 'Charakter-Farbmuster',
        rows: ['HAUT', 'HAAR', 'STRÄHNEN', 'AUGEN·LR', 'ÄUẞ.IRIS'].map((slotLabel, i) => ({
          slotLabel,
          addr: i === 4 ? 'ABSEITS' : `R1${i}·C${i + 1}`,
          addrWarn: i === 4,
          sourceHex: HEXES[i],
          dyeHex: HEXES[i + 1],
          name: LONG_NAME,
          deltaE: 12.4 + i,
        })),
        labels: {
          lSlot: 'SLOT',
          lNearest: 'NÄCHSTER FARBSTOFF',
          footKey: 'nächste per ΔE2000 · 5 von 12 Slots',
        },
        lang: 'de',
      }),
  },
  {
    name: '/accessibility · one lens (13D)',
    svg: () =>
      generateA11yCard({
        mode: 'lens',
        titleText: `${LONG_NAME} ↔ ${LONG_NAME_2}`,
        subject: A11Y_LENSES_DE[2],
        normalDeltaE: A11Y_LENSES_DE[0].deltaE,
        rows: A11Y_LENSES_DE.filter((_, i) => i !== 2),
        labels: A11Y_LABELS_DE,
        lang: 'de',
      }),
  },
  {
    name: '/accessibility · every lens (13E)',
    svg: () =>
      generateA11yCard({
        mode: 'all',
        titleText: `${LONG_NAME} ↔ ${LONG_NAME_2}`,
        rows: A11Y_LENSES_DE,
        labels: { ...A11Y_LABELS_DE, worstNote: 'am schwächsten: Achromatopsie' },
        lang: 'de',
      }),
  },
  {
    name: '/accessibility · one dye (13H)',
    svg: () =>
      generateA11yCard({
        mode: 'solo',
        titleText: LONG_NAME,
        rows: A11Y_LENSES_DE.map(({ hexB: _hexB, ...l }) => l),
        labels: A11Y_LABELS_DE,
        lang: 'de',
      }),
  },
  {
    name: '/dye info · sheet with "+n more"',
    pad: 15,
    svg: () =>
      generateDyeInfoCard({
        dye: createMockDye({
          stainID: 125,
          name: 'Metallic Cobalt Green',
          hex: HEXES[1],
          rgb: { r: 101, g: 130, b: 65 },
          hsv: { h: 87, s: 50, v: 51 },
          category: 'Greens',
        }),
        localizedName: LONG_NAME,
        localizedCategory: 'Grün',
        stainID: 125,
        srcValue: 'Gehilfen-Schatzkiste · 1.000 Rote Farbpigmente',
        mktValue: 'Zusatzfarbstoff 2 · 52256',
        nearest: [0, 2, 3].map((i) => ({ hex: HEXES[i], name: LONG_NAME_2, deltaE: 8.7 + i })),
        labels: {
          stain: 'FARBNR.',
          src: 'QUELLE',
          mkt: 'MARKT',
          nearest: 'NÄCHSTE FARBSTOFFE',
          nearestMore: '+12 weitere',
        },
        lang: 'de',
      }),
  },
  {
    // Inside the calculator's cap: 43 + 27 header, 3 × 24 groups, 4 × 40 rows,
    // and the off-default method's two-line footer (47) — 349 of 350.
    name: '/budget · 3 groups, 4 rows, off-default method',
    pad: 15,
    svg: () =>
      generateBudgetLedger({
        target: { hex: HEXES[0], name: LONG_NAME, price: '123.456', subLabel: 'nur Markt' },
        groups: [
          { tier: 'Einfacher Farbstoff', price: '1.234', flag: 'HÄNDLER GÜNSTIGER', rows: [0, 1] },
          { tier: 'Zusatzfarbstoff 2', price: null, rows: [2] },
          { tier: 'Gehilfen-Schatzkiste', price: '98.765', rows: [3] },
        ].map((g) => ({
          ...g,
          rows: g.rows.map((i) => ({
            hex: HEXES[i + 1],
            name: LONG_NAME,
            de: '188',
            tier: i % 4,
            tie: i === 3,
            perDe: i === 2 ? null : '13,6k',
          })),
        })),
        labels: {
          lTarget: 'ZIEL',
          lCandidate: 'KANDIDAT',
          deLabel: 'RM',
          perDeLabel: 'GIL/ΔE',
          keyLines: ['GIL/ΔE = (ZIEL − ZEILE) ÷ ΔE2000', 'ΔE-Spalte: Redmean · Verhältnis bleibt ΔE2000'],
        },
        lang: 'de',
        wideDe: true,
      }),
  },
];

/**
 * The same cards in the locales that bind *horizontally*.
 *
 * German binds for length, which is why every fixture above is German — but
 * German cannot exercise `estimateTextWidth`'s wide branch, and that branch is
 * where BUG-054 lived: a CJK glyph is 2× a Latin one and a CJK sentence offers
 * no ASCII space to wrap at, so the ja/ko `/gradient` verdict rendered 432 px
 * and 445.5 px wide on a 400 px card. A Latin-only corpus is green throughout.
 */
const wideCards: Array<{ name: string; pad: number; svg: () => string }> = [
  {
    name: '/gradient · stage-0 verdict · ja',
    pad: 16,
    svg: () =>
      generateGradientCard({
        headerText: 'OKLCH · 6',
        strip: Array.from({ length: 6 }, (_, i) => ({
          idealHex: HEXES[i % HEXES.length],
          dyeHex: HEXES[(i + 1) % HEXES.length],
        })),
        rows: [0, 1].map((i) => ({
          stepText: `${i + 1}`,
          idealHex: HEXES[i],
          dyeHex: HEXES[i + 1],
          name: 'メタリックコバルトグリーン',
          deltaE: 10.1 + i,
        })),
        verdict: '6ステップの該当は2色のみ。中間に存在するカララントはありません。',
        legend: 'バンド = 各ステップ · 行 = 異なるカララント',
        lang: 'ja',
      }),
  },
  {
    name: '/gradient · stage-0 verdict · ko',
    pad: 16,
    svg: () =>
      generateGradientCard({
        headerText: 'OKLCH · 6',
        strip: Array.from({ length: 6 }, (_, i) => ({
          idealHex: HEXES[i % HEXES.length],
          dyeHex: HEXES[(i + 1) % HEXES.length],
        })),
        rows: [0, 1].map((i) => ({
          stepText: `${i + 1}`,
          idealHex: HEXES[i],
          dyeHex: HEXES[i + 1],
          name: '메탈릭 코발트 그린',
          deltaE: 10.1 + i,
        })),
        verdict: '6단계가 염료 2개로 수렴합니다. 그 사이에 해당하는 염료는 없습니다.',
        legend: '밴드 = 각 단계 · 행 = 서로 다른 염료',
        lang: 'ko',
      }),
  },
  {
    name: '/extractor color · 5 ranks · ja',
    pad: 16,
    svg: () =>
      generateNearestSheet({
        targetHex: HEXES[0],
        targetText: '#781A1A',
        rows: [0, 1, 2, 3, 4].map((i) => ({
          rank: i + 1,
          hex: HEXES[i + 1],
          name: 'メタリックコバルトグリーン',
          deltaE: 1.4 + i,
        })),
        labels: {
          target: 'ターゲット',
          rank: 'ランク',
          nearest: '最も近いカララント',
          matchKey: 'ΔE2000による最近傍',
        },
        lang: 'ja',
      }),
  },
  {
    // The count key has no space inside a clause to wrap at, and every glyph
    // in it is double width.
    name: '/glamour · 5 pieces, three-clause count key · ja',
    pad: 15,
    svg: () =>
      generateGlamourCard({
        stripHexes: HEXES,
        charSub: 'ミッドランダー ♀ · ANAMNESIS',
        title: '染色済み12部位',
        titleExtra: '7色',
        rows: ['メインアーム', 'サブアーム', '頭', '胴', '手'].map((slotLabel, i) => ({
          slotLabel,
          lookLabel: i === 2 ? '唯一' : `+${i + 10} 同型`,
          twins: i === 2 ? 0 : i + 10,
          tone: i === 0 ? 'fix' : 'block',
          name: 'メタリックコバルトグリーン・ジャケット',
          dyes: [{ hex: HEXES[i], name: 'メタリックコバルトグリーン' }],
          status: i === 0 ? '代替' : '投影不可',
        })),
        footKey: '染色済み12部位中5部位 · 別アイテムで表示 10 · 解決不可 2',
        lang: 'ja',
      }),
  },
];

/**
 * Right-anchored runs that sit past their card's margin today and are
 * reported rather than fixed here, keyed by case name. Each entry is as
 * narrow as the defect: one text, one x.
 *
 * - /dye info: the band's stain readout is anchored at `CARD_WIDTH - 14`
 *   (dye-info-card.ts, the `${labels.stain} ${stainID}` cardText) — mirroring
 *   the chip's 14 px inset, 1 px proud of the 15 px PAD the name, grid, SRC/MKT
 *   values and mark all use. Found when BUG-144 brought the card into this gate.
 */
const KNOWN_PROUD: Record<string, RegExp> = {
  '/dye info · sheet with "+n more"': /^"FARBNR\. \d+" anchored at 386 \(margin 385\)$/,
};

/** Every `font-size="N"` in the document. */
function fontSizes(svg: string): number[] {
  return [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
}

interface TextSpan {
  x: number;
  content: string;
  size: number;
  font: 'mono' | 'body' | 'display';
  anchor: 'start' | 'end';
}

/**
 * Every `<text>` in the document, with the numbers needed to measure how far
 * it actually reaches.
 *
 * Content inside a `<g transform="translate(…)">` (the command chip) reports
 * its *relative* x, which is smaller than where it truly lands. That makes
 * this parser under-report a right-hand overrun and never invent one — the
 * safe direction for a gate.
 */
function textSpans(svg: string): TextSpan[] {
  return [...svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)].map((m) => {
    const attrs = m[1];
    const family = /font-family="([^"]*)"/.exec(attrs)?.[1] ?? '';
    return {
      x: Number(/\bx="(-?[\d.]+)"/.exec(attrs)?.[1] ?? 0),
      content: m[2],
      size: Number(/font-size="([\d.]+)"/.exec(attrs)?.[1] ?? 0),
      font: family.startsWith('Fragment Mono')
        ? 'mono'
        : family.startsWith('Space Grotesk')
          ? 'display'
          : 'body',
      anchor: /text-anchor="end"/.test(attrs) ? 'end' : 'start',
    };
  });
}

/** The painted span of one text run, in card coordinates. */
function paintedSpan(t: TextSpan): { left: number; right: number } {
  const w = textWidth(t.content, t.size, t.font);
  return t.anchor === 'end' ? { left: t.x - w, right: t.x } : { left: t.x, right: t.x + w };
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

/**
 * The third constraint, and the one that was missing: **the text has to fit
 * the width too.**
 *
 * `frame budget` above measures the canvas (400 × ≤350) and the type floor,
 * but never asked whether the content stays inside the canvas it measured.
 * BUG-054 and pkg-svg-bot-logic-06 both lived in that gap — one overran the
 * card by 45 px of Japanese, the other put a right-anchored ΔE column 8 px
 * outside the margin every other element on the card aligns to.
 */
describe('frame extent — content stays inside the card it is drawn on', () => {
  it.each([...cards, ...wideCards])('$name paints no text outside the canvas', ({ svg }) => {
    const overruns = textSpans(svg())
      .map((t) => ({ t, span: paintedSpan(t) }))
      .filter(({ span }) => span.left < 0 || span.right > CARD_WIDTH)
      .map(({ t, span }) => `"${t.content}" spans ${span.left.toFixed(1)}→${span.right.toFixed(1)}`);

    expect(overruns, `text outside 0–${CARD_WIDTH}px:\n${overruns.join('\n')}`).toEqual([]);
  });

  it.each(wideCards)('$name aligns every right-anchored run to its own margin', ({ svg, pad }) => {
    // The measure column is right-anchored, so its x IS the right edge. A slot
    // table that sums past `CARD_WIDTH − 2 × PAD` pushes it outside the margin
    // the header, footer legend and mark all share.
    const margin = CARD_WIDTH - pad;
    const proud = textSpans(svg())
      .filter((t) => t.anchor === 'end' && t.x > margin)
      .map((t) => `"${t.content}" anchored at ${t.x} (margin ${margin})`);

    expect(proud, `right-anchored past the margin:\n${proud.join('\n')}`).toEqual([]);
  });

  it.each(cards)('$name aligns every right-anchored run to its own margin', ({ name, svg, pad = 16 }) => {
    const margin = CARD_WIDTH - pad;
    const known = KNOWN_PROUD[name];
    const proud = textSpans(svg())
      .filter((t) => t.anchor === 'end' && t.x > margin)
      .map((t) => `"${t.content}" anchored at ${t.x} (margin ${margin})`);

    if (known) {
      // A stale exception fails: once the run moves inside the margin, delete
      // the entry rather than leave a hole in the gate.
      expect(proud.filter((p) => known.test(p)), 'KNOWN_PROUD entry no longer matches — delete it').not.toEqual([]);
    }
    const unexplained = proud.filter((p) => !known?.test(p));
    expect(unexplained, `right-anchored past the margin:\n${unexplained.join('\n')}`).toEqual([]);
  });

  /**
   * Staying on the canvas is not enough on its own: `fitText` can hold any
   * line inside 400 px by *cutting* it, and the card would then be tidy and
   * wrong. A sentence has to survive whole, across as many lines as it needs.
   *
   * This is what separates the fix from its symptom — with the old
   * character-count estimate the ja verdict measured under budget as one
   * 432 px line, so nothing wrapped and the render-time ellipsis ate a third
   * of the sentence. Both halves must hold for this to pass.
   */
  it.each([
    {
      name: 'ja',
      verdict: '6ステップの該当は2色のみ。中間に存在するカララントはありません。',
    },
    {
      name: 'ko',
      verdict: '6단계가 염료 2개로 수렴합니다. 그 사이에 해당하는 염료는 없습니다.',
    },
  ])('the $name verdict wraps in full rather than being ellipsised', ({ name, verdict }) => {
    const svg = wideCards.find((c) => c.name.endsWith(name))!.svg();
    const runs = textSpans(svg).map((t) => t.content);

    // Every code point of the sentence is still drawn, in order, across the
    // lines it wrapped onto. An ellipsised verdict cannot satisfy this: the
    // cut tail is simply absent from the document.
    //
    // (Row dye names ARE legitimately ellipsised by `measuredRow` — they are
    // one slot wide by design — so this asks about the verdict, not about
    // every run on the card.)
    const drawn = runs.join('').replace(/\s/g, '');
    expect(drawn).toContain(verdict.replace(/\s/g, ''));

    // …and it took more than one line to do it, which is the wrap itself.
    expect(runs.some((r) => r !== verdict && verdict.startsWith(r.slice(0, 4)))).toBe(true);
  });
});
